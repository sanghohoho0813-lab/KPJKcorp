import type { ColumnAssign, ColumnDecision, CoverAmount, DocInput, IndustryPack, ParsedDoc, ParsedSheet, RawSheet, SheetKind } from "../types";
import { cellAt } from "../io/xlsx";
import { parseNum } from "../normalize/number";
import { compactText, headerKey } from "../normalize/text";
import type { Normalizer } from "../normalize/name";
import { hash16 } from "../hash";
import type { AliasIndex, HeaderBlock } from "./header";
import { findHeader, mergeIndex, sheetWidth } from "./header";
import { inferColumns } from "./columns";
import { buildLines, lineArithOk } from "./rows";
import { checkTotals } from "./totals";

/** 시트 이름으로 종류 짐작 */
export function sheetKindByName(name: string, pack: IndustryPack): SheetKind | undefined {
  const k = compactText(name);
  if (!k) return undefined;
  const order: Exclude<SheetKind, "other">[] = ["unitcost", "summary", "cover", "detail"];
  for (const kind of order) for (const w of pack.sheetNames[kind]) { const c = compactText(w); if (c && (k === c || (c.length >= 2 && k.includes(c)))) return kind; }
  return undefined;
}

/** 표지의 금액(라벨 오른쪽 또는 같은 칸 안의 숫자) */
export function findCoverAmounts(sheet: RawSheet, pack: IndustryPack): CoverAmount[] {
  const labels = pack.coverAmountLabels.map(headerKey);
  const out: CoverAmount[] = [];
  const width = sheetWidth(sheet, 80);
  for (let r = 0; r < Math.min(sheet.rows.length, 80); r++) {
    for (let c = 0; c < width; c++) {
      const cell = cellAt(sheet, r, c);
      if (cell.t !== "text") continue;
      const k = headerKey(cell.v);
      const label = labels.find((l) => k.includes(l));
      if (!label) continue;
      // 같은 칸 안: "견적금액 : ₩12,000,000"
      const inCell = /[₩\\]\s*([\d,]{4,})|([\d,]{5,})\s*원/.exec(cell.v.normalize("NFKC"));
      if (inCell) { out.push({ row: r, col: c, amount: Number((inCell[1] ?? inCell[2]).replace(/,/g, "")), label: cell.v.trim() }); continue; }
      for (let cc = c + 1; cc < width; cc++) {
        const x = cellAt(sheet, r, cc);
        if (x.t === "empty") continue;
        const n = parseNum(x);
        if (n !== undefined && Math.abs(n) >= 1000) { out.push({ row: r, col: cc, amount: n, label: cell.v.trim() }); break; }
        const m = /[₩\\]\s*([\d,]{4,})|([\d,]{5,})\s*원?\s*\)?$/.exec(x.v.normalize("NFKC"));
        if (m) { out.push({ row: r, col: cc, amount: Number((m[1] ?? m[2]).replace(/,/g, "")), label: cell.v.trim() }); break; }
      }
    }
  }
  return out;
}

export function confidenceOf(sheet: { lines: ParsedSheet["lines"]; shape: ParsedSheet["shape"]; columns: ColumnAssign[] }, pack: IndustryPack, coverage: number) {
  let arithRows = 0, arithOk = 0;
  for (const l of sheet.lines) { const ok = lineArithOk(l, pack); if (ok === undefined) continue; arithRows++; if (ok) arithOk++; }
  const checks = checkTotals(sheet.lines, sheet.shape, pack.params.sumTolPerLine);
  const totalRows = checks.length, totalOk = checks.filter((c) => c.ok).length;
  const named = sheet.columns.filter((c) => c.via === "name" || c.via === "decision").length;
  const arithPart = arithRows >= 3 ? arithOk / arithRows : named >= 2 ? 0.8 : 0.4;
  const totalPart = totalRows ? totalOk / totalRows : 0.8;
  const confidence = Math.round((0.6 * arithPart + 0.3 * totalPart + 0.1 * coverage) * 1000) / 1000;
  return { confidence, checks: { arithRows, arithOk, totalRows, totalOk, coverage: Math.round(coverage * 1000) / 1000 } };
}

