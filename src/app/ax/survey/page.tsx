"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ClipboardList, Send } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { REQUIRED_IDS, SURVEY, SURVEY_QUESTIONS, SURVEY_STAGE, SURVEY_VERSION, type Question } from "@/lib/survey";
import { fmtDateTime } from "@/lib/format";
import { Badge, Button, Card, PageHeader, Progress, Textarea, cx } from "@/components/ui/ui";

type Answer = string | string[] | number;

function Chip({ selected, disabled, onClick, children }: { selected: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      aria-pressed={selected}
      className={cx(
        "pressable rounded-xl border px-3.5 py-2 text-left text-[0.9rem] font-semibold transition-colors",
        selected ? "border-accent bg-soft text-accent" : "border-line text-ink-2 hover:border-line-2 hover:bg-surface-2",
        disabled && !selected && "cursor-not-allowed opacity-40 hover:border-line hover:bg-transparent",
      )}
    >
      {selected && <Check size={14} className="mr-1 inline-block align-[-2px]" />}
      {children}
    </button>
  );
}

function QuestionBlock({ q, value, onChange }: { q: Question; value: Answer | undefined; onChange: (v: Answer) => void }) {
  const multi = q.type === "multi";
  const picked = multi ? ((value as string[] | undefined) ?? []) : [];
  const atMax = multi && q.max !== undefined && picked.length >= q.max;

  return (
    <div className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-[1rem] font-bold">{q.label}</h3>
        {q.required && <span className="text-[0.72rem] font-bold text-accent">필수</span>}
        {multi && q.max !== undefined && <span className="text-[0.75rem] text-ink-3">{picked.length}/{q.max}</span>}
      </div>
      {q.hint && <p className="mt-0.5 text-[0.82rem] text-ink-3">{q.hint}</p>}

      {q.type === "scale" ? (
        <div className="mt-3">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                aria-pressed={value === n}
                className={cx(
                  "pressable tnum h-11 flex-1 rounded-xl border text-[1rem] font-bold transition-colors",
                  value === n ? "border-accent bg-accent text-accent-ink" : "border-line text-ink-2 hover:bg-surface-2",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[0.75rem] text-ink-3"><span>{q.scaleLabels?.[0]}</span><span>{q.scaleLabels?.[1]}</span></div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {q.options?.map((opt) => {
            const selected = multi ? picked.includes(opt) : value === opt;
            return (
              <Chip
                key={opt}
                selected={selected}
                disabled={atMax}
                onClick={() => {
                  if (!multi) { onChange(opt); return; }
                  onChange(selected ? picked.filter((x) => x !== opt) : [...picked, opt]);
                }}
              >
                {opt}
              </Chip>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SurveyPage() {
  const st = useStore();
  const user = useCurrentUser();
  const submit = useStore((s) => s.submitSurvey);
  const toast = useStore((s) => s.toast);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [free, setFree] = useState("");
  const [done, setDone] = useState(false);
  const startedAt = useRef(0);
  // Date.now()는 렌더 중에 부를 수 없다 (React Compiler purity). 마운트 시점에 기록한다.
  useEffect(() => { startedAt.current = Date.now(); }, []);

  const answered = useMemo(() => SURVEY_QUESTIONS.filter((q) => {
    const v = answers[q.id];
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "";
  }).length, [answers]);

  const missing = REQUIRED_IDS.filter((id) => {
    const v = answers[id];
    return Array.isArray(v) ? v.length === 0 : v === undefined || v === "";
  });

  const pct = Math.round((answered / SURVEY_QUESTIONS.length) * 100);
  const mine = st.surveys.filter((s) => s.userId === user?.id);

  const send = () => {
    if (missing.length) {
      const first = document.getElementById(`q-${missing[0]}`);
      first?.scrollIntoView({ block: "center", behavior: "smooth" });
      toast(`아직 답하지 않은 필수 문항이 ${missing.length}개 있습니다.`, "error");
      return;
    }
    submit({
      surveyVersion: SURVEY_VERSION,
      stage: SURVEY_STAGE,
      userId: user?.id ?? "unknown",
      userName: user?.name ?? "unknown",
      role: st.session?.role ?? "consultant",
      answers,
      freeText: free.trim() || undefined,
      durationSec: startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : undefined,
    });
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (done) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-7 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success"><Check size={28} /></div>
          <h1 className="mt-4 text-[1.4rem] font-bold">의견 감사합니다.</h1>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">
            주신 답변은 다음 단계(3단계 실사용 기능 고도화)의 개발 우선순위를 정하는 데 그대로 사용됩니다.
            어떤 항목이 먼저 반영됐는지는 설정 화면의 개발 이력에서 확인하실 수 있습니다.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/ax/dashboard"><Button variant="accent" icon={<ArrowRight size={16} />}>대시보드로</Button></Link>
            <Button variant="outline" onClick={() => { setAnswers({}); setFree(""); setDone(false); startedAt.current = Date.now(); }}>다시 작성</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-28">
      <PageHeader
        title="시스템 개선 의견"
        desc="지금 만든 기본 시스템을 실제 업무에 맞는 도구로 만들기 위한 설문입니다. 만족도 조사가 아니라, 다음에 무엇을 만들지 정하는 자료로 씁니다."
        badge={<Badge tone="accent">2단계 → 3단계 · 약 2분</Badge>}
      />

      {mine.length > 0 && (
        <div className="mb-4 rounded-xl bg-surface-2 px-4 py-3 text-[0.85rem] text-ink-2">
          마지막 제출: {fmtDateTime(mine[0].submittedAt)} · 업무 방식이 바뀌었다면 다시 작성하셔도 됩니다.
        </div>
      )}

      <div className="mb-5 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between text-[0.85rem] font-semibold">
          <span className="flex items-center gap-2"><ClipboardList size={16} className="text-accent" /> 대부분 클릭으로 답할 수 있습니다</span>
          <span className="tnum text-ink-3">{answered} / {SURVEY_QUESTIONS.length}</span>
        </div>
        <Progress value={pct} className="mt-2" height={6} />
      </div>

      <div className="space-y-4">
        {SURVEY.map((sec) => (
          <Card key={sec.key} className="p-5">
            <div className="mb-4">
              <h2 className="text-[1.15rem] font-bold">{sec.title}</h2>
              <p className="mt-0.5 text-[0.85rem] text-ink-2">{sec.desc}</p>
            </div>
            <div className="space-y-4">
              {sec.questions.map((q) => (
                <div key={q.id} id={`q-${q.id}`}>
                  <QuestionBlock q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
                </div>
              ))}
            </div>
          </Card>
        ))}

        {/* 자유입력은 마지막 한 번만 */}
        <Card className="p-5">
          <h2 className="text-[1.15rem] font-bold">마지막으로</h2>
          <p className="mt-0.5 text-[0.85rem] text-ink-2">추가로 꼭 개선했으면 하는 내용이 있다면 자유롭게 적어주세요. (선택)</p>
          <Textarea rows={4} className="mt-3" value={free} onChange={(e) => setFree(e.target.value)} placeholder="예: 상담 끝나고 바로 휴대폰으로 메모를 남길 수 있으면 좋겠습니다." />
        </Card>
      </div>

      {/* 제출 바 — 스크롤 중에도 항상 보이게 */}
      <div className="fixed inset-x-0 bottom-[var(--bottomnav-h)] z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-[var(--sidebar-w)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1 text-[0.82rem] text-ink-2">
            {missing.length ? <span>필수 문항 <b className="text-accent">{missing.length}개</b> 남음</span> : <span className="font-semibold text-success">모든 필수 문항에 답하셨습니다</span>}
          </div>
          <Button variant="accent" icon={<Send size={16} />} onClick={send}>제출</Button>
        </div>
      </div>
    </div>
  );
}
