import type { ColumnAssign, GroupKey, IndustryPack, Line, LineKind, LeafRole, Num3, RawSheet, SheetShape } from "../types";
import { cellAt } from "../io/xlsx";
import { lineTol, parseNum } from "../normalize/number";
import { compactText } from "../normalize/text";
import type { Normalizer, NumberingStyle } from "../normalize/name";
import { numberingOfNoCell, stripNumbering } from "../normalize/name";
import type { HeaderBlock, MergeIndex } from "./header";
import { isRepeatedHeader, rawText, sheetWidth } from "./header";

/**
 * 줄 분류 — 항목 / 구간 제목 / 소계 · 합계 / 조정(단수정리 등) / 세금 / 메모.
 * 구간 계층은 번호 모양(Ⅰ. → 1. → 1-1 …)이 처음 나온 순서로 정한다.
 * 금액만 있는 줄은 아래 항목들의 합과 같으면 "금액을 단 구간 제목", 아니면 "금액만 있는 항목"으로 본다.
 */

interface Pre {
  r: number;
  kind: LineKind | "amountOnly" | "unknown";
  label: string;
  labelKey: string;
  style?: NumberingStyle;
  no: string;
  name: string;
  spec: string;
  unit: string;
  note: string;
  qty?: number;
  unitPrice?: number;
  amount?: number;
  groups: Partial<Record<GroupKey, Num3>>;
  cols: Record<string, number>;
  qtyPresent: boolean;
  pricePresent: boolean;
  amountPresent: boolean;
  hidden: boolean;
  flags: string[];
}

export interface RowsResult { lines: Line[]; coverage: number; diagnostics: string[]; dataRows: number }

function words(list: string[]): string[] { return list.map(compactText).filter(Boolean); }

