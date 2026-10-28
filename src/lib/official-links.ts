/**
 * 공식 기관 주소 — 학습 자료 · 직접 준비하기에서 "공식 사이트로 이동"에 쓰는 유일한 목록.
 *
 * 원칙: 지어낸 주소나 깊은 하위 주소를 쓰지 않는다. 기관 첫 화면(루트)만 둔다 — 하위 주소는 기관이 자주 바꾼다.
 * 2026-10-28 개발 환경에서 응답을 확인한 주소만 넣었다(checked). 해외 접속을 막아 이 환경에서 확인하지 못한 곳은
 * 기존 연동(기업마당 공고 API)이나 널리 쓰이는 기관 대표 주소일 때만 넣고 checked 를 비운다.
 * 주소가 확실하지 않은 기관(예: 메인비즈)은 넣지 않는다 — 운영자가 학습 자료에 직접 적는다.
 */
export interface OfficialLink { key: string; label: string; url: string; what: string; checked?: string }

export const OFFICIAL_LINKS: OfficialLink[] = [
  { key: "bizinfo", label: "기업마당", url: "https://www.bizinfo.go.kr", what: "중앙부처 · 지자체 지원사업 공고 모음 (KPJK 공고 목록의 출처)" },
  { key: "kstartup", label: "K-Startup", url: "https://www.k-startup.go.kr", what: "창업 지원사업 공고 · 신청", checked: "2026-10-28" },
  { key: "kosmes", label: "중소벤처기업진흥공단", url: "https://www.kosmes.or.kr", what: "중소기업 정책자금 안내 · 신청", checked: "2026-10-28" },
  { key: "kodit", label: "신용보증기금", url: "https://www.kodit.or.kr", what: "보증 상품 안내 · 신청", checked: "2026-10-28" },
  { key: "kibo", label: "기술보증기금", url: "https://www.kibo.or.kr", what: "기술보증 안내 · 신청", checked: "2026-10-28" },
  { key: "koreg", label: "지역신용보증재단중앙회", url: "https://www.koreg.or.kr", what: "지역 신용보증재단 안내", checked: "2026-10-28" },
  { key: "semas", label: "소상공인시장진흥공단", url: "https://www.semas.or.kr", what: "소상공인 지원 · 정책자금 안내", checked: "2026-10-28" },
  { key: "sbiz24", label: "소상공인24", url: "https://www.sbiz24.kr", what: "소상공인 지원사업 신청", checked: "2026-10-28" },
  { key: "smtech", label: "SMTECH (중소기업 기술개발사업)", url: "https://www.smtech.go.kr", what: "중소기업 기술개발 지원사업 공고 · 신청", checked: "2026-10-28" },
  { key: "rnd", label: "한국산업기술진흥협회", url: "https://www.rnd.or.kr", what: "기업부설연구소 · 연구개발전담부서 신고 안내", checked: "2026-10-28" },
  { key: "venturein", label: "벤처확인종합관리시스템", url: "https://www.smes.go.kr/venturein", what: "벤처기업확인 안내 · 신청", checked: "2026-10-28" },
  { key: "innobiz", label: "이노비즈협회", url: "https://www.innobiz.net", what: "기술혁신형 중소기업(이노비즈) 안내", checked: "2026-10-28" },
  { key: "gov24", label: "정부24", url: "https://www.gov.kr", what: "민원서류 발급(사업자등록증명 · 납세증명 등 일부)", checked: "2026-10-28" },
  { key: "hometax", label: "국세청 홈택스", url: "https://www.hometax.go.kr", what: "사업자등록증명 · 납세증명서 · 부가세 과세표준증명 발급" },
  { key: "iros", label: "대법원 인터넷등기소", url: "https://www.iros.go.kr", what: "법인 등기사항증명서 발급", checked: "2026-10-28" },
  { key: "work24", label: "고용24", url: "https://www.work24.go.kr", what: "고용 지원금 · 고용보험 관련 안내", checked: "2026-10-28" },
  { key: "moel", label: "고용노동부", url: "https://www.moel.go.kr", what: "근로계약서 · 취업규칙 등 노무 기본 안내", checked: "2026-10-28" },
];

export const LINK_BY_KEY: Record<string, OfficialLink> = Object.fromEntries(OFFICIAL_LINKS.map((l) => [l.key, l]));

/**
 * 외부 주소를 그대로 열어도 되는가 — https 만, 자격 정보(user:pass@)나 이상한 문자가 없는 것만.
 * 학습 자료의 링크 · 공고 원문 · 신청 사이트에 공통으로 쓴다(javascript: 같은 주소를 막는다).
 */
export function safeHttpsUrl(raw: string | undefined | null): string | undefined {
  const s = (raw ?? "").trim();
  if (!s) return undefined;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

/**
 * YouTube 주소 → 영상 id. 운영자가 붙여 넣는 흔한 모양만 받는다(watch?v= · youtu.be/ · embed/ · shorts/).
 * 영상 id 는 11자리 [A-Za-z0-9_-] — 그 밖의 것은 받지 않는다(가짜 재생 화면을 만들지 않기 위해).
 */
export function youtubeId(raw: string | undefined | null): string | undefined {
  const url = safeHttpsUrl(raw);
  if (!url) return undefined;
  const u = new URL(url);
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
      id = m?.[1] ?? null;
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : undefined;
}

/** 개인정보를 덜 남기는 임베드 주소 */
export const youtubeEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
