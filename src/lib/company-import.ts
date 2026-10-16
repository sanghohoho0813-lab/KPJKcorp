import { isRealDate } from "./format";
import type { Company, EntityType, User } from "./types";
import { REGIONS, bandOfEmployees, formatBizNo, formatCorpNo, formatPhone, industryOf, regionOfAddress } from "./company-options";
import { excelSerialToDate, type SheetData } from "./xlsx";

/**
 * 기업고객 일괄 등록.
 *
 * 컨설팅사는 이미 엑셀로 고객 명단을 들고 있다. 이걸 한 곳씩 다시 치게 하면 도입 첫날에 포기한다.
 * - 머리글 이름이 제각각이어도("상호", "회사명", "기업명") 알아서 맞춘다. 틀리면 화면에서 고친다.
 * - 한 줄씩 등록 화면과 "같은 규칙"으로 검사한다: 필수값, 사업자번호 10자리, 이메일 형식.
 * - 이미 있는 기업(사업자번호 또는 이름이 같음)은 건너뛴다. 덮어쓰지 않는다 — 실수로 기존 정보를 지우지 않게.
 * - 파일에 없는 값은 비워 둔다. 지어내지 않는다.
 */

export type ImportField =
  | "name" | "ceo" | "bizNo" | "corpNo" | "entityType" | "industry" | "bizCategory" | "bizItem" | "bizItemsExtra" | "establishedAt"
  | "address" | "region" | "companyPhone" | "contactName" | "contactTitle" | "contactPhone" | "contactEmail"
  | "employees" | "revenue" | "website" | "firstConsultDate" | "consultant" | "leadSource" | "memo" | "bizRegCheckedAt";

export const IMPORT_FIELDS: { key: ImportField; label: string; required?: boolean; hint?: string; aliases: string[] }[] = [
  { key: "name", label: "기업명", required: true, aliases: ["기업명", "회사명", "상호", "상호명", "법인명", "업체명", "고객사", "고객사명", "기업", "회사"] },
  { key: "ceo", label: "대표자", required: true, aliases: ["대표자", "대표자명", "대표", "대표이사", "대표자성명", "대표명"] },
  { key: "bizNo", label: "사업자번호", hint: "숫자 10자리", aliases: ["사업자번호", "사업자등록번호", "사업자no", "사업자등록no", "사업자"] },
  { key: "corpNo", label: "법인등록번호", hint: "숫자 13자리", aliases: ["법인등록번호", "법인번호"] },
  { key: "entityType", label: "사업자 형태", hint: "법인 / 개인 / 기타", aliases: ["사업자형태", "사업자구분", "법인구분", "법인개인", "법인/개인", "구분"] },
  { key: "industry", label: "업종", hint: "비우면 업태에서", aliases: ["업종", "산업", "산업분류"] },
  { key: "bizCategory", label: "업태", aliases: ["업태"] },
  { key: "bizItem", label: "종목", aliases: ["종목"] },
  // 사업자등록증에 업태·종목이 여러 줄인 회사가 많다 — 등록 화면과 같은 모양("업태 — 종목", 한 칸에 줄마다)
  { key: "bizItemsExtra", label: "그 외 업태·종목", hint: "줄마다 업태 — 종목", aliases: ["그외업태종목", "추가업태종목", "기타업태종목", "업태종목추가", "그외업태", "추가업태"] },
  { key: "establishedAt", label: "설립일", hint: "2019-03-05", aliases: ["설립일", "설립일자", "개업일", "개업일자", "개업연월일", "설립연월일"] },
  { key: "address", label: "주소", aliases: ["주소", "사업장주소", "소재지", "사업장소재지", "본점주소", "회사주소"] },
  { key: "region", label: "지역", hint: "서울·경기 등 — 비우면 주소에서", aliases: ["지역", "시도", "지역구분"] },
  { key: "companyPhone", label: "대표번호", aliases: ["대표번호", "대표전화", "회사전화", "회사번호", "회사연락처"] },
  { key: "contactName", label: "담당자", hint: "비우면 대표자", aliases: ["담당자", "담당자명", "실무자", "고객담당자"] },
  { key: "contactTitle", label: "직책", aliases: ["직책", "직위", "담당자직책", "담당자직위"] },
  { key: "contactPhone", label: "연락처", aliases: ["연락처", "휴대폰", "휴대전화", "핸드폰", "전화번호", "담당자연락처", "담당자휴대폰", "휴대폰번호", "전화"] },
  { key: "contactEmail", label: "이메일", aliases: ["이메일", "email", "e-mail", "메일", "담당자이메일", "이메일주소"] },
  { key: "employees", label: "임직원 수", hint: "숫자", aliases: ["임직원", "임직원수", "직원수", "종업원수", "상시근로자수", "근로자수", "인원", "직원"] },
  { key: "revenue", label: "매출", hint: "예: 32억", aliases: ["매출", "매출액", "연매출", "연매출액", "작년매출"] },
  { key: "website", label: "홈페이지", aliases: ["홈페이지", "웹사이트", "website", "url"] },
  { key: "firstConsultDate", label: "최초 상담일", hint: "비우면 오늘", aliases: ["최초상담일", "첫상담일", "상담일", "최초상담", "등록일"] },
  { key: "consultant", label: "담당 컨설턴트", hint: "이름 — 비우면 등록하는 사람", aliases: ["담당컨설턴트", "컨설턴트", "담당컨설턴트명", "영업담당", "내부담당자"] },
  { key: "leadSource", label: "유입 경로", aliases: ["유입경로", "유입", "경로", "소개경로"] },
  { key: "memo", label: "메모", aliases: ["메모", "비고", "특이사항", "참고", "메모사항"] },
  // 담당자가 사업자등록증을 보고 옮겨 적었다면 그 날 — 기업 상세 "사업자등록증 확인"·고객 체크리스트 "근거 서류 확인"에 남는다
  { key: "bizRegCheckedAt", label: "사업자등록증 확인일", hint: "서류를 보고 옮겨 적은 날", aliases: ["사업자등록증확인일", "사업자등록증확인", "등록증확인일", "서류확인일"] },
];

