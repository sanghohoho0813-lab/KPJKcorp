import type { Activity, Company, DocumentRequest, Inquiry, Project, Schedule, Task, User } from "./types";
import { daysBetween, isSameDay, relativeDay, fmtTime } from "./format";
import { stageLabel } from "./stages";

/**
 * AI-02 DAILY WORK BRIEF — RULE ENGINE
 * 우선순위는 규칙으로 결정한다. LLM은 문장화에만 사용 예정(AI READY).
 * 모든 항목은 "왜?" 근거 2~4개를 가진다 (Explainability).
 */
export type BriefKind = "doc_overdue" | "doc_due_today" | "project_stalled" | "meeting_today" | "inquiry_open" | "task_overdue" | "contract_pending" | "revision_pending";

export interface BriefItem {
  id: string;
  kind: BriefKind;
  priority: "urgent" | "normal";
  title: string;
  companyId?: string;
  companyName?: string;
  projectId?: string;
  reasons: string[];
  nextAction: string;
  href: string;
  score: number;
}

export interface BriefInput {
  now: Date;
  companies: Company[];
  projects: Project[];
  docRequests: DocumentRequest[];
  schedules: Schedule[];
  tasks: Task[];
  inquiries: Inquiry[];
  activities: Activity[];
  users: User[];
  /** limit to a consultant's own items (consultant role) */
  assigneeId?: string;
}

