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

import { isRealDate } from "./format";

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
  /** 주업태 (사업의 종류 첫 줄 왼쪽 칸) */
  bizCategory?: string;
  /** 주종목 (첫 줄 오른쪽 칸) */
  bizItem?: string;
  /** 그 외 업태·종목 — 줄마다 "업태 — 종목" */
  bizItemsExtra?: string;
  /** 등기부에서 읽은 자본금(원) — 참고용 표시만 한다 */
  capital?: number;
}

export type ParsedKey = keyof Omit<ParsedDoc, "source">;

export const PARSED_ORDER: ParsedKey[] = ["name", "bizNo", "corpNo", "ceo", "ceoBirth", "establishedAt", "address", "bizCategory", "bizItem", "bizItemsExtra", "capital"];

export const PARSED_LABEL: Record<ParsedKey, string> = {
  name: "기업명",
  bizNo: "사업자등록번호",
  corpNo: "법인등록번호",
  ceo: "대표자",
  ceoBirth: "대표자 생년월일",
  establishedAt: "설립일 · 개업일",
  address: "주소",
  bizCategory: "주업태",
  bizItem: "주종목",
  bizItemsExtra: "그 외 업태·종목",
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

/**
 * 라벨을 느슨하게 찾는 정규식 조각.
 * 사업자등록증은 "법 인 명"처럼 글자 사이를 띄우고, 사진 글자 인식은 받침을 자주 헷갈린다("명"→"멍", "태"→"테").
 * 글자 사이 공백·밑줄·점을 허용하고, 자주 틀리는 글자는 비슷한 글자까지 받는다.
 */
const CONFUSE: Record<string, string> = { 명: "명멍몀", 태: "태테래", 점: "점절", 업: "업엄언얼협", 표: "표포", 호: "호흐", 재: "재제", 종: "종좀총", 목: "목옥" };
export function fz(word: string): string {
  return [...word].map((c) => (CONFUSE[c] ? `[${CONFUSE[c]}]` : c.replace(/[()]/g, "\\$&"))).join("[\\s_.·ㆍ]*");
}

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
  if (y < 1900 || y > 2200 || !isRealDate(y, mo, da)) return undefined;
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
  if (!isRealDate(century + yy, mm, dd)) return undefined;
  return `${century + yy}-${pad2(mm)}-${pad2(dd)}`;
}

export function fmtBizNo10(raw: string) {
  const d = digits(raw);
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : undefined;
}

