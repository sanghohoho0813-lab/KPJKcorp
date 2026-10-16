/**
 * 예전 엑셀(.xls)과 "엑셀처럼 보이는" 다른 형식을 표로 읽는다 — 외부 라이브러리 없이.
 *
 * 왜 필요한가
 * - 국내 기관·은행·4대보험 EDI·옛 ERP에서 내려받는 명단은 아직 .xls 가 많다. "xlsx 로 다시 저장해 오세요"는 도입 첫날의 포기 사유다.
 * - .xls 라는 이름이지만 속은 HTML 표이거나 Excel 2003 XML 인 파일도 흔하다(웹에서 내려받은 엑셀).
 *
 * 다루는 범위: 글자·숫자·수식의 저장된 결과값·참/거짓. 서식·병합·그림은 버린다. 날짜는 .xlsx 와 같이 일련번호 숫자로 둔다.
 * 암호가 걸린 파일, 엑셀 95 이전 형식은 읽지 못한다고 분명히 알린다.
 */
import type { ReadSheet } from "./xlsx";

/* ================= 복합 문서(CFB) — .xls·.doc·.hwp 가 쓰는 "파일 안의 파일" ================= */

const END_OF_CHAIN = 0xfffffffe;
const FREE_SECT = 0xffffffff;

export function isCfb(buf: Uint8Array) {
  return buf.length >= 512 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0 && buf[4] === 0xa1 && buf[5] === 0xb1 && buf[6] === 0x1a && buf[7] === 0xe1;
}

