import type { BaselineMetrics, BaselinePhase } from "./types";

/**
 * 도입 전 기준선 조사.
 *
 * 왜 필요한가
 * ----------
 * 시스템은 "도입 후"만 셀 수 있다. 도입 전 값은 어디에도 남아 있지 않다.
 * 그래서 대표가 직접 한 번 기록해야 하고, 기록한 값은 끝까지 "대표 입력값"으로 표시한다.
 * 이 값이 있어야 벤처확인·정책자금·보증 심사에서 "무엇이 달라졌는가"를 말할 수 있다.
 *
 * 설계 원칙
 *  - 마지막 한 문항을 빼고 전부 클릭이다. 대표는 통계를 갖고 있지 않다 — 구간만 고르면 된다.
 *  - "모르겠음"을 고를 수 있다. 억지로 숫자를 만들게 하는 순간 그 값은 근거가 아니라 소설이 된다.
 *  - 선택지 → 숫자 변환 규칙을 이 파일 한 곳에 적어 둔다. 심사자가 "이 숫자 어디서 나왔냐"고
 *    물었을 때 답할 수 있어야 한다. 구간의 중앙값을 쓰되, 열린 구간은 보수적으로 잡는다.
 *  - 개선율·절감시간·ROI 는 계산하지 않는다. 이 파일에도, 화면에도 없다.
 */

export const BASELINE_SURVEY_VERSION = "v1";

export const PHASE_LABEL: Record<BaselinePhase, string> = {
  before: "도입 전",
  day7: "7일차",
  day14: "14일차",
};

export type BaselineQuestionType = "single" | "multi" | "text";

export interface BaselineOption {
  key: string;
  label: string;
  /**
   * 이 선택지가 뜻하는 수치. 구간의 대표값이다.
   * undefined 는 "모르겠음" — 수치로 바꾸지 않고 비워 둔다.
   */
  value?: number;
}

export interface BaselineQuestion {
  id: keyof BaselineMetrics | "consultationsRecordedRatio" | "recentPainExample";
  type: BaselineQuestionType;
  label: string;
  hint?: string;
  options?: BaselineOption[];
  /** multi 최대 선택 수 */
  max?: number;
  placeholder?: string;
  /** 단위 — 결과 화면에서 쓴다 */
  unit?: string;
  /**
   * 사람의 체감이라 시스템이 셀 수 없는 항목. DAY 7 / DAY 14 에 같은 질문을 다시 묻는다.
   * 나머지는 시스템이 실측으로 대체할 수 있다.
   */
  recallOnly?: boolean;
  /**
   * 7일차·14일차에 다시 물을 때 쓰는 문구. 도입 전 문항은 전부 과거형("걸렸습니까?")이라
   * 그대로 다시 물으면 지금 이야기인지 예전 이야기인지 헷갈린다. 이 값이 있는 문항만 재조사한다.
   */
  followupLabel?: string;
}

export interface BaselineSection {
  key: string;
  title: string;
  desc: string;
  questions: BaselineQuestion[];
}

/* -------------------------------------------------------------------------- */
/* 자주 쓰는 선택지 묶음                                                        */
/* -------------------------------------------------------------------------- */

/** 빈도 → 주당 건수. 월 단위는 4.33주로 나눈다. "거의 매일"은 주 5일 근무 기준. */
const WEEKLY_FREQ: BaselineOption[] = [
  { key: "none", label: "거의 없음", value: 0 },
  { key: "m1_2", label: "월 1~2건", value: 0.3 },
  { key: "w1", label: "주 1건", value: 1 },
  { key: "w2_3", label: "주 2~3건", value: 2.5 },
  { key: "w4_5", label: "주 4~5건", value: 4.5 },
  { key: "daily", label: "거의 매일", value: 5 },
];

const UNKNOWN: BaselineOption = { key: "unknown", label: "잘 모르겠음" };

