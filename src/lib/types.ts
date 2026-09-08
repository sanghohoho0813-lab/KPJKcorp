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
  tutorialDonePortal: boolean;
  timezone: string;
}
