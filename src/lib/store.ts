"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { buildSeed, type SeedData } from "./demo/seed";
import type {
  Activity,
  ActivityType,
  Approval,
  ApprovalKind,
  DocumentRequest,
  InternalStage,
  Inquiry,
  Notification,
  Opportunity,
  OpportunitySource,
  OpportunityStatus,
  ResultFile,
  Role,
  Schedule,
  Session,
  Settings,
  SurveyResponse,
  Task,
  TaskStatus,
} from "./types";
import { nowIso, uid, addDays, iso } from "./format";
import { stageLabel } from "./stages";
import { OPP_STATUS, SERVICE_BY_KEY } from "./services";

export interface StoreState extends SeedData {
  hydrated: boolean;
  seededAt: string;
  session: Session | null;
  settings: Settings;
  toasts: { id: string; text: string; tone?: "success" | "error" | "info" }[];

  // session
  login: (userId: string) => void;
  logout: () => void;
  setPortalPreview: (companyId?: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  toast: (text: string, tone?: "success" | "error" | "info") => void;
  dismissToast: (id: string) => void;
  setHydrated: () => void;
  reseedIfStale: () => void;

  // closed loop actions
  uploadDocument: (requestId: string, file: { fileName: string; size: number }, byUserId: string) => void;
  reviewDocument: (requestId: string, outcome: "done" | "revision" | "reviewing", note: string | undefined, byUserId: string) => void;
  changeProjectStage: (projectId: string, stage: InternalStage, byUserId: string) => void;
  createDocRequest: (projectId: string, data: { name: string; description: string; dueDate: string }, byUserId: string) => void;
  createInquiry: (data: { companyId: string; projectId?: string; title: string; category: Inquiry["category"]; body: string }, byUserId: string) => void;
  replyInquiry: (inquiryId: string, body: string, byUserId: string, role: Role) => void;
  closeInquiry: (inquiryId: string, byUserId: string) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus, byUserId: string) => void;
  createTask: (data: Omit<Task, "id" | "createdAt" | "status"> & { status?: TaskStatus }, byUserId: string) => void;
  createSchedule: (data: Omit<Schedule, "id">, byUserId: string) => void;
  shareResult: (data: Omit<ResultFile, "id" | "sharedAt">, byUserId: string) => void;
  downloadResult: (resultId: string, byUserId: string) => void;
  // opportunity / approval / survey
  raiseOpportunity: (data: { companyId: string; serviceKey: string; note?: string; reason?: string; source: OpportunitySource }, byUserId: string, byRole: Role) => void;
  advanceOpportunity: (id: string, status: OpportunityStatus, byUserId: string, note?: string) => void;
  requestApproval: (data: { kind: ApprovalKind; title: string; summary: string; companyId?: string; projectId?: string; opportunityId?: string; baseAmount?: number; discountPct?: number }, byUserId: string) => void;
  decideApproval: (id: string, decision: "approved" | "rejected", byUserId: string, note?: string) => void;
  submitSurvey: (data: Omit<SurveyResponse, "id" | "submittedAt">) => void;

  markNotificationRead: (id: string) => void;
  markAllRead: (audience: "internal" | "client", companyId?: string) => void;
  logActivity: (a: Omit<Activity, "id" | "at">) => void;
  resetDemo: () => void;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "kpjk",
  fontScale: "base",
  reduceMotion: false,
  tutorialDoneAx: false,
  tutorialDonePortal: false,
  timezone: "Asia/Seoul",
};

function makeActivity(a: Omit<Activity, "id" | "at">): Activity {
  return { ...a, id: uid("ac"), at: nowIso() };
}

