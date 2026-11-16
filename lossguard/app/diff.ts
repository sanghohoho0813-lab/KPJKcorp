import type { RunSnapshot } from "./model";

/** 두 번의 분석 비교 — 재분석으로 무엇이 바뀌었는지 사용자에게 보여 준다 */
export interface RunDiff {
  findings: { added: RunSnapshot["findings"]; removed: RunSnapshot["findings"]; amountChanged: { key: string; title: string; before?: number; after?: number }[]; same: number };
  links: { changed: { a: string; b: string; aName: string; bName: string; before: string; after: string }[]; added: number; removed: number };
  columns: { fileId: string; sheet: string; before: string; after: string; confBefore: number; confAfter: number }[];
  counts: { before: RunSnapshot["counts"]; after: RunSnapshot["counts"] };
}

export function diffRuns(prev: RunSnapshot, next: RunSnapshot): RunDiff {
  const pf = new Map(prev.findings.map((f) => [f.key, f])), nf = new Map(next.findings.map((f) => [f.key, f]));
  const added = next.findings.filter((f) => !pf.has(f.key));
  const removed = prev.findings.filter((f) => !nf.has(f.key));
  const amountChanged = next.findings.filter((f) => pf.has(f.key) && pf.get(f.key)!.amount !== f.amount).map((f) => ({ key: f.key, title: f.title, before: pf.get(f.key)!.amount, after: f.amount }));
  const lk = (l: RunSnapshot["links"][number]) => `${l.a}|${l.b}|${l.docB}`;
  const pl = new Map(prev.links.map((l) => [lk(l), l])), nl = new Map(next.links.map((l) => [lk(l), l]));
  const changed: RunDiff["links"]["changed"] = [];
  for (const [k, l] of nl) { const p = pl.get(k); if (p && p.origin !== l.origin) changed.push({ a: l.a, b: l.b, aName: l.aName, bName: l.bName, before: p.origin, after: l.origin }); }
  for (const [k, l] of nl) if (!pl.has(k)) changed.push({ a: l.a, b: l.b, aName: l.aName, bName: l.bName, before: "none", after: l.origin });
  for (const [k, p] of pl) if (!nl.has(k)) changed.push({ a: p.a, b: p.b, aName: p.aName, bName: p.bName, before: p.origin, after: "none" });
  changed.sort((x, y) => (x.aName < y.aName ? -1 : x.aName > y.aName ? 1 : 0));
  const pc = new Map(prev.columns.map((c) => [`${c.fileId}|${c.sheet}`, c]));
  const columns: RunDiff["columns"] = [];
  for (const c of next.columns) { const p = pc.get(`${c.fileId}|${c.sheet}`); if (p && (p.roles !== c.roles || p.confidence !== c.confidence)) columns.push({ fileId: c.fileId, sheet: c.sheet, before: p.roles, after: c.roles, confBefore: p.confidence, confAfter: c.confidence }); }
  return {
    findings: { added, removed, amountChanged, same: next.findings.length - added.length },
    links: { changed, added: [...nl.keys()].filter((k) => !pl.has(k)).length, removed: [...pl.keys()].filter((k) => !nl.has(k)).length },
    columns,
    counts: { before: prev.counts, after: next.counts },
  };
}

export function diffIsEmpty(d: RunDiff): boolean {
  return !d.findings.added.length && !d.findings.removed.length && !d.findings.amountChanged.length && !d.links.changed.length && !d.columns.length;
}