const FIELD_OF = new Map<string, ImportField>();
for (const f of IMPORT_FIELDS) for (const a of f.aliases) FIELD_OF.set(norm(a), f.key);

function norm(s: string) {
  return s.toLowerCase().replace(/\(필수\)|\(선택\)|[*\s·._\-()[\]:]/g, "");
}

/** 머리글 한 줄 → 열마다 어느 항목인지. 모르는 열은 null(가져오지 않음). 같은 항목이 두 번 나오면 앞의 것만 */
export function mapHeaders(header: string[]): (ImportField | null)[] {
  const used = new Set<ImportField>();
  return header.map((h) => {
    const k = FIELD_OF.get(norm(h ?? ""));
    if (!k || used.has(k)) return null;
    used.add(k);
    return k;
  });
}

/** 제목 줄이 먼저 있는 명단도 있다 — 위 다섯 줄 중 항목을 두 개 이상 알아본 첫 줄을 머리글로 본다 */
export function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(5, rows.length); i += 1) {
    if (mapHeaders(rows[i] ?? []).filter(Boolean).length >= 2) return i;
  }
  return 0;
}

/** 이름 비교용: (주)·주식회사·공백·영문 대소문자를 무시한다 */
export function normalizeCompanyName(s: string) {
  return s.toLowerCase().replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|\(사\)|사단법인|\s/g, "");
}

export type ImportStatus = "ok" | "duplicate" | "error";

/** 이미 있는 기업과 겹친 줄 — 그 기업의 "빈 칸만" 채울 수 있다 (있는 값은 덮어쓰지 않는다) */
export interface ImportMatch {
  id: string;
  name: string;
  /** 이름이 한 글자 다른 기업 — 같은 회사인지 사람이 고른다(기본 꺼짐) */
  similar: boolean;
  fill: Partial<Omit<Company, "id" | "code">>;
  /** 비슷한 이름이면 상호를 이 줄(서류) 대로 고칠 수 있다 */
  renameTo?: string;
}

