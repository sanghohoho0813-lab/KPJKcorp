import type { RawCell, RawSheet, RawWorkbook } from "../types";
import { compactText } from "../normalize/text";

/**
 * 개인정보 검사 · 제거 — 실제 자료를 분석하거나 다른 사람에게 넘기기 전에 돌린다.
 *
 * 원칙
 *  - 보고서에는 원래 값을 넣지 않는다(위치 · 종류 · 모양만: 900101-1234567 → "######-#######").
 *  - 지워도 분석이 달라지지 않게 글자만 바꾼다. 분석에 쓰는 숫자 칸(수량 · 단가 · 금액)은 건드리지 않는다.
 *    예외: 개인정보 머리글(연락처 · 주민번호 등) 아래의 숫자 칸 — 전화번호가 숫자로 저장된 경우.
 *  - 같은 사람 이름은 같은 가명으로 바꾼다(여러 파일을 함께 넘겨도 "같은 사람"이라는 관계는 남는다).
 *  - 못 찾는 것: 자유 글 속 이름(머리글 · "대표 홍길동" 꼴이 아닌 경우), 그림 · 메모 · 파일 속성.
 *    그림 · 메모 · 파일 속성은 읽지 않으므로 분석 결과와 지운 사본(값만 다시 쓴 파일)에도 들어가지 않는다.
 *
 * 등급
 *  - block : 주민 · 외국인등록번호, 카드번호 → 지우기 전에는 분석을 멈춘다
 *  - warn  : 휴대전화, 이메일, 계좌번호(은행 · 계좌 낱말과 함께), 사람 이름(머리글 · 직함 뒤), 생년월일 · 주소 열 → 분석 전에 지운다
 *  - info  : 일반 전화, 사업자등록번호, 글 속 주소 → 알려만 준다(대부분 회사 · 현장 정보)
 */
export type PiiLevel = "block" | "warn" | "info";
export type PiiKind = "rrn" | "card" | "mobile" | "email" | "account" | "person" | "rrnPartial" | "birth" | "address" | "phone" | "bizno";

export interface PiiHit {
  kind: PiiKind;
  level: PiiLevel;
  sheet: string;
  row: number;
  col: number;
  /** 원래 값 대신 모양만(숫자 #, 한글 ○, 영문 a) */
  shape: string;
  /** 숨긴 행 · 열 · 시트 안에 있었는가 */
  hidden: boolean;
  /** 어떻게 찾았나: 모양(pattern) · 머리글(header) · 직함 뒤(title) */
  via: "pattern" | "header" | "title";
}

export interface PiiReport {
  fileName: string;
  level: PiiLevel | "none";
  counts: Partial<Record<PiiKind, number>>;
  hits: PiiHit[];
}

export const PII_LABEL: Record<PiiKind, string> = {
  rrn: "주민 · 외국인등록번호", card: "카드번호", mobile: "휴대전화", email: "이메일", account: "계좌번호", person: "사람 이름",
  rrnPartial: "생년월일 · 성별(일부 가린 등록번호)", birth: "생년월일", address: "주소(주소 열)", phone: "일반 전화", bizno: "사업자등록번호",
};
const LEVEL: Record<PiiKind, PiiLevel> = {
  rrn: "block", card: "block", mobile: "warn", email: "warn", account: "warn", person: "warn", rrnPartial: "warn", birth: "warn", address: "warn", phone: "info", bizno: "info",
};
const TOKEN: Record<PiiKind, string> = {
  rrn: "[등록번호 삭제]", card: "[카드번호 삭제]", mobile: "[휴대전화 삭제]", email: "[이메일 삭제]", account: "[계좌번호 삭제]", person: "",
  rrnPartial: "[등록번호 삭제]", birth: "[생년월일 삭제]", address: "[주소 삭제]", phone: "", bizno: "",
};

// ── 모양 ─────────────────────────────────────────────────────────────
const validDate = (yy: string, mm: string, dd: string) => { const m = +mm, d = +dd; return m >= 1 && m <= 12 && d >= 1 && d <= 31 && /^\d\d$/.test(yy); };
/** 2024-01-15 · 24-01-15 꼴 날짜(입금 내역의 날짜를 계좌번호로 오인하지 않게) */
const dateLike = (s: string) => { const p = s.split("-"); if (p.length !== 3) return false; const [y, m, d] = p; return (y.length === 4 || y.length === 2) && m.length <= 2 && d.length <= 2 && +m >= 1 && +m <= 12 && +d >= 1 && +d <= 31; };
const luhn = (digits: string) => { let s = 0; for (let i = 0; i < digits.length; i++) { let d = +digits[digits.length - 1 - i]; if (i % 2) { d *= 2; if (d > 9) d -= 9; } s += d; } return s % 10 === 0; };

