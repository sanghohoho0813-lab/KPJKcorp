/**
 * 엑셀(.xlsx)·CSV 읽고 쓰기 — 외부 라이브러리 없이.
 *
 * 왜 직접 만드나
 * - 필요한 건 "표 한 장을 쓰고, 표 한 장을 읽는 것"뿐이다. 수백 KB 짜리 라이브러리를 넣으면
 *   휴대폰 첫 화면 로딩이 느려지고, 보안 업데이트를 계속 따라가야 한다.
 * - xlsx 는 "XML 파일 몇 개를 zip 으로 묶은 것"이다. 쓰기는 압축 없이(STORE) 묶고,
 *   읽기는 브라우저 내장 압축 해제(DecompressionStream)를 쓴다.
 *
 * 다루는 범위: 글자·숫자 셀, 머리글 굵게·고정, 열 너비. 수식·서식·병합은 읽을 때 값만 가져온다.
 */

export type CellValue = string | number | null | undefined;
export interface SheetData {
  name: string;
  rows: CellValue[][];
  /** 열 너비(글자 수 기준). 없으면 내용 길이로 잡는다 */
  widths?: number[];
  /** 첫 줄을 머리글로 굵게 + 틀 고정 (기본 true) */
  header?: boolean;
}

/* ================= 쓰기 ================= */

const enc = new TextEncoder();