/** 복합 문서 안의 스트림(이름 → 바이트). 폴더 구조는 무시하고 이름으로만 찾는다 */
export function readCfb(buf: Uint8Array): Map<string, Uint8Array> {
  if (!isCfb(buf)) throw new Error("복합 문서 형식이 아닙니다.");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u16 = (o: number) => dv.getUint16(o, true);
  const u32 = (o: number) => dv.getUint32(o, true);
  const sectorShift = u16(0x1e);
  const miniShift = u16(0x20);
  if (sectorShift !== 9 && sectorShift !== 12) throw new Error("파일이 손상되었거나 지원하지 않는 형식입니다.");
  const sectorSize = 1 << sectorShift;
  const nFat = u32(0x2c);
  const firstDir = u32(0x30);
  const miniCutoff = u32(0x38) || 4096;
  const firstMiniFat = u32(0x3c);
  const nMiniFat = u32(0x40);
  let difatSect = u32(0x44);
  const nDifat = u32(0x48);
  const maxSect = Math.floor((buf.length - sectorSize) / sectorSize) + 1;
  const off = (s: number) => (s + 1) * sectorSize;

  // FAT 이 있는 구역 번호들: 머리에 109개 + DIFAT 구역 사슬
  const fatSects: number[] = [];
  for (let i = 0; i < 109 && fatSects.length < nFat; i += 1) {
    const s = u32(0x4c + i * 4);
    if (s !== FREE_SECT && s !== END_OF_CHAIN) fatSects.push(s);
  }
  for (let n = 0; n < nDifat && difatSect !== END_OF_CHAIN && difatSect !== FREE_SECT && difatSect < maxSect; n += 1) {
    const base = off(difatSect);
    const per = sectorSize / 4 - 1;
    for (let i = 0; i < per && fatSects.length < nFat; i += 1) {
      const s = u32(base + i * 4);
      if (s !== FREE_SECT && s !== END_OF_CHAIN) fatSects.push(s);
    }
    difatSect = u32(base + per * 4);
  }
  const fat: number[] = [];
  for (const s of fatSects) {
    if (s >= maxSect) continue;
    const base = off(s);
    for (let i = 0; i < sectorSize / 4; i += 1) fat.push(u32(base + i * 4));
  }

  const chain = (start: number, table: number[], limit: number) => {
    const out: number[] = [];
    const seen = new Set<number>();
    for (let s = start; s !== END_OF_CHAIN && s !== FREE_SECT && s < limit && !seen.has(s) && out.length < table.length + 1; s = table[s] ?? END_OF_CHAIN) {
      seen.add(s);
      out.push(s);
    }
    return out;
  };
  const readChain = (start: number, size?: number) => {
    const sects = chain(start, fat, maxSect);
    const out = new Uint8Array(sects.length * sectorSize);
    sects.forEach((s, i) => out.set(buf.subarray(off(s), Math.min(buf.length, off(s) + sectorSize)), i * sectorSize));
    return size === undefined ? out : out.subarray(0, Math.min(size, out.length));
  };

  // 디렉터리 — 항목 하나 128바이트
  const dir = readChain(firstDir);
  const ddv = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
  interface Entry { name: string; type: number; start: number; size: number }
  const entries: Entry[] = [];
  for (let o = 0; o + 128 <= dir.length; o += 128) {
    const nameLen = ddv.getUint16(o + 0x40, true);
    const type = dir[o + 0x42];
    if (type === 0) { entries.push({ name: "", type, start: 0, size: 0 }); continue; }
    let name = "";
    for (let i = 0; i + 2 < Math.min(nameLen, 64); i += 2) name += String.fromCharCode(ddv.getUint16(o + i, true));
    entries.push({ name, type, start: ddv.getUint32(o + 0x74, true), size: ddv.getUint32(o + 0x78, true) });
  }
  const root = entries[0];
  // 작은 스트림(4KB 미만)은 "미니 스트림" 안에 64바이트 단위로 들어 있다
  let mini: Uint8Array | null = null;
  let miniFat: number[] = [];
  const miniSize = 1 << miniShift;
  const loadMini = () => {
    if (mini) return;
    mini = root ? readChain(root.start, root.size) : new Uint8Array(0);
    const mf = nMiniFat && firstMiniFat !== END_OF_CHAIN ? readChain(firstMiniFat) : new Uint8Array(0);
    const mdv = new DataView(mf.buffer, mf.byteOffset, mf.byteLength);
    miniFat = [];
    for (let i = 0; i + 4 <= mf.length; i += 4) miniFat.push(mdv.getUint32(i, true));
  };
  const out = new Map<string, Uint8Array>();
  for (const e of entries) {
    if (e.type !== 2 || !e.name || out.has(e.name)) continue;
    if (e.size < miniCutoff) {
      loadMini();
      const m = mini as unknown as Uint8Array;
      const sects = chain(e.start, miniFat, Math.ceil(m.length / miniSize));
      const data = new Uint8Array(sects.length * miniSize);
      sects.forEach((s, i) => data.set(m.subarray(s * miniSize, s * miniSize + miniSize), i * miniSize));
      out.set(e.name, data.subarray(0, Math.min(e.size, data.length)));
    } else out.set(e.name, readChain(e.start, e.size));
  }
  return out;
}

/* ================= BIFF8 (.xls 97~2003) ================= */

const R = {
  BOF: 0x0809, EOF: 0x000a, FILEPASS: 0x002f, BOUNDSHEET: 0x0085, SST: 0x00fc, CONTINUE: 0x003c, DATEMODE: 0x0022,
  LABELSST: 0x00fd, NUMBER: 0x0203, RK: 0x027e, MULRK: 0x00bd, LABEL: 0x0204, FORMULA: 0x0006, STRING: 0x0207, BOOLERR: 0x0205,
};

interface Rec { type: number; data: Uint8Array; pos: number }

function records(stream: Uint8Array, from = 0): Rec[] {
  const out: Rec[] = [];
  const dv = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  let p = from;
  while (p + 4 <= stream.length) {
    const type = dv.getUint16(p, true);
    const len = dv.getUint16(p + 2, true);
    out.push({ type, data: stream.subarray(p + 4, Math.min(stream.length, p + 4 + len)), pos: p });
    p += 4 + len;
    if (type === R.EOF && from > 0) break; // 시트 하나만 읽을 때는 그 시트의 끝에서 멈춘다
  }
  return out;
}

