"use client";

import Link from "next/link";
import { ArrowRight, Pencil, Ruler } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/hooks";
import type { Baseline } from "@/lib/types";
import { daysBetween, fmtDate } from "@/lib/format";
import { Badge, Button, Card, SectionTitle, cx } from "@/components/ui/ui";

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
              return (
                <div key={m.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <span className="min-w-0 flex-1 text-[0.88rem] font-semibold">{m.label}</span>
                  <span className="tnum shrink-0 text-[0.85rem] text-ink-3">{b !== undefined ? `${b}${m.unit}` : "-"}</span>
                  <ArrowRight size={13} className="shrink-0 text-ink-3" />
                  <span className="tnum w-[64px] shrink-0 text-right text-[0.95rem] font-bold">{a !== undefined ? `${a}${m.unit}` : "-"}</span>
                  <span className="shrink-0"><Delta before={b} after={a} lowerIsBetter={m.lowerIsBetter} unit={m.unit} /></span>
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
