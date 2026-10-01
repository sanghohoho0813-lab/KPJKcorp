import type {
  CompanyVault, CompanyFile, JournalEntry, Payment,
  Activity, Approval, Company, Consultation, Contract, DocumentFile, DocumentRequest,
  Inquiry, Message, Notice, Notification, Opportunity, Project, Quote, ResultFile, Schedule,
  SurveyResponse, Task, User,
} from "../types";
import { isRealYmd } from "../format";

/**
 * 데이터베이스 행 ↔ 앱 타입 변환.
 *
 * 왜 이 파일이 따로 있는가: 화면 코드가 DB 컬럼 이름을 몰라야 하기 때문이다.
 * 컬럼을 바꾸거나 나중에 다른 저장소로 옮길 때 고칠 곳이 여기 하나로 끝난다.
 *
 * 규칙
 *  - DB 는 snake_case, 앱은 camelCase
 *  - DB 의 null 은 앱에서 undefined ("값 없음"을 한 가지로만 표현한다)
 *  - 날짜는 양쪽 다 ISO 문자열. 변환하지 않는다.
 */

type Row = Record<string, unknown>;

/** null → undefined */
const u = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);
/** undefined → null (DB 에 "지움"으로 전달) */
const n = <T>(v: T | undefined): T | null => (v === undefined ? null : v);
/** 날짜 칸 마지막 안전장치 — 빈 값·달력에 없는 날짜(2월 30일 등)는 비운다. 한 줄 때문에 묶음 전체가 거절되면 안 된다 */
const ymdOrNull = (v: string | undefined): string | null => (v && isRealYmd(v.slice(0, 10)) ? v.slice(0, 10) : null);
const s = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const bool = (v: unknown): boolean => v === true;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * 사람을 가리키는 칸(담당자·작성자 등)은 서버에서 계정 ID(uuid)다.
 * 데모용 ID("u_admin")나 "system" 이 섞여 들어가면 그 한 줄 때문에 함께 보낸 행 전체가 거절된다.
 * 계정 ID 모양이 아니면 비워서 보낸다.
 */
export const personId = (v: string | null | undefined): string | null => (v && UUID_RE.test(v) ? v : null);

/* ---------------------------------- 사람 --------------------------------- */

export const userFromRow = (r: Row): User => ({
  id: s(r.id),
  name: s(r.name),
  role: r.role as User["role"],
  title: s(r.title),
  email: s(r.email),
  phone: u(r.phone as string | null),
  companyId: u(r.company_id as string | null),
  active: r.active !== false,
  lastLoginAt: u(r.last_login_at as string | null),
});

/** 비밀번호는 auth.users 가 갖는다. profiles 로 보내지 않는다. */
export const userToRow = (x: Partial<User>): Row => ({
  ...(x.name !== undefined && { name: x.name }),
  ...(x.role !== undefined && { role: x.role }),
  ...(x.title !== undefined && { title: x.title }),
  ...(x.email !== undefined && { email: x.email.toLowerCase() }),
  ...(x.phone !== undefined && { phone: n(x.phone) }),
  ...(x.companyId !== undefined && { company_id: n(x.companyId) }),
  ...(x.active !== undefined && { active: x.active }),
});

/* --------------------------------- 기업고객 ------------------------------- */

export const companyFromRow = (r: Row): Company => ({
  id: s(r.id), code: s(r.code), name: s(r.name), ceo: s(r.ceo), industry: s(r.industry),
  bizNo: s(r.biz_no), contactName: s(r.contact_name), contactTitle: s(r.contact_title),
  contactPhone: s(r.contact_phone), contactEmail: s(r.contact_email), address: s(r.address),
  employees: num(r.employees), revenue: s(r.revenue),
  firstConsultDate: s(r.first_consult_date), consultantId: s(r.consultant_id), memo: s(r.memo),
  archived: bool(r.archived), archivedAt: u(r.archived_at as string | null),
  entityType: u(r.entity_type as Company["entityType"]),
  corpNo: u(r.corp_no as string | null),
  establishedAt: u(r.established_at as string | null),
  bizCategory: u(r.biz_category as string | null),
  bizItem: u(r.biz_item as string | null),
  ceoBirth: u(r.ceo_birth as string | null),
  capital: u(r.capital as number | null),
  region: u(r.region as string | null),
  employeeBand: u(r.employee_band as string | null),
  revenueBand: u(r.revenue_band as string | null),
  companyPhone: u(r.company_phone as string | null),
  website: u(r.website as string | null),
  interests: (r.interests as string[] | null) ?? undefined,
  leadSource: u(r.lead_source as string | null),
  docs: u(r.docs as Company["docs"]),
  sample: bool(r.sample) || undefined,
  ceoGender: u(r.ceo_gender as Company["ceoGender"] | null),
  bizItemsExtra: u(r.biz_items_extra as string | null),
  shareholders: u(r.shareholders as string | null),
  customFields: u(r.custom_fields as Company["customFields"] | null),
});