/** 여러 레코드(SST + CONTINUE)에 걸친 글자 읽기 — 글자가 레코드 경계를 넘으면 새 레코드 첫 바이트가 1바이트/2바이트 글자 여부를 다시 알려 준다 */
class SegReader {
  private seg = 0;
  private pos = 0;
  constructor(private segs: Uint8Array[]) {}
  private ensure() {
    while (this.seg < this.segs.length && this.pos >= this.segs[this.seg].length) { this.seg += 1; this.pos = 0; }
    return this.seg < this.segs.length;
  }
  get done() { return !this.ensure(); }
  u8() { if (!this.ensure()) throw new Error("eof"); return this.segs[this.seg][this.pos++]; }
  u16() { const a = this.u8(); return a | (this.u8() << 8); }
  u32() { const a = this.u16(); return (a | (this.u16() << 16)) >>> 0; }
  skip(n: number) { for (let i = 0; i < n; i += 1) this.u8(); }
  /** cch 글자. 레코드 경계를 넘을 때마다 플래그 바이트를 새로 읽는다 */
  chars(cch: number, high: boolean) {
    let s = "";
    let wide = high;
    for (let i = 0; i < cch; i += 1) {
      if (this.pos >= (this.segs[this.seg]?.length ?? 0)) {
        this.seg += 1; this.pos = 0;
        if (this.seg >= this.segs.length) break;
        wide = (this.segs[this.seg][this.pos++] & 1) === 1;
      }
      s += String.fromCharCode(wide ? this.u16() : this.u8());
    }
    return s;
  }
}

function unicodeString(r: SegReader): string {
  const cch = r.u16();
  const flags = r.u8();
  const runs = flags & 0x08 ? r.u16() : 0;
  const ext = flags & 0x04 ? r.u32() : 0;
  const s = r.chars(cch, (flags & 1) === 1);
  r.skip(runs * 4 + ext);
  return s;
}

function rkValue(rk: number) {
  let v: number;
  if (rk & 0x02) v = (rk | 0) >> 2;
  else {
    const b = new DataView(new ArrayBuffer(8));
    b.setUint32(0, 0, true);
    b.setUint32(4, rk & 0xfffffffc, true);
    v = b.getFloat64(0, true);
  }
  return rk & 0x01 ? v / 100 : v;
}

/** 숫자 → 글자. 정수는 그대로, 소수는 엑셀이 보이는 15자리까지만 (0.1+0.2 같은 꼬리 제거) */
function numText(n: number) {
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(15)));
}

