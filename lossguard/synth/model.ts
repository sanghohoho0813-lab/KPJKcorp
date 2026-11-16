import { CATALOG, type CatItem } from "./catalog";

/** 씨앗 값이 같으면 같은 수열(mulberry32) */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    range: (lo: number, hi: number) => lo + next() * (hi - lo),
    chance: (p: number) => next() < p,
    pick: <T,>(arr: T[]): T => arr[Math.floor(next() * arr.length)],
    shuffle: <T,>(arr: T[]): T[] => { const b = [...arr]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; },
  };
}
export type Rng = ReturnType<typeof rng>;

export interface ItemInst {
  iid: string;
  cat: CatItem;
  sec: string;
  qty: number;
  price: number;
  parts: [number, number, number];
}
export interface SecInst { key: string; name: string; items: ItemInst[] }
export interface Project {
  seed: number;
  title: string;
  sections: SecInst[];
  overheadRate: number;
  profitRate: number;
}

const round10 = (x: number) => Math.round(x / 10) * 10;
const roundQ = (x: number, dec: number) => { const f = 10 ** dec; return Math.round(x * f) / f; };

function priceParts(price: number, split: [number, number, number]): [number, number, number] {
  const m = Math.min(price, round10(price * split[0]));
  const l = Math.min(price - m, round10(price * split[1]));
  return [m, l, price - m - l];
}

export function makeItem(r: Rng, cat: CatItem, sec: string): ItemInst {
  const price = round10(cat.price * r.range(0.85, 1.2));
  const qty = cat.qty[0] === cat.qty[1] ? cat.qty[0] : roundQ(r.range(cat.qty[0], cat.qty[1]), cat.dec);
  return { iid: `${sec}:${cat.id}`, cat, sec, qty: Math.max(qty, cat.dec ? 0.5 : 1), price, parts: priceParts(price, cat.split) };
}

export function makeProject(seed: number, opts: { minSections?: number; maxSections?: number; minItems?: number; maxItems?: number } = {}): Project {
  const r = rng(seed);
  const nSec = r.int(opts.minSections ?? 5, Math.min(opts.maxSections ?? 9, CATALOG.length));
  const chosen = r.shuffle(CATALOG.map((_, i) => i)).slice(0, nSec).sort((a, b) => a - b).map((i) => CATALOG[i]);
  const sections: SecInst[] = chosen.map((cs) => {
    const n = r.int(Math.min(opts.minItems ?? 3, cs.items.length), Math.min(opts.maxItems ?? 7, cs.items.length));
    const picks = r.shuffle(cs.items.map((_, i) => i)).slice(0, n).sort((a, b) => a - b).map((i) => cs.items[i]);
    return { key: cs.key, name: cs.name, items: picks.map((c) => makeItem(r, c, cs.key)) };
  });
  const titles = ["사옥 리모델링", "사무실 인테리어", "매장 인테리어", "병원 내부 개보수", "학원 실내 공사", "카페 인테리어"];
  return { seed, title: `[가상] 가나${r.int(1, 99)} ${r.pick(titles)}`, sections, overheadRate: r.pick([0.03, 0.04, 0.05]), profitRate: r.pick([0.05, 0.06, 0.08]) };
}

/** 대규모 시험용: 같은 품목을 여러 층 · 구역으로 반복해 줄 수를 늘린다 */
export function makeLargeProject(seed: number, targetLines: number): Project {
  const r = rng(seed);
  const sections: SecInst[] = [];
  let lines = 0, zone = 1;
  while (lines < targetLines) {
    for (const cs of CATALOG) {
      if (lines >= targetLines) break;
      const items = cs.items.map((c) => { const it = makeItem(r, c, `${cs.key}${zone}`); return it; });
      sections.push({ key: `${cs.key}${zone}`, name: `${cs.name} ${zone}구역`, items });
      lines += items.length;
    }
    zone++;
  }
  return { seed, title: "[가상] 대규모 시험 현장", sections, overheadRate: 0.03, profitRate: 0.05 };
}

// ── 변경 · 정산 ──────────────────────────────────────────────────────
export interface ChangeLine { inst: ItemInst; before: number; after: number; status: "same" | "qty" | "removed" | "added" }
export interface ChangeModel { lines: ChangeLine[]; sections: { key: string; name: string; lines: ChangeLine[] }[] }