/* -------------------------------------------------------------------------- */
/* 문항                                                                         */
/* -------------------------------------------------------------------------- */

export const BASELINE_SECTIONS: BaselineSection[] = [
  {
    key: "collect",
    title: "고객 자료 수집",
    desc: "요청한 자료가 실제로 들어오기까지 얼마나 걸렸는지 기록합니다.",
    questions: [
      {
        id: "docLeadDays",
        type: "single",
        unit: "일",
        label: "고객에게 자료를 요청한 뒤 실제로 받기까지 보통 얼마나 걸렸습니까?",
        options: [
          { key: "same", label: "당일", value: 0.5 },
          { key: "d1_2", label: "1~2일", value: 1.5 },
          { key: "d3_4", label: "3~4일", value: 3.5 },
          { key: "d5_7", label: "5~7일", value: 6 },
          { key: "d8_14", label: "8~14일", value: 11 },
          { key: "over14", label: "2주 이상", value: 18 },
          { key: "unknown", label: "케이스마다 달라 잘 모르겠음" },
        ],
      },
      {
        id: "docReminderCount",
        type: "single",
        unit: "회",
        label: "한 고객의 자료가 모두 들어올 때까지 보통 몇 번 정도 다시 연락했습니까?",
        hint: "독촉·재요청·확인 전화를 모두 포함합니다.",
        options: [
          { key: "none", label: "추가 연락 거의 없음", value: 0 },
          { key: "c1", label: "1회", value: 1 },
          { key: "c2", label: "2회", value: 2 },
          { key: "c3_4", label: "3~4회", value: 3.5 },
          { key: "c5", label: "5회 이상", value: 6 },
          { key: "unknown", label: "기억 안 남" },
        ],
      },
    ],
  },
  {
    key: "search",
    title: "자료·고객정보 찾기",
    desc: "지난 상담 내용이나 받은 자료를 다시 꺼내 보던 일입니다.",
    questions: [
      {
        id: "customerSearchesPerDay",
        type: "single",
        unit: "회",
        recallOnly: true,
        label: "하루에 기존 고객 자료나 상담내용을 다시 찾아보는 일이 몇 번 정도 있었습니까?",
        followupLabel: "요즘 하루에 기존 고객 자료나 상담내용을 다시 찾아보는 일이 몇 번 정도 있습니까?",
        options: [
          { key: "none", label: "거의 없음", value: 0 },
          { key: "t1_2", label: "1~2회", value: 1.5 },
          { key: "t3_5", label: "3~5회", value: 4 },
          { key: "t6_10", label: "6~10회", value: 8 },
          { key: "over10", label: "10회 이상", value: 12 },
          UNKNOWN,
        ],
      },
      {
        id: "customerSearchMinutes",
        type: "single",
        unit: "분",
        recallOnly: true,
        label: "자료나 과거 상담내용 하나를 찾는 데 평균 얼마나 걸렸습니까?",
        followupLabel: "지금 자료나 과거 상담내용 하나를 찾는 데 평균 얼마나 걸립니까?",
        hint: "카카오톡·메일·폴더·엑셀을 뒤지던 시간을 포함합니다.",
        options: [
          { key: "u1", label: "1분 이내", value: 1 },
          { key: "m1_3", label: "1~3분", value: 2 },
          { key: "m3_5", label: "3~5분", value: 4 },
          { key: "m5_10", label: "5~10분", value: 7.5 },
          { key: "m10_20", label: "10~20분", value: 15 },
          { key: "over20", label: "20분 이상", value: 25 },
          UNKNOWN,
        ],
      },
    ],
  },
  {
    key: "ceo",
    title: "대표자의 반복 확인",
    desc: "대표가 직접 기억하고 확인해야 돌아가던 부분입니다.",
    questions: [
      {
        id: "dailyManualCheckMinutes",
        type: "single",
        unit: "분",
        recallOnly: true,
        label: "고객별 진행상태를 확인하려고 카카오톡·엑셀·문서·메모를 들여다본 시간은 하루 평균 어느 정도였습니까?",
        followupLabel: "요즘 고객별 진행상태를 확인하는 데 쓰시는 시간은 하루 평균 어느 정도입니까?",
        hint: "이 항목은 7일차·14일차에 같은 질문으로 다시 여쭤봅니다.",
        options: [
          { key: "u15", label: "15분 미만", value: 10 },
          { key: "m15_30", label: "15~30분", value: 22 },
          { key: "m30_60", label: "30~60분", value: 45 },
          { key: "h1_2", label: "1~2시간", value: 90 },
          { key: "h2_3", label: "2~3시간", value: 150 },
          { key: "over3", label: "3시간 이상", value: 200 },
          UNKNOWN,
        ],
      },
      {
        id: "ceoHandledPct",
        type: "single",
        unit: "%",
        recallOnly: true,
        label: "전체 업무 중 대표가 직접 기억하고 확인하거나 지시해야 돌아가던 업무는 어느 정도였습니까?",
        followupLabel: "지금 전체 업무 중 대표가 직접 기억하고 확인하거나 지시해야 돌아가는 업무는 어느 정도입니까?",
        options: [
          { key: "u20", label: "20% 미만", value: 15 },
          { key: "p20", label: "약 20%", value: 20 },
          { key: "p40", label: "약 40%", value: 40 },
          { key: "p60", label: "약 60%", value: 60 },
          { key: "p80", label: "약 80%", value: 80 },
          { key: "almost", label: "거의 전부", value: 95 },
        ],
      },
    ],
  },
  {
    key: "miss",
    title: "후속업무 누락 · 재작업",
    desc: "놓치거나 다시 해야 했던 일입니다. 이 시스템의 1차 목적이 여기 있습니다.",
    questions: [
      {
        id: "missedFollowupsPerWeek",
        type: "single",
        unit: "건/주",
        label: "연락·자료독촉·일정·후속업무를 놓치거나 늦게 처리한 일이 평균 얼마나 있었습니까?",
        options: WEEKLY_FREQ,
      },
      {
        id: "reworkPerWeek",
        type: "single",
        unit: "건/주",
        recallOnly: true,
        label: "자료 누락·전달착오·담당자 간 정보 차이로 같은 내용을 다시 확인하거나 재작업한 일이 얼마나 있었습니까?",
        followupLabel: "요즘 자료 누락·전달착오·담당자 간 정보 차이로 같은 내용을 다시 확인하거나 재작업하는 일이 얼마나 있습니까?",
        options: [
          { key: "none", label: "거의 없음", value: 0 },
          { key: "m1_2", label: "월 1~2건", value: 0.3 },
          { key: "w1", label: "주 1건", value: 1 },
          { key: "w2_3", label: "주 2~3건", value: 2.5 },
          { key: "w4", label: "주 4건 이상", value: 4.5 },
          { key: "daily", label: "거의 매일", value: 5 },
        ],
      },
    ],
  },
  {
    key: "inquiry",
    title: "고객 문의",
    desc: "고객이 물어왔을 때 답하기까지 걸린 시간과, 물어온 내용입니다.",
    questions: [
      {
        id: "inquiryResponseHours",
        type: "single",
        unit: "시간",
        label: "고객 문의를 받은 뒤 답변하기까지 평균 어느 정도 걸렸습니까?",
        options: [
          { key: "m30", label: "30분 이내", value: 0.5 },
          { key: "h1", label: "1시간 이내", value: 1 },
          { key: "h1_3", label: "1~3시간", value: 2 },
          { key: "h3_6", label: "3~6시간", value: 4.5 },
          { key: "half", label: "반나절", value: 8 },
          { key: "over1d", label: "하루 이상", value: 24 },
        ],
      },
      {
        id: "progressInquiryPerWeek",
        type: "single",
        unit: "건/주",
        label: "“지금 어디까지 진행됐나요?”, “제가 뭘 해야 하나요?” 같은 단순 진행상황 문의가 얼마나 있었습니까?",
        hint: "시스템 도입 후에는 고객이 Portal 에서 직접 확인하므로, 실제 문의 건수와 비교됩니다.",
        options: [
          { key: "none", label: "거의 없음", value: 0 },
          { key: "m1_2", label: "월 1~2건", value: 0.3 },
          { key: "w1_2", label: "주 1~2건", value: 1.5 },
          { key: "w3_5", label: "주 3~5건", value: 4 },
          { key: "d1", label: "하루 1건 정도", value: 5 },
          { key: "d_many", label: "하루 여러 건", value: 10 },
        ],
      },
    ],
  },
  {
    key: "scale",
    title: "상담 · 고객 관리 규모",
    desc: "얼마나 많은 고객을 어떤 방식으로 관리했는지입니다.",
    questions: [
      {
        id: "consultationsActualPerMonth",
        type: "single",
        unit: "건/월",
        label: "한 달에 실제 상담은 약 몇 건 정도 있었습니까?",
        options: [
          { key: "u5", label: "5건 미만", value: 3 },
          { key: "c5_10", label: "5~10건", value: 7.5 },
          { key: "c11_20", label: "11~20건", value: 15.5 },
          { key: "c21_30", label: "21~30건", value: 25.5 },
          { key: "c31_50", label: "31~50건", value: 40.5 },
          { key: "over50", label: "50건 이상", value: 60 },
        ],
      },
      {
        id: "consultationsRecordedRatio",
        type: "single",
        unit: "%",
        label: "그중 상담내용을 실제 기록으로 남겨둔 건은 어느 정도였습니까?",
        hint: "기억에만 있던 것은 기록으로 세지 않습니다.",
        options: [
          { key: "none", label: "거의 없음", value: 5 },
          { key: "p25", label: "약 25%", value: 25 },
          { key: "p50", label: "약 50%", value: 50 },
          { key: "p75", label: "약 75%", value: 75 },
          { key: "almost", label: "거의 모두", value: 95 },
        ],
      },
      {
        id: "clientsPerConsultant",
        type: "single",
        unit: "개사",
        label: "담당자 한 명이 동시에 안정적으로 관리할 수 있었던 고객기업 수는 어느 정도였습니까?",
        options: [
          { key: "u5", label: "5개 이하", value: 4 },
          { key: "c6_10", label: "6~10개", value: 8 },
          { key: "c11_20", label: "11~20개", value: 15.5 },
          { key: "c21_30", label: "21~30개", value: 25.5 },
          { key: "c31_50", label: "31~50개", value: 40.5 },
          { key: "over50", label: "50개 이상", value: 60 },
        ],
      },
    ],
  },
  {
    key: "pain",
    title: "가장 불편했던 문제",
    desc: "무엇을 먼저 해결해야 하는지 정하는 데 씁니다.",
    questions: [
      {
        id: "biggestPainPoints",
        type: "multi",
        max: 3,
        label: "AX 도입 전 가장 부담이 컸던 업무를 최대 3개 골라 주세요.",
        followupLabel: "지금도 여전히 부담이 되는 업무를 최대 3개 골라 주세요. (없으면 고르지 않으셔도 됩니다)",
        options: [
          { key: "progress", label: "고객별 진행상황 확인" },
          { key: "docs_req", label: "자료 요청 / 독촉" },
          { key: "docs_find", label: "고객 자료 찾기" },
          { key: "followup", label: "일정 / 후속연락 기억" },
          { key: "consult_note", label: "상담내용 정리" },
          { key: "inquiry", label: "고객 문의 대응" },
          { key: "approval", label: "승인 / 의사결정" },
          { key: "internal", label: "담당자 간 정보 공유" },
          { key: "explain", label: "고객에게 진행상황 설명" },
          { key: "aftercare", label: "완료 후 재상담 / 후속관리" },
          { key: "etc", label: "기타" },
        ],
      },
      {
        id: "recentPainExample",
        type: "text",
        label: "실제로 가장 기억나는 불편 사례가 있다면 적어 주세요. (선택)",
        followupLabel: "쓰기 시작하신 뒤 달라졌다고 느끼신 점, 또는 여전히 불편한 점을 적어 주세요. (선택)",
        hint: "심사자에게 숫자보다 이 한 줄이 더 잘 전달될 때가 많습니다.",
        placeholder:
          "예: 고객에게 이미 받은 자료를 다시 요청한 적이 있었음\n예: 후속 연락을 놓쳐 일주일 뒤에 다시 연락함\n예: 대표가 없으면 담당자가 현재 진행상황을 알기 어려웠음",
      },
    ],
  },
];

