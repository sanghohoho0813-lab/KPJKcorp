/**
 * 성장 학습 자료 — "스스로 준비하기"의 교육 콘텐츠.
 *
 * 영상은 운영자가 YouTube 주소를 넣을 때만 보인다. 넣지 않은 자료는 글 안내 + 공식 사이트로 쓴다(가짜 재생 화면 없음).
 * 시청 완료는 이 시스템이 확인할 수 없으므로 자동 판정하지 않는다 — 고객이 "학습 완료"를 직접 누르고, 그렇게 기록된다.
 *
 * 아래 기본 안내 7개는 KPJK 가 쓴 일반 안내다. 금리 · 한도 · 기간 같은 숫자는 넣지 않았다(해마다 공고로 바뀐다).
 * 대상 · 서류 · 요건은 늘 "해당 공고문 · 기관 안내가 기준"이라고 적는다. 운영자가 고치고 공개 여부를 정한다.
 */
import type { LearnCategory, LearnContent, SupportProgram } from "./types";
import { LINK_BY_KEY, safeHttpsUrl, youtubeId } from "./official-links";

/** 처음 분류 — 운영자가 이름을 바꾸거나 더할 수 있다(설정 learnCategories) */
export const DEFAULT_LEARN_CATEGORIES: LearnCategory[] = [
  { key: "policy_fund", label: "정책자금 · 정책보증의 기본 이해" },
  { key: "find_programs", label: "정부지원사업 공고 찾는 방법" },
  { key: "read_notice", label: "신청 자격과 공고문 읽는 방법" },
  { key: "prep_docs", label: "신청 전 준비서류 · 체크리스트" },
  { key: "bizplan", label: "사업계획서 작성의 기본" },
  { key: "finance", label: "기업 재무관리 · 자금흐름의 기본" },
  { key: "cert_rnd", label: "기업인증 · 연구개발 준비의 기초" },
];

const link = (k: string) => ({ label: LINK_BY_KEY[k].label, url: LINK_BY_KEY[k].url });

