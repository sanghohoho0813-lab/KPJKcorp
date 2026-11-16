import type { Merge, RawCell, RawSheet, RawWorkbook } from "../types";
import { unzipEntries, ZipError } from "./zip";

/**
 * .xlsx → RawWorkbook. 셀 위치 · 병합 범위 · 숨긴 행/열/시트 · 수식 여부를 보존한다.
 * 수식 칸은 파일에 저장된 마지막 계산값을 읽는다(다시 계산하지 않는다).
 * 날짜 칸은 엑셀 일련번호(숫자) 그대로 둔다 — 내역서 대조에는 쓰지 않는다.
 */

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? unescapeXml(m[1]) : undefined;
}

/** <t> 글자 모으기 — 윗주(rPh)는 뺀다 */
function textOf(xml: string): string {
  const noPh = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let out = "";
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(noPh))) out += m[1] ? unescapeXml(m[1]) : "";
  return out;
}

/** "AB12" → [행, 열] (0부터) */
export function cellRef(ref: string): [number, number] {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.replace(/\$/g, ""));
  if (!m) return [-1, -1];
  let c = 0;
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return [Number(m[2]) - 1, c - 1];
}

function resolvePath(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

const EMPTY: RawCell = { v: "", t: "empty" };

function parseSheetXml(xml: string, shared: string[], name: string, hidden: boolean): RawSheet {
  const rows: RawCell[][] = [];
  const hiddenRows: number[] = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rm: RegExpExecArray | null;
  let nextRow = 0;
  while ((rm = rowRe.exec(xml))) {
    const rAttr = attr(rm[0].slice(0, rm[0].indexOf(">") + 1), "r");
    const r = rAttr ? Number(rAttr) - 1 : nextRow;
    nextRow = r + 1;
    const head = rm[0].slice(0, rm[0].indexOf(">") + 1);
    const hid = attr(head, "hidden");
    if (hid === "1" || hid === "true") hiddenRows.push(r);
    const body = rm[2] ?? "";
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    let nextCol = 0;
    const row: RawCell[] = rows[r] ?? [];
    while ((cm = cellRe.exec(body))) {
      const tag = `<c${cm[1]}>`;
      const ref = attr(tag, "r");
      const c = ref ? cellRef(ref)[1] : nextCol;
      nextCol = c + 1;
      const inner = cm[2] ?? "";
      const t = attr(tag, "t") ?? "n";
      const hasF = /<f\b/.test(inner);
      const vm = /<v>([\s\S]*?)<\/v>/.exec(inner);
      let cell: RawCell = EMPTY;
      if (t === "s") {
        const s = vm ? shared[Number(vm[1])] ?? "" : "";
        cell = s ? { v: s, t: "text" } : EMPTY;
      } else if (t === "inlineStr") {
        const s = textOf(inner);
        cell = s ? { v: s, t: "text" } : EMPTY;
      } else if (t === "str" || t === "e") {
        const s = vm ? unescapeXml(vm[1]) : "";
        cell = s ? { v: s, t: "text" } : EMPTY;
      } else if (t === "b") {
        cell = vm ? { v: vm[1] === "1" ? "TRUE" : "FALSE", t: "text" } : EMPTY;
      } else if (vm) {
        const raw = vm[1].trim();
        const n = Number(raw);
        cell = raw === "" ? EMPTY : isFinite(n) ? { v: raw, t: "num", n } : { v: raw, t: "text" };
      }
      if (hasF && cell.t !== "empty") cell = { ...cell, f: true };
      if (cell.t !== "empty") {
        while (row.length < c) row.push(EMPTY);
        row[c] = cell;
      }
    }
    rows[r] = row;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  const merges: Merge[] = [];
  const mRe = /<mergeCell\b[^>]*\sref="([A-Z$]+\d+):([A-Z$]+\d+)"/g;
  let mm: RegExpExecArray | null;
  while ((mm = mRe.exec(xml))) {
    const [r1, c1] = cellRef(mm[1]);
    const [r2, c2] = cellRef(mm[2]);
    if (r1 >= 0 && c1 >= 0) merges.push({ r1, c1, r2, c2 });
  }
  const hiddenCols: number[] = [];
  const colRe = /<col\b[^>]*>/g;
  let colm: RegExpExecArray | null;
  while ((colm = colRe.exec(xml))) {
    const h = attr(colm[0], "hidden");
    if (h === "1" || h === "true") {
      const min = Number(attr(colm[0], "min") ?? 0) - 1;
      const max = Number(attr(colm[0], "max") ?? 0) - 1;
      for (let c = Math.max(0, min); c <= max && c < 16384; c++) hiddenCols.push(c);
    }
  }
  return { name, hidden, rows, merges, hiddenRows, hiddenCols };
}

export async function readXlsx(bytes: Uint8Array, fileName = ""): Promise<RawWorkbook> {
  const files = await unzipEntries(bytes, (n) => n.endsWith(".xml") || n.endsWith(".rels"));
  const dec = new TextDecoder("utf-8");
  const read = (p: string) => { const b = files.get(p); return b ? dec.decode(b) : undefined; };
  const wbXml = read("xl/workbook.xml");
  if (!wbXml) throw new ZipError("엑셀 통합 문서가 아닙니다(workbook.xml 없음). .xls 는 엑셀에서 .xlsx 로 저장해 주세요.");
  const relsXml = read("xl/_rels/workbook.xml.rels") ?? "";
  const rels = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id");
    const target = attr(m[0], "Target");
    if (id && target) rels.set(id, resolvePath("xl/workbook.xml", target));
  }
  const shared: string[] = [];
  const ssXml = read("xl/sharedStrings.xml");
  if (ssXml) for (const m of ssXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\s*\/>/g)) shared.push(m[1] ? textOf(m[1]) : "");
  const sheets: RawSheet[] = [];
  for (const m of wbXml.matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], "name") ?? `Sheet${sheets.length + 1}`;
    const rid = attr(m[0], "r:id") ?? attr(m[0], "id");
    const state = attr(m[0], "state");
    const path = rid ? rels.get(rid) : undefined;
    const xml = path ? read(path) : undefined;
    if (!xml) continue;
    sheets.push(parseSheetXml(xml, shared, name, state === "hidden" || state === "veryHidden"));
  }
  return { fileName, sheets };
}

/** 칸 하나를 안전하게(없으면 빈 칸) */
export function cellAt(sheet: RawSheet, r: number, c: number): RawCell {
  return sheet.rows[r]?.[c] ?? EMPTY;
}
