/**
 * 스스로 준비하기 — 고객이 직접 하는 일의 상태 · 체크리스트 · 다음 행동 · 담당자 후속.
 *
 *   기업정보 · 공고 매칭 · 성장과제(기존 규칙) → 고객이 "직접 해 볼게요" → 실행 기록(SelfRun) 한 건
 *   → 상태가 바뀔 때마다 활동 기록 → 다음 행동 안내 · 성장과제 판 갱신 · (신청 · 선정 · 완료면) 담당자 알림 · 업무
 *
 * 규칙 기반이다(학습형 AI 아님). 자격 · 선정 가능성 · 요건 충족을 판단하지 않는다 — 공고문 · 기관 안내 · 법령이 기준이다.
 * 상태는 고객이 직접 고른 값이다. 접수확인서 같은 근거를 담당자가 확인하면 그 근거에만 "담당자 확인"이 붙는다.
 * 같은 기업 · 같은 종류 · 같은 대상은 한 건뿐이다(id 를 정해진 규칙으로 만들고, 서버에도 고유 색인).
 */
import type { GrowthRunStatus, ProgramRunStatus, SelfRun, SelfRunKind, SelfRunStatus, SupportProgram } from "./types";
import { LINK_BY_KEY, type OfficialLink } from "./official-links";

/* ---------------- 상태 ---------------- */

export const PROGRAM_STATUSES: { key: ProgramRunStatus; label: string; hint: string }[] = [
  { key: "preparing", label: "준비 중", hint: "공고문을 보고 서류 · 신청서를 준비하고 있어요" },
  { key: "applied", label: "신청 완료", hint: "공식 사이트에서 신청을 마쳤어요" },
  { key: "waiting", label: "결과 대기", hint: "심사 · 결과 발표를 기다리고 있어요" },
  { key: "selected", label: "선정", hint: "선정 · 승인 통보를 받았어요" },
  { key: "not_selected", label: "미선정", hint: "이번에는 선정되지 않았어요" },
  { key: "stopped", label: "중단", hint: "이번 공고는 신청하지 않기로 했어요" },
];

export const GROWTH_STATUSES: { key: GrowthRunStatus; label: string; hint: string }[] = [
  { key: "exploring", label: "알아보는 중", hint: "자료와 공식 안내를 보며 알아보고 있어요" },
  { key: "reviewed", label: "검토 완료", hint: "우리 회사에 필요한지 검토를 마쳤어요" },
  { key: "preparing", label: "준비 중", hint: "필요한 서류 · 조건을 준비하고 있어요" },
  { key: "applied", label: "직접 신청", hint: "담당 기관에 직접 신청 · 신고했어요" },
  { key: "done", label: "완료", hint: "설치 · 등록 · 정리를 마쳤어요" },
  { key: "skipped", label: "진행 안 함", hint: "지금은 진행하지 않기로 했어요" },
];

export const STATUS_LABEL: Record<SelfRunStatus, string> = {
  ...Object.fromEntries(GROWTH_STATUSES.map((s) => [s.key, s.label])),
  ...Object.fromEntries(PROGRAM_STATUSES.map((s) => [s.key, s.label])),
  learned: "학습 완료",
} as Record<SelfRunStatus, string>;

/** 지원사업 "준비 중"과 성장과제 "준비 중"은 이름이 같다 — 종류와 함께 읽는다 */
export const statusLabel = (kind: SelfRunKind, s: SelfRunStatus) => (kind === "growth" && s === "applied" ? "직접 신청" : STATUS_LABEL[s]);

export const statusesOf = (kind: SelfRunKind): SelfRunStatus[] =>
  kind === "program" ? PROGRAM_STATUSES.map((s) => s.key) : kind === "growth" ? GROWTH_STATUSES.map((s) => s.key) : ["learned"];

/** 진행 중(다음 행동이 있는 것) */
export const isOpen = (r: Pick<SelfRun, "status">) => ["preparing", "applied", "waiting", "exploring"].includes(r.status);
/** 끝난 것 — 결과가 났거나 그만둔 것 */
export const isClosed = (r: Pick<SelfRun, "status">) => !isOpen(r);
/** 신청까지 간 지원사업 */
export const APPLIED_OR_LATER: SelfRunStatus[] = ["applied", "waiting", "selected", "not_selected"];

