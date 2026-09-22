"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, CalendarClock, Check, ClipboardCopy, Lock, Pencil, Printer, Ruler, Save,
} from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { uid, nowIso, fmtDate } from "@/lib/format";
import {
  BASELINE_SURVEY_VERSION, PHASE_LABEL, RECALL_METRICS,
  clickableCountFor, dailySearchMinutes, labelOf, metricsFrom, questionsFor, recallValue,
  sectionsFor, summarize, toPlainText,
  type BaselineAnswers, type BaselineQuestion,
} from "@/lib/baseline-survey";
import type { BaselinePhase, BaselineSurveyResponse } from "@/lib/types";
import {
  RecallCompareCard, followupState, usePhaseSurveys, useSprintElapsed, type FollowupState,
} from "@/components/domain/BaselineCard";
import { Badge, Button, Card, PageHeader, Progress, Textarea, cx } from "@/components/ui/ui";

/**
 * 기준선 조사 — 도입 전 / 7일차 / 14일차.
 *
 * 시스템은 "도입 후"만 셀 수 있다. 도입 전 값은 대표의 기억에만 있고, 그것을 한 번
 * 기록해 두지 않으면 나중에 무엇이 달라졌는지 말할 수 없다. 그래서 이 화면이 있다.
 *
 * 그런데 도입 전만 받아 두면 비교표의 절반이 영원히 빈다 — 대표가 직접 챙긴 비중,
 * 하루 수기 확인 시간, 자료 찾는 시간, 재작업은 도입 후에도 시스템이 셀 수 없다.
 * 그래서 7일차·14일차에 **같은 질문을** 다시 묻는다. 대신 시스템이 실측할 수 있는 문항은
 * 빼고 6개만 물어 2분 안에 끝나게 한다.
 *
 * 대표는 통계를 갖고 있지 않다. 그래서 숫자를 묻지 않고 구간을 고르게 한다.
 * 마지막 한 문항을 빼면 전부 클릭이고, 모르면 "모르겠음"을 고를 수 있다.
 */
export default function BaselinePage() {
  return <Suspense><PhaseRouter /></Suspense>;
}

function PhaseRouter() {
  const raw = useSearchParams().get("phase");
  const phase: BaselinePhase = raw === "day7" || raw === "day14" ? raw : "before";
  // 시점을 바꾸면 폼 상태(작성 중인 답)를 통째로 새로 시작해야 한다 — 7일차 답이 14일차로 새면 안 된다.
  return <BaselineInner key={phase} phase={phase} />;
}