export const companyToRow = (x: Partial<Company> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.code !== undefined && { code: x.code }),
  ...(x.name !== undefined && { name: x.name }),
  ...(x.ceo !== undefined && { ceo: x.ceo }),
  ...(x.industry !== undefined && { industry: x.industry }),
  ...(x.bizNo !== undefined && { biz_no: x.bizNo }),
  ...(x.contactName !== undefined && { contact_name: x.contactName }),
  ...(x.contactTitle !== undefined && { contact_title: x.contactTitle }),
  ...(x.contactPhone !== undefined && { contact_phone: x.contactPhone }),
  ...(x.contactEmail !== undefined && { contact_email: x.contactEmail }),
  ...(x.address !== undefined && { address: x.address }),
  ...(x.employees !== undefined && { employees: x.employees }),
  ...(x.revenue !== undefined && { revenue: x.revenue }),
  ...(x.firstConsultDate !== undefined && { first_consult_date: x.firstConsultDate }),
  ...(x.consultantId !== undefined && { consultant_id: personId(x.consultantId) }),
  ...(x.memo !== undefined && { memo: x.memo }),
  ...(x.archived !== undefined && { archived: !!x.archived }),
  ...(x.archivedAt !== undefined && { archived_at: n(x.archivedAt) }),
  ...(x.entityType !== undefined && { entity_type: n(x.entityType) }),
  ...(x.corpNo !== undefined && { corp_no: n(x.corpNo) }),
  ...(x.establishedAt !== undefined && { established_at: ymdOrNull(x.establishedAt) }),
  ...(x.bizCategory !== undefined && { biz_category: n(x.bizCategory) }),
  ...(x.bizItem !== undefined && { biz_item: n(x.bizItem) }),
  ...(x.ceoBirth !== undefined && { ceo_birth: ymdOrNull(x.ceoBirth) }),
  ...(x.capital !== undefined && { capital: n(x.capital) }),
  ...(x.region !== undefined && { region: n(x.region) }),
  ...(x.employeeBand !== undefined && { employee_band: n(x.employeeBand) }),
  ...(x.revenueBand !== undefined && { revenue_band: n(x.revenueBand) }),
  ...(x.companyPhone !== undefined && { company_phone: n(x.companyPhone) }),
  ...(x.website !== undefined && { website: n(x.website) }),
  ...(x.interests !== undefined && { interests: x.interests ?? [] }),
  ...(x.leadSource !== undefined && { lead_source: n(x.leadSource) }),
  ...(x.docs !== undefined && { docs: n(x.docs) }),
  ...(x.sample !== undefined && { sample: !!x.sample }),
  ...(x.ceoGender !== undefined && { ceo_gender: n(x.ceoGender) }),
  ...(x.bizItemsExtra !== undefined && { biz_items_extra: n(x.bizItemsExtra) }),
  ...(x.shareholders !== undefined && { shareholders: n(x.shareholders) }),
  ...(x.customFields !== undefined && { custom_fields: n(x.customFields) }),
});

/* --------------------------------- 프로젝트 ------------------------------- */

export const projectFromRow = (r: Row): Project => ({
  id: s(r.id), companyId: s(r.company_id), name: s(r.name), type: s(r.type),
  consultantId: s(r.consultant_id), startDate: s(r.start_date), dueDate: s(r.due_date),
  stage: r.stage as Project["stage"], description: s(r.description),
  stageChangedAt: s(r.stage_changed_at), clientVisible: bool(r.client_visible),
  archived: bool(r.archived), archivedAt: u(r.archived_at as string | null),
  nextMilestone: u(r.next_milestone as Project["nextMilestone"]),
  workStatus: u(r.work_status as Project["workStatus"] | null),
  nextStep: u(r.next_step as string | null),
  waitingSince: u(r.waiting_since as string | null),
});