export const FILL_LABEL: Record<string, string> = {
  ceo: "대표자", bizNo: "사업자번호", corpNo: "법인등록번호", entityType: "사업자 형태", industry: "업종", bizCategory: "업태", bizItem: "종목", bizItemsExtra: "그 외 업태·종목",
  establishedAt: "설립일", address: "주소", region: "지역", companyPhone: "대표번호", contactName: "담당자", contactTitle: "직책", contactPhone: "연락처", contactEmail: "이메일",
  employees: "임직원 수", employeeBand: "임직원 규모", revenue: "매출", website: "홈페이지", leadSource: "유입 경로", memo: "메모", ceoBirth: "대표자 생년월일", capital: "자본금", docs: "서류 확인 기록",
};
const FILL_KEYS = ["ceo", "bizNo", "corpNo", "entityType", "industry", "bizCategory", "bizItem", "bizItemsExtra", "establishedAt", "address", "region", "companyPhone", "contactPhone", "contactEmail", "employees", "employeeBand", "revenue", "website", "leadSource", "memo", "ceoBirth", "capital"] as const;
const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || v === 0;

function fillFrom(ex: Partial<Company>, data: Omit<Company, "id" | "code">, similar: boolean): ImportMatch | undefined {
  if (!ex.id) return undefined;
  const fill: Partial<Omit<Company, "id" | "code">> = {};
  const put = fill as Record<string, unknown>;
  for (const k of FILL_KEYS) if (isEmpty(ex[k]) && !isEmpty(data[k])) put[k] = data[k];
  if (isEmpty(ex.contactName) && data.contactName) {
    fill.contactName = data.contactName;
    if (isEmpty(ex.contactTitle) && data.contactTitle) fill.contactTitle = data.contactTitle;
  }
  if (data.docs) {
    const add = (Object.keys(data.docs) as (keyof NonNullable<Company["docs"]>)[]).filter((k) => !ex.docs?.[k] && data.docs?.[k]);
    if (add.length) fill.docs = { ...(ex.docs ?? {}), ...Object.fromEntries(add.map((k) => [k, data.docs![k]])) };
  }
  const renameTo = similar && data.name && normalizeCompanyName(data.name) !== normalizeCompanyName(ex.name ?? "") ? data.name : undefined;
  return { id: ex.id, name: ex.name ?? "", similar, fill, ...(renameTo ? { renameTo } : {}) };
}

/** 한 글자 차이(바뀜·빠짐·더함)인지 — "가나스웨이브" / "가나스에이브" */
function oneEditApart(a: string, b: string) {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

export interface ImportRow {
  /** 파일의 줄 번호(1부터, 엑셀에서 보이는 번호) */
  line: number;
  status: ImportStatus;
  /** 오류·중복 사유 */
  problems: string[];
  /** 등록은 되지만 알아 둘 것 (예: 컨설턴트 이름을 못 찾아 본인에게 배정) */
  notes: string[];
  data: Omit<Company, "id" | "code">;
  files?: string[];
  /** 이미 있는 기업과 겹쳤을 때 — 빈 칸 채우기 후보 */
  match?: ImportMatch;
}

/** 표 밖에서 온 정보 — 서류(PDF·사진)에서 만든 줄이면 어떤 서류를 어떻게 읽었는지, 확인할 점 */
export interface RowExtra {
  problems?: string[];
  notes?: string[];
  data?: Partial<Omit<Company, "id" | "code">>;
  /** 이 줄을 만든 파일 이름들 */
  files?: string[];
}

export interface ImportCtx {
  companies: (Pick<Company, "name" | "bizNo"> & Partial<Company>)[];
  users: Pick<User, "id" | "name" | "role" | "active">[];
  me: string;
  nowIso: string;
  /** 표의 줄 번호(0부터, 머리글 포함) → 그 줄의 덧붙일 정보 */
  extras?: Record<number, RowExtra>;
}

function toDate(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const d = excelSerialToDate(Number(s));
    if (d) return d;
    if (/^\d{8}$/.test(s)) return isRealDate(Number(s.slice(0, 4)), Number(s.slice(4, 6)), Number(s.slice(6, 8))) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : undefined;
    return undefined;
  }
  const m = s.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!isRealDate(y, mo, d)) return undefined;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function toEntity(raw: string): EntityType | undefined | "bad" {
  const s = raw.replace(/\s/g, "");
  if (!s) return undefined;
  if (/법인|주식회사|유한|합자|합명/.test(s)) return "corporation";
  if (/개인/.test(s)) return "sole";
  if (/기타|비영리|조합/.test(s)) return "other";
  return "bad";
}