export const BASELINE_QUESTIONS = BASELINE_SECTIONS.flatMap((s) => s.questions);
/** 자유입력을 뺀 문항 수 — 진행률은 클릭으로 답할 것만 센다 */
export const CLICKABLE_COUNT = BASELINE_QUESTIONS.filter((q) => q.type !== "text").length;

/* -------------------------------------------------------------------------- */
/* 도입 후 재조사 (7일차 · 14일차)                                              */
/* -------------------------------------------------------------------------- */

/**
 * 15문항을 전부 다시 묻지 않는다.
 *
 *  - 시스템이 셀 수 있는 것(자료 소요일·후속 누락·문의 응답시간·진행상황 문의·상담 기록 수)은
 *    다시 물을 이유가 없다. 기억보다 로그가 정확하고, 같은 값을 두 번 받으면 어느 쪽이
 *    맞는 값인지 심사에서 되묻게 된다.
 *  - 구조값(담당자 1인당 고객기업 수, 월 상담 건수)은 2주 안에 바뀌지 않는다.
 *  - 남는 것은 **사람의 체감**뿐이다. 이건 도입 후에도 시스템이 만들어낼 수 없어서,
 *    도입 전과 똑같이 대표에게 다시 물어야 비교가 성립한다.
 *
 * 그래서 재조사는 7문항(클릭 6 + 자유 1) · 2단계다. 15문항을 2주 간격으로 두 번 더 받으면
 * 세 번째에는 아무도 답하지 않는다.
 */