interface Pat { kind: PiiKind; re: RegExp; ok?: (m: RegExpExecArray) => boolean; needs?: RegExp }
const BANK = /은행|뱅크|농협|수협|신협|새마을|우체국|저축|계좌|통장|예금주|입금|bank/i;
const PATTERNS: Pat[] = [
  { kind: "rrn", re: /(?<![\d-])(\d{2})(\d{2})(\d{2})\s*[-–]?\s*([1-8])\d{6}(?![\d-])/g, ok: (m) => validDate(m[1], m[2], m[3]) },
  { kind: "rrnPartial", re: /(?<![\d-])(\d{2})(\d{2})(\d{2})\s*[-–]\s*[1-8][*xX●○■□]{3,6}/g, ok: (m) => validDate(m[1], m[2], m[3]) },
  { kind: "card", re: /(?<![\d-])(\d{4})[- ](\d{4})[- ](\d{4})[- ](\d{4})(?![\d-])/g, ok: (m) => luhn(m[1] + m[2] + m[3] + m[4]) },
  { kind: "mobile", re: /(?<![\d-])01[016789][-.\s)]?\d{3,4}[-.\s]?\d{4}(?![\d-])/g },
  { kind: "email", re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  { kind: "account", re: /(?<![\d-])\d{2,6}-\d{2,6}-\d{2,8}(?:-\d{1,3})?(?![\d-])/g, needs: BANK, ok: (m) => !dateLike(m[0]) },
  { kind: "bizno", re: /(?<![\d-])\d{3}-\d{2}-\d{5}(?![\d-])/g },
  { kind: "phone", re: /(?<![\d-])0(?:2|[3-6][1-5]|70|50\d)[-)\s]\s*\d{3,4}-\d{4}(?![\d-])/g },
];
/**
 * 직함 · 서명 낱말 뒤의 이름 — 오인을 줄이려고 ① 칸 전체가 "직함 이름 (인)" 꼴이거나 ② 쌍점(:) 뒤에 올 때만,
 * 그리고 첫 글자가 흔한 성씨일 때만 이름으로 본다(품목 이름 "○○ 교육비" 같은 글을 지우지 않게).
 */
const TITLES = "대표이사|대표자|대표|담당자|담당|성명|작성자|확인자|검토자|승인자|결재자|현장소장|소장|예금주|수령인|입금자|성함";
const SURNAMES = "김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구민진나지엄채원천방현함변염여추도석선설마길연위표명기반왕금옥육맹제모탁국어은편용예봉";
const NAME = `([${SURNAMES}][가-힣]{1,3})`;
const TITLE_WHOLE = new RegExp(`^\\s*(?:${TITLES})\\s*[:：]?\\s*${NAME}\\s*(?:\\(?인\\)?|\\(서명\\))?\\s*$`);
const TITLE_COLON = new RegExp(`(?:${TITLES})\\s*[:：]\\s*${NAME}(?![가-힣])`, "g");
const NOT_NAME = new Set(["확인", "서명", "날인", "검토", "승인", "결재", "직인", "귀하", "이사", "기타", "없음", "미정", "본인", "일동", "포함", "주식회사", "유한회사"]);

/** 개인정보 머리글 → 그 열의 값 종류 */
const HEADER: [RegExp, PiiKind][] = [
  [/^(주민(등록)?번호|주민등록|외국인등록번호|외국인번호)$/, "rrn"],
  [/^(생년월일|생일)$/, "birth"],
  [/^(연락처|전화|전화번호|휴대폰|핸드폰|휴대전화|휴대폰번호|핸드폰번호|hp|tel|mobile|phone)$/, "mobile"],
  [/^(이메일|email|메일|전자우편)$/, "email"],
  [/^(계좌|계좌번호|입금계좌|통장|통장번호)$/, "account"],
  [/^(주소|거주지|자택주소|집주소|현주소)$/, "address"],
  [/^(성명|이름|성함|담당자|대표자|작업자|근로자|기능공|인부|예금주|수령인|입금자)$/, "person"],
];

export function shapeOf(s: string): string {
  return s.slice(0, 24).replace(/\d/g, "#").replace(/[가-힣]/g, "○").replace(/[a-z]/gi, "a");
}

function headerKind(v: string): PiiKind | undefined {
  const k = compactText(v); // 띄어쓰기 · 문장부호 제거, 소문자
  if (!k || k.length > 10) return undefined;
  for (const [re, kind] of HEADER) if (re.test(k)) return kind;
  return undefined;
}

