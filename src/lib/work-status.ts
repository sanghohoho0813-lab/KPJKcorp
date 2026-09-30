import type { Company, CompanyFile, CompanyVault, InternalStage, Payment, Project, WorkStatus } from "./types";
import { daysFromTo, dueText, slotStatus, slotsOf, todayYmd } from "./vault";

/**
 * 진행 업무 상태 · 기업별 "지금 챙길 것".
 *
 * 프로젝트 단계(상담→계약→자료요청→…)는 "어디까지 왔나"이고, 진행 상태는 "지금 공이 누구에게 있나"다.
 * 특히 "고객 회신 대기"를 따로 두면, 우리 쪽은 할 일이 없는데 멈춰 있는 건과 우리가 늦고 있는 건이 갈린다.
 */

export const WORK_STATUS_ORDER: WorkStatus[] = ["not_started", "in_progress", "waiting_client", "done", "on_hold", "not_applicable"];

export const WORK_STATUS: Record<WorkStatus, { label: string; short: string; hint: string; cls: string }> = {
  not_started: { label: "시작 전", short: "시작 전", hint: "아직 손대지 않았습니다", cls: "border-line bg-surface-2 text-ink-3" },
  in_progress: { label: "진행 중", short: "진행 중", hint: "지금 하고 있습니다", cls: "border-info/30 bg-info-bg text-info" },
  waiting_client: { label: "고객 회신 대기", short: "고객 대기", hint: "고객 회신을 기다립니다", cls: "border-warning/30 bg-warning-bg text-warning" },
  done: { label: "완료", short: "완료", hint: "끝났습니다", cls: "border-success/30 bg-success-bg text-success" },
  on_hold: { label: "보류", short: "보류", hint: "지금은 멈춰 둡니다 (나중에 다시)", cls: "border-line-2 bg-surface-2 text-ink-2" },
  not_applicable: { label: "해당 없음", short: "해당 없음", hint: "이 기업에는 해당하지 않습니다 (진행률에서 뺍니다)", cls: "border-line bg-surface text-ink-3 line-through" },
};
export const OVERDUE_CLS = "border-error/30 bg-error-bg text-error";

/** 따로 정하지 않았으면 단계에서 짐작한다 */
export function workStatusOf(p: Pick<Project, "workStatus" | "stage">): WorkStatus {
  if (p.workStatus) return p.workStatus;
  const s: InternalStage = p.stage;
  if (s === "done" || s === "aftercare") return "done";
  if (s === "inquiry" || s === "consult") return "not_started";
  if (s === "doc_request") return "waiting_client";
  return "in_progress";
}

export const isOpen = (w: WorkStatus) => w !== "done" && w !== "on_hold" && w !== "not_applicable";

export const DUE_SOON_DAYS = 7;
export const WAITING_TOO_LONG_DAYS = 7;

export interface WorkCell {
  project: Project;
  status: WorkStatus;
  daysLeft: number | null;
  overdue: boolean;
  dueSoon: boolean;
  waitingDays: number | null;
}

export function workCell(p: Project, today: string): WorkCell {
  const status = workStatusOf(p);
  const open = isOpen(status);
  const due = p.dueDate ? p.dueDate.slice(0, 10) : "";
  const daysLeft = due ? daysFromTo(today, due) : null;
  const waitingDays = status === "waiting_client" && p.waitingSince ? daysFromTo(p.waitingSince.slice(0, 10), today) : null;
  return { project: p, status, daysLeft, overdue: open && daysLeft !== null && daysLeft < 0, dueSoon: open && daysLeft !== null && daysLeft >= 0 && daysLeft <= DUE_SOON_DAYS, waitingDays };
}

/* ---------------- 수금 ---------------- */

export const PAYMENT_KIND_LABEL: Record<Payment["kind"], string> = { deposit: "계약금", interim: "중도금", success: "성공보수" };

export function netOf(p: Payment) {
  return (p.amount ?? 0) - (p.agentFee ?? 0);
}

export function paymentTotals(list: Payment[], today: string) {
  let billed = 0, received = 0, unpaid = 0, agent = 0, overdue = 0, unknown = 0;
  for (const p of list) {
    if (p.amount === undefined || p.amount === null) { unknown += 1; continue; }
    billed += p.amount;
    agent += p.agentFee ?? 0;
    if (p.receivedAt) received += netOf(p);
    else {
      unpaid += netOf(p);
      if (p.dueDate && daysFromTo(today, p.dueDate) < 0) overdue += 1;
    }
  }
  const net = billed - agent;
  return { billed, received, unpaid, agent, net, overdue, unknown, marginPct: billed > 0 ? Math.round((net / billed) * 1000) / 10 : null };
}

