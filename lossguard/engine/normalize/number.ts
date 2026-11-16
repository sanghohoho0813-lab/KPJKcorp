import type { RawCell } from "../types";

/**
 * 칸 → 숫자. 숫자 칸은 그대로, 글자 칸은 한국 문서의 표기를 읽는다.
 *  1,234 · (1,000)=음수 · △1,000=음수 · ▲ · - (빈 값 0) · ₩ · 원
 * lenient: 숫자 뒤의 짧은 단위 글자(1식 · 2개)를 허용 — 수량 칸에서만 쓴다.
 * 규격 같은 "9.5T" · "600*600" 은 숫자로 읽지 않는다(엄격 모드).
 */
export function parseNum(c: RawCell | undefined, lenient = false): number | undefined {
  if (!c || c.t === "empty") return undefined;
  if (c.t === "num") return c.n;
  let s = c.v.normalize("NFKC").trim();
  if (!s) return undefined;
  if (/^[-–—=]+$/.test(s)) return 0;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1).trim(); }
  if (/^[△▲▽-]/.test(s)) { neg = !neg; s = s.slice(1).trim(); }
  s = s.replace(/^[₩\\]\s*/, "").replace(/,/g, "").replace(/\s*원$/, "");
  const re = lenient ? /^(\d+(?:\.\d+)?|\.\d+)\s*([a-z가-힣]{0,2})$/i : /^(\d+(?:\.\d+)?|\.\d+)$/;
  const m = re.exec(s);
  if (!m) return undefined;
  const v = parseFloat(m[1]);
  if (!isFinite(v)) return undefined;
  return neg ? -v : v;
}

/** 칸이 숫자처럼 보이는가(엄격) */
export function isNumeric(c: RawCell | undefined): boolean {
  return parseNum(c) !== undefined;
}

/**
 * 글자로 적힌 숫자가 반올림되어 보였을 수 있는 폭 — CSV · HTML 표처럼 "보이는 값"만 남은 파일용.
 * 소수 자릿수 기준 ±0.5 단위(예: "560" → 0.5, "559.6" → 0.05). 숫자 칸(저장된 값)은 0.
 */
export function displayStep(c: RawCell | undefined): number {
  if (!c || c.t !== "text" || parseNum(c, true) === undefined) return 0;
  const m = /\.(\d+)/.exec(c.v.replace(/,/g, ""));
  return 0.5 * 10 ** -(m ? m[1].length : 0);
}

/** 곱셈 검산의 반올림 여유: |단가|·δ수량 + |수량|·δ단가 + δ수량·δ단가 + δ금액 */
export function displaySlack(q: number, p: number, dq: number, dp: number, da: number): number {
  return Math.abs(p) * dq + Math.abs(q) * dp + dq * dp + da;
}

/** 금액 비교 허용 오차 */
export function lineTol(amount: number, absTol: number, relTol: number): number {
  return Math.max(absTol, Math.abs(amount) * relTol);
}