export function readXls(buf: Uint8Array): ReadSheet[] {
  const streams = readCfb(buf);
  const wb = streams.get("Workbook") ?? streams.get("Book");
  if (!wb) {
    if (streams.has("EncryptedPackage")) throw new Error("암호가 걸린 엑셀 파일입니다. 엑셀에서 암호를 풀고 저장한 뒤 올려 주세요.");
    throw new Error("엑셀 파일이 아니거나 손상되었습니다.");
  }
  const glob = records(wb);
  const bof = glob[0];
  if (!bof || bof.type !== R.BOF) {
    // BIFF5(엑셀 95)·BIFF4 이하는 BOF 번호가 다르다
    throw new Error("너무 오래된 엑셀 형식입니다(엑셀 95 이전). 엑셀에서 '다른 이름으로 저장 → Excel 통합 문서(.xlsx)'로 저장해 주세요.");
  }
  const vers = new DataView(bof.data.buffer, bof.data.byteOffset, bof.data.byteLength).getUint16(0, true);
  if (vers !== 0x0600) throw new Error("너무 오래된 엑셀 형식입니다(엑셀 95 이전). 엑셀에서 '다른 이름으로 저장 → Excel 통합 문서(.xlsx)'로 저장해 주세요.");

  const sheets: { name: string; pos: number }[] = [];
  const sst: string[] = [];
  for (let i = 0; i < glob.length; i += 1) {
    const rec = glob[i];
    if (rec.type === R.EOF) break;
    const dv = new DataView(rec.data.buffer, rec.data.byteOffset, rec.data.byteLength);
    if (rec.type === R.FILEPASS) throw new Error("암호가 걸린 엑셀 파일입니다. 엑셀에서 암호를 풀고 저장한 뒤 올려 주세요.");
    if (rec.type === R.BOUNDSHEET && rec.data.length >= 8) {
      const pos = dv.getUint32(0, true);
      const dt = rec.data[5];
      const cch = rec.data[6];
      const high = (rec.data[7] & 1) === 1;
      let name = "";
      for (let k = 0; k < cch; k += 1) name += String.fromCharCode(high ? dv.getUint16(8 + k * 2, true) : rec.data[8 + k]);
      if (dt === 0) sheets.push({ name: name || `Sheet${sheets.length + 1}`, pos });
    }
    if (rec.type === R.SST) {
      const segs = [rec.data.subarray(8)];
      const unique = dv.getUint32(4, true);
      while (glob[i + 1]?.type === R.CONTINUE) segs.push(glob[++i].data);
      const r = new SegReader(segs);
      try { for (let k = 0; k < unique && !r.done; k += 1) sst.push(unicodeString(r)); } catch { /* 끝이 잘린 표 — 읽은 데까지 */ }
    }
  }

  const out: ReadSheet[] = [];
  for (const sh of sheets) {
    const rows: string[][] = [];
    const put = (rw: number, col: number, v: string) => {
      if (rw > 100000 || col > 1000) return;
      const row = (rows[rw] ??= []);
      row[col] = v;
    };
    const recs = records(wb, sh.pos);
    let pendingFormula: [number, number] | null = null;
    for (let i = 0; i < recs.length; i += 1) {
      const { type, data } = recs[i];
      if (type === R.EOF) break;
      if (data.length < 6 && type !== R.STRING) continue;
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const rw = data.length >= 4 ? dv.getUint16(0, true) : 0;
      const col = data.length >= 4 ? dv.getUint16(2, true) : 0;
      switch (type) {
        case R.LABELSST: if (data.length >= 10) put(rw, col, sst[dv.getUint32(6, true)] ?? ""); break;
        case R.NUMBER: if (data.length >= 14) put(rw, col, numText(dv.getFloat64(6, true))); break;
        case R.RK: if (data.length >= 10) put(rw, col, numText(rkValue(dv.getUint32(6, true)))); break;
        case R.MULRK: {
          const n = Math.floor((data.length - 6) / 6);
          for (let k = 0; k < n; k += 1) put(rw, col + k, numText(rkValue(dv.getUint32(4 + k * 6 + 2, true))));
          break;
        }
        case R.LABEL: {
          const r = new SegReader([data.subarray(6)]);
          try { put(rw, col, unicodeString(r)); } catch { /* 잘린 글자 */ }
          break;
        }
        case R.BOOLERR: if (data.length >= 8 && data[7] === 0) put(rw, col, data[6] ? "TRUE" : "FALSE"); break;
        case R.FORMULA: {
          if (data.length < 14) break;
          // 결과가 숫자면 8바이트 실수, 아니면 [종류, ?, 값, ..., 0xFFFF]
          if (dv.getUint16(12, true) === 0xffff) {
            const kind = data[6];
            if (kind === 0) pendingFormula = [rw, col]; // 글자 결과는 바로 다음 STRING 레코드에
            else if (kind === 1) put(rw, col, data[8] ? "TRUE" : "FALSE");
          } else put(rw, col, numText(dv.getFloat64(6, true)));
          break;
        }
        case R.STRING: {
          if (!pendingFormula) break;
          const segs = [data];
          while (recs[i + 1]?.type === R.CONTINUE) segs.push(recs[++i].data);
          try { put(pendingFormula[0], pendingFormula[1], unicodeString(new SegReader(segs))); } catch { /* 잘린 글자 */ }
          pendingFormula = null;
          break;
        }
      }
    }
    for (let r = 0; r < rows.length; r += 1) {
      const row = (rows[r] ??= []);
      for (let c = 0; c < row.length; c += 1) if (row[c] === undefined) row[c] = "";
    }
    out.push({ name: sh.name, rows });
  }
  if (!out.length) throw new Error("엑셀 파일에서 시트를 찾지 못했습니다.");
  return out;
}

