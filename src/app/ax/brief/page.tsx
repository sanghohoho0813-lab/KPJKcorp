"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { buildBrief, briefSummaryCounts } from "@/lib/brief";
import { useNow } from "@/lib/hooks";
import { fmtFull, fmtClock } from "@/lib/format";
import { AiReadyBadge, Badge, Card, KpiCard, PageHeader, SectionTitle, cx } from "@/components/ui/ui";
import { BriefList } from "@/components/domain/domain";
import { BriefActionHint } from "@/components/domain/BriefActions";

export default function BriefPage() {
  const st = useStore();
  const user = useCurrentUser();
  const openAi = useUi((s) => s.openAi);
  const tick = useNow(60000);
  const now = useMemo(() => tick ?? new Date(), [tick]);
  const assigneeId = st.session?.role === "consultant" ? st.session.userId : undefined;
  const brief = useMemo(() => buildBrief({ now, companies: st.companies, projects: st.projects, docRequests: st.docRequests, schedules: st.schedules, tasks: st.tasks, inquiries: st.inquiries, activities: st.activities, users: st.users, quotes: st.quotes, assigneeId }), [now, st, assigneeId]);
  const counts = briefSummaryCounts(brief);
  const urgent = brief.filter((b) => b.priority === "urgent");
  const normal = brief.filter((b) => b.priority !== "urgent");

  const byConsultant = st.users.filter((u) => u.role !== "client").map((u) => ({ u, items: brief.filter((b) => { const p = st.projects.find((x) => x.id === b.projectId); const c = st.companies.find((x) => x.id === b.companyId); return p?.consultantId === u.id || (!p && c?.consultantId === u.id); }) })).filter((x) => x.items.length > 0);

  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-2"><Sparkles size={26} className="text-accent" /> AI 브리핑</span>} desc={`${fmtFull(now)} ${fmtClock(now).slice(0, 5)} 기준 · ${user?.name} ${user?.title}님을 위한 오늘의 업무 브리핑`} actions={<AiReadyBadge onClick={() => openAi({ title: "오늘의 업무 브리핑 — AI 적용 설명", key: "brief" })} />} />
      {/* 모바일: 숫자 타일 7개가 화면을 다 먹지 않게 한 줄 칩으로. 이 화면의 본체는 목록이다. */}
      <div className="mb-4 flex flex-wrap gap-1.5 md:hidden">
        {[
          { label: "후속연락", n: counts.followups, hot: true },
          { label: "자료 기한", n: counts.docs, hot: true },
          { label: "정체", n: counts.stalled, hot: true },
          { label: "오늘 미팅", n: counts.meetings },
          { label: "미답변", n: counts.inquiries, hot: true },
          { label: "견적 회신", n: counts.quotes, hot: true },
          { label: "이탈 위험", n: counts.churn, hot: true },
          { label: "재상담", n: counts.reengage },
        ].map((c) => (
          <span key={c.label} className={cx("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.8rem] font-semibold", c.n && c.hot ? "border-error/30 bg-error-bg text-error" : "border-line text-ink-2")}>
            {c.label} <span className="tnum">{c.n}</span>
          </span>
        ))}
      </div>
      <div className="mb-4 hidden gap-3 md:grid md:grid-cols-4 xl:grid-cols-8">
        <KpiCard label="후속연락 필요" value={counts.followups} tone={counts.followups ? "error" : undefined} />
        <KpiCard label="자료 기한 이슈" value={counts.docs} tone={counts.docs ? "error" : undefined} />
        <KpiCard label="정체 프로젝트" value={counts.stalled} tone={counts.stalled ? "error" : undefined} />
        <KpiCard label="오늘 미팅" value={counts.meetings} />
        <KpiCard label="미답변 문의" value={counts.inquiries} tone={counts.inquiries ? "error" : undefined} />
        <KpiCard label="견적 회신 대기" value={counts.quotes} tone={counts.quotes ? "error" : undefined} />
        <KpiCard label="이탈 위험" value={counts.churn} tone={counts.churn ? "error" : undefined} />
        <KpiCard label="재상담 대상" value={counts.reengage} accentValue={counts.reengage > 0} />
      </div>
      <div className="mb-5 hidden md:block"><BriefActionHint items={brief} /></div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle action={<Badge tone="error">{urgent.length}</Badge>}>지금 처리해야 할 것</SectionTitle>
            <BriefList items={urgent} />
          </Card>
          <Card className="p-5">
            <SectionTitle action={<Badge>{normal.length}</Badge>}>오늘 중 확인</SectionTitle>
            <BriefList items={normal} />
          </Card>
        </div>
        <div className="space-y-5">
          {!assigneeId && (
            <Card className="p-5">
              <SectionTitle>담당자별 현황</SectionTitle>
              {byConsultant.length === 0 ? <div className="text-[0.9rem] text-ink-3">담당자별 이슈가 없습니다.</div> : byConsultant.map(({ u, items }) => (
                <div key={u.id} className="flex items-center justify-between border-b border-line py-2.5 last:border-0">
                  <div><div className="font-semibold">{u.name} <span className="text-[0.8rem] text-ink-3">{u.title}</span></div><div className="text-[0.78rem] text-ink-3">{items.slice(0, 2).map((i) => i.title).join(" · ")}</div></div>
                  <Badge tone={items.some((i) => i.priority === "urgent") ? "error" : "neutral"}>{items.length}</Badge>
                </div>
              ))}
            </Card>
          )}
          <Card className="p-5">
            <SectionTitle>판단 규칙 (Explainability)</SectionTitle>
            <ul className="space-y-1.5 text-[0.85rem] text-ink-2">
              <li>· 자료 제출기한이 지났거나 오늘인 경우 → <b>긴급</b></li>
              <li>· 프로젝트 마지막 Activity가 7일 이상 없으면 → <b>정체</b>, 10일 이상 → 긴급</li>
              <li>· 고객 문의 접수 후 24시간 미답변 → <b>긴급</b></li>
              <li>· 업무 기한 초과 → <b>긴급</b></li>
              <li>· 계약 서명 대기 1일 이상 → 확인</li>
              <li>· 오늘 고객 미팅/상담 → 사전자료 확인</li>
              <li>· 견적 발송 후 3일 무회신 → 확인, 7일 이상 또는 유효기간 초과 → <b>긴급</b></li>
              <li>· 접촉 기록이 21일 이상 없으면 → <b>이탈 위험</b>, 35일 이상 → 긴급</li>
              <li>· 마지막 프로젝트 완료 후 30일 경과 + 진행 건 없음 → <b>재상담 대상</b></li>
            </ul>
            <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[0.78rem] text-ink-3">규칙 기반으로 실제 데이터에서 계산됩니다. 각 항목의 실행 버튼은 실제 Action을 호출하므로 처리 이력이 Evidence Log에 그대로 남습니다. LLM은 향후 문장화·요약에만 적용 예정입니다 (AI READY).</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
