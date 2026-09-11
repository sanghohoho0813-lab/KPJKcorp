export type Role = "admin" | "consultant" | "client";

export type InternalStage =
  | "inquiry"
  | "consult"
  | "contract"
  | "doc_request"
  | "doc_received"
  | "review"
  | "in_progress"
  | "drafting"
  | "ceo_meeting"
  | "done"
  | "aftercare";

export type DocStatus =
  | "planned"
  | "requested"
  | "submitted"
  | "reviewing"
  | "revision"
  | "done";

export type TaskStatus = "todo" | "doing" | "done" | "hold";
export type Priority = "urgent" | "normal" | "low";
export type ScheduleType = "consult" | "meeting" | "doc_due" | "internal_due" | "report" | "followup";
export type InquiryStatus = "open" | "answered" | "closed";

export interface User {
  id: string;
  name: string;
  role: Role;
  title: string;
  email: string;
  phone?: string;
  companyId?: string; // client only
}

export interface Company {
  id: string;
  code: string; // A / B / C ...
  name: string;
  ceo: string;
  industry: string;
  bizNo: string;
  contactName: string;
  contactTitle: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  employees: number;
  revenue: string;
  firstConsultDate: string;
  consultantId: string;
  memo: string;
}

export interface Consultation {
  id: string;
  companyId: string;
  projectId?: string;
  date: string;
  consultantId: string;
  type: "초기상담" | "후속상담" | "정기미팅" | "대표미팅";
  channel: "방문" | "화상" | "전화";
  notes: string;
  summary: {
    core: string[];
    requirements: string[];
    promises: string[];
    documents: string[];
    nextAction: string;
  };
}

export interface Contract {
  id: string;
  companyId: string;
  projectId: string;
  title: string;
  status: "draft" | "sent" | "signed";
  sentAt?: string;
  signedAt?: string;
  period: string;
  scope: string;
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  type: string;
  consultantId: string;
  startDate: string;
  dueDate: string;
  stage: InternalStage;
  description: string;
  stageChangedAt: string;
  clientVisible: boolean;
}

export interface DocumentFile {
  id: string;
  fileName: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  version: number;
}

export interface DocumentRequest {
  id: string;
  projectId: string;
  companyId: string;
  name: string;
  description: string;
  requestedAt: string;
  dueDate: string;
  status: DocStatus;
  assigneeId: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewNote?: string;
  files: DocumentFile[];
  memo?: string;
}

export interface Schedule {
  id: string;
  companyId?: string;
  projectId?: string;
  title: string;
  type: ScheduleType;
  start: string;
  end?: string;
  location?: string;
  assigneeId: string;
  visibleToClient: boolean;
  memo?: string;
}

export interface Task {
  id: string;
  companyId?: string;
  projectId?: string;
  title: string;
  type: "후속연락" | "자료검토" | "내부작업" | "문의응대" | "미팅준비" | "보고서" | "기타";
  dueDate: string;
  assigneeId: string;
  status: TaskStatus;
  priority: Priority;
  memo?: string;
  createdAt: string;
  completedAt?: string;
  source?: "manual" | "auto";
}

export interface Message {
  id: string;
  authorId: string;
  authorRole: Role;
  body: string;
  createdAt: string;
}

export interface Inquiry {
  id: string;
  companyId: string;
  projectId?: string;
  title: string;
  category: "진행상황" | "자료" | "일정" | "결과물" | "기타";
  createdAt: string;
  createdBy: string;
  status: InquiryStatus;
  assigneeId: string;
  messages: Message[];
}

export interface ResultFile {
  id: string;
  projectId: string;
  companyId: string;
  name: string;
  kind: "보고서" | "제안서" | "분석자료" | "체크리스트" | "기타";
  sharedAt: string;
  sharedBy: string;
  size: number;
  description: string;
}

/* ---------- Opportunity (추가서비스 관심 → 매출) ---------- */

export type OpportunityStatus =
  | "interest"          // 고객이 Portal에서 관심 표시
  | "contacted"         // 담당자 확인 · 고객 연락 완료
  | "approval_pending"  // 대표 승인 대기 (제안/견적)
  | "proposed"          // 승인 후 제안·견적 발송
  | "won"               // 추가계약
  | "dropped";          // 종료

export type OpportunitySource = "portal_interest" | "portal_request" | "internal" | "rule";

