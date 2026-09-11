import type { Activity, Company, DocumentRequest, Inquiry, Project, Schedule, Task, User } from "./types";
import { daysBetween, isSameDay, relativeDay, fmtTime } from "./format";
import { stageLabel } from "./stages";

/**
 * AI-02 DAILY WORK BRIEF — RULE ENGINE
 * 우선순위는 규칙으로 결정한다. LLM은 문장화에만 사용 예정(AI READY).
 * 모든 항목은 "왜?" 근거 2~4개를 가진다 (Explainability).
 */
export type BriefKind =
  | "doc_overdue"
  | "doc_due_today"
  | "project_stalled"
  | "meeting_today"
  | "inquiry_open"
  | "task_overdue"
  | "contract_pending"
  | "revision_pending"
  | "churn_risk"
  | "reengage";

/**
 * 브리핑 항목에서 그 자리에 실행할 수 있는 행동.
 * 규칙 엔진은 "무엇을 할 수 있는지"만 선언하고, 실행은 UI(BriefActions)가 store action으로 처리한다.
 * 이렇게 두면 규칙 파일은 순수하게 유지되고, 실행 결과는 전부 기존 Evidence 경로로 기록된다.
 */
export type BriefActionKind =
  | "draft"          // 커뮤니케이션 초안 열기
  | "complete_task"  // 업무 완료 처리 (즉시)
  | "add_task"       // 후속 업무 등록
  | "add_schedule"   // 일정 등록
  | "change_stage"   // 프로젝트 단계 변경
  | "raise_opp"      // 매출기회로 등록
  | "open";          // 해당 화면으로 이동 (맥락이 더 필요한 경우)

export interface BriefAction {
  kind: BriefActionKind;
  label: string;
  /** 실행에 필요한 값. draft는 DraftKind와 템플릿 ctx를 담는다. */
  payload?: Record<string, string | undefined>;
  primary?: boolean;
}