const followupOf = (id: string): BaselineQuestion => {
  const q = BASELINE_QUESTIONS.find((x) => x.id === id);
  if (!q) throw new Error(`알 수 없는 문항: ${id}`);
  return { ...q, label: q.followupLabel ?? q.label, hint: undefined };
};

export const FOLLOWUP_SECTIONS: BaselineSection[] = [
  {
    key: "ceo_now",
    title: "지금 대표님의 반복 확인",
    desc: "도입 전과 같은 질문입니다. 지금 기준으로 골라 주세요.",
    questions: ["dailyManualCheckMinutes", "ceoHandledPct", "reworkPerWeek"].map(followupOf),
  },
  {
    key: "search_now",
    title: "지금 자료 찾기",
    desc: "자료와 과거 상담내용을 다시 찾는 데 드는 수고입니다.",
    questions: ["customerSearchesPerDay", "customerSearchMinutes"].map(followupOf),
  },
  {
    key: "left",
    title: "아직 남아 있는 불편",
    desc: "다음에 무엇을 먼저 고칠지 정하는 데 씁니다.",
    questions: ["biggestPainPoints", "recentPainExample"].map(followupOf),
  },
];

export function sectionsFor(phase: BaselinePhase): BaselineSection[] {
  return phase === "before" ? BASELINE_SECTIONS : FOLLOWUP_SECTIONS;
}

