import type { CompanyFile, CompanyVault, DocStatus, DocumentRequest, EntityType } from "./types";
import { addMonthsYmd, slotsOf, slotStatus, todayYmd } from "./vault";

/**
 * 정책자금 준비 서류 — 공고가 나오면 바로 신청할 수 있게 고객이 미리 모아 두는 서류.
 *
 * 신청서마다 거의 늘 들어가는 공통 서류만 둔다. 자격이 되는지, 어느 자금이 맞는지는 판단하지 않는다 —
 * 그것은 공고문을 보고 담당 컨설턴트가 정한다. 여기서 다루는 것은 "어떤 서류가 준비됐고, 언제 다시 떼야 하는지"뿐이다.
 *
 * 이름(label)은 서류함 칸 이름과 같다 — 고객이 올린 서류를 검토 완료하면 같은 이름의 서류함 칸이 "받음"이 된다.
 */
export interface PolicyDoc {
  key: string;
  label: string;
  /** 어디서 어떻게 발급받는지 — 고객 화면에 그대로 보인다 */
  where: string;
  /** 왜 필요한지 한 줄 */
  why: string;
  /** 유효기간(개월, 발급일 기준). 법·서류에 적힌 것만 둔다 — 모르면 비운다 */
  validMonths?: number;
  /** 유효기간을 사람 말로 */
  validText?: string;
  /** 법인만 내는 서류 */
  corpOnly?: boolean;
  /** 유효기간이 짧아 신청 직전에 떼는 서류 — 미리 받아 두면 기한이 지난다(요청 창에서 기본으로 꺼 둔다) */
  justBefore?: boolean;
}

export const POLICY_DOCS: PolicyDoc[] = [
  { key: "bizReg", label: "사업자등록증", where: "홈택스(hometax.go.kr) › 민원증명 › 사업자등록증 재발급, 또는 가까운 세무서", why: "모든 신청서에 들어가는 기본 서류" },
  { key: "corpReg", label: "법인등기부등본", where: "인터넷등기소(iros.go.kr) › 법인 › 열람·발급 (말소사항 포함)", why: "법인 정보·임원 확인", validMonths: 3, validText: "보통 3개월 이내 발급본을 요구합니다", corpOnly: true },
  { key: "smeCert", label: "중소기업 확인서", where: "중소기업현황정보시스템(sminfo.mss.go.kr) › 확인서 발급", why: "중소기업 대상 사업의 기본 확인", validMonths: 12, validText: "확인서에 적힌 유효기간까지(보통 1년)" },
  { key: "finStmt", label: "표준재무제표증명 (최근 3년)", where: "홈택스 › 민원증명 › 표준재무제표증명 — 최근 3개 연도 (파일 여러 개도 됩니다)", why: "매출·이익 규모 확인 — 대부분의 자금 신청에 들어갑니다" },
  { key: "vatBase", label: "부가가치세 과세표준증명", where: "홈택스 › 민원증명 › 부가가치세 과세표준증명 (최근 1~2년)", why: "최근 매출 확인" },
  { key: "insList", label: "4대보험 사업장 가입자 명부", where: "4대사회보험 정보연계센터(4insure.or.kr) › 민원 › 사업장 가입자 명부", why: "고용 인원 확인 — 고용지원금 검토에도 씁니다", validMonths: 1, validText: "보통 최근 1개월 이내 발급본을 요구합니다" },
  { key: "shareholders", label: "주주명부", where: "회사에서 작성·보관하는 주주명부 (대표이사 날인, 최근 기준일)", why: "지분 구조 확인", corpOnly: true },
  { key: "articles", label: "정관", where: "회사 보관본 사본 (최신 개정본)", why: "사업 목적·임원 규정 확인", corpOnly: true },
  { key: "taxCert", label: "납세증명서", where: "홈택스 › 민원증명 › 납세증명서(국세)", why: "국세 체납이 없다는 확인", validMonths: 1, validText: "발급일부터 30일", justBefore: true },
  { key: "localTaxCert", label: "지방세 납세증명서", where: "정부24(gov.kr) 또는 위택스(wetax.go.kr)", why: "지방세 체납이 없다는 확인", validMonths: 1, validText: "발급일부터 30일", justBefore: true },
];

export const POLICY_NOTE = "기관·사업마다 요구하는 서류가 조금씩 다릅니다. 신청할 때 공고문 기준으로 담당 컨설턴트가 다시 확인합니다.";

const norm = (s: string) => s.replace(/\s+/g, "");
export function policyDocOf(name: string): PolicyDoc | undefined {
  const n = norm(name);
  return POLICY_DOCS.find((d) => norm(d.label) === n);
}

/** 묶음 요청의 문구 머리 — 이것으로 "정책자금 준비로 요청한 서류"를 가린다. 같은 이름(정관 등)을 다른 일로 요청한 것과 섞지 않는다 */
export const POLICY_PREFIX = "정책자금 준비 서류 — ";

/** 고객 요청 문구 — 요청자료 목록에 보인다 */
export function policyRequestText(d: PolicyDoc) {
  return `${POLICY_PREFIX}${d.why}. 발급: ${d.where}${d.validText ? ` (${d.validText})` : ""}`;
}

