/**
 * 사용자가 누르지 않았는데 로그아웃된 경우, 로그인 화면에 그 이유를 한 줄로 보여 준다.
 * 이유 없이 로그인 화면으로 튕기면 "고장 났다"고 느낀다. 보던 화면 주소도 기억했다가 다시 로그인하면 그리로 돌려보낸다.
 * 이 탭에서만 (sessionStorage), 30분이 지나면 버린다. 로그인에 성공하면 지운다.
 */
export type SignOutReason = "expired" | "suspended" | "missing";

const KEY = "kpjk-signed-out";

export const SIGNOUT_TEXT: Record<SignOutReason, string> = {
  expired: "로그인 유효시간이 지나 다시 로그인이 필요합니다. 로그인하면 보시던 화면으로 돌아갑니다.",
  suspended: "사용이 중지된 계정입니다. 대표 계정에 문의해 주세요.",
  missing: "계정 정보를 찾을 수 없습니다. 대표 계정에 문의해 주세요.",
};

export function noteSignOut(reason: SignOutReason) {
  try {
    const path = window.location.pathname + window.location.search;
    window.sessionStorage.setItem(KEY, JSON.stringify({ reason, path, at: Date.now() }));
  } catch { /* 저장소 막힘 — 이유 표시만 빠진다 */ }
}

/** 저장된 원문 (화면은 이것이 바뀔 때만 다시 그린다) — 로그인에 성공하면 clearSignOut */
export function peekSignOut(): string | null {
  try { return window.sessionStorage.getItem(KEY); } catch { return null; }
}
export function parseSignOut(raw: string | null): { reason: SignOutReason; path?: string } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { reason: SignOutReason; path?: string; at: number };
    if (!v.reason || !(v.reason in SIGNOUT_TEXT) || Date.now() - v.at > 30 * 60 * 1000) return null;
    return { reason: v.reason, path: v.path };
  } catch { return null; }
}
export function clearSignOut() {
  try { window.sessionStorage.removeItem(KEY); } catch { /* 무시 */ }
}

/** 다시 로그인한 뒤 돌아갈 곳 — 그 역할이 열 수 있는 화면일 때만 */
export function returnPath(path: string | undefined, role: string): string | undefined {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return undefined;
  if (role === "client") return /^\/portal(\/|$|\?)/.test(path) ? path : undefined;
  return /^\/ax(\/|$|\?)/.test(path) ? path : undefined;
}