export function makeChange(r: Rng, p: Project): ChangeModel {
  const sections = p.sections.map((s) => {
    const lines: ChangeLine[] = s.items.map((it) => {
      const x = r.next();
      if (x < 0.22) return { inst: it, before: it.qty, after: roundQ(it.qty * r.range(0.6, 1.6), it.cat.dec) || it.qty + 1, status: "qty" as const };
      if (x < 0.27 && s.items.length > 2) return { inst: it, before: it.qty, after: 0, status: "removed" as const };
      return { inst: it, before: it.qty, after: it.qty, status: "same" as const };
    });
    // 추가 항목: 같은 구간의 안 쓴 품목
    const cs = CATALOG.find((c) => c.key === s.key);
    const unused = cs ? cs.items.filter((c) => !s.items.some((i) => i.cat.id === c.id)) : [];
    if (unused.length && r.chance(0.45)) {
      const it = makeItem(r, r.pick(unused), s.key);
      lines.push({ inst: it, before: 0, after: it.qty, status: "added" });
    }
    return { key: s.key, name: s.name, lines };
  });
  return { sections, lines: sections.flatMap((s) => s.lines) };
}

export interface SettleLine { inst: ItemInst; contractQty: number; settledQty: number }
export function makeSettlement(r: Rng, ch: ChangeModel | null, p: Project): { sections: { key: string; name: string; lines: SettleLine[] }[] } {
  const src = ch ? ch.sections.map((s) => ({ key: s.key, name: s.name, items: s.lines.filter((l) => l.after > 0).map((l) => ({ inst: l.inst, q: l.after })) }))
    : p.sections.map((s) => ({ key: s.key, name: s.name, items: s.items.map((i) => ({ inst: i, q: i.qty })) }));
  return {
    sections: src.map((s) => ({
      key: s.key, name: s.name,
      lines: s.items.map(({ inst, q }) => ({ inst, contractQty: q, settledQty: r.chance(0.3) ? Math.max(inst.cat.dec ? 0.1 : 1, roundQ(q * r.range(0.92, 1.08), inst.cat.dec)) : q })),
    })),
  };
}

// ── 다른 문서에서 이름을 다르게 적기 ─────────────────────────────────
export type Transform = "space" | "specInName" | "specNotation" | "unitForm" | "synonym:dict" | "synonym:nodict" | "synonym:hard" | "order" | "tag";
export interface Named { name: string; spec: string; unit: string; transforms: Transform[] }

const UNIT_FORMS: Record<string, string[]> = { "㎡": ["M2", "m2", "m²"], "M": ["m"], "개": ["EA", "ea"], "식": ["LS", "L.S"], "개소": ["개소"], "조": ["SET", "조"], "대": ["대"], "면": ["면"] };

export function vary(r: Rng, cat: CatItem, strength: number): Named {
  let name = cat.name, spec = cat.spec, unit = cat.unit;
  const tf: Transform[] = [];
  if (cat.alts.length && r.chance(0.3 * strength)) {
    const alt = r.pick(cat.alts);
    name = alt.name;
    tf.push(`synonym:${alt.kind}` as Transform);
  }
  if (r.chance(0.12 * strength) && name.includes(" ")) {
    const w = name.split(" ");
    if (w.length >= 2) { [w[0], w[1]] = [w[1], w[0]]; name = w.join(" "); tf.push("order"); }
  }
  if (r.chance(0.25 * strength)) {
    const before = name;
    name = name.includes(" ") ? name.replace(/ /g, "") : name.length >= 4 ? `${name.slice(0, 2)} ${name.slice(2)}` : name;
    if (name !== before) tf.push("space");
  }
  if (spec && r.chance(0.2 * strength)) {
    const before = spec;
    spec = spec.replace(/(\d)x(\d)/g, r.chance(0.5) ? "$1*$2" : "$1×$2").replace(/^(\d+(?:\.\d+)?)T$/, "T$1").replace(/sq$/, "SQ");
    if (spec !== before) tf.push("specNotation");
  }
  if (spec && r.chance(0.15 * strength)) { name = `${name}(${spec})`; spec = ""; tf.push("specInName"); }
  if (r.chance(0.25 * strength) && UNIT_FORMS[unit]) { const u = r.pick(UNIT_FORMS[unit]); if (u !== unit) { unit = u; tf.push("unitForm"); } }
  if (r.chance(0.08 * strength)) { name = r.chance(0.5) ? `(변경) ${name}` : `${name} [수정]`; tf.push("tag"); }
  return { name, spec, unit, transforms: tf };
}
