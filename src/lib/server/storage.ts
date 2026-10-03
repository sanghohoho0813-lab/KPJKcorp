"use client";

import { explain, serverEnv, supa } from "./client";

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
/** 기업 서류함 — 내부 전용 (고객은 읽지도 못한다) */
export const VAULT_BUCKET = "vault";
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** 경로에 쓸 수 있는 이름으로. 원본 이름은 document_files.file_name 이 갖는다. */
function safeName(name: string) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  return ext ? `file.${ext}` : "file";
}

export interface UploadResult {
  ok: boolean; path?: string; reason?: string;
  /** 인터넷이 끊겼거나 응답이 멈췄다 — 다시 누르면 될 수 있다 */
  offline?: boolean;
  /** 로그인이 풀려 있었다 — "다시 로그인" 창을 띄운다 */
  authLost?: boolean;
  /** 사용자가 취소했다 */
  cancelled?: boolean;
}
export interface UploadOptions {
  /** 올라간 양 (바이트) — 느린 휴대폰 회선에서 "멈췄나?" 하지 않게 진행률을 보여 준다 */
  onProgress?: (loaded: number, total: number) => void;
  /** 올리기 취소 */
  signal?: AbortSignal;
}
/** 이만큼 아무것도 오가지 않으면 멈춘 것으로 보고 끊는다 (느려도 조금씩 올라가는 동안은 기다린다) */
export const UPLOAD_STALL_MS = 30_000;

/**
 * 파일 올리기.
 * Supabase 도구의 upload 는 진행률·취소·멈춤 감지가 없어, 응답이 오지 않으면 "올리는 중…"에서 끝없이 멈췄다.
 * 같은 주소(storage/v1/object)로 직접 보낸다 — 권한 검사는 똑같이 서버 정책이 한다(로그인 토큰을 그대로 쓴다).
 */
async function put(bucket: string, path: string, file: File, opts: UploadOptions = {}): Promise<UploadResult> {
  const sb = supa();
  if (!sb) return { ok: false, reason: "서버가 설정되지 않았습니다." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: "50MB 를 넘는 파일은 올릴 수 없습니다." };
  if (file.size === 0) return { ok: false, reason: "빈 파일입니다." };
  let token: string | undefined;
  try { token = (await sb.auth.getSession()).data.session?.access_token; } catch { /* 아래에서 처리 */ }
  if (!token) return { ok: false, authLost: true, reason: "로그인이 풀렸습니다. 다시 로그인한 뒤 제출해 주세요." };
  const { url, key } = serverEnv();
  const endpoint = `${String(url).replace(/\/$/, "")}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;

  return new Promise<UploadResult>((resolve) => {
    const xhr = new XMLHttpRequest();
    let stall: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const done = (r: UploadResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(stall);
      opts.signal?.removeEventListener("abort", onAbort);
      resolve(r);
    };
    const arm = () => {
      clearTimeout(stall);
      stall = setTimeout(() => {
        xhr.abort();
        done({ ok: false, offline: true, reason: "연결이 너무 느리거나 끊겨 올리기를 멈췄습니다. 와이파이 등 연결을 확인하고 다시 눌러 주세요." });
      }, UPLOAD_STALL_MS);
    };
    function onAbort() { xhr.abort(); done({ ok: false, cancelled: true, reason: "올리기를 취소했습니다." }); }
    if (opts.signal?.aborted) return onAbort();
    opts.signal?.addEventListener("abort", onAbort);

    xhr.open("POST", endpoint);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", String(key));
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => { arm(); opts.onProgress?.(e.loaded, e.lengthComputable ? e.total : file.size); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return done({ ok: true, path });
      let msg = "";
      try { const j = JSON.parse(xhr.responseText) as { message?: string; error?: string }; msg = j.message ?? j.error ?? ""; } catch { /* 본문 없음 */ }
      console.error("[storage] upload", xhr.status, msg);
      if (/jwt|token|exp/i.test(msg) && (xhr.status === 400 || xhr.status === 401 || xhr.status === 403)) return done({ ok: false, authLost: true, reason: "로그인이 풀렸습니다. 다시 로그인한 뒤 제출해 주세요." });
      if (xhr.status === 413 || /too large|exceeded/i.test(msg)) return done({ ok: false, reason: "파일이 너무 커서 올리지 못했습니다." });
      if (xhr.status === 409 || /exists|Duplicate/i.test(msg)) return done({ ok: false, reason: "같은 파일이 이미 올라가 있습니다. 다시 눌러 주세요." });
      if (xhr.status >= 500) return done({ ok: false, offline: true, reason: "서버가 잠시 응답하지 않습니다. 잠시 후 다시 눌러 주세요." });
      done({ ok: false, reason: /row-level security|Unauthorized|permission/i.test(msg) ? "권한이 없습니다. 담당 컨설턴트에게 문의해 주세요." : explain({ message: msg || `오류 ${xhr.status}` }) });
    };
    xhr.onerror = () => done({ ok: false, offline: true, reason: "인터넷 연결이 끊겨 올리지 못했습니다. 연결을 확인하고 다시 눌러 주세요." });

    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    arm();
    xhr.send(body);
  });
}

/** 고객이 제출하는 자료 */
export function uploadDocument(companyId: string, requestId: string, fileId: string, file: File, opts?: UploadOptions) {
  return put(DOC_BUCKET, `${companyId}/${requestId}/${fileId}__${safeName(file.name)}`, file, opts);
}

/** 기업 서류함 원본 — 신분증 사본 같은 것이 들어가므로 별도 보관함 */
export function uploadVault(companyId: string, fileId: string, file: File) {
  return put(VAULT_BUCKET, `${companyId}/${fileId}__${safeName(file.name)}`, file);
}

/** 담당자가 고객에게 전달하는 결과물 */
export function uploadResult(companyId: string, resultId: string, file: File, opts?: UploadOptions) {
  return put(RESULT_BUCKET, `${companyId}/${resultId}__${safeName(file.name)}`, file, opts);
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