export const projectToRow = (x: Partial<Project> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.companyId !== undefined && { company_id: x.companyId }),
  ...(x.name !== undefined && { name: x.name }),
  ...(x.type !== undefined && { type: x.type }),
  ...(x.consultantId !== undefined && { consultant_id: personId(x.consultantId) }),
  ...(x.startDate !== undefined && { start_date: x.startDate }),
  ...(x.dueDate !== undefined && { due_date: x.dueDate }),
  ...(x.stage !== undefined && { stage: x.stage }),
  ...(x.description !== undefined && { description: x.description }),
  ...(x.stageChangedAt !== undefined && { stage_changed_at: x.stageChangedAt }),
  ...(x.clientVisible !== undefined && { client_visible: x.clientVisible }),
  ...(x.archived !== undefined && { archived: !!x.archived }),
  ...(x.archivedAt !== undefined && { archived_at: n(x.archivedAt) }),
  ...(x.nextMilestone !== undefined && { next_milestone: n(x.nextMilestone) }),
  ...(x.workStatus !== undefined && { work_status: n(x.workStatus) }),
  ...(x.nextStep !== undefined && { next_step: n(x.nextStep) }),
  ...(x.waitingSince !== undefined && { waiting_since: n(x.waitingSince) }),
});

/* --------------------------------- 상담기록 ------------------------------- */

export const consultationFromRow = (r: Row): Consultation => ({
  id: s(r.id), companyId: s(r.company_id), projectId: u(r.project_id as string | null),
  date: s(r.date), consultantId: s(r.consultant_id),
  type: r.type as Consultation["type"], channel: r.channel as Consultation["channel"],
  notes: s(r.notes),
  summary: (r.summary as Consultation["summary"]) ??
    { core: [], requirements: [], promises: [], documents: [], nextAction: "" },
});

export const consultationToRow = (x: Partial<Consultation> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.companyId !== undefined && { company_id: x.companyId }),
  ...(x.projectId !== undefined && { project_id: n(x.projectId) }),
  ...(x.date !== undefined && { date: x.date }),
  ...(x.consultantId !== undefined && { consultant_id: personId(x.consultantId) }),
  ...(x.type !== undefined && { type: x.type }),
  ...(x.channel !== undefined && { channel: x.channel }),
  ...(x.notes !== undefined && { notes: x.notes }),
  ...(x.summary !== undefined && { summary: x.summary }),
});

/* ---------------------------------- 계약 ---------------------------------- */

export const contractFromRow = (r: Row): Contract => ({
  id: s(r.id), companyId: s(r.company_id), projectId: s(r.project_id), title: s(r.title),
  status: r.status as Contract["status"],
  sentAt: u(r.sent_at as string | null), signedAt: u(r.signed_at as string | null),
  period: s(r.period), scope: s(r.scope),
  endDate: u(r.end_date as string | null), amount: u(r.amount as number | null),
  source: u(r.source as Contract["source"]),
});

export const contractToRow = (x: Partial<Contract> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.companyId !== undefined && { company_id: x.companyId }),
  ...(x.projectId !== undefined && { project_id: x.projectId || null }),
  ...(x.title !== undefined && { title: x.title }),
  ...(x.status !== undefined && { status: x.status }),
  ...(x.sentAt !== undefined && { sent_at: n(x.sentAt) }),
  ...(x.signedAt !== undefined && { signed_at: n(x.signedAt) }),
  ...(x.period !== undefined && { period: x.period }),
  ...(x.scope !== undefined && { scope: x.scope }),
  ...(x.endDate !== undefined && { end_date: n(x.endDate) }),
  ...(x.amount !== undefined && { amount: n(x.amount) }),
  ...(x.source !== undefined && { source: n(x.source) }),
});

/* -------------------------- 자료요청 + 제출 파일 --------------------------- */

export const docFileFromRow = (r: Row): DocumentFile => ({
  id: s(r.id), fileName: s(r.file_name), size: num(r.size),
  uploadedAt: s(r.uploaded_at), uploadedBy: s(r.uploaded_by), version: num(r.version),
  storagePath: u(r.storage_path as string | null),
});

