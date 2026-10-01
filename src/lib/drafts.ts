"use client";

/**
 * 작성 중인 입력 임시 저장 (이 브라우저).
 *
 * 왜: 기업고객 등록을 한참 쓰다가 창이 닫히면 처음부터 다시 써야 했다.
 * 쓰는 동안 계속 이 브라우저에 담아 두고, 다시 열면 그대로 이어서 쓴다.
 * 등록·저장에 성공하면 지운다. 계정마다 따로 담는다(공용 PC 에서 남의 초안이 보이지 않게).
 *
 * 서버로 보내지 않는다 — 아직 확정되지 않은 값이고, 고객 정보가 섞여 있다.
 */

const PREFIX = "kpjk-draft:";
const EVENT = "kpjk-drafts";

export interface Draft<T> { data: T; savedAt: string; label?: string }
export interface DraftInfo { key: string; kind: string; id: string; savedAt: string; label?: string }

export const draftKey = (kind: string, id: string | null | undefined, userId: string) => `${PREFIX}${kind}:${id || "new"}:${userId}`;

export function loadDraft<T>(key: string): Draft<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft<T>) : null;
  } catch { return null; }
}

export function saveDraft<T>(key: string, data: T, label?: string) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ data, savedAt: new Date().toISOString(), label }));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* 저장소가 막혀 있으면 임시 저장만 못 한다 */ }
}

export function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
    window.dispatchEvent(new Event(EVENT));
  } catch { /* 무시 */ }
}

/** 이 계정의 초안 목록 */
export function listDrafts(userId: string): DraftInfo[] {
  const out: DraftInfo[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(PREFIX) || !key.endsWith(`:${userId}`)) continue;
      const [kind, id] = key.slice(PREFIX.length).split(":");
      const d = loadDraft<unknown>(key);
      if (d) out.push({ key, kind, id, savedAt: d.savedAt, label: d.label });
    }
  } catch { /* 무시 */ }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function onDraftsChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => { window.removeEventListener(EVENT, fn); window.removeEventListener("storage", fn); };
}
