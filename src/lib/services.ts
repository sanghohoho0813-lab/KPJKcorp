import type { Company, Contract, Opportunity, OpportunityStatus, Project } from "./types";

/**
 * KPJK 서비스 카탈로그 + 추천 규칙.
 *
 * 중요: 추천은 전부 **규칙 기반**이고, 각 추천에는 반드시 근거 문장(reason)이 붙는다.
 * 효과·금액·성공률을 만들어내지 않는다. "이런 조건이라 검토 대상"까지만 말한다.
 */

export interface ServiceDef {
  key: string;
  name: string;
  /** 고객이 읽는 한 줄 */
  blurb: string;
  /** 고객이 얻는 것 (사실 기반 서술만) */
  points: string[];
  /** 이 서비스가 검토 대상인지 판단하는 규칙. 해당하면 근거 문장을 돌려준다. */
  match: (ctx: RecoContext) => string | null;
  /** 예전 카탈로그 — 이미 등록된 기회를 읽기 위해 남겨 두고, 고객 화면 목록에는 내놓지 않는다 */
  legacy?: boolean;
}

export interface RecoContext {
  company: Company;
  projects: Project[];
  contracts: Contract[];
  /** 이미 기회로 등록된 serviceKey */
  existing: Set<string>;
}

const hasType = (ctx: RecoContext, kw: string) => ctx.projects.some((p) => p.type.includes(kw) || p.name.includes(kw));
const finishing = (ctx: RecoContext) => ctx.projects.some((p) => ["drafting", "ceo_meeting", "done", "aftercare"].includes(p.stage));

export const SERVICES: ServiceDef[] = [
  {
    key: "venture",
    name: "벤처기업확인",
    blurb: "연구개발·기술평가 유형으로 벤처기업 확인을 검토합니다.",
    points: ["확인 유형별 요건 진단", "필요 서류 체크리스트", "신청 일정 관리"],
    match: (ctx) =>
      hasType(ctx, "연구소") || hasType(ctx, "기술")
        ? "기업부설연구소 관련 진행 이력이 있어 연구개발 유형 요건을 함께 검토할 수 있습니다."
        : ctx.company.employees <= 60
          ? "중소기업 규모 기준에 해당하여 확인 유형 검토가 가능합니다."
          : null,
  },
  {
    key: "rnd_lab",
    name: "기업부설연구소 · 사후관리",
    blurb: "설립뿐 아니라 연구노트·인력·변경신고까지 이어지는 사후관리를 다룹니다.",
    points: ["요건 진단 및 설립", "연구노트·과제 관리", "변경신고 일정 관리"],
    match: (ctx) =>
      hasType(ctx, "연구소")
        ? "연구소 관련 프로젝트가 진행 중이라 설립 이후 사후관리 범위를 이어서 검토할 수 있습니다."
        : ctx.company.industry.includes("IT") || ctx.company.industry.includes("바이오") || ctx.company.industry.includes("소재")
          ? "업종 특성상 연구개발 인력이 있는 경우 연구소 요건 검토 대상이 됩니다."
          : null,
  },
  {
    key: "ip",
    name: "특허 · 지식재산",
    blurb: "보유 기술의 권리화 가능성과 출원 순서를 정리합니다.",
    points: ["선행기술 검토 범위 안내", "출원 우선순위 정리", "연구소·벤처 요건과 연계"],
    match: (ctx) =>
      hasType(ctx, "연구소") || ctx.company.industry.includes("제조") || ctx.company.industry.includes("소재")
        ? "기술 기반 업종으로, 권리화 대상이 있는지 한 번 정리해볼 수 있습니다."
        : null,
  },
  {
    key: "policy_fund",
    name: "정책자금 · 자금전략",
    blurb: "현재 재무구조에서 접근 가능한 기관과 준비 순서를 정리합니다.",
    points: ["기관별 요건 대비 현황 진단", "준비 서류·일정", "신청 전 재무 정비 항목"],
    match: (ctx) =>
      hasType(ctx, "정책자금")
        ? null
        : ctx.company.memo.includes("자금") || ctx.company.memo.includes("증설") || ctx.company.memo.includes("공장")
          ? "상담 기록에 설비·자금 관련 계획이 남아 있어 자금전략을 함께 검토할 수 있습니다."
          : "진행 중인 과제와 별개로, 자금 조달 계획이 있으면 기관별 요건을 미리 점검할 수 있습니다.",
  },
  {
    key: "corp_cleanup",
    name: "법인 정비 (가지급금 · 정관 · 주식)",
    blurb: "가지급금, 정관, 자기주식 등 법인 구조 항목을 점검합니다.",
    points: ["항목별 현황 진단", "정비 순서 설계", "세무·법무 검토 연계"],
    match: (ctx) =>
      ctx.company.memo.includes("승계") || ctx.company.memo.includes("정관") || ctx.company.memo.includes("법인")
        ? "상담 기록에 법인 구조 관련 논의가 있어 정비 항목을 정리해볼 수 있습니다."
        : ctx.company.employees >= 50
          ? "일정 규모 이상 법인은 가지급금·정관 항목을 주기적으로 점검하는 것이 일반적입니다."
          : null,
  },
  {
    key: "cert",
    name: "기업인증 (메인비즈 · 이노비즈 · ISO)",
    blurb: "현재 확보 가능한 인증과 준비 부담을 비교합니다.",
    points: ["인증별 요건 대비 현황", "준비 기간·서류 비교", "취득 후 활용 범위"],
    match: (ctx) =>
      finishing(ctx)
        ? "진행 중인 과제가 마무리 단계에 있어, 다음 단계로 인증 요건을 검토하기 좋은 시점입니다."
        : null,
  },
  {
    key: "hr_subsidy",
    name: "고용지원금 진단",
    blurb: "현재 인력 구성에서 해당 가능성이 있는 지원금을 진단합니다.",
    points: ["가입자 명부 기준 진단", "지원금별 요건 확인", "신청 일정 관리"],
    match: (ctx) =>
      ctx.company.employees >= 20
        ? `상시 인력 ${ctx.company.employees}명 규모로, 인력 기준 지원금 해당 여부를 진단해볼 수 있습니다.`
        : null,
  },
];

