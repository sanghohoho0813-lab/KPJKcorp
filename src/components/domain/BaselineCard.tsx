"use client";

import Link from "next/link";
import { ArrowRight, Pencil, Ruler } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/hooks";
import type { Baseline, BaselinePhase, BaselineSurveyResponse } from "@/lib/types";
import { daysBetween, fmtDate } from "@/lib/format";
import { FOLLOWUP_DUE_DAY, PHASE_LABEL, RECALL_METRICS, recallValue } from "@/lib/baseline-survey";
import { Badge, Button, Card, SectionTitle, cx } from "@/components/ui/ui";

interface Metric {
  key: keyof Baseline;
  label: string;
  unit: string;
  /** 낮을수록 좋은 지표인가 */
  lowerIsBetter: boolean;
  hint: string;
  /** 시스템이 셀 수 없어 재조사로만 비교되는 항목 — 여기서는 "수집 중"이 아니라 그렇게 말해야 한다 */
  recallOnly?: boolean;
}

const METRICS: Metric[] = [
  { key: "docLeadDays", label: "자료요청 → 제출 소요", unit: "일", lowerIsBetter: true, hint: "요청하고 실제로 받기까지 보통 며칠 걸렸습니까?" },
  { key: "missedFollowupsPerWeek", label: "주간 후속 누락", unit: "건", lowerIsBetter: true, hint: "연락·자료 독촉을 놓치는 일이 주에 몇 번 정도였습니까?" },
  { key: "inquiryResponseHours", label: "고객 문의 대응", unit: "시간", lowerIsBetter: true, hint: "문의를 받고 답하기까지 보통 몇 시간 걸렸습니까?" },
  { key: "consultationsPerMonth", label: "월 상담 기록", unit: "건", lowerIsBetter: false, hint: "상담 내용을 실제로 기록해 둔 건수입니다. 기억에만 있던 것은 제외합니다." },
  { key: "clientsPerConsultant", label: "1인당 관리 기업", unit: "개사", lowerIsBetter: false, hint: "담당자 한 명이 동시에 챙기던 기업 수입니다." },
  { key: "ceoHandledPct", label: "대표가 직접 챙긴 비중", unit: "%", lowerIsBetter: true, recallOnly: true, hint: "실무 중 대표가 직접 기억하고 챙겨야 했던 비율입니다." },
  { key: "progressInquiryPerWeek", label: "단순 진행상황 문의", unit: "건/주", lowerIsBetter: true, hint: "\u201c어디까지 됐나요\u201d 류의 문의입니다. 고객이 Portal에서 직접 확인하면 줄어듭니다." },
];