export const docRequestFromRow = (r: Row, files: DocumentFile[] = []): DocumentRequest => ({
  id: s(r.id), projectId: s(r.project_id), companyId: s(r.company_id),
  name: s(r.name), description: s(r.description),
  requestedAt: s(r.requested_at), dueDate: s(r.due_date),
  status: r.status as DocumentRequest["status"], assigneeId: s(r.assignee_id),
  submittedAt: u(r.submitted_at as string | null),
  reviewedAt: u(r.reviewed_at as string | null),
  reviewNote: u(r.review_note as string | null),
  memo: u(r.memo as string | null),
  files,
});

export const docRequestToRow = (x: Partial<DocumentRequest> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.companyId !== undefined && { company_id: x.companyId }),
  ...(x.projectId !== undefined && { project_id: x.projectId || null }),
  ...(x.name !== undefined && { name: x.name }),
  ...(x.description !== undefined && { description: x.description }),
  ...(x.requestedAt !== undefined && { requested_at: x.requestedAt }),
  ...(x.dueDate !== undefined && { due_date: x.dueDate }),
  ...(x.status !== undefined && { status: x.status }),
  ...(x.assigneeId !== undefined && { assignee_id: personId(x.assigneeId) }),
  ...(x.submittedAt !== undefined && { submitted_at: n(x.submittedAt) }),
  ...(x.reviewedAt !== undefined && { reviewed_at: n(x.reviewedAt) }),
  ...(x.reviewNote !== undefined && { review_note: n(x.reviewNote) }),
  ...(x.memo !== undefined && { memo: n(x.memo) }),
  // files 는 이 테이블에 없다 — document_files 로 따로 간다
});

/* ---------------------------------- 공지 ---------------------------------- */

export const noticeFromRow = (r: Row): Notice => ({
  id: s(r.id), companyId: u(r.company_id as string | null),
  title: s(r.title), body: s(r.body), pinned: bool(r.pinned),
  publishedAt: s(r.published_at), expiresAt: u(r.expires_at as string | null),
  authorId: s(r.author_id),
  // 새로 쓴 공지도 updated_at 이 채워진다 — 처음 쓴 뒤 1분 넘어 고쳤을 때만 "수정됨"
  updatedAt: r.updated_at && r.created_at && Date.parse(String(r.updated_at)) - Date.parse(String(r.created_at)) > 60_000 ? String(r.updated_at) : undefined,
});

export const noticeToRow = (x: Partial<Notice> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.companyId !== undefined && { company_id: n(x.companyId) }),
  ...(x.title !== undefined && { title: x.title }),
  ...(x.body !== undefined && { body: x.body }),
  ...(x.pinned !== undefined && { pinned: x.pinned }),
  ...(x.publishedAt !== undefined && { published_at: x.publishedAt }),
  ...(x.expiresAt !== undefined && { expires_at: n(x.expiresAt) }),
  ...(x.authorId !== undefined && { author_id: personId(x.authorId) }),
});

/* ---------------------------------- 일정 ---------------------------------- */

export const scheduleFromRow = (r: Row): Schedule => ({
  id: s(r.id), companyId: u(r.company_id as string | null), projectId: u(r.project_id as string | null),
  title: s(r.title), type: r.type as Schedule["type"],
  start: s(r.start_at), end: u(r.end_at as string | null),
  location: u(r.location as string | null), assigneeId: s(r.assignee_id),
  visibleToClient: bool(r.visible_to_client), memo: u(r.memo as string | null),
});

export const scheduleToRow = (x: Partial<Schedule> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.companyId !== undefined && { company_id: n(x.companyId) }),
  ...(x.projectId !== undefined && { project_id: n(x.projectId) }),
  ...(x.title !== undefined && { title: x.title }),
  ...(x.type !== undefined && { type: x.type }),
  ...(x.start !== undefined && { start_at: x.start }),
  ...(x.end !== undefined && { end_at: n(x.end) }),
  ...(x.location !== undefined && { location: n(x.location) }),
  ...(x.assigneeId !== undefined && { assignee_id: personId(x.assigneeId) }),
  ...(x.visibleToClient !== undefined && { visible_to_client: x.visibleToClient }),
  ...(x.memo !== undefined && { memo: n(x.memo) }),
});

