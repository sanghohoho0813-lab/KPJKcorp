/**
 * 사업자등록증 · 법인등기부등본 텍스트에서 기업 기본 정보를 뽑는 순수 함수.
 *
 * 입력은 "글자"다 — PDF 텍스트, 사진 OCR, 붙여넣기 어디서 왔든 같은 함수로 처리한다.
 *
 * 원칙
 * - 확신이 서는 항목만 돌려주고 나머지는 비운다. 잘못 채우는 것보다 비우는 편이 안전하다.
 * - 주민등록번호 뒷자리는 절대 밖으로 내보내지 않는다. 생년월일만 앞 6자리에서 계산한다.
 * - 이 함수는 값을 "제안"할 뿐이다. 화면에서 사람이 확인한 뒤에야 저장된다.
 */

export type DocSource = "bizReg" | "corpReg" | "unknown";

export interface ParsedDoc {
  source: DocSource;
  name?: string;
  bizNo?: string;
  corpNo?: string;
  ceo?: string;
  /** YYYY-MM-DD */
  ceoBirth?: string;
  /** 개업연월일 / 회사성립연월일 — YYYY-MM-DD */
  establishedAt?: string;
  address?: string;
  bizCategory?: string;
  bizItem?: string;
  /** 등기부에서 읽은 자본금(원) — 참고용 표시만 한다 */
  capital?: number;
}

export type ParsedKey = keyof Omit<ParsedDoc, "source">;

export const PARSED_ORDER: ParsedKey[] = ["name", "bizNo", "corpNo", "ceo", "ceoBirth", "establishedAt", "address", "bizCategory", "bizItem", "capital"];

export const PARSED_LABEL: Record<ParsedKey, string> = {
  name: "기업명",
  bizNo: "사업자등록번호",
  corpNo: "법인등록번호",
  ceo: "대표자",
  ceoBirth: "대표자 생년월일",
  establishedAt: "설립일 · 개업일",
  address: "주소",
  bizCategory: "업태",
  bizItem: "종목",
  capital: "자본금",
};

export const DOC_SOURCE_LABEL: Record<DocSource, string> = {
  bizReg: "사업자등록증",
  corpReg: "법인등기부등본",
  unknown: "종류를 알 수 없는 문서",
};

/* ---------------- 유틸 ---------------- */

function normalize(raw: string) {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[〇○]/g, "0")
    .replace(/[ \t　]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

const digits = (s: string) => s.replace(/\D/g, "");
const pad2 = (n: number) => String(n).padStart(2, "0");

export function parseKoreanDate(input: string): string | undefined {
  const s = input.trim();
  let m: RegExpExecArray | null = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(s);
  if (!m) m = /(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/.exec(s);
  if (!m) {
    const d = digits(s);
    if (d.length === 8) m = [s, d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)] as unknown as RegExpExecArray;
  }
  if (!m) return undefined;
  const y = Number(m[1]), mo = Number(m[2]), da = Number(m[3]);
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || da < 1 || da > 31) return undefined;
  return `${y}-${pad2(mo)}-${pad2(da)}`;
}