/** 실측(After) 값 — 시스템이 계산할 수 있는 것만 채운다. */
export function useAfterValues() {
  const st = useStore();
  // 렌더 중 new Date()를 쓰면 서버/클라이언트 값이 갈려 기한 초과 건수가 어긋난다.
  const tick = useNow(60000);
  const now = (tick ?? new Date(0)).toISOString();

  const submitted = st.docRequests.filter((d) => d.submittedAt && d.requestedAt);
  const lead = submitted.map((d) => daysBetween(d.requestedAt, d.submittedAt!));
  const docLeadDays = lead.length ? +(lead.reduce((a, b) => a + b, 0) / lead.length).toFixed(1) : undefined;

  // 하이드레이션 전(tick === null)에는 기한 비교 자체를 하지 않는다.
  // 0으로 두면 "누락 0건"이 잠깐 보였다가 튀므로, 그동안은 "수집 중"으로 남긴다.
  const overdue = !tick
    ? undefined
    : st.docRequests.filter((d) => (d.status === "requested" || d.status === "revision") && daysBetween(d.dueDate, now) > 0).length +
      st.tasks.filter((t) => (t.status === "todo" || t.status === "doing") && daysBetween(t.dueDate, now) > 0).length;

  const answered = st.inquiries.filter((i) => i.status !== "open" && i.messages.length >= 2);
  const hrs = answered.map((i) => (new Date(i.messages[1].createdAt).getTime() - new Date(i.messages[0].createdAt).getTime()) / 3600000);
  const inquiryResponseHours = hrs.length ? +(hrs.reduce((a, b) => a + b, 0) / hrs.length).toFixed(1) : undefined;

  // "어디까지 됐나요" 류 문의 — 최근 7일치를 그대로 센다. 주당 건수라 환산이 필요 없다.
  const weekAgo = tick ? new Date(tick.getTime() - 7 * 86400000).toISOString() : undefined;
  const progressInquiryPerWeek = weekAgo
    ? st.inquiries.filter((i) => i.category === "진행상황" && i.createdAt >= weekAgo).length
    : undefined;

  const consultants = st.users.filter((u) => u.role === "consultant");
  const perC = consultants.map((u) => st.companies.filter((c) => c.consultantId === u.id).length);
  const clientsPerConsultant = perC.length ? +(perC.reduce((a, b) => a + b, 0) / perC.length).toFixed(1) : undefined;

  return {
    docLeadDays,
    missedFollowupsPerWeek: overdue,
    inquiryResponseHours,
    consultationsPerMonth: st.consultations.length,
    clientsPerConsultant,
    // 대표가 직접 챙긴 비중은 시스템이 셀 수 없는 값이라 비워 둔다.
    ceoHandledPct: undefined as number | undefined,
    progressInquiryPerWeek,
    sample: { docs: submitted.length, inquiries: answered.length },
  };
}

function Delta({ before, after, lowerIsBetter, unit, recallOnly }: { before?: number; after?: number; lowerIsBetter: boolean; unit: string; recallOnly?: boolean }) {
  if (before === undefined || after === undefined) {
    // 시스템이 영원히 셀 수 없는 항목을 "수집 중"이라고 두면 기다리면 채워지는 것처럼 읽힌다.
    const why = before === undefined ? "기준선 미입력" : recallOnly ? "재조사에서 비교" : "수집 중";
    return <span className="text-[0.8rem] text-ink-3">{why}</span>;
  }
  const diff = after - before;
  if (Math.abs(diff) < 0.05) return <Badge>변화 없음</Badge>;
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  return (
    <Badge tone={better ? "success" : "warning"}>
      {diff > 0 ? "+" : ""}
      {Math.abs(diff) % 1 === 0 ? diff : diff.toFixed(1)}
      {unit}
    </Badge>
  );
}

/**
 * 도입 전(대표 입력) ↔ 도입 후(시스템 실측) 비교.
 * Before를 시스템이 만들어낼 방법은 없으므로 직접 입력받고, 그 사실을 화면에 명시한다.
 */