/* ---------------------------------- 업무 ---------------------------------- */

export const taskFromRow = (r: Row): Task => ({
  id: s(r.id), companyId: u(r.company_id as string | null), projectId: u(r.project_id as string | null),
  title: s(r.title), type: r.type as Task["type"], dueDate: s(r.due_date),
  assigneeId: s(r.assignee_id), status: r.status as Task["status"],
  priority: r.priority as Task["priority"], memo: u(r.memo as string | null),
  createdAt: s(r.created_at), completedAt: u(r.completed_at as string | null),
  source: u(r.source as Task["source"]), ruleKey: u(r.rule_key as string | null),
});

export const taskToRow = (x: Partial<Task> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.companyId !== undefined && { company_id: n(x.companyId) }),
  ...(x.projectId !== undefined && { project_id: n(x.projectId) }),
  ...(x.title !== undefined && { title: x.title }),
  ...(x.type !== undefined && { type: x.type }),
  ...(x.dueDate !== undefined && { due_date: x.dueDate }),
  ...(x.assigneeId !== undefined && { assignee_id: personId(x.assigneeId) }),
  ...(x.status !== undefined && { status: x.status }),
  ...(x.priority !== undefined && { priority: x.priority }),
  ...(x.memo !== undefined && { memo: n(x.memo) }),
  ...(x.createdAt !== undefined && { created_at: x.createdAt }),
  ...(x.completedAt !== undefined && { completed_at: n(x.completedAt) }),
  ...(x.source !== undefined && { source: n(x.source) }),
  ...(x.ruleKey !== undefined && { rule_key: n(x.ruleKey) }),
});

/* ------------------------------ 문의 + 메시지 ------------------------------ */

export const messageFromRow = (r: Row): Message => ({
  id: s(r.id), authorId: s(r.author_id), authorRole: r.author_role as Message["authorRole"],
  body: s(r.body), createdAt: s(r.created_at),
});

export const inquiryFromRow = (r: Row, messages: Message[] = []): Inquiry => ({
  id: s(r.id), companyId: s(r.company_id), projectId: u(r.project_id as string | null),
  title: s(r.title), category: r.category as Inquiry["category"],
  createdAt: s(r.created_at), createdBy: s(r.created_by),
  status: r.status as Inquiry["status"], assigneeId: s(r.assignee_id),
  messages,
});

export const inquiryToRow = (x: Partial<Inquiry> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.companyId !== undefined && { company_id: x.companyId }),
  ...(x.projectId !== undefined && { project_id: n(x.projectId) }),
  ...(x.title !== undefined && { title: x.title }),
  ...(x.category !== undefined && { category: x.category }),
  ...(x.createdAt !== undefined && { created_at: x.createdAt }),
  ...(x.createdBy !== undefined && { created_by: personId(x.createdBy) }),
  ...(x.status !== undefined && { status: x.status }),
  ...(x.assigneeId !== undefined && { assignee_id: personId(x.assigneeId) }),
});

/* -------------------------------- 결과자료 -------------------------------- */

export const resultFromRow = (r: Row): ResultFile => ({
  id: s(r.id), projectId: s(r.project_id), companyId: s(r.company_id),
  name: s(r.name), kind: r.kind as ResultFile["kind"],
  sharedAt: s(r.shared_at), sharedBy: s(r.shared_by),
  size: num(r.size), description: s(r.description),
  storagePath: u(r.storage_path as string | null),
});

export const resultToRow = (x: Partial<ResultFile> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.companyId !== undefined && { company_id: x.companyId }),
  ...(x.projectId !== undefined && { project_id: x.projectId || null }),
  ...(x.name !== undefined && { name: x.name }),
  ...(x.kind !== undefined && { kind: x.kind }),
  ...(x.sharedAt !== undefined && { shared_at: x.sharedAt }),
  ...(x.sharedBy !== undefined && { shared_by: personId(x.sharedBy) }),
  ...(x.size !== undefined && { size: x.size }),
  ...(x.description !== undefined && { description: x.description }),
  ...(x.storagePath !== undefined && { storage_path: n(x.storagePath) }),
});

/* -------------------------------- 매출기회 -------------------------------- */

