import type { IndustryPack, NormName } from "../types";
import { bigrams, compactText, jamoText } from "./text";
import { specTokens } from "./spec";

export type NumberingStyle = "roman" | "dash" | "digit" | "hangul" | "paren" | "circle";

/** 앞머리 번호("1." · "1-1" · "가." · "(1)" · "Ⅰ." · "①")를 떼고, 번호 모양을 알려 준다 */
export function stripNumbering(raw: string): { text: string; style?: NumberingStyle; mark?: string } {
  const s = (raw || "").trim();
  let m = /^([Ⅰ-Ⅻ])[.)]?\s*/.exec(s);
  if (m) return { text: s.slice(m[0].length), style: "roman", mark: m[1] };
  m = /^([①-⑳])\s*/.exec(s);
  if (m) return { text: s.slice(m[0].length), style: "circle", mark: m[1] };
  const n = s.normalize("NFKC");
  m = /^([IVX]{1,4})[.)]\s*/.exec(n);
  if (m) return { text: n.slice(m[0].length), style: "roman", mark: m[1] };
  m = /^(\d+(?:[-.]\d+)+)[.)]?\s+/.exec(n) ?? /^(\d+(?:-\d+)+)[.)]?/.exec(n);
  if (m) return { text: n.slice(m[0].length), style: "dash", mark: m[1] };
  m = /^(\d+)[.)]\s*/.exec(n);
  if (m) return { text: n.slice(m[0].length), style: "digit", mark: m[1] };
  m = /^\((\d+)\)\s*/.exec(n);
  if (m) return { text: n.slice(m[0].length), style: "paren", mark: m[1] };
  m = /^([가나다라마바사아자차카타파하])[.)]\s*/.exec(n);
  if (m) return { text: n.slice(m[0].length), style: "hangul", mark: m[1] };
  return { text: s };
}

/** 번호 칸(번호만 따로 적는 열)의 글자로 번호 모양 알아보기 */
export function numberingOfNoCell(raw: string): NumberingStyle | undefined {
  const s = (raw || "").trim();
  if (!s) return undefined;
  if (/^[Ⅰ-Ⅻ]\.?$/.test(s)) return "roman";
  if (/^[①-⑳]$/.test(s)) return "circle";
  const n = s.normalize("NFKC");
  if (/^[IVX]{1,4}\.?$/.test(n)) return "roman";
  if (/^\d+(?:[-.]\d+)+\.?$/.test(n)) return "dash";
  if (/^\d+[.)]?$/.test(n)) return "digit";
  if (/^\(\d+\)$/.test(n)) return "paren";
  if (/^[가나다라마바사아자차카타파하][.)]?$/.test(n)) return "hangul";
  return undefined;
}

export interface Normalizer {
  name(rawName: string, rawSpec: string, rawUnit: string): NormName;
  unit(raw: string): string;
  /** 합계 · 조정 낱말 비교용 꼬리표(번호 뗀 압축 글자) */
  label(raw: string): string;
  /** 구간 이름 비교용 */
  section(raw: string): string;
  canon(compact: string): string;
}

export function makeNormalizer(pack: IndustryPack, opts: { synonyms?: boolean } = {}): Normalizer {
  const useSyn = opts.synonyms !== false;
  // 같은 뜻 낱말: 긴 것부터 한 번만 훑어 바꾼다(바꾼 글자를 다시 바꾸지 않는다)
  const forms: [string, string][] = [];
  if (useSyn) {
    for (const g of pack.synonyms) {
      const canonical = compactText(g[0]);
      for (const f of g) {
        const c = compactText(f);
        if (c.length >= 2 && c !== canonical) forms.push([c, canonical]);
      }
    }
  }
  forms.sort((a, b) => b[0].length - a[0].length || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const canon = (s: string): string => {
    if (!forms.length || !s) return s;
    let out = "";
    let i = 0;
    while (i < s.length) {
      let hit: [string, string] | undefined;
      for (const f of forms) if (s.startsWith(f[0], i)) { hit = f; break; }
      if (hit) { out += hit[1]; i += hit[0].length; } else { out += s[i]; i++; }
    }
    return out;
  };
  const unitMap = new Map<string, string>();
  for (const u of pack.units) for (const f of u.forms) unitMap.set(compactText(f), u.code);
  const noise = new Set(pack.nameNoise.map(compactText));
  const unit = (raw: string): string => {
    const c = compactText(raw);
    if (!c) return "";
    return unitMap.get(c) ?? c;
  };

  const name = (rawName: string, rawSpec: string, rawUnit: string): NormName => {
    let t = stripNumbering(rawName).text.normalize("NFKC");
    const specBits: string[] = [];
    t = t.replace(/[([{【]([^)\]}】]*)[)\]}】]/g, (_m, inner: string) => {
      const c = compactText(inner);
      if (!c || noise.has(c)) return " ";
      if (/\d/.test(inner)) { specBits.push(inner); return " "; }
      return ` ${inner} `;
    });
    const words = t.split(/[\s,·/_]+|-(?!\d)/).filter(Boolean);
    const kept: string[] = [];
    for (const w of words) {
      const c = compactText(w);
      if (!c || noise.has(c)) continue;
      if (/\d/.test(c)) { specBits.push(w); continue; }
      kept.push(c);
    }
    const compact = kept.join("");
    const canonName = canon(compact);
    const tokens = [...new Set(kept.map(canon))].sort();
    const st = specTokens(`${rawSpec || ""} ${specBits.join(" ")}`);
    return {
      compact,
      canon: canonName,
      tokens,
      bigrams: bigrams(canonName),
      jamo: bigrams(jamoText(canonName)),
      specNums: [...st.nums].sort(),
      specWords: [...new Set(st.words)].sort(),
      unit: unit(rawUnit),
    };
  };

  return {
    name,
    unit,
    label: (raw: string) => compactText(stripNumbering(raw).text),
    section: (raw: string) => canon(compactText(stripNumbering(raw).text)),
    canon,
  };
}