function BaselineInner({ phase }: { phase: BaselinePhase }) {
  const st = useStore();
  const user = useCurrentUser();
  const save = useStore((s) => s.saveBaselineSurvey);
  const toast = useStore((s) => s.toast);
  const isAdmin = st.session?.role === "admin";
  const me = st.session?.userId ?? "u_admin";

  const surveys = usePhaseSurveys();
  const elapsed = useSprintElapsed();
  const stored = (st.settings.baselineSurveys ?? []).find((x) => x.phase === phase);
  const submitted = stored && !stored.draft ? stored : undefined;

  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<BaselineAnswers>(() => stored?.answers ?? {});
  const [free, setFree] = useState(stored?.recentPainExample ?? "");
  const [savedAt, setSavedAt] = useState<string | null>(stored?.draft ? stored.recordedAt : null);

  const sections = sectionsFor(phase);
  const clickable = clickableCountFor(phase);
  const isFollowup = phase !== "before";

  /* ---------------- 재조사 잠금 ---------------- */
  // 3일차에 "14일차 조사"를 받아 두면 그 값은 14일차 값이 아니다. 열릴 때까지 폼을 주지 않는다.
  const gate = isFollowup ? followupState(phase, elapsed, surveys) : undefined;
  if (isFollowup && gate && !gate.open && !submitted) return <Locked phase={phase} gate={gate} />;

  const showForm = isAdmin && (editing || !submitted);

  /* ---------------- 결과 보기 ---------------- */
  if (!showForm) {
    const onEdit = () => { setEditing(true); setStep(0); window.scrollTo({ top: 0 }); };
    return isFollowup
      ? <FollowupResult phase={phase} res={submitted} canEdit={isAdmin} onEdit={onEdit} />
      : <Result res={submitted} canEdit={isAdmin} onEdit={onEdit} hasFollowup={!!(surveys.day7 || surveys.day14)} />;
  }

  /* ---------------- 작성 ---------------- */
  const sec = sections[step];
  const last = step === sections.length - 1;
  const answered = questionsFor(phase).filter((q) => {
    if (q.type === "text") return false;
    const v = answers[q.id];
    return Array.isArray(v) ? v.length > 0 : !!v;
  }).length;
  const pct = Math.round((answered / clickable) * 100);

  const build = (draft: boolean): BaselineSurveyResponse => ({
    id: stored?.id ?? uid("bs"),
    surveyVersion: BASELINE_SURVEY_VERSION,
    phase,
    respondentUserId: me,
    respondentName: user?.name ?? "대표",
    recordedAt: nowIso(),
    answers,
    metrics: metricsFrom(answers),
    recentPainExample: free.trim() || undefined,
    source: "ceo_recall",
    draft,
  });

  const keep = (silent?: boolean) => {
    save(build(true), me);
    setSavedAt(nowIso());
    if (!silent) toast("여기까지 저장했습니다. 나중에 이어서 하셔도 됩니다.");
  };

  const go = (next: number) => {
    keep(true);                       // 단계를 옮길 때마다 조용히 저장한다 — 중간에 닫아도 잃지 않는다
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const send = () => {
    if (answered === 0) { toast("한 문항도 선택하지 않으셨습니다.", "error"); return; }
    save(build(false), me);
    setEditing(false);
    toast(isFollowup
      ? `${PHASE_LABEL[phase]} 응답을 기록했습니다. 도입 전과 나란히 비교됩니다.`
      : "도입 전 기준선을 기록했습니다. 이제 도입 전후 비교가 표시됩니다.");
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="mx-auto max-w-2xl pb-32">
      <PageHeader
        title={isFollowup ? `${PHASE_LABEL[phase]} 재조사` : "도입 전 기준선 조사"}
        desc={isFollowup
          ? "도입 전에 여쭤본 것과 같은 질문입니다. 지금 기준으로 골라 주세요. 시스템이 직접 셀 수 있는 항목은 빼서 6개만 남겼습니다."
          : "AX 도입 전 실제 업무가 얼마나 수작업과 반복 확인에 의존했는지 기록합니다. 정확한 통계가 없어도 괜찮습니다. 평소 경험하신 평균적인 수준으로 골라 주세요."}
        badge={<Badge tone="accent">{isFollowup ? "약 2분 · 6문항" : "약 3~5분 · 대부분 클릭"}</Badge>}
      />

      <div className="mb-4 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[0.85rem] font-semibold">
          <span className="flex items-center gap-2"><Ruler size={16} className="text-accent" /> {step + 1} / {sections.length} 단계 · {sec.title}</span>
          <span className="tnum text-ink-3">{answered} / {clickable}</span>
        </div>
        <Progress value={pct} className="mt-2" height={6} />
        {savedAt && <div className="mt-1.5 text-[0.75rem] text-ink-3">임시저장됨 · {fmtDate(savedAt)} — 지금 닫으셔도 여기까지는 남습니다</div>}
      </div>

      <Card className="p-5" key={sec.key}>
        <div className="anim-rise">
          <h2 className="text-[1.15rem] font-bold">{sec.title}</h2>
          <p className="mt-0.5 text-[0.85rem] text-ink-2">{sec.desc}</p>
          <div className="mt-5 space-y-6">
            {sec.questions.map((q) => (
              <QuestionBlock
                key={q.id}
                q={q}
                value={answers[q.id]}
                before={isFollowup ? labelOf(q.id, surveys.before?.answers[q.id] as string | undefined) : undefined}
                free={free}
                onFree={setFree}
                onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
              />
            ))}
          </div>
        </div>
      </Card>

      <p className="mt-4 text-center text-[0.78rem] leading-relaxed text-ink-3">
        여기에 적는 값은 <b className="text-ink-2">대표님이 체감하시는 수준</b>입니다.
        시스템이 잰 값이 아니며, 화면과 인쇄물에도 그렇게 표시됩니다.
      </p>

      {/* 이동 바 — 스크롤 중에도 항상 보이게 */}
      <div className="fixed inset-x-0 bottom-[var(--bottomnav-h)] z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-[var(--sidebar-w)]">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Button variant="outline" size="sm" icon={<ArrowLeft size={15} />} disabled={step === 0} onClick={() => go(step - 1)}>이전</Button>
          <Button variant="ghost" size="sm" icon={<Save size={15} />} onClick={() => keep()}>임시저장</Button>
          <span className="flex-1" />
          {last ? (
            <Button variant="accent" icon={<Check size={16} />} onClick={send}>제출</Button>
          ) : (
            <Button variant="accent" icon={<ArrowRight size={16} />} onClick={() => go(step + 1)}>다음</Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 재조사 잠금 화면 ---------------- */

function Locked({ phase, gate }: { phase: BaselinePhase; gate: FollowupState }) {
  const msg =
    gate.reason === "before"
      ? { title: "도입 전 기준선부터 기록해 주세요", body: "비교할 기준이 없으면 지금 값만 남습니다. 도입 전 조사를 먼저 마쳐 주세요.", href: "/ax/baseline", cta: "도입 전 기준선 조사" }
      : gate.reason === "not_started"
        ? { title: "실증을 시작한 뒤 열립니다", body: `AX 실증 14일을 시작하면 ${gate.due}일차에 이 조사가 열립니다. 시작일이 있어야 "며칠 쓴 뒤의 값"인지 말할 수 있습니다.`, href: "/ax/coach", cta: "AX 코치에서 시작" }
        : { title: `${gate.daysLeft}일 뒤에 열립니다`, body: `${PHASE_LABEL[phase]} 조사는 실증 ${gate.due}일차부터 받습니다. 지금 받으면 ${gate.due}일차 값이 되지 못합니다.`, href: "/ax/coach", cta: "오늘의 미션 보기" };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`${PHASE_LABEL[phase]} 재조사`} desc="도입 전과 같은 질문을 지금 기준으로 다시 받습니다." />
      <Card className="p-7 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-3">
          {gate.reason === "too_early" ? <CalendarClock size={22} /> : <Lock size={22} />}
        </span>
        <h2 className="mt-3 text-[1.1rem] font-bold">{msg.title}</h2>
        <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-2">{msg.body}</p>
        <Link href={msg.href}><Button variant="accent" className="mt-4" icon={<ArrowRight size={16} />}>{msg.cta}</Button></Link>
      </Card>
    </div>
  );
}

/* ---------------- 문항 ---------------- */

function QuestionBlock({ q, value, onChange, free, onFree, before }: {
  q: BaselineQuestion;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
  free: string;
  onFree: (v: string) => void;
  /** 재조사일 때 도입 전에 고르셨던 답 — 같은 질문이라는 것이 보여야 비교가 성립한다 */
  before?: string;
}) {
  const multi = q.type === "multi";
  const picked = multi ? ((value as string[] | undefined) ?? []) : [];
  const atMax = multi && q.max !== undefined && picked.length >= q.max;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-[0.98rem] font-bold leading-snug">{q.label}</h3>
        {multi && q.max !== undefined && <span className="shrink-0 text-[0.75rem] text-ink-3">{picked.length}/{q.max}</span>}
      </div>
      {q.hint && <p className="mt-1 text-[0.8rem] leading-relaxed text-ink-3">{q.hint}</p>}
      {before && q.type !== "text" && (
        <p className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-[0.78rem] text-ink-2">
          <span className="shrink-0 text-ink-3">도입 전 답변</span> <b className="min-w-0">{before}</b>
        </p>
      )}

      {q.type === "text" ? (
        <Textarea rows={4} className="mt-3 !text-[0.9rem]" value={free} onChange={(e) => onFree(e.target.value)} placeholder={q.placeholder} />
      ) : (
        // role=group + 문항 이름: 한 화면에 "주 2~3건" 같은 같은 라벨이 두 번 나오는 문항이 있다.
        // 묶어두지 않으면 화면 낭독기에서 어느 질문의 답인지 구분되지 않는다.
        <div role="group" aria-label={q.label} className="mt-3 grid gap-2 sm:grid-cols-2">
          {q.options?.map((o) => {
            const selected = multi ? picked.includes(o.key) : value === o.key;
            const dim = atMax && !selected;
            return (
              <button
                key={o.key}
                type="button"
                aria-pressed={selected}
                disabled={dim}
                onClick={() => {
                  if (!multi) { onChange(o.key); return; }
                  onChange(selected ? picked.filter((x) => x !== o.key) : [...picked, o.key]);
                }}
                className={cx(
                  "pressable flex min-h-11 w-full items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left text-[0.9rem] font-semibold leading-snug transition-colors",
                  selected ? "border-accent bg-soft text-accent" : "border-line text-ink-2 hover:border-line-2 hover:bg-surface-2",
                  dim && "cursor-not-allowed opacity-40 hover:border-line hover:bg-transparent",
                )}
              >
                <span className={cx(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                  selected ? "border-accent bg-accent text-accent-ink" : "border-line-2",
                )}>
                  {selected && <Check size={10} strokeWidth={3.5} />}
                </span>
                <span className="min-w-0 flex-1">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- 결과 (도입 전) ---------------- */

function Result({ res, canEdit, onEdit, hasFollowup }: { res?: BaselineSurveyResponse; canEdit: boolean; onEdit: () => void; hasFollowup?: boolean }) {
  const toast = useStore((s) => s.toast);
  const [copied, setCopied] = useState(false);

  if (!res) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="도입 전 기준선 조사" desc="AX 도입 전 실제 업무가 얼마나 수작업과 반복 확인에 의존했는지 기록합니다." />
        <Card className="p-7 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-3"><Lock size={22} /></span>
          <h2 className="mt-3 text-[1.1rem] font-bold">아직 기록되지 않았습니다</h2>
          <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-2">
            도입 전 값은 시스템이 만들어낼 수 없어 대표님이 직접 한 번 기록하셔야 합니다.
            {canEdit ? " 아래 버튼으로 시작하세요." : " 대표 계정에서 입력할 수 있습니다."}
          </p>
          {canEdit && <Button variant="accent" className="mt-4" icon={<ArrowRight size={16} />} onClick={onEdit}>기준선 조사 시작</Button>}
        </Card>
      </div>
    );
  }

  const groups = summarize(res.answers, res.metrics);
  const pains = Array.isArray(res.answers.biggestPainPoints) ? res.answers.biggestPainPoints : [];
  const search = dailySearchMinutes(res.metrics);

  const copy = async () => {
    const text = toPlainText({
      answers: res.answers, metrics: res.metrics, recordedAt: res.recordedAt,
      respondentName: res.respondentName, recentPainExample: res.recentPainExample,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("복사했습니다. 카카오톡이나 문서에 그대로 붙여넣으시면 됩니다.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // 클립보드 권한이 없거나 http 환경이면 막힌다. 실패를 숨기지 않는다.
      toast("복사하지 못했습니다. 인쇄 화면에서 내용을 선택해 복사해 주세요.", "error");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="AX 도입 전 기준선"
        desc={`${fmtDate(res.recordedAt, { year: true })} ${res.respondentName} 대표자 직접 입력`}
        badge={<Badge tone="neutral">대표 입력값</Badge>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" icon={<ClipboardCopy size={15} />} onClick={copy}>{copied ? "복사됨" : "복사하기"}</Button>
            <Link href="/print/baseline"><Button size="sm" variant="outline" icon={<Printer size={15} />}>인쇄 · PDF</Button></Link>
            {canEdit && <Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={onEdit}>수정</Button>}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.key} className="p-5">
            <h3 className="text-[1rem] font-bold">{g.title}</h3>
            <div className="mt-2 divide-y divide-line">
              {g.rows.map((r) => (
                <div key={r.label} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2">
                  <span className="min-w-0 flex-1 text-[0.85rem] text-ink-2">{r.label}</span>
                  <span className={cx("shrink-0 text-[0.9rem] font-bold", r.value === "미입력" && "font-normal text-ink-3")}>{r.value}</span>
                  {r.computed && <Badge tone="neutral">계산</Badge>}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {(pains.length > 0 || res.recentPainExample) && (
        <Card className="p-5">
          {pains.length > 0 && (
            <>
              <h3 className="text-[1rem] font-bold">가장 부담이 컸던 업무</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pains.map((k) => <Badge key={k} tone="accent">{labelOf("biggestPainPoints", k) ?? k}</Badge>)}
              </div>
            </>
          )}
          {res.recentPainExample && (
            <blockquote className={cx("rounded-xl bg-surface-2 px-4 py-3 text-[0.9rem] leading-relaxed text-ink-2", pains.length > 0 && "mt-4")}>
              {res.recentPainExample}
            </blockquote>
          )}
        </Card>
      )}

      {/* 도입 전만으로는 비교가 반쪽이다. 다음에 무엇이 남았는지 여기서 알려 준다. */}
      <FollowupPlan />
      {hasFollowup && <RecallCompareCard />}

      <div className="rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-[0.78rem] leading-relaxed text-ink-3">
        {search !== undefined && (
          <p className="mb-1.5">
            <b className="text-ink-2">하루 자료 검색 약 {search}분</b>은 대표님이 고르신 두 값(하루 검색 횟수 × 건당 소요시간)을 곱한 <b className="text-ink-2">계산치</b>입니다. 시스템이 측정한 값이 아닙니다.
          </p>
        )}
        본 자료의 도입 전 수치는 시스템 도입 전 대표자의 실제 업무 경험을 기준으로 입력한 Baseline이며,
        도입 후 수치는 향후 시스템 Event Log 및 실제 사용데이터를 통해 별도 측정합니다.
      </div>

      <Link href="/ax/reports" className="card card-hover flex items-center justify-between gap-3 p-4">
        <span className="text-[0.9rem] font-semibold">리포트 · 실증에서 도입 전후 비교 보기</span>
        <ArrowRight size={16} className="shrink-0 text-ink-3" />
      </Link>
    </div>
  );
}

/* ---------------- 재조사 일정 안내 ---------------- */

function FollowupPlan() {
  const surveys = usePhaseSurveys();
  const elapsed = useSprintElapsed();
  const isAdmin = useStore((s) => s.session?.role === "admin");
  const rows = (["day7", "day14"] as const).map((p) => ({ p, res: surveys[p], gate: followupState(p, elapsed, surveys) }));

  return (
    <Card className="p-5">
      <h3 className="flex items-center gap-2 text-[1rem] font-bold"><CalendarClock size={17} className="text-accent" /> 다음 조사</h3>
      <p className="mt-1 text-[0.85rem] leading-relaxed text-ink-2">
        도입 전 값만으로는 <b className="text-ink">무엇이 달라졌는지</b> 말할 수 없습니다. 같은 질문 6개를
        7일차와 14일차에 한 번씩 더 받습니다. 각 2분이면 끝납니다.
      </p>
      <div className="mt-3 divide-y divide-line">
        {rows.map(({ p, res, gate }) => (
          <div key={p} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            <span className="min-w-0 flex-1 text-[0.88rem] font-semibold">{PHASE_LABEL[p]} 재조사</span>
            {res ? (
              <Badge tone="success">{fmtDate(res.recordedAt)} 기록</Badge>
            ) : gate.open ? (
              isAdmin
                ? <Link href={`/ax/baseline?phase=${p}`}><Button size="sm" variant="accent">지금 조사</Button></Link>
                : <Badge tone="warning">대표 응답 대기</Badge>
            ) : (
              <Badge tone="neutral">
                {gate.reason === "not_started" ? "실증 시작 후" : `${gate.daysLeft}일 뒤`}
              </Badge>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- 결과 (재조사) ---------------- */

function FollowupResult({ phase, res, canEdit, onEdit }: { phase: BaselinePhase; res?: BaselineSurveyResponse; canEdit: boolean; onEdit: () => void }) {
  const surveys = usePhaseSurveys();
  const toast = useStore((s) => s.toast);
  const [copied, setCopied] = useState(false);

  if (!res) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={`${PHASE_LABEL[phase]} 재조사`} desc="도입 전과 같은 질문을 지금 기준으로 다시 받습니다." />
        <Card className="p-7 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-3"><Lock size={22} /></span>
          <h2 className="mt-3 text-[1.1rem] font-bold">아직 기록되지 않았습니다</h2>
          <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-2">
            {canEdit ? "6문항, 약 2분입니다." : "대표 계정에서 입력할 수 있습니다."}
          </p>
          {canEdit && <Button variant="accent" className="mt-4" icon={<ArrowRight size={16} />} onClick={onEdit}>{PHASE_LABEL[phase]} 조사 시작</Button>}
        </Card>
      </div>
    );
  }

  const pains = Array.isArray(res.answers.biggestPainPoints) ? res.answers.biggestPainPoints : [];

  const copy = async () => {
    const before = surveys.before;
    const lines = [`[KPJK AX 기준선 — 도입 전 ↔ ${PHASE_LABEL[phase]}]`, ""];
    for (const m of RECALL_METRICS) {
      const b = recallValue(before?.metrics, m.key);
      const a = recallValue(res.metrics, m.key);
      if (b === undefined && a === undefined) continue;
      lines.push(`- ${m.label}: ${b === undefined ? "미입력" : `${b}${m.unit}`} → ${a === undefined ? "미입력" : `${a}${m.unit}`}${m.computed ? " (입력값 기준 계산)" : ""}`);
    }
    if (pains.length) lines.push("", `- 아직 남아 있는 불편: ${pains.map((k) => labelOf("biggestPainPoints", k) ?? k).join(", ")}`);
    if (res.recentPainExample?.trim()) lines.push("", `- 대표 의견: ${res.recentPainExample.trim()}`);
    lines.push(
      "",
      `※ 두 값 모두 ${res.respondentName} 대표께서 고르신 구간이며 시스템 측정값이 아닙니다.`,
      "※ 개선율·절감시간은 산출하지 않습니다.",
    );
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      toast("복사했습니다.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast("복사하지 못했습니다. 인쇄 화면에서 내용을 선택해 복사해 주세요.", "error");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={`${PHASE_LABEL[phase]} 재조사`}
        desc={`${fmtDate(res.recordedAt, { year: true })} ${res.respondentName} 대표자 직접 입력`}
        badge={<Badge tone="neutral">대표 입력값</Badge>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" icon={<ClipboardCopy size={15} />} onClick={copy}>{copied ? "복사됨" : "복사하기"}</Button>
            <Link href="/print/baseline"><Button size="sm" variant="outline" icon={<Printer size={15} />}>인쇄 · PDF</Button></Link>
            {canEdit && <Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={onEdit}>수정</Button>}
          </div>
        }
      />

      <RecallCompareCard />

      {(pains.length > 0 || res.recentPainExample) && (
        <Card className="p-5">
          {pains.length > 0 && (
            <>
              <h3 className="text-[1rem] font-bold">아직 남아 있는 불편</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pains.map((k) => <Badge key={k} tone="warning">{labelOf("biggestPainPoints", k) ?? k}</Badge>)}
              </div>
            </>
          )}
          {res.recentPainExample && (
            <blockquote className={cx("rounded-xl bg-surface-2 px-4 py-3 text-[0.9rem] leading-relaxed text-ink-2", pains.length > 0 && "mt-4")}>
              {res.recentPainExample}
            </blockquote>
          )}
        </Card>
      )}

      <FollowupPlan />

      <Link href="/ax/reports" className="card card-hover flex items-center justify-between gap-3 p-4">
        <span className="text-[0.9rem] font-semibold">리포트 · 실증에서 전체 비교 보기</span>
        <ArrowRight size={16} className="shrink-0 text-ink-3" />
      </Link>
    </div>
  );
}