/** "1,234" "12명" → 1234 / 12. 숫자가 아니면 NaN */
function toCount(raw: string) {
  const s = raw.replace(/[,\s명인]/g, "");
  if (!s) return 0;
  return /^\d+(\.0+)?$/.test(s) ? Math.round(Number(s)) : NaN;
}

/** "제조업 — 운동기구 / 도매 및 소매업 - 전자상거래" 처럼 적힌 칸 → 줄마다 "업태 — 종목" (등록 화면과 같은 모양) */
function extraKinds(raw: string): string | undefined {
  const lines = raw.split(/\r?\n|;/).map((l) => l.trim()).filter(Boolean)
    .map((l) => (/\s—\s/.test(l) ? l : l.replace(/\s*[-–:]\s*/, " — ")).replace(/\s+/g, " ").trim());
  return lines.length ? lines.join("\n") : undefined;
}

/** 표(머리글 줄 포함)를 검사해 등록할 행 목록으로 */
export function buildImportRows(rows: string[][], headerRow: number, mapping: (ImportField | null)[], ctx: ImportCtx): ImportRow[] {
  type Existing = ImportCtx["companies"][number];
  const bizOf = new Map<string, Existing>();
  const nameOf = new Map<string, Existing>();
  for (const c of ctx.companies) {
    const b = (c.bizNo ?? "").replace(/\D/g, "");
    if (b.length === 10 && !bizOf.has(b)) bizOf.set(b, c);
    const nn = normalizeCompanyName(c.name);
    if (!nameOf.has(nn)) nameOf.set(nn, c);
  }
  // 이름이 한 글자 다른 기업 — 사업자번호가 둘 다 있고 다르면 다른 회사로 본다. 너무 짧은 이름(3자 이하)은 보지 않는다
  const nearName = (nn: string, biz: string) => nn.length < 4 ? undefined : ctx.companies.find((c) => {
    if (c.archived) return false;
    const cb = (c.bizNo ?? "").replace(/\D/g, "");
    if (biz.length === 10 && cb.length === 10 && cb !== biz) return false;
    const cn = normalizeCompanyName(c.name);
    return cn.length >= 4 && oneEditApart(cn, nn);
  });
  const seenBiz = new Map<string, number>();
  const seenName = new Map<string, number>();
  const staff = ctx.users.filter((u) => u.role !== "client" && u.active !== false);
  const out: ImportRow[] = [];

  for (let r = headerRow + 1; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const get = (k: ImportField) => {
      const i = mapping.indexOf(k);
      return i < 0 ? "" : String(row[i] ?? "").trim();
    };
    // 빈 줄은 건너뛴다 (엑셀 명단 끝의 빈 줄, 중간 구분 줄)
    if (mapping.every((k, i) => !k || !String(row[i] ?? "").trim())) continue;

    const problems: string[] = [];
    const notes: string[] = [];
    const name = get("name");
    const ceo = get("ceo");
    if (!name) problems.push("기업명이 비어 있습니다");
    if (!ceo) problems.push("대표자가 비어 있습니다");

    const bizDigits = get("bizNo").replace(/\D/g, "");
    if (bizDigits && bizDigits.length !== 10) problems.push(`사업자번호가 ${bizDigits.length}자리입니다 (10자리여야 함)`);
    const corpDigits = get("corpNo").replace(/\D/g, "");
    if (corpDigits && corpDigits.length !== 13) problems.push(`법인등록번호가 ${corpDigits.length}자리입니다 (13자리여야 함)`);
    const email = get("contactEmail");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push("이메일 형식이 아닙니다");
    const employees = toCount(get("employees"));
    if (Number.isNaN(employees)) problems.push(`임직원 수가 숫자가 아닙니다 ("${get("employees")}")`);
    const entity = toEntity(get("entityType"));
    if (entity === "bad") problems.push(`사업자 형태를 알 수 없습니다 ("${get("entityType")}" — 법인·개인·기타 중 하나)`);

    const est = get("establishedAt");
    const establishedAt = toDate(est);
    if (est && !establishedAt) problems.push(`설립일을 날짜로 읽지 못했습니다 ("${est}")`);
    const chk = get("bizRegCheckedAt");
    const chkDate = toDate(chk);
    if (chk && !chkDate) problems.push(`사업자등록증 확인일을 날짜로 읽지 못했습니다 ("${chk}")`);
    else if (chkDate && chkDate > ctx.nowIso.slice(0, 10)) problems.push(`사업자등록증 확인일이 오늘 뒤입니다 ("${chk}")`);
    const fc = get("firstConsultDate");
    const fcDate = toDate(fc);
    if (fc && !fcDate) problems.push(`최초 상담일을 날짜로 읽지 못했습니다 ("${fc}")`);

    const regionRaw = get("region").replace(/특별시|광역시|특별자치시|특별자치도|도$/g, "");
    let region: string | undefined;
    if (regionRaw) {
      region = regionOfAddress(regionRaw) ?? REGIONS.find((x) => x === regionRaw);
      if (!region) notes.push(`지역 "${get("region")}"을 알아보지 못해 주소에서 찾습니다`);
    }
    const address = get("address");
    region = region ?? regionOfAddress(address);

    let consultantId = ctx.me;
    const cname = get("consultant");
    if (cname) {
      const hit = staff.find((u) => u.name.replace(/\s/g, "") === cname.replace(/\s/g, ""));
      if (hit) consultantId = hit.id;
      else notes.push(`컨설턴트 "${cname}"을 찾지 못해 등록하는 사람에게 배정합니다`);
    }

    // 중복: 이미 있는 기업 또는 파일 안의 앞줄. 이름이 한 글자만 다른 기업도 "같은 회사일 수 있음"으로 멈춰 세운다
    let matchCo: Existing | undefined;
    let similar = false;
    if (name && !problems.length) {
      const nn = normalizeCompanyName(name);
      if (bizDigits && bizOf.has(bizDigits)) { problems.push("같은 사업자번호의 기업이 이미 등록되어 있습니다"); matchCo = bizOf.get(bizDigits); }
      else if (nameOf.has(nn)) {
        matchCo = nameOf.get(nn);
        // 이름은 같은데 사업자번호가 둘 다 있고 다르다 — 동명의 다른 회사일 수 있어 사람이 고른다
        const cb = (matchCo?.bizNo ?? "").replace(/\D/g, "");
        if (bizDigits.length === 10 && cb.length === 10 && cb !== bizDigits) { problems.push(`이름이 같은 기업 「${matchCo?.name}」이 이미 등록되어 있지만 사업자번호가 다릅니다 — 같은 회사인지 확인해 주세요`); similar = true; }
        else problems.push("같은 이름의 기업이 이미 등록되어 있습니다");
      }
      else if (bizDigits && seenBiz.has(bizDigits)) problems.push(`${seenBiz.get(bizDigits)}번째 줄과 사업자번호가 같습니다`);
      else if (seenName.has(nn)) problems.push(`${seenName.get(nn)}번째 줄과 기업명이 같습니다`);
      else {
        const near = nearName(nn, bizDigits);
        if (near) { problems.push(`이름이 비슷한 기업 「${near.name}」이 이미 등록되어 있습니다 — 같은 회사인지 확인해 주세요`); matchCo = near; similar = true; }
      }
    }

    const contactName = get("contactName");
    const t = get("contactTitle");
    const bizItemsExtra = extraKinds(get("bizItemsExtra"));
    const data: Omit<Company, "id" | "code"> = {
      name, ceo,
      // 등록 화면과 같다: 업종을 비우면 업태(첫 번째)로 고른다. 맞는 칩이 없으면 비워 둔다
      industry: get("industry") || industryOf(get("bizCategory")) || "",
      bizNo: bizDigits.length === 10 ? formatBizNo(bizDigits) : get("bizNo"),
      // 등록 화면과 같은 기본값: 담당자를 비우면 대표가 담당자
      contactName: contactName || ceo,
      contactTitle: t || (contactName ? "" : "대표이사"),
      contactPhone: get("contactPhone") ? formatPhone(get("contactPhone")) : "",
      contactEmail: email,
      address,
      employees: Number.isNaN(employees) ? 0 : employees,
      revenue: get("revenue"),
      firstConsultDate: fcDate ? new Date(`${fcDate}T09:00:00`).toISOString() : ctx.nowIso,
      consultantId,
      memo: get("memo"),
      entityType: entity === "bad" ? undefined : entity,
      corpNo: corpDigits.length === 13 ? formatCorpNo(corpDigits) : undefined,
      establishedAt,
      bizCategory: get("bizCategory") || undefined,
      bizItem: get("bizItem") || undefined,
      bizItemsExtra,
      region,
      employeeBand: employees > 0 ? bandOfEmployees(employees) : undefined,
      companyPhone: get("companyPhone") ? formatPhone(get("companyPhone")) : undefined,
      website: get("website") || undefined,
      leadSource: get("leadSource") || undefined,
    };
    if (chkDate) {
      // 파일은 없다 — "무엇을 언제 어떻게 확인했는지"만 (등록 화면에서 서류를 읽었을 때와 같은 기록)
      const read: (keyof typeof data)[] = ["name", "bizNo", "corpNo", "ceo", "establishedAt", "address", "bizCategory", "bizItem", "bizItemsExtra"];
      data.docs = { bizReg: { fileName: "사업자등록증", size: 0, readAt: new Date(`${chkDate}T09:00:00`).toISOString(), method: "manual", fields: read.filter((k) => !!data[k]) } };
    }
    const ex = ctx.extras?.[r];
    if (ex) {
      problems.push(...(ex.problems ?? []));
      notes.push(...(ex.notes ?? []));
      if (ex.data) {
        const docs = { ...(data.docs ?? {}), ...(ex.data.docs ?? {}) };
        Object.assign(data, ex.data, { docs: Object.keys(docs).length ? docs : undefined });
      }
    }
    const isDup = problems.some((p) => p.includes("이미 등록") || p.includes("번째 줄과"));
    const status: ImportStatus = problems.length ? (isDup && problems.length === 1 ? "duplicate" : "error") : "ok";
    if (status === "ok" && name) {
      if (bizDigits) seenBiz.set(bizDigits, r + 1);
      seenName.set(normalizeCompanyName(name), r + 1);
    }
    const match = status === "duplicate" && matchCo ? fillFrom(matchCo, data, similar) : undefined;
    out.push({ line: r + 1, status, problems, notes, data, ...(ex?.files ? { files: ex.files } : {}), ...(match ? { match } : {}) });
  }
  return out;
}