export function questionsFor(phase: BaselinePhase): BaselineQuestion[] {
  return sectionsFor(phase).flatMap((s) => s.questions);
}

export function clickableCountFor(phase: BaselinePhase): number {
  return questionsFor(phase).filter((q) => q.type !== "text").length;
}

/**
 * 재조사가 열리는 날.
 * 실증을 시작하지 않았거나 아직 그 날이 오지 않았으면 열지 않는다 —
 * 3일차에 "14일차 조사"를 받아 두면 그 값은 14일차 값이 아니다.
 */
export const FOLLOWUP_DUE_DAY: Record<Exclude<BaselinePhase, "before">, number> = { day7: 7, day14: 14 };

/* -------------------------------------------------------------------------- */
/* 도입 전 ↔ 재조사 비교                                                        */
/* -------------------------------------------------------------------------- */

export interface RecallMetric {
  key: keyof BaselineMetrics | "dailySearchMinutes";
  label: string;
  unit: string;
  /** 낮을수록 좋은 지표인가 */
  lowerIsBetter: boolean;
  /** 입력값을 곱해 만든 계산치 */
  computed?: boolean;
}

/**
 * 재조사로만 비교할 수 있는 항목 — 전부 "대표 체감"이다.
 * 시스템 실측과 같은 표에 섞지 않는다. 섞는 순간 어느 숫자가 로그이고 어느 숫자가
 * 기억인지 구분되지 않아 자료 전체의 신뢰가 깎인다.
 */
