/**
 * 기업성장 관리 — 고객 Portal 의 "우리 회사 성장과제" 판.
 *
 * 새 데이터를 만들지 않는다. 이미 있는 기업정보·프로젝트·매출기회(제안·요청)·자료요청·견적·결과·일정을
 * "성장과제"라는 한 줄의 흐름으로 다시 읽을 뿐이다.
 *   완료한 과제   ← 끝난 프로젝트
 *   진행 중 과제  ← 진행 중 프로젝트
 *   검토 중 과제  ← 고객이 요청했거나 담당자가 제안한 매출기회
 *   다음 검토 과제 ← 아래 규칙(기업정보·진행이력·상담 때 고른 관심 분야)로 고른 것 — 근거를 한 줄로 함께 보인다
 *
 * 규칙은 "검토해 볼 만한 항목"까지만 말한다. 될지 안 될지, 얼마가 나오는지 판단하지 않는다.
 * 정책자금 같은 자금 판단은 하지 않는다(KPJK 컨설팅 분야만 다룬다).
 */
import type { Company, DocumentRequest, Opportunity, Project, Quote, ResultFile, Schedule } from "./types";
import { KPJK_SERVICES, OPP_STATUS, type ServiceDef } from "./services";
import { CUSTOMER_STEPS, stageProgress, stageToCustomerStep } from "./stages";
import { yearsSince } from "./company-options";

export interface GrowthCtx {
  company: Company;
  projects: Project[];
  opportunities: Opportunity[];
  docRequests: DocumentRequest[];
  quotes: Quote[];
  results: ResultFile[];
  schedules: Schedule[];
  now: Date;
}

export type GrowthState = "done" | "active" | "review" | "proposed" | "suggested";

export interface GrowthItem {
  area: string;                // KPJK 컨설팅 분야 이름 (가지급금 …)
  state: GrowthState;
  service?: ServiceDef;
  /** 왜 이 과제인가 — 고객에게 그대로 보인다 */
  reason?: string;
  /** 근거 꼬리표 (기업정보 · 진행이력 · 상담 관심 분야 · 담당자 제안) */
  basis?: string;
  project?: Project;
  opportunity?: Opportunity;
  progress?: number;
  stepLabel?: string;
  /** 고객 화면용 상태 문구 */
  statusLabel?: string;
  doneAt?: string;
  resultCount?: number;
}

export interface NowAction {
  key: string;
  kind: "doc" | "quote" | "proposal" | "schedule" | "result";
  title: string;
  sub?: string;
  href: string;
  urgent?: boolean;
}

/** 상담 때 고른 관심 분야(키) → KPJK 컨설팅 분야 */
const INTEREST_TO_AREA: Record<string, string> = {
  credit_rating: "기업신용평가등급", rnd_lab: "기업부설연구소", patent_capital: "특허자본", provisional: "가지급금",
  suspense: "가수금", retained: "이익잉여금", treasury: "자사주매입", nominee: "주식명의신탁", succession: "가업승계",
  conversion: "법인전환", tax_audit: "세무조사", hr: "인사노무",
};

/** 이어서 검토하는 과제 — 앞의 것을 끝냈거나 진행 중일 때 */
const FOLLOW_UP: Record<string, { next: string; why: string }[]> = {
  가지급금: [{ next: "이익잉여금", why: "가지급금 정리와 이어서 잉여금 활용 방향을 함께 보면 순서가 정리됩니다." }],
  가수금: [{ next: "재무세무", why: "가수금 처리 뒤 재무제표 전반을 함께 점검해 볼 수 있습니다." }],
  이익잉여금: [{ next: "이익소각", why: "잉여금 활용 방법 중 하나로 이익소각 요건을 이어서 검토할 수 있습니다." }, { next: "자사주매입", why: "잉여금 활용 방법 중 하나로 자기주식 취득을 이어서 검토할 수 있습니다." }],
  주식명의신탁: [{ next: "가업승계", why: "주식 명의를 정리한 뒤 지분 승계 순서를 이어서 보는 것이 자연스럽습니다." }],
  가업승계: [{ next: "상속증여", why: "승계 방향이 정해지면 상속·증여 준비 항목을 함께 정리합니다." }],
  기업부설연구소: [{ next: "특허자본", why: "연구소 설립 이후 보유 특허의 활용 방법을 이어서 검토할 수 있습니다." }],
  법인전환: [{ next: "재무세무", why: "법인 전환 직후 재무·세무 기본 사항을 점검해 두면 좋습니다." }],
};

