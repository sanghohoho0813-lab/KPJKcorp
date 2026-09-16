"use client";

import type { Role, User } from "../types";
import { explain, supa, supaSignUpOnly } from "./client";
import { userFromRow, userToRow } from "./rows";

/**
 * 서버 로그인.
 *
 * 지금까지의 로그인은 브라우저 안에서 해시를 비교하는 것이었다. 개발자도구를 열 줄
 * 아는 사람은 우회할 수 있었고, 그래서 코드 주석에도 "보안 경계가 아니다"라고 적어 두었다.
 * 여기서부터는 Supabase Auth 가 비밀번호를 검증하고 토큰을 발급하며,
 * 그 토큰으로 무엇을 할 수 있는지는 데이터베이스의 정책(002_rls.sql)이 정한다.
 */

export interface SignInResult {
  ok: boolean;
  user?: User;
  reason?: string;
}

export async function serverSignIn(email: string, password: string): Promise<SignInResult> {
  const sb = supa();
  if (!sb) return { ok: false, reason: "서버가 설정되지 않았습니다." };

  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error || !data.user) {
    // 어느 쪽이 틀렸는지 알려주지 않는다 — 계정이 있는지 떠보는 것을 막는다.
    return { ok: false, reason: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  const { data: row, error: pErr } = await sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (pErr) return { ok: false, reason: explain(pErr) };
  if (!row) {
    await sb.auth.signOut();
    return { ok: false, reason: "이 계정은 아직 사용 준비가 되지 않았습니다. 대표 계정에 문의하세요." };
  }
  const user = userFromRow(row);
  if (user.active === false) {
    await sb.auth.signOut();
    return { ok: false, reason: "사용이 중지된 계정입니다. 대표 계정에 문의하세요." };
  }

  await sb.rpc("kpjk_touch_login");
  return { ok: true, user };
}

export async function serverSignOut() {
  await supa()?.auth.signOut();
}

/** 새로고침 후에도 로그인이 유지되는지 확인한다 */
export async function currentServerUser(): Promise<User | null> {
  const sb = supa();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: row } = await sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (!row) return null;
  const user = userFromRow(row);
  return user.active === false ? null : user;
}

/**
 * 계정 만들기.
 *
 * 세션을 저장하지 않는 두 번째 연결로 가입시킨다. 그래야 방금 만든 계정으로
 * 화면이 바뀌지 않고 대표가 로그인한 상태 그대로 남는다.
 * 프로필 삽입은 현재(대표) 연결로 한다 — 대표만 통과하도록 정책이 걸려 있다.
 */
export async function createServerUser(input: {
  name: string; email: string; password: string; role: Role; title: string;
  phone?: string; companyId?: string;
}): Promise<{ ok: true; user: User } | { ok: false; reason: string }> {
  const sb = supa();
  const signer = supaSignUpOnly();
  if (!sb || !signer) return { ok: false, reason: "서버가 설정되지 않았습니다." };

  const email = input.email.trim().toLowerCase();
  const { data, error } = await signer.auth.signUp({ email, password: input.password });
  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      return { ok: false, reason: "이미 등록된 이메일입니다." };
    }
    if (/password/i.test(error.message)) {
      return { ok: false, reason: "비밀번호가 너무 짧습니다. 6자 이상으로 정해 주세요." };
    }
    return { ok: false, reason: error.message };
  }
  if (!data.user) return { ok: false, reason: "계정을 만들지 못했습니다." };

  const row = {
    id: data.user.id,
    ...userToRow({ name: input.name, email, role: input.role, title: input.title, phone: input.phone, companyId: input.companyId, active: true }),
  };
  const { data: saved, error: pErr } = await sb.from("profiles").insert(row).select().single();
  if (pErr) {
    // auth 사용자는 만들어졌는데 프로필이 안 붙은 상태다. 그대로 두면 "로그인은 되는데
    // 아무것도 안 보이는" 계정이 된다. 사람이 손댈 수 있도록 상황을 그대로 알린다.
    return { ok: false, reason: `계정은 생성됐지만 권한 정보를 저장하지 못했습니다 (${explain(pErr)}). Supabase 대시보드에서 ${email} 사용자를 지운 뒤 다시 시도해 주세요.` };
  }
  return { ok: true, user: userFromRow(saved) };
}

/** 비밀번호 재설정 메일. 대표가 남의 비밀번호를 직접 정하지 않는다 — 본인만 바꾼다. */
export async function sendPasswordReset(email: string): Promise<{ ok: boolean; reason?: string }> {
  const sb = supa();
  if (!sb) return { ok: false, reason: "서버가 설정되지 않았습니다." };
  const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
  });
  return error ? { ok: false, reason: error.message } : { ok: true };
}

/** 본인 비밀번호 변경 */
export async function changeMyPassword(next: string): Promise<{ ok: boolean; reason?: string }> {
  const sb = supa();
  if (!sb) return { ok: false, reason: "서버가 설정되지 않았습니다." };
  const { error } = await sb.auth.updateUser({ password: next });
  return error ? { ok: false, reason: error.message } : { ok: true };
}

/** 계정 사용 중지·재개 (auth 계정은 남기고 프로필만 끈다 — 기록의 작성자 연결이 끊기면 안 된다) */
export async function setServerUserActive(userId: string, active: boolean): Promise<{ ok: boolean; reason?: string }> {
  const sb = supa();
  if (!sb) return { ok: false, reason: "서버가 설정되지 않았습니다." };
  const { error } = await sb.from("profiles").update({ active }).eq("id", userId);
  return error ? { ok: false, reason: explain(error) } : { ok: true };
}

/** 프로필 수정 (이름·직책·연락처·역할) */
export async function updateServerUser(userId: string, patch: Partial<User>): Promise<{ ok: boolean; reason?: string }> {
  const sb = supa();
  if (!sb) return { ok: false, reason: "서버가 설정되지 않았습니다." };
  const { error } = await sb.from("profiles").update(userToRow(patch)).eq("id", userId);
  return error ? { ok: false, reason: explain(error) } : { ok: true };
}