/** 상태를 이 종류에서 고를 수 있는가 — 고객이 잘못 고른 것을 되돌릴 수 있게 앞뒤 이동은 막지 않는다 */
export const canSet = (kind: SelfRunKind, to: SelfRunStatus) => statusesOf(kind).includes(to);

/* ---------------- 체크리스트 ---------------- */

export interface CheckItem { key: string; label: string; hint?: string }

/**
 * 지원사업 준비 체크리스트 — 어느 공고에나 맞는 일반 항목만.
 * "필요 서류"를 단정하지 않는다: 서류는 공고문 목록이 기준이라는 항목 하나로 둔다.
 */
export const PROGRAM_CHECKS: CheckItem[] = [
  { key: "notice", label: "공식 공고문 확인", hint: "공고문 원문(PDF · HWP)을 내려받아 읽었어요" },
  { key: "eligibility", label: "신청대상 · 제외요건 확인", hint: "대상 조건과 신청 제한(체납 · 연체 · 중복 지원 등)을 공고문에서 봤어요" },
  { key: "period", label: "신청기간 확인", hint: "마감 날짜와 시각을 적어 두었어요" },
  { key: "docs", label: "공고문에 적힌 기업서류 준비", hint: "공고문 제출서류 목록 기준으로 발급했어요(발급일 기준 확인)" },
  { key: "plan", label: "사업계획서 · 신청서 준비 (해당 시)", hint: "양식이 있는 공고만 — 평가 항목을 먼저 봤어요" },
  { key: "site", label: "온라인 신청 사이트 확인", hint: "어디서 신청하는지, 회원가입이 필요한지 확인했어요" },
];

export interface SelfGuide {
  area: string;
  intro: string;
  checks: CheckItem[];
  links: OfficialLink[];
  /** 완료 상태를 이 분야에서 부르는 말 (예: 신고 완료) */
  doneLabel?: string;
  /** 세무 · 법률 판단이 필요한 경우가 많은 분야 — 숨기지 않고 알린다(직접 경로는 그대로 열려 있다) */
  expertAdvised?: string;
}

const L = (...keys: string[]) => keys.map((k) => LINK_BY_KEY[k]).filter(Boolean);

/** 공식 안내가 분명한 분야만 따로 둔다. 나머지는 공통 순서(GENERIC) */
export const SELF_GUIDES: Record<string, Omit<SelfGuide, "area">> = {
  기업부설연구소: {
    intro: "기업부설연구소 · 연구개발전담부서는 한국산업기술진흥협회에 신고합니다. 연구 인력 · 독립된 연구 공간 같은 요건은 협회 안내와 관련 법령이 기준이며, 이 화면은 우리 회사가 요건을 충족하는지 판단하지 않습니다.",
    checks: [
      { key: "req", label: "협회 안내에서 설립 요건 읽기" },
      { key: "staff", label: "연구 인력 현황 정리 (학위 · 경력)" },
      { key: "space", label: "연구 공간 확인 (독립 공간 · 도면 · 사진)" },
      { key: "topic", label: "연구개발 과제 내용 한 장 정리" },
      { key: "how", label: "온라인 신고 방법 확인" },
    ],
    links: L("rnd"),
    doneLabel: "신고 완료",
  },
  인사노무: {
    intro: "근로계약서 · 취업규칙 · 임금명세서 같은 기본 항목은 고용노동부 안내와 표준 양식으로 먼저 점검할 수 있습니다. 상시 근로자 수에 따라 의무가 달라지므로 고용노동부 안내를 기준으로 확인합니다.",
    checks: [
      { key: "contract", label: "근로계약서 작성 · 보관 상태 확인" },
      { key: "rules", label: "취업규칙 작성 · 신고 대상인지 확인 (고용노동부 안내)" },
      { key: "payslip", label: "임금명세서 교부 확인" },
      { key: "insure", label: "4대보험 가입 현황 확인" },
    ],
    links: L("moel", "work24"),
  },
  법인전환: {
    intro: "개인사업자에서 법인으로 바꾸는 방법(새로 설립 · 현물출자 · 사업 양도양수 등)에 따라 세금과 절차가 달라집니다. 직접 알아볼 때는 아래 순서로 우리 회사 상황을 먼저 정리합니다.",
    checks: [
      { key: "why", label: "전환 이유 · 시점 정리" },
      { key: "numbers", label: "최근 매출 · 자산 · 부채 현황 정리" },
      { key: "method", label: "전환 방법별 차이 알아보기" },
      { key: "registry", label: "법인 설립 등기 절차 확인 (인터넷등기소)" },
    ],
    links: L("iros", "hometax"),
    expertAdvised: "전환 방법에 따라 세금이 크게 달라질 수 있어 세무 전문가 검토를 함께 권합니다.",
  },
};

