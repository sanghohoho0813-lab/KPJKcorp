"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight, Megaphone } from "lucide-react";
import { useStore } from "@/lib/store";
import { profileOfCompany, programsForCompany } from "@/lib/programs";
import { openOnly } from "@/lib/programs-client";
import type { Company } from "@/lib/types";
import { Card } from "@/components/ui/ui";

/** 고객 홈 한 줄 — 맞는 공고가 있을 때만 */
export function ProgramTeaser({ company }: { company: Company }) {
  const programs = useStore((s) => s.programs);
  const { sent, matches } = useMemo(() => programsForCompany(openOnly(programs), company.id, profileOfCompany(company)), [programs, company]);
  const ms = [...sent, ...matches];
  if (!ms.length) return null;
  const urgent = ms.filter((m) => m.deadline.urgent).length;
  return (
    <Link href="/portal/programs" className="block" data-testid="program-teaser">
      <Card className="flex items-center gap-3 p-4 hover:border-accent">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-soft text-accent"><Megaphone size={19} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">우리 회사에 맞는 지원사업 {ms.length}건{urgent ? <span className="ml-1.5 text-[0.85rem] text-error">마감 임박 {urgent}</span> : null}</span>
          <span className="block truncate text-[0.82rem] text-ink-2">{sent.length ? <b className="mr-1 text-accent">담당자 추천 {sent.length}건</b> : null}{ms[0].program.title}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-ink-3" />
      </Card>
    </Link>
  );
}
