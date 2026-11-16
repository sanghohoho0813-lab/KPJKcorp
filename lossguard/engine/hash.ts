/**
 * 결정적 지문 — 같은 글자면 어디서 돌려도 같은 16자리 값.
 * 보안용이 아니라 "같은 줄 · 같은 결과"를 알아보는 열쇠용(FNV-1a 32비트 두 벌).
 */
function fnv1a(str: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // 끝 섞기(murmur3 fmix)
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export function hash16(str: string): string {
  const a = fnv1a(str, 0x811c9dc5).toString(16).padStart(8, "0");
  const b = fnv1a(str, 0x9747b28c).toString(16).padStart(8, "0");
  return a + b;
}