const GENERIC: CheckItem[] = [
  { key: "learn", label: "관련 학습 자료 보기" },
  { key: "status", label: "우리 회사 현황 정리 (관련 서류 · 숫자)" },
  { key: "questions", label: "궁금한 점 적어 두기" },
  { key: "decide", label: "직접 진행할지, 전문가 도움을 받을지 정하기" },
];

/** 세무 · 법률 판단이 큰 분야 — 직접 알아볼 수는 있지만 결정 전에 전문가 검토를 권한다고 그대로 적는다 */
const EXPERT_HEAVY = ["가지급금", "가수금", "이익잉여금", "이익소각", "자사주매입", "주식명의신탁", "가업승계", "상속증여", "세무조사", "특허자본"];

export function guideOf(area: string): SelfGuide {
  const g = SELF_GUIDES[area];
  if (g) return { area, ...g };
  return {
    area,
    intro: `${area}은(는) 우리 회사 상황에 따라 방법이 달라집니다. 관련 학습 자료와 공식 안내로 먼저 알아보고, 진행 여부를 정해 기록해 두세요.`,
    checks: GENERIC,
    links: [],
    expertAdvised: EXPERT_HEAVY.includes(area) ? "세무 · 법률 판단이 필요한 경우가 많아, 결정 전에 전문가 검토를 권합니다." : undefined,
  };
}

export const checksOf = (r: Pick<SelfRun, "kind" | "targetKey">): CheckItem[] =>
  r.kind === "program" ? PROGRAM_CHECKS : r.kind === "growth" ? guideOf(r.targetKey).checks : [];

export function checkProgress(r: Pick<SelfRun, "kind" | "targetKey" | "checks">) {
  const items = checksOf(r);
  const done = items.filter((i) => r.checks[i.key]).length;
  return { done, total: items.length };
}

/* ---------------- 한 건만 ---------------- */

/** 같은 기업 · 종류 · 대상이면 언제나 같은 id — 두 기기에서 동시에 눌러도 서버에는 한 줄만 생긴다 */
export function selfRunId(companyId: string, kind: SelfRunKind, targetKey: string): string {
  let h = 5381;
  for (const ch of `${companyId}|${kind}|${targetKey}`) h = ((h * 33) ^ ch.codePointAt(0)!) >>> 0;
  return `sr_${kind[0]}_${companyId}_${h.toString(36)}`;
}

export const findRun = (runs: SelfRun[], companyId: string, kind: SelfRunKind, targetKey: string) =>
  runs.find((r) => r.companyId === companyId && r.kind === kind && r.targetKey === targetKey);

/* ---------------- 입력 · 확인 구분 ---------------- */

/** 이 결과가 무엇에 근거하는가 — 고객 입력 / 고객이 근거를 올림(확인 전) / 담당자 확인 */
export function resultBasis(r: Pick<SelfRun, "evidence">): { key: "self" | "attached" | "confirmed"; label: string } {
  if (r.evidence.some((e) => e.confirmedAt)) return { key: "confirmed", label: "담당자 확인" };
  if (r.evidence.length) return { key: "attached", label: "고객 근거 첨부 · 확인 전" };
  return { key: "self", label: "고객 직접 입력" };
}

/* ---------------- 다음 행동 ---------------- */

export const runHref = (r: Pick<SelfRun, "kind" | "targetKey">) =>
  r.kind === "program" ? `/portal/self/program/${encodeURIComponent(r.targetKey)}`
  : r.kind === "growth" ? `/portal/self/growth/${encodeURIComponent(r.targetKey)}`
  : `/portal/self/learn/${encodeURIComponent(r.targetKey)}`;

