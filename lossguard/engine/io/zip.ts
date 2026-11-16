/**
 * zip 풀기 — 엑셀(.xlsx)은 zip 안의 XML 묶음이다.
 * 압축 해제는 브라우저 · Node(18+) 공통의 DecompressionStream 을 쓴다(외부 라이브러리 없음).
 */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export class ZipError extends Error {}

export async function unzipEntries(buf: Uint8Array, want?: (name: string) => boolean): Promise<Map<string, Uint8Array>> {
  if (buf.length < 22) throw new ZipError("파일이 너무 작습니다(엑셀 파일이 아닙니다).");
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new ZipError("zip 구조를 찾지 못했습니다(.xlsx 가 아닙니다).");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, Uint8Array>();
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || v.getUint32(p, true) !== 0x02014b50) throw new ZipError("zip 목록이 손상되었습니다.");
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const localOff = v.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (want && !want(name)) continue;
    if (localOff + 30 > buf.length || v.getUint32(localOff, true) !== 0x04034b50) throw new ZipError(`zip 항목이 손상되었습니다: ${name}`);
    const start = localOff + 30 + v.getUint16(localOff + 26, true) + v.getUint16(localOff + 28, true);
    const raw = buf.subarray(start, start + csize);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, await inflateRaw(raw));
    else throw new ZipError("지원하지 않는 압축 방식입니다. 엑셀에서 'Excel 통합 문서(.xlsx)'로 다시 저장해 주세요.");
  }
  return out;
}
