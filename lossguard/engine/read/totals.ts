import type { Line, SheetShape } from "../types";

/**
 * 합계 줄 검산 — 소계 · 합계 · 금액을 단 구간 제목이 "무엇의 합"인지는 문서마다 다르다.
 * 그래서 가능한 해석을 모두 계산하고, 하나라도 맞으면 맞는 것으로 본다.
 *  구간 합: 그 줄이 닫는 구간(또는 그 구간 제목)의 항목 합
 *  하위 소계의 합: 그 구간 바로 아래 구간들의 소계(또는 금액 단 구간 제목) 합
 *  직전부터: 바로 앞 합계 줄 다음부터의 항목 · 조정 · 세금 합
 *  누계: 바로 앞 합계 줄의 값 + 직전부터
 *  전체: 그 줄 위의 모든 항목 합 (조정 · 세금 포함 판도 따로)
 *  구간 합계들의 합: 그 줄 위의 최상위 구간 소계(또는 금액 단 구간 제목)의 합
 * 숨긴 행: 숨긴 항목을 넣은 값 · 뺀 값을 따로 계산해, 어느 쪽과 맞는지 알려 준다.
 * 계산량: 한 번 훑으며 누적 합을 쓴다(줄 수 × 구간 깊이).
 */

export type SeriesKey = "amount" | "before.amount" | "after.amount" | "delta.amount";

export function seriesOf(shape: SheetShape, lines: Line[]): SeriesKey[] {
  if (shape !== "compare") return ["amount"];
  const out: SeriesKey[] = [];
  for (const k of ["after.amount", "before.amount", "delta.amount"] as SeriesKey[]) if (lines.some((l) => getSeries(l, k) !== undefined)) out.push(k);
  return out;
}

export function getSeries(l: Line, k: SeriesKey): number | undefined {
  if (k === "amount") return l.amount;
  const [g] = k.split(".") as ["before" | "after" | "delta"];
  return l.groups[g]?.amount;
}

export interface TotalCheck {
  line: Line;
  series: SeriesKey;
  value: number;
  ok: boolean;
  matched?: string;
  expected?: number;
  expectedLabel?: string;
  hiddenNote?: { mode: "included" | "excluded"; count: number; sum: number; rows: number[] };
}

/** 누적 합 한 묶음(전체 · 보이는 것 · 숨긴 줄) */
class Acc {
  all = 0; visible = 0; n = 0; hidden: Line[] = [];
  add(l: Line, v: number) { this.all += v; this.n++; if (l.hidden) this.hidden.push(l); else this.visible += v; }
}
interface Cand { label: string; all: number; visible: number; hidden: Line[]; n: number }
const fromAcc = (label: string, a: Acc, base = 0): Cand => ({ label, all: a.all + base, visible: a.visible + base, hidden: a.hidden, n: a.n });

/** 구간 열쇠의 조상들("/a/b#2" → "/a", "/a/b#2") */
function ancestors(key: string): string[] {
  if (!key) return [];
  const parts = key.split("/").slice(1);
  const out: string[] = [];
  let cur = "";
  for (const p of parts) { cur += "/" + p; out.push(cur); }
  return out;
}
function parentOf(key: string): string { const i = key.lastIndexOf("/"); return i > 0 ? key.slice(0, i) : ""; }

export function checkTotals(lines: Line[], shape: SheetShape, tolPerLine: number): TotalCheck[] {
  const out: TotalCheck[] = [];
  for (const sk of seriesOf(shape, lines)) {
    const val = (l: Line) => getSeries(l, sk);
    // 구간별 항목 합(전체 시트 기준 — 구간 제목/소계는 자기 구간의 모든 항목과 비교)
    const secAcc = new Map<string, Acc>();
    for (const l of lines) {
      if (l.kind !== "item") continue;
      const v = val(l) ?? 0;
      for (const k of ancestors(l.sectionKey)) { let a = secAcc.get(k); if (!a) { a = new Acc(); secAcc.set(k, a); } a.add(l, v); }
    }
    const items = new Acc(), itemsAT = new Acc();
    let since = new Acc();
    let prevValue: number | undefined;
    let topsSum = 0, topsN = 0;
    const kids = new Map<string, { sum: number; n: number }>();
    const tolOf = (n: number) => Math.max(1, n * tolPerLine);
    for (const L of lines) {
      const v = val(L);
      if (L.kind === "item" || L.kind === "adjust" || L.kind === "tax") {
        const x = v ?? 0;
        if (L.kind === "item") items.add(L, x);
        itemsAT.add(L, x);
        since.add(L, x);
        continue;
      }
      const isCheckpoint = L.kind === "subtotal" || L.kind === "total";
      const isSectionAmt = L.kind === "section" && v !== undefined;
      if (!isCheckpoint && !isSectionAmt) continue;
      if (v === undefined) { if (isCheckpoint) { since = new Acc(); prevValue = undefined; } continue; }
      const cands: Cand[] = [];
      const key = isSectionAmt ? L.sectionKey : L.closes;
      if (key) {
        cands.push(fromAcc("구간 합", secAcc.get(key) ?? new Acc()));
        if (isCheckpoint) { const k = kids.get(key); if (k && k.n) cands.push({ label: "하위 소계의 합", all: k.sum, visible: k.sum, hidden: [], n: k.n }); }
      }
      if (isCheckpoint) {
        cands.push(fromAcc("직전부터", since));
        if (prevValue !== undefined) cands.push(fromAcc("누계", since, prevValue));
        cands.push(fromAcc("전체", items));
        cands.push(fromAcc("전체(조정 · 세금 포함)", itemsAT));
        if (topsN) cands.push({ label: "구간 합계들의 합", all: topsSum, visible: topsSum, hidden: [], n: topsN });
      }
      const hitAll = cands.find((c) => Math.abs(c.all - v) <= tolOf(c.n));
      const check: TotalCheck = { line: L, series: sk, value: v, ok: false };
      if (hitAll) {
        check.ok = true;
        check.matched = hitAll.label;
        if (hitAll.hidden.length && Math.abs(hitAll.visible - v) > tolOf(hitAll.n)) {
          check.hiddenNote = { mode: "included", count: hitAll.hidden.length, sum: hitAll.all - hitAll.visible, rows: hitAll.hidden.map((h) => h.row) };
        }
      } else {
        const hitVis = cands.find((c) => c.hidden.length && Math.abs(c.visible - v) <= tolOf(c.n));
        if (hitVis) {
          check.ok = true;
          check.matched = hitVis.label + "(숨긴 행 제외)";
          check.hiddenNote = { mode: "excluded", count: hitVis.hidden.length, sum: hitVis.all - hitVis.visible, rows: hitVis.hidden.map((h) => h.row) };
        } else {
          const order = ["구간 합", "하위 소계의 합", "누계", "직전부터", "전체", "구간 합계들의 합", "전체(조정 · 세금 포함)"];
          const exp = order.map((o) => cands.find((c) => c.label === o)).find(Boolean);
          if (exp) { check.expected = exp.all; check.expectedLabel = exp.label; }
        }
      }
      out.push(check);
      // 상위 소계 · 최상위 합계를 위한 누적
      const myKey = isSectionAmt ? L.sectionKey : L.closes;
      if (myKey) {
        const parent = parentOf(myKey);
        if (parent) { const k = kids.get(parent) ?? { sum: 0, n: 0 }; k.sum += v; k.n++; kids.set(parent, k); }
        else { topsSum += v; topsN++; }
      }
      if (isCheckpoint) { since = new Acc(); prevValue = v; }
    }
  }
  return out;
}

