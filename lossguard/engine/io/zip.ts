/**
 * zip 풀기 — 엑셀(.xlsx)은 zip 안의 XML 묶음이다.
 * 압축 해제는 브라우저 · Node(18+) 공통의 DecompressionStream 을 쓴다(외부 라이브러리 없음).
 */
export class ZipError extends Error {}

/**
 * 압축 폭탄(작은 파일이 풀면 수 GB) 방어 — 푸는 동안 크기를 세다가 한도를 넘으면 멈춘다.
 * 한도는 실제 내역서보다 넉넉하게(30MB 파일의 일반적인 압축률 기준) 잡았다. 시험에서만 바꾼다.
 */
export const ZIP_LIMITS = { totalBytes: 400 * 1024 * 1024 };

async function inflateRaw(data: Uint8Array, budget: { left: number }): Promise<Uint8Array> {
  const reader = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    budget.left -= value.length;
    if (budget.left < 0) { await reader.cancel().catch(() => {}); throw new ZipError("압축을 풀면 너무 커지는 파일입니다(압축 폭탄 의심). 엑셀에서 다시 저장하거나 파일을 나눠 주세요."); }
    chunks.push(value);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

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
  const budget = { left: ZIP_LIMITS.totalBytes };
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
    else if (method === 8) out.set(name, await inflateRaw(raw, budget));
    else throw new ZipError("지원하지 않는 압축 방식입니다. 엑셀에서 'Excel 통합 문서(.xlsx)'로 다시 저장해 주세요.");
  }
  return out;
}
