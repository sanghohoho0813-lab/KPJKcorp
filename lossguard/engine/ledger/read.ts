import type { IndustryPack, LedgerRecord, LedgerRole, ParsedLedger, RawSheet, RawWorkbook } from "../types";
import { cellAt } from "../io/xlsx";
import { compactText, headerKey } from "../normalize/text";
import { parseNum } from "../normalize/number";
import { hash16 } from "../hash";

/**
 * 매입 · 지급 장부 읽기 — 한 줄 = 한 거래(날짜 · 거래처 · 품목 · 금액 · 문서번호).
 * 내역서와 달리 계층 · 소계 구조가 없으므로 머리글 한 줄 + 거래 줄로 읽는다.
 * 머리글 낱말은 업종 묶음(ledgerAliases)이 준다.
 */
const ROLE_ORDER: LedgerRole[] = ["docNo", "vendorId", "date", "vendor", "item", "spec", "qty", "unitPrice", "supply", "tax", "total", "site", "note"];

function roleOf(text: string, pack: IndustryPack): LedgerRole | undefined {
  const k = headerKey(text);
  if (!k || k.length > 16) return undefined;
  for (const role of ROLE_ORDER) if (pack.ledgerAliases[role].some((a) => headerKey(a) === k)) return role;
  let best: [number, LedgerRole] | undefined;
  for (const role of ROLE_ORDER) for (const a of pack.ledgerAliases[role]) {
    const ak = headerKey(a);
    if (ak.length >= 2 && k.includes(ak) && (!best || ak.length > best[0])) best = [ak.length, role];
  }
  return best?.[1];
}

/** 날짜 → [YYYY-MM-DD, 1970-01-01 부터 날 수]. 2024-07-01 · 2024.7.1 · 2024/7/1 · 20240701 · 24-07-01 · 2024년 7월 1일 · 엑셀 날짜 숫자 */
export function parseDate(v: string, n?: number): [string, number] | undefined {
  let y: number, m: number, d: number;
  if (n !== undefined && Number.isInteger(n) && n > 20000 && n < 80000) {
    const t = Date.UTC(1899, 11, 30) + n * 86400000;
    const dt = new Date(t);
    y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate();
  } else {
    const s = v.normalize("NFKC").trim();
    let x = /^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/.exec(s);
    if (!x) { const y8 = /^(\d{4})(\d{2})(\d{2})$/.exec(s); if (y8) x = y8; }
    if (!x) { const y2 = /^(\d{2})[-./](\d{1,2})[-./](\d{1,2})$/.exec(s); if (y2) x = [y2[0], String(2000 + Number(y2[1])), y2[2], y2[3]] as unknown as RegExpExecArray; }
    if (!x) return undefined;
    y = Number(x[1]); m = Number(x[2]); d = Number(x[3]);
  }
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const day = Math.round(Date.UTC(y, m - 1, d) / 86400000);
  return [`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day];
}

function readSheet(sheet: RawSheet, sheetIndex: number, docId: string, fileName: string, pack: IndustryPack): ParsedLedger | null {
  // 머리글 줄: 위 40줄 중 장부 낱말이 가장 많은 줄(2개 이상)
  let best = -1, bestHits = 0;
  for (let r = 0; r < Math.min(sheet.rows.length, 40); r++) {
    let hits = 0;
    for (let c = 0; c < (sheet.rows[r]?.length ?? 0); c++) { const cell = cellAt(sheet, r, c); if (cell.t === "text" && roleOf(cell.v, pack)) hits++; }
    if (hits > bestHits) { best = r; bestHits = hits; }
  }
  if (best < 0 || bestHits < 2) return null;
  const columns: ParsedLedger["columns"] = [];
  const used = new Set<LedgerRole>();
  for (let c = 0; c < (sheet.rows[best]?.length ?? 0); c++) {
    const cell = cellAt(sheet, best, c);
    if (cell.t !== "text") continue;
    const role = roleOf(cell.v, pack);
    if (!role || used.has(role)) continue;
    used.add(role);
    columns.push({ col: c, role, label: cell.v.trim() });
  }
  const colOf = (r: LedgerRole) => columns.find((x) => x.role === r)?.col;
  const amountCol = colOf("supply") ?? colOf("total");
  const vendorCol = colOf("vendor");
  const diagnostics: string[] = [];
  if (amountCol === undefined || vendorCol === undefined) {
    return { docId, fileName, sheet: sheet.name, sheetIndex, headerRow: best, columns, records: [], diagnostics: [`거래처 · 금액 열을 찾지 못함(찾은 열: ${columns.map((x) => x.label).join(", ") || "없음"})`] };
  }
  const totalWords = new Set([...pack.subtotalWords, ...pack.totalWords].map(compactText));
  const records: LedgerRecord[] = [];
  const occ = new Map<string, number>();
  let skippedNoAmount = 0, badDate = 0;
  for (let r = best + 1; r < sheet.rows.length; r++) {
    const text = (c?: number) => (c === undefined ? "" : cellAt(sheet, r, c).v.trim());
    const vendor = text(vendorCol), item = text(colOf("item"));
    if (!vendor && !item) continue;
    if (totalWords.has(compactText(vendor)) || totalWords.has(compactText(item))) continue;
    const amount = parseNum(cellAt(sheet, r, amountCol));
    if (amount === undefined || amount === 0 || !vendor) { skippedNoAmount++; continue; }
    const cols: LedgerRecord["cols"] = {};
    for (const x of columns) cols[x.role] = x.col;
    const dc = colOf("date");
    let date: string | undefined, day: number | undefined;
    if (dc !== undefined) {
      const cell = cellAt(sheet, r, dc);
      const p = parseDate(cell.v, cell.t === "num" ? cell.n : undefined);
      if (p) [date, day] = p; else if (cell.v.trim()) badDate++;
    }
    const docNo = text(colOf("docNo"));
    const id = `${date ?? ""}|${compactText(vendor)}|${compactText(item)}|${amount}|${docNo}`;
    const k = (occ.get(id) ?? 0) + 1;
    occ.set(id, k);
    records.push({ row: r, date, day, vendor, item, amount, docNo, cols, fp: hash16(`${id}#${k}`) });
  }
  if (skippedNoAmount) diagnostics.push(`금액 · 거래처가 없는 줄 ${skippedNoAmount}개는 거래로 보지 않음`);
  if (badDate) diagnostics.push(`날짜를 읽지 못한 줄 ${badDate}개`);
  if (colOf("date") === undefined) diagnostics.push("날짜 열이 없어 같은 날 · 가까운 날 비교를 하지 않음");
  return { docId, fileName, sheet: sheet.name, sheetIndex, headerRow: best, columns, records, diagnostics };
}

export function readLedgers(docId: string, wb: RawWorkbook, pack: IndustryPack): ParsedLedger[] {
  const out: ParsedLedger[] = [];
  wb.sheets.forEach((s, i) => { const l = readSheet(s, i, docId, wb.fileName, pack); if (l) out.push(l); });
  return out;
}
