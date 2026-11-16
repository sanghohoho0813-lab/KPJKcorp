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

/** 금액 비교 허용 오차 */
export function lineTol(amount: number, absTol: number, relTol: number): number {
  return Math.max(absTol, Math.abs(amount) * relTol);
}
