import type { Company, DocumentRequest, FinancialYear, Opportunity, Schedule } from "./types";
import { formatYmd, profileRows, todayLocal, yearsInBusiness, type ProfileRow } from "./company-profile";

/**
 * 고객 화면 "우리 회사 한눈에" — 대표가 들어오자마자 회사 현황을 숫자로 보고, 다음에 할 일을 하나씩 점검해 나가게.
 *
 * 원칙
 * - 모든 숫자는 기록에서 센다. 재무는 담당자가 재무제표를 보고 넣은 값만 쓴다. 없으면 "없음"으로 보이고 지어내지 않는다.
 * - 체크리스트는 정해진 규칙으로 기록을 보고 고른다(자동 안내). 자금 가능 여부·금액 같은 판단은 하지 않는다.
 * - 메모·대표자 생년월일·주주 구성처럼 내부에서만 쓰는 칸은 고객 화면에 내지 않는다.
 */

/* ---------------- 재무 ---------------- */

/** 연도 오름차순, 숫자가 하나라도 있는 해만 */
export function finSeries(c: Company): FinancialYear[] {
  return (c.financials ?? [])
    .filter((f) => Number.isInteger(f.year) && f.year > 1900 && f.year < 2200 && [f.revenue, f.operatingProfit, f.netIncome].some((v) => typeof v === "number" && Number.isFinite(v)))
    .sort((a, b) => a.year - b.year);
}

export interface RevenueTrend {
  latest?: FinancialYear;
  prev?: FinancialYear;
  /** 전년 대비 % (소수 첫째 자리). 바로 앞 해 매출이 있을 때만 */
  yoyPct?: number;
  direction: "up" | "down" | "flat" | "unknown";
  /** 매출이 있는 해 수 */
  years: number;
}

export function revenueTrend(c: Company): RevenueTrend {
  const withRev = finSeries(c).filter((f) => typeof f.revenue === "number" && f.revenue > 0);
  const latest = withRev[withRev.length - 1];
  const prev = withRev[withRev.length - 2];
  if (!latest || !prev || prev.year !== latest.year - 1) return { latest, prev, direction: "unknown", years: withRev.length };
  const yoyPct = Math.round(((latest.revenue! - prev.revenue!) / prev.revenue!) * 1000) / 10;
  return { latest, prev, yoyPct, direction: yoyPct > 0 ? "up" : yoyPct < 0 ? "down" : "flat", years: withRev.length };
}

/** 전년 대비 % — 연도별 막대 사이에 쓴다 (앞 해가 바로 전 해일 때만) */
export function yoyOf(series: FinancialYear[], i: number, key: "revenue" | "operatingProfit" | "netIncome" = "revenue"): number | undefined {
  const cur = series[i]?.[key];
  const prev = series[i - 1];
  const pv = prev?.[key];
  if (typeof cur !== "number" || typeof pv !== "number" || pv <= 0 || prev.year !== series[i].year - 1) return undefined;
  return Math.round(((cur - pv) / pv) * 1000) / 10;
}

/** 원 → "420억 원" · "8,500만 원" · "3억 2,000만 원" */
export function fmtMoneyKo(n: number | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const neg = n < 0;
  const a = Math.abs(n);
  const eok = Math.floor(a / 1e8);
  const man = Math.round((a % 1e8) / 1e4);
  let s: string;
  if (eok >= 100) s = `${Math.round(a / 1e8).toLocaleString("ko-KR")}억 원`;
  else if (eok > 0) s = man ? `${eok}억 ${man.toLocaleString("ko-KR")}만 원` : `${eok}억 원`;
  else if (man > 0) s = `${man.toLocaleString("ko-KR")}만 원`;
  else s = `${a.toLocaleString("ko-KR")}원`;
  return neg ? `-${s}` : s;
}

export const fmtPct = (p: number | undefined) => (p === undefined ? "" : `${p > 0 ? "+" : ""}${p.toFixed(1)}%`);

/* ---------------- 날짜 ---------------- */