/** 열마다 개인정보 머리글이 있으면 그 아래 행 범위 — 위 60줄 안의 머리글만 본다 */
function headerColumns(sheet: RawSheet): Map<number, { kind: PiiKind; from: number }> {
  const out = new Map<number, { kind: PiiKind; from: number }>();
  for (let r = 0; r < Math.min(sheet.rows.length, 60); r++) {
    const row = sheet.rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      if (row[c].t !== "text" || out.has(c)) continue;
      const kind = headerKind(row[c].v);
      if (kind) out.set(c, { kind, from: r + 1 });
    }
  }
  return out;
}

const looksLikeValue = (kind: PiiKind, cell: RawCell): boolean => {
  const v = cell.v.trim();
  if (!v) return false;
  if (headerKind(v)) return false;
  switch (kind) {
    case "person": return cell.t === "text" && /^[가-힣]{2,4}(\s*\(?인\)?)?$/.test(v) && !NOT_NAME.has(v);
    case "mobile": return /\d{3,4}\D?\d{4}$/.test(v) && v.replace(/\D/g, "").length >= 9;
    case "rrn": case "birth": return /\d{6}/.test(v.replace(/\D/g, "")) || /\d{2,4}[-./년]\s?\d{1,2}[-./월]\s?\d{1,2}/.test(v);
    case "account": return /\d{2,}-?\d{2,}/.test(v);
    case "email": return v.includes("@");
    case "address": return cell.t === "text" && v.length >= 4;
    default: return false;
  }
};

/** 한 칸에서 찾은 것(겹치면 앞선 종류만) */
function cellFinds(text: string, rowText: string): { kind: PiiKind; start: number; end: number; via: PiiHit["via"]; name?: string }[] {
  const out: { kind: PiiKind; start: number; end: number; via: PiiHit["via"]; name?: string }[] = [];
  const taken = (s: number, e: number) => out.some((o) => s < o.end && e > o.start);
  for (const p of PATTERNS) {
    if (p.needs && !p.needs.test(rowText)) continue;
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text))) {
      if (p.ok && !p.ok(m)) continue;
      if (taken(m.index, m.index + m[0].length)) continue;
      out.push({ kind: p.kind, start: m.index, end: m.index + m[0].length, via: "pattern" });
    }
  }
  const addName = (name: string, s: number) => { if (!NOT_NAME.has(name) && !taken(s, s + name.length)) out.push({ kind: "person", start: s, end: s + name.length, via: "title", name }); };
  const w = TITLE_WHOLE.exec(text);
  if (w) addName(w[1], text.lastIndexOf(w[1]));
  TITLE_COLON.lastIndex = 0;
  let t: RegExpExecArray | null;
  while ((t = TITLE_COLON.exec(text))) addName(t[1], t.index + t[0].length - t[1].length);
  return out;
}

function numberAsPii(cell: RawCell): PiiKind | undefined {
  if (cell.t !== "num" || cell.n === undefined || !Number.isInteger(cell.n)) return undefined;
  const d = String(cell.n);
  // 주민등록번호가 숫자로 저장된 경우(13자리) — 앞 6자리가 날짜, 7번째가 1~8
  if (d.length === 13 && validDate(d.slice(0, 2), d.slice(2, 4), d.slice(4, 6)) && /[1-8]/.test(d[6])) return "rrn";
  if (d.length === 12 && validDate("0" + d[0], d.slice(1, 3), d.slice(3, 5)) && /[1-8]/.test(d[5])) return "rrn"; // 00년대생 앞자리 0이 빠진 경우
  return undefined;
}

type Edit = { kind: PiiKind; start: number; end: number; name?: string };
interface Plan { hits: PiiHit[]; edits: Map<string, Edit[] | { whole: PiiKind }> }

function plan(wb: RawWorkbook): Plan {
  const hits: PiiHit[] = [];
  const edits: Plan["edits"] = new Map();
  wb.sheets.forEach((sheet, si) => {
    const hr = new Set(sheet.hiddenRows), hc = new Set(sheet.hiddenCols);
    const cols = headerColumns(sheet);
    for (let r = 0; r < sheet.rows.length; r++) {
      const row = sheet.rows[r] ?? [];
      const rowText = row.map((x) => x.v).join(" ");
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (cell.t === "empty") continue;
        const hidden = sheet.hidden || hr.has(r) || hc.has(c);
        const key = `${si}|${r}|${c}`;
        const base = { sheet: sheet.name, row: r, col: c, hidden, shape: shapeOf(cell.v) };
        // 머리글 아래 열의 값, 또는 같은 줄에서 머리글 낱말 바로 오른쪽 값(표지의 "담당자 | 홍길동")
        const hcol = cols.get(c);
        const left = labelLeft(row, c);
        const hk = hcol && r >= hcol.from && looksLikeValue(hcol.kind, cell) ? hcol.kind : left && looksLikeValue(left, cell) ? left : undefined;
        if (hk) {
          hits.push({ ...base, kind: hk, level: LEVEL[hk], via: "header" });
          edits.set(key, hk === "person" ? [{ kind: "person", start: 0, end: cell.v.length, name: cell.v.trim().replace(/\s*\(?인\)?$/, "") }] : { whole: hk });
          continue;
        }
        const nk = numberAsPii(cell);
        if (nk) { hits.push({ ...base, kind: nk, level: LEVEL[nk], via: "pattern" }); edits.set(key, { whole: nk }); continue; }
        if (cell.t !== "text") continue;
        const finds = cellFinds(cell.v, rowText);
        if (!finds.length) continue;
        for (const f of finds) hits.push({ ...base, shape: shapeOf(cell.v.slice(f.start, f.end)), kind: f.kind, level: LEVEL[f.kind], via: f.via });
        const toEdit = finds.filter((f) => LEVEL[f.kind] !== "info");
        if (toEdit.length) edits.set(key, toEdit);
      }
    }
  });
  return { hits, edits };
}

