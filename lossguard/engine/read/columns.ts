import type { ColumnAssign, GroupKey, IndustryPack, LeafRole, RawSheet, SheetShape } from "../types";
import { cellAt } from "../io/xlsx";
import { displaySlack, displayStep, lineTol, parseNum } from "../normalize/number";
import { compactText } from "../normalize/text";
import { numberingOfNoCell } from "../normalize/name";
import type { AliasIndex, HeaderBlock } from "./header";
import { matchGroup, matchLeaf } from "./header";

/**
 * 열 역할 추론 — 세 가지 증거의 합의.
 *  ① 이름: 머리글 별칭 사전
 *  ② 모양: 숫자 비율 · 단위 낱말 비율 · 글자 길이 · 번호 모양
 *  ③ 산술: 수량 × 단가 ≈ 금액 이 성립하는 줄의 비율
 * 머리글 이름이 없거나 틀려도 ③이 수량 · 단가 · 금액 세 열을 찾는다.
 * 한계: 수량과 단가는 곱이 같아 ③으로 구분되지 않는다 → 이름 · 위치(단위 오른쪽) · 크기로 정한다.
 */

export interface ColStat {
  col: number;
  nonEmpty: number;
  /** 코드 모양 글자(DE-001 · A12 · LG_002)의 수 — 이름 열이 아니라 코드 열일 가능성 */
  codeLike: number;
  num: number;
  unitHits: number;
  avgLen: number;
  distinct: number;
  digitText: number;
  numbering: number;
  median: number;
  decimals: number;
}

export function columnStats(sheet: RawSheet, rows: number[], width: number, pack: IndustryPack): ColStat[] {
  const unitForms = new Set<string>();
  for (const u of pack.units) for (const f of u.forms) unitForms.add(compactText(f));
  const out: ColStat[] = [];
  for (let c = 0; c < width; c++) {
    let nonEmpty = 0, num = 0, unitHits = 0, len = 0, digitText = 0, numbering = 0, decimals = 0, codeLike = 0;
    const seen = new Set<string>();
    const vals: number[] = [];
    for (const r of rows) {
      const cell = cellAt(sheet, r, c);
      if (cell.t === "empty") continue;
      nonEmpty++;
      const n = parseNum(cell);
      if (n !== undefined) {
        num++;
        vals.push(Math.abs(n));
        if (Math.abs(n % 1) > 1e-9) decimals++;
        if (numberingOfNoCell(cell.v)) numbering++;
        continue;
      }
      const t = cell.v.trim();
      seen.add(t);
      len += t.length;
      if (unitForms.has(compactText(t))) unitHits++;
      if (/\d/.test(t)) digitText++;
      if (numberingOfNoCell(t)) numbering++;
      if (/^[A-Za-z]{1,4}[-_. ]?\d{1,6}([-_.]\d{1,4})?$/.test(t)) codeLike++;
    }
    vals.sort((a, b) => a - b);
    const texts = nonEmpty - num;
    out.push({
      col: c, nonEmpty, codeLike, num, unitHits, digitText, numbering, decimals,
      avgLen: texts ? len / texts : 0,
      distinct: texts ? seen.size / texts : 0,
      median: vals.length ? vals[Math.floor(vals.length / 2)] : 0,
    });
  }
  return out;
}

interface Triple { q: number; p: number; a: number; rate: number; n: number }

function tripleRate(sheet: RawSheet, rows: number[], q: number, p: number, a: number, pack: IndustryPack): { rate: number; n: number } {
  let n = 0, ok = 0;
  for (const r of rows) {
    const cq = cellAt(sheet, r, q), cp = cellAt(sheet, r, p), ca = cellAt(sheet, r, a);
    const vq = parseNum(cq, true);
    const vp = parseNum(cp);
    const va = parseNum(ca);
    if (vq === undefined || vp === undefined || va === undefined || va === 0 || vq === 0 || vp === 0) continue;
    n++;
    const slack = displaySlack(vq, vp, displayStep(cq), displayStep(cp), displayStep(ca));
    if (Math.abs(vq * vp - va) <= lineTol(va, pack.params.lineAbsTol, pack.params.lineRelTol) + 1 + slack) ok++;
  }
  return { rate: n ? ok / n : 0, n };
}

function allTriples(sheet: RawSheet, rows: number[], numeric: number[], pack: IndustryPack): Triple[] {
  const out: Triple[] = [];
  for (let i = 0; i < numeric.length; i++) for (let j = i + 1; j < numeric.length; j++) for (const a of numeric) {
    const x = numeric[i], y = numeric[j];
    if (a === x || a === y) continue;
    const t = tripleRate(sheet, rows, x, y, a, pack);
    if (t.n >= 3 && t.rate >= 0.5) out.push({ q: x, p: y, a, rate: t.rate, n: t.n });
  }
  out.sort((s, t) => t.rate - s.rate || t.n - s.n || s.a - t.a || s.q - t.q || s.p - t.p);
  return out;
}