/** 정책자금 준비 묶음으로 요청한 서류인가 */
export function isPolicyRequest(r: Pick<DocumentRequest, "name" | "description">) {
  return (r.description ?? "").startsWith(POLICY_PREFIX) && !!policyDocOf(r.name);
}

/** 이 기업이 낼 서류 — 개인사업자에게 법인 서류는 빼고, 형태를 모르면 법인 서류는 기본으로 꺼 둔다 */
export function policyDocsFor(entity: EntityType | undefined) {
  return POLICY_DOCS.filter((d) => !(d.corpOnly && entity === "sole")).map((d) => ({ doc: d, unsure: !!d.corpOnly && entity !== "corporation" }));
}

const OPEN: DocStatus[] = ["requested", "revision", "submitted", "reviewing"];
const latestBy = (reqs: DocumentRequest[], label: string) =>
  reqs.filter((r) => r.status !== "planned" && norm(r.name) === norm(label)).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];

/** 제출한 날로부터 유효기간이 이미 지났다 — 발급일은 제출일보다 앞이므로 서류는 그보다 더 오래됐다 */
function staleSince(submittedIso: string | undefined, months: number | undefined, today: string) {
  if (!submittedIso || !months) return false;
  const until = addMonthsYmd(submittedIso.slice(0, 10), months);
  return !!until && until < today;
}

/* ---------------- 담당자: 요청 창 ---------------- */

export type PlanState = "usable" | "expiring" | "expired" | "missing" | "open";
export interface PlanRow {
  doc: PolicyDoc;
  state: PlanState;
  /** 법인 서류인데 사업자 형태를 모름 */
  unsure: boolean;
  /** 열려 있는 요청 상태 */
  openStatus?: DocStatus;
  issuedAt?: string;
  daysLeft: number | null;
  /** 요청 창에서 처음에 체크할지 */
  defaultOn: boolean;
  /** 기업정보에서 서류를 읽어 확인한 날 — 파일은 서류함에 없을 수 있다(신청에는 사본 파일이 든다) */
  seenAt?: string;
}

export function policyPlan(input: { entity?: EntityType; companyId: string; vault?: CompanyVault; files: CompanyFile[]; reqs: DocumentRequest[]; seen?: Partial<Record<"bizReg" | "corpReg", string>> }, today = todayYmd()): PlanRow[] {
  const slots = slotsOf(input.vault);
  const reqs = input.reqs.filter((r) => r.companyId === input.companyId);
  const files = input.files.filter((f) => f.companyId === input.companyId);
  return policyDocsFor(input.entity).map(({ doc, unsure }) => {
    const slot = slots.find((s) => norm(s.label) === norm(doc.label));
    const st = slot ? slotStatus(slot, input.vault, files, today) : undefined;
    const last = latestBy(reqs, doc.label);
    let state: PlanState;
    if (last && OPEN.includes(last.status)) state = "open";
    else if (st?.received) state = st.expired ? "expired" : st.expiringSoon ? "expiring" : "usable";
    else if (last?.status === "done") state = staleSince(last.submittedAt, doc.validMonths, today) ? "expired" : "usable";
    else state = "missing";
    const defaultOn = (state === "missing" || state === "expired" || state === "expiring") && !doc.justBefore && !unsure;
    const seenAt = doc.key === "bizReg" || doc.key === "corpReg" ? input.seen?.[doc.key] : undefined;
    return { doc, state, unsure, openStatus: state === "open" ? last?.status : undefined, issuedAt: st?.state.issuedAt, daysLeft: st?.daysLeft ?? null, defaultOn, ...(seenAt ? { seenAt } : {}) };
  });
}

/* ---------------- 고객 화면: 준비도 ---------------- */

export type ReadyState = "ready" | "stale" | "checking" | "todo" | "revision";
export const READY_LABEL: Record<ReadyState, string> = { ready: "준비됨", stale: "다시 발급 필요", checking: "확인 중", todo: "올려 주세요", revision: "보완 필요" };
export interface ReadyRow { doc: PolicyDoc; req: DocumentRequest; state: ReadyState }

/** 요청받은 정책자금 준비 서류의 상태 — 할 일(보완·올리기·다시 발급)이 먼저 */
export function policyReadiness(reqs: DocumentRequest[], companyId: string, today = todayYmd()) {
  const mine = reqs.filter((r) => r.companyId === companyId && isPolicyRequest(r));
  const rows: ReadyRow[] = [];
  for (const doc of POLICY_DOCS) {
    const req = latestBy(mine, doc.label);
    if (!req) continue;
    const state: ReadyState = req.status === "done" ? (staleSince(req.submittedAt, doc.validMonths, today) ? "stale" : "ready")
      : req.status === "revision" ? "revision" : req.status === "requested" ? "todo" : "checking";
    rows.push({ doc, req, state });
  }
  const rank: Record<ReadyState, number> = { revision: 0, todo: 1, stale: 2, checking: 3, ready: 4 };
  rows.sort((a, b) => rank[a.state] - rank[b.state] || POLICY_DOCS.indexOf(a.doc) - POLICY_DOCS.indexOf(b.doc));
  return { rows, ready: rows.filter((r) => r.state === "ready").length, checking: rows.filter((r) => r.state === "checking").length, total: rows.length };
}
