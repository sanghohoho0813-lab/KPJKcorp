import type { Activity, Approval, Company, DocumentRequest, Inquiry, Project, Schedule, Task } from "./types";
import { daysBetween, fmtDate, fmtRelative, fmtTime } from "./format";

/**
 * 대표자용 요약 — 계약 별지 제1호 모듈5.
 *
 * 브리핑이 "무엇을 먼저 할까"라면 이 요약은 "회사가 지금 어떤 상태인가"다. 대표가 아침에
 * 5줄로 읽고, 필요하면 그대로 복사해 팀 단톡방에 올릴 수 있게 한다.
 *
 * 모든 문장은 시스템 기록을 그대로 센 것이다. 추정·예측·평가("좋아졌다")는 넣지 않는다.
 * 숫자가 0 이면 "없음"이라고 그대로 적는다 — 괜찮다는 신호도 정보다.
 */

export interface SummaryLine {
  key: "project" | "docs" | "inquiry" | "approval" | "schedule" | "week";
  text: string;
  href: string;
  tone: "ok" | "warn" | "bad" | "info";
}

export interface SummaryCtx {
  now: Date;
  companies: Company[];
  projects: Project[];
  docRequests: DocumentRequest[];
  schedules: Schedule[];
  tasks: Task[];
  inquiries: Inquiry[];
  approvals: Approval[];
  activities: Activity[];
  /** 컨설턴트면 자기 담당만 센다 */
  assigneeId?: string;
  /** 대표에게만 승인 대기 줄을 보인다 */
  isAdmin?: boolean;
}

export function buildCeoSummary(ctx: SummaryCtx): { lines: SummaryLine[]; text: string } {
  const { now, assigneeId } = ctx;
  const nowIso = now.toISOString();
  const cname = (id?: string) => ctx.companies.find((c) => c.id === id)?.name ?? "";
  const mineP = (p: Project) => !assigneeId || p.consultantId === assigneeId;
  const lines: SummaryLine[] = [];

  // 1) 프로젝트 — 대시보드 "지연 프로젝트"와 같은 기준(7일 이상 단계 정체 또는 마감 경과)
  const active = ctx.projects.filter((p) => !p.archived && !["done", "aftercare"].includes(p.stage) && mineP(p));
  const delayed = active
    .map((p) => ({ p, idle: daysBetween(p.stageChangedAt, nowIso), over: daysBetween(nowIso, p.dueDate) < 0 }))
    .filter((x) => x.idle >= 7 || x.over)
    .sort((a, b) => b.idle - a.idle);
  lines.push({
    key: "project",
    href: delayed.length ? "/ax/projects?filter=delayed" : "/ax/projects",
    tone: delayed.length ? "warn" : "ok",
    text: delayed.length
      ? `진행 중 프로젝트 ${active.length}건 중 지연 ${delayed.length}건 — 가장 오래 멈춘 곳은 ${cname(delayed[0].p.companyId)} ${delayed[0].p.name}(${delayed[0].idle}일째 같은 단계)`
      : `진행 중 프로젝트 ${active.length}건, 지연 없음`,
  });

  // 2) 자료
  const docs = ctx.docRequests.filter((d) => !assigneeId || d.assigneeId === assigneeId);
  const missing = docs.filter((d) => d.status === "requested" || d.status === "revision");
  const overdue = missing.filter((d) => daysBetween(d.dueDate, nowIso) > 0);
  const waiting = docs.filter((d) => d.status === "submitted" || d.status === "reviewing");
  lines.push({
    key: "docs",
    href: "/ax/documents",
    tone: overdue.length ? "bad" : waiting.length || missing.length ? "info" : "ok",
    text: missing.length || waiting.length
      ? `고객 자료 미제출 ${missing.length}건${overdue.length ? `(기한 초과 ${overdue.length}건)` : ""}, 들어와서 검토를 기다리는 자료 ${waiting.length}건`
      : "밀린 고객 자료 없음",
  });

  // 3) 문의
  const open = ctx.inquiries.filter((i) => i.status === "open" && (!assigneeId || i.assigneeId === assigneeId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  lines.push({
    key: "inquiry",
    href: "/ax/tasks?tab=inquiry",
    tone: open.length ? "bad" : "ok",
    text: open.length ? `답하지 않은 고객 문의 ${open.length}건 — 가장 오래된 것은 ${fmtRelative(open[0].createdAt, now)} ${cname(open[0].companyId)}` : "답하지 않은 고객 문의 없음",
  });

  // 4) 대표 승인 — 대표 화면에만
  if (ctx.isAdmin) {
    const pending = ctx.approvals.filter((a) => a.status === "pending");
    if (pending.length) lines.push({ key: "approval", href: "/ax/opportunities?tab=approvals", tone: "warn", text: `대표님 승인을 기다리는 건 ${pending.length}건` });
  }

  // 5) 이번 주 일정
  const week = ctx.schedules
    .filter((s) => (!assigneeId || s.assigneeId === assigneeId) && s.start >= nowIso && daysBetween(nowIso, s.start) <= 7)
    .sort((a, b) => a.start.localeCompare(b.start));
  lines.push({
    key: "schedule",
    href: "/ax/schedule",
    tone: "info",
    text: week.length
      ? `앞으로 7일 일정 ${week.length}건 — 다음은 ${fmtDate(week[0].start, { weekday: true })} ${fmtTime(week[0].start)} ${week[0].title}`
      : "앞으로 7일 잡힌 일정 없음",
  });

  // 6) 지난 7일 실제 처리량 — 기록에서 그대로 센다
  const since = new Date(now.getTime() - 7 * 86400000).toISOString();
  const recent = ctx.activities.filter((a) => a.at >= since && (!assigneeId || a.actorId === assigneeId));
  const n = (t: Activity["type"]) => recent.filter((a) => a.type === t).length;
  const reviewed = n("document_reviewed") + n("document_revision_requested");
  const consulted = n("consultation_logged");
  const answered = n("inquiry_answered");
  const done = n("task_completed");
  lines.push({
    key: "week",
    href: "/ax/reports?tab=evidence",
    tone: "info",
    text: reviewed + consulted + answered + done
      ? `지난 7일 처리 — 자료 검토 ${reviewed}건 · 상담 기록 ${consulted}건 · 문의 답변 ${answered}건 · 업무 완료 ${done}건`
      : "지난 7일 동안 시스템에 기록된 처리가 없습니다",
  });

  const head = `[KPJK ${assigneeId ? "담당 고객" : "회사 전체"} 요약 · ${fmtDate(nowIso, { weekday: true })}]`;
  const text = [head, ...lines.map((l) => `- ${l.text}`), "※ 시스템 기록을 그대로 센 값입니다."].join("\n");
  return { lines, text };
}
