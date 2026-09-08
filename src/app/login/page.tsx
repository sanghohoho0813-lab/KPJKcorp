"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, ShieldCheck, UserRound } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, DemoBadge, Select, cx } from "@/components/ui/ui";
import { Toaster } from "@/components/ui/Toaster";

export default function LoginPage() {
  const hydrated = useStore((s) => s.hydrated);
  const session = useStore((s) => s.session);
  const users = useStore((s) => s.users);
  const companies = useStore((s) => s.companies);
  const login = useStore((s) => s.login);
  const setPreview = useStore((s) => s.setPortalPreview);
  const router = useRouter();
  const [role, setRole] = useState<"admin" | "consultant" | "client">("admin");
  const [consultantId, setConsultantId] = useState("u_park");
  const [clientId, setClientId] = useState("c_a");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hydrated && session && !busy) {
      // already logged in → go home
      router.replace(session.role === "client" ? "/portal" : "/ax/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const go = () => {
    setBusy(true);
    const id = role === "admin" ? "u_admin" : role === "consultant" ? consultantId : clientId;
    login(id);
    setPreview(undefined);
    setTimeout(() => router.push(role === "client" ? "/portal" : "/ax/dashboard"), 250);
  };

  const consultants = users.filter((u) => u.role === "consultant");
  const clients = users.filter((u) => u.role === "client");

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
              <div className="text-[1.2rem] font-bold">KPJK Consulting AX</div>
              <div className="text-[0.85rem] text-ink-2">Business AX + Client Portal</div>
            </div>
            <DemoBadge className="ml-auto" />
          </div>
          <h1 className="text-[1.6rem] font-bold">어떤 화면으로 들어갈까요?</h1>
          <p className="mt-1 text-[0.9rem] text-ink-2">데모 계정으로 로그인합니다. 비밀번호는 필요 없습니다.</p>

          <div className="mt-6 grid grid-cols-3 gap-2">
            {[
              { key: "admin" as const, label: "대표 · 관리자", icon: <ShieldCheck size={22} />, desc: "전체 현황" },
              { key: "consultant" as const, label: "컨설턴트", icon: <UserRound size={22} />, desc: "담당 고객" },
              { key: "client" as const, label: "기업고객", icon: <Building2 size={22} />, desc: "고객 Portal" },
            ].map((r) => (
              <button key={r.key} onClick={() => setRole(r.key)} className={cx("pressable flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-4 text-center transition-colors", role === r.key ? "border-accent bg-soft/60" : "border-line hover:border-line-2 hover:bg-surface-2")}>
                <span className={role === r.key ? "text-accent" : "text-ink-3"}>{r.icon}</span>
                <span className="text-[0.85rem] font-bold">{r.label}</span>
                <span className="text-[0.72rem] text-ink-3">{r.desc}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {role === "admin" && (
              <div className="rounded-xl bg-surface-2 px-4 py-3 text-[0.9rem]">
                <b>김영돈 대표이사</b> — 전체 기업고객·프로젝트·지연·우선업무·AI 브리핑을 확인합니다.
              </div>
            )}
            {role === "consultant" && (
              <Select value={consultantId} onChange={(e) => setConsultantId(e.target.value)}>
                {consultants.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} {u.title}</option>
                ))}
              </Select>
            )}
            {role === "client" && (
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clients.map((u) => {
                  const c = companies.find((x) => x.id === u.companyId);
                  return (
                    <option key={u.id} value={u.id}>{c?.name} — {u.name} {u.title}</option>
                  );
                })}
              </Select>
            )}
            <Button variant="accent" size="lg" full onClick={go} disabled={!hydrated || busy} icon={<ArrowRight size={18} />}>
              {role === "client" ? "고객 Portal 들어가기" : "Business AX 들어가기"}
            </Button>
          </div>

          <div className="mt-8 rounded-xl border border-line p-4 text-[0.8rem] leading-relaxed text-ink-2">
            <b className="text-ink">이 데모에서 확인할 수 있는 것</b>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
              <li>고객이 Portal에서 자료를 제출하면 내부 AX에 즉시 도착 (Closed Loop)</li>
              <li>담당자가 검토·단계 변경하면 고객 Portal 상태와 알림이 자동 반영</li>
              <li>대표는 매일 아침 '먼저 확인할 업무'를 근거와 함께 확인</li>
            </ul>
            <div className="mt-2 text-ink-3">샘플 데이터는 실제 고객이 아닌 중립적인 Demo 기업입니다.</div>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