/* ================= HTML 표 (웹에서 내려받은 "엑셀") ================= */

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };
function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}
function cellText(html: string) {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""))
    .split("\n").map((l) => l.replace(/[ \t ]+/g, " ").trim()).filter(Boolean).join("\n");
}

export function looksLikeHtmlTable(text: string) {
  return /<table[\s>]/i.test(text.slice(0, 200000));
}

/** <table> 마다 시트 한 장. colspan 은 빈 칸으로 채워 열 위치를 맞춘다 */
export function readHtmlTables(text: string): ReadSheet[] {
  const src = text.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
  const out: ReadSheet[] = [];
  for (const tm of src.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const rows: string[][] = [];
    for (const rm of tm[1].matchAll(/<tr\b[^>]*>([\s\S]*?)(?=<tr\b|<\/tr>|$)/gi)) {
      const row: string[] = [];
      for (const cm of rm[1].matchAll(/<t([dh])\b([^>]*)>([\s\S]*?)(?=<t[dh]\b|<\/t[dh]>|$)/gi)) {
        row.push(cellText(cm[3]));
        const span = Number(cm[2].match(/colspan\s*=\s*["']?(\d+)/i)?.[1] ?? 1);
        for (let k = 1; k < Math.min(span, 50); k += 1) row.push("");
      }
      if (row.length) rows.push(row);
    }
    if (rows.length) out.push({ name: `표 ${out.length + 1}`, rows });
  }
  return out;
}

/* ================= Excel 2003 XML (SpreadsheetML) ================= */

export function looksLikeSpreadsheetMl(text: string) {
  const head = text.slice(0, 4000);
  return /urn:schemas-microsoft-com:office:spreadsheet/.test(head) && /<(ss:)?Workbook\b/.test(text.slice(0, 20000));
}

export function readSpreadsheetMl(text: string): ReadSheet[] {
  const attr = (s: string, n: string) => s.match(new RegExp(`(?:ss:)?${n}\\s*=\\s*"([^"]*)"`))?.[1];
  const out: ReadSheet[] = [];
  for (const wm of text.matchAll(/<(?:ss:)?Worksheet\b([^>]*)>([\s\S]*?)<\/(?:ss:)?Worksheet>/g)) {
    const rows: string[][] = [];
    let r = 0;
    for (const rm of wm[2].matchAll(/<(?:ss:)?Row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:ss:)?Row>)/g)) {
      const ri = Number(attr(rm[1], "Index") ?? 0);
      if (ri > 0) r = ri - 1;
      const row: string[] = [];
      let c = 0;
      for (const cm of (rm[2] ?? "").matchAll(/<(?:ss:)?Cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:ss:)?Cell>)/g)) {
        const ci = Number(attr(cm[1], "Index") ?? 0);
        if (ci > 0) c = ci - 1;
        const dm = cm[2]?.match(/<(?:ss:)?Data\b([^>]*)>([\s\S]*?)<\/(?:ss:)?Data>/);
        row[c] = !dm ? "" : attr(dm[1], "Type") === "Boolean" ? (dm[2].trim() === "1" ? "TRUE" : "FALSE") : cellText(dm[2]);
        c += 1 + Number(attr(cm[1], "MergeAcross") ?? 0);
      }
      for (let k = 0; k < row.length; k += 1) if (row[k] === undefined) row[k] = "";
      rows[r] = row;
      r += 1;
    }
    for (let k = 0; k < rows.length; k += 1) if (!rows[k]) rows[k] = [];
    out.push({ name: decodeEntities(attr(wm[1], "Name") ?? `Sheet${out.length + 1}`), rows });
  }
  return out;
}
