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
  /** 로그인 아이디를 겸한다 */
  email: string;
  phone?: string;
  companyId?: string; // client only
  /** SHA-256(salt::email::password). 서버가 없으므로 보안 경계가 아니다 — src/lib/auth.ts 주석 참고 */
  passwordHash?: string;
  /** 비활성 계정은 로그인할 수 없다 */
  active?: boolean;
  lastLoginAt?: string;
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
  /** 보관됨 — 목록에서 빠지되 기록·연결은 그대로 남는다. 하드 삭제는 하지 않는다. */
  archived?: boolean;
  archivedAt?: string;

  /* ---- 확장 정보 (전부 선택) — 서류에서 읽거나 클릭으로 고른다 ---- */
  /** 사업자 형태 */
  entityType?: EntityType;
  /** 법인등록번호 000000-0000000 */
  corpNo?: string;
  /** 설립일(법인) 또는 개업일(개인) — YYYY-MM-DD */
  establishedAt?: string;
  /** 업태 / 종목 — 사업자등록증 그대로 */
  bizCategory?: string;
  bizItem?: string;
  /** 대표자 생년월일 YYYY-MM-DD — 가업승계·보험 설계에 쓰인다. 주민번호 뒷자리는 절대 저장하지 않는다 */
  ceoBirth?: string;
  /** 자본금(원) — 등기부에서 읽는다 */
  capital?: number;
  /** 지역 (시·도) */
  region?: string;
  /** 임직원 규모 구간 — 정확한 수(employees)가 없을 때의 클릭 입력 */
  employeeBand?: string;
  /** 매출 규모 구간 — 정확한 값(revenue)이 없을 때의 클릭 입력 */
  revenueBand?: string;
  companyPhone?: string;
  website?: string;
  /** 관심 컨설팅 분야 (kpjkcorporation.com 자문 분야 기준) */
  interests?: string[];
  /** 유입 경로 */
  leadSource?: string;
  /** 확인한 서류 — 파일은 저장하지 않고 "무엇을 언제 어떤 방법으로 읽었는지"만 남긴다 */
  docs?: Partial<Record<CompanyDocKind, CompanyDocMeta>>;
  /** 데모 샘플 기업 — "샘플 지우기 / 다시 보기"의 대상. 사용자가 직접 넣은 기업에는 붙지 않는다 */
  sample?: boolean;
}

export type EntityType = "corporation" | "sole" | "other";
export type CompanyDocKind = "bizReg" | "corpReg";
export interface CompanyDocMeta {
  fileName: string;
  size: number;
  readAt: string;
  method: "pdf_text" | "ocr" | "paste";
  /** 이 서류에서 읽어 반영한 항목 키 */
  fields: string[];
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
  /** 사람이 읽는 기간 표기 (예: 2026.03 ~ 2026.12) */
  period: string;
  scope: string;
  /** 계약 종료일 — 있으면 만료 전 갱신 협의 업무가 자동으로 잡힌다 */
  endDate?: string;
  /** 계약 금액 (원). 견적 전환 시 견적 합계가 들어온다 */
  amount?: number;
  /** 어디서 왔는가 — 견적 전환 / 직접 등록 */
  source?: "quote" | "manual";
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
  archived?: boolean;
  archivedAt?: string;
  /** 담당자가 직접 입력한 다음 예정 — 표준 소요일이 쌓이기 전까지는 이것만 고객에게 보여준다 */
  nextMilestone?: { label: string; date: string };
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
  /** 시간 규칙이 만든 업무 — 같은 규칙·대상으로 두 번 만들지 않기 위한 열쇠 */
  ruleKey?: string;
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

/* ---------- 도입 전 기준선 (Before) ---------- */

/**
 * 도입 전 값은 시스템 안에 존재할 수 없다. 그래서 대표가 직접 입력한다.
 * 화면에는 반드시 "대표 입력값"으로 표시해, 실측값(After)과 섞이지 않게 한다.
 */
export interface Baseline {
  /** 자료요청 → 제출까지 걸리던 평균 일수 */
  docLeadDays?: number;
  /** 주간 후속 누락 건수 */
  missedFollowupsPerWeek?: number;
  /** 고객 문의에 답하기까지 걸리던 평균 시간 */
  inquiryResponseHours?: number;
  /** 월 상담 기록 건수 */
  consultationsPerMonth?: number;
  /** 담당자 1인당 동시 관리 기업 수 */
  clientsPerConsultant?: number;
  /** 대표가 직접 챙겨야 했던 업무 비중 (%) */
  ceoHandledPct?: number;
  recordedAt?: string;
  recordedBy?: string;
  note?: string;
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
  | "company_created"
  | "company_updated"
  | "project_updated"
  | "schedule_updated"
  | "schedule_deleted"
  | "task_updated"
  | "task_deleted"
  | "sign_in"
  | "sign_in_failed"
  | "sign_out"
  | "permission_denied"
  | "user_created"
  | "user_updated"
  | "user_deactivated"
  | "password_reset"
  | "doc_request_updated"
  | "doc_request_canceled"
  | "consultation_updated"
  | "consultation_deleted"
  | "company_archived"
  | "project_archived"
  | "quote_updated"
  | "contract_created"
  | "contract_updated"
  | "result_withdrawn"
  | "rule_task_created"
  | "live_mode_changed"
  | "backup_exported"
  | "backup_imported"
  | "org_updated"
  | "demo_reset"
  | "samples_removed"
  | "samples_restored"
  | "company_doc_read";

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
  /** 로그인 시각 — 세션 만료 판단에 쓴다 */
  signedInAt?: string;
}

export type ThemeKey =
  | "kpjk"
  | "navy"
  | "navygold"
  | "emerald"
  | "forest"
  | "teal"
  | "onyx"
  | "steel";

export type FontScale = "s" | "m" | "l" | "xl";

export interface Settings {
  theme: ThemeKey;
  /** "s"가 지금까지의 크기이자 최소값. 아래로는 내려가지 않는다. */
  fontScale: FontScale;
  reduceMotion: boolean;
  tutorialDoneAx: boolean;
  /** AX 실증 스프린트 시작 시각. 없으면 아직 시작 전 */
  sprintStartedAt?: string;
  /** 도입 전 기준선 (대표 입력값) */
  baseline?: Baseline;
  tutorialDonePortal: boolean;
  timezone: string;
  /** 시간 규칙 켜기/끄기. 키가 없으면 켜진 것으로 본다 */
  autoRules?: Record<string, boolean>;
  /**
   * 운영 모드 — 켜면 20시간 자동 초기화가 멈추고, 데모 계정 안내가 사라지며, 데모 초기화가 잠긴다.
   * 서버가 붙기 전까지 실제 데이터를 넣기 시작할 때의 유일한 보호막이다.
   */
  liveMode?: boolean;
  lastBackupAt?: string;
  /** 인쇄물 상단에 들어가는 우리 회사 정보. 비워두면 인쇄물에 빈칸으로 나간다 — 값을 지어내지 않는다 */
  org?: OrgInfo;
}

export interface OrgInfo {
  name: string;
  ceo?: string;
  bizNo?: string;
  address?: string;
  phone?: string;
  email?: string;
}
