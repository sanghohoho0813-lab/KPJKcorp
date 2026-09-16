"use client";

import { explain, supa } from "./client";

/**
 * 실제 파일 보관.
 *
 * 지금까지는 파일명과 용량만 저장했다. 자료요청이 이 시스템의 핵심 기능인데
 * 정작 파일이 오가지 않았다 — 그래서 실사용이 불가능했다.
 *
 * 경로 첫 칸은 반드시 기업 ID 다. 권한 판단이 그 한 칸에서 나온다(supabase/setup.sql 3부).
 * 파일명은 한글·공백이 섞이므로 경로에는 안전한 이름만 쓰고, 원래 이름은 DB 에 따로 둔다.
 */

export const DOC_BUCKET = "documents";
export const RESULT_BUCKET = "results";
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** 경로에 쓸 수 있는 이름으로. 원본 이름은 document_files.file_name 이 갖는다. */
function safeName(name: string) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  return ext ? `file.${ext}` : "file";
}

export interface UploadResult { ok: boolean; path?: string; reason?: string }

async function put(bucket: string, path: string, file: File): Promise<UploadResult> {
  const sb = supa();
  if (!sb) return { ok: false, reason: "서버가 설정되지 않았습니다." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: "50MB 를 넘는 파일은 올릴 수 없습니다." };
  if (file.size === 0) return { ok: false, reason: "빈 파일입니다." };
  const { error } = await sb.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) return { ok: false, reason: explain(error as { message?: string }) };
  return { ok: true, path };
}

/** 고객이 제출하는 자료 */
export function uploadDocument(companyId: string, requestId: string, fileId: string, file: File) {
  return put(DOC_BUCKET, `${companyId}/${requestId}/${fileId}__${safeName(file.name)}`, file);
}

/** 담당자가 고객에게 전달하는 결과물 */
export function uploadResult(companyId: string, resultId: string, file: File) {
  return put(RESULT_BUCKET, `${companyId}/${resultId}__${safeName(file.name)}`, file);
}

/**
 * 내려받기 링크. 60초만 살아 있는 임시 주소다 —
 * 링크가 새어 나가도 오래 쓸 수 없고, 애초에 권한 없는 사람은 발급 자체가 안 된다.
 */
export async function downloadUrl(bucket: string, path: string, fileName?: string): Promise<{ ok: boolean; url?: string; reason?: string }> {
  const sb = supa();
  if (!sb) return { ok: false, reason: "서버가 설정되지 않았습니다." };
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 60, {
    download: fileName ?? true,
  });
  if (error || !data) return { ok: false, reason: explain(error as { message?: string }) };
  return { ok: true, url: data.signedUrl };
}

export async function removeObject(bucket: string, path: string): Promise<{ ok: boolean; reason?: string }> {
  const sb = supa();
  if (!sb) return { ok: false, reason: "서버가 설정되지 않았습니다." };
  const { error } = await sb.storage.from(bucket).remove([path]);
  return error ? { ok: false, reason: explain(error as { message?: string }) } : { ok: true };
}

/** 브라우저에서 파일 내려받기 실행 */
export async function saveToDisk(bucket: string, path: string, fileName: string): Promise<{ ok: boolean; reason?: string }> {
  const r = await downloadUrl(bucket, path, fileName);
  if (!r.ok || !r.url) return { ok: false, reason: r.reason };
  const a = document.createElement("a");
  a.href = r.url;
  a.download = fileName;
  a.rel = "noopener";
  a.click();
  return { ok: true };
}