for (const sv of SERVICES) sv.legacy = true;

/**
 * KPJK 맞춤컨설팅 분야 — kpjkcorporation.com 의 분야 그대로(2026-10-01).
 * 고객 화면 "함께 검토해볼 수 있는 것"에는 이 분야만 나온다. 설명은 "무엇을 함께 보는지"까지만 쓴다 —
 * 효과·금액·성공 여부는 쓰지 않는다. 왜 이 회사에 제안하는지는 담당 컨설턴트가 직접 적는다.
 */
const K = (name: string, blurb: string, points: string[]): ServiceDef => ({ key: `kpjk_${name}`, name, blurb, points, match: () => null });
export const KPJK_SERVICES: ServiceDef[] = [
  K("가지급금", "대표이사 가지급금이 생긴 원인과 잔액을 확인하고 정리 방법을 함께 검토합니다.", ["발생 원인·잔액 확인", "인정이자 등 세무 부담 점검", "정리 방법별 장단점 비교"]),
  K("가수금", "대표가 회사에 넣은 돈(가수금)의 처리 방법과 재무제표에 주는 영향을 점검합니다.", ["잔액·발생 경위 확인", "상환·자본 전환 등 처리 방법 비교", "재무비율 영향 점검"]),
  K("이익잉여금", "쌓여 있는 이익잉여금(미처분이익잉여금)의 활용·정리 방향을 검토합니다.", ["잉여금 규모·구성 확인", "배당·이익소각 등 활용 방법 비교", "주식가치·승계와의 관계 점검"]),
  K("이익소각", "이익으로 자기주식을 소각하는 절차와 요건을 검토합니다.", ["상법·정관 요건 확인", "절차·일정 정리", "세무 검토가 필요한 부분 구분"]),
  K("자사주매입", "회사가 자기주식을 취득하는 방법과 요건을 점검합니다.", ["배당가능이익 등 요건 확인", "취득 절차·서류 정리", "취득 후 처리 방향 검토"]),
  K("주식명의신탁", "다른 사람 명의로 되어 있는 주식을 실제 소유자에게 되돌리는 방법을 검토합니다.", ["명의신탁 경위·증빙 확인", "환원 방법별 절차 비교", "세무 위험 점검"]),
  K("가업승계", "회사와 지분을 다음 세대로 넘기는 순서와 준비 항목을 정리합니다.", ["현재 지분·주식가치 확인", "승계 방법·시점 검토", "관련 제도 요건 점검"]),
  K("상속증여", "상속·증여에 앞서 미리 준비할 항목과 순서를 정리합니다.", ["재산·지분 현황 정리", "증여·상속 방법 비교", "세무 검토가 필요한 부분 구분"]),
  K("법인전환", "개인사업자의 법인 전환 방법과 준비 순서를 검토합니다.", ["전환 방법별 비교", "절차·일정·서류 정리", "전환 전후 세무 점검"]),
  K("세무조사", "세무조사에 대비해 미리 점검할 항목과 자료를 정리합니다.", ["취약 항목 사전 점검", "증빙·자료 정리", "대응 순서 안내"]),
  K("재무세무", "재무제표와 세무 신고 현황을 함께 점검합니다.", ["재무제표 주요 항목 점검", "세무 이슈 정리", "개선 순서 제안"]),
  K("인사노무", "근로계약·취업규칙 등 인사노무 기본 항목을 점검합니다.", ["근로계약·규정 현황 확인", "보완이 필요한 항목 정리", "개선 순서 안내"]),
  K("기업부설연구소", "기업부설연구소(연구개발전담부서) 설립 요건과 설립 후 관리를 검토합니다.", ["인력·공간 요건 확인", "신고 서류 정리", "설립 후 관리 항목 안내"]),
  K("특허자본", "보유 특허를 자본으로 활용하는 방법(현물출자 등)을 검토합니다.", ["보유 특허 현황 확인", "활용 방법·절차 검토", "평가·법무가 필요한 부분 구분"]),
  K("기업신용평가등급", "기업신용평가 등급에 영향을 주는 항목을 점검합니다.", ["현재 등급·평가 항목 확인", "재무 항목 개선 포인트 정리", "개선 순서 제안"]),
];