export const opportunityFromRow = (r: Row): Opportunity => ({
  id: s(r.id), companyId: s(r.company_id), serviceKey: s(r.service_key), serviceName: s(r.service_name),
  source: r.source as Opportunity["source"], status: r.status as Opportunity["status"],
  assigneeId: s(r.assignee_id), createdAt: s(r.created_at), createdBy: s(r.created_by),
  updatedAt: s(r.updated_at), note: u(r.note as string | null), reason: u(r.reason as string | null),
  history: (r.history as Opportunity["history"]) ?? [],
});

export const opportunityToRow = (x: Partial<Opportunity> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.companyId !== undefined && { company_id: x.companyId }),
  ...(x.serviceKey !== undefined && { service_key: x.serviceKey }),
  ...(x.serviceName !== undefined && { service_name: x.serviceName }),
  ...(x.source !== undefined && { source: x.source }),
  ...(x.status !== undefined && { status: x.status }),
  ...(x.assigneeId !== undefined && { assignee_id: personId(x.assigneeId) }),
  ...(x.createdAt !== undefined && { created_at: x.createdAt }),
  ...(x.createdBy !== undefined && { created_by: personId(x.createdBy) }),
  ...(x.note !== undefined && { note: n(x.note) }),
  ...(x.reason !== undefined && { reason: n(x.reason) }),
  ...(x.history !== undefined && { history: x.history }),
});

/* ---------------------------------- 견적 ---------------------------------- */

export const quoteFromRow = (r: Row): Quote => ({
  id: s(r.id), companyId: s(r.company_id), projectId: u(r.project_id as string | null),
  opportunityId: u(r.opportunity_id as string | null),
  title: s(r.title), scope: s(r.scope), period: s(r.period),
  items: (r.items as Quote["items"]) ?? [],
  discountPct: num(r.discount_pct), validUntil: s(r.valid_until),
  status: r.status as Quote["status"], createdBy: s(r.created_by), createdAt: s(r.created_at),
  sentAt: u(r.sent_at as string | null), respondedAt: u(r.responded_at as string | null),
  clientNote: u(r.client_note as string | null),
  approvalId: u(r.approval_id as string | null), contractId: u(r.contract_id as string | null),
});

export const quoteToRow = (x: Partial<Quote> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.companyId !== undefined && { company_id: x.companyId }),
  ...(x.projectId !== undefined && { project_id: n(x.projectId) }),
  ...(x.opportunityId !== undefined && { opportunity_id: n(x.opportunityId) }),
  ...(x.title !== undefined && { title: x.title }),
  ...(x.scope !== undefined && { scope: x.scope }),
  ...(x.period !== undefined && { period: x.period }),
  ...(x.items !== undefined && { items: x.items }),
  ...(x.discountPct !== undefined && { discount_pct: x.discountPct }),
  ...(x.validUntil !== undefined && { valid_until: x.validUntil }),
  ...(x.status !== undefined && { status: x.status }),
  ...(x.createdBy !== undefined && { created_by: personId(x.createdBy) }),
  ...(x.createdAt !== undefined && { created_at: x.createdAt }),
  ...(x.sentAt !== undefined && { sent_at: n(x.sentAt) }),
  ...(x.respondedAt !== undefined && { responded_at: n(x.respondedAt) }),
  ...(x.clientNote !== undefined && { client_note: n(x.clientNote) }),
  ...(x.approvalId !== undefined && { approval_id: n(x.approvalId) }),
  ...(x.contractId !== undefined && { contract_id: n(x.contractId) }),
});

/* -------------------------------- 대표 승인 ------------------------------- */

export const approvalFromRow = (r: Row): Approval => ({
  id: s(r.id), kind: r.kind as Approval["kind"], title: s(r.title), summary: s(r.summary),
  companyId: u(r.company_id as string | null), projectId: u(r.project_id as string | null),
  opportunityId: u(r.opportunity_id as string | null), quoteId: u(r.quote_id as string | null),
  baseAmount: u(r.base_amount as number | null), discountPct: u(r.discount_pct as number | null),
  requestedBy: s(r.requested_by), requestedAt: s(r.requested_at),
  status: r.status as Approval["status"],
  decidedBy: u(r.decided_by as string | null), decidedAt: u(r.decided_at as string | null),
  decisionNote: u(r.decision_note as string | null),
});

