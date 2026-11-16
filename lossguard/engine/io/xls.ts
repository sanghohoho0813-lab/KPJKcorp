import type { Merge, RawCell, RawSheet, RawWorkbook } from "../types";
import { readCfb } from "./cfb";

/**
 * 예전 엑셀(.xls, BIFF8) → RawWorkbook. 셀 값 · 공유 문자열(CONTINUE 경계 포함) · 병합 · 숨긴 행/열/시트 · 수식의 저장값.
 * Excel 97~2003 형식(BIFF8)만 읽는다. 그보다 오래된 BIFF5 이하는 엑셀에서 다시 저장해 달라고 안내한다.
 */
export class XlsError extends Error {}

const EMPTY: RawCell = { v: "", t: "empty" };

interface Rec { type: number; data: Uint8Array; pos: number }

function records(stream: Uint8Array): Rec[] {
  const out: Rec[] = [];
  const v = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  let p = 0;
  while (p + 4 <= stream.length) {
    const type = v.getUint16(p, true), len = v.getUint16(p + 2, true);
    out.push({ type, data: stream.subarray(p + 4, p + 4 + len), pos: p });
    p += 4 + len;
  }
  return out;
}

function rk(x: number): number {
  let n: number;
  if (x & 2) n = x >> 2;
  else {
    const b = new DataView(new ArrayBuffer(8));
    b.setUint32(4, x & 0xfffffffc, true);
    b.setUint32(0, 0, true);
    n = b.getFloat64(0, true);
  }
  return x & 1 ? n / 100 : n;
}

const latin1 = (d: Uint8Array, off: number, n: number) => { let s = ""; for (let i = 0; i < n; i++) s += String.fromCharCode(d[off + i]); return s; };
const utf16 = (d: Uint8Array, off: number, n: number) => { let s = ""; for (let i = 0; i < n; i++) s += String.fromCharCode(d[off + 2 * i] | (d[off + 2 * i + 1] << 8)); return s; };

/** 여러 레코드(SST + CONTINUE)에 걸친 글자 읽기 — 경계마다 새 압축 여부 바이트가 붙는다 */
class Cursor {
  i = 0; off = 0;
  constructor(public parts: Uint8Array[]) {}
  get cur() { return this.parts[this.i]; }
  ensure() { while (this.i < this.parts.length && this.off >= this.cur.length) { this.i++; this.off = 0; } }
  u8() { this.ensure(); return this.cur[this.off++]; }
  u16() { const a = this.u8(), b = this.u8(); return a | (b << 8); }
  u32() { const a = this.u16(), b = this.u16(); return (a | (b << 16)) >>> 0; }
  skip(n: number) { while (n > 0) { this.ensure(); if (this.i >= this.parts.length) return; const k = Math.min(n, this.cur.length - this.off); this.off += k; n -= k; } }
  chars(cch: number, high: boolean): string {
    let s = "";
    while (cch > 0) {
      if (this.off >= (this.cur?.length ?? 0)) {
        this.i++; this.off = 0;
        if (this.i >= this.parts.length) break;
        high = (this.cur[this.off++] & 1) === 1; // CONTINUE 첫 바이트: 압축 여부
      }
      const avail = this.cur.length - this.off;
      const take = Math.min(cch, high ? Math.floor(avail / 2) : avail);
      s += high ? utf16(this.cur, this.off, take) : latin1(this.cur, this.off, take);
      this.off += high ? take * 2 : take;
      cch -= take;
    }
    return s;
  }
}

function parseSst(parts: Uint8Array[]): string[] {
  const c = new Cursor(parts);
  c.u32();
  const unique = c.u32();
  const out: string[] = [];
  for (let k = 0; k < unique && c.i < parts.length; k++) {
    const cch = c.u16();
    const flags = c.u8();
    const high = (flags & 1) === 1, ext = (flags & 4) === 4, rich = (flags & 8) === 8;
    const runs = rich ? c.u16() : 0;
    const extLen = ext ? c.u32() : 0;
    out.push(c.chars(cch, high));
    if (runs) c.skip(runs * 4);
    if (extLen) c.skip(extLen);
  }
  return out;
}

function shortStr(d: Uint8Array, off: number): string {
  const cch = d[off], high = (d[off + 1] & 1) === 1;
  return high ? utf16(d, off + 2, cch) : latin1(d, off + 2, cch);
}
function xlStr(d: Uint8Array, off: number): string {
  const cch = d[off] | (d[off + 1] << 8), high = (d[off + 2] & 1) === 1;
  return high ? utf16(d, off + 3, cch) : latin1(d, off + 3, cch);
}