/** 사업자등록번호 끝자리 검증 (국세청 규칙). 글자 인식이 한 자리 틀리면 대부분 여기서 걸린다 */
export function bizNoValid(raw: string | undefined): boolean {
  const d = digits(raw ?? "");
  if (d.length !== 10) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(d[i]) * w[i];
  sum += Math.floor((Number(d[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(d[9]);
}

/** 법인등록번호 끝자리 검증 */
export function corpNoValid(raw: string | undefined): boolean {
  const d = digits(raw ?? "");
  if (d.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(d[i]) * (i % 2 === 0 ? 1 : 2);
  return (10 - (sum % 10)) % 10 === Number(d[12]);
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
  const all = [...t.matchAll(/(?:^|[^\d])(\d{3}\s*-\s*\d{2}\s*-\s*\d{5})(?!\d)/g)].map((m) => fmtBizNo10(m[1])).filter((x): x is string => !!x);
  const first = labeled ? fmtBizNo10(labeled[1]) : all[0];
  // 검증번호가 맞는 것을 우선한다 — 라벨 옆 번호가 틀리게 읽혔으면 문서 안의 다른 번호(바코드 아래 등)를 쓴다
  if (first && bizNoValid(first)) return first;
  return all.find(bizNoValid) ?? first;
}

function findCorpNo(t: string) {
  const labeled = /법\s*인\s*등\s*록\s*번\s*호\s*[:：]?\s*(\d{6}\s*-\s*\d{7})/.exec(t);
  if (labeled) return fmtCorpNo13(labeled[1]);
  // 라벨 없이 13자리가 나오면 주민번호일 수 있으므로 쓰지 않는다.
  return undefined;
}

/** 회사 형태 낱말 — 라벨을 못 읽었을 때 이 낱말이 있는 줄을 상호로 본다 */
const COMPANY_FORM = /(주식회사|유한책임회사|유한회사|합자회사|합명회사|농업회사법인|영농조합법인|협동조합|사단법인|재단법인|\(주\)|㈜)/;

function findName(t: string, source: DocSource) {
  // "(단체명)" "(법인명)" 괄호는 있어도 없어도 된다 — 통째로 선택(?:…)? 으로 묶는다
  const opt = (w: string) => `(?:[\\s_.·ㆍ]*\\(?[\\s_.·ㆍ]*${fz(w)}[\\s_.·ㆍ]*\\)?)?`;
  const patterns = source === "corpReg"
    ? [fz("상호"), fz("법인명") + opt("단체명"), fz("회사명")]
    : [fz("법인명") + opt("단체명"), fz("상호") + opt("법인명"), fz("회사명")];
  for (const p of patterns) {
    const v = valueAfter(t, p);
    if (v && v.length >= 2 && v.length <= 60 && /[가-힣A-Za-z]/.test(v)) return v;
  }
  // 라벨이 뭉개졌으면 "주식회사 …" 가 든 줄을 쓴다 (세무서·발급기관 줄은 제외)
  for (const line of t.split("\n")) {
    if (!COMPANY_FORM.test(line) || /세무서|등기소|법원|국세청/.test(line)) continue;
    const after = line.includes(":") || line.includes("：") ? line.split(/[:：]/).slice(1).join(":") : line;
    const v = cutAtNextLabel(after).replace(/^[^가-힣A-Za-z(㈜]+/, "").trim();
    if (v.length >= 4 && v.length <= 60 && COMPANY_FORM.test(v)) return v;
  }
  return undefined;
}

function findCeo(t: string, source: DocSource) {
  const patterns = source === "corpReg"
    ? ["대\\s*표\\s*이\\s*사", "사내이사", "대\\s*표\\s*자"]
    : ["성\\s*명\\s*\\(대표자\\)", "대\\s*표\\s*자\\s*\\(성명\\)", fz("성명"), fz("대표자")];
  for (const p of patterns) {
    let v = valueAfter(t, p);
    if (!v) continue;
    // 글자 인식이 이름 낱자 사이를 띄우는 경우("정 수빈", "강서 연") — 앞쪽 짧은 한글 조각을 4자까지 붙인다
    const toks = v.trim().split(/\s+/);
    if (toks.length > 1 && /^[가-힣]{1,2}$/.test(toks[0])) {
      let name = "";
      for (const tk of toks) { if (!/^[가-힣]{1,3}$/.test(tk) || (name + tk).length > 4) break; name += tk; }
      if (name.length >= 2) v = name + " " + toks.slice(name.length ? toks.findIndex((_, i) => toks.slice(0, i + 1).join("") === name) + 1 : 0).join(" ");
    }
    // 영문 이름은 "이름 성" 처럼 두 낱말일 때만 — 글자 인식이 한글을 "dss" 같은 영문으로 잘못 읽는 경우를 거른다
    const name = /^([가-힣]{2,6}|[A-Za-z]{2,}(?: [A-Za-z.]{1,20}){1,3})/.exec(v.trim());
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

/** 주소 손질 — 앞에 붙은 부호 떼기, "도/시/군/구" 뒤 띄어쓰기, 행정구역 끝 글자 흔한 오인식("음"→"읍") */
export function tidyAddress(v: string): string {
  let a = v.replace(/^[^가-힣0-9]+/, "").trim();
  a = a.replace(/(특별시|광역시|특별자치시|특별자치도|도)(?=[가-힣]{2,}(시|군))/, "$1 ");
  a = a.replace(/([가-힣]{1,4}시)(?=[가-힣]{1,4}(구|군|읍|면|동)\b)/, "$1 ");
  a = a.replace(/((?:시|군|구)\s+(?:[가-힣]{1,5}구\s+)?[가-힣]{1,4})음(?=\s)/, "$1읍");
  return a;
}

function findAddress(t: string, source: DocSource) {
  const keys = source === "corpReg"
    ? ["본\\s*점\\s*소\\s*재\\s*지", "본\\s*점", "주\\s*사\\s*무\\s*소", "소\\s*재\\s*지"]
    : ["사\\s*업\\s*장\\s*소\\s*재\\s*지", "사\\s*업\\s*장\\s*\\(주소\\)", "소\\s*재\\s*지", "주\\s*소"];
  for (const k of keys) {
    const raw = valueAfter(t, k);
    const v = raw ? tidyAddress(raw) : undefined;
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

/**
 * 사업자등록증 "사업의 종류" — 업태 | 종목 두 칸, 여러 줄.
 *
 *   사업의 종류 : [업태] 음식점업          [종목] 커피 전문점
 *                       도매 및 소매업          상품 종합 도매업
 *
 * 칸 사이 넓은 공백이 유일한 단서라 공백을 줄이기 전의 원문으로 읽는다.
 * 첫 번째 업태가 주업태다(업종 자동 선택에 쓴다).
 */
const KIND_END = /발\s*급|사업자\s*단위|공\s*동\s*사\s*업\s*자|전자\s*세금|주류\s*판매|과세\s*유형|교\s*부/;
export interface BizKind { category?: string; item?: string }
/** 그 외 업태·종목 한 줄 표기 — 저장도 이 모양으로 한다(줄바꿈으로 구분) */
export const kindLine = (k: BizKind) => [k.category, k.item].filter(Boolean).join(" — ");
export function parseKindLines(text: string | undefined): BizKind[] {
  return (text ?? "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [c, ...rest] = l.split(/\s+—\s+/);
    return rest.length ? { category: c.trim() || undefined, item: rest.join(" — ").trim() || undefined } : { category: c.trim() || undefined };
  });
}

export function findBizKinds(raw: string): { category?: string; item?: string; pairs: BizKind[] } {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const CAT = new RegExp(`[\\[(|]?\\s*${fz("업태")}\\s*[\\])|]?\\s*[:：]?`, "g");
  const ITEM = new RegExp(`[\\[(|]?\\s*${fz("종목")}\\s*[\\])|]?\\s*[:：]?`);
  const start = lines.findIndex((l) => new RegExp(`${fz("종류")}|${fz("업태")}|${fz("종목")}|${fz("사업의")}`).test(l));
  if (start < 0) return { pairs: [] };
  const pairs: BizKind[] = [];
  const cats: string[] = [];
  const items: string[] = [];
  const clean = (x: string) => x
    .replace(CAT, " ")
    .replace(/\[[^\]\s]{0,4}[\]|]?/g, " ")            // 뭉개진 [업태] 상자 조각: "[=H", "[얼테|"
    .replace(/[|[\]{}_:：]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const ok = (x: string) => (x.match(/[가-힣]/g) ?? []).length >= 2 && x.length <= 30;
  for (let i = start; i < Math.min(lines.length, start + 6); i += 1) {
    let l = lines[i];
    if (l.trim() === "") continue;
    if (i > start && KIND_END.test(l)) break;
    if (i > start && /[:：]/.test(l) && !CAT.test(l) && !ITEM.test(l)) break;     // 다른 항목 줄
    CAT.lastIndex = 0;
    // 앞의 "사업의 종류 :" 라벨 (글자가 뭉개져도 "사업의 … :" 까지)
    l = l.replace(new RegExp(`^.*?(?:${fz("종류")}|${fz("사업의")}[^:：\\[]*)\\s*[:：]?`), "");
    let left = l;
    let right = "";
    const m = ITEM.exec(l);
    if (m) { left = l.slice(0, m.index); right = l.slice(m.index + m[0].length); }
    else {
      const parts = l.trim().split(/\s{2,}/);
      left = parts[0] ?? "";
      right = parts.slice(1).join(" ");
    }
    const c = clean(left);
    const it = clean(right);
    // 긴 종목이 줄바꿈된 경우("… 개발 및 공" + "급업"): 앞 줄 끝 낱말이 한 글자로 끊겼고 이 줄이 한 칸뿐이면 이어 붙인다
    const prev = pairs[pairs.length - 1];
    const lone = !right.trim() ? c : !left.trim() ? it : "";
    if (prev && lone && /(^|\s)[가-힣]$/.test(prev.item ?? "") && /^[가-힣]{1,4}$/.test(lone)) {
      prev.item = `${prev.item}${lone}`;
      if (items.length) items[items.length - 1] = prev.item;
      continue;
    }
    if (ok(c)) cats.push(c);
    if (ok(it)) items.push(it);
    if (ok(c) || ok(it)) pairs.push({ category: ok(c) ? c : undefined, item: ok(it) ? it : undefined });
  }
  return { category: cats.length ? cats.join(", ") : undefined, item: items.length ? items.join(", ") : undefined, pairs };
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
  if (source !== "corpReg") {
    // 첫 줄이 주업태·주종목, 나머지 줄은 "그 외"로 (줄마다 "업태 — 종목")
    const { pairs } = findBizKinds(raw);
    const [main, ...rest] = pairs;
    put("bizCategory", main?.category ?? (main ? undefined : valueAfter(t, "업\\s*태")));
    put("bizItem", main?.item ?? (main ? undefined : valueAfter(t, "종\\s*목")));
    if (rest.length) put("bizItemsExtra", rest.map(kindLine).join("\n"));
  }
  if (source === "corpReg") put("capital", findCapital(t));
  return out;
}

/** 읽힌 항목 수 */
export function parsedCount(p: ParsedDoc) {
  return PARSED_ORDER.filter((k) => p[k] !== undefined).length;
}

/**
 * 사진 글자 인식을 두 번 한 경우 합친다 (docextract 참고).
 * 숫자·날짜는 첫 번째(한글+영문)만 믿는다 — 두 번째가 숫자를 틀려도 끼어들지 못한다. 비면 비운다.
 * 이름·상호·주소·업태·종목은 두 번째(한글 전용)를 우선한다.
 */
const NAME_KEYS: ParsedKey[] = ["name", "ceo", "address", "bizCategory", "bizItem", "bizItemsExtra"];
export function parseExtracted(text: string, alt?: string): ParsedDoc {
  const a = parseBusinessDoc(text);
  if (!alt) return a;
  const b = parseBusinessDoc(alt);
  const out: ParsedDoc = { ...a, source: a.source !== "unknown" ? a.source : b.source };
  const put = (k: ParsedKey, v: unknown) => { if (v !== undefined) (out as unknown as Record<string, unknown>)[k] = v; };
  for (const k of NAME_KEYS) put(k, b[k] ?? a[k]);
  // 번호: 검증번호가 맞는 쪽. 둘 다 틀리면 첫 번째(사람이 확인한다)
  put("bizNo", bizNoValid(a.bizNo) ? a.bizNo : bizNoValid(b.bizNo) ? b.bizNo : a.bizNo);
  put("corpNo", corpNoValid(a.corpNo) ? a.corpNo : corpNoValid(b.corpNo) ? b.corpNo : a.corpNo);
  // 날짜: 첫 번째가 못 읽었으면 두 번째 (날짜 꼴인지 이미 검사된 값만 온다)
  put("establishedAt", a.establishedAt ?? b.establishedAt);
  put("ceoBirth", a.ceoBirth ?? b.ceoBirth);
  return out;
}
