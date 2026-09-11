import type { Activity, ActivityType, Approval, Company, Consultation, Contract, DocumentRequest, Opportunity, Project, Quote, SurveyResponse, Task } from "./types";
import { daysBetween } from "./format";

/**
 * AX EVIDENCE / COACH ENGINE
 *
 * 원칙 — 여기서 만들어내는 숫자는 하나도 없다. 전부 Activity Log와 실제 엔티티에서 센다.
 * 데이터가 없으면 "0건 · 수집 중"으로 그대로 보여준다. 개선율·효과는 계산하지 않는다.
 *
 * 목적은 "기능을 구경시키는 것"이 아니라, 실제 업무를 시스템 안에서 하게 만들고
 * 그 행동 자체가 증거로 남게 하는 것이다. 그래서 미션의 완료 판정은
 * "버튼을 눌렀는가"가 아니라 "그 행동의 결과 Event가 기록됐는가"로 한다.
 */

export const SPRINT_DAYS = 14;

export interface EvidenceCtx {
  now: Date;
  /** 실증 시작 시각. 없으면 전체 기간으로 계산한다. */
  startedAt?: string;
  activities: Activity[];
  companies: Company[];
  projects: Project[];
  consultations: Consultation[];
  contracts: Contract[];
  docRequests: DocumentRequest[];
  tasks: Task[];
  opportunities: Opportunity[];
  quotes: Quote[];
  approvals: Approval[];
  surveys: SurveyResponse[];
}

/** 실증 기간 안에서 발생한 Event만 센다. */
function since(ctx: EvidenceCtx) {
  if (!ctx.startedAt) return ctx.activities;
  return ctx.activities.filter((a) => a.at >= ctx.startedAt!);
}

function countTypes(ctx: EvidenceCtx, types: ActivityType[], filter?: (a: Activity) => boolean) {
  const set = new Set(types);
  return since(ctx).filter((a) => set.has(a.type) && (!filter || filter(a))).length;
}

/* ---------------- Evidence Coverage ---------------- */

export type EvidenceAreaKey = "ops" | "portal" | "docs" | "ai" | "approval" | "revenue";

export interface EvidenceArea {
  key: EvidenceAreaKey;
  label: string;
  /** 왜 이 영역이 필요한가 — 외부 설명용 한 줄 */
  why: string;
  /** "충분"으로 볼 최소 건수 (14일 실증 기준) */
  target: number;
  count: number;
  /** 이 영역을 채우는 행동 */
  how: string;
  href: string;
}

export function evidenceAreas(ctx: EvidenceCtx): EvidenceArea[] {
  return [
    {
      key: "ops",
      label: "운영 기록",
      why: "업무가 기억이 아니라 시스템에서 진행된다는 기록",
      target: 10,
      count: countTypes(ctx, ["project_stage_changed", "task_completed", "consultation_logged", "schedule_created", "task_created"]),
      how: "단계 변경 · 상담 기록 · 업무 완료",
      href: "/ax/projects",
    },
    {
      key: "portal",
      label: "고객 Portal 사용",
      why: "고객이 직접 참여했다는 증거. AX 도입의 핵심 차별점",
      target: 8,
      count: countTypes(ctx, ["portal_login", "document_uploaded", "inquiry_created", "quote_responded", "result_downloaded"], (a) => a.actorRole === "client"),
      how: "고객에게 자료 요청 · 제안 발송 후 회신 받기",
      href: "/ax/documents",
    },
    {
      key: "docs",
      label: "자료 순환",
      why: "요청 → 제출 → 검토가 한 바퀴 돌았다는 기록",
      target: 6,
      count: countTypes(ctx, ["document_requested", "document_reviewed", "document_revision_requested", "result_shared"]),
      how: "자료 요청 보내기 · 제출된 자료 검토 완료",
      href: "/ax/documents",
    },
    {
      key: "ai",
      label: "AI 추천 활용",
      why: "추천만 한 것이 아니라 실제로 실행됐다는 기록",
      target: 5,
      count: countTypes(ctx, ["ai_action_taken"]),
      how: "브리핑 항목의 실행 버튼으로 처리",
      href: "/ax/dashboard",
    },
    {
      key: "approval",
      label: "대표 승인",
      why: "리스크 있는 결정이 기록으로 남고 추적된다는 증거",
      target: 3,
      count: countTypes(ctx, ["approval_requested", "approval_decided"]),
      how: "할인·제안 승인 요청 후 처리",
      href: "/ax/opportunities?tab=approvals",
    },
    {
      key: "revenue",
      label: "매출 흐름",
      why: "상담 → 견적 → 계약이 데이터로 이어진다는 증거",
      target: 4,
      count: countTypes(ctx, ["opportunity_created", "quote_sent", "quote_responded", "quote_converted", "contract_signed"]),
      how: "매출기회 등록 · 견적 발송",
      href: "/ax/consultations?tab=quote",
    },
  ];
}

