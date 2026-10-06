"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Cable, CheckCircle2, Sparkles, TrendingDown } from "lucide-react";
import { Modal } from "@/components/ui/overlay";
import { cx } from "@/components/ui/ui";
import { INSIGHTS, type InsightTopic } from "@/lib/ax-insight";

/**
 * "AI · 자동화 적용" — 화면마다 같은 모양의 작은 버튼.
 * 누르면 이 업무 기준으로 현재(작동 중) → 다음 단계(AI READY) → API 확장(연결 예정) → 기대효과.
 * 작동 중인 것과 아직 아닌 것을 색·표시로 분명히 나눈다 — 없는 기능을 작동하는 것처럼 보이게 하지 않는다.
 */
export function AxInsightButton({ topic, className, compact }: { topic: InsightTopic; className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={`ax-insight-${topic}`}
        aria-label="AI · 자동화 적용 보기"
        title="이 화면에서 작동 중인 자동화와 AI·API 고도화 방향"
        className={cx(
          "pressable inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[color:var(--nav-ai-ink)]/25 bg-[color:var(--nav-ai)]/10 px-2.5 py-1.5 text-[0.8rem] font-bold text-[color:var(--nav-ai-ink)] hover:bg-[color:var(--nav-ai)]/20",
          className,
        )}
      >
        <Sparkles size={14} />
        <span className={cx(compact && "hidden sm:inline")}>AI · 자동화 적용</span>
      </button>
      <AxInsightModal topic={topic} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function AxInsightModal({ topic, open, onClose }: { topic: InsightTopic; open: boolean; onClose: () => void }) {
  const it = INSIGHTS[topic];
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={<span className="flex items-center gap-2"><Sparkles size={18} className="text-[color:var(--nav-ai-ink)]" /> {it.title} — AI · 자동화 적용</span>}
      footer={
        <Link href="/ax/roadmap" onClick={onClose} className="pressable inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[0.85rem] font-bold text-ink-2 hover:bg-surface-2">
          AI · API 기술 로드맵 전체 보기 <ArrowRight size={15} />
        </Link>
      }
    >
      <div className="space-y-4 text-[0.92rem]" data-testid="ax-insight-modal">
        <p className="text-ink-2">{it.scope}</p>
        <Stage tone="now" icon={<CheckCircle2 size={16} />} label="현재" tag="작동 중" sub="지금 이 화면의 데이터로 실제 계산·생성되는 것" items={it.now} />
        <Stage tone="next" icon={<Sparkles size={16} />} label="다음 단계" tag="AI READY · LLM 연결 전" sub="LLM을 연결하면 요약·분석·초안으로 확장할 것 — 아직 작동하지 않습니다" items={it.next} />
        <Stage tone="api" icon={<Cable size={16} />} label="API 확장" tag="연결 예정" sub="연결할 수 있는 외부 서비스 — 아직 연결되지 않았습니다" items={it.api} />
        <div className="rounded-xl border border-line bg-surface-2/60 px-4 py-3">
          <div className="mb-1.5 flex items-center gap-1.5 font-bold"><TrendingDown size={16} className="text-success" /> 기대효과</div>
          <div className="flex flex-wrap gap-1.5">
            {it.effects.map((e) => <span key={e} className="rounded-full border border-line bg-surface px-2.5 py-1 text-[0.82rem] font-semibold text-ink-2">{e}</span>)}
          </div>
          <p className="mt-2 text-[0.75rem] text-ink-3">효과는 방향입니다. 실제 수치는 운영 데이터(리포트 · 실증)로 측정해 말합니다. 자격·자금·법률 판단은 자동으로 확정하지 않습니다.</p>
        </div>
      </div>
    </Modal>
  );
}

function Stage({ tone, icon, label, tag, sub, items }: { tone: "now" | "next" | "api"; icon: React.ReactNode; label: string; tag: string; sub: string; items: string[] }) {
  const c = tone === "now"
    ? { box: "border-success/30 bg-success-bg/40", tag: "bg-success text-white", ic: "text-success", dot: "bg-success" }
    : tone === "next"
      ? { box: "border-[color:var(--nav-ai-ink)]/25 bg-[color:var(--nav-ai)]/[0.07]", tag: "border border-[color:var(--nav-ai-ink)]/40 text-[color:var(--nav-ai-ink)]", ic: "text-[color:var(--nav-ai-ink)]", dot: "bg-[color:var(--nav-ai-ink)]" }
      : { box: "border-dashed border-line-2 bg-surface", tag: "border border-dashed border-line-2 text-ink-3", ic: "text-ink-3", dot: "bg-ink-3" };
  return (
    <div className={cx("rounded-xl border px-4 py-3", c.box)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cx("flex items-center gap-1.5 font-bold", c.ic)}>{icon}<span className="text-ink">{label}</span></span>
        <span className={cx("rounded-md px-1.5 py-0.5 text-[0.68rem] font-bold tracking-wide", c.tag)}>{tag}</span>
      </div>
      <div className="mt-0.5 text-[0.75rem] text-ink-3">{sub}</div>
      <ul className="mt-2 space-y-1.5">
        {items.map((x) => (
          <li key={x} className="flex gap-2 text-ink-2"><span className={cx("mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full", c.dot)} /><span>{x}</span></li>
        ))}
      </ul>
    </div>
  );
}
