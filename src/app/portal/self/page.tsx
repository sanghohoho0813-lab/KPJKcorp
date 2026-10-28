"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Footprints } from "lucide-react";
import { useStore, usePortalCompanyId } from "@/lib/store";
import { profileOfCompany, programsForCompany } from "@/lib/programs";
import { learnCategories, learnForArea, learnForProgram, visibleLearn } from "@/lib/learn";
import { checkProgress, isOpen, nextStep, runHref, statusLabel } from "@/lib/self-run";
import { fmtDate } from "@/lib/format";
import type { LearnContent } from "@/lib/types";
import { useGrowth } from "@/components/domain/portal/GrowthBoard";
import { Icon3D } from "@/components/domain/portal/Icon3D";
import { LearnCard, PathTag } from "@/components/domain/self/SelfParts";
import { usePortalPrograms } from "@/components/domain/self/hooks";
import { Badge, Button, Card, PageHeader, cx } from "@/components/ui/ui";

/**
 * 스스로 준비하기 — 대표님이 직접 알아보고 · 준비하고 · 신청하고 · 결과를 남기는 곳(무료).
 * 직접 준비 중인 지원사업 · 직접 실행 중인 성장과제 · 추천 학습 · 완료한 자기주도 활동 · 전문가 도움(선택).
 * 여기서 끝낸 일도 담당자 프로젝트와 따로, 우리 회사 성장 기록으로 남는다.
 */
