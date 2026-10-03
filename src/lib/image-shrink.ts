/**
 * 휴대폰 사진을 서류가 또렷하게 읽히는 크기로 줄여서 올린다.
 * 요즘 휴대폰 사진은 한 장 5~12MB — 느린 회선에서 오래 걸리고 중간에 끊기기 쉽다.
 * 긴 변 2400px(A4 기준 약 200dpi) · JPEG 85% 면 글자는 그대로 읽히고 용량은 1MB 안팎이 된다.
 *
 * 줄이지 않는 것: PDF·엑셀 등 문서 파일, PNG(화면 캡처는 글자가 번질 수 있다), 이미 작은 사진.
 * 줄인 결과가 더 크거나, 브라우저가 이 사진을 읽지 못하면(예: 일부 HEIC) 원본을 그대로 올린다.
 */
export const SHRINK_FROM_BYTES = 1.5 * 1024 * 1024;
const MAX_EDGE = 2400;
const QUALITY = 0.85;
const SHRINKABLE = /^image\/(jpeg|jpg|webp|heic|heif)$/i;

export interface ShrinkResult {
  file: File;
  /** 줄였으면 원래 크기 */
  from?: number;
}

export async function shrinkPhoto(file: File): Promise<ShrinkResult> {
  const type = file.type || (/\.(jpe?g)$/i.test(file.name) ? "image/jpeg" : /\.heic$/i.test(file.name) ? "image/heic" : "");
  if (!SHRINKABLE.test(type) || file.size <= SHRINK_FROM_BYTES) return { file };
  try {
    // 휴대폰 사진의 회전 정보(세로로 찍음)를 반영해서 읽는다
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { file };
    ctx.fillStyle = "#fff"; // 투명 부분이 검게 나오지 않게
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return { file };
    const name = file.name.replace(/\.(jpe?g|webp|heic|heif)$/i, "") + ".jpg";
    return { file: new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified }), from: file.size };
  } catch {
    return { file };
  }
}
