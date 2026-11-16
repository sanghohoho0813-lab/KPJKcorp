import type { GroupKey, IndustryPack, LeafRole, Merge, RawSheet } from "../types";
import { headerKey } from "../normalize/text";
import { parseNum } from "../normalize/number";
import { cellAt } from "../io/xlsx";

/** 머리글 별칭 찾아보기표(긴 별칭부터) */
export interface AliasIndex { leaf: [string, LeafRole][]; group: [string, GroupKey][] }

export function aliasIndex(pack: IndustryPack): AliasIndex {
  const leaf: [string, LeafRole][] = [];
  for (const role of Object.keys(pack.headerAliases) as LeafRole[]) for (const a of pack.headerAliases[role]) leaf.push([headerKey(a), role]);
  const group: [string, GroupKey][] = [];
  for (const g of Object.keys(pack.groupAliases) as GroupKey[]) for (const a of pack.groupAliases[g]) group.push([headerKey(a), g]);
  const byLen = <T,>(x: [string, T], y: [string, T]) => y[0].length - x[0].length || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0);
  leaf.sort(byLen);
  group.sort(byLen);
  return { leaf: leaf.filter((x) => x[0]), group: group.filter((x) => x[0]) };
}

/** 머리글 한 조각 → 칸 역할. 같으면 1, 별칭을 품으면 0.8(두 글자 이상 별칭만) */
export function matchLeaf(key: string, idx: AliasIndex): { role: LeafRole; score: number; alias: string } | undefined {
  if (!key || key.length > 14) return undefined;
  for (const [a, role] of idx.leaf) if (key === a) return { role, score: 1, alias: a };
  for (const [a, role] of idx.leaf) if (a.length >= 2 && key.includes(a)) return { role, score: 0.8, alias: a };
  return undefined;
}

export function matchGroup(key: string, idx: AliasIndex, exclude?: string): GroupKey | undefined {
  if (!key || key.length > 14) return undefined;
  for (const [a, g] of idx.group) if (key === a) return g;
  for (const [a, g] of idx.group) {
    if (a.length < 2 || !key.includes(a)) continue;
    // "계약수량" 처럼 묶음 + 칸 이름이 붙은 경우: 칸 이름 부분을 빼고도 묶음 별칭이 남아야 한다
    if (exclude && a === exclude) continue;
    return g;
  }
  return undefined;
}

/** 병합 찾아보기 — 병합 범위 안의 모든 칸 → 그 병합 */
export interface MergeIndex { get(r: number, c: number): Merge | undefined }
export function mergeIndex(sheet: RawSheet): MergeIndex {
  const m = new Map<number, Merge>();
  for (const g of sheet.merges) {
    const cells = (g.r2 - g.r1 + 1) * (g.c2 - g.c1 + 1);
    if (cells > 20000) continue;
    for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) m.set(r * 20000 + c, g);
  }
  return { get: (r, c) => m.get(r * 20000 + c) };
}

export function rawText(sheet: RawSheet, r: number, c: number): string {
  return cellAt(sheet, r, c).v.trim();
}
/** 병합을 펼친 글자(병합 범위 안이면 왼쪽 위 칸의 글자) */
export function filledText(sheet: RawSheet, mi: MergeIndex, r: number, c: number): string {
  const g = mi.get(r, c);
  return g ? rawText(sheet, g.r1, g.c1) : rawText(sheet, r, c);
}

export interface HeaderBlock {
  rows: number[];
  /** 열마다 머리글 경로 원문(예: "재료비>단가") */
  labels: string[];
  /** 열마다 경로 조각의 비교용 글자 */
  keys: string[][];
  width: number;
  /** 머리글로 알아본 칸 수 */
  hits: number;
  /** 같은 머리글이 다시 나오는 줄을 알아보기 위한 글자 모음(아래 줄 기준) */
  signature: string[];
}

export function sheetWidth(sheet: RawSheet, upto = 400): number {
  let w = 0;
  for (let r = 0; r < Math.min(sheet.rows.length, upto); r++) w = Math.max(w, sheet.rows[r]?.length ?? 0);
  return w;
}

function rowHits(sheet: RawSheet, r: number, width: number, idx: AliasIndex): { hits: number; groups: number; nums: number; texts: number } {
  let hits = 0, groups = 0, nums = 0, texts = 0;
  for (let c = 0; c < width; c++) {
    const cell = cellAt(sheet, r, c);
    if (cell.t === "empty") continue;
    if (parseNum(cell) !== undefined) { nums++; continue; }
    texts++;
    const k = headerKey(cell.v);
    if (matchLeaf(k, idx)) hits++;
    else if (matchGroup(k, idx)) { hits++; groups++; }
  }
  return { hits, groups, nums, texts };
}

/**
 * 머리글 영역 찾기: 위 60줄에서 머리글 별칭이 가장 많은 줄을 고르고,
 * 바로 위(묶음 머리글: 재료비 · 노무비 …)와 바로 아래(단가 · 금액 …)를 붙인다.
 */
