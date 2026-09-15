import type { Company, EntityType } from "./types";

/**
 * 기업고객 입력 화면의 "클릭으로 고르는" 선택지.
 *
 * 원칙
 * - 타자보다 클릭. 컨설턴트가 상담 중 휴대폰으로도 30초 안에 등록할 수 있어야 한다.
 * - 선택지는 KPJK가 실제로 다루는 자문 분야(kpjkcorporation.com 기준)와
 *   사업자등록증·등기부등본에 적힌 항목에서만 뽑는다. 짐작으로 늘리지 않는다.
 * - 정확한 값(임직원 수·매출액)은 언제든 직접 칠 수 있고, 없으면 구간만 고른다.
 */

export const ENTITY_TYPES: { key: EntityType; label: string; hint: string }[] = [
  { key: "corporation", label: "법인", hint: "주식회사·유한회사 등" },
  { key: "sole", label: "개인사업자", hint: "법인등록번호 없음" },
  { key: "other", label: "기타", hint: "비영리·조합 등" },
];

/** 시·도 17개 — 사업자등록증 주소에서 자동으로 맞춘다 */
export const REGIONS = ["서울", "경기", "인천", "부산", "대구", "대전", "광주", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];

/** 주소 문자열에서 시·도를 찾는다. 못 찾으면 undefined — 지어내지 않는다 */
export function regionOfAddress(address: string | undefined): string | undefined {
  if (!address) return undefined;
  const a = address.replace(/\s+/g, "");
  const MAP: [RegExp, string][] = [
    [/^서울/, "서울"], [/^경기/, "경기"], [/^인천/, "인천"], [/^부산/, "부산"], [/^대구/, "대구"], [/^대전/, "대전"],
    [/^광주/, "광주"], [/^울산/, "울산"], [/^세종/, "세종"], [/^강원/, "강원"], [/^충청북도|^충북/, "충북"], [/^충청남도|^충남/, "충남"],
    [/^전라북도|^전북/, "전북"], [/^전라남도|^전남/, "전남"], [/^경상북도|^경북/, "경북"], [/^경상남도|^경남/, "경남"], [/^제주/, "제주"],
  ];
  for (const [re, r] of MAP) if (re.test(a)) return r;
  return undefined;
}

/** 업종 — 사업자등록증 "업태" 표기와 실제 고객군 기준. 직접 입력도 가능하다 */
export const INDUSTRY_CHIPS = ["제조업", "정보통신(IT)", "도매·소매", "건설업", "운수·물류", "전문·기술서비스", "식품", "바이오·의료", "교육·서비스", "부동산·임대", "숙박·음식"];

export const EMPLOYEE_BANDS: { key: string; label: string; min: number; max?: number }[] = [
  { key: "1-4", label: "1~4명", min: 1, max: 4 },
  { key: "5-9", label: "5~9명", min: 5, max: 9 },
  { key: "10-29", label: "10~29명", min: 10, max: 29 },
  { key: "30-49", label: "30~49명", min: 30, max: 49 },
  { key: "50-99", label: "50~99명", min: 50, max: 99 },
  { key: "100-299", label: "100~299명", min: 100, max: 299 },
  { key: "300+", label: "300명 이상", min: 300 },
];

export const REVENUE_BANDS: { key: string; label: string }[] = [
  { key: "<10", label: "10억 미만" },
  { key: "10-50", label: "10~50억" },
  { key: "50-100", label: "50~100억" },
  { key: "100-300", label: "100~300억" },
  { key: "300-1000", label: "300~1,000억" },
  { key: "1000+", label: "1,000억 이상" },
];

/** 정확한 인원이 있으면 그 구간을 돌려준다 (클릭 칩과 숫자를 맞춰 보여주기 위해) */
export function bandOfEmployees(n: number | undefined): string | undefined {
  if (!n || n <= 0) return undefined;
  return EMPLOYEE_BANDS.find((b) => n >= b.min && (b.max === undefined || n <= b.max))?.key;
}

