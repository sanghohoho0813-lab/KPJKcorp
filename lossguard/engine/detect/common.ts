import type { CaseMeta, EvidenceRef, Finding, IndustryPack, Line, Link, ParsedDoc, ParsedSheet, RawWorkbook } from "../types";
import { hash16 } from "../hash";

export interface DetectCtx {
  pack: IndustryPack;
  meta: CaseMeta;
  docs: ParsedDoc[];
  raw: Map<string, RawWorkbook>;
  /** 심각도 기준 금액(계약금액) */
  base?: number;
  /** 기준(계약) 문서 ↔ 다른 문서의 연결 */
  links: Map<string, Link[]>;
}

/** 숫자 표기(쉼표) — 환경(로캘)에 따라 달라지지 않게 직접 만든다 */
export function fmt(n: number | undefined): string {
  if (n === undefined || !isFinite(n)) return "-";
  const neg = n < 0;
  const abs = Math.abs(n);
  const int = Math.floor(abs + 1e-9);
  const frac = Math.round((abs - int) * 100) / 100;
  const s = String(int).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const f = frac > 0 ? String(frac).slice(1) : "";
  return (neg ? "-" : "") + s + f;
}

export function evidence(ctx: DetectCtx, line: Line, keys: string[], role: EvidenceRef["role"]): EvidenceRef {
  const wb = ctx.raw.get(line.docId);
  const sheet = wb?.sheets[line.sheetIndex];
  const cols: Record<string, number> = {};
  const values: Record<string, string> = {};
  for (const k of keys) {
    const c = line.cols[k];
    if (c === undefined) continue;
    cols[k] = c;
    values[k] = sheet?.rows[line.row]?.[c]?.v ?? "";
  }
  return { docId: line.docId, fileName: wb?.fileName ?? "", sheet: line.sheet, row: line.row, cols, values, role };
}

export function cellEvidence(ctx: DetectCtx, docId: string, sheetIndex: number, row: number, col: number, key: string, role: EvidenceRef["role"]): EvidenceRef {
  const wb = ctx.raw.get(docId);
  const sheet = wb?.sheets[sheetIndex];
  return { docId, fileName: wb?.fileName ?? "", sheet: sheet?.name ?? "", row, cols: { [key]: col }, values: { [key]: sheet?.rows[row]?.[col]?.v ?? "" }, role };
}

export function severity(ctx: DetectCtx, amount: number | undefined): Finding["severity"] {
  if (amount === undefined || !ctx.base) return "mid";
  const r = Math.abs(amount) / ctx.base;
  return r >= ctx.pack.params.severityHigh ? "high" : r >= ctx.pack.params.severityMid ? "mid" : "low";
}

export function findingKey(parts: (string | number | undefined)[]): string {
  return hash16(parts.map((p) => (p === undefined ? "" : String(p))).join("|"));
}

export function docTag(doc: ParsedDoc): string {
  return `${doc.kind}${doc.round ?? ""}`;
}

/** 세금 앞의 마지막 합계(공급가액) · 세금 뒤의 합계(부가세 포함) */
export function totalsOf(sheet: ParsedSheet): { preTax?: Line; postTax?: Line } {
  const ls = sheet.lines;
  const taxIdx = ls.findIndex((l) => l.kind === "tax");
  const isSum = (l: Line) => l.kind === "total" || l.kind === "subtotal";
  if (taxIdx < 0) {
    const lastTotal = [...ls].reverse().find((l) => l.kind === "total") ?? [...ls].reverse().find(isSum);
    return { preTax: lastTotal };
  }
  const pre = ls.slice(0, taxIdx).reverse().find(isSum);
  const post = ls.slice(taxIdx + 1).find(isSum);
  return { preTax: pre, postTax: post };
}

export function itemSum(lines: Line[]): number {
  let s = 0;
  for (const l of lines) if (l.kind === "item" && !l.flags.includes("overhead")) s += l.amount ?? 0;
  return s;
}