/** 주민등록번호 앞 6자리 + 성별코드 → 생년월일. 뒷자리는 세기 판별에만 쓰고 버린다 */
export function birthFromRrn(prefix6: string, genderCode?: string): string | undefined {
  const d = digits(prefix6);
  if (d.length !== 6) return undefined;
  const yy = Number(d.slice(0, 2)), mm = Number(d.slice(2, 4)), dd = Number(d.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined;
  let century = 1900;
  if (genderCode && "3478".includes(genderCode)) century = 2000;
  else if (genderCode && "90".includes(genderCode)) century = 1800;
  return `${century + yy}-${pad2(mm)}-${pad2(dd)}`;
}

export function fmtBizNo10(raw: string) {
  const d = digits(raw);
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : undefined;
}

export function fmtCorpNo13(raw: string) {
  const d = digits(raw);
  return d.length === 13 ? `${d.slice(0, 6)}-${d.slice(6)}` : undefined;
}

/** 한 줄에 여러 항목이 붙어 나올 때 다음 라벨 앞에서 자른다 */
const LABELS = ["법인등록번호", "등록번호", "사업자등록번호", "상 ?호", "법인명", "성 ?명", "대 ?표 ?자", "대표이사", "개업연월일", "생년월일", "사업장소재지", "본 ?점", "소재지", "업 ?태", "종 ?목", "회사성립연월일", "교부일자", "주 ?소", "발급일자", "공고방법", "자본금의 ?액", "1주의 ?금액"];

function cutAtNextLabel(value: string) {
  let out = value;
  for (const l of LABELS) {
    const m = new RegExp(`\\s*\\(?${l}\\)?\\s*[:：]`).exec(out);
    if (m && m.index > 0) out = out.slice(0, m.index);
  }
  return out.trim();
}

/** 라벨 뒤의 값 — 같은 줄 우선, 비어 있으면 다음 줄 */
function valueAfter(text: string, labelPattern: string): string | undefined {
  const m = new RegExp(`${labelPattern}\\s*[:：]?\\s*(.*)`, "m").exec(text);
  if (!m) return undefined;
  let v = cutAtNextLabel(m[1] ?? "");
  if (v === "") {
    const after = text.slice((m.index ?? 0) + m[0].length);
    const next = after.split("\n").find((l) => l.trim() !== "");
    v = cutAtNextLabel(next ?? "");
  }
  v = v.replace(/^\s*\([^)]{0,12}\)\s*[:：]?\s*/, "");
  v = v.replace(/^(소재지|성명|법인명|상호|단체명)\s*[:：]\s*/, "");
  v = v.replace(/^[)\]}·.\-]+/, "").trim();
  return v === "" ? undefined : v;
}

/* ---------------- 문서 종류 ---------------- */

export function detectDocSource(text: string): DocSource {
  const t = normalize(text);
  const count = (ps: RegExp[]) => ps.reduce((n, re) => n + (re.test(t) ? 1 : 0), 0);
  const registry = count([/등기사항전부증명서/, /말소사항\s?포함/, /등기기록/, /회사성립연월일/, /등기번호/, /공고방법/, /1주의\s?금액/, /임원에\s?관한\s?사항/, /대표이사/]);
  const business = count([/사업자등록증/, /개업연월일/, /업\s?태\s*[:：]/, /종\s?목\s*[:：]/, /사업장소재지/, /법인명\s?\(단체명\)/, /교부일자/]);
  if (registry === 0 && business === 0) return "unknown";
  if (/사업자등록증/.test(t) && !/등기사항전부증명서/.test(t)) return "bizReg";
  if (/등기사항전부증명서/.test(t) && !/사업자등록증/.test(t)) return "corpReg";
  return registry > business ? "corpReg" : "bizReg";
}

/* ---------------- 항목별 ---------------- */

function findBizNo(t: string) {
  const labeled = /(?:사업자)?\s*등\s*록\s*번\s*호\s*[:：]?\s*(\d{3}\s*-\s*\d{2}\s*-\s*\d{5})/.exec(t);
  if (labeled) return fmtBizNo10(labeled[1]);
  const loose = /(?:^|[^\d])(\d{3}\s*-\s*\d{2}\s*-\s*\d{5})(?!\d)/.exec(t);
  return loose ? fmtBizNo10(loose[1]) : undefined;
}

function findCorpNo(t: string) {
  const labeled = /법\s*인\s*등\s*록\s*번\s*호\s*[:：]?\s*(\d{6}\s*-\s*\d{7})/.exec(t);
  if (labeled) return fmtCorpNo13(labeled[1]);
  // 라벨 없이 13자리가 나오면 주민번호일 수 있으므로 쓰지 않는다.
  return undefined;
}