export function buildBrief(input: BriefInput): BriefItem[] {
  const { now, companies, projects, docRequests, schedules, tasks, inquiries, activities, assigneeId } = input;
  const items: BriefItem[] = [];
  const cname = (id?: string) => companies.find((c) => c.id === id)?.name ?? "";
  const mine = <T extends { assigneeId?: string; consultantId?: string }>(x: T) => !assigneeId || x.assigneeId === assigneeId || x.consultantId === assigneeId;
  const nowIso = now.toISOString();

  // 1. Overdue documents
  for (const r of docRequests.filter((r) => (r.status === "requested" || r.status === "revision") && mine(r))) {
    const days = daysBetween(r.dueDate, nowIso);
    if (days > 0) {
      items.push({
        id: `b_doc_over_${r.id}`,
        kind: "doc_overdue",
        priority: "urgent",
        title: `${cname(r.companyId)} ${r.name} 기한 초과`,
        companyId: r.companyId,
        companyName: cname(r.companyId),
        projectId: r.projectId,
        reasons: [`제출기한이 ${days}일 지났습니다`, `현재 상태: ${r.status === "revision" ? "보완필요" : "미제출"}`, `프로젝트 진행이 이 자료에 막혀 있습니다`],
        nextAction: "고객에게 재요청 연락 (커뮤니케이션 초안 사용)",
        href: `/ax/documents?focus=${r.id}`,
        score: 100 + days,
      });
    } else if (isSameDay(r.dueDate, now)) {
      items.push({
        id: `b_doc_today_${r.id}`,
        kind: "doc_due_today",
        priority: "urgent",
        title: `${cname(r.companyId)} ${r.name} 오늘 마감`,
        companyId: r.companyId,
        companyName: cname(r.companyId),
        projectId: r.projectId,
        reasons: [`제출기한 오늘 ${fmtTime(r.dueDate)}`, `아직 제출되지 않았습니다`],
        nextAction: "오전 중 고객 담당자에게 리마인드",
        href: `/ax/documents?focus=${r.id}`,
        score: 90,
      });
    }
  }

  // 2. Revision pending (client hasn't resubmitted) — not overdue yet
  for (const r of docRequests.filter((r) => r.status === "revision" && mine(r))) {
    const days = daysBetween(r.reviewedAt ?? r.requestedAt, nowIso);
    if (days >= 5 && !isSameDay(r.dueDate, now) && daysBetween(r.dueDate, nowIso) <= 0) {
      items.push({
        id: `b_rev_${r.id}`,
        kind: "revision_pending",
        priority: "normal",
        title: `${cname(r.companyId)} ${r.name} 보완 대기 ${days}일`,
        companyId: r.companyId,
        companyName: cname(r.companyId),
        projectId: r.projectId,
        reasons: [`보완 요청 후 ${days}일 경과`, `기한: ${relativeDay(r.dueDate, now)}`],
        nextAction: "보완 진행 여부 확인 연락",
        href: `/ax/documents?focus=${r.id}`,
        score: 55 + days,
      });
    }
  }

  // 3. Stalled projects (no activity for >= 7 days, active stage)
  for (const p of projects.filter((p) => !["done", "aftercare", "inquiry"].includes(p.stage) && mine(p))) {
    const last = activities.filter((a) => a.projectId === p.id).sort((a, b) => b.at.localeCompare(a.at))[0];
    const lastAt = last?.at ?? p.stageChangedAt;
    const idle = daysBetween(lastAt, nowIso);
    if (idle >= 7) {
      items.push({
        id: `b_stall_${p.id}`,
        kind: "project_stalled",
        priority: idle >= 10 ? "urgent" : "normal",
        title: `${cname(p.companyId)} ${p.name} ${idle}일째 정체`,
        companyId: p.companyId,
        companyName: cname(p.companyId),
        projectId: p.id,
        reasons: [`마지막 Activity ${idle}일 전`, `현재 단계: ${stageLabel(p.stage)}`, `마감까지 ${daysBetween(nowIso, p.dueDate)}일`],
        nextAction: "담당자와 병목 확인 후 다음 Action 등록",
        href: `/ax/projects/${p.id}`,
        score: 60 + idle,
      });
    }
  }

  // 4. Today's meetings
  for (const s of schedules.filter((s) => isSameDay(s.start, now) && (s.type === "meeting" || s.type === "consult" || s.type === "report") && mine(s))) {
    items.push({
      id: `b_meet_${s.id}`,
      kind: "meeting_today",
      priority: "normal",
      title: `오늘 ${fmtTime(s.start)} ${s.title}`,
      companyId: s.companyId,
      companyName: cname(s.companyId),
      projectId: s.projectId,
      reasons: [`장소: ${s.location ?? "-"}`, s.memo ? `메모: ${s.memo}` : "사전자료 확인 필요"],
      nextAction: "미팅 사전자료 확인",
      href: `/ax/schedule`,
      score: 70,
    });
  }

  // 5. Open inquiries
  for (const iq of inquiries.filter((iq) => iq.status === "open" && mine(iq))) {
    const hours = Math.floor((now.getTime() - new Date(iq.createdAt).getTime()) / 3600000);
    items.push({
      id: `b_iq_${iq.id}`,
      kind: "inquiry_open",
      priority: hours >= 24 ? "urgent" : "normal",
      title: `${cname(iq.companyId)} 미답변 문의: ${iq.title}`,
      companyId: iq.companyId,
      companyName: cname(iq.companyId),
      projectId: iq.projectId,
      reasons: [`접수 후 ${hours}시간 경과`, `분류: ${iq.category}`, "고객이 답변을 기다리고 있습니다"],
      nextAction: "문의 답변 등록",
      href: `/ax/inquiries?focus=${iq.id}`,
      score: 65 + Math.min(hours, 48),
    });
  }

  // 6. Overdue tasks
  for (const t of tasks.filter((t) => (t.status === "todo" || t.status === "doing") && mine(t))) {
    const days = daysBetween(t.dueDate, nowIso);
    if (days > 0) {
      items.push({
        id: `b_task_${t.id}`,
        kind: "task_overdue",
        priority: "urgent",
        title: `기한 지난 업무: ${t.title}`,
        companyId: t.companyId,
        companyName: cname(t.companyId),
        projectId: t.projectId,
        reasons: [`기한 ${days}일 지남`, `우선순위: ${t.priority === "urgent" ? "긴급" : "보통"}`],
        nextAction: "처리 또는 일정 재조정",
        href: `/ax/tasks`,
        score: 75 + days,
      });
    }
  }

  // 7. Contracts sent but unsigned >= 1 day (represented by project stage contract)
  for (const p of projects.filter((p) => p.stage === "contract" && mine(p))) {
    const days = daysBetween(p.stageChangedAt, nowIso);
    if (days >= 1) {
      items.push({
        id: `b_ct_${p.id}`,
        kind: "contract_pending",
        priority: "normal",
        title: `${cname(p.companyId)} 계약 서명 대기 ${days}일`,
        companyId: p.companyId,
        companyName: cname(p.companyId),
        projectId: p.id,
        reasons: [`계약 단계 진입 ${days}일 전`, "서명 확인 후 자료요청 단계로 진행 가능"],
        nextAction: "서명 여부 확인 연락",
        href: `/ax/consultations`,
        score: 50 + days,
      });
    }
  }

  return items.sort((a, b) => b.score - a.score);
}

export function briefSummaryCounts(items: BriefItem[]) {
  return {
    followups: items.filter((i) => ["doc_overdue", "doc_due_today", "revision_pending", "contract_pending"].includes(i.kind)).length,
    docs: items.filter((i) => i.kind === "doc_overdue" || i.kind === "doc_due_today").length,
    stalled: items.filter((i) => i.kind === "project_stalled").length,
    meetings: items.filter((i) => i.kind === "meeting_today").length,
    inquiries: items.filter((i) => i.kind === "inquiry_open").length,
  };
}

