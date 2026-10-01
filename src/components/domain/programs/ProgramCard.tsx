"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Check, ExternalLink } from "lucide-react";
import type { ProgramMatch } from "@/lib/programs";
import { CATEGORY_LABEL } from "@/lib/programs";
import { Badge, cx } from "@/components/ui/ui";

/** 공고 한 건 — 왜 맞는지(근거)와 확인할 점을 함께 */
export function ProgramCard({ m, actions, extra, compact }: { m: ProgramMatch; actions?: ReactNode; extra?: ReactNode; compact?: boolean }) {
  const p = m.program;
  return (
    <div className={cx("rounded-xl border p-4", m.deadline.urgent ? "border-error/40" : "border-line")} data-program={p.id}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={m.deadline.urgent ? "error" : "neutral"}>{m.deadline.label}</Badge>
        <Badge>{CATEGORY_LABEL[p.category]}</Badge>
        {p.regions.length > 0 && <Badge tone="info">{p.regions.join("·")}</Badge>}
        {p.source === "manual" && <span className="text-[0.72rem] text-ink-3">담당자 등록</span>}
      </div>
      <div className="mt-1.5 font-bold leading-snug">{p.title}</div>
      <div className="mt-0.5 text-[0.8rem] text-ink-3">{[p.agency, p.operator].filter(Boolean).join(" · ")}{p.applyEnd ? ` · 접수 ~${p.applyEnd.slice(5).replace("-", "/")}` : ""}</div>
      {!compact && p.target && <div className="mt-1 line-clamp-2 text-[0.82rem] text-ink-2">대상: {p.target}</div>}
      {m.reasons.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {m.reasons.map((r) => <span key={r} className="inline-flex items-center gap-1 rounded-md bg-success-bg px-2 py-0.5 text-[0.74rem] font-semibold text-success"><Check size={12} />{r}</span>)}
        </div>
      )}
      {m.cautions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {m.cautions.map((r) => <span key={r} className="inline-flex items-center gap-1 rounded-md bg-warning-bg px-2 py-0.5 text-[0.74rem] font-semibold text-warning"><AlertTriangle size={12} />{r}</span>)}
        </div>
      )}
      {extra}
      {(p.url || actions) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="pressable inline-flex min-h-9 items-center gap-1 rounded-lg border border-line-2 px-3 text-[0.82rem] font-semibold text-ink-2 hover:border-accent hover:text-accent">공고문 보기 <ExternalLink size={13} /></a>}
          {actions}
        </div>
      )}
    </div>
  );
}

export const MATCH_NOTE = "회사 기본 조건(지역·업종·업력·인원·관심 분야)과 공고 내용을 맞춰 본 결과입니다. 신청 자격과 선정 여부를 판단한 것이 아니며, 세부 조건은 공고문과 담당 컨설턴트가 함께 확인합니다.";
