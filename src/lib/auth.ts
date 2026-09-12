"use client";

/**
 * 인증 — 아이디/비밀번호 확인.
 *
 * 솔직한 한계 표기 (이 주석을 지우지 말 것):
 * 서버가 없으므로 검증이 브라우저 안에서 일어난다. 해시를 비교하기는 하지만,
 * 저장된 해시와 비교 로직이 모두 클라이언트에 있으므로 이것은 "보안"이 아니라
 * "계정 체계"다. 진짜 보안 경계는 서버 세션/DB를 붙일 때 생긴다.
 * 다만 이전의 '계정을 목록에서 고르면 그 사람이 되는' 구조와는 다르다 —
 * 자격증명을 모르면 들어갈 수 없고, 로그인 시도와 실패가 기록된다.
 */

const SALT = "kpjk-ax::v1::";

export async function hashPassword(loginId: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${SALT}${loginId.trim().toLowerCase()}::${password}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 연속 실패 잠금 — 5회 실패 시 60초. 계정이 아니라 이 브라우저 기준이다. */
export const MAX_ATTEMPTS = 5;
export const LOCK_SECONDS = 60;