export function coverageOf(a: EvidenceArea) {
  return Math.min(100, Math.round((a.count / a.target) * 100));
}

export function evidenceScore(areas: EvidenceArea[]) {
  if (areas.length === 0) return 0;
  return Math.round(areas.reduce((s, a) => s + coverageOf(a), 0) / areas.length);
}

/* ---------------- Missions ---------------- */

export interface Mission {
  key: string;
  /** 며칠차에 처음 제안할지 — 낮을수록 먼저 */
  day: number;
  title: string;
  /** 왜 지금 이걸 하는가 (실증 관점) */
  why: string;
  area: EvidenceAreaKey;
  href: string;
  cta: string;
  done: boolean;
  /** 완료 판정 근거 (몇 건 기록됐는지) */
  progress: string;
}

interface MissionDef {
  key: string;
  day: number;
  title: string;
  why: string;
  area: EvidenceAreaKey;
  href: string;
  cta: string;
  need: number;
  count: (ctx: EvidenceCtx) => number;
}

const MISSION_DEFS: MissionDef[] = [
  {
    key: "consult", day: 1, title: "상담 기록 1건 남기기", area: "ops",
    why: "상담 내용이 기록되지 않으면 그 뒤의 모든 판단 근거가 없어집니다.",
    href: "/ax/consultations", cta: "상담 기록 작성", need: 1,
    count: (c) => countTypes(c, ["consultation_logged"]),
  },
  {
    key: "docreq", day: 1, title: "고객에게 자료 요청 1건 보내기", area: "docs",
    why: "요청을 보내야 고객 Portal에 실제 사용 기록이 생기기 시작합니다.",
    href: "/ax/documents", cta: "자료 요청", need: 1,
    count: (c) => countTypes(c, ["document_requested"]),
  },
  {
    key: "aiaction", day: 2, title: "브리핑 추천 1건을 실행 버튼으로 처리", area: "ai",
    why: "AI가 추천만 하고 끝났는지, 실제 행동으로 이어졌는지를 나누는 기록입니다.",
    href: "/ax/dashboard", cta: "브리핑 열기", need: 1,
    count: (c) => countTypes(c, ["ai_action_taken"]),
  },
  {
    key: "stage", day: 2, title: "프로젝트 단계 1건 갱신", area: "ops",
    why: "단계를 바꾸면 고객 Portal 진행률이 같이 움직입니다. 연결이 살아 있다는 증거입니다.",
    href: "/ax/projects", cta: "프로젝트 열기", need: 1,
    count: (c) => countTypes(c, ["project_stage_changed"]),
  },
  {
    key: "portalupload", day: 3, title: "고객이 자료를 직접 제출하게 하기", area: "portal",
    why: "고객이 직접 올린 자료 1건이 '도입했다'는 가장 강한 증거입니다.",
    href: "/ax/documents", cta: "요청 현황 보기", need: 1,
    count: (c) => countTypes(c, ["document_uploaded"], (a) => a.actorRole === "client"),
  },
  {
    key: "review", day: 4, title: "제출된 자료 검토 완료 처리", area: "docs",
    why: "검토 결과가 고객 Portal로 되돌아가야 한 바퀴가 닫힙니다.",
    href: "/ax/documents", cta: "검토하기", need: 1,
    count: (c) => countTypes(c, ["document_reviewed"]),
  },
  {
    key: "task", day: 4, title: "후속 업무 3건 완료", area: "ops",
    why: "누락이 줄었다는 것은 완료 기록의 수로만 말할 수 있습니다.",
    href: "/ax/tasks", cta: "업무함 열기", need: 3,
    count: (c) => countTypes(c, ["task_completed"]),
  },
  {
    key: "inquiry", day: 5, title: "고객 문의 1건 답변", area: "portal",
    why: "문의 → 답변이 시스템 안에서 오갔다는 기록입니다.",
    href: "/ax/tasks?tab=inquiry", cta: "문의 열기", need: 1,
    count: (c) => countTypes(c, ["inquiry_answered"]),
  },
  {
    key: "opp", day: 6, title: "매출기회 1건 등록", area: "revenue",
    why: "추가서비스 가능성이 기억이 아니라 데이터로 남습니다.",
    href: "/ax/opportunities?tab=pipeline", cta: "기회 등록", need: 1,
    count: (c) => countTypes(c, ["opportunity_created"]),
  },
  {
    key: "approval", day: 7, title: "대표 승인 1건 처리", area: "approval",
    why: "중요한 결정이 누구에 의해 언제 내려졌는지가 남습니다.",
    href: "/ax/opportunities?tab=approvals", cta: "승인 열기", need: 1,
    count: (c) => countTypes(c, ["approval_decided"]),
  },
  {
    key: "quote", day: 8, title: "견적 1건 발송", area: "revenue",
    why: "상담과 계약 사이 구간이 시스템 안에 들어옵니다.",
    href: "/ax/consultations?tab=quote", cta: "견적 작성", need: 1,
    count: (c) => countTypes(c, ["quote_sent"]),
  },
  {
    key: "result", day: 10, title: "결과자료 1건 고객에게 공유", area: "docs",
    why: "결과물 전달까지 시스템에서 이루어졌다는 마지막 연결입니다.",
    href: "/ax/documents?tab=results", cta: "결과자료 보기", need: 1,
    count: (c) => countTypes(c, ["result_shared"]),
  },
  {
    key: "report", day: 12, title: "리포트에서 Evidence 내보내기", area: "ops",
    why: "쌓인 기록을 외부에 설명할 수 있는 형태로 꺼내봅니다.",
    href: "/ax/reports", cta: "리포트 열기", need: 1,
    count: (c) => countTypes(c, ["evidence_exported"]),
  },
  {
    key: "survey", day: 13, title: "시스템 개선 의견 남기기", area: "ops",
    why: "다음 단계에 무엇을 만들지는 실제 사용자가 정합니다.",
    href: "/ax/survey", cta: "설문 열기", need: 1,
    count: (c) => countTypes(c, ["survey_submitted"]),
  },
];