const svcOf = (area: string) => KPJK_SERVICES.find((s) => s.name === area);
const areaOfProject = (p: Project) => (KPJK_SERVICES.some((s) => s.name === p.type) ? p.type : undefined);

export function growthBoard(ctx: GrowthCtx) {
  const { company: c, now } = ctx;
  const nowIso = now.toISOString();
  const projects = ctx.projects.filter((p) => p.companyId === c.id && p.clientVisible && !p.archived);
  const opps = ctx.opportunities.filter((o) => o.companyId === c.id && o.status !== "dropped" && (o.source === "proposal" || o.source === "portal_interest" || o.source === "portal_request"));
  const taken = new Set<string>();

  // 완료 · 진행 중 — 프로젝트 기준. 분야가 KPJK 목록에 없는 옛 프로젝트도 이름 그대로 보인다
  const completed: GrowthItem[] = [];
  const active: GrowthItem[] = [];
  for (const p of projects) {
    const area = areaOfProject(p) ?? p.type ?? p.name;
    const done = p.stage === "done" || p.stage === "aftercare";
    const step = stageToCustomerStep(p.stage);
    const item: GrowthItem = {
      area, state: done ? "done" : "active", service: svcOf(area), project: p, progress: stageProgress(p.stage),
      stepLabel: CUSTOMER_STEPS[step].label, statusLabel: done ? "완료" : `${CUSTOMER_STEPS[step].label} · ${stageProgress(p.stage)}%`,
      doneAt: done ? p.stageChangedAt : undefined,
      resultCount: ctx.results.filter((r) => r.projectId === p.id).length,
    };
    (done ? completed : active).push(item);
    taken.add(area);
  }
  completed.sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));

  // 검토 중(고객이 요청함) · 담당자 제안 — 매출기회 기준. 같은 분야는 하나로 합친다(요청이 제안보다 앞)
  const review: GrowthItem[] = [];
  const proposed: GrowthItem[] = [];
  const byArea = new Map<string, Opportunity[]>();
  for (const o of opps) (byArea.get(o.serviceName) ?? byArea.set(o.serviceName, []).get(o.serviceName)!).push(o);
  for (const [area, list] of byArea) {
    if (taken.has(area)) continue;
    const asked = list.find((o) => o.source !== "proposal");
    const prop = list.find((o) => o.source === "proposal");
    if (asked) {
      review.push({ area, state: "review", service: svcOf(area), opportunity: asked, reason: prop?.reason, basis: prop ? "담당자 제안" : "직접 요청", statusLabel: OPP_STATUS[asked.status].clientLabel });
    } else if (prop) {
      proposed.push({ area, state: "proposed", service: svcOf(area), opportunity: prop, reason: prop.reason, basis: "담당자 제안", statusLabel: "담당자 제안" });
    }
    taken.add(area);
  }

  // 다음 검토 과제 — 규칙. 근거가 분명한 것만, 최대 3개
  const suggested: GrowthItem[] = [];
  const add = (area: string, reason: string, basis: string) => {
    if (taken.has(area) || suggested.some((x) => x.area === area) || !svcOf(area)) return;
    suggested.push({ area, state: "suggested", service: svcOf(area), reason, basis, statusLabel: "검토해 볼 과제" });
  };
  // 1) 진행·완료한 과제에 이어지는 것
  for (const it of [...completed, ...active]) for (const f of FOLLOW_UP[it.area] ?? []) add(f.next, f.why, `진행이력: ${it.area}${it.state === "done" ? " 완료" : " 진행 중"}`);
  // 2) 상담 때 관심 분야로 고른 것
  for (const k of c.interests ?? []) { const a = INTEREST_TO_AREA[k]; if (a) add(a, "상담 때 관심 분야로 말씀하신 항목입니다.", "상담 관심 분야"); }
  // 3) 기업정보
  const age = yearsSince(c.establishedAt, now);
  if (c.entityType === "sole") add("법인전환", "개인사업자로 등록되어 있어 법인 전환 방법과 시점을 검토해 볼 수 있습니다.", "기업정보: 개인사업자");
  if (c.entityType === "corporation" && age !== undefined && age >= 10) add("가업승계", `설립 ${age}년 차 법인입니다. 지분과 승계 순서를 미리 정리해 둘 수 있습니다.`, `기업정보: 업력 ${age}년`);
  const emp = c.employees || 0;
  const bandMin = c.employeeBand ? Number(c.employeeBand.split(/[-+]/)[0]) : 0;
  if (emp >= 5 || bandMin >= 5) add("인사노무", `임직원 ${emp ? `${emp}명` : `${c.employeeBand?.replace("-", "~")}명`} 규모로 근로계약·취업규칙 점검 대상입니다.`, "기업정보: 임직원 규모");
  if (/제조|정보|소프트웨어|연구|IT|바이오|화학|전자/.test(`${c.industry} ${c.bizCategory ?? ""}`)) add("기업부설연구소", "업종 특성상 연구개발 전담 조직 요건을 검토해 볼 수 있습니다.", `기업정보: ${c.industry || c.bizCategory}`);
  if (c.entityType === "corporation" && age !== undefined && age >= 3) add("가지급금", "설립 3년 이상 법인은 대표이사 가지급금 잔액을 한 번 점검해 두면 좋습니다.", `기업정보: 업력 ${age}년`);

  // 지금 해야 할 일 — 고객이 눌러야 다음이 진행되는 것
  const now7 = new Date(now.getTime() + 7 * 864e5).toISOString();
  const actions: NowAction[] = [];
  const docs = ctx.docRequests.filter((d) => d.companyId === c.id && (d.status === "requested" || d.status === "revision")).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  for (const d of docs.slice(0, 3)) actions.push({ key: `doc_${d.id}`, kind: "doc", title: d.status === "revision" ? `${d.name} 보완해서 다시 올리기` : `${d.name} 올리기`, sub: d.dueDate < nowIso ? "기한 지남" : `기한 ${d.dueDate.slice(5, 10).replace("-", "/")}`, href: "/portal/documents", urgent: d.status === "revision" || d.dueDate < nowIso });
  if (docs.length > 3) actions.push({ key: "doc_more", kind: "doc", title: `그 밖의 요청자료 ${docs.length - 3}건`, href: "/portal/documents" });
  for (const q of ctx.quotes.filter((x) => x.companyId === c.id && x.status === "sent")) actions.push({ key: `q_${q.id}`, kind: "quote", title: `${q.title} — 회신하기`, sub: "이대로 진행 / 조금 더 생각", href: "/portal/services" });
  for (const p of proposed.slice(0, 2)) actions.push({ key: `pr_${p.area}`, kind: "proposal", title: `담당자 제안: ${p.area} — 검토하기`, sub: p.reason?.slice(0, 40), href: "/portal/services" });
  const nextMeet = ctx.schedules.filter((s) => s.companyId === c.id && s.visibleToClient && s.start >= nowIso && s.start <= now7).sort((a, b) => a.start.localeCompare(b.start))[0];
  if (nextMeet) actions.push({ key: `s_${nextMeet.id}`, kind: "schedule", title: `${nextMeet.title} 예정`, sub: new Date(nextMeet.start).toLocaleString("ko-KR", { month: "numeric", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" }), href: "/portal/schedule" });

  return { completed, active, review, proposed, suggested: suggested.slice(0, 3), actions };
}