/** 지원사업 공고 문의 — 고객이 "이 공고 물어보기"를 누를 때 매출기회로 들어가는 이름. 추천 목록에는 나오지 않는다 */
export const PROGRAM_SERVICE: ServiceDef = { key: "support_program", name: "지원사업 검토", blurb: "공고 내용과 회사 조건을 담당 컨설턴트가 함께 확인합니다.", points: ["공고 대상·자격 확인", "준비 서류·일정 정리"], match: () => null };

export const SERVICE_BY_KEY = Object.fromEntries([...SERVICES, ...KPJK_SERVICES, PROGRAM_SERVICE].map((s) => [s.key, s]));

export interface Reco {
  service: ServiceDef;
  reason: string;
}

/** 고객 Portal에 보여줄 추천. 이미 기회로 등록된 것은 제외하고 최대 limit개. */
export function recommendServices(ctx: RecoContext, limit = 3): Reco[] {
  const out: Reco[] = [];
  for (const s of SERVICES) {
    if (s.legacy || ctx.existing.has(s.key)) continue;
    const reason = s.match(ctx);
    if (reason) out.push({ service: s, reason });
    if (out.length >= limit) break;
  }
  return out;
}

export const OPP_STATUS: Record<OpportunityStatus, { label: string; clientLabel: string; tone: "neutral" | "success" | "warning" | "error" | "info" | "accent" }> = {
  interest: { label: "관심 접수", clientLabel: "접수됨", tone: "accent" },
  contacted: { label: "담당자 확인", clientLabel: "담당자 확인 중", tone: "info" },
  approval_pending: { label: "대표 승인대기", clientLabel: "검토 중", tone: "warning" },
  proposed: { label: "제안 · 견적", clientLabel: "제안 준비 중", tone: "info" },
  won: { label: "추가계약", clientLabel: "진행 확정", tone: "success" },
  dropped: { label: "종료", clientLabel: "종료", tone: "neutral" },
};

/** 기회 파이프라인 순서 (보드 컬럼 / 전환율 계산용) */
export const OPP_PIPELINE: OpportunityStatus[] = ["interest", "contacted", "approval_pending", "proposed", "won"];

export function oppNextStatus(s: OpportunityStatus): OpportunityStatus | null {
  const i = OPP_PIPELINE.indexOf(s);
  return i >= 0 && i < OPP_PIPELINE.length - 1 ? OPP_PIPELINE[i + 1] : null;
}

/** 고객 Portal에 노출해도 되는 기회인지 — 종료된 것은 감춘다. */
export function isClientVisibleOpp(o: Opportunity) {
  return o.status !== "dropped";
}