/**
 * 관심 컨설팅 분야 — kpjkcorporation.com 맞춤컨설팅·자문분야 태그 기준.
 * 프로젝트 유형(PROJECT_TYPES)보다 잘게 나뉜다: 상담 초기에 "무엇 때문에 왔는가"를 기록하는 용도다.
 */
export const CONSULT_AREAS: { key: string; label: string; group: string }[] = [
  { key: "policy_fund", label: "정책자금", group: "자금" },
  { key: "employment_grant", label: "고용지원금", group: "자금" },
  { key: "credit_rating", label: "기업신용평가등급", group: "자금" },
  { key: "rnd_lab", label: "기업부설연구소", group: "인증" },
  { key: "venture", label: "벤처기업확인", group: "인증" },
  { key: "cert", label: "기업인증(메인비즈·이노비즈·ISO)", group: "인증" },
  { key: "patent_capital", label: "특허자본화", group: "인증" },
  { key: "provisional", label: "가지급금", group: "법인" },
  { key: "suspense", label: "가수금", group: "법인" },
  { key: "retained", label: "이익잉여금·이익소각", group: "법인" },
  { key: "treasury", label: "자사주매입", group: "법인" },
  { key: "nominee", label: "주식명의신탁", group: "법인" },
  { key: "succession", label: "가업승계", group: "법인" },
  { key: "conversion", label: "법인전환", group: "법인" },
  { key: "articles", label: "정관정비", group: "법인" },
  { key: "tax_audit", label: "세무조사 대응", group: "세무·노무" },
  { key: "hr", label: "인사노무", group: "세무·노무" },
];
export const CONSULT_AREA_LABEL: Record<string, string> = Object.fromEntries(CONSULT_AREAS.map((a) => [a.key, a.label]));

export const LEAD_SOURCES = ["홈페이지 문의", "지인·고객 소개", "세미나·교육", "광고", "기존 고객", "제휴(세무사·회계사)", "기타"];

export const CONTACT_TITLES = ["대표이사", "이사", "경영지원팀장", "재무팀장", "회계담당", "총무", "기타"];

/** 업태 칩 — 사업자등록증에 실제로 쓰이는 표기 */
export const BIZ_CATEGORIES = ["제조업", "도매 및 소매업", "건설업", "정보통신업", "서비스업", "운수 및 창고업", "전문, 과학 및 기술 서비스업", "부동산업", "숙박 및 음식점업", "교육 서비스업", "보건업"];

/* ---------------- 표시 헬퍼 ---------------- */

export function employeesText(c: Pick<Company, "employees" | "employeeBand">) {
  if (c.employees > 0) return `${c.employees}명`;
  const b = EMPLOYEE_BANDS.find((x) => x.key === c.employeeBand);
  return b ? b.label : "";
}

export function revenueText(c: Pick<Company, "revenue" | "revenueBand">) {
  if (c.revenue?.trim()) return c.revenue.trim();
  const b = REVENUE_BANDS.find((x) => x.key === c.revenueBand);
  return b ? b.label : "";
}

/** "정밀부품 제조 · 118명 · 매출 420억" — 없는 항목은 그냥 빼고 이어 붙인다 */
export function companySummary(c: Company) {
  const emp = employeesText(c);
  const rev = revenueText(c);
  return [c.industry, emp && `임직원 ${emp}`, rev && `매출 ${rev}`].filter(Boolean).join(" · ");
}

/** 설립일로부터 업력(년). 설립일이 없으면 undefined */
export function yearsSince(dateStr: string | undefined, now = new Date()): number | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return undefined;
  let y = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) y -= 1;
  return y < 0 ? 0 : y;
}

/* ---------------- 입력 정리 (자동 서식) ---------------- */

export function formatBizNo(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export function formatCorpNo(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 13);
  if (d.length <= 6) return d;
  return `${d.slice(0, 6)}-${d.slice(6)}`;
}

export function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.startsWith("02")) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