function makeNotification(n: Omit<Notification, "id" | "at" | "read">): Notification {
  return { ...n, id: uid("nt"), at: nowIso(), read: false };
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...buildSeed(),
      hydrated: false,
      seededAt: nowIso(),
      session: null,
      settings: DEFAULT_SETTINGS,
      toasts: [],

      setHydrated: () => set({ hydrated: true }),
      // Demo freshness: reseed if the persisted seed is older than 20 hours so relative dates stay "today".
      reseedIfStale: () => {
        const age = Date.now() - new Date(get().seededAt).getTime();
        if (age > 20 * 3600 * 1000) set({ ...buildSeed(), seededAt: nowIso(), session: get().session, settings: get().settings });
      },

      login: (userId) => {
        const u = get().users.find((x) => x.id === userId);
        if (!u) return;
        const session: Session = { userId: u.id, role: u.role, companyId: u.companyId };
        const patch: Partial<StoreState> = { session };
        if (u.role === "client") {
          patch.activities = [makeActivity({ type: "portal_login", companyId: u.companyId, actorId: u.id, actorRole: "client", text: "고객 Portal 접속" }), ...get().activities];
        }
        set(patch);
      },
      logout: () => set({ session: null }),
      setPortalPreview: (companyId) => {
        const s = get().session;
        if (!s) return;
        set({ session: { ...s, portalPreviewCompanyId: companyId } });
      },
      setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      toast: (text, tone = "success") => {
        const id = uid("t");
        set({ toasts: [...get().toasts, { id, text, tone }] });
        setTimeout(() => get().dismissToast(id), 3200);
      },
      dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

      logActivity: (a) => set({ activities: [makeActivity(a), ...get().activities] }),

      // ---------- PRIMARY CLOSED LOOP ----------
      uploadDocument: (requestId, file, byUserId) => {
        const st = get();
        const req = st.docRequests.find((r) => r.id === requestId);
        if (!req) return;
        const project = st.projects.find((p) => p.id === req.projectId);
        const company = st.companies.find((c) => c.id === req.companyId);
        const version = req.files.length + 1;
        const now = nowIso();
        const updated: DocumentRequest = {
          ...req,
          status: "submitted",
          submittedAt: now,
          reviewNote: undefined,
          files: [...req.files, { id: uid("f"), fileName: file.fileName, size: file.size, uploadedAt: now, uploadedBy: byUserId, version }],
        };
        const docRequests = st.docRequests.map((r) => (r.id === requestId ? updated : r));

        // auto: review task for assignee
        const task: Task = {
          id: uid("tk"),
          companyId: req.companyId,
          projectId: req.projectId,
          title: `${company?.name ?? ""} ${req.name} 검토`,
          type: "자료검토",
          dueDate: iso(addDays(new Date(), 2, 18)),
          assigneeId: req.assigneeId,
          status: "todo",
          priority: "normal",
          createdAt: now,
          source: "auto",
        };

        // auto: stage doc_request -> doc_received when all requested docs are in
        let projects = st.projects;
        const projActs: Activity[] = [];
        if (project && project.stage === "doc_request") {
          const remaining = docRequests.filter((r) => r.projectId === project.id && (r.status === "requested" || r.status === "revision"));
          if (remaining.length === 0) {
            projects = st.projects.map((p) => (p.id === project.id ? { ...p, stage: "doc_received" as InternalStage, stageChangedAt: now } : p));
            projActs.push(makeActivity({ type: "project_stage_changed", companyId: req.companyId, projectId: req.projectId, actorId: "system", actorRole: "system", text: "단계 자동 변경: 자료요청 → 자료접수 (요청자료 전부 제출)", meta: { from: "doc_request", to: "doc_received" } }));
          }
        }

        set({
          docRequests,
          projects,
          tasks: [task, ...st.tasks],
          activities: [
            makeActivity({ type: "task_created", companyId: req.companyId, projectId: req.projectId, actorId: "system", actorRole: "system", text: `자동 생성: ${req.name} 검토 Task` }),
            ...projActs,
            makeActivity({ type: "document_uploaded", companyId: req.companyId, projectId: req.projectId, actorId: byUserId, actorRole: "client", text: `고객 제출: ${req.name} (v${version})`, meta: { fileName: file.fileName } }),
            ...st.activities,
          ],
          notifications: [
            makeNotification({ audience: "internal", companyId: req.companyId, title: `새 자료 도착: ${company?.name ?? ""}`, body: `${req.name}이(가) 제출되었습니다. 검토가 필요합니다.`, href: "/ax/documents" }),
            makeNotification({ audience: "client", companyId: req.companyId, title: "자료가 접수되었습니다", body: `${req.name} 제출이 완료되었습니다. 담당자가 검토 후 안내드립니다.`, href: "/portal/documents" }),
            ...st.notifications,
          ],
        });
      },

      reviewDocument: (requestId, outcome, note, byUserId) => {
        const st = get();
        const req = st.docRequests.find((r) => r.id === requestId);
        if (!req) return;
        const company = st.companies.find((c) => c.id === req.companyId);
        const now = nowIso();
        const updated: DocumentRequest = { ...req, status: outcome, reviewedAt: outcome === "reviewing" ? req.reviewedAt : now, reviewNote: outcome === "revision" ? note : req.reviewNote };
        const tasks = st.tasks.map((t) => (t.source === "auto" && t.projectId === req.projectId && t.title.includes(req.name) && t.status !== "done" && outcome !== "reviewing" ? { ...t, status: "done" as TaskStatus, completedAt: now } : t));

        const clientNotif =
          outcome === "done"
            ? makeNotification({ audience: "client", companyId: req.companyId, title: "자료 확인이 완료되었습니다", body: `${req.name} 검토가 완료되었습니다.`, href: "/portal/documents" })
            : outcome === "revision"
              ? makeNotification({ audience: "client", companyId: req.companyId, title: `보완 요청: ${req.name}`, body: note || "보완이 필요합니다. 요청자료에서 내용을 확인해 주세요.", href: "/portal/documents" })
              : makeNotification({ audience: "client", companyId: req.companyId, title: "자료를 검토하고 있습니다", body: `${req.name} 검토를 시작했습니다.`, href: "/portal/documents" });

        const actType: ActivityType = outcome === "revision" ? "document_revision_requested" : "document_reviewed";
        const text = outcome === "revision" ? `보완 요청: ${req.name}` : outcome === "done" ? `검토 완료: ${req.name}` : `검토 시작: ${req.name}`;

        set({
          docRequests: st.docRequests.map((r) => (r.id === requestId ? updated : r)),
          tasks,
          activities: [makeActivity({ type: actType, companyId: req.companyId, projectId: req.projectId, actorId: byUserId, actorRole: "consultant", text: `${text}${company ? ` (${company.name})` : ""}` }), ...st.activities],
          notifications: [clientNotif, ...st.notifications],
        });
      },

      changeProjectStage: (projectId, stage, byUserId) => {
        const st = get();
        const p = st.projects.find((x) => x.id === projectId);
        if (!p || p.stage === stage) return;
        const now = nowIso();
        set({
          projects: st.projects.map((x) => (x.id === projectId ? { ...x, stage, stageChangedAt: now } : x)),
          activities: [makeActivity({ type: "project_stage_changed", companyId: p.companyId, projectId, actorId: byUserId, actorRole: "consultant", text: `단계 변경: ${stageLabel(p.stage)} → ${stageLabel(stage)}`, meta: { from: p.stage, to: stage } }), ...st.activities],
          notifications: [makeNotification({ audience: "client", companyId: p.companyId, title: "프로젝트 진행 단계가 변경되었습니다", body: `${p.name}: ${stageLabel(stage)} 단계로 진행됩니다.`, href: "/portal/projects" }), ...st.notifications],
        });
      },

      createDocRequest: (projectId, data, byUserId) => {
        const st = get();
        const p = st.projects.find((x) => x.id === projectId);
        if (!p) return;
        const req: DocumentRequest = { id: uid("dr"), projectId, companyId: p.companyId, name: data.name, description: data.description, requestedAt: nowIso(), dueDate: data.dueDate, status: "requested", assigneeId: p.consultantId, files: [] };
        set({
          docRequests: [req, ...st.docRequests],
          activities: [makeActivity({ type: "document_requested", companyId: p.companyId, projectId, actorId: byUserId, actorRole: "consultant", text: `자료 요청: ${data.name}` }), ...st.activities],
          notifications: [makeNotification({ audience: "client", companyId: p.companyId, title: "새 자료 요청이 등록되었습니다", body: `${data.name} — 요청자료에서 확인 후 제출해 주세요.`, href: "/portal/documents" }), ...st.notifications],
        });
      },

      // ---------- SECONDARY CLOSED LOOP ----------
      createInquiry: (data, byUserId) => {
        const st = get();
        const company = st.companies.find((c) => c.id === data.companyId);
        const now = nowIso();
        const iq: Inquiry = { id: uid("iq"), companyId: data.companyId, projectId: data.projectId, title: data.title, category: data.category, createdAt: now, createdBy: byUserId, status: "open", assigneeId: company?.consultantId ?? "u_admin", messages: [{ id: uid("m"), authorId: byUserId, authorRole: "client", body: data.body, createdAt: now }] };
        const task: Task = { id: uid("tk"), companyId: data.companyId, projectId: data.projectId, title: `${company?.name ?? ""} 문의 답변: ${data.title}`, type: "문의응대", dueDate: iso(addDays(new Date(), 1, 18)), assigneeId: iq.assigneeId, status: "todo", priority: "urgent", createdAt: now, source: "auto" };
        set({
          inquiries: [iq, ...st.inquiries],
          tasks: [task, ...st.tasks],
          activities: [makeActivity({ type: "inquiry_created", companyId: data.companyId, projectId: data.projectId, actorId: byUserId, actorRole: "client", text: `고객 문의: ${data.title}` }), ...st.activities],
          notifications: [makeNotification({ audience: "internal", companyId: data.companyId, title: `새 문의: ${company?.name ?? ""}`, body: data.title, href: "/ax/inquiries" }), ...st.notifications],
        });
      },

      replyInquiry: (inquiryId, body, byUserId, role) => {
        const st = get();
        const iq = st.inquiries.find((x) => x.id === inquiryId);
        if (!iq) return;
        const now = nowIso();
        const isInternal = role !== "client";
        const updated: Inquiry = { ...iq, status: isInternal ? "answered" : "open", messages: [...iq.messages, { id: uid("m"), authorId: byUserId, authorRole: role, body, createdAt: now }] };
        const tasks = isInternal ? st.tasks.map((t) => (t.source === "auto" && t.type === "문의응대" && t.title.includes(iq.title) && t.status !== "done" ? { ...t, status: "done" as TaskStatus, completedAt: now } : t)) : st.tasks;
        set({
          inquiries: st.inquiries.map((x) => (x.id === inquiryId ? updated : x)),
          tasks,
          activities: [makeActivity({ type: isInternal ? "inquiry_answered" : "inquiry_created", companyId: iq.companyId, projectId: iq.projectId, actorId: byUserId, actorRole: role, text: isInternal ? `문의 답변: ${iq.title}` : `고객 추가 문의: ${iq.title}` }), ...st.activities],
          notifications: [
            isInternal
              ? makeNotification({ audience: "client", companyId: iq.companyId, title: "문의 답변이 등록되었습니다", body: iq.title, href: "/portal/inquiries" })
              : makeNotification({ audience: "internal", companyId: iq.companyId, title: "고객 추가 문의", body: iq.title, href: "/ax/inquiries" }),
            ...st.notifications,
          ],
        });
      },

      closeInquiry: (inquiryId, byUserId) => {
        const st = get();
        const iq = st.inquiries.find((x) => x.id === inquiryId);
        if (!iq) return;
        set({ inquiries: st.inquiries.map((x) => (x.id === inquiryId ? { ...x, status: "closed" } : x)), activities: [makeActivity({ type: "inquiry_answered", companyId: iq.companyId, projectId: iq.projectId, actorId: byUserId, actorRole: "consultant", text: `문의 종료: ${iq.title}` }), ...st.activities] });
      },

      // ---------- Tasks / Schedules / Results ----------
      updateTaskStatus: (taskId, status, byUserId) => {
        const st = get();
        const t = st.tasks.find((x) => x.id === taskId);
        if (!t) return;
        const now = nowIso();
        set({
          tasks: st.tasks.map((x) => (x.id === taskId ? { ...x, status, completedAt: status === "done" ? now : undefined } : x)),
          activities: status === "done" ? [makeActivity({ type: "task_completed", companyId: t.companyId, projectId: t.projectId, actorId: byUserId, actorRole: "consultant", text: `업무 완료: ${t.title}` }), ...st.activities] : st.activities,
        });
      },
      createTask: (data, byUserId) => {
        const st = get();
        const t: Task = { ...data, id: uid("tk"), createdAt: nowIso(), status: data.status ?? "todo", source: "manual" };
        set({ tasks: [t, ...st.tasks], activities: [makeActivity({ type: "task_created", companyId: t.companyId, projectId: t.projectId, actorId: byUserId, actorRole: "consultant", text: `업무 등록: ${t.title}` }), ...st.activities] });
      },
      createSchedule: (data, byUserId) => {
        const st = get();
        const s: Schedule = { ...data, id: uid("sc") };
        const notifs = data.visibleToClient && data.companyId ? [makeNotification({ audience: "client", companyId: data.companyId, title: "새 일정이 등록되었습니다", body: data.title, href: "/portal/schedule" })] : [];
        set({ schedules: [...st.schedules, s], activities: [makeActivity({ type: "schedule_created", companyId: data.companyId, projectId: data.projectId, actorId: byUserId, actorRole: "consultant", text: `일정 등록: ${data.title}` }), ...st.activities], notifications: [...notifs, ...st.notifications] });
      },
      shareResult: (data, byUserId) => {
        const st = get();
        const r: ResultFile = { ...data, id: uid("rs"), sharedAt: nowIso() };
        set({
          results: [r, ...st.results],
          activities: [makeActivity({ type: "result_shared", companyId: data.companyId, projectId: data.projectId, actorId: byUserId, actorRole: "consultant", text: `결과자료 공유: ${data.name}` }), ...st.activities],
          notifications: [makeNotification({ audience: "client", companyId: data.companyId, title: "결과자료가 공유되었습니다", body: `${data.name}을(를) 완료자료에서 확인하세요.`, href: "/portal/results" }), ...st.notifications],
        });
      },
      downloadResult: (resultId, byUserId) => {
        const st = get();
        const r = st.results.find((x) => x.id === resultId);
        if (!r) return;
        set({ activities: [makeActivity({ type: "result_downloaded", companyId: r.companyId, projectId: r.projectId, actorId: byUserId, actorRole: "client", text: `결과자료 열람: ${r.name}` }), ...st.activities] });
      },

      // ---------- OPPORTUNITY LOOP (고객 관심 → 내부 기회 → 대표 승인 → 추가계약) ----------
      raiseOpportunity: (data, byUserId, byRole) => {
        const st = get();
        const company = st.companies.find((c) => c.id === data.companyId);
        const svc = SERVICE_BY_KEY[data.serviceKey];
        if (!company || !svc) return;
        const now = nowIso();
        const fromClient = data.source === "portal_interest" || data.source === "portal_request";
        const assigneeId = company.consultantId;
        const opp: Opportunity = {
          id: uid("op"),
          companyId: data.companyId,
          serviceKey: data.serviceKey,
          serviceName: svc.name,
          source: data.source,
          status: "interest",
          assigneeId,
          createdAt: now,
          createdBy: byUserId,
          updatedAt: now,
          note: data.note,
          reason: data.reason,
          history: [{ at: now, status: "interest", by: byUserId }],
        };
        // 관심 표시는 그 자체로는 아무 일도 아니다 — 담당자에게 실제 업무가 생겨야 Loop가 닫힌다.
        const task: Task = {
          id: uid("tk"),
          companyId: data.companyId,
          title: `${company.name} ${svc.name} 관심 — 상담 연락`,
          type: "후속연락",
          dueDate: iso(addDays(new Date(), data.source === "portal_request" ? 1 : 2, 18)),
          assigneeId,
          status: "todo",
          priority: data.source === "portal_request" ? "urgent" : "normal",
          createdAt: now,
          source: "auto",
          memo: data.note,
        };
        set({
          opportunities: [opp, ...st.opportunities],
          tasks: [task, ...st.tasks],
          activities: [
            makeActivity({ type: "task_created", companyId: data.companyId, actorId: "system", actorRole: "system", text: `자동 생성: ${svc.name} 상담 연락 Task` }),
            makeActivity({ type: "opportunity_created", companyId: data.companyId, actorId: byUserId, actorRole: fromClient ? "client" : byRole, text: `${data.source === "portal_request" ? "고객 상담요청" : data.source === "portal_interest" ? "고객 관심표시" : "내부 등록"}: ${svc.name}`, meta: { serviceKey: data.serviceKey, source: data.source } }),
            ...st.activities,
          ],
          notifications: [
            makeNotification({ audience: "internal", companyId: data.companyId, title: `${data.source === "portal_request" ? "상담 요청" : "추가서비스 관심"}: ${company.name}`, body: `${svc.name}${data.note ? ` — ${data.note}` : ""}`, href: "/ax/opportunities" }),
            ...(fromClient ? [makeNotification({ audience: "client", companyId: data.companyId, title: "요청이 접수되었습니다", body: `${svc.name} 관련 문의가 담당 컨설턴트에게 전달되었습니다.`, href: "/portal/services" })] : []),
            ...st.notifications,
          ],
        });
      },

      advanceOpportunity: (id, status, byUserId, note) => {
        const st = get();
        const o = st.opportunities.find((x) => x.id === id);
        if (!o || o.status === status) return;
        const now = nowIso();
        const company = st.companies.find((c) => c.id === o.companyId);
        const updated: Opportunity = { ...o, status, updatedAt: now, history: [...o.history, { at: now, status, by: byUserId, note }] };
        // 고객에게는 "검토 중 / 제안 준비 중 / 진행 확정"만 전달한다 — 내부 승인 단계는 노출하지 않는다.
        const clientNotif =
          status === "contacted" || status === "won"
            ? [makeNotification({ audience: "client", companyId: o.companyId, title: status === "won" ? "추가 진행이 확정되었습니다" : "담당자가 확인했습니다", body: `${o.serviceName} — ${status === "won" ? "이어서 안내드리겠습니다." : "곧 연락드리겠습니다."}`, href: "/portal/services" })]
            : [];
        set({
          opportunities: st.opportunities.map((x) => (x.id === id ? updated : x)),
          activities: [makeActivity({ type: "opportunity_status_changed", companyId: o.companyId, actorId: byUserId, actorRole: "consultant", text: `매출기회 ${o.serviceName} (${company?.name ?? ""}): ${OPP_STATUS[o.status].label} → ${OPP_STATUS[status].label}`, meta: { from: o.status, to: status } }), ...st.activities],
          notifications: [...clientNotif, ...st.notifications],
        });
      },

      // ---------- 대표 승인 ----------
      requestApproval: (data, byUserId) => {
        const st = get();
        const now = nowIso();
        const ap: Approval = { ...data, id: uid("ap"), requestedBy: byUserId, requestedAt: now, status: "pending" };
        const company = st.companies.find((c) => c.id === data.companyId);
        const opportunities = data.opportunityId
          ? st.opportunities.map((o) => (o.id === data.opportunityId ? { ...o, status: "approval_pending" as OpportunityStatus, updatedAt: now, history: [...o.history, { at: now, status: "approval_pending" as OpportunityStatus, by: byUserId }] } : o))
          : st.opportunities;
        set({
          approvals: [ap, ...st.approvals],
          opportunities,
          activities: [makeActivity({ type: "approval_requested", companyId: data.companyId, projectId: data.projectId, actorId: byUserId, actorRole: "consultant", text: `대표 승인 요청: ${data.title}`, meta: { kind: data.kind, ...(data.discountPct ? { discountPct: data.discountPct } : {}) } }), ...st.activities],
          notifications: [makeNotification({ audience: "internal", companyId: data.companyId, title: "대표 승인 요청", body: `${company ? `${company.name} · ` : ""}${data.title}`, href: "/ax/opportunities?tab=approvals" }), ...st.notifications],
        });
      },

      decideApproval: (id, decision, byUserId, note) => {
        const st = get();
        const ap = st.approvals.find((x) => x.id === id);
        if (!ap || ap.status !== "pending") return;
        const now = nowIso();
        const company = st.companies.find((c) => c.id === ap.companyId);
        const updated: Approval = { ...ap, status: decision, decidedBy: byUserId, decidedAt: now, decisionNote: note };
        // 승인 결과는 기회 상태로 그대로 흘러간다 — 승인만 하고 멈추는 구조를 만들지 않는다.
        let opportunities = st.opportunities;
        const extraTasks: Task[] = [];
        if (ap.opportunityId) {
          const next: OpportunityStatus = decision === "approved" ? "proposed" : "dropped";
          opportunities = st.opportunities.map((o) => (o.id === ap.opportunityId ? { ...o, status: next, updatedAt: now, history: [...o.history, { at: now, status: next, by: byUserId, note }] } : o));
          const o = st.opportunities.find((x) => x.id === ap.opportunityId);
          if (decision === "approved" && o) {
            extraTasks.push({ id: uid("tk"), companyId: o.companyId, title: `${company?.name ?? ""} ${o.serviceName} 제안·견적 발송`, type: "내부작업", dueDate: iso(addDays(new Date(), 2, 18)), assigneeId: o.assigneeId, status: "todo", priority: "urgent", createdAt: now, source: "auto", memo: note });
          }
        }
        set({
          approvals: st.approvals.map((x) => (x.id === id ? updated : x)),
          opportunities,
          tasks: [...extraTasks, ...st.tasks],
          activities: [
            ...(extraTasks.length ? [makeActivity({ type: "task_created", companyId: ap.companyId, actorId: "system", actorRole: "system", text: `자동 생성: ${extraTasks[0].title}` })] : []),
            makeActivity({ type: "approval_decided", companyId: ap.companyId, projectId: ap.projectId, actorId: byUserId, actorRole: "admin", text: `대표 ${decision === "approved" ? "승인" : "반려"}: ${ap.title}${note ? ` — ${note}` : ""}`, meta: { kind: ap.kind, decision } }),
            ...st.activities,
          ],
          notifications: [makeNotification({ audience: "internal", companyId: ap.companyId, title: `대표 ${decision === "approved" ? "승인 완료" : "반려"}`, body: `${ap.title}${note ? ` — ${note}` : ""}`, href: "/ax/opportunities?tab=approvals" }), ...st.notifications],
        });
      },

      submitSurvey: (data) => {
        const st = get();
        const r: SurveyResponse = { ...data, id: uid("sv"), submittedAt: nowIso() };
        set({
          surveys: [r, ...st.surveys],
          activities: [makeActivity({ type: "survey_submitted", actorId: data.userId, actorRole: data.role, text: `AX 고도화 설문 제출 (${data.surveyVersion} · ${data.stage})`, meta: { answered: Object.keys(data.answers).length } }), ...st.activities],
        });
      },

      markNotificationRead: (id) => set({ notifications: get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }),
      markAllRead: (audience, companyId) => set({ notifications: get().notifications.map((n) => (n.audience === audience && (!companyId || n.companyId === companyId) ? { ...n, read: true } : n)) }),

      resetDemo: () => {
        const st = get();
        set({ ...buildSeed(), seededAt: nowIso(), session: st.session, settings: { ...st.settings }, toasts: [] });
      },
    }),
    {
      name: "kpjk-ax-demo-v1",
      storage: createJSONStorage(() => localStorage),
      // SSR safety: first client render must equal the server render (skeleton). ThemeBoot calls rehydrate() after mount.
      skipHydration: true,
      partialize: (s) => {
        const { hydrated: _h, toasts: _t, ...rest } = s;
        void _h;
        void _t;
        return rest as StoreState;
      },
      // NOTE: `initial` is the pre-hydration state whose actions close over set/get — safe to call
      // even while the store binding itself is still being created.
      onRehydrateStorage: (initial) => () => {
        initial.reseedIfStale();
        initial.setHydrated();
      },
    },
  ),
);

/* ---------- selectors / helpers ---------- */

export function useHydrated() {
  return useStore((s) => s.hydrated);
}

export function useSession() {
  return useStore((s) => s.session);
}

export function useCurrentUser() {
  const session = useStore((s) => s.session);
  const users = useStore((s) => s.users);
  return session ? users.find((u) => u.id === session.userId) ?? null : null;
}

/** The company a portal surface is showing: client's own company or the internal preview target. */
export function usePortalCompanyId() {
  const session = useStore((s) => s.session);
  if (!session) return undefined;
  if (session.role === "client") return session.companyId;
  return session.portalPreviewCompanyId;
}
