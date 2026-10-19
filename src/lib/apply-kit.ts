import type { CompanyFile, CompanyVault, DocumentFile, DocumentRequest, EntityType } from "./types";
import type { SheetData } from "./xlsx";
import { POLICY_NOTE, policyDocsFor, policyRequestText, type PolicyDoc } from "./policy-docs";
import { addMonthsYmd, daysFromTo, slotsOf, todayYmd } from "./vault";

/**
 * 정책자금 신청 서류 묶음 — 공고가 나오면 이 기업의 서류를 "신청 예정일 기준으로" 점검하고,
 * 모자란 것만 고객에게 요청하고, 준비된 파일은 번호·서류명으로 정리해 한 번에 내려받는다.
 *
 * 자격이 되는지, 승인이 날지는 판단하지 않는다 — 서류가 준비됐는지, 신청일에 유효한지만 본다.
 * 서류 목록은 공통 서류(policy-docs) + 담당자가 공고문을 보고 더한 서류. 지어낸 서류·공고는 없다.
 */

export type KitState = "ready" | "checking" | "expires" | "noFile" | "open" | "justBefore" | "missing";

export const KIT_LABEL: Record<KitState, string> = {
  ready: "파일 있음",
  checking: "고객 제출 · 검토 전",
  expires: "신청일엔 기한 지남",
  noFile: "받음 표시만 · 파일 없음",
  open: "고객에게 요청 중",
  justBefore: "신청 직전 발급",
  missing: "없음",
};

export type KitSource =
  | { kind: "vault"; file: CompanyFile }
  | { kind: "request"; req: DocumentRequest; file: DocumentFile };

export interface KitRow {
  /** 공통 서류 키 또는 x:이름(더한 서류) */
  key: string;
  label: string;
  doc?: PolicyDoc;
  /** 담당자가 공고문을 보고 더한 서류 */
  extra?: boolean;
  /** 형태를 몰라 "법인이면" 내는 서류 */
  unsure?: boolean;
  state: KitState;
  /** 묶음에 넣을 파일 — 가장 최근에 받은 한 번(같은 날 올린 것 / 같은 제출) */
  sources: KitSource[];
  issuedAt?: string;
  expiresOn?: string;
  openReq?: DocumentRequest;
  /** 요청 목록에서 처음에 체크할지 */
  ask: boolean;
  /** 사람 말 한 줄 */
  note: string;
}

const norm = (s: string) => s.replace(/\s+/g, "");
const ymd = (isoStr: string) => isoStr.slice(0, 10);
const plusDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** 신청 예정일 기본값 — 공고 마감일이 앞으로면 그날, 아니면 일주일 뒤 */
export function defaultApplyOn(applyEnd: string | undefined, today = todayYmd()) {
  return applyEnd && applyEnd >= today ? applyEnd : plusDays(today, 7);
}

