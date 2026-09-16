"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { useStore } from "@/lib/store";
import { hashPassword, LOCK_SECONDS, MAX_ATTEMPTS } from "@/lib/auth";
import { serverConfigured } from "@/lib/server/client";
import { sendPasswordReset } from "@/lib/server/auth";
import { Badge, Button, DemoBadge, Field, Input, cx } from "@/components/ui/ui";
import { Toaster } from "@/components/ui/Toaster";

/** 데모 계정 안내 — 운영 전환 시 이 블록과 seed의 passwordHash를 함께 제거한다. */
const DEMO_ACCOUNTS = [
  { label: "대표 · 관리자", id: "ceo@kpjk.co.kr", pw: "kpjk2026!" },
  { label: "컨설턴트", id: "park@kpjk.co.kr", pw: "kpjk2026!" },
  { label: "기업고객", id: "ceo@a-precision.demo", pw: "client2026!" },
];

export default function LoginPage() {
  const hydrated = useStore((s) => s.hydrated);
  const session = useStore((s) => s.session);
  const signIn = useStore((s) => s.signIn);
  const signInServer = useStore((s) => s.serverSignIn);
  const setPreview = useStore((s) => s.setPortalPreview);
  const live = useStore((s) => s.settings.liveMode);
  const router = useRouter();
  // 서버가 붙어 있으면 로그인은 Supabase 가 처리한다. 없으면 지금까지처럼 브라우저 안에서 확인한다.
  const onServer = serverConfigured();
  const [resetSent, setResetSent] = useState(false);

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (hydrated && session && !busy) {
      router.replace(session.role === "client" ? "/portal" : "/ax/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // 잠금 남은 시간 표시용 타이머 — 잠겨 있을 때만 돈다.
  useEffect(() => {
    if (!lockUntil) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [lockUntil]);

  const lockLeft = lockUntil && now ? Math.max(0, Math.ceil((lockUntil - now) / 1000)) : 0;
  const locked = lockLeft > 0;

  const submit = async () => {
    if (busy || locked) return;
    if (!loginId.trim() || !password) {
      setError("아이디와 비밀번호를 모두 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (onServer) {
        const r = await signInServer(loginId, password);
        if (!r.ok) {
          const next = attempts + 1;
          setAttempts(next);
          if (next >= MAX_ATTEMPTS) {
            setLockUntil(Date.now() + LOCK_SECONDS * 1000);
            setNow(Date.now());
            setAttempts(0);
            setError(`로그인 시도가 ${MAX_ATTEMPTS}회 실패했습니다. ${LOCK_SECONDS}초 후 다시 시도해 주세요.`);
          } else {
            setError(`${r.reason ?? "로그인하지 못했습니다."} (${next}/${MAX_ATTEMPTS})`);
          }
          setPassword("");
          setBusy(false);
          return;
        }
        setPreview(undefined);
        const role = useStore.getState().session?.role;
        setTimeout(() => router.push(role === "client" ? "/portal" : "/ax/dashboard"), 200);
        return;
      }

      const hash = await hashPassword(loginId, password);
      const res = signIn(loginId, hash);
      if (!res.ok) {
        const next = attempts + 1;
        setAttempts(next);
        if (next >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCK_SECONDS * 1000;
          setLockUntil(until);
          setNow(Date.now());
          setAttempts(0);
          setError(`로그인 시도가 ${MAX_ATTEMPTS}회 실패했습니다. ${LOCK_SECONDS}초 후 다시 시도해 주세요.`);
        } else {
          setError(
            res.reason === "inactive"
              ? "사용이 중지된 계정입니다. 관리자에게 문의해 주세요."
              : `아이디 또는 비밀번호가 올바르지 않습니다. (${next}/${MAX_ATTEMPTS})`,
          );
        }
        setPassword("");
        setBusy(false);
        return;
      }
      setPreview(undefined);
      const role = useStore.getState().session?.role;
      setTimeout(() => router.push(role === "client" ? "/portal" : "/ax/dashboard"), 200);
    } catch {
      setError("로그인 처리 중 문제가 발생했습니다. 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  const fill = (a: (typeof DEMO_ACCOUNTS)[number]) => {
    setLoginId(a.id);
    setPassword(a.pw);
    setError(null);
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-shell lg:block">
        <Image src="/assets/hero_main.jpg" alt="KPJK 컨설팅 미팅" fill priority className="object-cover object-[60%_center] opacity-80" sizes="55vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-shell via-shell/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <div className="mb-3 text-[0.8rem] font-bold tracking-widest text-highlight">KPJK CORPORATION</div>
          <h2 className="text-[2.2rem] font-bold leading-tight">기업고객과 내부 업무가<br />하나의 데이터로 연결되는<br />컨설팅 운영체계</h2>
          <p className="mt-4 max-w-lg text-[1rem] text-shell-text-2">상담 → 계약 → 자료요청 → 검토 → 결과 → 사후관리까지, 고객도 자신의 진행상황에 직접 참여합니다.</p>
        </div>
      </div>

      <div className="flex min-h-screen flex-col justify-center px-6 py-10 md:px-14">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-shell text-[0.75rem] font-black tracking-wider text-white">KPJK</span>
            <div className="leading-tight">
              <div className="text-[0.72rem] font-bold tracking-[0.1em] text-ink-3">KPJK CORPORATION</div>
              <div className="text-[1.2rem] font-bold">Business AX</div>
            </div>
            <DemoBadge className="ml-auto" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[1.6rem] font-bold">로그인</h1>
            {onServer && <Badge tone="success" dot>서버 연결</Badge>}
          </div>
          <p className="mt-1 text-[0.9rem] text-ink-2">
            {onServer
              ? "계정 아이디와 비밀번호를 입력해 주세요. 데이터는 서버에 저장되며 어느 기기에서 열어도 같습니다."
              : "계정 아이디와 비밀번호를 입력해 주세요. 역할은 계정에 따라 결정됩니다."}
          </p>

          <div className="mt-6 space-y-3">
            <Field label="아이디 (이메일)">
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <Input
                  className="pl-9"
                  autoComplete="username"
                  inputMode="email"
                  value={loginId}
                  onChange={(e) => { setLoginId(e.target.value); setError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="name@kpjk.co.kr"
                  disabled={locked}
                />
              </div>
            </Field>
            <Field label="비밀번호">
              <div className="relative">
                <KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <Input
                  className="px-9"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="비밀번호"
                  disabled={locked}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "비밀번호 숨기기" : "비밀번호 표시"}
                  className="pressable absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {error && (
              <div role="alert" className="anim-pop-in flex items-start gap-2 rounded-xl bg-error-bg px-4 py-3 text-[0.85rem] font-semibold text-error">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}{locked && lockLeft > 0 ? ` (${lockLeft}초)` : ""}</span>
              </div>
            )}

            <Button variant="accent" size="lg" full onClick={submit} disabled={!hydrated || busy || locked} icon={<ArrowRight size={18} />}>
              {locked ? `${lockLeft}초 후 다시 시도` : busy ? "확인 중…" : "로그인"}
            </Button>

            {onServer && (
              resetSent ? (
                <p className="text-center text-[0.82rem] text-success">
                  재설정 메일을 보냈습니다. 받은 편지함을 확인해 주세요.
                </p>
              ) : (
                <button
                  type="button"
                  className="w-full text-center text-[0.82rem] font-semibold text-ink-3 underline-offset-2 hover:text-ink hover:underline"
                  onClick={async () => {
                    if (!loginId.trim()) { setError("먼저 아이디(이메일)를 입력해 주세요."); return; }
                    const r = await sendPasswordReset(loginId);
                    // 그 이메일이 등록돼 있는지 알려주지 않는다 — 계정 존재 여부를 떠보는 것을 막는다.
                    if (r.ok) setResetSent(true); else setError(r.reason ?? "메일을 보내지 못했습니다.");
                  }}
                >
                  비밀번호를 잊으셨나요?
                </button>
              )
            )}
          </div>

          {!live && !onServer && (
          <div className="mt-6 rounded-xl border border-line bg-surface-2/60 p-4">
            <div className="text-[0.82rem] font-bold">데모 계정</div>
            <p className="mt-0.5 text-[0.78rem] leading-relaxed text-ink-3">
              시연용 계정입니다. 누르면 입력창에 채워집니다. 운영 전환 시 이 안내와 시드 계정은 함께 제거됩니다.
            </p>
            <div className="mt-2.5 space-y-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => fill(a)}
                  className={cx("pressable flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left text-[0.8rem] hover:bg-surface-2", locked && "pointer-events-none opacity-50")}
                >
                  <span className="w-[76px] shrink-0 font-bold">{a.label}</span>
                  <span className="tnum min-w-0 flex-1 truncate text-ink-2">{a.id}</span>
                  <span className="tnum shrink-0 text-ink-3">{a.pw}</span>
                </button>
              ))}
            </div>
          </div>
          )}

          <p className="mt-4 text-[0.75rem] leading-relaxed text-ink-3">
            이 시스템은 브라우저 안에서만 동작합니다. 비밀번호 확인도 브라우저에서 이루어지므로 보안 경계가 아니며,
            서버·DB 연결 시 실제 인증으로 대체됩니다. 샘플 데이터는 실제 고객이 아닌 Demo 기업입니다.
          </p>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
