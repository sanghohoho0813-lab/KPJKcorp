/**
 * 정부지원사업 공고 매칭 (베타) — 순수 함수.
 *
 * "이 회사가 받을 수 있다"고 판정하지 않는다. 공고 제목·대상·지역·분야와 회사의 기본 조건(지역·업종·업력·인원·관심 분야)을
 * 맞춰 보고, 검토해 볼 만한 공고를 고르면서 왜 골랐는지(근거)를 함께 돌려준다. 세부 자격은 공고문과 담당 컨설턴트가 확인한다.
 * 근거가 분명히 맞지 않는 것(다른 지역 전용, 마감 지남, 예비창업 전용인데 이미 사업 중 등)만 뺀다.
 */
import type { Company, EntityType, ProgramCategory, SupportProgram } from "./types";
import { REGIONS } from "./company-options";

export const PROGRAM_CATEGORIES: ProgramCategory[] = ["금융", "기술", "인력", "수출", "내수", "창업", "경영", "기타"];
export const CATEGORY_LABEL: Record<ProgramCategory, string> = {
  금융: "자금·대출", 기술: "기술·R&D", 인력: "인력·고용", 수출: "수출", 내수: "판로·마케팅", 창업: "창업", 경영: "경영·컨설팅", 기타: "기타",
};

/** 매칭에 쓰는 회사 조건 — 고객 기업이든 가망고객이 입력한 값이든 같은 모양 */
export interface MatchProfile {
  region?: string;
  /** 시·군 (주소에서. 예: 화성시) — 시·군 단위 공고를 가려낸다 */
  city?: string;
  /** 업종·업태·종목을 이어 붙인 글 */
  industry?: string;
  foundedYear?: number;
  employees?: number;
  entityType?: EntityType;
  interests?: ProgramCategory[];
}

export function profileOfCompany(c: Company): MatchProfile {
  const y = c.establishedAt ? Number(c.establishedAt.slice(0, 4)) : undefined;
  const bandMin = c.employeeBand ? Number(c.employeeBand.split(/[-+]/)[0]) : undefined;
  return {
    // 지역 칸이 비어 있으면 주소 앞부분(경기 화성시 → 경기)으로 — 주소만 넣은 고객이 많다
    region: c.region || (c.address ? regionsIn(c.address)[0] : undefined),
    city: c.address ? citiesIn(c.address)[0] : undefined,
    industry: [c.industry, c.bizCategory, c.bizItem].filter(Boolean).join(" "),
    foundedYear: y && y > 1900 ? y : undefined,
    employees: c.employees || bandMin || undefined,
    entityType: c.entityType,
  };
}

/** 업종 묶음 — 회사 쪽 글과 공고 쪽 글에 같은 묶음 낱말이 있으면 "업종 맞음" */
const INDUSTRY_GROUPS: [string, RegExp][] = [
  ["제조", /제조|생산|공장|스마트공장|뿌리|부품|소재|가공|기계|금속/],
  ["IT·SW", /소프트웨어|\bSW\b|ICT|정보통신|디지털|인공지능|\bAI\b|플랫폼|데이터|클라우드|IT/],
  ["식품·외식", /식품|외식|음식|농식품|커피|제과|카페/],
  ["관광·숙박", /관광|숙박|여행/],
  ["콘텐츠·문화", /콘텐츠|문화|게임|미디어|디자인/],
  ["바이오·의료", /바이오|의료|헬스|제약|화장품/],
  ["에너지·환경", /에너지|탄소|친환경|ESG|환경|재생/],
  ["건설", /건설|건축|인테리어/],
  ["유통·도소매", /유통|도소매|도매|소매|쇼핑몰|이커머스|온라인 ?판매/],
  ["물류·운송", /물류|운송|배송|택배/],
];
const groupsOf = (text: string) => INDUSTRY_GROUPS.filter(([, re]) => re.test(text)).map(([g]) => g);

export interface ProgramMatch {
  program: SupportProgram;
  score: number;
  reasons: string[];
  cautions: string[];
  /** 마감 표시 */
  deadline: { label: string; urgent: boolean; daysLeft?: number };
}

