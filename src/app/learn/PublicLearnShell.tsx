"use client";

/**
 * 로그인 없는 학습 화면(/learn) 공통 — 머리글 · 공개 자료 읽기.
 * 계정 · 상담을 요구하지 않고, 아무것도 수집하지 않는다(읽기만).
 */
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { loadPublicLearn, type PublicLearn } from "@/lib/learn-client";

export function PublicLearnShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/learn" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-shell text-[0.65rem] font-black text-white" aria-label="KPJK 무료 학습 처음으로">KPJK</Link>
          <div className="min-w-0 flex-1"><div className="truncate text-[0.95rem] font-bold">KPJK 무료 학습</div><div className="text-[0.75rem] text-ink-3">로그인 없이 · 무료</div></div>
          <Link href="/match" className="inline-flex min-h-9 items-center rounded-lg px-2 text-[0.8rem] font-semibold text-accent hover:bg-surface-2">공고 찾기</Link>
          <Link href="/login" className="inline-flex min-h-9 items-center rounded-lg px-2 text-[0.8rem] font-semibold text-ink-3 hover:bg-surface-2 hover:text-ink">고객 로그인</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">{children}</main>
    </div>
  );
}

/** 공개 자료 — 처음 한 번 읽는다. null = 불러오는 중 */
export function usePublicLearn(): PublicLearn | null {
  const hydrated = useStore((s) => s.hydrated);
  const local = useStore((s) => s.learnContents);
  const [res, setRes] = useState<PublicLearn | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    void loadPublicLearn(local).then((x) => { if (alive) setRes(x); });
    return () => { alive = false; };
    // 처음 한 번만 — 대표가 공개하면 새로 열 때 반영된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);
  return res;
}
