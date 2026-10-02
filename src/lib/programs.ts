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

  // 지역 — 다른 시·도 전용 공고는 뺀다
  if (p.regions.length) {
    if (prof.region && !p.regions.includes(prof.region)) return null;
    if (prof.region) { score += 3; reasons.push(`지역 맞음: ${prof.region}`); }
    else cautions.push(`${p.regions.join("·")} 지역 대상`);
  } else {
    score += 1; reasons.push("전국 대상");
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

/* ------------------------------ 기업마당 공고 읽기 ------------------------------ */

const LONG_REGION: Record<string, string> = {
  서울특별시: "서울", 부산광역시: "부산", 대구광역시: "대구", 인천광역시: "인천", 광주광역시: "광주", 대전광역시: "대전", 울산광역시: "울산",
  세종특별자치시: "세종", 경기도: "경기", 강원도: "강원", 강원특별자치도: "강원", 충청북도: "충북", 충청남도: "충남", 전라북도: "전북",
  전북특별자치도: "전북", 전라남도: "전남", 경상북도: "경북", 경상남도: "경남", 제주특별자치도: "제주",
};
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
    regions: regionsIn(`${title} ${tags.join(" ")}`),
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