export function kitRows(input: {
  entity?: EntityType;
  companyId: string;
  vault?: CompanyVault;
  files: CompanyFile[];
  reqs: DocumentRequest[];
  applyOn: string;
  today?: string;
  extras?: string[];
}): KitRow[] {
  const today = input.today ?? todayYmd();
  const slots = slotsOf(input.vault);
  const base = policyDocsFor(input.entity).map((x) => ({ key: x.doc.key, label: x.doc.label, doc: x.doc as PolicyDoc | undefined, unsure: x.unsure, extra: false }));
  const seen = new Set(base.map((b) => norm(b.label)));
  const extras = (input.extras ?? []).map((l) => l.trim()).filter((l) => l && !seen.has(norm(l)) && (seen.add(norm(l)), true))
    .map((label) => ({ key: `x:${label}`, label, doc: undefined as PolicyDoc | undefined, unsure: false, extra: true }));

  return [...base, ...extras].map((it) => {
    const slot = slots.find((m) => norm(m.label) === norm(it.label));
    const slotState = slot ? input.vault?.slots?.[slot.key] : undefined;
    const validMonths = it.doc?.validMonths ?? slot?.validMonths;

    // 서류함 파일 — 가장 최근에 올린 날의 파일들(재무제표 3개 연도처럼 한 번에 여러 개)
    const vf = slot ? input.files.filter((f) => f.companyId === input.companyId && f.slot === slot.key).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)) : [];
    const vBatch = vf.length ? vf.filter((f) => ymd(f.uploadedAt) === ymd(vf[0].uploadedAt)) : [];

    // 고객이 낸 파일 — 같은 이름으로 요청한 것 중 가장 최근에 받은 제출 한 번
    const same = input.reqs.filter((r) => r.companyId === input.companyId && r.status !== "planned" && norm(r.name) === norm(it.label)).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    const withFiles = same.find((r) => (r.status === "submitted" || r.status === "reviewing" || r.status === "done") && r.files.length > 0);
    const lastUp = withFiles?.files[withFiles.files.length - 1]?.uploadedAt;
    const rBatch = withFiles && lastUp ? withFiles.files.filter((f) => f.uploadedAt === lastUp) : [];
    const openReq = same.find((r) => r.status === "requested" || r.status === "revision");

    // 더 최근 것을 쓴다(같으면 서류함)
    const useReq = rBatch.length > 0 && (!vBatch.length || (lastUp ?? "") > vBatch[0].uploadedAt);
    const sources: KitSource[] = useReq ? rBatch.map((file) => ({ kind: "request" as const, req: withFiles!, file })) : vBatch.map((file) => ({ kind: "vault" as const, file }));

    // 발급일: 서류함 칸에 적힌 값(검토 때 넣은 값 포함) → 서류함 파일에서 읽은 값
    const issuedAt = slotState?.issuedAt || (!useReq ? vBatch.find((f) => f.issuedAt)?.issuedAt : undefined);
    let expiresOn = validMonths && issuedAt ? addMonthsYmd(issuedAt, validMonths) : undefined;
    // 발급일을 모르면 제출일을 상한으로 — 발급은 제출보다 앞이므로 그보다 늦게 만료되지 않는다
    const knownLate = !expiresOn && validMonths && useReq && lastUp ? addMonthsYmd(ymd(lastUp), validMonths) : undefined;
    if (knownLate && knownLate < input.applyOn) expiresOn = knownLate;

    let state: KitState;
    if (sources.length) {
      if (expiresOn && expiresOn < input.applyOn) state = "expires";
      else if (useReq && withFiles!.status !== "done") state = "checking";
      else state = "ready";
    } else if (openReq) state = "open";
    else if (slotState?.received) state = "noFile";
    else if (it.doc?.justBefore) state = "justBefore";
    else state = "missing";

    // 신청 직전 서류(유효 30일)는 신청일이 25일 안쪽이면 지금 요청해도 신청일까지 유효하다
    const near = daysFromTo(today, input.applyOn) <= 25;
    const ask = state === "missing" || state === "expires" || state === "noFile" || (state === "justBefore" && near);

    const dueTxt = openReq ? ymd(openReq.dueDate) : "";
    const note =
      state === "ready" ? [issuedAt ? `발급 ${issuedAt}` : validMonths ? "발급일 모름 — 유효기간 확인" : "유효기간 없음", expiresOn ? `${expiresOn}까지` : "", `파일 ${sources.length}개`].filter(Boolean).join(" · ")
      : state === "checking" ? `고객이 ${ymd(lastUp ?? "")}에 제출 · 검토 전 · 파일 ${sources.length}개`
      : state === "expires" ? `${expiresOn}에 기한 지남 — 신청일(${input.applyOn})엔 다시 발급`
      : state === "noFile" ? "받음 표시만 있고 파일이 없습니다"
      : state === "open" ? `고객에게 요청 중 · 기한 ${dueTxt}${dueTxt > input.applyOn ? " — 신청일보다 늦음" : ""}`
      : state === "justBefore" ? `신청일 직전에 발급${it.doc?.validText ? ` (${it.doc.validText})` : ""}${near ? "" : " — 지금 떼면 신청일엔 기한이 지납니다"}`
      : it.doc?.where ?? "공고문 기준으로 더한 서류";

    return { key: it.key, label: it.label, doc: it.doc, extra: it.extra, unsure: it.unsure, state, sources, issuedAt, expiresOn, openReq, ask, note };
  });
}

export function kitSummary(rows: KitRow[]) {
  const withFile = rows.filter((r) => r.state === "ready" || r.state === "checking");
  return {
    total: rows.length,
    ready: withFile.length,
    files: withFile.reduce((n, r) => n + r.sources.length, 0),
    reissue: rows.filter((r) => r.state === "expires").length,
    missing: rows.filter((r) => r.state === "missing" || r.state === "noFile").length,
    open: rows.filter((r) => r.state === "open").length,
    justBefore: rows.filter((r) => r.state === "justBefore").length,
  };
}