/** 기본 안내(시작용) — 데모에서는 공개, 서버에서는 운영자가 '기본 안내 불러오기'로 비공개 추가 후 검토해 공개 */
export const STARTER_LEARN: Omit<LearnContent, "createdAt" | "updatedAt" | "updatedBy" | "published">[] = [
  {
    id: "lc_policy_basics", category: "policy_fund", title: "정책자금과 정책보증, 무엇이 다른가요",
    audience: "자금이 필요한 중소기업 대표 · 처음 정책자금을 알아보는 기업", minutes: 6,
    summary: "정책자금은 공공기관이 정책 목적에 맞는 기업에 빌려주는 돈(대부분 융자)이고, 정책보증은 보증기관이 보증서를 내어 은행 대출을 받도록 돕는 제도입니다. 둘 다 갚아야 하는 돈이라는 점에서 갚지 않는 보조금(출연금)과 다릅니다.",
    body: [
      "정책자금: 중소벤처기업진흥공단 · 소상공인시장진흥공단 같은 기관이 직접 빌려줍니다. 대상 · 한도 · 금리 · 접수 시기는 기관과 해마다 다르므로 그해 공고를 기준으로 봅니다.",
      "정책보증: 신용보증기금 · 기술보증기금 · 지역신용보증재단이 보증서를 내고, 기업은 그 보증서로 은행에서 대출을 받습니다.",
      "어느 쪽이든 심사가 있고, 신청한다고 모두 받는 것은 아닙니다. 기존 대출 · 연체 · 세금 체납 여부가 함께 확인됩니다.",
      "이 화면은 제도를 이해하도록 돕는 안내입니다. 우리 회사가 받을 수 있는지, 얼마를 받을 수 있는지는 판단하지 않습니다.",
    ],
    prepItems: ["필요한 자금의 용도 정리 (운전자금 · 시설자금)", "최근 재무제표 준비", "기존 대출 · 보증 현황 정리", "해당 기관의 올해 공고 확인"],
    links: [link("kosmes"), link("kodit"), link("kibo"), link("koreg"), link("semas")],
    programTags: ["정책자금", "융자", "보증", "자금", "금융"], growthAreas: [],
  },
  {
    id: "lc_find_programs", category: "find_programs", title: "지원사업 공고, 어디서 어떻게 찾나요",
    audience: "지원사업을 처음 찾아보는 기업", minutes: 5,
    summary: "중앙부처 · 지자체 지원사업은 기업마당에 모여 있고, 창업 지원사업은 K-Startup 에서 따로 찾습니다. 지역 사업은 해당 지자체 · 지역 기관 공지도 함께 봅니다.",
    body: [
      "기업마당: 분야(금융 · 기술 · 인력 · 수출 · 내수 · 창업 · 경영)와 지역으로 공고를 거를 수 있습니다.",
      "K-Startup: 창업 기업 대상 사업이 모여 있습니다. 업력 조건(예: 창업 몇 년 이내)이 공고마다 다르니 꼭 확인합니다.",
      "KPJK 포털의 '정부지원사업' 화면은 기업마당 공고를 우리 회사의 지역 · 업종 · 업력으로 거른 '검토 후보'입니다. 신청 가능 여부를 확정하지 않습니다.",
      "마음에 드는 공고는 마감일을 달력에 적어 두고, 공고문 원문을 내려받아 둡니다.",
    ],
    prepItems: ["관심 분야 키워드 2~3개 정하기", "우리 회사 지역 · 업종 · 설립일 확인", "관심 공고 마감일 적어 두기"],
    links: [link("bizinfo"), link("kstartup")],
    programTags: [], growthAreas: [],
  },
  {
    id: "lc_read_notice", category: "read_notice", title: "공고문은 이 순서로 읽습니다",
    audience: "신청을 고민하는 모든 기업", minutes: 7,
    summary: "공고문은 ① 지원대상 ② 제외대상(신청 제한) ③ 지원내용 ④ 신청기간 · 방법 ⑤ 제출서류 ⑥ 평가 방법 · 일정 ⑦ 문의처 순서로 보면 빠릅니다. 제외대상부터 확인하면 헛수고를 줄일 수 있습니다.",
    body: [
      "지원대상: 업종 · 지역 · 업력 · 규모 조건을 우리 회사 정보와 하나씩 맞춰 봅니다.",
      "제외대상: 세금 체납 · 금융 연체 · 휴업 · 같은 사업 중복 지원 같은 제한이 공고마다 다르게 적혀 있습니다.",
      "신청기간: 마감 '일시'까지 봅니다. 온라인 접수는 마감 직전에 몰려 느려질 수 있습니다.",
      "제출서류: 공고문 목록이 기준입니다. 발급일 기준(예: 공고일 이후 발급)이 붙는 서류가 많습니다.",
      "모르는 부분은 공고문에 적힌 문의처에 묻는 것이 가장 정확합니다.",
    ],
    prepItems: ["공고문 원문(PDF · HWP) 내려받기", "지원대상 · 제외대상 표시해 두기", "신청기간 · 마감 시각 확인", "궁금한 점을 문의처에 묻기"],
    links: [link("bizinfo")],
    programTags: [], growthAreas: [],
  },
  {
    id: "lc_prep_docs", category: "prep_docs", title: "신청 전에 미리 챙겨 두면 좋은 서류",
    audience: "공고 신청을 앞둔 기업", minutes: 6,
    summary: "공고마다 서류는 다르지만 사업자등록증명 · 납세증명서 · 재무제표 · 법인 등기사항증명서(법인) · 4대보험 가입자 명부가 자주 요구됩니다. 실제 필요한 서류와 발급일 기준은 해당 공고문이 기준입니다.",
    body: [
      "사업자등록증명 · 국세 납세증명서: 국세청 홈택스에서 발급합니다(정부24 에서 발급되는 서류도 있습니다).",
      "법인 등기사항증명서: 대법원 인터넷등기소에서 발급합니다.",
      "재무제표: 최근 결산 기준 표준재무제표증명을 요구하는 공고가 많습니다.",
      "발급일 기준을 꼭 보세요. 너무 일찍 떼어 두면 다시 발급해야 할 수 있습니다.",
      "KPJK 포털 '자료제출'에 올려 두면 담당자와 함께 볼 수 있습니다(선택 사항).",
    ],
    prepItems: ["공고문 제출서류 목록 옮겨 적기", "서류별 발급처 확인", "발급일 기준 확인 후 발급", "파일 이름을 서류명으로 정리"],
    links: [link("hometax"), link("gov24"), link("iros")],
    programTags: [], growthAreas: [],
  },
  {
    id: "lc_bizplan", category: "bizplan", title: "사업계획서, 평가표부터 보고 씁니다",
    audience: "사업계획서를 직접 써 보려는 기업", minutes: 8,
    summary: "사업계획서는 평가하는 사람이 점수를 매기는 문서입니다. 공고문의 평가 항목과 배점을 먼저 보고, 항목마다 근거가 있는 문장과 숫자로 답하는 방식으로 씁니다.",
    body: [
      "평가표 확인: 공고문 · 신청 양식에 평가 항목과 배점이 있으면 목차를 그 순서에 맞춥니다.",
      "흐름: 해결하려는 문제 → 우리 해결 방법 → 시장 · 고객 → 실행 계획(일정) → 수행 역량(사람 · 경험) → 자금 사용 계획.",
      "숫자에는 출처를 붙입니다. 근거 없는 예상치는 감점 요인이 될 수 있습니다.",
      "양식 · 분량 · 글자 크기 같은 형식 조건을 지킵니다. 형식 위반으로 접수가 안 되는 경우도 있습니다.",
    ],
    prepItems: ["평가 항목 · 배점 옮겨 적기", "항목별로 쓸 근거 자료 모으기", "일정표 · 자금 사용 계획 초안", "분량 · 양식 조건 확인"],
    links: [link("bizinfo"), link("smtech")],
    programTags: ["사업화", "기술개발", "R&D", "창업", "바우처"], growthAreas: [],
  },
  {
    id: "lc_finance_basics", category: "finance", title: "이익과 현금은 다릅니다 — 자금흐름 기본",
    audience: "재무제표를 처음 정리해 보는 대표", minutes: 7,
    summary: "장부상 이익이 나도 현금이 모자랄 수 있습니다. 매출이 입금되는 시점과 비용이 나가는 시점이 다르기 때문입니다. 월별로 들어오고 나가는 돈을 표로 적어 두면 자금이 부족해지는 달을 미리 볼 수 있습니다.",
    body: [
      "재무제표 세 가지: 재무상태표(지금 가진 것과 갚을 것) · 손익계산서(일정 기간의 이익) · 현금흐름표(실제 들어오고 나간 돈).",
      "매출채권 회수 기간이 길어지면 이익이 나도 현금이 부족해집니다.",
      "대표이사와 회사 사이의 돈(가지급금 · 가수금)은 재무제표 신뢰도와 세금에 영향을 줄 수 있어 정리 방법을 미리 점검합니다.",
      "정책자금 · 보증 심사에서도 재무제표가 기본 자료입니다.",
    ],
    prepItems: ["최근 3년 재무제표 모으기", "월별 현금 유입 · 유출표 만들기", "매출채권 · 대표 관련 계정 잔액 확인"],
    links: [link("hometax")],
    programTags: ["자금", "금융"], growthAreas: ["가지급금", "가수금", "재무세무", "이익잉여금"],
  },
  {
    id: "lc_cert_rnd", category: "cert_rnd", title: "기업인증 · 연구소, 무엇부터 확인하나요",
    audience: "기술 · 연구개발을 하는 기업", minutes: 7,
    summary: "벤처기업확인 · 이노비즈 · 기업부설연구소(연구개발전담부서)는 각각 담당 기관과 요건이 다릅니다. 이 화면은 요건을 판정하지 않습니다 — 기관 안내와 관련 법령이 기준이며, 아래 순서로 우리 회사 상황을 먼저 정리합니다.",
    body: [
      "기업부설연구소 · 연구개발전담부서: 한국산업기술진흥협회가 신고를 받습니다. 연구 인력 · 독립된 연구 공간 등 요건이 정해져 있습니다.",
      "벤처기업확인: 벤처확인종합관리시스템에서 유형별 요건과 절차를 안내합니다.",
      "이노비즈(기술혁신형 중소기업): 이노비즈협회에서 평가 절차를 안내합니다.",
      "인증 · 연구소는 설립 이후 관리(인력 변동 신고 · 연구 기록 등)도 중요합니다.",
    ],
    prepItems: ["연구 인력 현황(학위 · 경력) 정리", "연구 공간 현황(도면 · 사진) 정리", "개발 중인 기술 내용 한 장 정리", "기관 안내에서 요건 확인"],
    links: [link("rnd"), link("venturein"), link("innobiz")],
    programTags: ["기술", "R&D", "인증"], growthAreas: ["기업부설연구소", "특허자본", "기업신용평가등급"],
  },
];