export function buildMissions(ctx: EvidenceCtx): Mission[] {
  return MISSION_DEFS.map((d) => {
    const n = d.count(ctx);
    return {
      key: d.key,
      day: d.day,
      title: d.title,
      why: d.why,
      area: d.area,
      href: d.href,
      cta: d.cta,
      done: n >= d.need,
      progress: d.need > 1 ? `${Math.min(n, d.need)} / ${d.need}건` : n >= 1 ? "기록됨" : "아직 없음",
    };
  });
}

/* ---------------- Sprint ---------------- */

export interface SprintState {
  active: boolean;
  /** 1부터 시작. 시작 전이면 0 */
  day: number;
  totalDays: number;
  startedAt?: string;
  missions: Mission[];
  /** 오늘 먼저 할 1~3개 */
  today: Mission[];
  doneCount: number;
  areas: EvidenceArea[];
  score: number;
  /** 가장 비어 있는 영역 */
  weakest?: EvidenceArea;
}

export function buildSprint(ctx: EvidenceCtx): SprintState {
  const areas = evidenceAreas(ctx);
  const missions = buildMissions(ctx);
  const day = ctx.startedAt ? Math.min(SPRINT_DAYS, daysBetween(ctx.startedAt, ctx.now.toISOString()) + 1) : 0;
  const open = missions.filter((m) => !m.done);
  // 오늘 제안할 것: 예정일이 지났거나 오늘인 것 우선, 없으면 남은 것 중 가장 앞선 것
  const due = open.filter((m) => m.day <= Math.max(day, 1));
  const today = (due.length ? due : open).slice(0, 3);
  const weakest = [...areas].sort((a, b) => coverageOf(a) - coverageOf(b))[0];
  return {
    active: !!ctx.startedAt,
    day,
    totalDays: SPRINT_DAYS,
    startedAt: ctx.startedAt,
    missions,
    today,
    doneCount: missions.filter((m) => m.done).length,
    areas,
    score: evidenceScore(areas),
    weakest,
  };
}