const DAY = 864e5;
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export function deadlineOf(p: SupportProgram, now = new Date()): ProgramMatch["deadline"] & { closed: boolean } {
  if (!p.applyEnd) return { label: p.periodText?.trim() || "상시·예산 소진 시", urgent: false, closed: false };
  const today = ymd(now);
  if (p.applyEnd < today) return { label: "마감", urgent: false, closed: true };
  const days = Math.round((Date.parse(`${p.applyEnd}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / DAY);
  if (days === 0) return { label: "오늘 마감", urgent: true, daysLeft: 0, closed: false };
  return { label: `D-${days}`, urgent: days <= 7, daysLeft: days, closed: false };
}

/** 공고 하나를 회사 조건에 맞춰 본다. 맞지 않는 근거가 분명하면 null */
export function matchProgram(p: SupportProgram, prof: MatchProfile, now = new Date()): ProgramMatch | null {
  const dl = deadlineOf(p, now);
  if (dl.closed) return null;
  const reasons: string[] = [];
  const cautions: string[] = [];
  let score = 0;
  const text = `${p.title} ${p.target ?? ""} ${p.summary ?? ""} ${p.tags.join(" ")}`;

  // 지역 — 다른 시·도 전용 공고는 뺀다. 전국 공고는 "지역 맞음"이 아니다(점수 없음)
  const regions = programRegions(p);
  if (regions.length) {
    if (prof.region && !regions.includes(prof.region)) return null;
    if (prof.region) {
      // 시·군 단위 공고(예: "안산시 소상공인 …")는 그 시·군 회사만
      const cities = citiesIn(`${p.title} ${p.target ?? ""}`);
      if (cities.length && prof.city && !cities.includes(prof.city)) return null;
      if (cities.length && !prof.city) cautions.push(`${cities.join("·")} 대상 — 회사 소재 시·군 확인 필요`);
      else { score += 3; reasons.push(`지역 맞음: ${cities.length ? cities.join("·") : prof.region}`); }
    } else cautions.push(`${regions.join("·")} 지역 대상`);
  } else {
    reasons.push("전국 대상");
  }

  // 업력 — 예비창업 전용 / "창업 N년 이내"
  const age = prof.foundedYear ? now.getFullYear() - prof.foundedYear : undefined;
  if (/예비\s*창업/.test(text) && !/기창업|창업\s*\d+\s*년/.test(text)) {
    if (age !== undefined) return null;
  }
  const within = /(?:창업|업력)\s*(\d{1,2})\s*년\s*(?:이내|미만|이하)/.exec(text) ?? /(\d{1,2})\s*년\s*(?:이내|미만)\s*(?:창업|기업)/.exec(text);
  if (within && age !== undefined) {
    const n = Number(within[1]);
    if (age > n) return null;
    score += 2; reasons.push(`업력 ${n}년 이내 조건: 업력 ${age}년`);
  } else if (!within && age !== undefined && age > 7 && /창업\s*(?:기업|벤처)|초기\s*창업|스타트업/.test(`${p.title} ${p.target ?? ""}`)) {
    // 창업기업은 보통 업력 7년 이내(중소기업창업 지원법). 빼지는 않고 맞는 고객에서 내린다
    score -= 2; cautions.push(`창업기업(업력 7년 이내) 대상일 수 있음 — 업력 ${age}년`);
  }

  // 업종
  const mine = prof.industry ? groupsOf(prof.industry) : [];
  const theirs = groupsOf(text);
  const both = mine.filter((g) => theirs.includes(g));
  if (both.length) { score += 3; reasons.push(`업종 맞음: ${both.join("·")}`); }
  else if (theirs.length && mine.length) { score -= 1; cautions.push(`${theirs.join("·")} 업종 중심 공고`); }

  // 관심 분야
  if (prof.interests?.includes(p.category)) { score += 2; reasons.push(`관심 분야: ${CATEGORY_LABEL[p.category]}`); }

  // 소상공인 전용 — 인원이 많으면 확인 필요(업종별 기준이 달라 빼지는 않는다)
  if (/소상공인/.test(text) && (prof.employees ?? 0) >= 10) cautions.push("소상공인 기준(상시근로자 수) 확인 필요");
  if (/개인사업자/.test(text) && !/법인/.test(text) && prof.entityType === "corporation") cautions.push("개인사업자 대상인지 확인 필요");

  if (dl.urgent) reasons.push(dl.daysLeft === 0 ? "오늘 마감" : `마감 ${dl.daysLeft}일 남음`);
  return { program: p, score, reasons, cautions, deadline: { label: dl.label, urgent: dl.urgent, daysLeft: dl.daysLeft } };
}

/** 회사 조건에 맞는 공고 목록. strong = 근거가 하나 이상 구체적인 것(전국 대상만으로는 아님) */
export function matchPrograms(programs: SupportProgram[], prof: MatchProfile, opts: { now?: Date; strongOnly?: boolean } = {}) {
  const now = opts.now ?? new Date();
  return programs
    .map((p) => matchProgram(p, prof, now))
    .filter((m): m is ProgramMatch => !!m && (!opts.strongOnly || m.score >= 3))
    .sort((a, b) => b.score - a.score || (a.deadline.daysLeft ?? 999) - (b.deadline.daysLeft ?? 999));
}

/**
 * 고객 화면용 — 담당자가 알림으로 보낸 공고(규칙과 상관없이 늘 맨 위) + 규칙으로 맞는 공고.
 * 보낸 공고가 규칙에서 빠지는 경우(예: 담당자가 판단해 보낸 전국 공고)에도 고객에게 보여야 알림과 화면이 어긋나지 않는다.
 */
export function programsForCompany(programs: SupportProgram[], companyId: string, prof: MatchProfile, now = new Date()) {
  const sent: ProgramMatch[] = [];
  const sentIds = new Set<string>();
  for (const p of programs) {
    if (!p.notified.includes(companyId)) continue;
    const dl = deadlineOf(p, now);
    if (dl.closed) continue;
    const m = matchProgram(p, prof, now);
    const base: ProgramMatch = m ?? { program: p, score: 0, reasons: [], cautions: [], deadline: { label: dl.label, urgent: dl.urgent, daysLeft: dl.daysLeft } };
    sent.push({ ...base, reasons: ["담당 컨설턴트 추천", ...base.reasons] });
    sentIds.add(p.id);
  }
  sent.sort((a, b) => (a.deadline.daysLeft ?? 999) - (b.deadline.daysLeft ?? 999));
  const matches = matchPrograms(programs, prof, { now, strongOnly: true }).filter((m) => !sentIds.has(m.program.id));
  return { sent, matches };
}

/* ------------------------------ 기업마당 공고 읽기 ------------------------------ */

const LONG_REGION: Record<string, string> = {
  서울특별시: "서울", 부산광역시: "부산", 대구광역시: "대구", 인천광역시: "인천", 광주광역시: "광주", 대전광역시: "대전", 울산광역시: "울산",
  세종특별자치시: "세종", 경기도: "경기", 강원도: "강원", 강원특별자치도: "강원", 충청북도: "충북", 충청남도: "충남", 전라북도: "전북",
  전북특별자치도: "전북", 전라남도: "전남", 경상북도: "경북", 경상남도: "경남", 제주특별자치도: "제주",
};
/**
 * 공고가 실제로 어느 시·도 공고인가.
 * 기업마당 해시태그에는 전국 17개 시·도가 다 붙어 오는 공고가 많다 — 그대로 믿으면 모든 회사가 "지역 맞음"이 된다.
 * 순서: 공고명의 지역([경기] · 경북 TIPS) → 소관 기관이 지자체면 그 지역(경상북도·대전광역시) → 해시태그 지역이 3곳 이하일 때만 → 아니면 전국.
 * 담당자가 직접 넣은 공고는 고른 지역 그대로.
 */
export function programRegions(p: Pick<SupportProgram, "source" | "title" | "agency" | "regions">): string[] {
  if (p.source === "manual") return p.regions;
  const fromTitle = regionsIn(p.title);
  if (fromTitle.length && fromTitle.length <= 3) return fromTitle;
  const fromAgency = regionsIn(p.agency ?? "");
  if (fromAgency.length === 1) return fromAgency;
  return p.regions.length && p.regions.length <= 3 ? p.regions : [];
}

/** 시·군 이름 (자치구 제외). 주소·공고명에서 "화성시", "화천군"처럼 낱말로 나온 것만 */
const CITY_NAMES = [
  "수원시", "성남시", "의정부시", "안양시", "부천시", "광명시", "평택시", "동두천시", "안산시", "고양시", "과천시", "구리시", "남양주시", "오산시", "시흥시", "군포시", "의왕시", "하남시", "용인시", "파주시", "이천시", "안성시", "김포시", "화성시", "양주시", "포천시", "여주시",
  "춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시", "청주시", "충주시", "제천시", "천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시", "당진시",
  "전주시", "군산시", "익산시", "정읍시", "남원시", "김제시", "목포시", "여수시", "순천시", "나주시", "광양시",
  "포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시", "상주시", "문경시", "경산시", "창원시", "진주시", "통영시", "사천시", "김해시", "밀양시", "거제시", "양산시", "제주시", "서귀포시",
  "가평군", "양평군", "연천군", "홍천군", "횡성군", "영월군", "평창군", "정선군", "철원군", "화천군", "양구군", "인제군", "고성군", "양양군",
  "보은군", "옥천군", "영동군", "증평군", "진천군", "괴산군", "음성군", "단양군", "금산군", "부여군", "서천군", "청양군", "홍성군", "예산군", "태안군",
  "완주군", "진안군", "무주군", "장수군", "임실군", "순창군", "고창군", "부안군", "담양군", "곡성군", "구례군", "고흥군", "보성군", "화순군", "장흥군", "강진군", "해남군", "영암군", "무안군", "함평군", "영광군", "장성군", "완도군", "진도군", "신안군",
  "군위군", "의성군", "청송군", "영양군", "영덕군", "청도군", "고령군", "성주군", "칠곡군", "예천군", "봉화군", "울진군", "울릉군",
  "의령군", "함안군", "창녕군", "남해군", "하동군", "산청군", "함양군", "거창군", "합천군", "기장군", "달성군", "강화군", "옹진군", "울주군",
];
export function citiesIn(text: string): string[] {
  const out: string[] = [];
  for (const c of CITY_NAMES) {
    // "화성시" · "화성 시" 는 잡고, "남화성시" 같은 앞 글자 붙은 것은 버린다
    const re = new RegExp(`(^|[^가-힣])${c.slice(0, -1)}\\s?${c.slice(-1)}(?![가-힣])`);
    if (re.test(text) && !out.includes(c)) out.push(c);
  }
  return out;
}

export function regionsIn(text: string): string[] {
  const out = new Set<string>();
  for (const [long, short] of Object.entries(LONG_REGION)) if (text.includes(long)) out.add(short);
  // [경기] · (경남) · 경기 지역 · 서울시 처럼 짧은 이름이 낱말로 나온 것
  for (const r of REGIONS) if (new RegExp(`(^|[\\s\\[(·,])${r}(?=$|[\\s\\])·,]|지역|시|도|소재)`).test(text)) out.add(r);
  return [...out];
}

const CAT_OF: [RegExp, ProgramCategory][] = [[/금융|자금|융자|보증|대출/, "금융"], [/기술|R&D|연구/, "기술"], [/인력|고용|채용/, "인력"], [/수출|해외/, "수출"], [/내수|판로|마케팅|홍보/, "내수"], [/창업/, "창업"], [/경영|컨설팅/, "경영"]];
export function categoryOf(raw: string): ProgramCategory {
  for (const [re, c] of CAT_OF) if (re.test(raw)) return c;
  return "기타";
}

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim() : "");
function dateOf(raw: string): string | undefined {
  const m = /(\d{4})[.\-/]?\s*(\d{1,2})[.\-/]?\s*(\d{1,2})/.exec(raw);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) return undefined;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 기업마당 지원사업 API 한 건 → 공고. 필수 값(id·제목)이 없으면 null */
export function normalizeBizinfo(item: Record<string, unknown>, fetchedAt: string): SupportProgram | null {
  // 기업마당 공식 응답은 같은 값을 두 이름으로 주기도 한다(pblancNm/title, pblancUrl/link, hashTags …). 앞의 것이 우선
  const pick = (...keys: string[]) => { for (const k of keys) { const v = clean(item[k]); if (v) return v; } return ""; };
  const id = pick("pblancId", "seq");
  const title = pick("pblancNm", "title");
  if (!id || !title) return null;
  const period = pick("reqstBeginEndDe", "reqstDt");
  const [startRaw, endRaw] = period.split(/~/);
  const tags = pick("hashTags", "hashtags").split(",").map((t) => t.trim()).filter(Boolean);
  const rawUrl = pick("pblancUrl", "link");
  const url = rawUrl ? (/^https?:/.test(rawUrl) ? rawUrl : `https://www.bizinfo.go.kr${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`) : undefined;
  const target = clean(item.trgetNm);
  const applyStart = startRaw ? dateOf(startRaw) : undefined;
  const applyEnd = endRaw ? dateOf(endRaw) : undefined;
  return {
    id: `bz_${id}`,
    title,
    agency: pick("jrsdInsttNm", "author"),
    operator: clean(item.excInsttNm) || undefined,
    category: categoryOf(pick("pldirSportRealmLclasCodeNm", "lcategory") || title),
    regions: programRegions({ source: "bizinfo", title, agency: pick("jrsdInsttNm", "author"), regions: regionsIn(tags.join(" ")) }),
    target: target || undefined,
    summary: pick("bsnsSumryCn", "description").slice(0, 600) || undefined,
    applyStart,
    applyEnd,
    periodText: applyEnd ? undefined : period || undefined,
    url,
    tags,
    source: "bizinfo",
    notified: [],
    fetchedAt,
  };
}

/** 응답 모양이 조금 달라도 목록을 꺼낸다 (jsonArray · items · 배열) */
export function bizinfoItems(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    for (const k of ["jsonArray", "items", "item", "data"]) {
      const v = o[k];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
      if (v && typeof v === "object") { const inner = bizinfoItems(v); if (inner.length) return inner; }
    }
  }
  return [];
}
