"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Compass, Play, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import { coachLine, coverageOf } from "@/lib/evidence";
import { fmtDate } from "@/lib/format";
import { AreaBar, WhyEvidence, useSprint } from "@/components/domain/Coach";
import { BaselineCard, RecallCompareCard } from "@/components/domain/BaselineCard";
import { Badge, Button, Card, MoreButton, PageHeader, Progress, SectionTitle, cx } from "@/components/ui/ui";
import { Confirm } from "@/components/ui/overlay";

export default function CoachPage() {
  const s = useSprint();
  const start = useStore((st) => st.startSprint);
  const reset = useStore((st) => st.resetSprint);
  const toast = useStore((st) => st.toast);
  const [confirmReset, setConfirmReset] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [allDone, setAllDone] = useState(false);

  const pct = Math.round((s.doneCount / s.missions.length) * 100);
  const openMissions = s.missions.filter((m) => !m.done);
  const doneMissions = s.missions.filter((m) => m.done);

  return (
    <div className="space-y-5">
      <PageHeader
        title={<span className="flex items-center gap-2"><Compass size={24} className="text-accent" /> AX 코치</span>}
        desc="설명을 읽는 화면이 아닙니다. 오늘 처리할 것을 순서대로 제안하고, 그 행동이 그대로 실증 기록이 됩니다."
        badge={!s.active ? <Badge>시작 전</Badge> : s.finished ? <Badge tone="success">14일 완료</Badge> : <Badge tone="accent">Day {s.day} / {s.totalDays}</Badge>}
        actions={
          s.active
            ? <Button variant="ghost" icon={<RotateCcw size={15} />} onClick={() => setConfirmReset(true)}>실증 초기화</Button>
            : <Button variant="accent" icon={<Play size={16} />} onClick={() => { start(); toast("AX 실증 14일을 시작했습니다."); }}>실증 시작</Button>
        }
      />

      {/* 이 화면에서 가장 먼저 읽혀야 하는 것 — 왜 이걸 하는가 */}
      <Card className="coach-box p-5">
        <WhyEvidence />
      </Card>

      {!s.active && (
        <Card className="p-5">
          <h2 className="text-[1.05rem] font-bold">실증 모드는 무엇을 합니까?</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[0.9rem] leading-relaxed text-ink-2">
            <li>14일 동안 하루 1~3개 미션을 제안합니다. 전부 실제 업무입니다.</li>
            <li>미션은 버튼을 눌렀는지가 아니라, <b className="text-ink">그 행동의 기록(Event)이 남았는지</b>로 완료됩니다.</li>
            <li>쌓인 기록은 리포트의 실증 화면과 Evidence Log로 그대로 이어집니다.</li>
            <li>없는 데이터를 만들지 않습니다. 부족하면 부족하다고 표시합니다.</li>
          </ol>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle action={<span className="tnum text-[0.85rem] text-ink-3">{s.doneCount} / {s.missions.length}</span>}>
              실증 진행률
            </SectionTitle>
            <Progress value={pct} height={10} />
            <p className="mt-2.5 text-[0.9rem] font-semibold">{coachLine(s)}</p>
            {s.startedAt && (
              <p className="mt-1 text-[0.8rem] text-ink-3">
                {fmtDate(s.startedAt, { year: true })} 시작 · {s.finished ? `${s.elapsedDays}일 경과 (14일 기간 종료)` : `측정 ${s.day}일차`}
              </p>
            )}
            {s.finished && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-success-bg px-4 py-3 text-[0.85rem] text-success">
                <Check size={16} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  14일 기간이 끝났습니다. 기록은 계속 쌓이며, 지금 내보내면 &ldquo;{fmtDate(s.startedAt!)}부터 14일&rdquo; 구간의 실측 자료가 됩니다.
                </span>
                <Link href="/ax/reports" className="pressable shrink-0 rounded-lg bg-success px-3 py-1.5 text-[0.82rem] font-semibold text-white">리포트 열기</Link>
              </div>
            )}
          </Card>

          <BaselineCard />
          <RecallCompareCard />

          {openMissions.length > 0 && (
            <Card className="p-5">
              <SectionTitle action={<Badge tone="accent">{openMissions.length}</Badge>}>남은 미션</SectionTitle>
              <div className="space-y-2">
                {(allOpen ? openMissions : openMissions.slice(0, 4)).map((m) => (
                  <Link key={m.key} href={m.href} className="card card-hover flex items-center gap-3 p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[0.72rem] font-bold text-ink-3">D{m.day}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{m.title}</div>
                      <div className="mt-0.5 text-[0.82rem] leading-relaxed text-ink-2">{m.why}</div>
                      <div className="mt-0.5 text-[0.78rem] text-ink-3">현재 {m.progress}</div>
                    </div>
                    <span className="hidden shrink-0 items-center gap-1 text-[0.82rem] font-semibold text-accent sm:flex">{m.cta} <ArrowRight size={13} className="arrow-slide" /></span>
                  </Link>
                ))}
                <MoreButton hidden={allOpen ? openMissions.length - 4 : openMissions.length - 4} open={allOpen} onToggle={() => setAllOpen((v) => !v)} />
              </div>
            </Card>
          )}

          {doneMissions.length > 0 && (
            <Card className="p-5">
              <SectionTitle action={<Badge tone="success">{doneMissions.length}</Badge>}>완료</SectionTitle>
              <div className="divide-y divide-line">
                {(allDone ? doneMissions : doneMissions.slice(0, 5)).map((m) => (
                  <div key={m.key} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-success text-white"><Check size={14} /></span>
                    <span className="min-w-0 flex-1 truncate text-[0.9rem] font-semibold">{m.title}</span>
                    <span className="shrink-0 text-[0.78rem] text-ink-3">{m.progress}</span>
                  </div>
                ))}
              </div>
              <MoreButton hidden={doneMissions.length - 5} open={allDone} onToggle={() => setAllDone((v) => !v)} />
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle action={<Link href="/ax/reports" className="link-more">리포트 →</Link>}>
              Evidence 상태
            </SectionTitle>
            <div className="mb-4 flex items-baseline gap-2">
              <span className="tnum text-[2rem] font-bold leading-none text-accent">{s.score}</span>
              <span className="text-[0.85rem] text-ink-2">/ 100 · 6개 영역 평균</span>
            </div>
            <div className="space-y-3">
              {s.areas.map((a) => <AreaBar key={a.key} a={a} />)}
            </div>
            <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-3">
              전부 Event Log에서 센 실제 건수입니다. 목표치는 14일 실증 기준이며, 성과나 개선율이 아닙니다.
            </p>
          </Card>

          {s.weakest && coverageOf(s.weakest) < 100 && (
            <Card className="border-accent/40 p-5">
              <SectionTitle>지금 가장 부족한 것</SectionTitle>
              <div className="text-[1.05rem] font-bold">{s.weakest.label}</div>
              <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-2">{s.weakest.why}</p>
              <div className={cx("mt-3 rounded-xl bg-surface-2 px-4 py-3 text-[0.85rem]")}>
                <b className="text-ink">채우는 방법</b><br />{s.weakest.how}
              </div>
              <Link href={s.weakest.href} className="link-more link-accent mt-2">
                해당 화면으로 <ArrowRight size={14} className="arrow-slide" />
              </Link>
            </Card>
          )}
        </div>
      </div>

      <Confirm
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { reset(); toast("실증 기간을 초기화했습니다. 기록된 Event는 그대로 남습니다."); }}
        title="실증 기간을 초기화할까요?"
        desc="시작일만 지워집니다. 이미 기록된 Event와 업무 데이터는 삭제되지 않습니다."
        confirmText="초기화"
      />
    </div>
  );
}
