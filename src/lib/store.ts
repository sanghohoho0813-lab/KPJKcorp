"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { buildSeed, type SeedData } from "./demo/seed";
import type {
  Activity,
  ActivityType,
  DocumentRequest,
  InternalStage,
  Inquiry,
  Notification,
  ResultFile,
  Role,
  Schedule,
  Session,
  Settings,
  Task,
  TaskStatus,
} from "./types";
import { nowIso, uid, addDays, iso } from "./format";
import { stageLabel } from "./stages";

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