export const RECALL_METRICS: RecallMetric[] = [
  { key: "dailyManualCheckMinutes", label: "하루 진행상황 확인 시간", unit: "분", lowerIsBetter: true },
  { key: "ceoHandledPct", label: "대표 직접관리 비중", unit: "%", lowerIsBetter: true },
  { key: "customerSearchesPerDay", label: "하루 자료 검색 횟수", unit: "회", lowerIsBetter: true },
  { key: "customerSearchMinutes", label: "건당 검색 소요", unit: "분", lowerIsBetter: true },
  { key: "dailySearchMinutes", label: "하루 자료 검색 시간", unit: "분", lowerIsBetter: true, computed: true },
  { key: "reworkPerWeek", label: "재작업 · 재확인", unit: "건/주", lowerIsBetter: true },
];

export function recallValue(m: BaselineMetrics | undefined, key: RecallMetric["key"]): number | undefined {
  if (!m) return undefined;
  if (key === "dailySearchMinutes") return dailySearchMinutes(m);
  const v = m[key as keyof BaselineMetrics];
  return typeof v === "number" ? v : undefined;
}

export function optionOf(qid: string, key: string | undefined): BaselineOption | undefined {
  if (!key) return undefined;
  return BASELINE_QUESTIONS.find((q) => q.id === qid)?.options?.find((o) => o.key === key);
}

export function labelOf(qid: string, key: string | undefined) {
  return optionOf(qid, key)?.label;
}

/* -------------------------------------------------------------------------- */
/* 선택지 → 수치                                                                */
/* -------------------------------------------------------------------------- */

export type BaselineAnswers = Record<string, string | string[]>;

/**
 * 고른 선택지를 수치로 바꾼다.
 *
 * 변환 규칙 (심사 대응용으로 명시한다)
 *  - 닫힌 구간("3~4일")은 중앙값(3.5)을 쓴다.
 *  - 열린 구간("2주 이상")은 하한에서 조금만 올린 보수적인 값을 쓴다. 크게 잡으면 과장이 된다.
 *  - 월 단위 빈도는 4.33주로 나눠 주당으로 환산한다 (월 1~2건 = 1.5건 / 4.33 ≒ 0.3).
 *  - "거의 매일"은 주 5일 근무 기준 5건으로 본다.
 *  - "모르겠음"은 수치를 만들지 않고 비운다.
 */