function findName(t: string, source: DocSource) {
  const patterns = source === "corpReg"
    ? ["상\\s*호", "법인명\\s*\\(?단체명\\)?", "법인명", "회사명"]
    : ["법인명\\s*\\(?단체명\\)?", "상\\s*호\\s*\\(?법인명\\)?", "상\\s*호", "법인명", "회사명"];
  for (const p of patterns) {
    const v = valueAfter(t, p);
    if (v && v.length >= 2 && v.length <= 60) return v;
  }
  return undefined;
}

function findCeo(t: string, source: DocSource) {
  const patterns = source === "corpReg"
    ? ["대\\s*표\\s*이\\s*사", "사내이사", "대\\s*표\\s*자"]
    : ["성\\s*명\\s*\\(대표자\\)", "대\\s*표\\s*자\\s*\\(성명\\)", "성\\s*명", "대\\s*표\\s*자"];
  for (const p of patterns) {
    const v = valueAfter(t, p);
    if (!v) continue;
    const name = /^([가-힣]{2,6}|[A-Za-z][A-Za-z .]{1,40})/.exec(v.trim());
    if (name) return name[1].trim();
  }
  return undefined;
}

/** 등기부 '대표이사 홍길동 801231-1******' — 뒷자리는 세기 판별에만 쓴다 */
function findCeoBirth(t: string) {
  const re = /([가-힣]{2,6})\s+(\d{6})\s*[-–]\s*([1-8])(\*{4,7}|\d{6})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    if (/번호$/.test(m[1])) continue;
    const b = birthFromRrn(m[2], m[3]);
    if (b) return b;
  }
  const labeled = valueAfter(t, "생\\s*년\\s*월\\s*일");
  return labeled ? parseKoreanDate(labeled) : undefined;
}

function findEstablished(t: string, source: DocSource) {
  const keys = source === "corpReg"
    ? ["회\\s*사\\s*성\\s*립\\s*연\\s*월\\s*일", "설\\s*립\\s*등\\s*기", "개업연월일"]
    : ["개\\s*업\\s*연\\s*월\\s*일", "설\\s*립\\s*일", "회\\s*사\\s*성\\s*립\\s*연\\s*월\\s*일"];
  for (const k of keys) {
    const v = valueAfter(t, k);
    if (!v) continue;
    const d = parseKoreanDate(v);
    if (d) return d;
  }
  return undefined;
}

function findAddress(t: string, source: DocSource) {
  const keys = source === "corpReg"
    ? ["본\\s*점\\s*소\\s*재\\s*지", "본\\s*점", "주\\s*사\\s*무\\s*소", "소\\s*재\\s*지"]
    : ["사\\s*업\\s*장\\s*소\\s*재\\s*지", "사\\s*업\\s*장\\s*\\(주소\\)", "소\\s*재\\s*지", "주\\s*소"];
  for (const k of keys) {
    const v = valueAfter(t, k);
    if (v && v.length >= 5 && /[가-힣]/.test(v)) return v;
  }
  return undefined;
}

function findCapital(t: string) {
  const m = /자본금의?\s*액\s*[:：]?\s*금?\s*([\d,]{3,})\s*원/.exec(t);
  if (!m) return undefined;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/* ---------------- 본체 ---------------- */

export function parseBusinessDoc(raw: string): ParsedDoc {
  const t = normalize(raw);
  const source = detectDocSource(t);
  const out: ParsedDoc = { source };
  const put = <K extends ParsedKey>(k: K, v: ParsedDoc[K] | undefined) => { if (v !== undefined && v !== "") out[k] = v; };
  put("name", findName(t, source));
  put("bizNo", findBizNo(t));
  put("corpNo", findCorpNo(t));
  put("ceo", findCeo(t, source));
  put("ceoBirth", findCeoBirth(t));
  put("establishedAt", findEstablished(t, source));
  put("address", findAddress(t, source));
  put("bizCategory", valueAfter(t, "업\\s*태"));
  put("bizItem", valueAfter(t, "종\\s*목"));
  if (source === "corpReg") put("capital", findCapital(t));
  return out;
}

/** 읽힌 항목 수 */
export function parsedCount(p: ParsedDoc) {
  return PARSED_ORDER.filter((k) => p[k] !== undefined).length;
}
