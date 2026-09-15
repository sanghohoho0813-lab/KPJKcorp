"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { buildSeed, type SeedData } from "./demo/seed";
import type {
  OrgInfo,
  User,
  Company,
  Project,
  Activity,
  ActivityType,
  Approval,
  ApprovalKind,
  Baseline,
  Consultation,
  DocumentRequest,
  InternalStage,
  Inquiry,
  Notification,
  Opportunity,
  OpportunitySource,
  Quote,
  QuoteItem,
  QuoteStatus,
  Contract,
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
import { nowIso, uid, addDays, iso, daysBetween } from "./format";
import { stageLabel } from "./stages";
import { OPP_STATUS, SERVICE_BY_KEY } from "./services";
import { can, type Permission } from "./permissions";

export interface StoreState extends SeedData {
  hydrated: boolean;
  seededAt: string;
  session: Session | null;
  settings: Settings;
  toasts: { id: string; text: string; tone?: "success" | "error" | "info" }[];

  // session
  /** 자격증명 확인 후 로그인. 실패 사유를 그대로 돌려준다. */
  signIn: (loginId: string, passwordHash: string) => { ok: true } | { ok: false; reason: "no_user" | "bad_password" | "inactive" };
  logout: () => void;
  /** 현재 세션이 이 행동을 할 수 있는가. 화면과 액션이 같은 답을 쓴다. */
  may: (p: Permission) => boolean;
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

  // ---- 기업고객 / 프로젝트 등록·수정 ----
  createCompany: (data: Omit<Company, "id" | "code">, byUserId: string) => string | null;
  updateCompany: (id: string, patch: Partial<Omit<Company, "id" | "code">>, byUserId: string) => void;
  createProject: (data: Omit<Project, "id" | "stageChangedAt">, byUserId: string) => string | null;
  updateProject: (id: string, patch: Partial<Omit<Project, "id" | "companyId">>, byUserId: string) => void;

  // ---- 사용자 계정 ----
  createUser: (data: { name: string; email: string; role: Role; title: string; phone?: string; companyId?: string; passwordHash: string }, byUserId: string) => string | null;
  updateUser: (id: string, patch: Partial<Pick<User, "name" | "email" | "title" | "phone" | "companyId">>, byUserId: string) => void;
  setUserActive: (id: string, active: boolean, byUserId: string) => void;
  resetUserPassword: (id: string, passwordHash: string, byUserId: string) => void;

  // ---- 자료요청 수정 / 취소 (제출 전) ----
  updateDocRequest: (id: string, patch: { name?: string; description?: string; dueDate?: string }, byUserId: string) => void;
  cancelDocRequest: (id: string, byUserId: string) => void;

  // ---- 상담기록 수정 / 삭제 ----
  updateConsultation: (id: string, patch: Partial<Omit<Consultation, "id" | "companyId">>, byUserId: string) => void;
  deleteConsultation: (id: string, byUserId: string) => void;

  // ---- 견적 수정 (발송 전) / 계약 직접 등록·수정 / 결과자료 회수 ----
  updateQuote: (id: string, patch: Partial<Pick<Quote, "title" | "scope" | "period" | "items" | "discountPct" | "validUntil" | "projectId">>, byUserId: string) => void;
  createContract: (data: Omit<Contract, "id" | "source">, byUserId: string) => string | null;
  updateContract: (id: string, patch: Partial<Omit<Contract, "id" | "companyId" | "source">>, byUserId: string) => void;
  withdrawResult: (id: string, reason: string | undefined, byUserId: string) => void;

  // ---- 시간 규칙 (계약 만료·사후관리·미열람·유효기간) ----
  /** 규칙을 훑어 아직 없는 업무를 만든다. 멱등 — ruleKey 가 같으면 다시 만들지 않는다. 만든 개수를 돌려준다 */
  syncRuleTasks: () => number;
  setAutoRule: (key: string, enabled: boolean) => void;

  // ---- 실사용 안전장치 ----
  /** 운영 모드 — 자동 초기화 중지, 데모 안내 숨김, 데모 초기화 잠금 */
  setLiveMode: (on: boolean, byUserId: string) => void;
  /** 전체 데이터를 JSON 문자열로. 다른 PC로 옮기거나 실수 복구용 */
  exportBackup: (byUserId: string) => string | null;
  /** 백업 JSON을 읽어 전체를 교체. 모양이 다르면 아무것도 바꾸지 않고 사유를 돌려준다 */
  importBackup: (json: string, byUserId: string) => { ok: true; counts: Record<string, number> } | { ok: false; reason: string };
  setOrg: (org: OrgInfo, byUserId: string) => void;

  // ---- 보관 (하드 삭제 대신) ----
  archiveCompany: (id: string, archived: boolean, byUserId: string) => void;
  archiveProject: (id: string, archived: boolean, byUserId: string) => void;

  // ---- 일정 / 업무 수정·삭제 ----
  updateSchedule: (id: string, patch: Partial<Omit<Schedule, "id">>, byUserId: string) => void;
  deleteSchedule: (id: string, byUserId: string) => void;
  updateTask: (id: string, patch: Partial<Omit<Task, "id" | "createdAt">>, byUserId: string) => void;
  deleteTask: (id: string, byUserId: string) => void;
  createConsultation: (data: Omit<Consultation, "id">, byUserId: string, followUp?: { create: boolean; dueDate: string }) => void;
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
  requestApproval: (data: { kind: ApprovalKind; title: string; summary: string; companyId?: string; projectId?: string; opportunityId?: string; quoteId?: string; baseAmount?: number; discountPct?: number }, byUserId: string) => void;
  decideApproval: (id: string, decision: "approved" | "rejected", byUserId: string, note?: string) => void;
  submitSurvey: (data: Omit<SurveyResponse, "id" | "submittedAt">) => void;

  // AX 실증 (Evidence / Coach)
  startSprint: () => void;
  resetSprint: () => void;
  /** 도입 전 기준선 기록 — 전후 비교의 Before 쪽 */
  saveBaseline: (data: Baseline, byUserId: string) => void;
  /** 브리핑 추천을 실제로 실행했을 때 — "추천 후 실행" 건수의 근거가 된다. */
  logAiAction: (label: string, ctx: { companyId?: string; kind: string }, byUserId: string) => void;
  logEvidenceExport: (byUserId: string, rows: number) => void;

  // 견적 (상담 → 견적 → 계약)
  createQuote: (data: { companyId: string; projectId?: string; opportunityId?: string; title: string; scope: string; period: string; items: QuoteItem[]; discountPct: number; validUntil: string }, byUserId: string) => void;
  requestQuoteApproval: (quoteId: string, reason: string, byUserId: string) => void;
  sendQuote: (quoteId: string, byUserId: string) => void;
  respondQuote: (quoteId: string, decision: "accepted" | "declined", byUserId: string, note?: string) => void;
  convertQuote: (quoteId: string, byUserId: string) => void;

  markNotificationRead: (id: string) => void;
  markAllRead: (audience: "internal" | "client", companyId?: string) => void;
  logActivity: (a: Omit<Activity, "id" | "at">) => void;
  resetDemo: () => void;
  /** 샘플 기업 6개와 그에 딸린 모든 데이터를 지운다. 사용자가 직접 넣은 것은 건드리지 않는다. 운영 모드가 함께 켜진다 */
  removeSamples: (byUserId: string) => { ok: true; counts: { companies: number; projects: number; records: number } } | { ok: false; reason: string };
  /** 지운 샘플을 다시 넣는다. 이미 있는 것과 사용자가 넣은 것은 그대로 둔다 */
  restoreSamples: (byUserId: string) => { ok: true; counts: { companies: number; projects: number } } | { ok: false; reason: string };
}

const DEFAULT_SETTINGS: Settings = {
  theme: "kpjk",
  fontScale: "s",
  reduceMotion: false,
  tutorialDoneAx: false,
  tutorialDonePortal: false,
  timezone: "Asia/Seoul",
};

/** 견적 합계 (할인 전) */
export function quoteGross(q: Pick<Quote, "items">) {
  return q.items.reduce((sum, i) => sum + (Number.isFinite(i.amount) ? i.amount : 0), 0);
}
/** 견적 합계 (할인 적용) */
export function quoteNet(q: Pick<Quote, "items" | "discountPct">) {
  return Math.round(quoteGross(q) * (1 - (q.discountPct || 0) / 100));
}

/** 비어 있는 첫 코드 — A..Z, 다 차면 A2..Z2, A3… */
export function nextCompanyCode(used: string[]) {
  const taken = new Set(used);
  for (let round = 1; round < 50; round += 1) {
    for (let i = 0; i < 26; i += 1) {
      const code = round === 1 ? String.fromCharCode(65 + i) : `${String.fromCharCode(65 + i)}${round}`;
      if (!taken.has(code)) return code;
    }
  }
  return `X${used.length}`;
}

function makeActivity(a: Omit<Activity, "id" | "at">): Activity {
  return { ...a, id: uid("ac"), at: nowIso() };
}

/**
 * 권한 거절 — 막았다는 사실도 기록으로 남긴다.
 * 화면이 버튼을 숨겨도 액션은 따로 검사한다. 둘 중 하나만으로는
 * "권한이 실제로 적용된다"고 말할 수 없다.
 */
function deny(
  st: { session: Session | null; activities: Activity[] },
  p: Permission,
  what: string,
  set: (patch: { activities: Activity[]; toasts?: never }) => void,
): boolean {
  if (can(st.session?.role, p)) return false;
  set({
    activities: [
      makeActivity({
        type: "permission_denied",
        actorId: st.session?.userId ?? "unknown",
        actorRole: st.session?.role ?? "system",
        text: `권한 없음으로 거절: ${what}`,
        meta: { permission: p, role: st.session?.role ?? "none" },
      }),
      ...st.activities,
    ],
  });
  return true;
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
        // 운영 모드에서는 절대 초기화하지 않는다. 실제 데이터가 들어오기 시작하면 이 한 줄이 전부를 지킨다.
        if (get().settings.liveMode) return;
        const age = Date.now() - new Date(get().seededAt).getTime();
        if (age > 20 * 3600 * 1000) set({ ...buildSeed(), seededAt: nowIso(), session: get().session, settings: get().settings });
      },

      /**
       * 자격증명 확인 후 로그인.
       * 이전에는 userId만 넘기면 그 사람이 됐다. 이제 아이디와 비밀번호 해시가 모두 맞아야 하고,
       * 성공·실패가 전부 Activity로 남는다. (서버가 없다는 한계는 src/lib/auth.ts 주석 참고)
       */
      signIn: (loginId, passwordHash) => {
        const st = get();
        const key = loginId.trim().toLowerCase();
        const u = st.users.find((x) => x.email.toLowerCase() === key);
        const fail = (reason: "no_user" | "bad_password" | "inactive") => {
          set({
            activities: [makeActivity({ type: "sign_in_failed", actorId: u?.id ?? "unknown", actorRole: "system", text: `로그인 실패 (${loginId}) — ${reason}`, meta: { reason } }), ...st.activities],
          });
          return { ok: false as const, reason };
        };
        if (!u) return fail("no_user");
        if (u.active === false) return fail("inactive");
        if (!u.passwordHash || u.passwordHash !== passwordHash) return fail("bad_password");

        const now = nowIso();
        const session: Session = { userId: u.id, role: u.role, companyId: u.companyId, signedInAt: now };
        set({
          session,
          users: st.users.map((x) => (x.id === u.id ? { ...x, lastLoginAt: now } : x)),
          activities: [
            makeActivity({ type: "sign_in", companyId: u.companyId, actorId: u.id, actorRole: u.role, text: `로그인: ${u.name} ${u.title}` }),
            ...(u.role === "client" ? [makeActivity({ type: "portal_login", companyId: u.companyId, actorId: u.id, actorRole: "client", text: "고객 Portal 접속" })] : []),
            ...st.activities,
          ],
        });
        return { ok: true as const };
      },
      logout: () => {
        const st = get();
        const u = st.users.find((x) => x.id === st.session?.userId);
        set({
          session: null,
          activities: u ? [makeActivity({ type: "sign_out", actorId: u.id, actorRole: u.role, text: `로그아웃: ${u.name}` }), ...st.activities] : st.activities,
        });
      },
      may: (p) => can(get().session?.role, p),
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
        // 자료 제출은 고객의 행동이다 — 내부 계정이 대신 올리면 "고객이 직접 제출했다"는 실증이 거짓이 된다.
        if (deny(st, "doc.submit", `자료 제출 (${req.name})`, set)) return;
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
        if (deny(st, "doc.review", `자료 검토 (${req.name})`, set)) return;
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
        if (deny(st, "project.update", `단계 변경 (${p.name})`, set)) return;
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
        if (deny(st, "doc.request", `자료 요청 (${data.name})`, set)) return;
        const req: DocumentRequest = { id: uid("dr"), projectId, companyId: p.companyId, name: data.name, description: data.description, requestedAt: nowIso(), dueDate: data.dueDate, status: "requested", assigneeId: p.consultantId, files: [] };
        set({
          docRequests: [req, ...st.docRequests],
          activities: [makeActivity({ type: "document_requested", companyId: p.companyId, projectId, actorId: byUserId, actorRole: "consultant", text: `자료 요청: ${data.name}` }), ...st.activities],
          notifications: [makeNotification({ audience: "client", companyId: p.companyId, title: "새 자료 요청이 등록되었습니다", body: `${data.name} — 요청자료에서 확인 후 제출해 주세요.`, href: "/portal/documents" }), ...st.notifications],
        });
      },

      // ---------- 기업고객 / 프로젝트 등록 · 수정 ----------
      // 모든 쓰기 액션은 deny()를 먼저 통과한다. 화면에서 버튼을 숨기는 것만으로는
      // "권한이 적용된다"고 말할 수 없다 — 액션 자체가 거절해야 한다.
      createCompany: (data, byUserId) => {
        const st = get();
        if (deny(st, "company.create", `기업고객 등록 (${data.name})`, set)) return null;
        const id = uid("co");
        // 코드(A, B, C…)는 비어 있는 첫 글자. 샘플을 지웠다 되살려도 겹치지 않도록 "몇 번째"가 아니라 "안 쓰인 글자"를 고른다.
        const company: Company = { ...data, id, code: nextCompanyCode(st.companies.map((c) => c.code)), sample: undefined };
        set({
          companies: [...st.companies, company],
          activities: [makeActivity({ type: "company_created", companyId: id, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `기업고객 등록: ${company.name}` }), ...st.activities],
        });
        return id;
      },

      updateCompany: (id, patch, byUserId) => {
        const st = get();
        const before = st.companies.find((c) => c.id === id);
        if (!before) return;
        if (deny(st, "company.update", `기업고객 수정 (${before.name})`, set)) return;
        const changed = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => patch[k] !== undefined && JSON.stringify(patch[k]) !== JSON.stringify(before[k]));
        if (changed.length === 0) return;
        const LABEL: Record<string, string> = { name: "기업명", ceo: "대표자", industry: "업종", bizNo: "사업자번호", contactName: "담당자", contactTitle: "직책", contactPhone: "연락처", contactEmail: "이메일", address: "주소", employees: "임직원", revenue: "매출", consultantId: "담당 컨설턴트", memo: "메모", firstConsultDate: "최초 상담일", entityType: "사업자 형태", corpNo: "법인등록번호", establishedAt: "설립일", bizCategory: "업태", bizItem: "종목", ceoBirth: "대표자 생년월일", capital: "자본금", region: "지역", employeeBand: "임직원 규모", revenueBand: "매출 규모", companyPhone: "대표번호", website: "홈페이지", interests: "관심 분야", leadSource: "유입 경로", docs: "서류 확인" };
        set({
          companies: st.companies.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          activities: [makeActivity({ type: "company_updated", companyId: id, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `기업정보 수정: ${before.name} — ${changed.map((k) => LABEL[k] ?? k).join(", ")}`, meta: { fields: changed.join(",") } }), ...st.activities],
        });
      },

      createProject: (data, byUserId) => {
        const st = get();
        const company = st.companies.find((c) => c.id === data.companyId);
        if (!company) return null;
        if (deny(st, "project.create", `프로젝트 등록 (${data.name})`, set)) return null;
        const now = nowIso();
        const project: Project = { ...data, id: uid("pj"), stageChangedAt: now };
        set({
          projects: [...st.projects, project],
          activities: [makeActivity({ type: "project_created", companyId: data.companyId, projectId: project.id, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `프로젝트 등록: ${company.name} — ${project.name}` }), ...st.activities],
          notifications: data.clientVisible
            ? [makeNotification({ audience: "client", companyId: data.companyId, title: "새 프로젝트가 시작되었습니다", body: `${project.name} 진행 상황을 Portal에서 확인하실 수 있습니다.`, href: "/portal/projects" }), ...st.notifications]
            : st.notifications,
        });
        return project.id;
      },

      updateProject: (id, patch, byUserId) => {
        const st = get();
        const before = st.projects.find((p) => p.id === id);
        if (!before) return;
        if (deny(st, "project.update", `프로젝트 수정 (${before.name})`, set)) return;
        // 단계 변경은 고객 Portal 진행률·알림까지 움직이므로 전용 액션이 처리한다.
        const { stage, ...rest } = patch;
        const changed = (Object.keys(rest) as (keyof typeof rest)[]).filter((k) => {
          if (k === "nextMilestone") return JSON.stringify(rest[k] ?? null) !== JSON.stringify(before[k] ?? null);
          return rest[k] !== undefined && rest[k] !== before[k];
        });
        if (stage && stage !== before.stage) get().changeProjectStage(id, stage, byUserId);
        if (changed.length === 0) return;
        const LABEL: Record<string, string> = { name: "프로젝트명", type: "유형", consultantId: "담당 컨설턴트", startDate: "시작일", dueDate: "마감일", description: "설명", clientVisible: "고객 공개", nextMilestone: "다음 예정" };
        const milestoneChanged = changed.includes("nextMilestone") && rest.nextMilestone;
        const after = get();
        set({
          projects: after.projects.map((p) => (p.id === id ? { ...p, ...rest } : p)),
          activities: [makeActivity({ type: "project_updated", companyId: before.companyId, projectId: id, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `프로젝트 수정: ${before.name} — ${changed.map((k) => LABEL[k] ?? k).join(", ")}`, meta: { fields: changed.join(",") } }), ...after.activities],
          // 고객에게 보이는 예정일이 바뀌면 고객도 알아야 한다.
          notifications: milestoneChanged && before.clientVisible
            ? [makeNotification({ audience: "client", companyId: before.companyId, title: "다음 예정이 안내되었습니다", body: `${before.name}: ${rest.nextMilestone!.label} — ${rest.nextMilestone!.date.slice(0, 10)}`, href: "/portal/projects" }), ...after.notifications]
            : after.notifications,
        });
      },

      // ---------- 사용자 계정 ----------
      createUser: (data, byUserId) => {
        const st = get();
        if (deny(st, "user.manage", `계정 생성 (${data.email})`, set)) return null;
        const email = data.email.trim().toLowerCase();
        // 아이디 = 이메일이므로 중복이 있으면 로그인 자체가 모호해진다.
        if (st.users.some((u) => u.email.toLowerCase() === email)) return null;
        const id = uid(data.role === "client" ? "c" : "u");
        const user: User = {
          id, name: data.name.trim(), email, role: data.role, title: data.title.trim(),
          phone: data.phone?.trim() || undefined,
          companyId: data.role === "client" ? data.companyId : undefined,
          passwordHash: data.passwordHash, active: true,
        };
        set({
          users: [...st.users, user],
          activities: [makeActivity({ type: "user_created", companyId: user.companyId, actorId: byUserId, actorRole: st.session?.role ?? "admin", text: `계정 생성: ${user.name} (${user.email}) · ${user.role === "admin" ? "대표" : user.role === "consultant" ? "컨설턴트" : "기업고객"}` }), ...st.activities],
        });
        return id;
      },

      updateUser: (id, patch, byUserId) => {
        const st = get();
        const before = st.users.find((u) => u.id === id);
        if (!before) return;
        if (deny(st, "user.manage", `계정 수정 (${before.email})`, set)) return;
        const next = { ...patch };
        if (next.email) {
          const email = next.email.trim().toLowerCase();
          if (st.users.some((u) => u.id !== id && u.email.toLowerCase() === email)) return;
          next.email = email;
        }
        const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => next[k] !== undefined && next[k] !== before[k]);
        if (changed.length === 0) return;
        const LABEL: Record<string, string> = { name: "이름", email: "아이디", title: "직책", phone: "연락처", companyId: "소속 기업" };
        set({
          users: st.users.map((u) => (u.id === id ? { ...u, ...next } : u)),
          activities: [makeActivity({ type: "user_updated", companyId: before.companyId, actorId: byUserId, actorRole: st.session?.role ?? "admin", text: `계정 수정: ${before.name} — ${changed.map((k) => LABEL[k] ?? k).join(", ")}`, meta: { fields: changed.join(",") } }), ...st.activities],
        });
      },

      setUserActive: (id, active, byUserId) => {
        const st = get();
        const u = st.users.find((x) => x.id === id);
        if (!u) return;
        if (deny(st, "user.manage", `계정 ${active ? "사용 재개" : "사용 중지"} (${u.email})`, set)) return;
        // 자기 자신을 잠그면 아무도 계정을 되살릴 수 없게 된다.
        if (!active && u.id === st.session?.userId) return;
        // 마지막 남은 대표 계정을 잠그는 것도 같은 이유로 막는다.
        if (!active && u.role === "admin" && st.users.filter((x) => x.role === "admin" && x.active !== false).length <= 1) return;
        set({
          users: st.users.map((x) => (x.id === id ? { ...x, active } : x)),
          activities: [makeActivity({ type: "user_deactivated", companyId: u.companyId, actorId: byUserId, actorRole: st.session?.role ?? "admin", text: `계정 ${active ? "사용 재개" : "사용 중지"}: ${u.name} (${u.email})` }), ...st.activities],
        });
      },

      resetUserPassword: (id, passwordHash, byUserId) => {
        const st = get();
        const u = st.users.find((x) => x.id === id);
        if (!u) return;
        if (deny(st, "user.manage", `비밀번호 재설정 (${u.email})`, set)) return;
        set({
          users: st.users.map((x) => (x.id === id ? { ...x, passwordHash } : x)),
          // 비밀번호 값 자체는 기록하지 않는다. 누가 언제 재설정했는지만 남긴다.
          activities: [makeActivity({ type: "password_reset", companyId: u.companyId, actorId: byUserId, actorRole: st.session?.role ?? "admin", text: `비밀번호 재설정: ${u.name} (${u.email})` }), ...st.activities],
        });
      },

      // ---------- 자료요청 수정 · 취소 ----------
      updateDocRequest: (id, patch, byUserId) => {
        const st = get();
        const before = st.docRequests.find((r) => r.id === id);
        if (!before) return;
        if (deny(st, "doc.update", `자료요청 수정 (${before.name})`, set)) return;
        // 제출 이후에는 고칠 수 없다 — 고객이 낸 것과 요청 내용이 어긋나면 기록이 의미를 잃는다.
        if (!["planned", "requested", "revision"].includes(before.status)) return;
        const changed = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => patch[k] !== undefined && patch[k] !== before[k]);
        if (changed.length === 0) return;
        const LABEL: Record<string, string> = { name: "자료명", description: "설명", dueDate: "제출기한" };
        const dueMoved = patch.dueDate !== undefined && patch.dueDate !== before.dueDate;
        set({
          docRequests: st.docRequests.map((r) => (r.id === id ? { ...r, ...patch } : r)),
          activities: [makeActivity({ type: "doc_request_updated", companyId: before.companyId, projectId: before.projectId, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `자료요청 수정: ${patch.name ?? before.name} — ${changed.map((k) => LABEL[k] ?? k).join(", ")}`, meta: { fields: changed.join(",") } }), ...st.activities],
          notifications: [makeNotification({ audience: "client", companyId: before.companyId, title: dueMoved ? "자료 제출기한이 변경되었습니다" : "요청자료 내용이 변경되었습니다", body: `${patch.name ?? before.name} — 요청자료에서 확인해 주세요.`, href: "/portal/documents" }), ...st.notifications],
        });
      },

      cancelDocRequest: (id, byUserId) => {
        const st = get();
        const req = st.docRequests.find((r) => r.id === id);
        if (!req) return;
        if (deny(st, "doc.update", `자료요청 취소 (${req.name})`, set)) return;
        if (!["planned", "requested", "revision"].includes(req.status)) return;
        set({
          docRequests: st.docRequests.filter((r) => r.id !== id),
          // 요청에 딸려 자동 생성된 검토 업무도 같이 정리한다.
          tasks: st.tasks.filter((t) => !(t.source === "auto" && t.projectId === req.projectId && t.title.includes(req.name))),
          activities: [makeActivity({ type: "doc_request_canceled", companyId: req.companyId, projectId: req.projectId, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `자료요청 취소: ${req.name}` }), ...st.activities],
          notifications: [makeNotification({ audience: "client", companyId: req.companyId, title: "자료 요청이 취소되었습니다", body: `${req.name} 요청이 취소되었습니다. 제출하지 않으셔도 됩니다.`, href: "/portal/documents" }), ...st.notifications],
        });
      },

      // ---------- 상담기록 수정 · 삭제 ----------
      updateConsultation: (id, patch, byUserId) => {
        const st = get();
        const before = st.consultations.find((c) => c.id === id);
        if (!before) return;
        if (deny(st, "consultation.update", "상담기록 수정", set)) return;
        const company = st.companies.find((c) => c.id === before.companyId);
        set({
          consultations: st.consultations.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          activities: [makeActivity({ type: "consultation_updated", companyId: before.companyId, projectId: before.projectId, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `상담기록 수정: ${before.type}${company ? ` — ${company.name}` : ""}`, meta: { consultationId: id } }), ...st.activities],
        });
      },

      deleteConsultation: (id, byUserId) => {
        const st = get();
        const target = st.consultations.find((c) => c.id === id);
        if (!target) return;
        if (deny(st, "consultation.update", "상담기록 삭제", set)) return;
        const company = st.companies.find((c) => c.id === target.companyId);
        set({
          consultations: st.consultations.filter((c) => c.id !== id),
          activities: [makeActivity({ type: "consultation_deleted", companyId: target.companyId, projectId: target.projectId, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `상담기록 삭제: ${target.type}${company ? ` — ${company.name}` : ""}` }), ...st.activities],
        });
      },

      // ---------- 견적 수정 (발송 전) ----------
      updateQuote: (id, patch, byUserId) => {
        const st = get();
        const before = st.quotes.find((q) => q.id === id);
        if (!before) return;
        if (deny(st, "quote.update", `견적 수정 (${before.title})`, set)) return;
        // 발송된 견적은 고객이 이미 본 금액이다 — 고치려면 새 견적으로 재발송한다.
        if (before.status !== "draft" && before.status !== "approval_pending") return;
        const next: Quote = { ...before, ...patch };
        // 할인율이 바뀌면 이전 승인은 무효다. 승인은 특정 할인율에 대한 것이다.
        const discountChanged = patch.discountPct !== undefined && patch.discountPct !== before.discountPct;
        if (discountChanged) { next.approvalId = undefined; if (next.status === "approval_pending") next.status = "draft"; }
        const LABEL: Record<string, string> = { title: "견적명", scope: "범위", period: "기간", items: "항목", discountPct: "할인율", validUntil: "유효기간", projectId: "프로젝트" };
        const changed = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => patch[k] !== undefined && JSON.stringify(patch[k]) !== JSON.stringify(before[k]));
        if (changed.length === 0) return;
        set({
          quotes: st.quotes.map((q) => (q.id === id ? next : q)),
          // 승인 대기 중이던 건의 할인율이 바뀌면 그 승인 요청은 더 이상 유효하지 않다.
          approvals: discountChanged && before.approvalId ? st.approvals.map((a) => (a.id === before.approvalId && a.status === "pending" ? { ...a, status: "rejected" as const, decidedAt: nowIso(), decisionNote: "견적 할인율 변경으로 자동 철회" } : a)) : st.approvals,
          activities: [makeActivity({ type: "quote_updated", companyId: before.companyId, projectId: before.projectId, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `견적 수정: ${next.title} — ${changed.map((k) => LABEL[k] ?? k).join(", ")}${discountChanged && before.approvalId ? " (기존 승인 무효)" : ""}`, meta: { fields: changed.join(","), amount: quoteNet(next) } }), ...st.activities],
        });
      },

      // ---------- 계약 직접 등록 · 수정 ----------
      createContract: (data, byUserId) => {
        const st = get();
        const company = st.companies.find((c) => c.id === data.companyId);
        if (!company) return null;
        if (deny(st, "contract.manage", `계약 등록 (${data.title})`, set)) return null;
        const ct: Contract = { ...data, id: uid("ct"), source: "manual" };
        set({
          contracts: [ct, ...st.contracts],
          activities: [makeActivity({ type: "contract_created", companyId: ct.companyId, projectId: ct.projectId, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `계약 등록: ${ct.title} (${company.name})`, meta: { amount: ct.amount ?? 0, status: ct.status } }), ...st.activities],
        });
        return ct.id;
      },

      updateContract: (id, patch, byUserId) => {
        const st = get();
        const before = st.contracts.find((c) => c.id === id);
        if (!before) return;
        if (deny(st, "contract.manage", `계약 수정 (${before.title})`, set)) return;
        const changed = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => patch[k] !== undefined && patch[k] !== before[k]);
        if (changed.length === 0) return;
        const LABEL: Record<string, string> = { title: "계약명", status: "상태", period: "기간", scope: "범위", endDate: "종료일", amount: "금액", projectId: "프로젝트", sentAt: "송부일", signedAt: "서명일" };
        const next = { ...before, ...patch };
        const signedNow = patch.status === "signed" && before.status !== "signed";
        if (signedNow && !next.signedAt) next.signedAt = nowIso();
        set({
          contracts: st.contracts.map((c) => (c.id === id ? next : c)),
          activities: [
            ...(signedNow ? [makeActivity({ type: "contract_signed", companyId: before.companyId, projectId: before.projectId, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `계약 서명: ${next.title}` })] : []),
            makeActivity({ type: "contract_updated", companyId: before.companyId, projectId: before.projectId, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `계약 수정: ${next.title} — ${changed.map((k) => LABEL[k] ?? k).join(", ")}`, meta: { fields: changed.join(",") } }),
            ...st.activities,
          ],
        });
      },

      // ---------- 결과자료 회수 ----------
      withdrawResult: (id, reason, byUserId) => {
        const st = get();
        const r = st.results.find((x) => x.id === id);
        if (!r) return;
        if (deny(st, "result.withdraw", `결과자료 회수 (${r.name})`, set)) return;
        set({
          results: st.results.filter((x) => x.id !== id),
          activities: [makeActivity({ type: "result_withdrawn", companyId: r.companyId, projectId: r.projectId, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `결과자료 회수: ${r.name}${reason ? ` — ${reason}` : ""}` }), ...st.activities],
          notifications: [makeNotification({ audience: "client", companyId: r.companyId, title: "결과자료가 회수되었습니다", body: `${r.name}이(가) 내려졌습니다.${reason ? ` 사유: ${reason}` : ""} 수정본이 준비되면 다시 안내드립니다.`, href: "/portal/results" }), ...st.notifications],
        });
      },

      // ---------- 시간 규칙 ----------
      // 사건이 아니라 "시간이 흘러서" 생기는 일들은 누가 눌러주지 않으면 아무도 모른다.
      // 앱을 열 때와 10분마다 훑어서 아직 없는 업무를 만든다. ruleKey 로 멱등을 보장한다.
      syncRuleTasks: () => {
        const st = get();
        const on = (k: string) => st.settings.autoRules?.[k] !== false;
        const has = (key: string) => st.tasks.some((t) => t.ruleKey === key);
        const now = new Date();
        const nowIsoStr = now.toISOString();
        const made: Task[] = [];
        const acts: Activity[] = [];
        const liveCompany = (id?: string) => { const c = st.companies.find((x) => x.id === id); return c && !c.archived ? c : undefined; };
        const liveProject = (id?: string) => { const p = st.projects.find((x) => x.id === id); return p && !p.archived ? p : undefined; };
        const push = (t: Omit<Task, "id" | "createdAt" | "status" | "source">, ruleLabel: string) => {
          const task: Task = { ...t, id: uid("tk"), createdAt: nowIsoStr, status: "todo", source: "auto" };
          made.push(task);
          acts.push(makeActivity({ type: "rule_task_created", companyId: t.companyId, projectId: t.projectId, actorId: "system", actorRole: "system", text: `규칙 생성 (${ruleLabel}): ${t.title}`, meta: { ruleKey: t.ruleKey ?? "" } }));
        };

        // 1) 계약 만료 30일 전 → 갱신 협의
        if (on("contract_renewal")) {
          for (const ct of st.contracts) {
            if (ct.status !== "signed" || !ct.endDate) continue;
            const c = liveCompany(ct.companyId); if (!c) continue;
            const d = daysBetween(nowIsoStr, ct.endDate);
            if (d < 0 || d > 30) continue;
            const key = `contract_renewal:${ct.id}`;
            if (has(key)) continue;
            push({ companyId: ct.companyId, projectId: ct.projectId, title: `${c.name} 계약 만료 D-${d} — 갱신 협의`, type: "후속연락", dueDate: iso(addDays(now, Math.max(1, Math.min(7, d - 7)), 18)), assigneeId: c.consultantId, priority: d <= 14 ? "urgent" : "normal", ruleKey: key, memo: `계약 종료일 ${ct.endDate.slice(0, 10)}. 갱신 여부와 조건을 미리 확인합니다.` }, "계약 만료 30일 전");
          }
        }
        // 2) 사후관리 90일 경과 → 종료 점검
        if (on("aftercare_review")) {
          for (const p of st.projects) {
            if (p.stage !== "aftercare" || p.archived) continue;
            const c = liveCompany(p.companyId); if (!c) continue;
            const d = daysBetween(p.stageChangedAt, nowIsoStr);
            if (d < 90) continue;
            const key = `aftercare_review:${p.id}`;
            if (has(key)) continue;
            push({ companyId: p.companyId, projectId: p.id, title: `${c.name} ${p.name} 사후관리 ${d}일 — 종료 점검`, type: "후속연락", dueDate: iso(addDays(now, 5, 18)), assigneeId: p.consultantId, priority: "normal", ruleKey: key, memo: "사후관리를 마무리할지, 추가 컨설팅으로 이을지 대표와 정리합니다." }, "사후관리 90일 경과");
          }
        }
        // 3) 결과자료 공유 후 7일 미열람 → 확인 안내
        if (on("result_unread")) {
          for (const r of st.results) {
            const c = liveCompany(r.companyId); if (!c) continue;
            if (daysBetween(r.sharedAt, nowIsoStr) < 7) continue;
            const viewed = st.activities.some((a) => a.type === "result_downloaded" && a.companyId === r.companyId && a.text.includes(r.name) && a.at >= r.sharedAt);
            if (viewed) continue;
            const key = `result_unread:${r.id}`;
            if (has(key)) continue;
            push({ companyId: r.companyId, projectId: r.projectId, title: `${c.name} 결과자료 미열람 7일 — 확인 안내`, type: "후속연락", dueDate: iso(addDays(now, 2, 18)), assigneeId: c.consultantId, priority: "normal", ruleKey: key, memo: `${r.name}을(를) 고객이 아직 열지 않았습니다. 전달됐는지 확인합니다.` }, "결과자료 7일 미열람");
          }
        }
        // 4) 발송 견적 유효기간 D-3 무회신 → 연장 협의
        if (on("quote_expiring")) {
          for (const q of st.quotes) {
            if (q.status !== "sent") continue;
            const c = liveCompany(q.companyId); if (!c) continue;
            const d = daysBetween(nowIsoStr, q.validUntil);
            if (d < 0 || d > 3) continue;
            const key = `quote_expiring:${q.id}`;
            if (has(key)) continue;
            push({ companyId: q.companyId, projectId: q.projectId, title: `${c.name} 견적 유효기간 D-${d} — 회신·연장 확인`, type: "후속연락", dueDate: iso(addDays(now, 1, 18)), assigneeId: c.consultantId, priority: "urgent", ruleKey: key, memo: `${q.title} 유효기간 ${q.validUntil.slice(0, 10)}. 회신을 받거나 기간을 연장합니다.` }, "견적 유효기간 D-3");
          }
        }
        // 5) 자료 미제출 기한 초과 3일 → 독촉 (브리핑엔 있지만 업무함엔 없던 것)
        if (on("doc_overdue_followup")) {
          for (const d of st.docRequests) {
            if (d.status !== "requested" && d.status !== "revision") continue;
            const c = liveCompany(d.companyId); if (!c || !liveProject(d.projectId)) continue;
            const over = daysBetween(d.dueDate, nowIsoStr);
            if (over < 3) continue;
            const key = `doc_overdue_followup:${d.id}`;
            if (has(key)) continue;
            push({ companyId: d.companyId, projectId: d.projectId, title: `${c.name} ${d.name} 기한 ${over}일 초과 — 독촉`, type: "후속연락", dueDate: iso(addDays(now, 1, 18)), assigneeId: d.assigneeId, priority: "urgent", ruleKey: key, memo: "미제출 사유를 확인하고 필요하면 기한을 조정합니다." }, "자료 기한 3일 초과");
          }
        }

        if (made.length === 0) return 0;
        set({ tasks: [...made, ...st.tasks], activities: [...acts, ...st.activities] });
        return made.length;
      },

      setAutoRule: (key, enabled) => {
        const st = get();
        if (deny(st, "rules.manage", `자동 업무 규칙 ${enabled ? "켜기" : "끄기"} (${key})`, set)) return;
        set({ settings: { ...st.settings, autoRules: { ...(st.settings.autoRules ?? {}), [key]: enabled } } });
      },

      // ---------- 실사용 안전장치 ----------
      setLiveMode: (on, byUserId) => {
        const st = get();
        if (deny(st, "data.manage", `운영 모드 ${on ? "켜기" : "끄기"}`, set)) return;
        if (!!st.settings.liveMode === on) return;
        set({
          settings: { ...st.settings, liveMode: on },
          activities: [makeActivity({ type: "live_mode_changed", actorId: byUserId, actorRole: st.session?.role ?? "admin", text: on ? "운영 모드 켬 — 자동 초기화 중지, 데모 초기화 잠금" : "운영 모드 끔 — 데모 동작으로 복귀", meta: { on: String(on) } }), ...st.activities],
        });
      },

      exportBackup: (byUserId) => {
        const st = get();
        if (deny(st, "data.manage", "백업 내보내기", set)) return null;
        const now = nowIso();
        const keys: (keyof SeedData)[] = ["users", "companies", "consultations", "contracts", "projects", "docRequests", "schedules", "tasks", "inquiries", "results", "opportunities", "quotes", "approvals", "surveys", "activities", "notifications"];
        const data: Record<string, unknown> = {};
        for (const k of keys) data[k] = st[k];
        const payload = {
          format: "kpjk-ax-backup",
          version: 1,
          exportedAt: now,
          exportedBy: byUserId,
          liveMode: !!st.settings.liveMode,
          settings: { ...st.settings, lastBackupAt: now },
          seededAt: st.seededAt,
          data,
        };
        set({
          settings: { ...st.settings, lastBackupAt: now },
          activities: [makeActivity({ type: "backup_exported", actorId: byUserId, actorRole: st.session?.role ?? "admin", text: `백업 내보내기 (기업 ${st.companies.length} · 프로젝트 ${st.projects.length} · 기록 ${st.activities.length}건)` }), ...st.activities],
        });
        return JSON.stringify(payload, null, 0);
      },

      importBackup: (json, byUserId) => {
        const st = get();
        if (deny(st, "data.manage", "백업 가져오기", set)) return { ok: false, reason: "권한이 없습니다." };
        let parsed: { format?: string; version?: number; data?: Record<string, unknown>; settings?: Partial<Settings>; seededAt?: string; exportedAt?: string };
        try { parsed = JSON.parse(json); } catch { return { ok: false, reason: "JSON 파일이 아닙니다." }; }
        if (parsed?.format !== "kpjk-ax-backup" || !parsed.data) return { ok: false, reason: "이 시스템의 백업 파일이 아닙니다." };
        const keys: (keyof SeedData)[] = ["users", "companies", "consultations", "contracts", "projects", "docRequests", "schedules", "tasks", "inquiries", "results", "opportunities", "quotes", "approvals", "surveys", "activities", "notifications"];
        const next: Partial<SeedData> = {};
        const counts: Record<string, number> = {};
        for (const k of keys) {
          const v = parsed.data[k];
          if (!Array.isArray(v)) return { ok: false, reason: `백업에 ${k} 목록이 없습니다.` };
          (next as Record<string, unknown>)[k] = v;
          counts[k] = v.length;
        }
        const users = next.users as User[];
        if (!users.some((u) => u.role === "admin" && u.active !== false)) return { ok: false, reason: "사용 가능한 대표 계정이 없는 백업은 가져올 수 없습니다. 아무도 로그인할 수 없게 됩니다." };
        // 지금 로그인한 계정이 백업 안에도 있으면 세션을 유지하고, 없으면 다시 로그인하게 한다.
        const keepSession = st.session && users.some((u) => u.id === st.session!.userId && u.active !== false);
        const importedSettings: Settings = { ...st.settings, ...(parsed.settings ?? {}), liveMode: true, lastBackupAt: st.settings.lastBackupAt };
        set({
          ...(next as SeedData),
          seededAt: parsed.seededAt ?? st.seededAt,
          session: keepSession ? st.session : null,
          settings: importedSettings,
          activities: [
            makeActivity({ type: "backup_imported", actorId: byUserId, actorRole: st.session?.role ?? "admin", text: `백업 가져오기 (${parsed.exportedAt ? parsed.exportedAt.slice(0, 16).replace("T", " ") : "시각 미상"} 내보낸 파일 · 기업 ${counts.companies} · 프로젝트 ${counts.projects} · 기록 ${counts.activities}건)` }),
            ...(next.activities as Activity[]),
          ],
        });
        return { ok: true, counts };
      },

      setOrg: (org, byUserId) => {
        const st = get();
        if (deny(st, "data.manage", "회사 정보 수정", set)) return;
        set({
          settings: { ...st.settings, org: { ...org, name: org.name.trim() } },
          activities: [makeActivity({ type: "org_updated", actorId: byUserId, actorRole: st.session?.role ?? "admin", text: `인쇄용 회사 정보 수정: ${org.name.trim()}` }), ...st.activities],
        });
      },

      // ---------- 보관 ----------
      // 기업·프로젝트는 지우지 않고 보관한다. 지우면 그 아래 자료·상담·계약·활동로그가
      // 전부 고아가 되고, 실증 데이터의 근거도 함께 사라진다.
      archiveCompany: (id, archived, byUserId) => {
        const st = get();
        const c = st.companies.find((x) => x.id === id);
        if (!c) return;
        if (deny(st, "company.archive", `기업 ${archived ? "보관" : "보관 해제"} (${c.name})`, set)) return;
        const now = nowIso();
        set({
          companies: st.companies.map((x) => (x.id === id ? { ...x, archived, archivedAt: archived ? now : undefined } : x)),
          // 기업을 보관하면 그 기업의 진행 중 프로젝트도 함께 보관한다.
          projects: archived ? st.projects.map((p) => (p.companyId === id ? { ...p, archived: true, archivedAt: now } : p)) : st.projects,
          activities: [makeActivity({ type: "company_archived", companyId: id, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `기업 ${archived ? "보관" : "보관 해제"}: ${c.name}` }), ...st.activities],
        });
      },

      archiveProject: (id, archived, byUserId) => {
        const st = get();
        const p = st.projects.find((x) => x.id === id);
        if (!p) return;
        if (deny(st, "project.archive", `프로젝트 ${archived ? "보관" : "보관 해제"} (${p.name})`, set)) return;
        const now = nowIso();
        set({
          projects: st.projects.map((x) => (x.id === id ? { ...x, archived, archivedAt: archived ? now : undefined } : x)),
          activities: [makeActivity({ type: "project_archived", companyId: p.companyId, projectId: id, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `프로젝트 ${archived ? "보관" : "보관 해제"}: ${p.name}` }), ...st.activities],
        });
      },

      // ---------- 일정 · 업무 수정 · 삭제 ----------
      updateSchedule: (id, patch, byUserId) => {
        const st = get();
        const before = st.schedules.find((x) => x.id === id);
        if (!before) return;
        if (deny(st, "schedule.update", `일정 수정 (${before.title})`, set)) return;
        const changed = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => patch[k] !== undefined && patch[k] !== before[k]);
        if (changed.length === 0) return;
        const after: Schedule = { ...before, ...patch };
        // 고객에게 공개된 일정의 시간이 바뀌면 고객도 알아야 한다.
        const timeMoved = patch.start !== undefined && patch.start !== before.start;
        set({
          schedules: st.schedules.map((x) => (x.id === id ? after : x)),
          activities: [makeActivity({ type: "schedule_updated", companyId: before.companyId, projectId: before.projectId, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `일정 수정: ${after.title}${timeMoved ? " (시간 변경)" : ""}`, meta: { fields: changed.join(",") } }), ...st.activities],
          notifications: timeMoved && after.visibleToClient && after.companyId
            ? [makeNotification({ audience: "client", companyId: after.companyId, title: "일정이 변경되었습니다", body: `${after.title} 일정이 조정되었습니다. 일정 화면에서 확인해 주세요.`, href: "/portal/schedule" }), ...st.notifications]
            : st.notifications,
        });
      },

      deleteSchedule: (id, byUserId) => {
        const st = get();
        const target = st.schedules.find((x) => x.id === id);
        if (!target) return;
        if (deny(st, "schedule.delete", `일정 삭제 (${target.title})`, set)) return;
        set({
          schedules: st.schedules.filter((x) => x.id !== id),
          activities: [makeActivity({ type: "schedule_deleted", companyId: target.companyId, projectId: target.projectId, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `일정 삭제: ${target.title}` }), ...st.activities],
          notifications: target.visibleToClient && target.companyId
            ? [makeNotification({ audience: "client", companyId: target.companyId, title: "일정이 취소되었습니다", body: `${target.title} 일정이 취소되었습니다.`, href: "/portal/schedule" }), ...st.notifications]
            : st.notifications,
        });
      },

      updateTask: (id, patch, byUserId) => {
        const st = get();
        const before = st.tasks.find((t) => t.id === id);
        if (!before) return;
        if (deny(st, "task.update", `업무 수정 (${before.title})`, set)) return;
        const { status, ...rest } = patch;
        const changed = (Object.keys(rest) as (keyof typeof rest)[]).filter((k) => rest[k] !== undefined && rest[k] !== before[k]);
        if (status && status !== before.status) get().updateTaskStatus(id, status, byUserId);
        if (changed.length === 0) return;
        const LABEL: Record<string, string> = { title: "제목", type: "유형", dueDate: "기한", assigneeId: "담당자", priority: "우선순위", memo: "메모" };
        const after = get();
        set({
          tasks: after.tasks.map((t) => (t.id === id ? { ...t, ...rest } : t)),
          activities: [makeActivity({ type: "task_updated", companyId: before.companyId, projectId: before.projectId, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `업무 수정: ${before.title} — ${changed.map((k) => LABEL[k] ?? k).join(", ")}`, meta: { fields: changed.join(",") } }), ...after.activities],
        });
      },

      deleteTask: (id, byUserId) => {
        const st = get();
        const target = st.tasks.find((t) => t.id === id);
        if (!target) return;
        if (deny(st, "task.delete", `업무 삭제 (${target.title})`, set)) return;
        set({
          tasks: st.tasks.filter((t) => t.id !== id),
          activities: [makeActivity({ type: "task_deleted", companyId: target.companyId, projectId: target.projectId, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `업무 삭제: ${target.title}${target.source === "auto" ? " (자동 생성 업무)" : ""}` }), ...st.activities],
        });
      },

      // ---------- 상담 기록 ----------
      createConsultation: (data, byUserId, followUp) => {
        const st = get();
        if (deny(st, "consultation.create", "상담 기록", set)) return;
        const company = st.companies.find((c) => c.id === data.companyId);
        const cs: Consultation = { ...data, id: uid("cs") };
        // 상담에서 정한 "다음 Action"이 업무로 넘어가지 않으면 결국 기억에 의존하게 된다.
        const tasks = followUp?.create && data.summary.nextAction
          ? [{
              id: uid("tk"),
              companyId: data.companyId,
              projectId: data.projectId,
              title: `${company?.name ?? ""} ${data.summary.nextAction}`,
              type: "후속연락" as const,
              dueDate: followUp.dueDate,
              assigneeId: data.consultantId,
              status: "todo" as TaskStatus,
              priority: "normal" as const,
              createdAt: nowIso(),
              source: "auto" as const,
            }, ...st.tasks]
          : st.tasks;
        set({
          consultations: [cs, ...st.consultations],
          tasks,
          activities: [
            ...(tasks !== st.tasks ? [makeActivity({ type: "task_created", companyId: data.companyId, projectId: data.projectId, actorId: "system", actorRole: "system", text: `자동 생성: ${data.summary.nextAction}` })] : []),
            makeActivity({ type: "consultation_logged", companyId: data.companyId, projectId: data.projectId, actorId: byUserId, actorRole: "consultant", text: `상담 기록: ${data.type} (${data.channel})${company ? ` — ${company.name}` : ""}`, meta: { consultationId: cs.id } }),
            ...st.activities,
          ],
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
        if (deny(st, "task.create", `업무 등록 (${data.title})`, set)) return;
        const t: Task = { ...data, id: uid("tk"), createdAt: nowIso(), status: data.status ?? "todo", source: "manual" };
        set({ tasks: [t, ...st.tasks], activities: [makeActivity({ type: "task_created", companyId: t.companyId, projectId: t.projectId, actorId: byUserId, actorRole: "consultant", text: `업무 등록: ${t.title}` }), ...st.activities] });
      },
      createSchedule: (data, byUserId) => {
        const st = get();
        if (deny(st, "schedule.create", `일정 등록 (${data.title})`, set)) return;
        const s: Schedule = { ...data, id: uid("sc") };
        const notifs = data.visibleToClient && data.companyId ? [makeNotification({ audience: "client", companyId: data.companyId, title: "새 일정이 등록되었습니다", body: data.title, href: "/portal/schedule" })] : [];
        set({ schedules: [...st.schedules, s], activities: [makeActivity({ type: "schedule_created", companyId: data.companyId, projectId: data.projectId, actorId: byUserId, actorRole: "consultant", text: `일정 등록: ${data.title}` }), ...st.activities], notifications: [...notifs, ...st.notifications] });
      },
      shareResult: (data, byUserId) => {
        const st = get();
        if (deny(st, "result.share", `결과자료 공유 (${data.name})`, set)) return;
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
        if (deny(st, "opportunity.create", `매출기회 등록 (${svc.name})`, set)) return;
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
        if (deny(st, "opportunity.advance", `매출기회 단계 이동 (${o.serviceName})`, set)) return;
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
        if (deny(st, "approval.request", `승인 요청 (${data.title})`, set)) return;
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
        // 대표 승인은 여기서 실제로 막힌다. 이전에는 버튼만 숨겼다.
        if (deny(st, "approval.decide", `대표 승인 처리 (${ap.title})`, set)) return;
        const now = nowIso();
        const company = st.companies.find((c) => c.id === ap.companyId);
        const updated: Approval = { ...ap, status: decision, decidedBy: byUserId, decidedAt: now, decisionNote: note };
        // 승인 결과는 기회 상태로 그대로 흘러간다 — 승인만 하고 멈추는 구조를 만들지 않는다.
        let opportunities = st.opportunities;
        // 할인 승인 결과는 견적 상태로 바로 이어진다. 승인 = 발송 가능, 반려 = 초안으로 되돌림.
        // 승인이면 approvalId를 남겨 "승인된 할인"임을 표시하고, 반려면 할인을 0으로 되돌려
        // 담당자가 정가로 바로 발송하거나 다시 요청할 수 있게 한다.
        const quotes = ap.quoteId
          ? st.quotes.map((q) =>
              q.id === ap.quoteId
                ? { ...q, status: "draft" as QuoteStatus, approvalId: decision === "approved" ? ap.id : undefined, discountPct: decision === "approved" ? q.discountPct : 0 }
                : q,
            )
          : st.quotes;
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
          quotes,
          tasks: [...extraTasks, ...st.tasks],
          activities: [
            ...(extraTasks.length ? [makeActivity({ type: "task_created", companyId: ap.companyId, actorId: "system", actorRole: "system", text: `자동 생성: ${extraTasks[0].title}` })] : []),
            makeActivity({ type: "approval_decided", companyId: ap.companyId, projectId: ap.projectId, actorId: byUserId, actorRole: "admin", text: `대표 ${decision === "approved" ? "승인" : "반려"}: ${ap.title}${note ? ` — ${note}` : ""}`, meta: { kind: ap.kind, decision } }),
            ...st.activities,
          ],
          notifications: [makeNotification({ audience: "internal", companyId: ap.companyId, title: `대표 ${decision === "approved" ? "승인 완료" : "반려"}`, body: `${ap.title}${note ? ` — ${note}` : ""}`, href: "/ax/opportunities?tab=approvals" }), ...st.notifications],
        });
      },

      // ---------- 견적 ----------
      createQuote: (data, byUserId) => {
        const st = get();
        if (deny(st, "quote.create", `견적 작성 (${data.title})`, set)) return;
        const company = st.companies.find((c) => c.id === data.companyId);
        const q: Quote = {
          ...data,
          id: uid("qt"),
          // 할인이 있으면 발송 전에 대표 승인을 반드시 거친다 (실제 운영 규칙).
          status: data.discountPct > 0 ? "draft" : "draft",
          createdBy: byUserId,
          createdAt: nowIso(),
        };
        set({
          quotes: [q, ...st.quotes],
          activities: [makeActivity({ type: "quote_created", companyId: data.companyId, projectId: data.projectId, actorId: byUserId, actorRole: "consultant", text: `견적 작성: ${data.title}${company ? ` (${company.name})` : ""}`, meta: { amount: quoteNet(q), discountPct: data.discountPct } }), ...st.activities],
        });
      },

      requestQuoteApproval: (quoteId, reason, byUserId) => {
        const st = get();
        const q = st.quotes.find((x) => x.id === quoteId);
        if (!q) return;
        const company = st.companies.find((c) => c.id === q.companyId);
        const now = nowIso();
        const ap: Approval = {
          id: uid("ap"),
          kind: "discount",
          title: `${company?.name ?? ""} ${q.title} 할인 ${q.discountPct}% 요청`,
          summary: reason.trim() || `${q.scope} · 할인 ${q.discountPct}% 적용 여부를 결정해 주세요.`,
          companyId: q.companyId,
          projectId: q.projectId,
          quoteId: q.id,
          baseAmount: quoteGross(q),
          discountPct: q.discountPct,
          requestedBy: byUserId,
          requestedAt: now,
          status: "pending",
        };
        set({
          approvals: [ap, ...st.approvals],
          quotes: st.quotes.map((x) => (x.id === quoteId ? { ...x, status: "approval_pending" as QuoteStatus, approvalId: ap.id } : x)),
          activities: [makeActivity({ type: "approval_requested", companyId: q.companyId, projectId: q.projectId, actorId: byUserId, actorRole: "consultant", text: `대표 승인 요청: ${ap.title}`, meta: { kind: "discount", discountPct: q.discountPct } }), ...st.activities],
          notifications: [makeNotification({ audience: "internal", companyId: q.companyId, title: "대표 승인 요청", body: `${company ? `${company.name} · ` : ""}${ap.title}`, href: "/ax/opportunities?tab=approvals" }), ...st.notifications],
        });
      },

      sendQuote: (quoteId, byUserId) => {
        const st = get();
        const q = st.quotes.find((x) => x.id === quoteId);
        if (!q) return;
        if (deny(st, "quote.send", `견적 발송 (${q.title})`, set)) return;
        const company = st.companies.find((c) => c.id === q.companyId);
        const now = nowIso();
        // 응답이 없으면 그냥 묻힌다 — 발송 시점에 후속 확인 업무를 같이 만든다.
        const task: Task = {
          id: uid("tk"),
          companyId: q.companyId,
          projectId: q.projectId,
          title: `${company?.name ?? ""} ${q.title} 견적 회신 확인`,
          type: "후속연락",
          dueDate: iso(addDays(new Date(), 3, 18)),
          assigneeId: company?.consultantId ?? byUserId,
          status: "todo",
          priority: "normal",
          createdAt: now,
          source: "auto",
        };
        set({
          quotes: st.quotes.map((x) => (x.id === quoteId ? { ...x, status: "sent" as QuoteStatus, sentAt: now } : x)),
          tasks: [task, ...st.tasks],
          activities: [
            makeActivity({ type: "task_created", companyId: q.companyId, actorId: "system", actorRole: "system", text: `자동 생성: ${task.title}` }),
            makeActivity({ type: "quote_sent", companyId: q.companyId, projectId: q.projectId, actorId: byUserId, actorRole: "consultant", text: `견적 발송: ${q.title}`, meta: { amount: quoteNet(q) } }),
            ...st.activities,
          ],
          notifications: [makeNotification({ audience: "client", companyId: q.companyId, title: "제안서가 도착했습니다", body: `${q.title} — 내용을 확인하고 회신해 주세요.`, href: "/portal/services" }), ...st.notifications],
        });
      },

      respondQuote: (quoteId, decision, byUserId, note) => {
        const st = get();
        const q = st.quotes.find((x) => x.id === quoteId);
        if (!q || q.status !== "sent") return;
        if (deny(st, "quote.respond", `견적 회신 (${q.title})`, set)) return;
        const company = st.companies.find((c) => c.id === q.companyId);
        const now = nowIso();
        const accepted = decision === "accepted";
        const tasks = st.tasks.map((t) => (t.source === "auto" && t.title.includes(`${q.title} 견적 회신 확인`) && t.status !== "done" ? { ...t, status: "done" as TaskStatus, completedAt: now } : t));
        const followUp: Task = {
          id: uid("tk"),
          companyId: q.companyId,
          projectId: q.projectId,
          title: accepted ? `${company?.name ?? ""} ${q.title} 계약 진행` : `${company?.name ?? ""} ${q.title} 보류 사유 확인`,
          type: accepted ? "내부작업" : "후속연락",
          dueDate: iso(addDays(new Date(), accepted ? 2 : 1, 18)),
          assigneeId: company?.consultantId ?? "u_admin",
          status: "todo",
          priority: "urgent",
          createdAt: now,
          source: "auto",
          memo: note,
        };
        set({
          quotes: st.quotes.map((x) => (x.id === quoteId ? { ...x, status: (accepted ? "accepted" : "declined") as QuoteStatus, respondedAt: now, clientNote: note } : x)),
          tasks: [followUp, ...tasks],
          activities: [
            makeActivity({ type: "task_created", companyId: q.companyId, actorId: "system", actorRole: "system", text: `자동 생성: ${followUp.title}` }),
            makeActivity({ type: "quote_responded", companyId: q.companyId, projectId: q.projectId, actorId: byUserId, actorRole: "client", text: `고객 회신: ${q.title} — ${accepted ? "수락" : "보류"}${note ? ` (${note})` : ""}`, meta: { decision } }),
            ...st.activities,
          ],
          notifications: [makeNotification({ audience: "internal", companyId: q.companyId, title: `견적 회신: ${company?.name ?? ""}`, body: `${q.title} — ${accepted ? "고객이 수락했습니다." : `보류${note ? `: ${note}` : ""}`}`, href: "/ax/consultations?tab=quote" }), ...st.notifications],
        });
      },

      convertQuote: (quoteId, byUserId) => {
        const st = get();
        const q = st.quotes.find((x) => x.id === quoteId);
        if (!q || q.status !== "accepted") return;
        const now = nowIso();
        const contract: Contract = {
          id: uid("ct"),
          companyId: q.companyId,
          projectId: q.projectId ?? "",
          title: q.title,
          status: "sent",
          sentAt: now,
          period: q.period,
          scope: q.scope,
          amount: quoteNet(q),
          source: "quote",
        };
        // 견적이 계약이 되면 연결된 매출기회도 함께 닫힌다 — 두 곳을 따로 정리하게 두지 않는다.
        const opportunities = q.opportunityId
          ? st.opportunities.map((o) => (o.id === q.opportunityId ? { ...o, status: "won" as const, updatedAt: now, history: [...o.history, { at: now, status: "won" as const, by: byUserId, note: "견적 수락 → 계약 전환" }] } : o))
          : st.opportunities;
        set({
          contracts: [contract, ...st.contracts],
          quotes: st.quotes.map((x) => (x.id === quoteId ? { ...x, status: "converted" as QuoteStatus, contractId: contract.id } : x)),
          opportunities,
          activities: [makeActivity({ type: "quote_converted", companyId: q.companyId, projectId: q.projectId, actorId: byUserId, actorRole: "consultant", text: `계약 전환: ${q.title}`, meta: { amount: quoteNet(q) } }), ...st.activities],
          notifications: [makeNotification({ audience: "client", companyId: q.companyId, title: "계약서를 보내드렸습니다", body: `${q.title} 계약 진행을 시작합니다.`, href: "/portal/projects" }), ...st.notifications],
        });
      },

      // ---------- AX 실증 ----------
      startSprint: () => {
        const st = get();
        if (st.settings.sprintStartedAt) return;
        if (deny(st, "sprint.manage", "AX 실증 시작", set)) return;
        const now = nowIso();
        set({
          settings: { ...st.settings, sprintStartedAt: now },
          activities: [makeActivity({ type: "task_created", actorId: st.session?.userId ?? "u_admin", actorRole: "admin", text: "AX 실증 14일 시작", meta: { sprint: "start" } }), ...st.activities],
        });
      },
      saveBaseline: (data, byUserId) => {
        const st = get();
        if (deny(st, "baseline.write", "도입 전 기준선 입력", set)) return;
        const now = nowIso();
        set({
          settings: { ...st.settings, baseline: { ...data, recordedAt: now, recordedBy: byUserId } },
          activities: [makeActivity({ type: "evidence_exported", actorId: byUserId, actorRole: "admin", text: "도입 전 기준선 기록", meta: { fields: Object.values(data).filter((v) => typeof v === "number").length } }), ...st.activities],
        });
      },
      resetSprint: () => {
        const st = get();
        set({ settings: { ...st.settings, sprintStartedAt: undefined } });
      },
      logAiAction: (label, c, byUserId) => {
        const st = get();
        set({
          activities: [makeActivity({ type: "ai_action_taken", companyId: c.companyId, actorId: byUserId, actorRole: st.session?.role ?? "consultant", text: `AI 추천 실행: ${label}`, meta: { kind: c.kind } }), ...st.activities],
        });
      },
      logEvidenceExport: (byUserId, rows) => {
        const st = get();
        set({
          activities: [makeActivity({ type: "evidence_exported", actorId: byUserId, actorRole: st.session?.role ?? "admin", text: `Evidence Log 내보내기 (${rows}건)`, meta: { rows } }), ...st.activities],
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
        // 운영 모드에서는 잠긴다. 초기화하려면 먼저 운영 모드를 꺼야 하고, 그 전환도 기록에 남는다.
        if (st.settings.liveMode) return;
        if (deny(st, "data.manage", "데모 초기화", set)) return;
        set({ ...buildSeed(), seededAt: nowIso(), session: st.session, settings: { ...st.settings }, toasts: [] });
      },

      // ---------- 샘플 지우기 · 다시 보기 ----------
      // "보관"과 다르다. 샘플은 실제 기록이 아니므로 흔적 없이 지운다.
      // 대신 사용자가 넣은 기업·프로젝트·기록은 한 건도 건드리지 않는다 — sample 표식이 있는 기업과 그 하위만 고른다.
      removeSamples: (byUserId) => {
        const st = get();
        if (deny(st, "data.manage", "샘플 데이터 지우기", set)) return { ok: false, reason: "샘플 삭제는 대표 계정에서만 가능합니다." };
        const ids = new Set(st.companies.filter((c) => c.sample).map((c) => c.id));
        if (ids.size === 0) return { ok: false, reason: "지울 샘플이 없습니다." };
        const pids = new Set(st.projects.filter((p) => ids.has(p.companyId)).map((p) => p.id));
        const keepC = <T extends { companyId?: string }>(x: T) => !x.companyId || !ids.has(x.companyId);
        const keepP = <T extends { projectId?: string }>(x: T) => !x.projectId || !pids.has(x.projectId);
        const before = st.projects.length + st.consultations.length + st.contracts.length + st.docRequests.length + st.schedules.length + st.tasks.length + st.inquiries.length + st.results.length + st.opportunities.length + st.quotes.length + st.approvals.length + st.activities.length + st.notifications.length;
        const next = {
          companies: st.companies.filter((c) => !ids.has(c.id)),
          users: st.users.filter((u) => u.role !== "client" || !u.companyId || !ids.has(u.companyId)),
          projects: st.projects.filter((p) => !ids.has(p.companyId)),
          consultations: st.consultations.filter(keepC),
          contracts: st.contracts.filter(keepC),
          docRequests: st.docRequests.filter((d) => keepC(d) && keepP(d)),
          schedules: st.schedules.filter((x) => keepC(x) && keepP(x)),
          tasks: st.tasks.filter((x) => keepC(x) && keepP(x)),
          inquiries: st.inquiries.filter(keepC),
          results: st.results.filter((x) => keepC(x) && keepP(x)),
          opportunities: st.opportunities.filter(keepC),
          quotes: st.quotes.filter((x) => keepC(x) && keepP(x)),
          approvals: st.approvals.filter(keepC),
          activities: st.activities.filter((a) => keepC(a) && keepP(a)),
          notifications: st.notifications.filter(keepC),
        };
        const after = next.projects.length + next.consultations.length + next.contracts.length + next.docRequests.length + next.schedules.length + next.tasks.length + next.inquiries.length + next.results.length + next.opportunities.length + next.quotes.length + next.approvals.length + next.activities.length + next.notifications.length;
        const counts = { companies: ids.size, projects: pids.size, records: before - after };
        // 샘플을 지웠다는 건 실제 데이터를 넣기 시작한다는 뜻이다. 20시간 뒤 자동 초기화가 그 데이터를 지우지 않도록 운영 모드를 함께 켠다.
        const settings = st.settings.liveMode ? st.settings : { ...st.settings, liveMode: true };
        set({
          ...next,
          settings,
          // 샘플 클라이언트로 미리보기 중이었다면 풀어준다
          session: st.session && st.session.portalPreviewCompanyId && ids.has(st.session.portalPreviewCompanyId) ? { ...st.session, portalPreviewCompanyId: undefined } : st.session,
          activities: [
            ...(st.settings.liveMode ? [] : [makeActivity({ type: "live_mode_changed", actorId: byUserId, actorRole: "admin", text: "운영 모드 켜짐 — 샘플 삭제와 함께 자동으로 켜짐" })]),
            makeActivity({ type: "samples_removed", actorId: byUserId, actorRole: "admin", text: `샘플 데이터 삭제 — 기업 ${counts.companies} · 프로젝트 ${counts.projects} · 관련 기록 ${counts.records}건`, meta: counts }),
            ...next.activities,
          ],
        });
        return { ok: true, counts };
      },

      restoreSamples: (byUserId) => {
        const st = get();
        if (deny(st, "data.manage", "샘플 데이터 다시 보기", set)) return { ok: false, reason: "샘플 복원은 대표 계정에서만 가능합니다." };
        const seed = buildSeed();
        const have = new Set(st.companies.map((c) => c.id));
        const add = seed.companies.filter((c) => c.sample && !have.has(c.id));
        if (add.length === 0) return { ok: false, reason: "샘플 기업이 이미 모두 들어 있습니다." };
        const ids = new Set(add.map((c) => c.id));
        // 코드가 사용자 기업과 겹치면 비어 있는 글자로 바꾼다
        const used = st.companies.map((c) => c.code);
        const companies = add.map((c) => { const code = used.includes(c.code) ? nextCompanyCode(used) : c.code; used.push(code); return { ...c, code }; });
        const inC = <T extends { companyId?: string }>(x: T) => !!x.companyId && ids.has(x.companyId);
        const projects = seed.projects.filter((p) => ids.has(p.companyId));
        const pids = new Set(projects.map((p) => p.id));
        const inP = <T extends { projectId?: string }>(x: T) => !!x.projectId && pids.has(x.projectId);
        const haveUser = new Set(st.users.map((u) => u.id));
        set({
          companies: [...st.companies, ...companies],
          users: [...st.users, ...seed.users.filter((u) => u.role === "client" && inC(u) && !haveUser.has(u.id))],
          projects: [...st.projects, ...projects],
          consultations: [...st.consultations, ...seed.consultations.filter(inC)],
          contracts: [...st.contracts, ...seed.contracts.filter(inC)],
          docRequests: [...st.docRequests, ...seed.docRequests.filter((d) => inC(d) || inP(d))],
          schedules: [...st.schedules, ...seed.schedules.filter((x) => inC(x) || inP(x))],
          tasks: [...st.tasks, ...seed.tasks.filter((x) => inC(x) || inP(x))],
          inquiries: [...st.inquiries, ...seed.inquiries.filter(inC)],
          results: [...st.results, ...seed.results.filter((x) => inC(x) || inP(x))],
          opportunities: [...st.opportunities, ...seed.opportunities.filter(inC)],
          quotes: [...st.quotes, ...seed.quotes.filter((x) => inC(x) || inP(x))],
          approvals: [...st.approvals, ...seed.approvals.filter(inC)],
          notifications: [...st.notifications, ...seed.notifications.filter(inC)],
          activities: [
            makeActivity({ type: "samples_restored", actorId: byUserId, actorRole: "admin", text: `샘플 데이터 다시 보기 — 기업 ${companies.length} · 프로젝트 ${projects.length}` }),
            ...st.activities,
            ...seed.activities.filter((a) => inC(a) || inP(a)),
          ],
        });
        return { ok: true, counts: { companies: companies.length, projects: projects.length } };
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

/** 보관된 항목은 업무 화면·브리핑·고객 Portal 어디에도 나오지 않는다. */
export const notArchived = <T extends { archived?: boolean }>(x: T) => !x.archived;

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
