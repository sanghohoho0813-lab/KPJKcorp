import type { CaseMeta } from "../engine/types";
import { CATALOG, type CatItem, type CatSection } from "./catalog";
import { HOLDOUT_CATALOG, NEAR_DUP_SECTION } from "./catalog-holdout";
import { makeItem, rng, vary, type Rng, type Transform } from "./model";
import { BOQ_TEMPLATES, renderBoq, type DocLine, type DocModel } from "./render";
import { writeXlsx } from "./xlsx-write";
import { noisyTemplate, type GtLink, type SynthDoc } from "./index";

/**
 * 과적합 점검용 스트레스 세트 — 개발 때의 가정을 하나씩 깨뜨린 합성 현장(계약 문서 + 다른 문서 1개).
 *  holdout   처음 보는 품목 · 사전에 없는 다른 이름
 *  price     다른 문서의 단가가 재견적으로 달라짐(±5~30%)
 *  shuffle   구간 안 항목 순서가 섞임
 *  resection 다른 문서가 구간(공종)을 층 · 구역 단위로 다시 묶음
 *  typo      이름 오타(비슷한 글자 · 글자 빠짐 · 순서 바뀜)
 *  neardup   이름이 같고 규격만 다른 항목이 여럿
 * 모든 이름 · 금액은 지어낸 것이다.
 */
export interface StressOpts { catalog: "main" | "holdout"; priceDrift: number; shuffle: boolean; resection: boolean; typo: number; nearDup: boolean }
export const STRESS_SETS: { key: string; label: string; opts: Partial<StressOpts> }[] = [
  { key: "base", label: "기준(개발 때와 같은 분포)", opts: {} },
  { key: "holdout", label: "처음 보는 품목 · 사전에 없는 다른 이름", opts: { catalog: "holdout" } },
  { key: "price", label: "다른 문서 단가 재견적(±5~30%)", opts: { priceDrift: 0.3 } },
  { key: "shuffle", label: "구간 안 항목 순서 섞임", opts: { shuffle: true } },
  { key: "resection", label: "구간(공종)을 층 · 구역으로 다시 묶음", opts: { resection: true } },
  { key: "typo", label: "이름 오타(30%)", opts: { typo: 0.3 } },
  { key: "neardup", label: "이름 같고 규격만 다른 항목 다수", opts: { nearDup: true } },
  { key: "all", label: "위 조건 전부 겹침", opts: { catalog: "holdout", priceDrift: 0.3, shuffle: true, resection: true, typo: 0.3, nearDup: true } },
];

const SIMILAR: [string, string][] = [["러", "라"], ["레", "래"], ["케", "캐"], ["데", "대"], ["테", "태"], ["세", "새"], ["네", "내"], ["페", "패"], ["베", "배"], ["체", "채"], ["헤", "해"], ["게", "개"]];
export function typo(r: Rng, s: string): string {
  const chars = [...s];
  const hangul = chars.map((c, i) => (/[가-힣]/.test(c) ? i : -1)).filter((i) => i >= 0);
  if (hangul.length < 3) return s;
  for (const [a, b] of r.shuffle(SIMILAR)) {
    const i = chars.findIndex((c) => c === a || c === b);
    if (i >= 0 && r.chance(0.7)) { chars[i] = chars[i] === a ? b : a; return chars.join(""); }
  }
  const i = r.pick(hangul.slice(1));
  if (r.chance(0.5) && chars[i + 1] && /[가-힣]/.test(chars[i + 1])) { [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]]; return chars.join(""); }
  chars.splice(i, 1);
  return chars.join("");
}

function pickSections(r: Rng, cat: CatSection[], n: number): CatSection[] {
  return r.shuffle(cat.map((_, i) => i)).slice(0, Math.min(n, cat.length)).sort((a, b) => a - b).map((i) => cat[i]);
}

