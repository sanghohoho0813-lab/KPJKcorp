import type { Company, CompanyVault, CustomField, ProfileGroup } from "./types";
import { ENTITY_TYPES, formatBizNo, formatCorpNo, formatPhone } from "./company-options";
import { DOC_SOURCE_LABEL } from "./docparse";

/**
 * 회사 기본 정보 — 자주 찾아 옮겨 적는 값을 한 장에.
 *
 * 신청서·홈택스·기관 사이트에 매번 같은 번호를 옮겨 적는다. 칸이 "[ ]-[ ]-[ ]"로 나뉜 곳이 많아
 * 번호는 조각마다 따로, 또는 하이픈 없이 숫자만 복사할 수 있어야 한다.
 * 나이·업력은 저장하지 않고 볼 때마다 계산한다 — 날짜가 지나면 저절로 바뀐다.
 */

/* ---------------- 날짜 ---------------- */

/** 2002-02-16 · 20020216 · 2002.02.16 · 2002/2/16 을 모두 읽는다 */
function ymd(s: string): [number, number, number] | null {
  const t = s.trim();
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(t);
  if (!m) m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return [y, mo, d];
}

export function todayLocal(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** 못 읽으면 원문 그대로 — 날짜를 지어내지 않는다 */
export function formatYmd(value: string): string {
  const p = ymd(value);
  if (!p) return value.trim();
  return `${p[0]}-${String(p[1]).padStart(2, "0")}-${String(p[2]).padStart(2, "0")}`;
}

/** 입력칸 값 → 저장값. 날짜로 읽히면 YYYY-MM-DD, 아니면 undefined */
export function normalizeDate(value: string): string | undefined {
  return ymd(value) ? formatYmd(value) : undefined;
}

/** 만 나이 (생일 안 지났으면 -1) */
export function ageFrom(birth: string, today = todayLocal()): number | null {
  const b = ymd(birth); const t = ymd(today);
  if (!b || !t) return null;
  let age = t[0] - b[0];
  if (t[1] < b[1] || (t[1] === b[1] && t[2] < b[2])) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}

/** 업력 — 만 몇 년, 그리고 "N년차" */
export function yearsInBusiness(establishedAt: string, today = todayLocal()): { fullYears: number; nthYear: number } | null {
  const e = ymd(establishedAt); const t = ymd(today);
  if (!e || !t) return null;
  let full = t[0] - e[0];
  if (t[1] < e[1] || (t[1] === e[1] && t[2] < e[2])) full -= 1;
  if (full < 0 || full > 200) return null;
  return { fullYears: full, nthYear: full + 1 };
}

/* ---------------- 번호 ---------------- */

export type NumberKind = "business" | "corporate" | "phone";

/** 보이는 모양 — 하이픈 포함. 자릿수가 안 맞으면 원문 그대로(지어내지 않는다) */
export function formatNumberOf(kind: NumberKind, value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  const n = raw.replace(/\D/g, "").length;
  if (kind === "business") return n === 10 ? formatBizNo(raw) : raw;
  if (kind === "corporate") return n === 13 ? formatCorpNo(raw) : raw;
  return n === 10 || n === 11 ? formatPhone(raw) : raw;
}

/** 복사용 — 하이픈을 뺀 숫자만. 숫자가 없으면 원문 */
export function digitsOf(value: string): string {
  const d = value.replace(/\D/g, "");
  return d === "" ? value.trim() : d;
}

/** `313-81-12508` → ['313','81','12508']. 나눌 것이 없거나 숫자가 아닌 조각이 섞이면 [] */
export function numberSegments(value: string): string[] {
  const parts = value.trim().split("-");
  if (parts.length < 2) return [];
  return parts.every((p) => /^\d+$/.test(p)) ? parts : [];
}

/* ---------------- 카드 한 줄 ---------------- */

export const GROUP_LABEL: Record<ProfileGroup, string> = { identity: "회사", people: "사람", contact: "연락처", credential: "인증서" };
export const GROUP_ORDER: ProfileGroup[] = ["identity", "people", "contact", "credential"];

export type EditKind = "text" | "date" | "gender" | "number" | "none";

export interface ProfileRow {
  key: string;
  group: ProfileGroup;
  label: string;
  /** 화면에 보이는 값 (비어 있으면 "") */
  value: string;
  numberKind?: NumberKind;
  copyable: boolean;
  wide?: boolean;
  /** 고치면 바뀌는 기업 필드. 없으면 화면에서 직접 못 고침 */
  field?: keyof Company;
  edit: EditKind;
  /** 입력칸에 처음 넣을 원래 값 */
  raw?: string;
  placeholder?: string;
  /** 서류에서 읽은 값이면 출처 — 예: "사업자등록증에서 읽음" */
  from?: string;
  custom?: CustomField;
}

function fromOf(c: Company, key: string): string | undefined {
  for (const kind of ["bizReg", "corpReg"] as const) {
    if (c.docs?.[kind]?.fields.includes(key)) return `${DOC_SOURCE_LABEL[kind]}에서 읽음`;
  }
  return undefined;
}

export function profileRows(c: Company, vault: CompanyVault | undefined, today = todayLocal()): ProfileRow[] {
  const rows: ProfileRow[] = [];
  const add = (r: Omit<ProfileRow, "from"> & { from?: string }) => rows.push({ ...r, from: r.from ?? (r.field ? fromOf(c, r.field) : undefined) });

  // 회사
  add({ key: "name", group: "identity", label: "기업명", value: c.name, copyable: true, field: "name", edit: "text", raw: c.name });
  add({ key: "entityType", group: "identity", label: "사업자 형태", value: ENTITY_TYPES.find((t) => t.key === c.entityType)?.label ?? "", copyable: false, edit: "none" });
  const biz = c.establishedAt ? yearsInBusiness(c.establishedAt, today) : null;
  add({
    key: "establishedAt", group: "identity", label: "설립일 · 업력", field: "establishedAt", edit: "date", raw: c.establishedAt ?? "", placeholder: "2019-03-05", copyable: true,
    value: c.establishedAt ? `${formatYmd(c.establishedAt)}${biz ? ` · ${biz.nthYear}년차 (만 ${biz.fullYears}년)` : ""}` : "",
  });
  add({ key: "bizNo", group: "identity", label: "사업자등록번호", value: formatNumberOf("business", c.bizNo ?? ""), numberKind: "business", copyable: true, field: "bizNo", edit: "text", raw: c.bizNo, placeholder: "000-00-00000" });
  add({ key: "corpNo", group: "identity", label: "법인등록번호", value: formatNumberOf("corporate", c.corpNo ?? ""), numberKind: "corporate", copyable: true, field: "corpNo", edit: "text", raw: c.corpNo ?? "", placeholder: "000000-0000000" });
  add({ key: "bizCategory", group: "identity", label: "업태", value: c.bizCategory ?? "", copyable: true, field: "bizCategory", edit: "text", raw: c.bizCategory ?? "", placeholder: "예: 제조업" });
  add({ key: "bizItem", group: "identity", label: "종목", value: c.bizItem ?? "", copyable: true, field: "bizItem", edit: "text", raw: c.bizItem ?? "", placeholder: "예: 금속가공" });
  if (c.bizItemsExtra) add({ key: "bizItemsExtra", group: "identity", label: "그 외 업태·종목", value: c.bizItemsExtra, copyable: true, wide: true, field: "bizItemsExtra", edit: "text", raw: c.bizItemsExtra });
  add({ key: "industry", group: "identity", label: "업종", value: c.industry ?? "", copyable: true, field: "industry", edit: "text", raw: c.industry ?? "" });
  add({ key: "address", group: "identity", label: "본점 주소", value: c.address ?? "", copyable: true, wide: true, field: "address", edit: "text", raw: c.address ?? "" });
  add({ key: "capital", group: "identity", label: "자본금", value: c.capital ? `${c.capital.toLocaleString("ko-KR")}원` : "", copyable: true, field: "capital", edit: "number", raw: c.capital ? String(c.capital) : "", placeholder: "원 단위 숫자" });

  // 사람
  const age = c.ceoBirth ? ageFrom(c.ceoBirth, today) : null;
  const ceoBits = [c.ceo, c.ceoGender === "male" ? "남" : c.ceoGender === "female" ? "여" : "", c.ceoBirth ? `${formatYmd(c.ceoBirth)}${age !== null ? ` (만 ${age}세)` : ""}` : ""].filter(Boolean);
  add({ key: "ceo", group: "people", label: "대표자", value: ceoBits.join(" · "), copyable: true, field: "ceo", edit: "text", raw: c.ceo });
  add({ key: "ceoBirth", group: "people", label: "대표자 생년월일", value: c.ceoBirth ? formatYmd(c.ceoBirth) : "", copyable: true, field: "ceoBirth", edit: "date", raw: c.ceoBirth ?? "", placeholder: "1980-12-31" });
  add({ key: "ceoGender", group: "people", label: "대표자 성별", value: c.ceoGender === "male" ? "남" : c.ceoGender === "female" ? "여" : "", copyable: false, field: "ceoGender", edit: "gender" });
  add({ key: "contact", group: "people", label: "담당자", value: [c.contactName, c.contactTitle].filter(Boolean).join(" "), copyable: true, field: "contactName", edit: "text", raw: c.contactName });
  add({ key: "employees", group: "people", label: "임직원 수", value: c.employees ? `${c.employees.toLocaleString("ko-KR")}명` : "", copyable: true, field: "employees", edit: "number", raw: c.employees ? String(c.employees) : "", placeholder: "숫자" });
  add({ key: "shareholders", group: "people", label: "주주·임원 구성", value: c.shareholders ?? "", copyable: true, wide: true, field: "shareholders", edit: "text", raw: c.shareholders ?? "", placeholder: "예: 대표 60% · 배우자 40%, 사내이사 1명" });

  // 연락처
  add({ key: "contactPhone", group: "contact", label: "담당자 휴대폰", value: formatNumberOf("phone", c.contactPhone ?? ""), numberKind: "phone", copyable: true, field: "contactPhone", edit: "text", raw: c.contactPhone, placeholder: "010-0000-0000" });
  add({ key: "companyPhone", group: "contact", label: "회사 대표번호", value: formatNumberOf("phone", c.companyPhone ?? ""), numberKind: "phone", copyable: true, field: "companyPhone", edit: "text", raw: c.companyPhone ?? "", placeholder: "02-000-0000" });
  add({ key: "contactEmail", group: "contact", label: "이메일", value: c.contactEmail ?? "", copyable: true, field: "contactEmail", edit: "text", raw: c.contactEmail });
  add({ key: "website", group: "contact", label: "홈페이지", value: c.website ?? "", copyable: true, field: "website", edit: "text", raw: c.website ?? "" });

  // 인증서 — 서류함의 공동인증서 칸을 그대로 비춘다 (비밀번호는 어디에도 적지 않는다)
  const jc = vault?.slots?.jointCert;
  add({
    key: "jointCert", group: "credential", label: "공동인증서", copyable: false, edit: "none",
    value: jc?.received ? ["받음", jc.issuedAt && `발급 ${formatYmd(jc.issuedAt)}`, jc.note && `보관: ${jc.note}`].filter(Boolean).join(" · ") : "아직 안 받음",
  });

  // 직접 만든 칸 — 각 묶음 끝에
  for (const f of c.customFields ?? []) {
    add({ key: `custom:${f.id}`, group: f.group, label: f.label, value: f.value, copyable: true, wide: f.value.length > 24, edit: "text", raw: f.value, custom: f });
  }
  return rows;
}

/** 채운 칸만 "이름: 값" 한 줄씩. digitsOnly 면 번호에서 하이픈을 뺀다 */
export function profileAsText(c: Company, rows: ProfileRow[], digitsOnly = false) {
  const lines = [`[${c.name}] 기본 정보`];
  for (const g of GROUP_ORDER) {
    for (const r of rows.filter((x) => x.group === g && x.value && x.key !== "jointCert")) {
      lines.push(`${r.label}: ${digitsOnly && r.numberKind ? digitsOf(r.value) : r.value}`);
    }
  }
  return lines.join("\n");
}