/** 시작일을 1일차로 센다. 미래 날짜·잘못된 값이면 undefined */
export function dayNumber(startYmd: string | undefined, today = todayLocal()): number | undefined {
  if (!startYmd) return undefined;
  const a = Date.parse(`${formatYmd(startYmd)}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return undefined;
  return Math.floor((b - a) / 864e5) + 1;
}

export function businessAge(c: Company, today = todayLocal()) {
  return c.establishedAt ? yearsInBusiness(c.establishedAt, today) : null;
}

/* ---------------- 고객에게 보여도 되는 기본 정보 ---------------- */

/** 근거 서류를 확인한 날 — 내부는 docs, 고객 계정은 서버가 확인일만 준다(docChecks) */
export function docCheckedAt(c: Company, kind: "bizReg" | "corpReg"): string | undefined {
  return c.docs?.[kind]?.readAt ?? c.docChecks?.[kind] ?? undefined;
}

/** 고객 화면에 내는 칸 — 메모·대표자 생년월일·성별·주주 구성·인증서·직접 만든 칸은 빼고 */
const CLIENT_KEYS = ["name", "entityType", "establishedAt", "bizNo", "corpNo", "bizCategory", "bizItem", "bizItemsExtra", "industry", "address", "capital", "employees", "contact", "contactPhone", "companyPhone", "contactEmail", "website"];

export function clientFacts(c: Company, today = todayLocal()): ProfileRow[] {
  const rows = profileRows(c, undefined, today).filter((r) => CLIENT_KEYS.includes(r.key));
  // 대표자는 이름만 (내부 카드는 생년월일·성별까지 붙인다)
  const ceo: ProfileRow = { key: "ceo", group: "people", label: "대표자", value: c.ceo ?? "", copyable: true, edit: "none" };
  const i = rows.findIndex((r) => r.group === "people");
  rows.splice(i < 0 ? rows.length : i, 0, ceo);
  return rows.map((r) => ({ ...r, edit: "none" as const }));
}

/* ---------------- 성장 체크리스트 ---------------- */

export interface Quest {
  key: string;
  title: string;
  /** 왜 하는지 한 줄 */
  why: string;
  done: boolean;
  /** 앞 항목을 마쳐야 열린다 */
  locked?: boolean;
  /** "3/5" · "+12.3%" 처럼 지금 숫자 */
  progress?: string;
  href: string;
  cta: string;
}

export interface QuestInput {
  company: Company;
  docRequests: DocumentRequest[];
  schedules: Schedule[];
  opportunities: Opportunity[];
  /** 진행 중·완료 과제 (고객에게 보이는 프로젝트 기준) */
  activeCount: number;
  completedCount: number;
  /** 대표 진행 과제의 진행률 */
  mainProgress?: number;
  /** 지금 검토해 볼 지원사업 공고 수 */
  programCount: number;
  now?: Date;
}

export function companyQuests(x: QuestInput): Quest[] {
  const c = x.company;
  const nowIso = (x.now ?? new Date()).toISOString();
  const corp = c.entityType === "corporation";
  const basics: [string, unknown][] = [
    ["사업자등록번호", c.bizNo], ["설립일", c.establishedAt], ["업종", c.industry || c.bizCategory],
    ["소재지", c.address || c.region], ["임직원 수", c.employees || c.employeeBand], ...(corp ? [["법인등록번호", c.corpNo] as [string, unknown]] : []),
  ];
  const basicsDone = basics.filter(([, v]) => !!v).length;
  const missing = basics.filter(([, v]) => !v).map(([k]) => k);
  const docsNeed = corp ? ["bizReg", "corpReg"] as const : ["bizReg"] as const;
  const docsDone = docsNeed.filter((k) => !!docCheckedAt(c, k)).length;
  const trend = revenueTrend(c);
  const reqs = x.docRequests.filter((d) => d.companyId === c.id && d.status !== "planned");
  const open = reqs.filter((d) => d.status === "requested" || d.status === "revision");
  const upcoming = x.schedules.some((s) => s.companyId === c.id && s.visibleToClient && s.start >= nowIso);
  const askedProgram = x.opportunities.some((o) => o.companyId === c.id && o.serviceKey === "support_program");

  const q: Quest[] = [
    {
      key: "basics", title: "회사 기본 정보 갖추기", done: basicsDone === basics.length, progress: `${basicsDone}/${basics.length}`,
      why: missing.length ? `비어 있는 칸: ${missing.join(" · ")} — 신청서마다 쓰는 값입니다` : "신청서·공고 확인에 매번 쓰는 값이 다 있습니다",
      href: "/portal/inquiries", cta: "담당자에게 알려 주기",
    },
    {
      key: "docs", title: corp ? "사업자등록증 · 법인등기부등본 확인받기" : "사업자등록증 확인받기", done: docsDone === docsNeed.length, progress: `${docsDone}/${docsNeed.length}`,
      why: "회사 기본 정보가 서류와 같은지 담당자가 확인합니다",
      href: "/portal/documents", cta: "자료 제출 화면",
    },
    {
      key: "financials", title: "최근 3개년 매출 기록하기", done: trend.years >= 3, progress: `${Math.min(trend.years, 3)}/3`,
      why: "재무제표를 보내 주시면 담당자가 연도별 매출을 기록합니다 — 2개년부터 전년 대비 성장률이 보입니다",
      href: "/portal/documents", cta: "재무제표 보내기",
    },
    {
      key: "growth", title: "전년보다 매출 키우기", done: trend.direction === "up", locked: trend.direction === "unknown",
      progress: trend.yoyPct !== undefined ? `${fmtPct(trend.yoyPct)} (${trend.latest!.year}년)` : undefined,
      why: trend.direction === "unknown" ? "2개년 매출이 기록되면 열립니다"
        : trend.direction === "up" ? `${trend.prev!.year}년 ${fmtMoneyKo(trend.prev!.revenue)} → ${trend.latest!.year}년 ${fmtMoneyKo(trend.latest!.revenue)}`
        : `${trend.latest!.year}년 매출이 전년보다 줄었습니다 — 원인과 다음 해 계획을 담당자와 함께 봅니다`,
      href: "/portal/services", cta: trend.direction === "up" ? "다음 성장 과제 보기" : "성장 과제 상담하기",
    },
    {
      key: "requests", title: "요청 자료 모두 제출하기", done: open.length === 0,
      progress: reqs.length ? `${reqs.length - open.length}/${reqs.length}` : "요청 없음",
      why: open.length ? `아직 ${open.length}건이 남았습니다 — 자료가 모여야 다음 단계로 갑니다` : "지금 요청된 자료를 다 보내셨습니다",
      href: "/portal/documents", cta: "자료 올리기",
    },
    {
      key: "project", title: x.activeCount + x.completedCount ? "성장 과제 하나 끝까지 완료하기" : "첫 성장 과제 시작하기", done: x.completedCount > 0,
      progress: x.completedCount ? `완료 ${x.completedCount}건` : x.mainProgress !== undefined ? `진행률 ${x.mainProgress}%` : undefined,
      why: x.completedCount ? "완료한 과제는 완료자료에서 다시 볼 수 있습니다" : x.activeCount ? "진행 중인 과제가 끝까지 가면 완료 이력에 남습니다" : "담당자와 함께 첫 과제를 정합니다",
      href: x.activeCount + x.completedCount ? "/portal/projects" : "/portal/services", cta: x.activeCount + x.completedCount ? "진행 현황 보기" : "함께 검토하기",
    },
    {
      key: "meeting", title: "다음 상담 일정 잡기", done: upcoming,
      why: upcoming ? "다음 일정이 잡혀 있습니다" : "정기적으로 만나야 성장 과제가 멈추지 않습니다",
      href: upcoming ? "/portal/schedule" : "/portal/inquiries", cta: upcoming ? "일정 보기" : "일정 요청하기",
    },
    {
      key: "programs", title: "맞는 지원사업 공고 살펴보기", done: askedProgram,
      progress: x.programCount ? `검토해 볼 공고 ${x.programCount}건` : undefined,
      why: askedProgram ? "담당자에게 공고를 문의하셨습니다" : "회사 조건과 맞춰 본 공고입니다 — 자격 판정이 아니라 검토해 볼 목록입니다",
      href: "/portal/programs", cta: "공고 보기",
    },
  ];
  return q;
}

export function questLevel(qs: Quest[]) {
  const done = qs.filter((q) => q.done).length;
  const total = qs.length;
  const level = Math.min(5, 1 + Math.floor((done * 5) / (total + 1)));
  const NAMES = ["", "시작", "기초 다지기", "성장 준비", "성장 가속", "성장 궤도"];
  return { done, total, level, name: NAMES[level], pct: total ? Math.round((done / total) * 100) : 0, next: qs.find((q) => !q.done && !q.locked) };
}

/* ---------------- 담당자 입력: 금액 읽기 ---------------- */

/**
 * "420억" · "12억 3,000만" · "8500만원" · "1,234,567,890" · "-3억" 을 원 단위로 읽는다.
 * 단위 없는 숫자는 원으로 본다. 못 읽으면 undefined — 값을 짐작해서 채우지 않는다.
 */
export function parseMoneyKo(input: string): number | undefined {
  const s = input.replace(/\s|원/g, "").replace(/,/g, "");
  if (!s) return undefined;
  const neg = /^[-−△]/.test(s);
  const t = s.replace(/^[-−△+]/, "");
  // "2천" · "5백" · "3000" · "2천5백" → 숫자 (단위 없는 작은 수)
  const small = (x: string): number | undefined => {
    if (!x) return 0;
    const m = /^(?:(\d+(?:\.\d+)?)천)?(?:(\d+(?:\.\d+)?)백)?(\d+(?:\.\d+)?)?$/.exec(x);
    if (!m || !m.slice(1).some(Boolean)) return undefined;
    return (m[1] ? Number(m[1]) * 1000 : 0) + (m[2] ? Number(m[2]) * 100 : 0) + (m[3] ? Number(m[3]) : 0);
  };
  let v: number | undefined;
  const i = t.indexOf("억");
  if (i >= 0) {
    const eok = /^\d+(\.\d+)?$/.test(t.slice(0, i)) ? Number(t.slice(0, i)) : undefined;
    // 억 뒤는 만 단위로 읽는다 — "3억 2천만" · "3억 2천" · "3억 2000만"
    const rest = small(t.slice(i + 1).replace(/만$/, ""));
    v = eok === undefined || rest === undefined ? undefined : eok * 1e8 + rest * 1e4;
  } else if (t.endsWith("만")) {
    const man = small(t.slice(0, -1));
    v = man === undefined ? undefined : man * 1e4;
  } else {
    v = /^\d+(\.\d+)?$/.test(t) ? Number(t) : undefined;
  }
  if (v === undefined || !Number.isFinite(v)) return undefined;
  v = Math.round(v);
  return neg ? -v : v;
}
