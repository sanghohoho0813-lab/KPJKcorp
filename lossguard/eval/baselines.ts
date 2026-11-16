import type { IndustryPack, LeafRole, Line, RawSheet } from "../engine/types";
import { cellAt } from "../engine/io/xlsx";
import { parseNum } from "../engine/normalize/number";
import { compactText } from "../engine/normalize/text";
import type { Normalizer } from "../engine/normalize/name";

/**
 * 비교용 단순 방식(기준선) — 우리가 만든 "흔한 단순 처리"의 재현이지 특정 제품이 아니다.
 *  표 읽기: 별칭과 글자가 똑같은 칸이 2개 이상인 첫 줄을 머리글로, 같은 글자의 첫 칸을 그 역할로(병합 · 묶음 · 계산 관계를 보지 않음).
 *           금액 칸에 숫자가 있으면 모두 항목으로 본다(소계 · 합계 구분 없음).
 *  항목 연결: 글자가 똑같은 첫 항목(엑셀 VLOOKUP 과 같은 방식) / 이름 · 규격 · 단위가 모두 같은 첫 항목 / 띄어쓰기 · 기호만 지운 비교.
 */

export interface BaselineSheet { header: number; columns: { col: number; role: LeafRole }[]; rows: { row: number; item: boolean; amount?: number }[] }

export function baselineParse(sheet: RawSheet, pack: IndustryPack): BaselineSheet | null {
  const alias = new Map<string, LeafRole>();
  for (const role of Object.keys(pack.headerAliases) as LeafRole[]) for (const a of pack.headerAliases[role]) { const k = a.replace(/\s+/g, "").toLowerCase(); if (!alias.has(k)) alias.set(k, role); }
  const key = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  let header = -1;
  for (let r = 0; r < Math.min(60, sheet.rows.length); r++) {
    let hits = 0;
    for (const c of sheet.rows[r] ?? []) if (c && c.t === "text" && alias.has(key(c.v))) hits++;
    if (hits >= 2) { header = r; break; }
  }
  if (header < 0) return null;
  const columns: { col: number; role: LeafRole }[] = [];
  (sheet.rows[header] ?? []).forEach((c, col) => {
    if (!c || c.t !== "text") return;
    const role = alias.get(key(c.v));
    if (role && !columns.some((x) => x.role === role)) columns.push({ col, role });
  });
  const amountCol = columns.find((c) => c.role === "amount")?.col;
  const rows: BaselineSheet["rows"] = [];
  for (let r = header + 1; r < sheet.rows.length; r++) {
    const a = amountCol === undefined ? undefined : parseNum(cellAt(sheet, r, amountCol));
    rows.push({ row: r, item: a !== undefined, amount: a });
  }
  return { header, columns, rows };
}

export type MatchMethod = "exactName" | "exactNameSpecUnit" | "normalized";

/** 기준선 항목 연결 — 같은 글자의 첫 미연결 항목 */
export function baselineMatch(base: Line[], other: Line[], method: MatchMethod, plain: Normalizer): { a: Line; b: Line }[] {
  const keyOf = (l: Line) => {
    if (method === "exactName") return l.name.trim();
    if (method === "exactNameSpecUnit") return `${l.name.trim()}|${l.spec.trim()}|${l.unit.trim()}`;
    const n = plain.name(l.name, l.spec, l.unit);
    return `${compactText(n.compact)}|${n.specNums.join(",")}|${n.unit}`;
  };
  const pool = new Map<string, Line[]>();
  for (const a of base) { const k = keyOf(a); const arr = pool.get(k); if (arr) arr.push(a); else pool.set(k, [a]); }
  const out: { a: Line; b: Line }[] = [];
  for (const b of other) {
    const arr = pool.get(keyOf(b));
    if (arr && arr.length) out.push({ a: arr.shift()!, b });
  }
  return out;
}
