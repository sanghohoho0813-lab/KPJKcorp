"use client";

import { useState } from "react";
import { ArrowRight, Pencil, Ruler } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/hooks";
import type { Baseline } from "@/lib/types";
import { daysBetween, fmtDate } from "@/lib/format";
import { Badge, Button, Card, Field, Input, SectionTitle, Textarea, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";

interface Metric {
  key: keyof Baseline;
  label: string;
  unit: string;
  /** 낮을수록 좋은 지표인가 */
  lowerIsBetter: boolean;
  hint: string;
}

const METRICS: Metric[] = [
  { key: "docLeadDays", label: "자료요청 → 제출 소요", unit: "일", lowerIsBetter: true, hint: "요청하고 실제로 받기까지 보통 며칠 걸렸습니까?" },
  { key: "missedFollowupsPerWeek", label: "주간 후속 누락", unit: "건", lowerIsBetter: true, hint: "연락·자료 독촉을 놓치는 일이 주에 몇 번 정도였습니까?" },
  { key: "inquiryResponseHours", label: "고객 문의 대응", unit: "시간", lowerIsBetter: true, hint: "문의를 받고 답하기까지 보통 몇 시간 걸렸습니까?" },
  { key: "consultationsPerMonth", label: "월 상담 기록", unit: "건", lowerIsBetter: false, hint: "상담 내용을 실제로 기록해 둔 건수입니다. 기억에만 있던 것은 제외합니다." },
  { key: "clientsPerConsultant", label: "1인당 관리 기업", unit: "개사", lowerIsBetter: false, hint: "담당자 한 명이 동시에 챙기던 기업 수입니다." },
  { key: "ceoHandledPct", label: "대표가 직접 챙긴 비중", unit: "%", lowerIsBetter: true, hint: "실무 중 대표가 직접 기억하고 챙겨야 했던 비율입니다." },
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
    sample: { docs: submitted.length, inquiries: answered.length },
  };
}

function Delta({ before, after, lowerIsBetter, unit }: { before?: number; after?: number; lowerIsBetter: boolean; unit: string }) {
  if (before === undefined || after === undefined) {
    return <span className="text-[0.8rem] text-ink-3">{before === undefined ? "기준선 미입력" : "수집 중"}</span>;
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
  const save = useStore((s) => s.saveBaseline);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const isAdmin = st.session?.role === "admin";
  const base = st.settings.baseline;
  const after = useAfterValues();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(METRICS.map((m) => [m.key, base?.[m.key] !== undefined ? String(base[m.key]) : ""])),
  );
  const [note, setNote] = useState(base?.note ?? "");

  const recorded = METRICS.filter((m) => base?.[m.key] !== undefined).length;

  const submit = () => {
    const data: Baseline = { note: note.trim() || undefined };
    for (const m of METRICS) {
      const v = form[m.key]?.trim();
      if (v !== "" && v !== undefined && !Number.isNaN(Number(v))) (data[m.key] as number) = Number(v);
    }
    save(data, me);
    toast("도입 전 기준선을 기록했습니다. 이제 전후 비교가 표시됩니다.");
    setOpen(false);
  };

  return (
    <>
      <Card className={cx(compact ? "p-4" : "p-5")}>
        <SectionTitle
          action={
            isAdmin ? (
              <Button size="sm" variant={recorded ? "ghost" : "accent"} icon={<Pencil size={14} />} onClick={() => setOpen(true)}>
                {recorded ? "수정" : "기준선 입력"}
              </Button>
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
              쌓이는 기록만으로는 &ldquo;무엇이 달라졌는가&rdquo;를 말할 수 없습니다. 도입 전 값은 시스템이 만들어낼 수 없으므로 대표님이 직접 한 번 입력해 주셔야 합니다. 6개 항목, 1분이면 됩니다.
            </p>
            {isAdmin && (
              <button onClick={() => setOpen(true)} className="pressable mt-2 inline-flex items-center gap-1 text-[0.85rem] font-bold underline">
                지금 입력하기 <ArrowRight size={14} />
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-line">
              {METRICS.map((m) => {
                const b = base?.[m.key] as number | undefined;
                const a = after[m.key as keyof typeof after] as number | undefined;
                return (
                  <div key={m.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <span className="min-w-0 flex-1 text-[0.88rem] font-semibold">{m.label}</span>
                    <span className="tnum shrink-0 text-[0.85rem] text-ink-3">
                      {b !== undefined ? `${b}${m.unit}` : "-"}
                    </span>
                    <ArrowRight size={13} className="shrink-0 text-ink-3" />
                    <span className="tnum w-[64px] shrink-0 text-right text-[0.95rem] font-bold">
                      {a !== undefined ? `${a}${m.unit}` : "-"}
                    </span>
                    <span className="shrink-0"><Delta before={b} after={a} lowerIsBetter={m.lowerIsBetter} unit={m.unit} /></span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-3">
              왼쪽은 <b>대표 입력값</b>(도입 전), 오른쪽은 <b>시스템 실측값</b>입니다. 표본이 적으면 차이를 성과로 읽지 마세요.
              현재 표본: 자료 {after.sample.docs}건 · 문의 {after.sample.inquiries}건
              {base?.recordedAt ? ` · 기준선 ${fmtDate(base.recordedAt)} 기록` : ""}
            </p>
          </>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="도입 전 기준선 입력"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>취소</Button>
            <Button variant="accent" onClick={submit}>저장</Button>
          </>
        }
      >
        <p className="text-[0.88rem] leading-relaxed text-ink-2">
          이 시스템을 쓰기 <b className="text-ink">전</b>의 값입니다. 정확한 수치가 없어도 괜찮습니다. 기억하시는 대로의 대략값이면 충분하고,
          나중에 언제든 수정할 수 있습니다. 모르는 항목은 비워 두세요.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {METRICS.map((m) => (
            <Field key={m.key} label={`${m.label} (${m.unit})`} hint={m.hint}>
              <Input
                inputMode="decimal"
                value={form[m.key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [m.key]: e.target.value.replace(/[^0-9.]/g, "") }))}
                placeholder="예: 7"
              />
            </Field>
          ))}
        </div>
        <div className="mt-3">
          <Field label="메모" hint="어떤 기준으로 잡은 값인지 적어두면 나중에 설명하기 쉽습니다.">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 2026년 8월 기준, 담당자 3명 평균" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
