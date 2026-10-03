"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Input } from "@/components/ui/ui";

/**
 * 쓰던 중에 로그인 유효시간이 지났을 때 — 로그인 화면으로 보내지 않고 이 자리에서 비밀번호만 다시 받는다.
 * 예전에는 15초 안에 아무 말 없이 로그인 화면으로 넘어가, 쓰고 있던 문의·메모가 통째로 사라졌다.
 * 아래 화면(열려 있던 창·입력칸 포함)은 그대로 남고, 풀린 동안 바꾼 것은 보관했다가 다시 로그인하면 보낸다.
 * 같은 계정만 이어갈 수 있다. 다른 사람이면 "다른 계정으로 로그인"(화면을 비우고 로그인 화면으로).
 */
export function ReLoginDialog() {
  const lost = useStore((s) => s.authLost);
  const session = useStore((s) => s.session);
  const me = useStore((s) => s.users.find((u) => u.id === s.session?.userId));
  const unsaved = useStore((s) => s.unsaved ?? 0);
  const reauth = useStore((s) => s.reauth);
  const logout = useStore((s) => s.serverLogout);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!lost || !session || typeof document === "undefined") return null;

  const submit = async () => {
    if (busy) return;
    if (!pw) { setErr("비밀번호를 입력해 주세요."); return; }
    setBusy(true);
    setErr(null);
    const r = await reauth(pw);
    setBusy(false);
    if (r.ok) { setPw(""); return; }
    setPw("");
    setErr(r.reason ?? "로그인하지 못했습니다.");
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 md:items-center md:p-6" role="dialog" aria-modal="true" aria-labelledby="relogin-title" data-testid="relogin">
      <div className="anim-fade absolute inset-0 bg-black/55" />
      <form
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
        className="anim-pop relative w-full max-w-md rounded-t-2xl bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5 shadow-2xl md:rounded-2xl md:p-6"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-soft text-accent-strong"><LockKeyhole size={22} /></div>
        <h2 id="relogin-title" className="mt-3 text-[1.2rem] font-extrabold tracking-tight">다시 로그인해 주세요</h2>
        <p className="mt-1.5 text-[0.92rem] leading-relaxed text-ink-2">
          로그인 유효시간이 지났습니다. <b className="text-ink">지금 화면과 작성 중인 내용은 그대로 있습니다.</b> 비밀번호를 입력하면 이어서 저장됩니다.
        </p>
        {unsaved > 0 && (
          <p className="mt-2 rounded-lg bg-warning-bg px-3 py-2 text-[0.85rem] font-semibold text-warning" data-testid="relogin-unsaved">
            저장 대기 {unsaved}건 — 로그인하면 바로 서버로 보냅니다.
          </p>
        )}
        <div className="mt-4 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[0.88rem]">
          <span className="text-ink-3">계정</span> <b className="break-all">{me?.email ?? "—"}</b>
        </div>
        {/* 비밀번호 관리자가 계정을 알아보도록 아이디 칸을 숨겨 둔다 */}
        <input type="email" name="username" autoComplete="username" value={me?.email ?? ""} readOnly hidden />
        <label className="mt-3 block">
          <span className="mb-1.5 block text-[0.85rem] font-semibold text-ink-2">비밀번호</span>
          <Input type="password" name="password" autoComplete="current-password" autoFocus value={pw}
            onChange={(e) => { setPw(e.target.value); setErr(null); }} className="text-[1rem]" />
        </label>
        {err && <p role="alert" className="mt-2 text-[0.85rem] font-semibold text-error">{err}</p>}
        <Button type="submit" variant="accent" size="lg" full className="mt-4" disabled={busy} icon={<ArrowRight size={18} />}>
          {busy ? "확인 중…" : "로그인하고 이어가기"}
        </Button>
        <button type="button" disabled={busy}
          onClick={async () => { await logout(); window.location.replace("/login"); }}
          className="pressable mt-2 w-full rounded-xl py-2.5 text-[0.88rem] font-semibold text-ink-2 hover:bg-surface-2">
          다른 계정으로 로그인
        </button>
      </form>
    </div>,
    document.body,
  );
}
