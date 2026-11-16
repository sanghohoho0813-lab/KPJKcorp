/** 글자 정규화 — 호환 문자(㎡ · 전각 숫자 · Ⅰ)를 펴고, 띄어쓰기 · 기호를 지운다. */

const DOT = "\u0001";

/** 비교용 압축 글자: 숫자 · 영문 소문자 · 한글만 남긴다(숫자 사이의 점은 남김) */
export function compactText(s: string): string {
  let t = (s || "").normalize("NFKC").toLowerCase();
  t = t.replace(/(\d)\.(\d)/g, `$1${DOT}$2`).replace(/(\d)\.(\d)/g, `$1${DOT}$2`);
  t = t.replace(/[^0-9a-z가-힣\u0001]/g, "");
  return t.split(DOT).join(".");
}

/** 머리글 비교용 — compactText 와 같되 점도 지운다(q'ty → qty, u/price → uprice) */
export function headerKey(s: string): string {
  return compactText(s).replace(/\./g, "");
}

/** 글자 두 개 묶음(겹침 비교용) */
export function bigrams(s: string): string[] {
  if (s.length < 2) return s ? [s] : [];
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

/** 두 묶음의 Dice 계수(중복 허용) */
export function dice(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const m = new Map<string, number>();
  for (const x of a) m.set(x, (m.get(x) ?? 0) + 1);
  let hit = 0;
  for (const x of b) {
    const k = m.get(x) ?? 0;
    if (k > 0) { hit++; m.set(x, k - 1); }
  }
  return (2 * hit) / (a.length + b.length);
}

/** 집합 겹침(Jaccard) */
export function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  return inter / (sa.size + sb.size - inter);
}
