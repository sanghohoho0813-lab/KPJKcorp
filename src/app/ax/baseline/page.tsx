"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Check, ClipboardCopy, Lock, Pencil, Printer, Ruler, Save,
} from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { uid, nowIso, fmtDate } from "@/lib/format";
import {
  BASELINE_QUESTIONS, BASELINE_SECTIONS, BASELINE_SURVEY_VERSION, CLICKABLE_COUNT,
  dailySearchMinutes, labelOf, metricsFrom, summarize, toPlainText,
  type BaselineAnswers, type BaselineQuestion,
} from "@/lib/baseline-survey";
import type { BaselineSurveyResponse } from "@/lib/types";
import { Badge, Button, Card, PageHeader, Progress, Textarea, cx } from "@/components/ui/ui";

/**
 * 도입 전 기준선 조사.
 *
 * 시스템은 "도입 후"만 셀 수 있다. 도입 전 값은 대표의 기억에만 있고, 그것을 한 번
 * 기록해 두지 않으면 나중에 무엇이 달라졌는지 말할 수 없다. 그래서 이 화면이 있다.
 *
 * 대표는 통계를 갖고 있지 않다. 그래서 숫자를 묻지 않고 구간을 고르게 한다.
 * 마지막 한 문항을 빼면 전부 클릭이고, 모르면 "모르겠음"을 고를 수 있다.
 */
export default function BaselinePage() {
  const st = useStore();
  const user = useCurrentUser();
  const save = useStore((s) => s.saveBaselineSurvey);
  const toast = useStore((s) => s.toast);
  const isAdmin = st.session?.role === "admin";
  const me = st.session?.userId ?? "u_admin";

  const stored = (st.settings.baselineSurveys ?? []).find((x) => x.phase === "before");
  const submitted = stored && !stored.draft ? stored : undefined;

  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<BaselineAnswers>(() => stored?.answers ?? {});
  const [free, setFree] = useState(stored?.recentPainExample ?? "");
  const [savedAt, setSavedAt] = useState<string | null>(stored?.draft ? stored.recordedAt : null);

  const showForm = isAdmin && (editing || !submitted);

  /* ---------------- 결과 보기 ---------------- */
  if (!showForm) {
    return (
      <Result
        res={submitted}
        canEdit={isAdmin}
        onEdit={() => { setEditing(true); setStep(0); window.scrollTo({ top: 0 }); }}
      />
    );
  }

  /* ---------------- 작성 ---------------- */
  const sec = BASELINE_SECTIONS[step];
  const last = step === BASELINE_SECTIONS.length - 1;
  const answered = BASELINE_QUESTIONS.filter((q) => {
    if (q.type === "text") return false;
    const v = answers[q.id];
    return Array.isArray(v) ? v.length > 0 : !!v;
  }).length;
  const pct = Math.round((answered / CLICKABLE_COUNT) * 100);

  const build = (draft: boolean): BaselineSurveyResponse => ({
    id: stored?.id ?? uid("bs"),
    surveyVersion: BASELINE_SURVEY_VERSION,
    phase: "before",
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
    toast("도입 전 기준선을 기록했습니다. 이제 도입 전후 비교가 표시됩니다.");
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="mx-auto max-w-2xl pb-32">
      <PageHeader
        title="도입 전 기준선 조사"
        desc="AX 도입 전 실제 업무가 얼마나 수작업과 반복 확인에 의존했는지 기록합니다. 정확한 통계가 없어도 괜찮습니다. 평소 경험하신 평균적인 수준으로 골라 주세요."
        badge={<Badge tone="accent">약 3~5분 · 대부분 클릭</Badge>}
      />

      <div className="mb-4 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[0.85rem] font-semibold">
          <span className="flex items-center gap-2"><Ruler size={16} className="text-accent" /> {step + 1} / {BASELINE_SECTIONS.length} 단계 · {sec.title}</span>
          <span className="tnum text-ink-3">{answered} / {CLICKABLE_COUNT}</span>
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
                free={free}
                onFree={setFree}
                onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
              />
            ))}
          </div>
        </div>
      </Card>

      <p className="mt-4 text-center text-[0.78rem] leading-relaxed text-ink-3">
        여기에 적는 값은 <b className="text-ink-2">대표님이 기억하시는 도입 전 수준</b>입니다.
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

/* ---------------- 문항 ---------------- */

function QuestionBlock({ q, value, onChange, free, onFree }: {
  q: BaselineQuestion;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
  free: string;
  onFree: (v: string) => void;
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

/* ---------------- 결과 ---------------- */

function Result({ res, canEdit, onEdit }: { res?: BaselineSurveyResponse; canEdit: boolean; onEdit: () => void }) {
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
