"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useState } from "react";
import { ArrowRight, Check, ChevronDown, Compass, Play, Ruler, TrendingUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/hooks";
import { buildSprint, coachLine, coverageOf, WHY_EVIDENCE, type EvidenceArea, type SprintState } from "@/lib/evidence";
import { Badge, Button, Card, Progress, cx } from "@/components/ui/ui";

/** 화면 여러 곳에서 같은 실증 상태를 쓰기 위한 단일 계산 지점. */
export function useSprint(): SprintState {
  const st = useStore();
  const tick = useNow(60000);
  const now = useMemo(() => tick ?? new Date(), [tick]);
  return useMemo(
    () =>
      buildSprint({
        now,
        startedAt: st.settings.sprintStartedAt,
        activities: st.activities,
        companies: st.companies,
        projects: st.projects,
        consultations: st.consultations,
        contracts: st.contracts,
        docRequests: st.docRequests,
        tasks: st.tasks,
        opportunities: st.opportunities,
        quotes: st.quotes,
        approvals: st.approvals,
        surveys: st.surveys,
      }),
    [now, st.settings.sprintStartedAt, st.activities, st.companies, st.projects, st.consultations, st.contracts, st.docRequests, st.tasks, st.opportunities, st.quotes, st.approvals, st.surveys],
  );
}

export function AreaBar({ a, className }: { a: EvidenceArea; className?: string }) {
  const pct = coverageOf(a);
  const tone = pct >= 100 ? "success" : pct >= 40 ? "warning" : "error";
  return (
    <div className={className}>
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[0.85rem] font-semibold">{a.label}</span>
        <span className={cx("tnum text-[0.8rem] font-bold", tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-error")}>
          {a.count}
          <span className="font-normal text-ink-3"> / {a.target}</span>
        </span>
      </div>
      <div className="progress mt-1.5" style={{ height: 6 }}>
        <span style={{ width: `${pct}%`, background: pct >= 100 ? "var(--sem-success)" : pct >= 40 ? "var(--sem-warning)" : "var(--sem-error)" }} />
      </div>
    </div>
  );
}

/** 자금조달·투자 관점에서 이 기록이 왜 필요한지. 코치 카드와 코치 화면이 같은 말을 한다. */
export function WhyEvidence({ variant = "full" }: { variant?: "full" | "inline" }) {
  // 모바일에서는 핵심 문장만 두고 근거 4개는 접어 둔다. 데스크톱은 그대로 펼친다.
  const [openMobile, setOpenMobile] = useState(false);
  return (
    <div className={variant === "inline" ? "text-[0.85rem]" : ""}>
      <div className="flex items-start gap-2">
        <TrendingUp size={16} className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0">
          <div className="font-bold">{WHY_EVIDENCE.headline}</div>
          <p className="mt-1 leading-relaxed text-ink-2">{WHY_EVIDENCE.lead}</p>
        </div>
      </div>
      <div className={cx("mt-3 gap-2", variant === "full" && "md:grid-cols-2", openMobile ? "grid" : "hidden md:grid")}>
        {WHY_EVIDENCE.points.map((p) => (
          <div key={p.title} className="rounded-xl bg-surface-2 px-4 py-3">
            <div className="text-[0.85rem] font-bold">{p.title}</div>
            <p className="mt-0.5 text-[0.82rem] leading-relaxed text-ink-2">{p.body}</p>
          </div>
        ))}
      </div>
      <button
        onClick={() => setOpenMobile((v) => !v)}
        aria-expanded={openMobile}
        className="pressable mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-line bg-surface px-4 py-2 text-[0.82rem] font-semibold text-ink-2 hover:bg-surface-2 md:hidden"
      >
        {openMobile ? "근거 접기" : `왜 그런지 근거 ${WHY_EVIDENCE.points.length}가지 보기`}
        <ChevronDown size={14} className={cx("transition-transform", openMobile && "rotate-180")} />
      </button>
    </div>
  );
}

/**
 * 대시보드 최상단 코치 카드.
 * 질문을 기다리지 않고 먼저 "오늘 이것부터 하세요"라고 말한다.
 */
function WhyToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="mt-4 border-t border-line pt-3">
      <button onClick={onToggle} aria-expanded={open} className="pressable flex w-full items-center gap-2 rounded-lg py-1 text-left text-[0.85rem] font-semibold text-ink-2 hover:text-ink">
        <TrendingUp size={15} className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1">왜 이게 이 시스템의 핵심인가요?</span>
        <ChevronDown size={15} className={cx("shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="anim-fade mt-3"><WhyEvidence /></div>}
    </div>
  );
}

/**
 * 도입 전 기준선 알림.
 *
 * 이 조사는 딱 한 번 하는 일이라, 메뉴에 두면 아무도 찾지 않는다.
 * 대표가 매일 처음 보는 자리(대시보드 코치 카드)에 놓고, 끝나면 사라지게 한다.
 * 기록을 시작하기 전에 해야 의미가 있다 — 며칠 쓴 뒤의 기억은 이미 새 시스템에 물든다.
 */
function BaselineNudge() {
  const role = useStore((st) => st.session?.role);
  const baseline = useStore((st) => st.settings.baseline);
  const surveys = useStore((st) => st.settings.baselineSurveys);
  if (role !== "admin") return null;
  const done = !!(surveys ?? []).find((x) => x.phase === "before" && !x.draft);
  // 예전 방식으로 숫자만 넣어 둔 경우도 "기록됨"으로 본다 — 다시 시키지 않는다.
  const legacy = baseline && Object.values(baseline).some((v) => typeof v === "number");
  if (done || legacy) return null;
  const draft = (surveys ?? []).find((x) => x.phase === "before" && x.draft);

  return (
    <Link
      href="/ax/baseline"
      className="pressable flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-warning/30 bg-warning-bg/60 px-5 py-3 text-[0.85rem] text-warning hover:bg-warning-bg"
    >
      <Ruler size={16} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <b>도입 전 기준선이 아직 없습니다.</b>
        <span className="ml-1 font-normal">
          {draft
            ? "작성하시던 내용이 남아 있습니다. 이어서 마치면 도입 전후 비교가 열립니다."
            : "지금 기록해 두어야 나중에 무엇이 달라졌는지 말할 수 있습니다. 대부분 클릭으로 3~5분."}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 font-bold">{draft ? "이어서 작성" : "조사 시작"} <ArrowRight size={14} /></span>
    </Link>
  );
}

export function CoachCard() {
  const s = useSprint();
  const start = useStore((st) => st.startSprint);
  const toast = useStore((st) => st.toast);
  const [why, setWhy] = useState(false);

  if (!s.active) {
    return (
      <Card className="coach-box coach-glow anim-rise overflow-hidden p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="hover-pop flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink"><Compass size={20} /></span>
            <div className="min-w-0">
              <h2 className="text-[1.1rem] font-bold">AX 실증 14일을 시작할까요?</h2>
              <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-2">
                하루 1~3개 미션으로 실제 업무를 시스템 안에서 처리합니다. 별도 입력 없이, 그 행동이 그대로 실증 기록이 됩니다.
              </p>
            </div>
          </div>
          <Button variant="accent" icon={<Play size={16} />} className="shrink-0" onClick={() => { start(); toast("AX 실증 14일을 시작했습니다. 오늘의 미션부터 확인하세요."); }}>
            실증 시작
          </Button>
        </div>
        <WhyToggle open={why} onToggle={() => setWhy((v) => !v)} />
        <div className="-mx-5 -mb-5 mt-4"><BaselineNudge /></div>
      </Card>
    );
  }

  const pct = Math.round((s.doneCount / s.missions.length) * 100);
  return (
    <Card className="coach-box coach-glow overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-5 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-ink"><Compass size={17} /></span>
        <span className="font-bold">오늘의 AX 코치</span>
        {s.finished ? <Badge tone="success">14일 완료</Badge> : <Badge tone="accent">Day {s.day} / {s.totalDays}</Badge>}
        <span className="tnum ml-auto text-[0.82rem] text-ink-3">미션 {s.doneCount} / {s.missions.length}</span>
        <Link href="/ax/coach" className="whitespace-nowrap text-[0.85rem] font-semibold text-ink-2 hover:text-ink">전체 보기 →</Link>
      </div>

      <div className="px-5 pt-3">
        <Progress value={pct} height={6} />
        <p className="mt-2.5 text-[0.9rem] font-semibold">{coachLine(s)}</p>
      </div>

      <div className="p-5 pt-3">
        {s.today.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-success-bg px-4 py-3 text-[0.9rem] font-semibold text-success">
            <Check size={18} /> 예정된 미션을 모두 처리했습니다.
          </div>
        ) : (
          <div className="stagger grid gap-2 md:grid-cols-3">
            {/* 모바일은 "한 화면 = 한 가지 판단" — 첫 미션만 크게, 나머지는 코치 화면에서 */}
            {s.today.map((m, i) => (
              <Link key={m.key} href={m.href} className={cx("card card-hover group flex flex-col gap-2 p-4", i > 0 && "hidden md:flex")}>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[0.7rem] font-bold text-ink-3">Day {m.day}</span>
                  <span className="text-[0.72rem] font-semibold text-ink-3">{m.progress}</span>
                </div>
                <div className="text-[0.95rem] font-bold leading-snug">{m.title}</div>
                <div className="text-[0.8rem] leading-relaxed text-ink-2">{m.why}</div>
                <span className="mt-auto flex items-center gap-1 pt-1 text-[0.82rem] font-semibold text-accent">{m.cta} <ArrowRight size={13} className="arrow-slide" /></span>
              </Link>
            ))}
          </div>
        )}
        {s.today.length > 1 && (
          <Link href="/ax/coach" className="pressable mt-2 flex items-center justify-center gap-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-[0.85rem] font-semibold text-ink-2 hover:bg-surface-2 md:hidden">
            오늘의 미션 {s.today.length - 1}개 더 보기 <ArrowRight size={14} className="arrow-slide" />
          </Link>
        )}
        <WhyToggle open={why} onToggle={() => setWhy((v) => !v)} />
      </div>
      <BaselineNudge />
    </Card>
  );
}