function esc(s: string) {
  // XML 에 못 쓰는 제어문자는 뺀다 (탭·줄바꿈은 남김)
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function colName(i: number) {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** 시트 이름 규칙: 31자 이내, [ ] : * ? / \ 금지, 중복 금지 */
function safeSheetNames(names: string[]) {
  const used = new Set<string>();
  return names.map((raw, i) => {
    const base = (raw.replace(/[[\]:*?/\\]/g, " ").trim() || `Sheet${i + 1}`).slice(0, 31);
    let name = base;
    for (let k = 2; used.has(name.toLowerCase()); k += 1) name = `${base.slice(0, 28)}(${k})`;
    used.add(name.toLowerCase());
    return name;
  });
}

/** 한글은 영문보다 넓다 — 열 너비를 글자 폭으로 어림한다 */
function textWidth(s: string) {
  let w = 0;
  for (const ch of s) w += /[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch) ? 1.8 : 1;
  return w;
}

function sheetXml(sheet: SheetData) {
  const header = sheet.header !== false;
  const ncol = Math.max(0, ...sheet.rows.map((r) => r.length));
  const widths = Array.from({ length: ncol }, (_, c) => {
    if (sheet.widths?.[c]) return sheet.widths[c];
    let w = 6;
    for (const r of sheet.rows.slice(0, 200)) {
      const v = r[c];
      if (v === null || v === undefined) continue;
      const longest = String(v).split("\n").reduce((m, line) => Math.max(m, textWidth(line)), 0);
      w = Math.max(w, longest);
    }
    return Math.min(60, Math.ceil(w + 2));
  });
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  out.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');
  if (header && sheet.rows.length > 1) {
    out.push('<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>');
  }
  if (ncol) out.push(`<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`);
  out.push("<sheetData>");
  sheet.rows.forEach((row, r) => {
    const style = header && r === 0 ? ' s="1"' : ' s="2"';
    const cells: string[] = [];
    row.forEach((v, c) => {
      if (v === null || v === undefined || v === "") return;
      const ref = `${colName(c)}${r + 1}`;
      if (typeof v === "number" && Number.isFinite(v)) cells.push(`<c r="${ref}"${style}><v>${v}</v></c>`);
      else cells.push(`<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`);
    });
    out.push(`<row r="${r + 1}">${cells.join("")}</row>`);
  });
  out.push("</sheetData>");
  if (header && sheet.rows.length > 1 && ncol) out.push(`<autoFilter ref="A1:${colName(ncol - 1)}${sheet.rows.length}"/>`);
  out.push("</worksheet>");
  return out.join("");
}

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font>' +
  '<font><b/><sz val="11"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F3F5"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

/** 여러 시트를 .xlsx 바이트로 */
export function buildXlsx(sheets: SheetData[]): Uint8Array {
  const names = safeSheetNames(sheets.map((s) => s.name));
  const files: [string, string][] = [
    [
      "[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
        "</Types>",
    ],
    [
      "_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ],
    [
      "xl/workbook.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
        "</sheets></workbook>",
    ],
    [
      "xl/_rels/workbook.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    ["xl/styles.xml", STYLES],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)] as [string, string]),
  ];
  return zipStore(files.map(([n, c]) => [n, enc.encode(c)]));
}

/* ---- zip (무압축) ---- */

let CRC: Uint32Array | null = null;
function crc32(buf: Uint8Array) {
  if (!CRC) {
    CRC = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(entries: [string, Uint8Array][]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  // 파일 날짜: 2020-01-01 00:00 (DOS 형식) — 내용과 무관하게 고정해 같은 데이터면 같은 파일이 된다
  const dosTime = 0;
  const dosDate = ((2020 - 1980) << 9) | (1 << 5) | 1;
  for (const [name, data] of entries) {
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 파일 이름
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    locals.push(local, data);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const centralSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + 22);
  let p = 0;
  for (const part of [...locals, ...centrals, end]) { out.set(part, p); p += part.length; }
  return out;
}

/* ================= 읽기 ================= */

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** zip 안의 파일들을 이름 → 바이트로. 필요한 이름만 풀려면 want 로 거른다 */
export async function unzip(buf: Uint8Array, want?: (name: string) => boolean): Promise<Map<string, Uint8Array>> {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("엑셀 파일 형식이 아닙니다 (zip 구조를 찾지 못함).");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, Uint8Array>();
  for (let n = 0; n < count; n += 1) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const localOff = v.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (want && !want(name)) continue;
    const lNameLen = v.getUint16(localOff + 26, true);
    const lExtraLen = v.getUint16(localOff + 28, true);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + csize);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, await inflateRaw(raw));
    else throw new Error("지원하지 않는 압축 방식입니다. 엑셀에서 '다른 이름으로 저장 → Excel 통합 문서'로 다시 저장해 주세요.");
  }
  return out;
}

function unescapeXml(s: string) {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/** <si> 또는 <is> 안의 글자: 서식 조각(<r><t>)과 윗주(<rPh>)를 구분해 본문만 잇는다 */
function richText(xml: string) {
  const noPhonetic = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let s = "";
  for (const m of noPhonetic.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) s += m[1];
  return unescapeXml(s);
}

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? unescapeXml(m[1]) : undefined;
}

function colIndex(ref: string) {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export interface ReadSheet { name: string; rows: string[][] }

/** .xlsx 의 모든 시트를 글자 표로. 숫자는 엑셀이 저장한 값 그대로(날짜는 일련번호) */
export async function readXlsx(buf: Uint8Array): Promise<ReadSheet[]> {
  const files = await unzip(buf, (n) => n === "xl/workbook.xml" || n === "xl/_rels/workbook.xml.rels" || n === "xl/sharedStrings.xml" || n.startsWith("xl/worksheets/"));
  const dec = new TextDecoder();
  const text = (n: string) => (files.has(n) ? dec.decode(files.get(n)) : "");
  const wb = text("xl/workbook.xml");
  if (!wb) throw new Error("엑셀 통합 문서를 찾지 못했습니다.");
  const rels = new Map<string, string>();
  for (const m of text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id");
    const target = attr(m[0], "Target");
    if (id && target) rels.set(id, target.replace(/^\/?xl\//, "").replace(/^\//, ""));
  }
  const shared: string[] = [];
  for (const m of text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(richText(m[1]));

  const sheets: ReadSheet[] = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], "name") ?? `Sheet${sheets.length + 1}`;
    const rid = attr(m[0], "r:id");
    const target = rid ? rels.get(rid) : undefined;
    const xml = target ? text(`xl/${target}`) : "";
    const rows: string[][] = [];
    for (const rm of xml.matchAll(/<row\b([^>]*)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const rAttr = attr(rm[1] ?? "", "r");
      const rIdx = rAttr ? Number(rAttr) - 1 : rows.length;
      const row: string[] = [];
      let next = 0;
      for (const cm of (rm[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(cm[1], "r");
        const ci = ref ? colIndex(ref) : next;
        next = ci + 1;
        const t = attr(cm[1], "t");
        const inner = cm[2] ?? "";
        let val = "";
        if (t === "inlineStr") val = richText(inner.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? "");
        else {
          const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
          if (v !== undefined) {
            if (t === "s") val = shared[Number(v)] ?? "";
            else if (t === "b") val = v === "1" ? "TRUE" : "FALSE";
            else val = unescapeXml(v);
          }
        }
        row[ci] = val;
      }
      for (let i = 0; i < row.length; i += 1) if (row[i] === undefined) row[i] = "";
      rows[rIdx] = row;
    }
    for (let i = 0; i < rows.length; i += 1) if (!rows[i]) rows[i] = [];
    sheets.push({ name, rows });
  }
  return sheets;
}

/** 엑셀 날짜 일련번호 → YYYY-MM-DD (1900 체계). 날짜 범위(1955~2119)가 아니면 undefined */
export function excelSerialToDate(n: number): string | undefined {
  if (!Number.isFinite(n) || n < 20000 || n > 80000) return undefined;
  const ms = Math.round((n - 25569) * 86400000);
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/* ================= CSV / 붙여넣기 ================= */

/**
 * 파일 바이트 → 글자. 한국어 엑셀이 저장한 CSV 는 대부분 CP949(EUC-KR)라서
 * UTF-8 로 읽다 깨지면 EUC-KR 로 다시 읽는다.
 */
export function decodeText(buf: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("euc-kr").decode(buf);
  }
}

/** CSV·TSV 를 표로. 구분자는 첫 줄에서 탭 > 쉼표 > 세미콜론 순으로 알아낸다. 따옴표 안의 줄바꿈도 처리 */
export function parseDelimited(text: string): string[][] {
  const src = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstLine = src.split("\n", 1)[0] ?? "";
  const delim = firstLine.includes("\t") ? "\t" : firstLine.includes(",") ? "," : firstLine.includes(";") ? ";" : "\t";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (q) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i += 1; } else q = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** 파일 한 개를 표들로 — .xlsx 면 시트별, .csv/.txt 면 한 장 */
export async function readTableFile(file: { name: string; arrayBuffer(): Promise<ArrayBuffer> }): Promise<ReadSheet[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  if (isZip) return readXlsx(buf);
  if (/\.xls$/i.test(file.name) || (buf[0] === 0xd0 && buf[1] === 0xcf)) {
    throw new Error("예전 엑셀 형식(.xls)은 읽지 못합니다. 엑셀에서 '다른 이름으로 저장 → Excel 통합 문서(.xlsx)'로 저장해 주세요.");
  }
  return [{ name: file.name.replace(/\.[^.]+$/, ""), rows: parseDelimited(decodeText(buf)) }];
}

/** 브라우저에서 바이트를 파일로 내려받게 한다 */
export function downloadBytes(bytes: Uint8Array | string, filename: string, mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
