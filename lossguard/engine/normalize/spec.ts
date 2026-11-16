/**
 * 규격 → 숫자 토큰과 글자 토큰.
 *  "600*600" · "600x600" · "600×600" → 숫자 [600, 600]
 *  "9.5T" · "T9.5" · "9.5mm" → 숫자 [9.5]
 *  "HFIX 2.5sq" → 숫자 [2.5], 글자 [hfix, sq]
 */
export function specTokens(s: string): { nums: string[]; words: string[] } {
  const t = (s || "").normalize("NFKC").toLowerCase().replace(/(\d)\s*[x×*]\s*(?=\d)/g, "$1 x ");
  const nums = (t.match(/\d+(?:\.\d+)?/g) ?? []).map((x) => String(parseFloat(x)));
  const words = (t.replace(/\d+(?:\.\d+)?/g, " ").match(/[a-z가-힣]+/g) ?? []).filter((w) => w !== "x");
  return { nums, words };
}

/** 숫자 토큰 두 묶음의 일치 정도: 1 같음 · 0~1 일부 · 0 다름. 한쪽이라도 없으면 undefined */
export function numsOverlap(a: string[], b: string[]): number | undefined {
  if (!a.length || !b.length) return undefined;
  const m = new Map<string, number>();
  for (const x of a) m.set(x, (m.get(x) ?? 0) + 1);
  let hit = 0;
  for (const x of b) {
    const k = m.get(x) ?? 0;
    if (k > 0) { hit++; m.set(x, k - 1); }
  }
  return hit / Math.max(a.length, b.length);
}

/**
 * 규격 숫자 비교(연결 판단용): 1 = 숫자가 모두 같음 / 0.7 = 한쪽이 다른 쪽을 포함(정보가 더 적힌 경우) / 0 = 하나라도 다름(다른 규격).
 * 600x600 ↔ 300x600 은 숫자 하나를 공유해도 다른 규격이다. 한쪽이라도 숫자가 없으면 undefined.
 */
export function specNumSim(a: string[], b: string[]): number | undefined {
  if (!a.length || !b.length) return undefined;
  const count = (xs: string[]) => { const m = new Map<string, number>(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); return m; };
  const ma = count(a), mb = count(b);
  const within = (x: Map<string, number>, y: Map<string, number>) => [...x].every(([k, n]) => (y.get(k) ?? 0) >= n);
  const ab = within(ma, mb), ba = within(mb, ma);
  if (ab && ba) return 1;
  if (ab || ba) return 0.7;
  return 0;
}