/**
 * 왜 이 기록을 쌓아야 하는가 — 자금조달·투자 관점.
 *
 * 표현 원칙: "모든 기업이 그렇다" 같은 출처 없는 단정은 쓰지 않는다.
 * 심사자가 근거를 물었을 때 답할 수 없는 문장은 오히려 신뢰를 깎는다.
 * 대신 "제출 자료에 무엇이 들어가는가"라는 검증 가능한 사실로 말한다.
 */
export const WHY_EVIDENCE = {
  headline: "이 기록이 자금조달·투자 심사에서 가장 먼저 요구되는 자료입니다",
  lead:
    "자금을 조달한 기업들이 공통적으로 제시하는 것은 아이디어가 아니라, 도입 전과 후를 비교할 수 있는 운영 데이터입니다. " +
    "시스템을 썼다는 사실이 아니라 무엇이 얼마나 달라졌는지를 숫자로 보여줄 수 있어야 합니다.",
  points: [
    {
      title: "심사는 '했다'가 아니라 '달라졌다'를 봅니다",
      body: "도입했다는 설명만으로는 평가가 되지 않습니다. 자료 제출 소요일, 후속 누락 건수, 고객 응답 시간처럼 전후를 비교할 수 있는 값이 있어야 사업의 변화로 인정됩니다.",
    },
    {
      title: "이 값은 나중에 소급해서 만들 수 없습니다",
      body: "필요해진 시점에 급히 만든 수치는 근거가 없습니다. 평소 업무가 시스템 안에서 처리되면서 Timestamp와 함께 쌓여 있어야 합니다. 그래서 지금부터 기록이 중요합니다.",
    },
    {
      title: "14일이면 최소 표본이 만들어집니다",
      body: "매일 1~3개 미션만 실제로 처리해도 2주 뒤에는 6개 영역에 실측 데이터가 남습니다. 그때부터 도입 전 기준선과 비교한 설명이 가능해집니다.",
    },
    {
      title: "숫자를 만들어내지 않는 것이 오히려 강점입니다",
      body: "이 시스템은 없는 데이터를 채우지 않습니다. 부족하면 부족하다고 표시합니다. 검증 가능한 자료만 남기는 구조 자체가 심사에서 설명하기 쉬운 조건입니다.",
    },
  ],
} as const;

/** 코치가 지금 하는 말 한 줄. 설명이 아니라 지시여야 한다. */
export function coachLine(s: SprintState): string {
  if (!s.active) return "실증 모드를 시작하면 오늘부터 무엇을 해야 하는지 순서대로 안내합니다.";
  if (s.today.length === 0) return `14개 미션을 모두 처리했습니다. 이제부터는 평소대로 쓰시면 기록이 계속 쌓입니다.`;
  const w = s.weakest;
  if (w && coverageOf(w) < 40) return `${w.label} 기록이 가장 부족합니다. ${w.how}부터 처리해 주세요.`;
  return `${s.today[0].title} — 오늘 이것부터 처리해 주세요.`;
}