type Key = string; // "qty" | "mat.amount" …
const keyOf = (role: LeafRole, group?: GroupKey): Key => (group ? `${group}.${role}` : role);

export interface ColumnResult { columns: ColumnAssign[]; shape: SheetShape; diagnostics: string[] }

export function inferColumns(
  sheet: RawSheet,
  block: HeaderBlock | null,
  dataRows: number[],
  pack: IndustryPack,
  idx: AliasIndex,
): ColumnResult {
  let width = block?.width ?? 0;
  if (!block) for (const r of dataRows) width = Math.max(width, sheet.rows[r]?.length ?? 0);
  const sample = dataRows.slice(0, 400);
  const stats = columnStats(sheet, sample, width, pack);
  const diagnostics: string[] = [];
  const assigned = new Map<number, ColumnAssign>();
  const byKey = new Map<Key, number>();
  const put = (col: number, role: LeafRole, group: GroupKey | undefined, via: ColumnAssign["via"], ev: Partial<ColumnAssign["evidence"]>) => {
    const k = keyOf(role, group);
    const prevCol = byKey.get(k);
    if (prevCol !== undefined && prevCol !== col) assigned.delete(prevCol);
    const old = assigned.get(col);
    if (old) byKey.delete(keyOf(old.role, old.group));
    assigned.set(col, {
      col, role, group, via,
      label: block?.labels[col] ?? "",
      evidence: { name: ev.name ?? old?.evidence.name ?? 0, shape: ev.shape ?? old?.evidence.shape ?? 0, arith: ev.arith ?? old?.evidence.arith ?? 0 },
    });
    byKey.set(k, col);
  };

  /** 머리글이 어떤 역할 낱말을 품었는지(배정되지 않았어도) — 모양으로 이름 열을 고를 때 다른 역할의 머리글은 빼려고 */
  const headerRole = new Map<number, LeafRole>();

  // ① 이름
  if (block) {
    const cands: { col: number; role: LeafRole; group?: GroupKey; score: number }[] = [];
    for (let c = 0; c < width; c++) {
      const parts = block.keys[c];
      if (!parts.length) continue;
      let leaf: ReturnType<typeof matchLeaf>;
      let leafPart = -1;
      for (let i = parts.length - 1; i >= 0 && !leaf; i--) { leaf = matchLeaf(parts[i], idx); if (leaf) leafPart = i; }
      let group: GroupKey | undefined;
      for (let i = 0; i < parts.length && !group; i++) {
        if (i === leafPart && leaf?.score === 1) continue;
        group = matchGroup(parts[i], idx, i === leafPart ? leaf?.alias : undefined);
      }
      if (leaf && group && (leaf.role === "name" || leaf.role === "spec" || leaf.role === "unit" || leaf.role === "no" || leaf.role === "note")) group = undefined;
      if (!leaf && group) cands.push({ col: c, role: "amount", group, score: 0.7 });
      else if (leaf) cands.push({ col: c, role: leaf.role, group, score: leaf.score });
    }
    for (const x of cands) if (!headerRole.has(x.col)) headerRole.set(x.col, x.role);
    cands.sort((a, b) => b.score - a.score || a.col - b.col);
    for (const x of cands) {
      const k = keyOf(x.role, x.group);
      if (byKey.has(k) || assigned.has(x.col)) continue;
      put(x.col, x.role, x.group, "name", { name: x.score });
    }
  }

  const st = (c: number) => stats[c];
  const isNumCol = (c: number) => st(c) && st(c).num >= 3 && st(c).num / Math.max(1, st(c).nonEmpty) >= 0.6;
  const isTextCol = (c: number) => st(c) && st(c).nonEmpty >= 2 && st(c).num / Math.max(1, st(c).nonEmpty) < 0.3;
  const colOf = (role: LeafRole, group?: GroupKey) => byKey.get(keyOf(role, group));

  // 이름으로 숫자 역할을 받은 열이 실제로는 글자 열이면 버린다(예: "공사비" 가 제목인 경우)
  for (const a of [...assigned.values()]) {
    if ((a.role === "qty" || a.role === "unitPrice" || a.role === "amount") && st(a.col) && st(a.col).nonEmpty >= 3 && !isNumCol(a.col)) {
      assigned.delete(a.col); byKey.delete(keyOf(a.role, a.group));
      diagnostics.push(`열 ${a.col + 1}: 머리글은 ${a.role} 이지만 숫자가 아니라서 버림`);
    }
  }

  // ② 모양 — 글자 역할 보충
  if (colOf("unit") === undefined) {
    let bestC = -1, best = 0;
    for (const s of stats) if (!assigned.has(s.col) && isTextCol(s.col) && s.nonEmpty) { const r = s.unitHits / s.nonEmpty; if (r > best) { best = r; bestC = s.col; } }
    if (bestC >= 0 && best >= 0.5) put(bestC, "unit", undefined, "shape", { shape: best });
  }
  if (colOf("name") === undefined) {
    let bestC = -1, best = 0;
    // 이름 열은 첫 숫자 열(번호 열은 빼고)보다 왼쪽에 있다. 코드 모양(DE-001)이 대부분인 열은 이름이 아니라 코드다
    //  다른 역할 낱말을 품은 머리글(예: "비고(산출)")의 열은 이름 후보에서 뺀다
    const firstNum = stats.find((s) => isNumCol(s.col) && assigned.get(s.col)?.role !== "no" && headerRole.get(s.col) !== "no")?.col ?? width;
    for (const s of stats) {
      if (assigned.has(s.col) || !isTextCol(s.col) || s.col > firstNum) continue;
      const hr = headerRole.get(s.col);
      if (hr && hr !== "name") continue;
      const texts = Math.max(1, s.nonEmpty - s.num);
      const score = (s.avgLen * (0.5 + s.distinct) - s.numbering) * (s.codeLike / texts >= 0.6 ? 0.2 : 1);
      if (s.avgLen >= 2 && score > best) { best = score; bestC = s.col; }
    }
    if (bestC >= 0) put(bestC, "name", undefined, "shape", { shape: 0.6 });
  }
  const nameCol = colOf("name");
  const unitCol = colOf("unit");
  if (colOf("spec") === undefined && nameCol !== undefined) {
    const end = unitCol ?? stats.find((s) => s.col > nameCol && isNumCol(s.col))?.col ?? width;
    for (let c = nameCol + 1; c < end; c++) {
      if (assigned.has(c) || !isTextCol(c)) continue;
      const s = st(c);
      if (s.digitText / Math.max(1, s.nonEmpty - s.num) >= 0.2) { put(c, "spec", undefined, "shape", { shape: 0.5 }); break; }
    }
  }
  if (colOf("no") === undefined && nameCol !== undefined) {
    for (let c = 0; c < nameCol; c++) {
      if (assigned.has(c)) continue;
      const s = st(c);
      if (s.nonEmpty >= 2 && s.numbering / s.nonEmpty >= 0.5) { put(c, "no", undefined, "shape", { shape: s.numbering / s.nonEmpty }); break; }
    }
  }

  // ③ 산술 — 수량 · 단가 · 금액
  const numeric = stats.filter((s) => isNumCol(s.col) && colOf("no") !== s.col).map((s) => s.col);
  const triples = allTriples(sheet, sample, numeric, pack);
  const groups = new Set<GroupKey>();
  for (const a of assigned.values()) if (a.group) groups.add(a.group);
  const compare = groups.has("before") || groups.has("after") || groups.has("delta");
  const split = !compare && (groups.has("mat") || groups.has("lab") || groups.has("exp") || groups.has("sum"));

  const decideQty = (x: number, y: number): [number, number] => {
    const sx = st(x), sy = st(y);
    let vx = 0, vy = 0;
    if (unitCol !== undefined) { if (x === unitCol + 1) vx += 2; if (y === unitCol + 1) vy += 2; }
    if (sx.median < sy.median) vx += 1; else if (sy.median < sx.median) vy += 1;
    if (sx.decimals > sy.decimals) vx += 0.5; else if (sy.decimals > sx.decimals) vy += 0.5;
    if (x < y) vx += 0.25; else vy += 0.25;
    return vx >= vy ? [x, y] : [y, x];
  };
  const rateOf = (q?: number, p?: number, a?: number) => (q === undefined || p === undefined || a === undefined ? 0 : tripleRate(sheet, sample, q, p, a, pack).rate);

  /** 한 묶음의 (수량, 단가, 금액)을 맞춘다 — qg · pg · ag 는 각 칸의 묶음 */
  const settle = (qg: GroupKey | undefined, pg: GroupKey | undefined, ag: GroupKey | undefined, allowOverride: boolean) => {
    const q = colOf("qty", qg), p = colOf("unitPrice", pg), a = colOf("amount", ag);
    if (q !== undefined && p !== undefined && a !== undefined) {
      const r = rateOf(q, p, a);
      // 같은 칸 이름을 품은 열이 둘 이상이면(예: 계약수량 · 정산수량) 이름만으로는 고를 수 없다 → 계산이 더 잘 맞는 열로
      if (r < 0.95 && block) {
        const nameHas = (c: number, role: LeafRole) => block.keys[c]?.some((k) => matchLeaf(k, idx)?.role === role) ?? false;
        let best: [number, number, number, number] = [q, p, a, r];
        for (const c of numeric) {
          if (c === q || c === p || c === a) continue;
          if (nameHas(c, "qty")) { const rr = rateOf(c, p, a); if (rr > best[3] + 0.15) best = [c, p, a, rr]; }
          if (nameHas(c, "amount")) { const rr = rateOf(q, p, c); if (rr > best[3] + 0.15) best = [q, p, c, rr]; }
        }
        if (best[3] > r) {
          diagnostics.push(`같은 이름의 열이 여럿이라 계산이 맞는 열로 고름(${Math.round(r * 100)}% → ${Math.round(best[3] * 100)}%)`);
          if (best[0] !== q) put(best[0], "qty", qg, "arith", { name: 0.8, arith: best[3] });
          if (best[2] !== a) put(best[2], "amount", ag, "arith", { name: 0.8, arith: best[3] });
          for (const c of [best[0], best[1], best[2]]) { const x = assigned.get(c); if (x) x.evidence.arith = best[3]; }
          return;
        }
      }
      if (r >= 0.5 || !allowOverride) { for (const c of [q, p, a]) { const x = assigned.get(c); if (x) x.evidence.arith = r; } return; }
      const t = triples[0];
      if (t && t.rate >= 0.8) {
        diagnostics.push(`머리글 이름의 수량 · 단가 · 금액이 계산과 맞지 않아(${Math.round(r * 100)}%) 계산 관계(${Math.round(t.rate * 100)}%)로 다시 정함`);
        const [qq, pp] = (t.q === q && t.p === p) || (t.q === p && t.p === q) ? [q, p] : decideQty(t.q, t.p);
        put(qq, "qty", qg, "arith", { arith: t.rate }); put(pp, "unitPrice", pg, "arith", { arith: t.rate }); put(t.a, "amount", ag, "arith", { arith: t.rate });
      }
      return;
    }
    const cand = triples.find((t) => {
      const cols = [t.q, t.p, t.a];
      const free = (c: number) => !assigned.has(c) || c === q || c === p || c === a;
      if (!cols.every(free)) return false;
      if (a !== undefined && t.a !== a) return false;
      if (q !== undefined && t.q !== q && t.p !== q) return false;
      if (p !== undefined && t.q !== p && t.p !== p) return false;
      return true;
    });
    if (!cand) return;
    let qq: number, pp: number;
    if (q !== undefined) { qq = q; pp = cand.q === q ? cand.p : cand.q; }
    else if (p !== undefined) { pp = p; qq = cand.q === p ? cand.p : cand.q; }
    else [qq, pp] = decideQty(cand.q, cand.p);
    if (q === undefined) put(qq, "qty", qg, "arith", { arith: cand.rate });
    if (p === undefined) put(pp, "unitPrice", pg, "arith", { arith: cand.rate });
    if (a === undefined) put(cand.a, "amount", ag, "arith", { arith: cand.rate });
    for (const c of [qq, pp, cand.a]) { const x = assigned.get(c); if (x) x.evidence.arith = cand.rate; }
  };

  if (compare) {
    for (const g of ["after", "before"] as GroupKey[]) if (groups.has(g)) settle(g, colOf("unitPrice") !== undefined ? undefined : g, g, false);
  } else if (split) {
    for (const g of ["sum", "mat", "lab", "exp"] as GroupKey[]) if (groups.has(g) && colOf("unitPrice", g) !== undefined) settle(undefined, g, g, false);
  } else {
    settle(undefined, undefined, undefined, true);
  }

  const columns = [...assigned.values()].sort((a, b) => a.col - b.col);
  for (const a of columns) if (st(a.col)) a.evidence.shape = a.evidence.shape || shapeScore(a.role, st(a.col));
  const has = (r: LeafRole) => columns.some((c) => c.role === r);
  const shape: SheetShape = compare ? "compare" : split ? "split" : has("amount") || has("qty") ? "plain" : "none";
  return { columns, shape, diagnostics };
}

function shapeScore(role: LeafRole, s: ColStat): number {
  const ne = Math.max(1, s.nonEmpty);
  switch (role) {
    case "qty": case "unitPrice": case "amount": return s.num / ne;
    case "unit": return s.unitHits / Math.max(1, ne - s.num);
    case "name": return Math.min(1, s.avgLen / 6) * (s.num / ne < 0.3 ? 1 : 0.3);
    case "no": return s.numbering / ne;
    default: return 0.5;
  }
}
