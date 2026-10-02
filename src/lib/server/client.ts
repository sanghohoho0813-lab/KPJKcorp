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

/**
 * 현장 비상용 — 서버가 설정돼 있어도 이 브라우저만 데모 모드로 돌린다.
 * 인터넷이 끊기거나 Supabase 가 멈춰도 로그인 화면의 버튼 하나로 시연을 이어가기 위한 것이다.
 * 기기별 표시라 localStorage 에 둔다. 서버 데이터에는 아무 영향이 없다.
 */
export const DEMO_FLAG_KEY = "kpjk-force-demo";
export function demoForced(): boolean {
  try { return typeof window !== "undefined" && window.localStorage.getItem(DEMO_FLAG_KEY) === "1"; } catch { return false; }
}
export function setDemoForced(on: boolean) {
  try { if (on) window.localStorage.setItem(DEMO_FLAG_KEY, "1"); else window.localStorage.removeItem(DEMO_FLAG_KEY); } catch { /* 저장소 막힘 */ }
}

export function supa(): SupabaseClient | null {
  if (demoForced()) return null;
  if (cached !== undefined) return cached;
  cached = url && anonKey ? createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "kpjk-auth" },
  }) : null;
  return cached;
}

/** 연결 점검용 — anon 키는 원래 브라우저에 나가는 값이다. 화면에 표시하지는 않는다 */
export const serverEnv = () => ({ url, key: anonKey });

/** 이 앱 빌드에 서버 주소가 들어 있는가 (비상 데모 전환과 무관) */
export const serverAvailable = () => !!(url && anonKey);

/**
 * 인터넷에 올린 사이트인데 서버 주소가 빌드에 없다 — 입력한 것이 그 기기 브라우저에만 남는다.
 * (Vercel 환경변수를 넣지 않았거나, 넣고 다시 배포하지 않은 경우. NEXT_PUBLIC_ 값은 배포할 때 굳는다)
 * 내 PC(localhost)에서 돌리는 시연·시험은 해당하지 않는다.
 */
export function deployedWithoutServer(): boolean {
  if (serverAvailable() || typeof window === "undefined") return false;
  return !/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(window.location.hostname);
}

/** 지금 이 브라우저가 서버로 도는가 (로그인 여부와 무관). 비상 데모로 돌렸으면 false */
export const serverConfigured = () => serverAvailable() && !demoForced();

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
