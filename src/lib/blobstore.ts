"use client";

/**
 * 브라우저 안 파일 보관 (서버 연결 전 데모 모드용).
 *
 * 지금까지 데모 모드는 파일 이름과 용량만 남겼다 — 그래서 "미리보기·내려받기"를 보여줄 수 없었다.
 * 기업 서류함은 파일을 실제로 열어 봐야 의미가 있으므로, 서버가 없을 때는 IndexedDB 에 원본을 둔다.
 * localStorage(5MB)와 달리 수백 MB 까지 담긴다. 이 브라우저에만 있고, 서버를 붙이면 서버 보관함을 쓴다.
 */

const DB = "kpjk-files";
const STORE = "blobs";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("이 브라우저는 파일 보관을 지원하지 않습니다.")); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("파일 보관함을 열지 못했습니다."));
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("파일 보관 중 오류가 났습니다."));
    t.oncomplete = () => db.close();
  }));
}

export const putBlob = (key: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, key)).then(() => undefined);
export const getBlob = (key: string) => tx<Blob | undefined>("readonly", (s) => s.get(key) as IDBRequest<Blob | undefined>);
export const deleteBlob = (key: string) => tx("readwrite", (s) => s.delete(key)).then(() => undefined);
