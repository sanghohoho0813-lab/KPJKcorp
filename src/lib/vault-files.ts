"use client";

import type { CompanyFile } from "./types";
import { putBlob, getBlob, deleteBlob } from "./blobstore";
import { downloadUrl, removeObject, uploadVault, VAULT_BUCKET } from "./server/storage";

/**
 * 서류함 파일의 원본을 어디에 두고 어떻게 여는가.
 * - 서버 연결: vault 보관함(내부 전용). 열 때마다 5분짜리 임시 주소를 받는다.
 * - 데모: 이 브라우저(IndexedDB). 다른 PC 에서는 보이지 않는다.
 */

const blobKey = (id: string) => `cf:${id}`;

export async function storeFileData(server: boolean, companyId: string, fileId: string, file: File): Promise<{ ok: true; storagePath?: string } | { ok: false; reason: string }> {
  if (server) {
    const r = await uploadVault(companyId, fileId, file);
    return r.ok ? { ok: true, storagePath: r.path } : { ok: false, reason: r.reason ?? "올리지 못했습니다." };
  }
  try {
    await putBlob(blobKey(fileId), file);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "이 브라우저에 보관하지 못했습니다." };
  }
}

/** 미리보기·내려받기에 쓸 원본 */
export async function loadFileData(f: CompanyFile): Promise<Blob | null> {
  if (f.storagePath) {
    const r = await downloadUrl(VAULT_BUCKET, f.storagePath);
    if (!r.ok || !r.url) return null;
    const res = await fetch(r.url);
    return res.ok ? await res.blob() : null;
  }
  return (await getBlob(blobKey(f.id)).catch(() => undefined)) ?? null;
}

export async function removeFileData(f: CompanyFile) {
  if (f.storagePath) await removeObject(VAULT_BUCKET, f.storagePath);
  else await deleteBlob(blobKey(f.id)).catch(() => undefined);
}

/** 원래 이름으로 내려받기 */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