/** 같은 줄 왼쪽(빈칸 건너 최대 3칸)의 글자가 개인정보 머리글이면 그 종류 */
function labelLeft(row: RawCell[], c: number): PiiKind | undefined {
  for (let k = c - 1; k >= Math.max(0, c - 3); k--) {
    const x = row[k];
    if (!x || x.t === "empty") continue;
    return x.t === "text" ? headerKind(x.v) : undefined;
  }
  return undefined;
}

export function scanWorkbook(wb: RawWorkbook): PiiReport {
  const { hits } = plan(wb);
  const counts: PiiReport["counts"] = {};
  for (const h of hits) counts[h.kind] = (counts[h.kind] ?? 0) + 1;
  const level = hits.some((h) => h.level === "block") ? "block" : hits.some((h) => h.level === "warn") ? "warn" : hits.length ? "info" : "none";
  return { fileName: wb.fileName, level, counts, hits };
}

/** 가명 사전 — 여러 파일에 같은 것을 넘기면 같은 이름이 같은 가명이 된다 */
export class Pseudonyms {
  private m = new Map<string, string>();
  of(name: string): string {
    let p = this.m.get(name);
    if (!p) { p = `사람${String(this.m.size + 1).padStart(2, "0")}`; this.m.set(name, p); }
    return p;
  }
  get size() { return this.m.size; }
}

/**
 * block · warn 개인정보를 지운 사본(원본은 바꾸지 않는다). info(회사 전화 · 사업자번호)는 남긴다.
 * 숫자 칸은 개인정보로 판정된 칸만 글자로 바꾼다.
 */
export function sanitizeWorkbook(wb: RawWorkbook, names = new Pseudonyms()): { workbook: RawWorkbook; changed: number } {
  const { edits } = plan(wb);
  let changed = 0;
  const sheets = wb.sheets.map((sheet, si) => ({
    ...sheet,
    rows: sheet.rows.map((row, r) => (row ?? []).map((cell, c) => {
      const e = edits.get(`${si}|${r}|${c}`);
      if (!e) return cell;
      changed++;
      if (!Array.isArray(e)) return { v: TOKEN[e.whole] || "[삭제]", t: "text" as const };
      let v = cell.v;
      for (const f of [...e].sort((a, b) => b.start - a.start)) {
        const rep = f.kind === "person" ? names.of(f.name ?? v.slice(f.start, f.end)) : TOKEN[f.kind] || "[삭제]";
        v = v.slice(0, f.start) + rep + v.slice(f.end);
      }
      return { v, t: "text" as const };
    })),
  }));
  return { workbook: { ...wb, sheets }, changed };
}

/** 사람이 읽는 요약(원래 값 없음) */
export function describeReport(rep: PiiReport): string[] {
  const lines: string[] = [];
  const order: PiiLevel[] = ["block", "warn", "info"];
  const word: Record<PiiLevel, string> = { block: "멈춤(지우기 전 분석 안 함)", warn: "분석 전 지움", info: "알림만" };
  for (const lv of order) {
    const hs = rep.hits.filter((h) => h.level === lv);
    if (!hs.length) continue;
    const byKind = new Map<PiiKind, PiiHit[]>();
    for (const h of hs) byKind.set(h.kind, [...(byKind.get(h.kind) ?? []), h]);
    for (const [k, xs] of byKind) {
      const where = xs.slice(0, 5).map((h) => `${h.sheet}!${colLetter(h.col)}${h.row + 1}${h.hidden ? "(숨김)" : ""} ${h.shape}`).join(", ");
      lines.push(`[${word[lv]}] ${PII_LABEL[k]} ${xs.length}건 — ${where}${xs.length > 5 ? " …" : ""}`);
    }
  }
  return lines;
}

function colLetter(c: number): string {
  let s = "";
  let n = c + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
