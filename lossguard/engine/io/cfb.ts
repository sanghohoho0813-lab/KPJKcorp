/**
 * OLE2 복합 문서(Compound File Binary) 풀기 — 예전 엑셀(.xls) · 한글(.hwp) · 워드(.doc)가 쓰는 묶음 형식.
 * 스트림 이름 → 바이트. 외부 라이브러리 없이 [MS-CFB] 구조를 직접 읽는다.
 */
export class CfbError extends Error {}

const END = 0xfffffffe, FREE = 0xffffffff;

export function isCfb(b: Uint8Array): boolean {
  return b.length >= 512 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 && b[4] === 0xa1 && b[5] === 0xb1 && b[6] === 0x1a && b[7] === 0xe1;
}

export function readCfb(buf: Uint8Array): Map<string, Uint8Array> {
  if (!isCfb(buf)) throw new CfbError("OLE2 형식이 아닙니다.");
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const secSize = 1 << v.getUint16(0x1e, true);
  const miniSize = 1 << v.getUint16(0x20, true);
  const nFat = v.getUint32(0x2c, true);
  const dirStart = v.getUint32(0x30, true);
  const miniCutoff = v.getUint32(0x38, true);
  const miniFatStart = v.getUint32(0x3c, true);
  const nMiniFat = v.getUint32(0x40, true);
  let difatSec = v.getUint32(0x44, true);
  const nDifat = v.getUint32(0x48, true);
  if (secSize !== 512 && secSize !== 4096) throw new CfbError("OLE2 섹터 크기가 잘못되었습니다.");
  const secOff = (n: number) => (n + 1) * secSize;
  const u32 = (off: number) => (off + 4 <= buf.length ? v.getUint32(off, true) : FREE);

  // FAT 섹터 목록(DIFAT)
  const fatSecs: number[] = [];
  for (let i = 0; i < 109 && fatSecs.length < nFat; i++) fatSecs.push(u32(0x4c + i * 4));
  for (let k = 0; k < nDifat && difatSec !== END && difatSec !== FREE; k++) {
    const base = secOff(difatSec);
    const per = secSize / 4 - 1;
    for (let i = 0; i < per && fatSecs.length < nFat; i++) fatSecs.push(u32(base + i * 4));
    difatSec = u32(base + per * 4);
  }
  const fat: number[] = [];
  for (const s of fatSecs) { const base = secOff(s); for (let i = 0; i < secSize / 4; i++) fat.push(u32(base + i * 4)); }

  const chain = (start: number, table: number[], limit: number): number[] => {
    const out: number[] = [];
    let s = start;
    const seen = new Set<number>();
    while (s !== END && s !== FREE && s < table.length && out.length < limit) {
      if (seen.has(s)) throw new CfbError("OLE2 연결 고리가 손상되었습니다.");
      seen.add(s); out.push(s); s = table[s];
    }
    return out;
  };
  const readChain = (start: number, size?: number): Uint8Array => {
    const secs = chain(start, fat, buf.length / secSize + 1);
    const out = new Uint8Array(secs.length * secSize);
    secs.forEach((s, i) => out.set(buf.subarray(secOff(s), Math.min(buf.length, secOff(s) + secSize)), i * secSize));
    return size === undefined ? out : out.subarray(0, Math.min(size, out.length));
  };

  // 디렉터리
  const dir = readChain(dirStart);
  const dv = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
  interface Entry { name: string; type: number; start: number; size: number }
  const entries: Entry[] = [];
  for (let off = 0; off + 128 <= dir.length; off += 128) {
    const nameLen = dv.getUint16(off + 0x40, true);
    const type = dir[off + 0x42];
    if (!type) { entries.push({ name: "", type: 0, start: 0, size: 0 }); continue; }
    let name = "";
    for (let i = 0; i + 1 < Math.min(nameLen, 64) - 1; i += 2) name += String.fromCharCode(dv.getUint16(off + i, true));
    entries.push({ name, type, start: dv.getUint32(off + 0x74, true), size: dv.getUint32(off + 0x78, true) });
  }
  const root = entries.find((e) => e.type === 5);
  // 작은 스트림(mini stream)
  let miniStream: Uint8Array = new Uint8Array(0);
  let miniFat: number[] = [];
  if (root && nMiniFat > 0) {
    miniStream = readChain(root.start, root.size);
    const mf = readChain(miniFatStart);
    const mv = new DataView(mf.buffer, mf.byteOffset, mf.byteLength);
    miniFat = Array.from({ length: mf.length / 4 }, (_, i) => mv.getUint32(i * 4, true));
  }
  const out = new Map<string, Uint8Array>();
  for (const e of entries) {
    if (e.type !== 2) continue;
    if (e.size < miniCutoff && root) {
      const secs = chain(e.start, miniFat, miniStream.length / miniSize + 1);
      const data = new Uint8Array(secs.length * miniSize);
      secs.forEach((s, i) => data.set(miniStream.subarray(s * miniSize, s * miniSize + miniSize), i * miniSize));
      out.set(e.name, data.subarray(0, e.size));
    } else out.set(e.name, readChain(e.start, e.size));
  }
  return out;
}