export const approvalToRow = (x: Partial<Approval> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.kind !== undefined && { kind: x.kind }),
  ...(x.title !== undefined && { title: x.title }),
  ...(x.summary !== undefined && { summary: x.summary }),
  ...(x.companyId !== undefined && { company_id: n(x.companyId) }),
  ...(x.projectId !== undefined && { project_id: n(x.projectId) }),
  ...(x.opportunityId !== undefined && { opportunity_id: n(x.opportunityId) }),
  ...(x.quoteId !== undefined && { quote_id: n(x.quoteId) }),
  ...(x.baseAmount !== undefined && { base_amount: n(x.baseAmount) }),
  ...(x.discountPct !== undefined && { discount_pct: n(x.discountPct) }),
  ...(x.requestedBy !== undefined && { requested_by: personId(x.requestedBy) }),
  ...(x.requestedAt !== undefined && { requested_at: x.requestedAt }),
  ...(x.status !== undefined && { status: x.status }),
  ...(x.decidedBy !== undefined && { decided_by: personId(x.decidedBy) }),
  ...(x.decidedAt !== undefined && { decided_at: n(x.decidedAt) }),
  ...(x.decisionNote !== undefined && { decision_note: n(x.decisionNote) }),
});

/* ------------------------------ 기록 · 알림 · 설문 -------------------------- */

// DB 컬럼은 message 다. text 는 타입 이름과 헷갈려서 피했다.
export const activityFromRow = (r: Row): Activity => ({
  id: s(r.id), type: r.type as Activity["type"],
  companyId: u(r.company_id as string | null), projectId: u(r.project_id as string | null),
  // 자동 기록은 서버에 작성자 없이(null) 저장된다 — 화면에서는 예전처럼 "system" 으로 본다
  actorId: r.actor_id ? s(r.actor_id) : r.actor_role === "system" ? "system" : "", actorRole: r.actor_role as Activity["actorRole"],
  at: s(r.at), text: s(r.message),
  meta: u(r.meta as Activity["meta"]),
});

export const activityToRow = (x: Activity): Row => ({
  id: x.id, type: x.type, company_id: n(x.companyId), project_id: n(x.projectId),
  // 계정이 아닌 작성자(자동 처리)는 서버 규칙상 "system" 으로만 남는다
  actor_id: personId(x.actorId), actor_role: personId(x.actorId) ? x.actorRole : "system", at: x.at, message: x.text,
  meta: n(x.meta),
});

export const notificationFromRow = (r: Row): Notification => ({
  id: s(r.id), audience: r.audience as Notification["audience"],
  companyId: u(r.company_id as string | null),
  title: s(r.title), body: s(r.body), at: s(r.at), read: bool(r.read), href: s(r.href),
});

export const notificationToRow = (x: Partial<Notification> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.audience !== undefined && { audience: x.audience }),
  ...(x.companyId !== undefined && { company_id: n(x.companyId) }),
  ...(x.title !== undefined && { title: x.title }),
  ...(x.body !== undefined && { body: x.body }),
  ...(x.at !== undefined && { at: x.at }),
  ...(x.read !== undefined && { read: x.read }),
  ...(x.href !== undefined && { href: x.href }),
});

export const surveyFromRow = (r: Row): SurveyResponse => ({
  id: s(r.id), surveyVersion: s(r.survey_version), stage: s(r.stage),
  userId: s(r.user_id), userName: s(r.user_name), role: r.role as SurveyResponse["role"],
  answers: (r.answers as SurveyResponse["answers"]) ?? {},
  freeText: u(r.free_text as string | null),
  submittedAt: s(r.submitted_at), durationSec: u(r.duration_sec as number | null),
});

export const surveyToRow = (x: SurveyResponse): Row => ({
  id: x.id, survey_version: x.surveyVersion, stage: x.stage,
  user_id: personId(x.userId), user_name: x.userName, role: x.role,
  answers: x.answers, free_text: n(x.freeText),
  submitted_at: x.submittedAt, duration_sec: n(x.durationSec),
});

/* ------------------------------- 고객 관리 --------------------------------- */

