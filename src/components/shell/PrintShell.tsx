"use client";

import { type ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageSkeleton } from "@/components/ui/ui";

/**
 * 인쇄 화면 껍데기. 내부 계정만 들어올 수 있고, 화면 위 도구줄은 인쇄 시 사라진다.
 * 외부 PDF 라이브러리 없이 브라우저 인쇄(⌘P → PDF 저장)만 쓴다 — 의존성 하나가 늘면 유지비가 는다.
 */
export function PrintShell({ children }: { children: ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);
  const session = useStore((s) => s.session);
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (!session || session.role === "client") router.replace("/login");
  }, [hydrated, session, router]);

  const ready = hydrated && session && session.role !== "client";

  return (
    <div className="min-h-screen bg-canvas print:bg-white">
      <div className="print-hide sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface/90 px-4 py-2 backdrop-blur">
        <button onClick={() => router.back()} className="pressable flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[0.85rem] font-semibold text-ink-2 hover:bg-surface-2"><ArrowLeft size={16} /> 돌아가기</button>
        <span className="flex-1 text-center text-[0.8rem] text-ink-3">인쇄 미리보기 — 화면에 보이는 그대로 인쇄됩니다. PDF로 저장하려면 인쇄 대화상자에서 &ldquo;PDF로 저장&rdquo;을 고르세요.</span>
        <button onClick={() => window.print()} className="pressable lift flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[0.85rem] font-semibold text-accent-ink"><Printer size={16} /> 인쇄 / PDF 저장</button>
      </div>
      <main className="print-page mx-auto w-full max-w-[210mm] px-6 py-8 print:max-w-none print:px-0 print:py-0">
        {ready ? children : <PageSkeleton />}
      </main>
    </div>
  );
}