/** 요청 기한 — 신청일 며칠 전, 단 내일보다 이르지 않게. 신청 직전 서류는 신청일 이틀 전 */
export function kitDueDay(row: Pick<KitRow, "state">, applyOn: string, today = todayYmd()) {
  const want = plusDays(applyOn, row.state === "justBefore" ? -2 : -5);
  const min = plusDays(today, 1);
  return want < min ? min : want;
}

/** 고객에게 보낼 요청 — 공통 서류는 '정책자금 준비 서류' 문구 그대로(고객 화면 준비 서류 카드에 모인다) */
export function kitRequestItems(rows: KitRow[], applyOn: string, programTitle: string | undefined, today = todayYmd()) {
  return rows.map((r) => ({
    label: r.label,
    description: r.doc ? policyRequestText(r.doc) : `신청 서류 — ${programTitle || "지원사업 신청"}. 공고문 기준으로 필요한 서류입니다.`,
    validMonths: r.doc?.validMonths,
    dueDay: kitDueDay(r, applyOn, today),
  }));
}

/* ---------------- 파일 이름 · 목록표 ---------------- */

const unsafe = /[\\/:*?"<>|\u0000-\u001f]/g;
export function safeName(s: string, max = 40) {
  return s.replace(unsafe, "").replace(/\s+/g, "").slice(0, max) || "서류";
}

/** 묶음 안 파일 이름 — 순번_서류명(_n).확장자. 순번은 목록표와 같다 */
export function kitFileName(no: number, label: string, original: string, k: number, count: number) {
  const dot = original.lastIndexOf(".");
  const ext = dot > 0 ? original.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) : "";
  return `${String(no).padStart(2, "0")}_${safeName(label)}${count > 1 ? `_${k + 1}` : ""}${ext ? `.${ext}` : ""}`;
}

export function kitZipName(companyName: string, programTitle: string | undefined, when = new Date()) {
  const d = `${when.getFullYear()}${String(when.getMonth() + 1).padStart(2, "0")}${String(when.getDate()).padStart(2, "0")}`;
  return `${safeName(companyName, 30)}_${safeName(programTitle || "신청서류", 30)}_${d}.zip`;
}

/** 묶음에 넣는 줄 — 파일이 있고 신청일에 쓸 수 있는 것(기한 지난 것은 목록표에만) */
export const kitIncluded = (r: KitRow) => r.state === "ready" || r.state === "checking";

/** 00_서류목록.xlsx — 서류 목록(순번은 묶음 파일 이름과 같다) + 안내 */
export function kitSheets(rows: KitRow[], meta: { companyName: string; programTitle?: string; applyOn: string; madeBy?: string; when?: Date; missingFiles?: Set<string> }): SheetData[] {
  const when = meta.when ?? new Date();
  const list: SheetData = {
    name: "서류 목록",
    widths: [6, 28, 18, 12, 12, 34, 46],
    rows: [
      ["순번", "서류", "상태", "발급일", "유효기한", "묶음 안 파일", "비고 · 발급처"],
      ...rows.map((r, i) => {
        const inZip = kitIncluded(r) ? r.sources.map((s, k) => {
          const name = s.file.fileName;
          return meta.missingFiles?.has(`${r.key}#${k}`) ? `(원본 없음) ${name}` : kitFileName(i + 1, r.label, name, k, r.sources.length);
        }).join(", ") : "";
        return [i + 1, r.label + (r.extra ? " (공고문)" : r.unsure ? " (법인이면)" : ""), KIT_LABEL[r.state], r.issuedAt ?? "", r.expiresOn ?? "", inZip, r.state === "missing" || r.state === "justBefore" ? r.doc?.where ?? r.note : r.note];
      }),
    ],
  };
  const info: SheetData = {
    name: "안내",
    widths: [16, 70],
    rows: [
      ["항목", "내용"],
      ["기업", meta.companyName],
      ["공고", meta.programTitle || "(공고 미지정)"],
      ["신청 예정일", meta.applyOn],
      ["만든 때", `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")} ${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}${meta.madeBy ? ` · ${meta.madeBy}` : ""}`],
      ["확인할 점", POLICY_NOTE],
      ["판단 범위", "서류가 준비됐는지와 신청일에 유효한지만 봅니다. 자격·승인 가능성은 판단하지 않습니다."],
    ],
  };
  return [list, info];
}