export interface BriefItem {
  id: string;
  kind: BriefKind;
  priority: "urgent" | "normal";
  title: string;
  companyId?: string;
  companyName?: string;
  projectId?: string;
  taskId?: string;
  reasons: string[];
  nextAction: string;
  href: string;
  score: number;
  actions: BriefAction[];
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
  const { now, companies, projects, docRequests, schedules, tasks, inquiries, activities, users, assigneeId } = input;
  const items: BriefItem[] = [];
  const cname = (id?: string) => companies.find((c) => c.id === id)?.name ?? "";
  const uname = (id?: string) => users.find((u) => u.id === id)?.name ?? "담당자";
  /** 초안 템플릿에 필요한 공통 컨텍스트 */
  const draftCtx = (companyId?: string, extra: Record<string, string | undefined> = {}) => {
    const c = companies.find((x) => x.id === companyId);
    return { companyName: c?.name ?? "", contactName: c?.contactName ?? "", consultantName: uname(c?.consultantId), ...extra };
  };
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
        actions: [
          { kind: "draft", label: "안내 초안", primary: true, payload: { draftKind: r.status === "revision" ? "revision_reminder" : "doc_reminder", ...draftCtx(r.companyId, { docName: r.name, dueText: `${relativeDay(r.dueDate, now)} (${days}일 지남)`, note: r.reviewNote }) } },
          { kind: "add_task", label: "후속 업무", payload: { title: `${cname(r.companyId)} ${r.name} 재요청 연락`, type: "후속연락" } },
          { kind: "open", label: "자료 열기" },
        ],
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
        actions: [
          { kind: "draft", label: "리마인드 초안", primary: true, payload: { draftKind: "doc_reminder", ...draftCtx(r.companyId, { docName: r.name, dueText: `오늘 ${fmtTime(r.dueDate)}` }) } },
          { kind: "open", label: "자료 열기" },
        ],
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
        actions: [
          { kind: "draft", label: "보완 안내 초안", primary: true, payload: { draftKind: "revision_reminder", ...draftCtx(r.companyId, { docName: r.name, dueText: relativeDay(r.dueDate, now), note: r.reviewNote }) } },
          { kind: "open", label: "자료 열기" },
        ],
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
        actions: [
          { kind: "change_stage", label: "단계 변경", primary: true },
          { kind: "add_schedule", label: "일정 잡기" },
          { kind: "add_task", label: "후속 업무", payload: { title: `${cname(p.companyId)} ${p.name} 병목 확인`, type: "내부작업" } },
        ],
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
      actions: [
        { kind: "draft", label: "미팅 확인 초안", primary: true, payload: { draftKind: "meeting_confirm", ...draftCtx(s.companyId, { scheduleTitle: s.title, scheduleTime: `오늘 ${fmtTime(s.start)}`, location: s.location }) } },
        { kind: "add_task", label: "미팅 준비 업무", payload: { title: `${s.title} 사전자료 준비`, type: "미팅준비" } },
        { kind: "open", label: "일정 열기" },
      ],
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
      actions: [{ kind: "open", label: "답변 작성", primary: true }],
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
        taskId: t.id,
        actions: [
          { kind: "complete_task", label: "완료 처리", primary: true },
          { kind: "open", label: "업무 열기" },
        ],
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
        actions: [
          { kind: "draft", label: "서명 확인 초안", primary: true, payload: { draftKind: "contract_followup", ...draftCtx(p.companyId, { stage: stageLabel(p.stage), note: `${p.name} 계약서 서명` }) } },
          { kind: "add_task", label: "후속 업무", payload: { title: `${cname(p.companyId)} 계약 서명 확인`, type: "후속연락" } },
        ],
      });
    }
  }

  // 8. 이탈 위험 — 오래 접촉이 없는 고객. "연락처럼 보이는 활동"이 기준이다.
  const CONTACT_TYPES = new Set(["consultation_logged", "inquiry_answered", "inquiry_created", "document_reviewed", "document_uploaded", "result_shared", "schedule_created", "project_stage_changed"]);
  for (const c of companies.filter((c) => !assigneeId || c.consultantId === assigneeId)) {
    const last = activities.filter((a) => a.companyId === c.id && CONTACT_TYPES.has(a.type)).sort((x, y) => y.at.localeCompare(x.at))[0];
    const lastAt = last?.at ?? c.firstConsultDate;
    const silent = daysBetween(lastAt, nowIso);
    const activeP = projects.filter((p) => p.companyId === c.id && !["done", "aftercare"].includes(p.stage));
    if (silent >= 21) {
      items.push({
        id: `b_churn_${c.id}`,
        kind: "churn_risk",
        priority: silent >= 35 ? "urgent" : "normal",
        title: `${c.name} ${silent}일째 접촉 없음`,
        companyId: c.id,
        companyName: c.name,
        reasons: [
          `마지막 접촉 기록이 ${silent}일 전입니다`,
          activeP.length ? `진행 중 프로젝트 ${activeP.length}건이 있는데도 기록이 없습니다` : "현재 진행 중인 프로젝트가 없습니다",
          `담당 ${uname(c.consultantId)}`,
        ],
        nextAction: "안부 겸 진행상황 연락",
        href: `/ax/clients/${c.id}`,
        score: 45 + silent,
        actions: [
          { kind: "draft", label: "안부 연락 초안", primary: true, payload: { draftKind: "checkin", ...draftCtx(c.id, { stage: activeP[0] ? stageLabel(activeP[0].stage) : undefined, note: activeP[0]?.name }) } },
          { kind: "add_task", label: "후속연락 업무", payload: { title: `${c.name} 후속연락`, type: "후속연락" } },
          { kind: "open", label: "고객 열기" },
        ],
      });
    }
  }

  // 9. 재상담 대상 — 완료/사후관리 이후 일정 기간이 지났고 현재 진행 건이 없는 고객
  for (const c of companies.filter((c) => !assigneeId || c.consultantId === assigneeId)) {
    const cp = projects.filter((p) => p.companyId === c.id);
    if (cp.length === 0) continue;
    const active = cp.filter((p) => !["done", "aftercare"].includes(p.stage));
    if (active.length > 0) continue;
    const lastDone = cp.filter((p) => ["done", "aftercare"].includes(p.stage)).sort((a, b) => b.stageChangedAt.localeCompare(a.stageChangedAt))[0];
    if (!lastDone) continue;
    const since = daysBetween(lastDone.stageChangedAt, nowIso);
    if (since >= 30) {
      items.push({
        id: `b_reeng_${c.id}`,
        kind: "reengage",
        priority: "normal",
        title: `${c.name} 재상담 검토 (완료 후 ${since}일)`,
        companyId: c.id,
        companyName: c.name,
        projectId: lastDone.id,
        reasons: [
          `${lastDone.name} 완료 후 ${since}일 경과`,
          "현재 진행 중인 프로젝트가 없습니다",
          `담당 ${uname(c.consultantId)} · 이전 진행 이력 ${cp.length}건`,
        ],
        nextAction: "추가로 검토할 항목이 있는지 확인",
        href: `/ax/clients/${c.id}`,
        score: 40 + Math.min(since, 60),
        actions: [
          { kind: "raise_opp", label: "매출기회 등록", primary: true },
          { kind: "draft", label: "재상담 제안 초안", payload: { draftKind: "reengage", ...draftCtx(c.id, { note: lastDone.name }) } },
          { kind: "add_task", label: "후속연락 업무", payload: { title: `${c.name} 재상담 제안`, type: "후속연락" } },
        ],
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
    churn: items.filter((i) => i.kind === "churn_risk").length,
    reengage: items.filter((i) => i.kind === "reengage").length,
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
export type DraftKind = "doc_reminder" | "revision_reminder" | "schedule_notice" | "meeting_confirm" | "progress_update" | "contract_followup" | "checkin" | "reengage";

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
    case "contract_followup":
      return `${greet}\n\n앞서 보내드린 「${ctx.note ?? "계약서"}」 관련하여 확인차 연락드립니다.\n\n검토 중 궁금하신 부분이나 조정이 필요한 항목이 있으시면 편하게 말씀해 주세요. 내용을 함께 정리해 드리겠습니다.\n\n서명이 완료되면 바로 다음 단계(자료 요청)를 안내드리겠습니다.\n\n감사합니다.`;
    case "checkin":
      return `${greet}\n\n그동안 별고 없으셨는지요. ${ctx.companyName} 진행 건과 관련해 확인차 연락드립니다.\n\n${ctx.note ? `- 진행 건: ${ctx.note}${ctx.stage ? ` (현재 ${ctx.stage} 단계)` : ""}\n` : ""}- 현재 시점에서 추가로 필요하신 부분이 있는지 여쭙고자 합니다.\n\n편하신 시간에 짧게 통화 가능하실까요? 일정 알려주시면 맞추겠습니다.\n\n감사합니다.`;
    case "reengage":
      return `${greet}\n\n지난번 「${ctx.note ?? "프로젝트"}」를 마무리한 이후 시간이 좀 지났습니다. 그 사이 회사 상황에 변화가 있으셨는지 궁금합니다.\n\n지금 시점에서 함께 점검해볼 만한 항목이 있는지 짧게 확인해 드릴 수 있습니다. 비용이 발생하는 건은 아니고, 해당 여부만 먼저 보는 과정입니다.\n\n필요하시면 편하신 시간 알려주세요.\n\n감사합니다.`;
  }
}