/** 고객 · 비회원에게 보이는 것 — 공개된 것만, 수정일 최신순 */
export const visibleLearn = (all: LearnContent[]) => all.filter((x) => x.published).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/**
 * 지원사업 하나에 맞는 학습 자료 — 자료의 꼬리표(programTags)가 공고 이름 · 분야 · 지원내용에 들어 있으면.
 * 꼬리표가 없는 자료(공고 찾기 · 공고문 읽기 · 서류)는 어느 공고에나 붙는 공통 자료로 뒤에 둔다.
 */
export function learnForProgram(all: LearnContent[], p: Pick<SupportProgram, "title" | "category" | "summary" | "tags">): LearnContent[] {
  const hay = norm(`${p.title} ${p.category} ${p.summary ?? ""} ${p.tags.join(" ")}`);
  const vis = visibleLearn(all);
  const tagged = vis.filter((x) => x.programTags.some((t) => t && hay.includes(norm(t))));
  const common = vis.filter((x) => x.programTags.length === 0 && ["read_notice", "prep_docs", "find_programs"].includes(x.category));
  const out: LearnContent[] = [];
  for (const x of [...tagged, ...common]) if (!out.some((y) => y.id === x.id)) out.push(x);
  return out.slice(0, 4);
}

/** 성장과제(분야) 하나에 맞는 학습 자료 */
export const learnForArea = (all: LearnContent[], area: string) => visibleLearn(all).filter((x) => x.growthAreas.includes(area));