/** 양식 파일 — 첫 시트는 머리글만(예시 줄을 넣으면 그대로 등록될 위험이 있어 안내 시트에 따로 둔다) */
export function companyTemplateSheets(): SheetData[] {
  const cols = IMPORT_FIELDS;
  return [
    { name: "기업고객", rows: [cols.map((c) => (c.required ? `${c.label}*` : c.label))] },
    {
      name: "작성 안내",
      header: true,
      rows: [
        ["항목", "필수", "적는 방법"],
        ...cols.map((c) => [c.label, c.required ? "필수" : "", c.hint ?? ""]),
        [],
        ["알아 두실 것"],
        ["· '기업고객' 시트의 머리글 아래부터 한 줄에 한 기업씩 적습니다. 필수는 기업명·대표자 두 가지뿐입니다."],
        ["· 쓰시던 명단 파일을 그대로 올려도 됩니다. 머리글 이름(상호·회사명·사업자등록번호 등)을 알아서 맞추고, 화면에서 고칠 수 있습니다."],
        ["· 이미 등록된 기업(사업자번호 또는 이름이 같음)은 건너뜁니다. 기존 정보를 덮어쓰지 않습니다."],
        ["· 실제 고객 정보를 올리기 전에 고객 동의와 회사 내부 확인을 먼저 받아 주세요."],
        [],
        ["예시 (이 줄은 등록되지 않습니다)"],
        cols.map((c) => c.label),
        ["예시기업(주)", "홍길동", "123-45-67890", "", "법인", "제조업", "제조업", "금속가공", "도매 및 소매업 — 금속제품", "2019-03-05", "서울특별시 중구 예시로 1", "", "02-000-0000", "", "", "010-0000-0000", "example@example.com", "12", "30억", "", "", "", "지인·고객 소개", "", "2026-01-15"],
      ],
    },
  ];
}