export interface SelfNext { title: string; sub?: string; href: string; urgent?: boolean }

/** 마감까지 남은 날 — 달력 날짜 차이(오늘 마감 0, 지남 음수) */
const dLeft = (end: string | undefined, now: Date) => {
  if (!end) return undefined;
  const a = new Date(`${end.slice(0, 10)}T00:00:00`).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 864e5);
};

/** 지금 상태에서 다음에 할 일 한 줄. 끝난 것(선정 후 · 진행 안 함 등)은 필요할 때만 */
export function nextStep(r: SelfRun, program?: Pick<SupportProgram, "applyEnd">, now = new Date()): SelfNext | undefined {
  const href = runHref(r);
  const { done, total } = checkProgress(r);
  if (r.kind === "program") {
    const d = dLeft(program?.applyEnd, now);
    const due = d === undefined ? undefined : d < 0 ? "접수 마감 지남" : d === 0 ? "오늘 마감" : `마감 D-${d}`;
    switch (r.status) {
      case "preparing":
        return done < total
          ? { title: `${r.targetTitle} — 준비 ${done}/${total}`, sub: due ?? "남은 준비 항목 확인", href, urgent: d !== undefined && d >= 0 && d <= 7 }
          : { title: `${r.targetTitle} — 공식 사이트에서 신청하기`, sub: due ?? "준비 항목을 모두 확인했어요", href, urgent: d !== undefined && d >= 0 && d <= 7 };
      case "applied":
      case "waiting":
        return { title: `${r.targetTitle} — 결과가 나오면 기록하기`, sub: r.evidence.length ? "결과 발표 기다리는 중" : "접수번호 · 접수확인서를 남겨 두면 좋아요", href };
      case "selected":
        return { title: `${r.targetTitle} — 선정 후 절차 확인`, sub: "협약 · 서류 등 후속 절차는 공고문 · 기관 안내가 기준", href };
      case "not_selected":
        return { title: "다른 공고 찾아보기", sub: `${r.targetTitle} 미선정 기록됨`, href: "/portal/programs" };
      default:
        return undefined;
    }
  }
  if (r.kind === "growth") {
    switch (r.status) {
      case "exploring":
      case "preparing":
        return { title: `${r.targetKey} 직접 ${r.status === "exploring" ? "알아보기" : "준비"} — ${done}/${total}`, sub: "다음 항목 확인 · 진행 상태 기록", href };
      case "applied":
        return { title: `${r.targetKey} — 결과가 나오면 완료로 기록`, sub: "직접 신청 · 신고함", href };
      default:
        return undefined;
    }
  }
  return undefined;
}

/* ---------------- 담당자 후속 (데모 화면과 서버 트리거가 같은 규칙) ---------------- */

export interface SelfFollowUp {
  notify: { title: string; body: string };
  /** 담당자 업무 — 같은 근거로 두 번 만들지 않게 ruleKey 를 둔다 */
  task?: { title: string; ruleKey: string; dueDays: number };
}

/**
 * 고객이 상태를 바꿨을 때 담당자에게 무엇이 가는가.
 * 신청 · 결과 · 완료처럼 담당자가 알아야 하는 것만 — 체크 하나하나는 보내지 않는다.
 * 같은 내용이 setup.sql 의 kpjk_after_self_run 트리거에 있다(서버 모드에서는 고객이 업무를 직접 만들 수 없다).
 */