export function won(n: number | undefined | null) {
  if (n === undefined || n === null) return "미정";
  return `${n.toLocaleString("ko-KR")}원`;
}

/* ---------------- 기업별 챙길 것 ---------------- */

export type Severity = "critical" | "warning" | "info";
export const SEVERITY_LABEL: Record<Severity, string> = { critical: "지금 처리", warning: "곧 처리", info: "참고" };

export interface OpsAlert {
  id: string;
  companyId: string;
  severity: Severity;
  title: string;
  detail?: string;
  daysLeft: number | null;
  /** 누르면 갈 곳 — 기업 상세의 탭 */
  tab: "work" | "vault" | "money";
}

export interface CompanyOpsCtx {
  company: Company;
  projects: Project[];
  vault?: CompanyVault;
  files: CompanyFile[];
  payments: Payment[];
  today?: string;
}

export function companyAlerts(ctx: CompanyOpsCtx): OpsAlert[] {
  const today = ctx.today ?? todayYmd();
  const out: OpsAlert[] = [];
  const cid = ctx.company.id;
  for (const p of ctx.projects.filter((x) => !x.archived)) {
    const c = workCell(p, today);
    if (!isOpen(c.status)) continue;
    if (c.overdue) out.push({ id: `od:${p.id}`, companyId: cid, severity: "critical", title: `${p.name} 마감이 ${-(c.daysLeft ?? 0)}일 지났습니다`, daysLeft: c.daysLeft, tab: "work" });
    else if (c.dueSoon) out.push({ id: `ds:${p.id}`, companyId: cid, severity: "warning", title: `${p.name} 마감 ${dueText(c.daysLeft)}`, daysLeft: c.daysLeft, tab: "work" });
    if (c.waitingDays !== null && c.waitingDays >= WAITING_TOO_LONG_DAYS) out.push({ id: `wt:${p.id}`, companyId: cid, severity: "warning", title: `${p.name} — 고객 회신을 ${c.waitingDays}일째 기다리는 중입니다`, daysLeft: null, tab: "work" });
    if (c.status === "in_progress" && !p.nextStep?.trim()) out.push({ id: `ns:${p.id}`, companyId: cid, severity: "info", title: `${p.name} — 다음에 할 일이 비어 있습니다`, daysLeft: null, tab: "work" });
  }
  for (const meta of slotsOf(ctx.vault)) {
    const s = slotStatus(meta, ctx.vault, ctx.files, today);
    if (s.expired) out.push({ id: `dx:${meta.key}`, companyId: cid, severity: "warning", title: `${meta.label} 유효기간이 지났습니다`, detail: `${s.expiresOn}까지였습니다 — 새 발급본이 필요합니다`, daysLeft: s.daysLeft, tab: "vault" });
    else if (s.expiringSoon) out.push({ id: `de:${meta.key}`, companyId: cid, severity: "warning", title: `${meta.label} 유효기간 ${dueText(s.daysLeft)}`, detail: `${s.expiresOn}까지`, daysLeft: s.daysLeft, tab: "vault" });
  }
  for (const pay of ctx.payments) {
    if (pay.receivedAt || !pay.dueDate) continue;
    const d = daysFromTo(today, pay.dueDate);
    if (d < 0) out.push({ id: `po:${pay.id}`, companyId: cid, severity: "critical", title: `${pay.label} 입금 예정일이 ${-d}일 지났습니다`, detail: won(pay.amount), daysLeft: d, tab: "money" });
    else if (d <= DUE_SOON_DAYS) out.push({ id: `pd:${pay.id}`, companyId: cid, severity: "info", title: `${pay.label} 입금 예정 ${dueText(d)}`, detail: won(pay.amount), daysLeft: d, tab: "money" });
  }
  const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
}

/** 진행률 = (끝난 업무 + 쓸 수 있는 서류) / (해당 업무 + 기본 서류 칸). 보류·해당 없음은 분모에서 뺀다 */
export function companyProgress(ctx: CompanyOpsCtx) {
  const today = ctx.today ?? todayYmd();
  const works = ctx.projects.filter((p) => !p.archived).map((p) => workStatusOf(p)).filter((w) => w !== "on_hold" && w !== "not_applicable");
  const done = works.filter((w) => w === "done").length;
  const slots = slotsOf(ctx.vault).map((m) => slotStatus(m, ctx.vault, ctx.files, today));
  const usable = slots.filter((s) => s.usable).length;
  const denom = works.length + slots.length;
  return { worksDone: done, worksTotal: works.length, docsUsable: usable, docsTotal: slots.length, percent: denom ? Math.round(((done + usable) / denom) * 100) : 0 };
}
