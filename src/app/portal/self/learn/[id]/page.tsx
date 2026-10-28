"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useStore, usePortalCompanyId } from "@/lib/store";
import { isInternal } from "@/lib/permissions";
import { Icon3D } from "@/components/domain/portal/Icon3D";
import { LearnBody, LearnDone, PathTag } from "@/components/domain/self/SelfParts";
import { decodeParam } from "@/components/domain/self/hooks";
import { Card } from "@/components/ui/ui";

/** 학습 자료 한 편 — 고객 화면. 다 보면 고객이 직접 '학습 완료'를 누른다(자동 판정 없음) */
export default function SelfLearnPage() {
  const params = useParams<{ id: string }>();
  const id = decodeParam(params.id);
  const companyId = usePortalCompanyId();
  const role = useStore((s) => s.session?.role);
  const c = useStore((s) => s.learnContents.find((x) => x.id === id));
  // 비공개 자료는 내부 미리보기에서만
  if (!c || (!c.published && !isInternal(role))) {
    return (
      <Card className="p-6 text-center">
        <div className="font-bold">학습 자료를 찾을 수 없습니다</div>
        <Link href="/portal/self#learn" className="mt-3 inline-flex min-h-10 items-center font-semibold text-accent">학습 자료 목록으로 →</Link>
      </Card>
    );
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="self-learn-page">
      <Link href="/portal/self#learn" className="pressable inline-flex min-h-10 items-center gap-1 text-[0.85rem] font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={15} /> 스스로 준비하기</Link>
      <header className="flex items-start gap-3">
        <Icon3D name="checklist" size="2.6rem" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5"><PathTag kind="self" /><span className="text-[0.78rem] font-semibold text-ink-3">{c.category}</span>{!c.published && <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[0.72rem] font-bold text-warning">비공개(미리보기)</span>}</div>
          <h1 className="mt-1.5 text-[1.3rem] font-extrabold leading-snug md:text-[1.5rem]">{c.title}</h1>
        </div>
      </header>
      <Card className="p-4 md:p-6"><LearnBody c={c} /></Card>
      <LearnDone c={c} companyId={companyId} />
    </div>
  );
}