/** 운영자 입력 정리 — 링크는 https 만, 영상은 YouTube 주소만 받는다. 받을 수 없는 값은 버리고 이유를 돌려준다 */
export function cleanLearnInput(x: Partial<LearnContent>): { value: Partial<LearnContent>; problems: string[] } {
  const problems: string[] = [];
  const value: Partial<LearnContent> = { ...x };
  if (x.title !== undefined && !x.title.trim()) problems.push("제목을 적어 주세요.");
  if (x.videoUrl !== undefined) {
    const v = x.videoUrl.trim();
    if (v && !youtubeId(v)) { problems.push("영상 주소는 YouTube 주소만 받습니다(youtube.com/watch?v=… · youtu.be/…)."); value.videoUrl = undefined; }
    else value.videoUrl = v || undefined;
  }
  if (x.links) {
    const ok = x.links.filter((l) => l.label.trim() && safeHttpsUrl(l.url));
    if (ok.length !== x.links.filter((l) => l.label.trim() || l.url.trim()).length) problems.push("https 로 시작하는 주소만 링크로 넣을 수 있습니다.");
    value.links = ok.map((l) => ({ label: l.label.trim(), url: safeHttpsUrl(l.url)! }));
  }
  if (x.minutes !== undefined && (!Number.isFinite(x.minutes) || x.minutes < 0 || x.minutes > 600)) { problems.push("학습 시간은 0~600분으로 적어 주세요."); value.minutes = undefined; }
  for (const k of ["prepItems", "programTags", "growthAreas", "body"] as const) if (x[k]) value[k] = x[k]!.map((s) => s.trim()).filter(Boolean);
  return { value, problems };
}