/** AI-03 PROJECT SUMMARY — rule based */
export function projectSummary(p: Project, docs: DocumentRequest[], schedules: Schedule[], activities: Activity[], now: Date) {
  const mine = docs.filter((d) => d.projectId === p.id);
  const submitted = mine.filter((d) => ["submitted", "reviewing", "done"].includes(d.status)).length;
  const missing = mine.filter((d) => d.status === "requested" || d.status === "revision");
  const next = schedules.filter((s) => s.projectId === p.id && new Date(s.start) >= now).sort((a, b) => a.start.localeCompare(b.start))[0];
  const last = activities.filter((a) => a.projectId === p.id).sort((a, b) => b.at.localeCompare(a.at))[0];
  const dueDays = daysBetween(now.toISOString(), p.dueDate);
  const lines: string[] = [];
  lines.push(`현재 ${stageLabel(p.stage)} 단계이며, 마감까지 ${dueDays >= 0 ? `${dueDays}일 남았습니다` : `${-dueDays}일 지났습니다`}.`);
  if (mine.length) lines.push(`요청자료 ${mine.length}건 중 ${submitted}건이 제출되었고${missing.length ? `, ${missing.map((m) => m.name).join(", ")} ${missing.length}건이 남아 있습니다` : " 모두 접수되었습니다"}.`);
  if (next) lines.push(`다음 일정은 ${relativeDay(next.start, now)} ${next.title}입니다.`);
  if (last) lines.push(`마지막 활동: ${last.text} (${relativeDay(last.at, now)}).`);
  const nextAction = missing.length ? `${missing[0].name} 제출 확인` : p.stage === "review" ? "검토 의견 정리 후 결과작성 단계로 전환" : p.stage === "drafting" ? "결과보고서 완성 및 대표미팅 일정 확정" : next ? `${next.title} 준비` : "다음 단계 Action 등록";
  return { lines, nextAction, missing, submitted, total: mine.length };
}

/** AI-05 COMMUNICATION DRAFT — templates (L1, always human-reviewed) */
export type DraftKind = "doc_reminder" | "revision_reminder" | "schedule_notice" | "meeting_confirm" | "progress_update";

export function communicationDraft(kind: DraftKind, ctx: { companyName: string; contactName: string; consultantName: string; docName?: string; dueText?: string; scheduleTitle?: string; scheduleTime?: string; location?: string; stage?: string; note?: string }) {
  const greet = `안녕하세요 ${ctx.contactName}님, KPJK ${ctx.consultantName}입니다.`;
  switch (kind) {
    case "doc_reminder":
      return `${greet}\n\n진행 중인 컨설팅과 관련하여 요청드린 「${ctx.docName}」 자료의 제출 기한이 ${ctx.dueText}입니다.\n\n고객 포털의 [요청자료] 메뉴에서 바로 업로드하실 수 있습니다. 준비에 어려움이 있으시면 편하게 말씀해 주세요. 일정을 조정해 드리겠습니다.\n\n감사합니다.`;
    case "revision_reminder":
      return `${greet}\n\n제출해 주신 「${ctx.docName}」 자료를 검토한 결과, 아래 내용의 보완이 필요합니다.\n\n- ${ctx.note ?? "보완 내용"}\n\n보완 후 고객 포털의 [요청자료]에서 재제출해 주시면 바로 검토하겠습니다. 기한은 ${ctx.dueText}입니다.\n\n감사합니다.`;
    case "schedule_notice":
      return `${greet}\n\n${ctx.scheduleTitle} 일정을 안내드립니다.\n\n- 일시: ${ctx.scheduleTime}\n- 장소: ${ctx.location ?? "추후 안내"}\n\n일정 변경이 필요하시면 회신 부탁드립니다.\n\n감사합니다.`;
    case "meeting_confirm":
      return `${greet}\n\n${ctx.scheduleTime}에 예정된 「${ctx.scheduleTitle}」 미팅을 다시 한번 확인드립니다.\n\n- 장소: ${ctx.location ?? "-"}\n- 준비사항: 특별히 준비하실 것은 없습니다. 당일 현재까지의 분석 결과를 먼저 설명드리겠습니다.\n\n감사합니다.`;
    case "progress_update":
      return `${greet}\n\n${ctx.companyName} 컨설팅 진행상황을 안내드립니다.\n\n- 현재 단계: ${ctx.stage}\n- 다음 진행: ${ctx.note ?? "-"}\n\n자세한 내용은 고객 포털 [내 프로젝트]에서 언제든 확인하실 수 있습니다.\n\n감사합니다.`;
  }
}
