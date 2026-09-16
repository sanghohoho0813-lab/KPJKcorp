"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase 연결.
 *
 * 환경변수가 없으면 null 을 돌려준다 — 앱은 예전처럼 브라우저 저장소(데모 모드)로 돈다.
 * 서버를 붙이는 일이 데모를 망가뜨리면 안 된다. 발표 중에 인터넷이 끊겨도 화면은 살아야 한다.
 *
 * anon key 는 브라우저에 그대로 나간다. 그래도 되는 열쇠다 — 이 열쇠로 할 수 있는 일은
 * supabase/setup.sql 2부의 정책이 전부 정한다. 절대 service_role key 를 여기에 넣지 않는다.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: SupabaseClient | null | undefined;

export function supa(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  cached = url && anonKey ? createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "kpjk-auth" },
  }) : null;
  return cached;
}

/** 서버 연결이 설정돼 있는가 (로그인 여부와 무관) */
export const serverConfigured = () => !!(url && anonKey);

/**
 * 계정을 만들 때만 쓰는 두 번째 연결.
 *
 * 그냥 signUp 을 부르면 새로 만든 계정으로 세션이 바뀌어 대표가 로그아웃된다.
 * 세션을 저장하지 않는 별도 연결로 만들면 현재 로그인이 그대로 유지된다.
 * service_role key 없이 계정 생성을 해결하는 방법이다 — 서버 함수를 따로 띄우지 않는다.
 */
export function supaSignUpOnly(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** PostgREST 오류를 사람이 읽는 한 줄로. 원문은 개발자도구에 남긴다. */
export function explain(e: { code?: string; message?: string; details?: string } | null): string {
  if (!e) return "알 수 없는 오류";
  const code = e.code ?? "";
  if (code === "42501" || code === "PGRST301") return "권한이 없습니다. 대표 계정에 문의하세요.";
  if (code === "23505") return "이미 같은 값이 등록되어 있습니다.";
  if (code === "23503") return "연결된 항목이 아직 서버에 없습니다. 잠시 후 다시 시도해 주세요.";
  if (code === "PGRST116") return "대상을 찾을 수 없습니다. 다른 사람이 먼저 바꿨을 수 있습니다.";
  if (e.message?.includes("Failed to fetch")) return "서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.";
  return e.message ?? "서버 오류";
}