export function generateStressCase(seed: number, o: Partial<StressOpts>): { docs: SynthDoc[]; links: GtLink[]; meta: CaseMeta; title: string } {
  const r = rng(seed * 104729 + 7);
  const opts: StressOpts = { catalog: "main", priceDrift: 0, shuffle: false, resection: false, typo: 0, nearDup: false, ...o };
  const cat = opts.catalog === "holdout" ? HOLDOUT_CATALOG : CATALOG;
  const secs = pickSections(r, cat, r.int(4, 6));
  if (opts.nearDup) secs.push(NEAR_DUP_SECTION);
  const sections = secs.map((cs) => {
    const items = cs.key === "series" ? cs.items : r.shuffle(cs.items).slice(0, r.int(Math.min(2, cs.items.length), cs.items.length));
    const ordered = cs.items.filter((c) => items.includes(c));
    return { key: cs.key, name: cs.name, items: ordered.map((c) => makeItem(r, c, cs.key)) };
  });
  const title = `[가상] 스트레스 ${seed}`;
  const contractModel: DocModel = { title, overheadRate: 0.03, profitRate: 0.05, sections: sections.map((s) => ({ key: s.key, name: s.name, lines: s.items.map((it) => ({ iid: it.iid, cat: it.cat, sec: s.key, name: it.cat.name, spec: it.cat.spec, unit: it.cat.unit, transforms: [], qty: it.qty, price: it.price, parts: it.parts })) })) };
  const pool = BOQ_TEMPLATES.filter((t) => !t.split);
  const ctpl = noisyTemplate(r, r.pick(pool));
  const contract = renderBoq(contractModel, ctpl);
  // 다른 문서: 이름 바꿔 적기 + 스트레스 조건
  const transforms = new Map<string, Transform[]>();
  const varyName = (c: CatItem) => {
    const v = vary(r, c, opts.catalog === "holdout" ? 1.4 : 1);
    if (opts.typo && r.chance(opts.typo)) { v.name = typo(r, v.name); v.transforms.push("typo"); }
    return v;
  };
  let otherSections = sections.map((s) => ({
    key: s.key, name: s.name,
    lines: s.items.map((it): DocLine => {
      const v = varyName(it.cat);
      transforms.set(it.iid, v.transforms);
      const drift = opts.priceDrift ? 1 + (r.chance(0.5) ? 1 : -1) * r.range(0.05, opts.priceDrift) : 1;
      const price = Math.round((it.price * drift) / 10) * 10;
      return { iid: it.iid, cat: it.cat, sec: s.key, name: v.name, spec: v.spec, unit: v.unit, transforms: v.transforms, qty: it.qty, price, parts: [price, 0, 0] };
    }),
  }));
  if (opts.shuffle) otherSections = otherSections.map((s) => ({ ...s, lines: r.shuffle(s.lines) }));
  if (opts.resection) {
    // 층 · 구역 단위로 다시 묶기: 모든 항목을 섞어 2~3개 구역에 나눈다
    const all = r.shuffle(otherSections.flatMap((s) => s.lines));
    const zones = r.int(2, 3);
    const names = ["1층 공사", "2층 공사", "외부 공사"];
    otherSections = Array.from({ length: zones }, (_, z) => ({ key: `zone${z}`, name: names[z], lines: all.filter((_, i) => i % zones === z) }));
  }
  const otpl = noisyTemplate(r, r.pick(pool));
  const other = renderBoq({ title, overheadRate: 0.03, profitRate: 0.05, sections: otherSections }, otpl, {}, { sheetPrefix: "정산" });
  const docs: SynthDoc[] = [
    { docId: "contract", kind: "contract", template: ctpl.id, fileName: `synthetic-stress-${seed}-contract.xlsx`, bytes: writeXlsx(contract.sheets), sheets: contract.sheets, gt: contract.gt },
    { docId: "settlement", kind: "settlement", template: otpl.id, fileName: `synthetic-stress-${seed}-other.xlsx`, bytes: writeXlsx(other.sheets), sheets: other.sheets, gt: other.gt },
  ];
  const links: GtLink[] = [];
  for (const [k, a] of contract.anchors) {
    if (!k.startsWith("item:")) continue;
    const b = other.anchors.get(k);
    if (!b) continue;
    const iid = k.slice(5);
    links.push({ a: { docId: "contract", ...a }, b: { docId: "settlement", ...b }, iid, transforms: transforms.get(iid) ?? [] });
  }
  return { docs, links, meta: { contractAmount: contract.preTax, vat: "excluded" }, title };
}