export function findHeader(sheet: RawSheet, idx: AliasIndex, mi: MergeIndex): HeaderBlock | null {
  const width = sheetWidth(sheet);
  if (!width) return null;
  let best = -1, bestScore = -Infinity, bestHits = 0;
  const limit = Math.min(sheet.rows.length, 60);
  for (let r = 0; r < limit; r++) {
    const h = rowHits(sheet, r, width, idx);
    if (h.hits < 2) continue;
    const score = h.hits - 2 * h.nums;
    if (score > bestScore) { best = r; bestScore = score; bestHits = h.hits; }
  }
  if (best < 0) return null;
  const rows = [best];
  // 위 줄: 묶음 머리글이 있고 숫자가 없으며, 표 너비 대부분을 덮는 제목 한 칸이 아니면
  if (best > 0) {
    const up = rowHits(sheet, best - 1, width, idx);
    const title = isTitleRow(sheet, mi, best - 1, width);
    if (!title && up.nums === 0 && (up.groups > 0 || up.hits >= 2)) rows.unshift(best - 1);
  }
  // 아래 줄: 칸 이름(단가 · 금액 …)이 둘 이상이고 숫자가 없거나, 머리글 줄의 세로 병합이 아래 줄까지 내려오면
  const below = best + 1;
  if (below < sheet.rows.length) {
    const dn = rowHits(sheet, below, width, idx);
    let vMerge = 0;
    for (let c = 0; c < width; c++) { const g = mi.get(best, c); if (g && g.r1 === best && g.r2 >= below && g.c1 === c) vMerge++; }
    if ((dn.hits >= 2 && dn.nums === 0) || (vMerge >= 2 && dn.nums === 0)) rows.push(below);
  }
  const labels: string[] = [];
  const keys: string[][] = [];
  const spread = spreadUpper(sheet, mi, rows, width);
  for (let c = 0; c < width; c++) {
    const parts: string[] = [];
    for (const r of rows) {
      const t = filledText(sheet, mi, r, c) || spread.get(r * 20000 + c) || "";
      if (t && parts[parts.length - 1] !== t) parts.push(t);
    }
    labels.push(parts.join(">"));
    keys.push(parts.map(headerKey));
  }
  const last = rows[rows.length - 1];
  const signature: string[] = [];
  for (let c = 0; c < width; c++) { const k = headerKey(filledText(sheet, mi, last, c)); if (k) signature.push(k); }
  for (let c = 0; c < width; c++) { const k = headerKey(rawText(sheet, best, c)); if (k && !signature.includes(k)) signature.push(k); }
  return { rows, labels, keys, width, hits: bestHits, signature };
}

/**
 * 병합 없이 적힌 묶음 머리글(CSV · HTML 내려받기, "선택 영역의 가운데로" 맞춤)을 오른쪽 빈칸으로 넓힌다.
 *   재료비 |      |       ←  위 줄: 왼쪽 칸에만 글자
 *   단 가  | 금 액 |       ←  아래 줄: 두 칸 모두 칸 이름
 * 조건: 위 칸이 비어 있고 병합이 아니며, 바로 아래 칸에 글자가 있고, 왼쪽으로 이어지는 빈칸 끝의 위 칸에도
 * 아래 칸 글자가 있다(= 여러 칸을 덮는 묶음 머리글). 위 줄에 글자가 다시 나오면 멈춘다.
 */
function spreadUpper(sheet: RawSheet, mi: MergeIndex, rows: number[], width: number): Map<number, string> {
  const out = new Map<number, string>();
  for (let i = 0; i < rows.length - 1; i++) {
    const r = rows[i], below = rows[i + 1];
    let src = "";
    for (let c = 0; c < width; c++) {
      const own = filledText(sheet, mi, r, c);
      const under = filledText(sheet, mi, below, c);
      if (own) { src = under && !mi.get(r, c) ? own : ""; continue; }
      if (mi.get(r, c) || !under) { src = ""; continue; }
      if (src) out.set(r * 20000 + c, src);
    }
  }
  return out;
}

function isTitleRow(sheet: RawSheet, mi: MergeIndex, r: number, width: number): boolean {
  let filled = 0;
  for (let c = 0; c < width; c++) if (cellAt(sheet, r, c).t !== "empty") filled++;
  if (filled !== 1) return false;
  for (let c = 0; c < width; c++) {
    const g = mi.get(r, c);
    if (g && g.r1 === r && g.c2 - g.c1 + 1 >= Math.max(3, width * 0.6)) return true;
  }
  return false;
}

/** 표 중간에 머리글이 다시 나오는 줄(인쇄 쪽 나눔) */
export function isRepeatedHeader(sheet: RawSheet, r: number, block: HeaderBlock): boolean {
  if (block.rows.includes(r)) return false;
  const sig = new Set(block.signature);
  let same = 0, filled = 0;
  for (let c = 0; c < block.width; c++) {
    const cell = cellAt(sheet, r, c);
    if (cell.t === "empty") continue;
    filled++;
    if (sig.has(headerKey(cell.v))) same++;
  }
  return same >= 2 && same >= filled * 0.6;
}