export function followUpOf(r: Pick<SelfRun, "id" | "kind" | "targetKey" | "targetTitle">, to: SelfRunStatus, companyName: string): SelfFollowUp | undefined {
  const t = r.kind === "program" ? `'${r.targetTitle}'` : r.targetKey;
  if (r.kind === "program") {
    if (to === "applied") return { notify: { title: "고객이 지원사업을 직접 신청했습니다", body: `${companyName} — ${t} 신청 완료(고객 입력)` } };
    if (to === "selected") return {
      notify: { title: "고객이 지원사업 선정을 기록했습니다", body: `${companyName} — ${t} 선정(고객 입력). 근거 자료를 확인해 주세요.` },
      task: { title: `${companyName} ${t} 선정 — 근거 확인 · 후속 절차 안내`, ruleKey: `self_run:${r.id}:selected`, dueDays: 2 },
    };
    if (to === "not_selected") return { notify: { title: "고객이 지원사업 미선정을 기록했습니다", body: `${companyName} — ${t} 미선정(고객 입력)` } };
    return undefined;
  }
  if (r.kind === "growth") {
    if (to === "applied") return { notify: { title: "고객이 성장과제를 직접 신청했습니다", body: `${companyName} — ${t} 직접 신청(고객 입력)` } };
    if (to === "done") return {
      notify: { title: "고객이 성장과제를 직접 완료했습니다", body: `${companyName} — ${t} 완료(고객 입력). 기업정보 반영이 필요한지 확인해 주세요.` },
      task: { title: `${companyName} ${t} 직접 완료 — 확인 · 기업정보 반영`, ruleKey: `self_run:${r.id}:done`, dueDays: 3 },
    };
  }
  return undefined;
}

/* ---------------- 측정 (실제 기록만 센다) ---------------- */

export interface SelfMetricsSplit {
  learned: number;
  programStarted: number;
  programApplied: number;
  growthDone: number;
  growthReviewed: number;
  helpRequested: number;
  /** 준비 시작 → 신청 완료까지 걸린 날(중앙값). 표본이 없으면 undefined */
  daysToApply?: number;
  applySamples: number;
}

type ActLike = { type: string; at: string; companyId?: string; meta?: Record<string, string | number> };

/**
 * 시연 · 내부 시험용 기업인가 — 데모 샘플 기업, 또는 운영 서버에서 이름을 "[가상]" · "(가상)" 으로 시작하게 만든 촬영용 기업.
 * 측정에서 실제 고객 실적과 섞지 않으려고 쓴다(이 표시로 지우거나 숨기는 동작은 없다).
 */
export const isTestCompany = (c: { name: string; sample?: boolean }) => !!c.sample || /^\s*[[(]\s*가상\s*[\])]/.test(c.name);

/**
 * 성과 측정 — 고객 기록에서 바로 센다. 시연용(샘플) 기업과 실제 기업을 나눠 센다.
 * "기존 방식 대비 시간 변화"는 도입 전 기준선이 없으면 계산하지 않는다(여기서 만들지 않는다).
 */
export function selfMetrics(runs: SelfRun[], activities: ActLike[], isSample: (companyId: string) => boolean) {
  const split = (sample: boolean): SelfMetricsSplit => {
    const rs = runs.filter((r) => isSample(r.companyId) === sample);
    const ids = new Set(rs.map((r) => r.id));
    const firstApplied = new Map<string, string>();
    for (const a of activities) {
      if (a.type !== "self_status" || !a.meta?.runId || !ids.has(String(a.meta.runId))) continue;
      if (!APPLIED_OR_LATER.includes(String(a.meta.to) as SelfRunStatus)) continue;
      const id = String(a.meta.runId);
      if (!firstApplied.has(id) || a.at < firstApplied.get(id)!) firstApplied.set(id, a.at);
    }
    const prog = rs.filter((r) => r.kind === "program");
    const applied = prog.filter((r) => firstApplied.has(r.id) || APPLIED_OR_LATER.includes(r.status));
    const days = prog.filter((r) => firstApplied.has(r.id)).map((r) => (new Date(firstApplied.get(r.id)!).getTime() - new Date(r.startedAt).getTime()) / 864e5).sort((a, b) => a - b);
    const mid = days.length ? (days.length % 2 ? days[(days.length - 1) / 2] : (days[days.length / 2 - 1] + days[days.length / 2]) / 2) : undefined;
    return {
      learned: rs.filter((r) => r.kind === "learn").length,
      programStarted: prog.length,
      programApplied: applied.length,
      growthDone: rs.filter((r) => r.kind === "growth" && r.status === "done").length,
      growthReviewed: rs.filter((r) => r.kind === "growth" && r.status === "reviewed").length,
      helpRequested: rs.filter((r) => r.helpRef).length,
      daysToApply: mid === undefined ? undefined : Math.round(mid * 10) / 10,
      applySamples: days.length,
    };
  };
  return { real: split(false), sample: split(true) };
}