export function metricsFrom(answers: BaselineAnswers): BaselineMetrics {
  const num = (qid: string) => {
    const v = answers[qid];
    if (typeof v !== "string") return undefined;
    return optionOf(qid, v)?.value;
  };

  const actual = num("consultationsActualPerMonth");
  const ratio = num("consultationsRecordedRatio");

  const m: BaselineMetrics = {
    docLeadDays: num("docLeadDays"),
    docReminderCount: num("docReminderCount"),
    customerSearchesPerDay: num("customerSearchesPerDay"),
    customerSearchMinutes: num("customerSearchMinutes"),
    dailyManualCheckMinutes: num("dailyManualCheckMinutes"),
    ceoHandledPct: num("ceoHandledPct"),
    missedFollowupsPerWeek: num("missedFollowupsPerWeek"),
    reworkPerWeek: num("reworkPerWeek"),
    inquiryResponseHours: num("inquiryResponseHours"),
    progressInquiryPerWeek: num("progressInquiryPerWeek"),
    consultationsActualPerMonth: actual,
    // 기록 건수 = 실제 상담 × 기록 비율. 둘 중 하나라도 모르면 만들지 않는다.
    consultationsRecordedPerMonth:
      actual !== undefined && ratio !== undefined ? Math.round((actual * ratio) / 100) : undefined,
    clientsPerConsultant: num("clientsPerConsultant"),
  };

  const pain = answers.biggestPainPoints;
  if (Array.isArray(pain) && pain.length) m.biggestPainPoints = pain;
  return m;
}

/**
 * 하루에 자료를 찾는 데 쓴 시간(분).
 * 계산치다 — 대표가 고른 두 값을 곱한 것이고, 시스템이 잰 값이 아니다.
 * 화면에서 반드시 "대표 입력값 기반 계산"으로 표기한다.
 */
export function dailySearchMinutes(m: BaselineMetrics): number | undefined {
  if (m.customerSearchesPerDay === undefined || m.customerSearchMinutes === undefined) return undefined;
  return Math.round(m.customerSearchesPerDay * m.customerSearchMinutes);
}

/**
 * 기존 6개 Baseline 으로 옮길 값.
 * 새 조사가 기존 도입 전후 비교 카드를 그대로 채우게 해서, 두 곳을 따로 입력하지 않게 한다.
 *
 * consultationsPerMonth 는 "실제 상담"이 아니라 "기록으로 남은 건수"를 넣는다 —
 * 기존 카드가 시스템의 실제 상담기록 수와 비교하는 자리이기 때문이다.
 */
export function toLegacyBaseline(m: BaselineMetrics) {
  const out: Record<string, number> = {};
  const put = (k: string, v: number | undefined) => { if (v !== undefined) out[k] = v; };
  put("docLeadDays", m.docLeadDays);
  put("missedFollowupsPerWeek", m.missedFollowupsPerWeek);
  put("inquiryResponseHours", m.inquiryResponseHours);
  put("consultationsPerMonth", m.consultationsRecordedPerMonth);
  put("clientsPerConsultant", m.clientsPerConsultant);
  put("ceoHandledPct", m.ceoHandledPct);
  put("progressInquiryPerWeek", m.progressInquiryPerWeek);
  return out;
}

/** 결과 화면·인쇄물·복사에 쓰는 4개 묶음 */
export interface SummaryRow {
  label: string;
  value: string;
  /** 대표 입력값을 곱해 만든 계산치 */
  computed?: boolean;
  /**
   * 7일차·14일차에 같은 질문을 다시 묻는 행.
   * 그 시점 응답으로 똑같은 문장을 만들어 한 표 안에서 나란히 볼 수 있게 한다
   * (숫자 대신 고른 구간 그대로 쓴다 — 두 칸의 말이 달라지면 같은 질문으로 안 읽힌다).
   */
  followup?: (a: BaselineAnswers, m: BaselineMetrics) => string;
}

export interface SummaryGroup {
  key: string;
  title: string;
  rows: SummaryRow[];
}

const MISSING = "미입력";

