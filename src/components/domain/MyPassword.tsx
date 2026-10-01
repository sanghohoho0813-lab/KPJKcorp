"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, ShieldAlert } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { hashPassword } from "@/lib/auth";
import { changeMyPassword, mustChangePassword } from "@/lib/server/auth";
import { Button, Field, Input } from "@/components/ui/ui";

function pwIssue(pw: string) {
  if (pw.length < 8) return "8자 이상이어야 합니다.";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "영문과 숫자를 함께 사용해 주세요.";
  return null;
}

/** 대표가 정해 준 처음 비밀번호를 아직 쓰는가 — 서버 모드에서만 알 수 있다 */
export function useMustChangePassword() {
  const serverMode = useStore((s) => s.serverMode);
  const userId = useStore((s) => s.session?.userId);
  const [mustRaw, setMust] = useState(false);
  const must = !!serverMode && !!userId && mustRaw;
  useEffect(() => {
    let alive = true;
    if (!serverMode || !userId) return;
    void mustChangePassword().then((v) => { if (alive) setMust(v); });
    const on = () => { void mustChangePassword().then((v) => { if (alive) setMust(v); }); };
    window.addEventListener("kpjk-password-changed", on);
    return () => { alive = false; window.removeEventListener("kpjk-password-changed", on); };
  }, [serverMode, userId]);
  return must;
}

/** 본인 비밀번호 바꾸기 — 고객 MY 화면과 내부 설정에 같은 것을 쓴다 */
export function MyPasswordForm() {
  const serverMode = useStore((s) => s.serverMode);
  const changeOwn = useStore((s) => s.changeOwnPassword);
  const toast = useStore((s) => s.toast);
  const me = useCurrentUser();
  const must = useMustChangePassword();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<{ pw?: string; pw2?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e: { pw?: string; pw2?: string } = {};
    const issue = pwIssue(pw);
    if (issue) e.pw = issue;
    else if (pw !== pw2) e.pw2 = "두 칸이 서로 다릅니다.";
    setErr(e);
    if (Object.keys(e).length || !me) return;
    setBusy(true);
    try {
      if (serverMode) {
        const r = await changeMyPassword(pw);
        if (!r.ok) { toast(r.reason ?? "바꾸지 못했습니다.", "error"); return; }
        window.dispatchEvent(new Event("kpjk-password-changed"));
      } else {
        changeOwn(await hashPassword(me.email, pw));
      }
      setPw(""); setPw2("");
      toast("비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.");
    } finally { setBusy(false); }
  };

  return (
    <div id="password" className="scroll-mt-24">
      {must && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-warning-bg px-3.5 py-2.5 text-[0.85rem] text-ink" data-testid="must-change-pw">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-warning" />
          <span>지금은 <b>처음 받은 비밀번호</b>를 쓰고 계십니다. 본인만 아는 비밀번호로 바꿔 주세요.</span>
        </div>
      )}
      <div className="space-y-3">
        <Field label="새 비밀번호" hint={err.pw ?? "영문+숫자 8자 이상"}>
          <Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="새 비밀번호" />
        </Field>
        <Field label="새 비밀번호 확인" hint={err.pw2}>
          <Input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} aria-label="새 비밀번호 확인" />
        </Field>
        <Button variant="accent" icon={<KeyRound size={15} />} onClick={submit} disabled={busy}>{busy ? "바꾸는 중…" : "비밀번호 바꾸기"}</Button>
      </div>
    </div>
  );
}

/** 처음 비밀번호를 쓰는 동안 홈 위에 한 줄 — 바꾸면 사라진다 */
export function PasswordNudge({ href }: { href: string }) {
  const must = useMustChangePassword();
  if (!must) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning-bg/70 px-3.5 py-2.5 text-[0.85rem]" data-testid="password-nudge">
      <ShieldAlert size={16} className="shrink-0 text-warning" />
      <span className="min-w-0 flex-1">처음 받은 비밀번호를 쓰고 계십니다. 개인정보 보호를 위해 바꿔 주세요.</span>
      <Link href={href} className="pressable inline-flex min-h-9 items-center rounded-lg bg-warning px-3 font-semibold text-white">지금 바꾸기</Link>
    </div>
  );
}
