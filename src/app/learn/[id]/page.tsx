"use client";

/** 로그인 없는 학습 자료 한 건 — 공개한 자료만. 준비 항목 체크는 이 화면에서만(저장 안 함) */
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/ui";
import { LearnBody, LearnCard } from "@/components/domain/self/SelfParts";
import { decodeParam } from "@/components/domain/self/hooks";
import { PublicLearnShell, usePublicLearn } from "../PublicLearnShell";

export default function PublicLearnItemPage() {
  const id = decodeParam(useParams().id);
  const res = usePublicLearn();
  const c = res?.items.find((x) => x.id === id);
  const more = c ? (res?.items ?? []).filter((x) => x.id !== c.id && x.category === c.category).slice(0, 2) : [];
  return (
    <PublicLearnShell>
      <Link href="/learn" className="inline-flex min-h-9 items-center gap-1 text-[0.85rem] font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={15} /> 학습 자료 전체</Link>
      {!res ? <p className="text-[0.86rem] text-ink-3">불러오는 중…</p>
        : !c ? <Card><EmptyState title="찾을 수 없는 학습 자료입니다" desc="비공개로 바뀌었거나 주소가 바뀌었을 수 있습니다." action={<Link href="/learn" className="font-semibold text-accent">학습 자료 보기 →</Link>} /></Card>
        : (
          <>
            <div data-testid="public-learn-item">
              <div className="text-[0.78rem] font-semibold text-ink-3">{c.category}{c.minutes ? ` · 약 ${c.minutes}분` : ""}</div>
              <h1 className="mt-0.5 text-[1.35rem] font-bold leading-tight md:text-[1.6rem]">{c.title}</h1>
            </div>
            <Card className="p-5"><LearnBody c={c} publicMode /></Card>
            <Link href="/match" className="pressable card card-hover flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-soft text-accent-strong"><Search size={19} /></span>
              <span className="min-w-0 flex-1"><b>다음: 우리 회사에 맞는 공고 보기</b><span className="block text-[0.8rem] text-ink-2">로그인 없이 · 실제 접수 중인 공고</span></span>
              <ArrowRight size={18} className="shrink-0 text-ink-3" />
            </Link>
            {more.length > 0 && (
              <section className="space-y-2"><h2 className="text-[0.95rem] font-bold">같은 분류의 다른 자료</h2><div className="grid gap-2.5 sm:grid-cols-2">{more.map((x) => <LearnCard key={x.id} c={x} href={`/learn/${encodeURIComponent(x.id)}`} />)}</div></section>
            )}
          </>
        )}
    </PublicLearnShell>
  );
}