export function summarize(answers: BaselineAnswers, m: BaselineMetrics): SummaryGroup[] {
  const from = (a: BaselineAnswers, qid: string) => labelOf(qid, a[qid] as string | undefined) ?? MISSING;
  const pick = (qid: string) => from(answers, qid);
  const again = (qid: string) => (a: BaselineAnswers) => from(a, qid);
  const search = dailySearchMinutes(m);

  return [
    {
      key: "ceo",
      title: "대표 반복업무",
      rows: [
        { label: "하루 진행상황 확인 시간", value: pick("dailyManualCheckMinutes"), followup: again("dailyManualCheckMinutes") },
        { label: "대표 직접관리 비중", value: pick("ceoHandledPct"), followup: again("ceoHandledPct") },
      ],
    },
    {
      key: "docs",
      title: "고객 · 자료 관리",
      rows: [
        { label: "자료 수집 소요기간", value: pick("docLeadDays") },
        { label: "자료 수집 중 추가 연락", value: pick("docReminderCount") },
        {
          label: "고객자료 검색",
          value: `${pick("customerSearchesPerDay")} / 건당 ${pick("customerSearchMinutes")}`,
          followup: (a) => `${from(a, "customerSearchesPerDay")} / 건당 ${from(a, "customerSearchMinutes")}`,
        },
        ...(search !== undefined
          ? [{
              label: "하루 자료 검색 시간",
              value: `약 ${search}분`,
              computed: true,
              followup: (_a: BaselineAnswers, fm: BaselineMetrics) => {
                const v = dailySearchMinutes(fm);
                return v === undefined ? MISSING : `약 ${v}분`;
              },
            }]
          : []),
      ],
    },
    {
      key: "miss",
      title: "누락 · 커뮤니케이션",
      rows: [
        { label: "후속업무 누락", value: pick("missedFollowupsPerWeek") },
        { label: "재작업", value: pick("reworkPerWeek"), followup: again("reworkPerWeek") },
        { label: "고객 문의 대응시간", value: pick("inquiryResponseHours") },
        { label: "단순 진행상황 문의", value: pick("progressInquiryPerWeek") },
      ],
    },
    {
      key: "scale",
      title: "운영 규모",
      rows: [
        { label: "월 상담", value: pick("consultationsActualPerMonth") },
        { label: "상담 기록 비율", value: pick("consultationsRecordedRatio") },
        ...(m.consultationsRecordedPerMonth !== undefined
          ? [{ label: "월 기록 건수", value: `약 ${m.consultationsRecordedPerMonth}건`, computed: true }]
          : []),
        { label: "담당자 1인당 고객기업", value: pick("clientsPerConsultant") },
      ],
    },
  ];
}

/** 카카오톡·문서에 그대로 붙일 수 있는 글 */
export function toPlainText(opts: {
  answers: BaselineAnswers;
  metrics: BaselineMetrics;
  recordedAt: string;
  respondentName: string;
  recentPainExample?: string;
}) {
  const { answers, metrics, recordedAt, respondentName, recentPainExample } = opts;
  const d = new Date(recordedAt);
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  const lines: string[] = ["[KPJK AX 도입 전 기준선]", ""];

  for (const g of summarize(answers, metrics)) {
    for (const r of g.rows) {
      if (r.value === MISSING) continue;
      lines.push(`- ${r.label}: ${r.value}${r.computed ? " (입력값 기준 계산)" : ""}`);
    }
  }

  const pain = answers.biggestPainPoints;
  if (Array.isArray(pain) && pain.length) {
    lines.push("", `- 가장 부담이 컸던 업무: ${pain.map((k) => labelOf("biggestPainPoints", k) ?? k).join(", ")}`);
  }
  if (recentPainExample?.trim()) lines.push("", `- 실제 사례: ${recentPainExample.trim()}`);

  lines.push(
    "",
    `※ ${date} ${respondentName} 대표 경험 기준 입력값입니다.`,
    "※ 도입 후 수치는 시스템 Event Log 로 별도 측정합니다.",
  );
  return lines.join("\n");
}