export default function SelfHubPage() {
  const st = useStore();
  const router = useRouter();
  const companyId = usePortalCompanyId();
  const c = st.companies.find((x) => x.id === companyId);
  const board = useGrowth(c);
  const { programs } = usePortalPrograms({ all: true });
  const [cat, setCat] = useState<string>("추천");
  const now = useMemo(() => new Date(), []);
  const runs = useMemo(() => st.selfRuns.filter((r) => r.companyId === companyId).sort((a, b) => b.statusAt.localeCompare(a.statusAt)), [st.selfRuns, companyId]);
  const matched = useMemo(() => (c ? programsForCompany(programs.filter((p) => !p.applyEnd || p.applyEnd >= now.toISOString().slice(0, 10)), c.id, profileOfCompany(c), now) : { sent: [], matches: [] }), [c, programs, now]);
  if (!c || !board) return null;

  const progRuns = runs.filter((r) => r.kind === "program");
  const openProg = progRuns.filter(isOpen);
  const openGrowth = board.self;
  const learnedIds = new Set(runs.filter((r) => r.kind === "learn").map((r) => r.targetKey));
  const closed = runs.filter((r) => r.kind !== "learn" && !isOpen(r));
  const started = new Set(progRuns.map((r) => r.targetKey));
  const startable = [...matched.sent, ...matched.matches].filter((m) => !started.has(m.program.id)).slice(0, 3);
  const doable = [...board.proposed, ...board.suggested].slice(0, 4);

  // 추천 학습 — 직접 하는 일 · 검토 과제 · 맞는 공고에 붙는 자료 먼저, 그다음 나머지
  const all = visibleLearn(st.learnContents);
  const rec: LearnContent[] = [];
  const push = (xs: LearnContent[]) => { for (const x of xs) if (!rec.some((y) => y.id === x.id)) rec.push(x); };
  for (const it of [...openGrowth, ...doable]) push(learnForArea(st.learnContents, it.area));
  for (const r of openProg) { const p = programs.find((x) => x.id === r.targetKey); if (p) push(learnForProgram(st.learnContents, p)); }
  for (const m of startable) push(learnForProgram(st.learnContents, m.program));
  push(all);
  const cats = learnCategories(all).filter((k) => all.some((x) => x.category === k));
  const shown = cat === "추천" ? rec.slice(0, 6) : all.filter((x) => x.category === cat);

  return (
    <div className="space-y-5" data-testid="self-hub">
      <PageHeader icon={<Icon3D name="checklist" size="2.4rem" />} title="스스로 준비하기" badge={<PathTag kind="self" />}
        desc="공식 안내와 체크리스트로 직접 준비하고 결과를 남깁니다. 남긴 기록은 우리 회사 성장 이력이 됩니다." />

      <div className="grid grid-cols-4 gap-px overflow-hidden rounded-2xl border border-line bg-line text-center" data-testid="self-counts">
        {([["준비 중 공고", openProg.length], ["실행 중 과제", openGrowth.length], ["학습 완료", learnedIds.size], ["끝낸 활동", closed.length]] as const).map(([k, v]) => (
          <div key={k} className="bg-surface px-1 py-2.5"><div className="tnum text-[1.25rem] font-extrabold">{v}</div><div className="text-[0.7rem] font-semibold leading-tight text-ink-3">{k}</div></div>
        ))}
      </div>

      <section className="space-y-2.5" data-testid="self-programs">
        <h2 className="flex items-center gap-2 text-[1.05rem] font-bold"><Icon3D name="funding" size="1.6rem" /> 직접 준비 중인 지원사업</h2>
        {openProg.length === 0 && <p className="text-[0.86rem] text-ink-2">아직 없습니다. 아래 공고에서 &lsquo;직접 준비하기&rsquo;를 눌러 시작하세요.</p>}
        {openProg.map((r) => {
          const p = programs.find((x) => x.id === r.targetKey);
          const n = nextStep(r, p, now);
          const { done, total } = checkProgress(r);
          return (
            <Link key={r.id} href={runHref(r)} className="pressable card card-hover flex items-center gap-3 p-3.5" data-self-run={r.id}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf6ee] text-[#2f7d4f]"><Footprints size={19} /></span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 font-bold leading-snug">{r.targetTitle}</span>
                <span className="mt-0.5 block text-[0.78rem] text-ink-3">{statusLabel("program", r.status)} · 준비 {done}/{total}{n?.sub ? ` · ${n.sub}` : ""}</span>
              </span>
              <ArrowRight size={16} className="shrink-0 text-ink-3" />
            </Link>
          );
        })}
        {startable.length > 0 && (
          <Card className="p-3.5">
            <div className="mb-2 text-[0.82rem] font-bold text-ink-2">우리 회사에 맞는 공고 — 직접 준비해 볼 수 있어요</div>
            <ul className="divide-y divide-line">
              {startable.map((m) => (
                <li key={m.program.id} className="flex items-center gap-2 py-2.5">
                  <span className="min-w-0 flex-1"><span className="line-clamp-2 text-[0.9rem] font-semibold leading-snug">{m.program.title}</span><span className="text-[0.75rem] text-ink-3">{m.deadline.label} · {m.program.agency}</span></span>
                  <Button size="sm" variant="outline" onClick={() => router.push(`/portal/self/program/${encodeURIComponent(m.program.id)}`)}>직접 준비</Button>
                </li>
              ))}
            </ul>
            <Link href="/portal/programs" className="link-more mt-1 inline-flex min-h-10 items-center">공고 전체 보기 →</Link>
          </Card>
        )}
      </section>

      <section className="space-y-2.5" data-testid="self-growth-list">
        <h2 className="flex items-center gap-2 text-[1.05rem] font-bold"><Icon3D name="growth" size="1.6rem" /> 직접 실행 중인 성장과제</h2>
        {openGrowth.length === 0 && <p className="text-[0.86rem] text-ink-2">아직 없습니다. 아래 과제에서 &lsquo;직접 알아보기&rsquo;를 눌러 시작하세요.</p>}
        {openGrowth.map((it) => (
          <Link key={it.area} href={runHref(it.selfRun!)} className="pressable card card-hover flex items-center gap-3 p-3.5" data-self-run={it.selfRun!.id}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf6ee] text-[#2f7d4f]"><Footprints size={19} /></span>
            <span className="min-w-0 flex-1"><span className="font-bold">{it.area}</span><span className="mt-0.5 block text-[0.78rem] text-ink-3">{it.statusLabel}{it.progress !== undefined ? ` · 준비 ${it.progress}%` : ""}</span></span>
            <ArrowRight size={16} className="shrink-0 text-ink-3" />
          </Link>
        ))}
        {doable.length > 0 && (
          <Card className="p-3.5">
            <div className="mb-2 text-[0.82rem] font-bold text-ink-2">검토해 볼 과제 — 직접 알아보거나 전문가에게 물어볼 수 있어요</div>
            <ul className="divide-y divide-line">
              {doable.map((it) => (
                <li key={it.area} className="flex items-center gap-2 py-2.5" data-doable={it.area}>
                  <span className="min-w-0 flex-1"><span className="text-[0.9rem] font-semibold">{it.area}</span>{it.basis && <span className="block text-[0.75rem] text-ink-3">근거 · {it.basis}</span>}</span>
                  <Button size="sm" variant="outline" onClick={() => router.push(`/portal/self/growth/${encodeURIComponent(it.area)}`)}>직접 알아보기</Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section id="learn" className="scroll-mt-20 space-y-2.5" data-testid="self-learn-list">
        <h2 className="flex items-center gap-2 text-[1.05rem] font-bold"><Icon3D name="idea" size="1.6rem" /> 무료 학습 자료</h2>
        {all.length === 0 ? <p className="text-[0.86rem] text-ink-2">아직 공개된 학습 자료가 없습니다.</p> : (
          <>
            <div className="hide-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="tablist" aria-label="학습 분류">
              {["추천", ...cats].map((k) => (
                <button key={k} type="button" role="tab" aria-selected={cat === k} onClick={() => setCat(k)}
                  className={cx("pressable min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[0.82rem] font-semibold", cat === k ? "border-accent bg-soft text-accent-strong" : "border-line bg-surface text-ink-2")}>{k}</button>
              ))}
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">{shown.map((x) => <LearnCard key={x.id} c={x} href={`/portal/self/learn/${encodeURIComponent(x.id)}`} done={learnedIds.has(x.id)} />)}</div>
          </>
        )}
      </section>

      {closed.length > 0 && (
        <section className="space-y-2.5" data-testid="self-closed">
          <h2 className="flex items-center gap-2 text-[1.05rem] font-bold"><CheckCircle2 size={20} className="text-success" /> 끝낸 자기주도 활동</h2>
          <Card className="divide-y divide-line">
            {closed.map((r) => (
              <Link key={r.id} href={runHref(r)} className="pressable flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                <span className="min-w-0 flex-1"><span className="line-clamp-1 font-semibold">{r.kind === "program" ? r.targetTitle : r.targetKey}</span><span className="text-[0.75rem] text-ink-3">{r.kind === "program" ? "지원사업" : "성장과제"} · {fmtDate(r.statusAt)}</span></span>
                <Badge tone={r.status === "selected" || r.status === "done" ? "success" : r.status === "not_selected" ? "warning" : "neutral"}>{statusLabel(r.kind, r.status)}</Badge>
              </Link>
            ))}
          </Card>
          <p className="text-[0.75rem] text-ink-3">대표님이 직접 기록한 결과입니다. 담당 컨설턴트와 진행한 과제는 &lsquo;진행현황&rsquo;에 따로 있습니다.</p>
        </section>
      )}

      <section className="rounded-2xl border border-dashed border-line-2 px-4 py-4" data-testid="self-expert">
        <div className="flex flex-wrap items-center gap-2"><PathTag kind="expert" /><span className="font-bold">전문가 도움이 필요할 때</span></div>
        <p className="mt-1.5 text-[0.84rem] leading-relaxed text-ink-2">복잡한 재무 · 세무 이슈, 자금 조달 전략, 기업 구조 개선, 특수한 인증 · 기술사업화처럼 판단이 필요한 일은 담당 컨설턴트가 함께 봅니다. 요청은 무료이고, 실제 컨설팅은 견적을 먼저 보내 드린 뒤 대표님이 정합니다(유료).</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Link href="/portal/services" className="pressable inline-flex min-h-11 items-center rounded-xl border border-line px-4 font-semibold hover:border-accent hover:text-accent">함께 검토할 분야 보기</Link>
          <Link href="/portal/inquiries" className="pressable inline-flex min-h-11 items-center rounded-xl border border-line px-4 font-semibold hover:border-accent hover:text-accent">문의하기</Link>
        </div>
      </section>
    </div>
  );
}