export interface Opportunity {
  id: string;
  companyId: string;
  serviceKey: string;
  serviceName: string;
  source: OpportunitySource;
  status: OpportunityStatus;
  assigneeId: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  /** 고객이 남긴 한 줄 또는 내부 메모 */
  note?: string;
  /** 왜 이 서비스를 추천했는가 (규칙 근거) */
  reason?: string;
  history: { at: string; status: OpportunityStatus; by: string; note?: string }[];
}

/* ---------- 견적 (상담 → 견적 → 계약) ---------- */

export type QuoteStatus =
  | "draft"             // 작성 중
  | "approval_pending"  // 할인 포함 → 대표 승인 대기
  | "sent"              // 고객에게 발송 (Portal 노출)
  | "accepted"          // 고객 수락
  | "declined"          // 고객 보류 · 거절
  | "converted";        // 계약으로 전환

export interface QuoteItem {
  name: string;
  /** 원 단위. 화면에서는 만원으로 입력받아 변환한다. */
  amount: number;
  note?: string;
}

export interface Quote {
  id: string;
  companyId: string;
  projectId?: string;
  opportunityId?: string;
  title: string;
  scope: string;
  period: string;
  items: QuoteItem[];
  /** 할인율(%) — 0보다 크면 대표 승인 없이는 발송할 수 없다. */
  discountPct: number;
  validUntil: string;
  status: QuoteStatus;
  createdBy: string;
  createdAt: string;
  sentAt?: string;
  respondedAt?: string;
  /** 고객이 보류·거절할 때 남긴 사유 */
  clientNote?: string;
  approvalId?: string;
  contractId?: string;
}

/* ---------- 대표 승인 (할인·제안·중요 약속) ---------- */

export type ApprovalKind = "opportunity" | "discount" | "promise";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Approval {
  id: string;
  kind: ApprovalKind;
  title: string;
  /** 승인자가 5초 안에 판단할 수 있는 요약 */
  summary: string;
  companyId?: string;
  projectId?: string;
  opportunityId?: string;
  quoteId?: string;
  /** 할인 승인일 때만 */
  baseAmount?: number;
  discountPct?: number;
  requestedBy: string;
  requestedAt: string;
  status: ApprovalStatus;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

/* ---------- AX 고도화 설문 ---------- */

export interface SurveyResponse {
  id: string;
  /** 문항 세트 버전 — 저장소 연결 후에도 비교 가능하게 */
  surveyVersion: string;
  /** 어느 개발단계를 위한 설문인가 (예: "stage2-to-stage3") */
  stage: string;
  userId: string;
  userName: string;
  role: Role;
  answers: Record<string, string | string[] | number>;
  freeText?: string;
  submittedAt: string;
  durationSec?: number;
}

export type ActivityType =
  | "consultation_logged"
  | "contract_sent"
  | "contract_signed"
  | "project_created"
  | "document_requested"
  | "document_uploaded"
  | "document_reviewed"
  | "document_revision_requested"
  | "project_stage_changed"
  | "inquiry_created"
  | "inquiry_answered"
  | "result_shared"
  | "schedule_created"
  | "task_created"
  | "task_completed"
  | "portal_login"
  | "result_downloaded"
  | "opportunity_created"
  | "opportunity_status_changed"
  | "approval_requested"
  | "approval_decided"
  | "quote_created"
  | "quote_sent"
  | "quote_responded"
  | "quote_converted"
  | "survey_submitted"
  | "ai_action_taken"
  | "evidence_exported"
  | "demo_reset";

export interface Activity {
  id: string;
  type: ActivityType;
  companyId?: string;
  projectId?: string;
  actorId: string;
  actorRole: Role | "system";
  at: string;
  text: string;
  meta?: Record<string, string | number>;
}

export interface Notification {
  id: string;
  audience: "internal" | "client";
  companyId?: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  href: string;
}

export interface Session {
  userId: string;
  role: Role;
  companyId?: string;
  /** internal user previewing the portal for a company */
  portalPreviewCompanyId?: string;
}

export type ThemeKey =
  | "kpjk"
  | "navy"
  | "navygold"
  | "emerald"
  | "forest"
  | "teal"
  | "onyx"
  | "burgundy"
  | "plum"
  | "steel";

export interface Settings {
  theme: ThemeKey;
  fontScale: "small" | "base" | "large";
  reduceMotion: boolean;
  tutorialDoneAx: boolean;
  /** AX 실증 스프린트 시작 시각. 없으면 아직 시작 전 */
  sprintStartedAt?: string;
  tutorialDonePortal: boolean;
  timezone: string;
}
