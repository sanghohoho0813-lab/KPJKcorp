import { deflateRawSync } from "node:zlib";
import type { SheetOut } from "./render";
import type { RawWorkbook } from "../engine/types";

/**
 * 표 → 실제 .xlsx 바이트(Node 전용). 합성 문서 만들기와 개인정보를 지운 사본(cli/sanitize.ts)에 쓴다. 엔진은 이 파일을 쓰지 않는다.
 * 공유 문자열 · 숫자 서식(#,##0) · 병합 · 숨긴 행 · 숨긴 열 · 숨긴 시트 · 열 너비를 쓴다. 수식 · 메모 · 그림 · 파일 속성은 쓰지 않는다(값만).
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function colName(c: number): string {
  let s = "";
  let n = c + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files: [string, string][]): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameB = enc.encode(name);
    const data = enc.encode(content);
    const comp = new Uint8Array(deflateRawSync(data));
    const crc = crc32(data);
    const lh = new Uint8Array(30 + nameB.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0, true); lv.setUint16(8, 8, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, comp.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, nameB.length, true);
    lh.set(nameB, 30);
    const ch = new Uint8Array(46 + nameB.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(10, 8, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, comp.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, nameB.length, true);
    cv.setUint32(42, offset, true);
    ch.set(nameB, 46);
    locals.push(lh, comp);
    centrals.push(ch);
    offset += lh.length + comp.length;
  }
  const cdSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cdSize + 22);
  let p = 0;
  for (const part of [...locals, ...centrals, end]) { out.set(part, p); p += part.length; }
  return out;
}

export function writeXlsx(sheets: SheetOut[]): Uint8Array {
  const shared: string[] = [];
  const sIdx = new Map<string, number>();
  const si = (s: string) => { let i = sIdx.get(s); if (i === undefined) { i = shared.length; shared.push(s); sIdx.set(s, i); } return i; };
  const sheetXml = sheets.map((sh) => {
    const hidden = new Set(sh.hiddenRows);
    const rows: string[] = [];
    sh.rows.forEach((row, r) => {
      const cells: string[] = [];
      row.forEach((v, c) => {
        if (v === null || v === undefined || v === "") return;
        const ref = `${colName(c)}${r + 1}`;
        if (typeof v === "number") cells.push(`<c r="${ref}" s="1"><v>${v}</v></c>`);
        else cells.push(`<c r="${ref}" t="s"><v>${si(v)}</v></c>`);
      });
      if (cells.length || hidden.has(r)) rows.push(`<row r="${r + 1}"${hidden.has(r) ? ' hidden="1"' : ""}>${cells.join("")}</row>`);
    });
    const hc = new Set(sh.hiddenCols ?? []);
    const nCols = Math.max(sh.widths.length, ...[...hc].map((c) => c + 1));
    const cols = Array.from({ length: nCols }, (_, i) => (sh.widths[i] !== undefined || hc.has(i) ? `<col min="${i + 1}" max="${i + 1}"${sh.widths[i] !== undefined ? ` width="${sh.widths[i]}" customWidth="1"` : ""}${hc.has(i) ? ' hidden="1"' : ""}/>` : "")).join("");
    const merges = sh.merges.length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${colName(m.c1)}${m.r1 + 1}:${colName(m.c2)}${m.r2 + 1}"/>`).join("")}</mergeCells>` : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ""}<sheetData>${rows.join("")}</sheetData>${merges}</worksheet>`;
  });
  const files: [string, string][] = [];
  files.push(["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`]);
  files.push(["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`]);
  files.push(["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}"${s.hidden ? ' state="hidden"' : ""} r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`]);
  files.push(["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`]);
  files.push(["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="0"/><fonts count="1"><font><sz val="10"/><name val="맑은 고딕"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`]);
  sheetXml.forEach((x, i) => files.push([`xl/worksheets/sheet${i + 1}.xml`, x]));
  files.push(["xl/sharedStrings.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${shared.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}</sst>`]);
  return zip(files);
}

/** 읽은 표(RawWorkbook) → .xlsx — 값 · 병합 · 숨긴 행/열/시트만(지운 사본용) */
export function writeRawWorkbook(wb: RawWorkbook): Uint8Array {
  return writeXlsx(wb.sheets.map((s) => ({
    name: s.name, hidden: s.hidden, merges: s.merges, hiddenRows: s.hiddenRows, hiddenCols: s.hiddenCols, widths: [],
    rows: s.rows.map((r) => (r ?? []).map((x) => (x.t === "num" ? x.n ?? null : x.t === "text" ? x.v : null))),
  })));
}
