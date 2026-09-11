/**
 * AX 고도화 설문 — 2단계 기본 시스템 → 3단계 실사용 시스템으로 넘어가기 위한 Product Discovery.
 *
 * 만족도 조사가 아니다. "다음에 무엇을 만들지"를 결정할 정보만 묻는다.
 * 타이핑을 최소화하기 위해 마지막 한 문항을 제외하고 전부 클릭형이다.
 */

export const SURVEY_VERSION = "v1";
export const SURVEY_STAGE = "stage2-to-stage3";

export type QuestionType = "single" | "multi" | "scale";

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  hint?: string;
  options?: string[];
  /** multi일 때 최대 선택 수 */
  max?: number;
  /** scale일 때 양 끝 라벨 */
  scaleLabels?: [string, string];
  required?: boolean;
}

export interface Section {
  key: string;
  title: string;
  desc: string;
  questions: Question[];
}

export const SURVEY: Section[] = [
  {
    key: "morning",
    title: "하루의 시작",
    desc: "시스템을 열었을 때 가장 먼저 무엇이 보여야 하는지 정합니다.",
    questions: [
      {
        id: "first_view",
        type: "single",
        required: true,
        label: "아침에 시스템을 열면 가장 먼저 보고 싶은 것은?",
        options: ["오늘 해야 할 일 목록", "내 승인이 필요한 건", "지연·문제가 생긴 고객", "오늘 일정", "새로 들어온 문의·자료", "전체 진행 현황 요약"],
      },
      {
        id: "first_view_2nd",
        type: "multi",
        max: 3,
        label: "그 다음으로 중요한 것을 최대 3개 골라주세요.",
        options: ["미제출 자료", "후속연락 필요 고객", "정체된 프로젝트", "미답변 문의", "이번 주 일정", "추가서비스 관심 고객", "미수금·정산", "직원별 업무량"],
      },
    ],
  },
  {
    key: "client",
    title: "고객 한 명을 볼 때",
    desc: "기업고객 화면에 무엇을 먼저 올릴지 정합니다.",
    questions: [
      {
        id: "client_first",
        type: "multi",
        max: 3,
        required: true,
        label: "고객 한 곳을 확인할 때 가장 자주 찾는 정보는? (최대 3개)",
        options: ["지금 어느 단계인지", "최근 상담 내용", "받은 자료 / 못 받은 자료", "약속한 것", "계약·금액", "다음 일정", "담당자 연락처", "과거 진행 이력"],
      },
      {
        id: "client_missing",
        type: "single",
        label: "지금 시스템에서 고객 정보를 볼 때 가장 아쉬운 점은?",
        options: ["찾는 데 클릭이 많다", "상담 내용을 직접 적기 불편하다", "금액·계약 정보가 약하다", "이력이 한눈에 안 들어온다", "특별히 불편하지 않다"],
      },
      {
        id: "client_search",
        type: "single",
        label: "고객을 찾을 때 주로 무엇으로 찾나요?",
        options: ["회사명", "대표님 성함", "진행 중인 과제명", "담당 직원", "최근 연락한 순서"],
      },
    ],
  },
  {
    key: "miss",
    title: "놓치는 업무",
    desc: "누락을 줄이는 것이 이 시스템의 1차 목적입니다.",
    questions: [
      {
        id: "miss_what",
        type: "multi",
        max: 3,
        required: true,
        label: "실제로 가장 자주 놓치는 업무는? (최대 3개)",
        options: ["고객 후속연락", "자료 독촉", "일정 사전 안내", "약속한 자료 전달", "계약 만료·갱신", "정산·입금 확인", "완료 후 사후관리", "내부 보고"],
      },
      {
        id: "miss_why",
        type: "single",
        required: true,
        label: "후속연락이 누락되는 가장 큰 이유는?",
        options: ["기억에 의존해서", "기록해둘 곳이 마땅치 않아서", "급한 일에 밀려서", "담당이 불분명해서", "언제 연락해야 할지 기준이 없어서"],
      },
      {
        id: "miss_remind",
        type: "single",
        label: "알림은 어떤 방식이 가장 좋을까요?",
        options: ["아침에 한 번 모아서", "그때그때 즉시", "카카오톡으로", "문자·이메일로", "시스템 안에서만"],
      },
    ],
  },
  {
    key: "approval",
    title: "대표 승인",
    desc: "무엇을 승인 대상으로 만들지 정합니다. 너무 많으면 오히려 일이 늘어납니다.",
    questions: [
      {
        id: "approval_items",
        type: "multi",
        max: 4,
        required: true,
        label: "반드시 대표 승인을 거쳐야 하는 것은? (최대 4개)",
        options: ["할인", "최종 견적·제안", "계약서 발송", "고객과의 중요한 약속", "추가서비스 제안", "결과보고서 전달", "일정 변경", "환불·정산 조정"],
      },
      {
        id: "approval_speed",
        type: "single",
        label: "승인 요청이 오면 보통 언제 처리하시나요?",
        options: ["바로 확인한다", "하루 안에", "2~3일 안에", "모아서 한 번에", "상황에 따라 다르다"],
      },
    ],
  },
  {
    key: "ai",
    title: "AI가 할 일",
    desc: "AI가 먼저 발견해야 할 상황과, 사람이 반드시 판단할 영역을 나눕니다.",
    questions: [
      {
        id: "ai_detect",
        type: "multi",
        max: 4,
        required: true,
        label: "AI가 먼저 알려주면 좋은 상황은? (최대 4개)",
        options: ["연락이 끊긴 고객", "자료 제출이 늦는 고객", "정체된 프로젝트", "추가서비스 가능성이 있는 고객", "이탈 위험 고객", "일정이 겹치는 날", "승인이 밀린 건", "계약 만료 임박"],
      },
      {
        id: "ai_auto",
        type: "multi",
        max: 3,
        label: "사람 확인 없이 자동으로 처리해도 되는 일은? (최대 3개)",
        options: ["자료 제출 리마인드", "일정 하루 전 안내", "내부 업무 자동 생성", "상담 내용 요약", "진행상황 자동 안내", "자동으로 해도 되는 건 없다"],
      },
      {
        id: "ai_human",
        type: "multi",
        max: 3,
        required: true,
        label: "반대로, 반드시 사람이 판단해야 하는 일은? (최대 3개)",
        options: ["금액·할인", "고객에게 나가는 최종 문서", "계약 관련 모든 것", "가능성 판단(승인 여부 등)", "고객 불만 응대", "일정 확정"],
      },
    ],
  },
  {
    key: "ui",
    title: "화면 · 모바일",
    desc: "어디를 먼저 고칠지 정합니다.",
    questions: [
      {
        id: "ui_worst",
        type: "single",
        required: true,
        label: "지금 가장 불편하거나 복잡한 화면은?",
        options: ["대시보드", "기업고객", "프로젝트 보드", "자료관리", "일정", "업무·후속관리", "문의", "리포트", "특별히 없다"],
      },
      {
        id: "mobile_action",
        type: "multi",
        max: 3,
        required: true,
        label: "휴대폰으로는 주로 무엇을 하시나요? (최대 3개)",
        options: ["오늘 일정 확인", "고객 정보 찾기", "진행상황 확인", "승인 처리", "문의 답변", "자료 도착 확인", "업무 완료 체크", "이동 중 메모"],
      },
      {
        id: "density",
        type: "single",
        label: "한 화면에 담기는 정보량은?",
        options: ["지금이 적당하다", "더 간단했으면 좋겠다", "더 많이 보여도 된다"],
      },
    ],
  },
  {
    key: "portal",
    title: "고객 Portal",
    desc: "고객이 들어왔을 때 무엇을 먼저 보여줄지 정합니다.",
    questions: [
      {
        id: "portal_first",
        type: "multi",
        max: 3,
        required: true,
        label: "고객이 Portal에서 가장 중요하게 봐야 할 것은? (최대 3개)",
        options: ["현재 진행 단계", "내가 제출할 자료", "다음 일정", "받은 결과자료", "담당자 연락", "예상 완료 시점", "지금까지의 이력"],
      },
      {
        id: "portal_reco",
        type: "single",
        required: true,
        label: "추가서비스 추천은 어떤 방식이 좋을까요?",
        options: ["관심만 표시하게 (가볍게)", "바로 상담요청까지", "담당자가 직접 안내하는 게 낫다", "추천은 넣지 않는 게 낫다"],
      },
    ],
  },
  {
    key: "sales",
    title: "상담 · 견적 · 리포트",
    desc: "매출로 이어지는 구간과, 보고에 필요한 지표를 정합니다.",
    questions: [
      {
        id: "sales_pain",
        type: "single",
        required: true,
        label: "상담에서 계약까지 가장 불편한 지점은?",
        options: ["상담 내용 정리", "견적서 작성", "할인 결정", "계약서 작성·발송", "고객 회신 대기", "이후 후속연락"],
      },
      {
        id: "report_metric",
        type: "multi",
        max: 4,
        required: true,
        label: "리포트에서 실제로 보고 싶은 지표는? (최대 4개)",
        options: ["매출·계약 건수", "문의→상담→계약 전환율", "재구매·재상담", "고객 이탈", "업무 처리 시간", "직원별 업무량", "자료 제출 소요기간", "고객 만족도"],
      },
    ],
  },
  {
    key: "priority",
    title: "다음 단계 우선순위",
    desc: "3단계에서 무엇을 먼저 만들지 직접 정해주세요.",
    questions: [
      {
        id: "next_priority",
        type: "multi",
        max: 3,
        required: true,
        label: "다음에 가장 먼저 만들었으면 하는 것은? (최대 3개)",
        options: ["카카오톡·문자 자동 알림", "견적·계약서 작성", "매출·정산 관리", "상담 기록 직접 작성", "문서 자동 작성", "검색·필터 강화", "모바일 사용성", "고객 Portal 기능 확대", "리포트·실증 데이터"],
      },
      {
        id: "overall",
        type: "scale",
        required: true,
        label: "지금까지의 시스템은 실제 업무에 얼마나 맞습니까?",
        hint: "1 = 아직 많이 다르다 · 5 = 거의 그대로 쓸 수 있다",
        scaleLabels: ["많이 다르다", "그대로 쓸 수 있다"],
      },
    ],
  },
];

export const SURVEY_QUESTIONS = SURVEY.flatMap((s) => s.questions);
export const REQUIRED_IDS = SURVEY_QUESTIONS.filter((q) => q.required).map((q) => q.id);