export function parseSheet(
  raw: RawSheet,
  sheetIndex: number,
  doc: { docId: string; fileName: string },
  pack: IndustryPack,
  idx: AliasIndex,
  norm: Normalizer,
  decision?: ColumnDecision,
): ParsedSheet {
  const mi = mergeIndex(raw);
  const byName = sheetKindByName(raw.name, pack);
  const block: HeaderBlock | null = findHeader(raw, idx, mi);
  const base: ParsedSheet = {
    docId: doc.docId, fileName: doc.fileName, sheet: raw.name, sheetIndex, kind: byName ?? "other", hidden: raw.hidden,
    headerRows: block?.rows ?? [], columns: [], shape: "none", lines: [], confidence: 0,
    checks: { arithRows: 0, arithOk: 0, totalRows: 0, totalOk: 0, coverage: 0 }, coverAmounts: [], diagnostics: [],
  };
  if (byName === "cover" || (!block && !byName)) {
    base.coverAmounts = findCoverAmounts(raw, pack);
    if (!byName) base.kind = base.coverAmounts.length ? "cover" : "other";
    if (!block) return base;
  }
  if (byName === "unitcost") { base.diagnostics.push("단가 산출 시트(unitcost)는 이번 판에서 대조하지 않음"); return base; }
  const start = block ? block.rows[block.rows.length - 1] + 1 : 0;
  const dataRows: number[] = [];
  for (let r = start; r < raw.rows.length; r++) if ((raw.rows[r] ?? []).filter((c) => c && c.t !== "empty").length >= 2) dataRows.push(r);
  let columns: ColumnAssign[];
  let shape: ParsedSheet["shape"];
  if (decision) {
    columns = decision.columns.map((c) => ({ col: c.col, role: c.role, group: c.group, label: block?.labels[c.col] ?? "", evidence: { name: 0, shape: 0, arith: 0 }, via: "decision" as const }));
    const gs = new Set(columns.map((c) => c.group).filter(Boolean));
    shape = gs.has("before") || gs.has("after") || gs.has("delta") ? "compare" : gs.size ? "split" : "plain";
  } else {
    const res = inferColumns(raw, block, dataRows, pack, idx);
    columns = res.columns;
    shape = res.shape;
    base.diagnostics.push(...res.diagnostics);
  }
  base.columns = columns;
  base.shape = shape;
  if (!columns.some((c) => c.role === "amount" || c.role === "qty")) {
    base.diagnostics.push("수량 · 금액 열을 찾지 못함");
    if (!base.coverAmounts.length) base.coverAmounts = findCoverAmounts(raw, pack);
    return base;
  }
  const rows = buildLines({ sheet: raw, sheetIndex, docId: doc.docId, columns, shape, block, startRow: start, pack, norm, mi });
  base.diagnostics.push(...rows.diagnostics);
  // 종류: 이름이 없으면 내용으로
  if (!byName) {
    const items = rows.lines.filter((l) => l.kind === "item");
    const withQty = items.filter((l) => l.qty !== undefined).length;
    const amountOnly = items.filter((l) => l.flags.includes("amount_only")).length;
    const sums = rows.lines.filter((l) => l.kind === "subtotal" || l.kind === "total").length;
    base.kind = withQty >= 3 ? "detail" : amountOnly >= 2 && sums >= 1 ? "summary" : "other";
  }
  // 줄 지문: 시트 종류 + 줄 종류 + 구간 + 이름 · 규격 · 단위 (+ 같은 것이 몇 번째인지)
  const occ = new Map<string, number>();
  for (const l of rows.lines) {
    const id = l.kind === "subtotal" || l.kind === "total"
      ? `${base.kind}|${l.kind}|${l.closes ?? ""}|${l.norm.compact}`
      : `${base.kind}|${l.kind}|${l.sectionKey}|${l.norm.canon}|${l.norm.specNums.join(",")}|${l.norm.unit}`;
    const n = (occ.get(id) ?? 0) + 1;
    occ.set(id, n);
    l.fp = hash16(`${id}#${n}`);
  }
  base.lines = rows.lines;
  const conf = confidenceOf({ lines: rows.lines, shape, columns }, pack, rows.coverage);
  base.confidence = conf.confidence;
  base.checks = conf.checks;
  if (base.confidence < pack.params.confidenceThreshold) base.diagnostics.push(`읽기 신뢰도 ${base.confidence} — 열 지정을 확인해 주세요`);
  return base;
}

export function parseDoc(doc: DocInput, pack: IndustryPack, idx: AliasIndex, norm: Normalizer, decisions?: ColumnDecision[]): ParsedDoc {
  const sheets = doc.workbook.sheets.map((s, i) =>
    parseSheet(s, i, { docId: doc.docId, fileName: doc.workbook.fileName }, pack, idx, norm, decisions?.find((d) => d.docId === doc.docId && d.sheet === s.name)),
  );
  return { docId: doc.docId, kind: doc.kind, round: doc.round, fileName: doc.workbook.fileName, sheets };
}