export function readXls(bytes: Uint8Array, fileName = ""): RawWorkbook {
  const files = readCfb(bytes);
  const stream = files.get("Workbook") ?? files.get("Book");
  if (!stream) throw new XlsError("엑셀 통합 문서가 아닙니다(Workbook 스트림 없음).");
  const recs = records(stream);
  const bof = recs[0];
  if (!bof || bof.type !== 0x0809 || (bof.data[0] | (bof.data[1] << 8)) !== 0x0600) throw new XlsError("Excel 97~2003(BIFF8)이 아닌 예전 형식입니다. 엑셀에서 .xlsx 로 다시 저장해 주세요.");
  // 전체 영역: 시트 목록 · 공유 문자열
  const sheetsMeta: { name: string; pos: number; hidden: boolean }[] = [];
  let sst: string[] = [];
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i];
    if (r.type === 0x000a) break;
    if (r.type === 0x002f) throw new XlsError("암호가 걸린 파일입니다. 엑셀에서 암호를 푼 뒤 다시 저장해 주세요(암호는 받지 않습니다)."); // FILEPASS
    const dv = new DataView(r.data.buffer, r.data.byteOffset, r.data.byteLength);
    if (r.type === 0x0085 && r.data.length >= 8) {
      if (r.data[5] !== 0) continue; // 차트 · 매크로 시트 제외
      sheetsMeta.push({ pos: dv.getUint32(0, true), hidden: r.data[4] !== 0, name: shortStr(r.data, 6) });
    } else if (r.type === 0x00fc) {
      const parts = [r.data];
      while (recs[i + 1] && recs[i + 1].type === 0x003c) parts.push(recs[++i].data);
      sst = parseSst(parts);
    }
  }
  const byPos = new Map(recs.map((r, i) => [r.pos, i]));
  const sheets: RawSheet[] = [];
  for (const meta of sheetsMeta) {
    const start = byPos.get(meta.pos);
    if (start === undefined) continue;
    const rows: RawCell[][] = [];
    const merges: Merge[] = [];
    const hiddenRows: number[] = [];
    const hiddenCols: number[] = [];
    const set = (r: number, c: number, cell: RawCell) => {
      if (cell.t === "empty" || r > 1048575 || c > 16383) return;
      const row = rows[r] ?? (rows[r] = []);
      while (row.length < c) row.push(EMPTY);
      row[c] = cell;
    };
    const num = (n: number, f = false): RawCell => ({ v: String(n), t: "num", n, ...(f ? { f: true } : {}) });
    let pendingFormula: [number, number] | null = null;
    for (let i = start + 1; i < recs.length; i++) {
      const r = recs[i];
      if (r.type === 0x000a) break;
      const d = r.data;
      if (d.length < 2 && r.type !== 0x0207) continue;
      const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
      switch (r.type) {
        case 0x00fd: { if (d.length < 10) break; const s = sst[dv.getUint32(6, true)] ?? ""; if (s) set(dv.getUint16(0, true), dv.getUint16(2, true), { v: s, t: "text" }); break; }
        case 0x0203: if (d.length >= 14) set(dv.getUint16(0, true), dv.getUint16(2, true), num(dv.getFloat64(6, true))); break;
        case 0x027e: if (d.length >= 10) set(dv.getUint16(0, true), dv.getUint16(2, true), num(rk(dv.getUint32(6, true)))); break;
        case 0x00bd: {
          const row = dv.getUint16(0, true), c0 = dv.getUint16(2, true);
          const n = (d.length - 6) / 6;
          for (let k = 0; k < n; k++) set(row, c0 + k, num(rk(dv.getUint32(4 + k * 6 + 2, true))));
          break;
        }
        case 0x0204: if (d.length >= 9) { const s = xlStr(d, 6); if (s) set(dv.getUint16(0, true), dv.getUint16(2, true), { v: s, t: "text" }); } break;
        case 0x0205: if (d.length >= 8) set(dv.getUint16(0, true), dv.getUint16(2, true), { v: d[7] ? "#ERR" : d[6] ? "TRUE" : "FALSE", t: "text" }); break;
        case 0x0006: {
          if (d.length < 14) break;
          const row = dv.getUint16(0, true), col = dv.getUint16(2, true);
          if (dv.getUint16(12, true) === 0xffff) {
            const kind = d[6];
            if (kind === 0) pendingFormula = [row, col];
            else if (kind === 1) set(row, col, { v: d[8] ? "TRUE" : "FALSE", t: "text", f: true });
          } else set(row, col, num(dv.getFloat64(6, true), true));
          break;
        }
        case 0x0207: {
          if (pendingFormula && d.length >= 3) { const s = xlStr(d, 0); if (s) set(pendingFormula[0], pendingFormula[1], { v: s, t: "text", f: true }); }
          pendingFormula = null;
          break;
        }
        case 0x00e5: {
          const n = dv.getUint16(0, true);
          for (let k = 0; k < n && 2 + k * 8 + 8 <= d.length; k++) {
            const o = 2 + k * 8;
            merges.push({ r1: dv.getUint16(o, true), r2: dv.getUint16(o + 2, true), c1: dv.getUint16(o + 4, true), c2: dv.getUint16(o + 6, true) });
          }
          break;
        }
        case 0x0208: if (d.length >= 14 && (dv.getUint16(12, true) & 0x20)) hiddenRows.push(dv.getUint16(0, true)); break;
        case 0x007d: if (d.length >= 10 && (dv.getUint16(8, true) & 1)) for (let c = dv.getUint16(0, true); c <= dv.getUint16(2, true) && c < 16384; c++) hiddenCols.push(c); break;
      }
    }
    for (let k = 0; k < rows.length; k++) if (!rows[k]) rows[k] = [];
    sheets.push({ name: meta.name, hidden: meta.hidden, rows, merges, hiddenRows, hiddenCols });
  }
  return { fileName, sheets };
}