export function buildLines(args: {
  sheet: RawSheet;
  sheetIndex: number;
  docId: string;
  columns: ColumnAssign[];
  shape: SheetShape;
  block: HeaderBlock | null;
  startRow: number;
  pack: IndustryPack;
  norm: Normalizer;
  mi: MergeIndex;
}): RowsResult {
  const { sheet, columns, block, pack, norm, mi } = args;
  const col = (role: LeafRole, group?: GroupKey) => columns.find((c) => c.role === role && c.group === group)?.col;
  const nameCol = col("name"), noCol = col("no"), specCol = col("spec"), unitCol = col("unit"), noteCol = col("note");
  const hiddenRows = new Set(sheet.hiddenRows);
  const tax = words(pack.taxWords), adjust = words(pack.adjustWords), totalW = words(pack.totalWords), subW = words(pack.subtotalWords), overhead = words(pack.overheadWords);
  const noteMarks = pack.noteMarkers;
  const diagnostics: string[] = [];
  const width = block?.width ?? sheetWidth(sheet, sheet.rows.length);
  const tolP = pack.params;

  const num = (r: number, c: number | undefined, lenient = false) => (c === undefined ? undefined : parseNum(cellAt(sheet, r, c), lenient));
  const pres: Pre[] = [];
  let dataRows = 0, repeated = 0;

  for (let r = args.startRow; r < sheet.rows.length; r++) {
    const row = sheet.rows[r] ?? [];
    if (!row.some((c) => c && c.t !== "empty")) continue;
    if (block && isRepeatedHeader(sheet, r, block)) { repeated++; continue; }
    dataRows++;
    // 이름 칸: 같은 줄의 가로 병합(번호 칸부터 이어진 구간 제목 등)만 펼친다
    let name = "";
    if (nameCol !== undefined) {
      const g = mi.get(r, nameCol);
      name = g && g.r1 === r ? rawText(sheet, g.r1, g.c1) : rawText(sheet, r, nameCol);
    }
    const no = noCol !== undefined ? rawText(sheet, r, noCol) : "";
    const spec = specCol !== undefined ? rawText(sheet, r, specCol) : "";
    const unit = unitCol !== undefined ? rawText(sheet, r, unitCol) : "";
    const note = noteCol !== undefined ? rawText(sheet, r, noteCol) : "";
    let label = name;
    if (!label) {
      for (let c = 0; c < width; c++) {
        if (c === noteCol) continue;
        const cell = cellAt(sheet, r, c);
        // 번호 칸의 글자도 번호 모양이 아니면(메모 · 구간 제목이 그 칸에서 시작) 꼬리표로 쓴다
        if (cell.t === "text" && parseNum(cell) === undefined && cell.v.trim() && (c !== noCol || (!numberingOfNoCell(cell.v) && cell.v.trim().length > 3))) { label = cell.v.trim(); break; }
      }
    }
    const cols: Record<string, number> = {};
    const groups: Partial<Record<GroupKey, Num3>> = {};
    for (const a of columns) {
      if (!a.group || (a.role !== "qty" && a.role !== "unitPrice" && a.role !== "amount")) continue;
      const v = num(r, a.col, a.role === "qty");
      if (v === undefined) continue;
      (groups[a.group] ??= {})[a.role] = v;
      cols[`${a.group}.${a.role}`] = a.col;
    }
    const pick = (role: "qty" | "unitPrice" | "amount", order: (GroupKey | undefined)[]): number | undefined => {
      for (const g of order) {
        const c = col(role, g);
        if (c === undefined) continue;
        const v = num(r, c, role === "qty");
        if (v !== undefined) { cols[role] = c; return v; }
      }
      return undefined;
    };
    let qty = pick("qty", [undefined, "after"]);
    let unitPrice = pick("unitPrice", [undefined, "sum", "after"]);
    let amount = pick("amount", [undefined, "sum", "after"]);
    if (args.shape === "split") {
      const parts = (["mat", "lab", "exp"] as GroupKey[]).map((g) => groups[g]).filter(Boolean) as Num3[];
      if (unitPrice === undefined && parts.some((p) => p.unitPrice !== undefined)) unitPrice = parts.reduce((s, p) => s + (p.unitPrice ?? 0), 0);
      if (amount === undefined && parts.some((p) => p.amount !== undefined)) amount = parts.reduce((s, p) => s + (p.amount ?? 0), 0);
    }
    if (args.shape === "compare" && qty === undefined) qty = groups.before?.qty;
    if (args.shape === "compare" && amount === undefined && groups.delta?.amount === undefined) amount = groups.before?.amount;
    const anyGroupQty = Object.values(groups).some((g) => g?.qty !== undefined);
    const anyGroupAmt = Object.values(groups).some((g) => g?.amount !== undefined);
    const st = stripNumbering(label);
    const style = noCol !== undefined && no ? numberingOfNoCell(no) ?? st.style : st.style;
    pres.push({
      r, kind: "unknown", label, labelKey: compactText(st.text), style, no, name, spec, unit, note,
      qty, unitPrice, amount, groups, cols,
      qtyPresent: qty !== undefined || anyGroupQty,
      pricePresent: unitPrice !== undefined,
      amountPresent: amount !== undefined || anyGroupAmt,
      hidden: hiddenRows.has(r),
      flags: [],
    });
  }
  if (repeated) diagnostics.push(`표 중간에 다시 나온 머리글 ${repeated}줄을 건너뜀`);

  // 1차 분류
  const endsWithWord = (k: string, list: string[], slack: number) => list.some((w) => k === w || (w.length >= 2 && k.endsWith(w) && k.length <= w.length + slack));
  for (const p of pres) {
    const k = p.labelKey;
    const hasUnit = !!p.unit;
    if (!p.label && !p.amountPresent && !p.qtyPresent) { p.kind = p.note ? "note" : "unknown"; continue; }
    if (noteMarks.some((m) => p.label.startsWith(m))) { p.kind = "note"; continue; }
    if (!p.qtyPresent && !p.pricePresent && !hasUnit) {
      if (k && tax.some((w) => k.includes(w))) { p.kind = "tax"; continue; }
      if (k && adjust.some((w) => k.includes(w))) { p.kind = "adjust"; continue; }
      if (k && endsWithWord(k, totalW, 6)) { p.kind = "total"; continue; }
      if (k && (endsWithWord(k, subW, 10) || (k.endsWith("계") && k.length <= 10))) { p.kind = "subtotal"; continue; }
    }
    if (p.qtyPresent || p.pricePresent || (hasUnit && p.amountPresent)) { p.kind = p.label ? "item" : "unknown"; continue; }
    if (p.amountPresent) { p.kind = p.label ? "amountOnly" : "unknown"; continue; }
    if (p.label.length > 25) { p.kind = "note"; continue; }
    p.kind = p.label ? "section" : "unknown";
  }
  // 2차: 금액만 있는 줄 — 아래 항목 합과 같으면 구간 제목.
  //  합이 틀렸어도(그것이 바로 찾을 오류) 번호가 붙어 있고 바로 아래가 수량 있는 항목이면 구간 제목으로 본다.
  for (let i = 0; i < pres.length; i++) {
    const p = pres[i];
    if (p.kind !== "amountOnly") continue;
    let sum = 0, n = 0, firstIsQtyItem: boolean | undefined;
    for (let j = i + 1; j < pres.length; j++) {
      const q = pres[j];
      if (q.kind === "item") { if (firstIsQtyItem === undefined) firstIsQtyItem = q.qtyPresent; sum += q.amount ?? 0; n++; continue; }
      if (q.kind === "note" || q.kind === "unknown") continue;
      if (firstIsQtyItem === undefined) firstIsQtyItem = false;
      break;
    }
    const tol = Math.max(1, n * tolP.sumTolPerLine);
    if (n >= 1 && p.amount !== undefined && Math.abs(sum - p.amount) <= tol) p.kind = "section";
    else if (p.style && firstIsQtyItem) { p.kind = "section"; p.flags.push("section_sum_mismatch"); }
    else {
      p.kind = "item";
      p.flags.push("amount_only");
      if (overhead.some((w) => p.labelKey.includes(w))) p.flags.push("overhead");
    }
  }

  // 계층
  const styleOrder: NumberingStyle[] = [];
  interface Open { key: string; level: number; name: string; closed: boolean }
  const stack: Open[] = [];
  const seenKey = new Map<string, number>();
  const lines: Line[] = [];
  let classified = 0;
  for (const p of pres) {
    if (p.kind === "unknown") continue;
    classified++;
    const kind = p.kind as LineKind;
    let level = 0;
    let sectionKey = stack.length ? stack[stack.length - 1].key : "";
    let closes: string | undefined;
    if (kind === "section") {
      if (p.style) { let i = styleOrder.indexOf(p.style); if (i < 0) { styleOrder.push(p.style); i = styleOrder.length - 1; } level = i + 1; }
      else level = stack.length ? stack[stack.length - 1].level : 1;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      const parent = stack.length ? stack[stack.length - 1].key : "";
      const base = `${parent}/${norm.section(p.label)}`;
      const occ = (seenKey.get(base) ?? 0) + 1;
      seenKey.set(base, occ);
      sectionKey = occ > 1 ? `${base}#${occ}` : base;
      stack.push({ key: sectionKey, level, name: stripNumbering(p.label).text.trim(), closed: false });
    } else if (kind === "subtotal") {
      for (let i = stack.length - 1; i >= 0; i--) if (!stack[i].closed) { stack[i].closed = true; closes = stack[i].key; break; }
    } else level = stack.length ? stack[stack.length - 1].level + 1 : 0;
    const path = stack.map((s) => s.name);
    const nm = kind === "item" ? p.name || p.label : p.label;
    lines.push({
      docId: args.docId, sheet: sheet.name, sheetIndex: args.sheetIndex, row: p.r,
      kind, hidden: p.hidden, level, path, sectionKey, closes,
      no: p.no, name: stripNumbering(nm).text.trim() || nm, spec: p.spec, unit: p.unit,
      qty: p.qty, unitPrice: p.unitPrice, amount: p.amount, groups: p.groups,
      cols: {
        ...p.cols,
        ...(nameCol !== undefined ? { name: nameCol } : {}),
        ...(specCol !== undefined ? { spec: specCol } : {}),
        ...(unitCol !== undefined ? { unit: unitCol } : {}),
        ...(noCol !== undefined ? { no: noCol } : {}),
      },
      norm: norm.name(nm, p.spec, p.unit),
      fp: "",
      flags: p.flags,
    });
  }
  const coverage = dataRows ? classified / dataRows : 1;
  return { lines, coverage, diagnostics, dataRows };
}

/** 줄 계산이 맞는가(수량 × 단가 ≈ 금액) — 확인할 수 없으면 undefined */
export function lineArithOk(l: Line, pack: IndustryPack): boolean | undefined {
  if (l.kind !== "item" || l.qty === undefined || l.unitPrice === undefined || l.amount === undefined) return undefined;
  if (l.qty === 0 || l.unitPrice === 0) return undefined;
  return Math.abs(l.qty * l.unitPrice - l.amount) <= lineTol(l.amount, pack.params.lineAbsTol, pack.params.lineRelTol) + 1;
}