export function BaselineCard({ compact }: { compact?: boolean }) {
  const st = useStore();
  const isAdmin = st.session?.role === "admin";
  const base = st.settings.baseline;
  const after = useAfterValues();
  const survey = (st.settings.baselineSurveys ?? []).find((x) => x.phase === "before" && !x.draft);
  const draft = (st.settings.baselineSurveys ?? []).find((x) => x.phase === "before" && x.draft);

  const recorded = METRICS.filter((m) => base?.[m.key] !== undefined).length;

  return (
    <Card className={cx(compact ? "p-4" : "p-5")}>
      <SectionTitle
        action={
          isAdmin ? (
            <Link href="/ax/baseline">
              <Button size="sm" variant={recorded ? "ghost" : "accent"} icon={<Pencil size={14} />}>
                {recorded ? "조사 보기" : draft ? "이어서 작성" : "기준선 조사"}
              </Button>
            </Link>
          ) : (
            <Badge>{recorded ? "기록됨" : "미입력"}</Badge>
          )
        }
      >
        <span className="flex items-center gap-2"><Ruler size={18} className="text-accent" /> 도입 전후 비교</span>
      </SectionTitle>

      {recorded === 0 ? (
        <div className="rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-[0.88rem] text-warning">
          <b>도입 전 기준선이 아직 없습니다.</b>
          <p className="mt-1 font-normal leading-relaxed">
            쌓이는 기록만으로는 &ldquo;무엇이 달라졌는가&rdquo;를 말할 수 없습니다. 도입 전 값은 시스템이 만들어낼 수 없으므로
            대표님이 직접 한 번 기록해 주셔야 합니다. {draft ? "작성하시던 내용이 남아 있습니다." : "대부분 클릭으로 3~5분이면 됩니다."}
          </p>
          {isAdmin && (
            <Link href="/ax/baseline" className="link-more link-accent pressable mt-1 font-bold underline">
              {draft ? "이어서 작성하기" : "지금 조사 시작하기"} <ArrowRight size={14} />
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="divide-y divide-line">
            {METRICS.map((m) => {
              const b = base?.[m.key] as number | undefined;
              const a = after[m.key as keyof typeof after] as number | undefined;
              const bs = b !== undefined ? `${b}${m.unit}` : "-";
              const as = a !== undefined ? `${a}${m.unit}` : "-";
              return (
                <div key={m.key} className="py-2.5">
                  {/* 폰: 항목 이름이 한 줄을 갖는다. 값 3개와 한 줄에 두면 이름 칸이 110px 까지 눌려 세 줄로 찢어졌다. */}
                  <div className="flex items-start gap-2 lg:hidden">
                    <span className="min-w-0 flex-1 text-[0.88rem] font-semibold">{m.label}</span>
                    <span className="shrink-0"><Delta before={b} after={a} lowerIsBetter={m.lowerIsBetter} unit={m.unit} recallOnly={m.recallOnly} /></span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[0.82rem] text-ink-2 lg:hidden">
                    <span className="whitespace-nowrap"><span className="text-ink-3">도입 전</span> <b className="tnum text-ink">{bs}</b></span>
                    <ArrowRight size={12} className="shrink-0 text-ink-3" />
                    <span className="whitespace-nowrap"><span className="text-ink-3">실측</span> <b className="tnum text-ink">{as}</b></span>
                  </div>
                  <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 lg:flex">
                    <span className="min-w-0 flex-1 text-[0.88rem] font-semibold">{m.label}</span>
                    <span className="tnum shrink-0 text-[0.85rem] text-ink-3">{bs}</span>
                    <ArrowRight size={13} className="shrink-0 text-ink-3" />
                    <span className="tnum w-[64px] shrink-0 text-right text-[0.95rem] font-bold">{as}</span>
                    <span className="shrink-0"><Delta before={b} after={a} lowerIsBetter={m.lowerIsBetter} unit={m.unit} recallOnly={m.recallOnly} /></span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-3">
            왼쪽은 <b>대표 입력값</b>(도입 전), 오른쪽은 <b>시스템 실측값</b>입니다. 표본이 적으면 차이를 성과로 읽지 마세요.
            현재 표본: 자료 {after.sample.docs}건 · 문의 {after.sample.inquiries}건
            {base?.recordedAt ? ` · 기준선 ${fmtDate(base.recordedAt)} 기록` : ""}
            {survey ? " · 기준선 조사에서 자동 반영됨" : ""}
          </p>
        </>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* 대표 체감 — 도입 전 ↔ 7일차 ↔ 14일차                                         */
/* -------------------------------------------------------------------------- */

/** 실증 경과일(1일차부터). 시작 전이면 0. `buildSprint` 의 elapsedDays 와 같은 계산이다. */
export function useSprintElapsed(): number {
  const startedAt = useStore((s) => s.settings.sprintStartedAt);
  const tick = useNow(60000);
  if (!startedAt || !tick) return 0;
  return daysBetween(startedAt, tick.toISOString()) + 1;
}

export interface PhaseSurveys {
  before?: BaselineSurveyResponse;
  day7?: BaselineSurveyResponse;
  day14?: BaselineSurveyResponse;
}

/** 제출된 응답만 시점별로 모은다. 작성 중(draft)은 비교표에 넣지 않는다. */
export function usePhaseSurveys(): PhaseSurveys {
  const list = useStore((s) => s.settings.baselineSurveys) ?? [];
  const pick = (p: BaselinePhase) => list.find((x) => x.phase === p && !x.draft);
  return { before: pick("before"), day7: pick("day7"), day14: pick("day14") };
}

/**
 * 재조사가 지금 열려 있는가.
 * 실증을 시작했고, 도입 전 기준선이 있고, 해당 일차가 지났을 때만 연다.
 */
export interface FollowupState {
  open: boolean;
  /** 왜 닫혀 있는가 — before: 도입 전 미기록 / not_started: 실증 미시작 / too_early: 아직 그 날 전 */
  reason: "open" | "before" | "not_started" | "too_early";
  /** 열리는 일차 (7 또는 14) */
  due: number;
  /** 열릴 때까지 남은 일수. 이미 열렸으면 0 */
  daysLeft: number;
}

export function followupState(phase: Exclude<BaselinePhase, "before">, elapsed: number, s: PhaseSurveys): FollowupState {
  const due = FOLLOWUP_DUE_DAY[phase];
  const daysLeft = Math.max(0, due - elapsed);
  if (!s.before) return { open: false, reason: "before", due, daysLeft };
  if (elapsed === 0) return { open: false, reason: "not_started", due, daysLeft };
  if (elapsed < due) return { open: false, reason: "too_early", due, daysLeft };
  return { open: true, reason: "open", due, daysLeft: 0 };
}

function RecallDelta({ before, after, lowerIsBetter, unit }: { before?: number; after?: number; lowerIsBetter: boolean; unit: string }) {
  if (before === undefined || after === undefined) return <span className="text-[0.78rem] text-ink-3">-</span>;
  const diff = after - before;
  if (Math.abs(diff) < 0.05) return <Badge>변화 없음</Badge>;
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  return (
    <Badge tone={better ? "success" : "warning"}>
      {diff > 0 ? "+" : "−"}
      {Math.abs(Math.abs(diff) % 1 === 0 ? diff : +diff.toFixed(1))}
      {unit}
    </Badge>
  );
}

/**
 * 시스템이 셀 수 없는 6개 항목의 시점별 비교.
 *
 * 세 값이 전부 "대표가 고른 구간"이다. 그래서 차이도 성과가 아니라 **두 응답의 차이**로만 적는다.
 * 개선율(%)·절감시간·ROI 는 만들지 않는다 — 두 시점의 기억을 나눈 값은 근거가 되지 못한다.
 */
export function RecallCompareCard({ compact }: { compact?: boolean }) {
  const s = usePhaseSurveys();
  const elapsed = useSprintElapsed();
  const isAdmin = useStore((st) => st.session?.role === "admin");
  const latest = s.day14 ?? s.day7;
  const cols: { phase: BaselinePhase; res?: BaselineSurveyResponse }[] = [
    { phase: "before", res: s.before },
    { phase: "day7", res: s.day7 },
    { phase: "day14", res: s.day14 },
  ];
  // 아직 아무것도 없으면 카드 자체를 띄우지 않는다 — 빈 표는 정보가 아니다.
  if (!s.before) return null;

  const next = !s.day7 ? ("day7" as const) : !s.day14 ? ("day14" as const) : undefined;
  const st = next ? followupState(next, elapsed, s) : undefined;

  return (
    <Card className={cx(compact ? "p-4" : "p-5")}>
      <SectionTitle
        action={
          isAdmin && next && st?.open ? (
            <Link href={`/ax/baseline?phase=${next}`}>
              <Button size="sm" variant="accent" icon={<Pencil size={14} />}>{PHASE_LABEL[next]} 조사</Button>
            </Link>
          ) : (
            <Badge tone={s.day14 ? "success" : s.day7 ? "info" : "neutral"}>
              {s.day14 ? "14일차 기록" : s.day7 ? "7일차 기록" : "재조사 전"}
            </Badge>
          )
        }
      >
        <span className="flex items-center gap-2"><Ruler size={18} className="text-accent" /> 대표 체감 변화</span>
      </SectionTitle>

      {/* 폰: 가로로 미는 5칸 표 대신 한 항목 = 한 줄. 표를 밀면 14일차 칸이 화면 밖에 남는다. */}
      <div className="divide-y divide-line lg:hidden">
        {RECALL_METRICS.map((m) => {
          const vals = cols.map((c) => ({ phase: c.phase, v: recallValue(c.res?.metrics, m.key) })).filter((x) => x.v !== undefined);
          return (
            <div key={m.key} className="py-2.5">
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1 text-[0.88rem] font-semibold">
                  {m.label}
                  {m.computed && <span className="ml-1 text-[0.72rem] font-normal text-ink-3">계산</span>}
                </span>
                <span className="shrink-0">
                  <RecallDelta before={recallValue(s.before?.metrics, m.key)} after={recallValue(latest?.metrics, m.key)} lowerIsBetter={m.lowerIsBetter} unit={m.unit} />
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[0.82rem] text-ink-2">
                {vals.length === 0 ? <span className="text-ink-3">미입력</span> : vals.map((x, i) => (
                  <span key={x.phase} className="whitespace-nowrap">
                    {i > 0 && <span className="mr-2 text-ink-3">→</span>}
                    <span className="text-ink-3">{PHASE_LABEL[x.phase]}</span> <b className="tnum text-ink">{x.v}{m.unit}</b>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden lg:block">
        <table className="tbl tbl-compact">
          <thead>
            <tr>
              <th className="w-[38%]">항목</th>
              {cols.map((c) => <th key={c.phase} className="text-right">{PHASE_LABEL[c.phase]}</th>)}
              <th className="text-right whitespace-nowrap">전 → 최근</th>
            </tr>
          </thead>
          <tbody>
            {RECALL_METRICS.map((m) => {
              const b = recallValue(s.before?.metrics, m.key);
              return (
                <tr key={m.key}>
                  <td className="font-semibold">
                    {m.label}
                    {m.computed && <span className="ml-1 text-[0.72rem] font-normal text-ink-3">계산</span>}
                  </td>
                  {cols.map((c) => {
                    const v = recallValue(c.res?.metrics, m.key);
                    return (
                      <td key={c.phase} className={cx("tnum text-right", v === undefined && "text-ink-3")}>
                        {v === undefined ? "-" : `${v}${m.unit}`}
                      </td>
                    );
                  })}
                  <td className="text-right">
                    <RecallDelta before={b} after={recallValue(latest?.metrics, m.key)} lowerIsBetter={m.lowerIsBetter} unit={m.unit} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-3">
        세 값 모두 <b className="text-ink-2">대표님이 고르신 구간</b>입니다. 시스템이 측정한 값이 아니며,
        차이 표시는 두 응답의 차이일 뿐 개선율이 아닙니다.
        {s.day7 && !s.day14 && " 7일은 기간이 짧아 그날의 사정에 흔들릴 수 있습니다."}
        {s.before && <> 도입 전 {fmtDate(s.before.recordedAt)} 기록.</>}
      </p>

      {isAdmin && next && st && !st.open && (
        <p className="mt-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[0.8rem] leading-relaxed text-ink-2">
          {st.reason === "not_started"
            ? <>{PHASE_LABEL[next]} 조사는 실증을 시작한 뒤 {st.due}일차부터 열립니다. <Link href="/ax/coach" className="font-bold underline">AX 코치에서 시작</Link></>
            : <>{PHASE_LABEL[next]} 조사는 <b className="text-ink">{st.daysLeft}일 뒤</b>에 열립니다. 지금 받으면 {st.due}일차 값이 되지 못합니다.</>}
        </p>
      )}
    </Card>
  );
}

