import type { DocStatus, InternalStage, Priority, TaskStatus, InquiryStatus, ScheduleType } from "./types";

export const INTERNAL_STAGES: { key: InternalStage; label: string; short: string }[] = [
  { key: "inquiry", label: "문의", short: "문의" },
  { key: "consult", label: "상담", short: "상담" },
  { key: "contract", label: "계약", short: "계약" },
  { key: "doc_request", label: "자료요청", short: "자료요청" },
  { key: "doc_received", label: "자료접수", short: "접수" },
  { key: "review", label: "검토", short: "검토" },
  { key: "in_progress", label: "진행", short: "진행" },
  { key: "drafting", label: "결과작성", short: "결과작성" },
  { key: "ceo_meeting", label: "대표미팅", short: "대표미팅" },
  { key: "done", label: "완료", short: "완료" },
  { key: "aftercare", label: "사후관리", short: "사후관리" },
];

export const KANBAN_STAGES: InternalStage[] = [
  "consult",
  "contract",
  "doc_request",
  "review",
  "in_progress",
  "drafting",
  "ceo_meeting",
  "done",
];

/** Customer-facing 7 steps (Signature 03 — Dual Progress) */
export const CUSTOMER_STEPS = [
  { idx: 0, key: "consult", label: "상담", desc: "담당 컨설턴트와 상담을 진행합니다." },
  { idx: 1, key: "contract", label: "계약", desc: "컨설팅 범위와 일정을 확정합니다." },
  { idx: 2, key: "docs", label: "자료제출", desc: "요청드린 자료를 제출해 주세요." },
  { idx: 3, key: "review", label: "자료검토", desc: "담당 컨설턴트가 제출자료를 검토합니다." },
  { idx: 4, key: "drafting", label: "결과작성", desc: "분석 결과와 제안을 작성합니다." },
  { idx: 5, key: "meeting", label: "대표미팅", desc: "결과를 대표님께 직접 보고드립니다." },
  { idx: 6, key: "done", label: "완료", desc: "최종 결과물을 전달하고 마무리합니다." },
] as const;

export function stageToCustomerStep(stage: InternalStage): number {
  switch (stage) {
    case "inquiry":
    case "consult":
      return 0;
    case "contract":
      return 1;
    case "doc_request":
    case "doc_received":
      return 2;
    case "review":
      return 3;
    case "in_progress":
    case "drafting":
      return 4;
    case "ceo_meeting":
      return 5;
    case "done":
    case "aftercare":
      return 6;
  }
}

export function stageProgress(stage: InternalStage): number {
  const idx = INTERNAL_STAGES.findIndex((s) => s.key === stage);
  const map = [5, 12, 22, 32, 42, 55, 68, 80, 90, 100, 100];
  return map[idx] ?? 0;
}

export function stageLabel(stage: InternalStage) {
  return INTERNAL_STAGES.find((s) => s.key === stage)?.label ?? stage;
}

export function customerStageMessage(stage: InternalStage) {
  switch (stage) {
    case "inquiry":
      return "문의를 접수했습니다. 담당자가 곧 연락드립니다.";
    case "consult":
      return "상담을 진행하고 있습니다.";
    case "contract":
      return "계약 내용을 확정하고 있습니다.";
    case "doc_request":
      return "요청드린 자료를 제출해 주세요.";
    case "doc_received":
      return "제출해 주신 자료를 접수했습니다.";
    case "review":
      return "담당 컨설턴트가 제출자료를 검토하고 있습니다.";
    case "in_progress":
      return "분석과 컨설팅을 진행하고 있습니다.";
    case "drafting":
      return "결과 보고서를 작성하고 있습니다.";
    case "ceo_meeting":
      return "대표님 보고 미팅을 준비하고 있습니다.";
    case "done":
      return "컨설팅이 완료되었습니다. 결과자료를 확인해 주세요.";
    case "aftercare":
      return "사후관리 중입니다. 궁금한 점은 언제든 문의해 주세요.";
  }
}

export const DOC_STATUS: Record<DocStatus, { label: string; clientLabel: string; tone: "neutral" | "success" | "warning" | "error" | "info" }> = {
  planned: { label: "요청예정", clientLabel: "준비중", tone: "neutral" },
  requested: { label: "미제출", clientLabel: "미제출", tone: "error" },
  submitted: { label: "제출완료", clientLabel: "제출완료", tone: "success" },
  reviewing: { label: "검토중", clientLabel: "검토중", tone: "warning" },
  revision: { label: "보완필요", clientLabel: "보완필요", tone: "error" },
  done: { label: "완료", clientLabel: "확인완료", tone: "success" },
};

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: "neutral" | "success" | "warning" | "error" | "info" }> = {
  todo: { label: "예정", tone: "neutral" },
  doing: { label: "진행중", tone: "info" },
  done: { label: "완료", tone: "success" },
  hold: { label: "보류", tone: "warning" },
};

export const PRIORITY: Record<Priority, { label: string; tone: "neutral" | "success" | "warning" | "error" | "info" }> = {
  urgent: { label: "긴급", tone: "error" },
  normal: { label: "보통", tone: "neutral" },
  low: { label: "낮음", tone: "neutral" },
};

export const INQUIRY_STATUS: Record<InquiryStatus, { label: string; clientLabel: string; tone: "neutral" | "success" | "warning" | "error" | "info" }> = {
  open: { label: "미답변", clientLabel: "답변 대기", tone: "error" },
  answered: { label: "답변완료", clientLabel: "답변 완료", tone: "success" },
  closed: { label: "종료", clientLabel: "종료", tone: "neutral" },
};

export const SCHEDULE_TYPE: Record<ScheduleType, { label: string; color: string }> = {
  consult: { label: "상담", color: "var(--mod-customer)" },
  meeting: { label: "고객 미팅", color: "var(--mod-overview)" },
  doc_due: { label: "자료 제출기한", color: "var(--mod-alert)" },
  internal_due: { label: "내부 마감", color: "var(--mod-schedule)" },
  report: { label: "결과보고", color: "var(--mod-evidence)" },
  followup: { label: "후속연락", color: "var(--mod-ops)" },
};