export const vaultFromRow = (r: Row): CompanyVault => ({
  id: s(r.id), companyId: s(r.company_id),
  slots: (r.slots as CompanyVault["slots"] | null) ?? {},
  customSlots: (r.custom_slots as CompanyVault["customSlots"] | null) ?? [],
  updatedAt: u(r.updated_at as string | null),
});
export const vaultToRow = (x: Partial<CompanyVault> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.companyId !== undefined && { company_id: x.companyId }),
  ...(x.slots !== undefined && { slots: x.slots ?? {} }),
  ...(x.customSlots !== undefined && { custom_slots: x.customSlots ?? [] }),
});

export const companyFileFromRow = (r: Row): CompanyFile => ({
  id: s(r.id), companyId: s(r.company_id), slot: s(r.slot), fileName: s(r.file_name),
  size: num(r.size), mime: s(r.mime), folder: u(r.folder as string | null), issuedAt: u(r.issued_at as string | null),
  storagePath: u(r.storage_path as string | null), uploadedAt: s(r.uploaded_at), uploadedBy: s(r.uploaded_by),
});
export const companyFileToRow = (x: Partial<CompanyFile> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.companyId !== undefined && { company_id: x.companyId }),
  ...(x.slot !== undefined && { slot: x.slot }),
  ...(x.fileName !== undefined && { file_name: x.fileName }),
  ...(x.size !== undefined && { size: x.size }),
  ...(x.mime !== undefined && { mime: x.mime }),
  ...(x.folder !== undefined && { folder: n(x.folder) }),
  ...(x.issuedAt !== undefined && { issued_at: ymdOrNull(x.issuedAt) }),
  ...(x.storagePath !== undefined && { storage_path: n(x.storagePath) }),
  ...(x.uploadedAt !== undefined && { uploaded_at: x.uploadedAt }),
  ...(x.uploadedBy !== undefined && { uploaded_by: personId(x.uploadedBy) }),
});

export const journalFromRow = (r: Row): JournalEntry => ({
  id: s(r.id), companyId: s(r.company_id), type: r.type as JournalEntry["type"], content: s(r.content),
  entryDate: s(r.entry_date), pinned: bool(r.pinned) || undefined, authorId: s(r.author_id),
  createdAt: s(r.created_at), updatedAt: u(r.updated_at as string | null),
});
export const journalToRow = (x: Partial<JournalEntry> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.companyId !== undefined && { company_id: x.companyId }),
  ...(x.type !== undefined && { type: x.type }),
  ...(x.content !== undefined && { content: x.content }),
  ...(x.entryDate !== undefined && { entry_date: x.entryDate }),
  ...(x.pinned !== undefined && { pinned: !!x.pinned }),
  ...(x.authorId !== undefined && { author_id: personId(x.authorId) }),
  ...(x.createdAt !== undefined && { created_at: x.createdAt }),
});

export const paymentFromRow = (r: Row): Payment => ({
  id: s(r.id), companyId: s(r.company_id), projectId: u(r.project_id as string | null),
  kind: r.kind as Payment["kind"], label: s(r.label),
  amount: r.amount === null || r.amount === undefined ? undefined : num(r.amount),
  dueDate: u(r.due_date as string | null), receivedAt: u(r.received_at as string | null),
  agentFee: r.agent_fee === null || r.agent_fee === undefined ? undefined : num(r.agent_fee),
  agentName: u(r.agent_name as string | null), note: u(r.note as string | null), createdAt: s(r.created_at),
});
export const paymentToRow = (x: Partial<Payment> & { id?: string }): Row => ({
  ...(x.id !== undefined && { id: x.id }),
  ...(x.companyId !== undefined && { company_id: x.companyId }),
  ...(x.projectId !== undefined && { project_id: n(x.projectId) }),
  ...(x.kind !== undefined && { kind: x.kind }),
  ...(x.label !== undefined && { label: x.label }),
  ...(x.amount !== undefined && { amount: n(x.amount) }),
  ...(x.dueDate !== undefined && { due_date: n(x.dueDate) }),
  ...(x.receivedAt !== undefined && { received_at: n(x.receivedAt) }),
  ...(x.agentFee !== undefined && { agent_fee: n(x.agentFee) }),
  ...(x.agentName !== undefined && { agent_name: n(x.agentName) }),
  ...(x.note !== undefined && { note: n(x.note) }),
  ...(x.createdAt !== undefined && { created_at: x.createdAt }),
});
