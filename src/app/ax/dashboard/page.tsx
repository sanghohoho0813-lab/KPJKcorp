"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, ArrowRight, BookOpen, CalendarDays, FolderOpen, MessageSquare, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { buildBrief, briefSummaryCounts } from "@/lib/brief";
import { daysBetween, isSameDay, fmtRelative, fmtFull, fmtWon } from "@/lib/format";
import { OPP_STATUS } from "@/lib/services";
import { useNow } from "@/lib/hooks";
import { AiReadyBadge, Card, KpiCard, SectionTitle, Badge, IconTile, cx } from "@/components/ui/ui";
import { BriefList, ScheduleItem } from "@/components/domain/domain";
import { CoachCard } from "@/components/domain/Coach";

export default function DashboardPage() {
  const st = useStore();
  const user = useCurrentUser();
  const openAi = useUi((s) => s.openAi);
  const tick = useNow(60000);
  const now = useMemo(() => tick ?? new Date(), [tick]);
  const isConsultant = st.session?.role === "consultant";
  const assigneeId = isConsultant ? st.session?.userId : undefined;

  const brief = useMemo(() => buildBrief({ now, companies: st.companies, projects: st.projects, docRequests: st.docRequests, schedules: st.schedules, tasks: st.tasks, inquiries: st.inquiries, activities: st.activities, users: st.users, quotes: st.quotes, assigneeId }), [now, st.companies, st.projects, st.docRequests, st.schedules, st.tasks, st.inquiries, st.activities, st.users, st.quotes, assigneeId]);
  const counts = briefSummaryCounts(brief);

  const active = st.projects.filter((p) => !["done", "aftercare"].includes(p.stage) && (!assigneeId || p.consultantId === assigneeId));
  const docWaiting = st.docRequests.filter((r) => (r.status === "submitted" || r.status === "reviewing") && (!assigneeId || r.assigneeId === assigneeId)).length;
  const weekSchedules = st.schedules.filter((s) => { const d = daysBetween(now.toISOString(), s.start); return d >= 0 && d <= 7 && (!assigneeId || s.assigneeId === assigneeId); }).sort((a, b) => a.start.localeCompare(b.start));
  const todaySchedules = weekSchedules.filter((s) => isSameDay(s.start, now));
  const openInquiries = st.inquiries.filter((i) => i.status === "open" && (!assigneeId || i.assigneeId === assigneeId)).length;
  const delayed = active.filter((p) => daysBetween(p.stageChangedAt, now.toISOString()) >= 7 || daysBetween(now.toISOString(), p.dueDate) < 0).length;

  // 대표가 막고 있는 것 — 다른 무엇보다 먼저 보여야 팀이 멈추지 않는다.
  const pendingApprovals = st.approvals.filter((a) => a.status === "pending").sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const isAdmin = st.session?.role === "admin";
  const newOpps = st.opportunities.filter((o) => o.status === "interest" && (!assigneeId || o.assigneeId === assigneeId));


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[0.85rem] font-semibold text-ink-3">{fmtFull(now)}</div>
          <h1 className="text-[1.75rem] font-bold md:text-[2rem]">오늘 확인할 일</h1>
          <p className="mt-1 text-[0.95rem] text-ink-2">{user?.name} {user?.title}님, {isConsultant ? "담당 고객 기준으로" : "회사 전체 기준으로"} 먼저 봐야 할 이슈를 우선순위로 정리했습니다.</p>
        </div>
        <Link href="/ax/why" className="pressable hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[0.85rem] font-semibold text-ink-2 hover:bg-surface-2 md:flex">
          <BookOpen size={16} /> 왜 이 AX를 만들었나요? <ArrowRight size={14} />
        </Link>
      </div>

      <CoachCard />

      {/* 첫 화면 숫자는 "지금 문제가 있는 것"만. 상태 숫자는 각 메뉴에서 본다. */}
      <div id="tut-kpi" className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <KpiCard label={isAdmin ? "내 승인 대기" : "대표 승인 대기"} value={pendingApprovals.length} sub={pendingApprovals.length ? (isAdmin ? "지금 확인 필요" : "대표 확인 대기 중") : "대기 없음"} href="/ax/opportunities?tab=approvals" tone={pendingApprovals.length ? "error" : undefined} icon={<IconTile color="var(--mod-alert)" size={32}><ShieldCheck size={16} /></IconTile>} />
        <KpiCard label="자료 검토 대기" value={docWaiting} sub={counts.docs ? `기한 이슈 ${counts.docs}건` : "기한 이슈 없음"} href="/ax/documents" tone={counts.docs ? "error" : undefined} icon={<IconTile color="var(--mod-doc)" size={32}><FolderOpen size={16} /></IconTile>} />
        <KpiCard label="미답변 문의" value={openInquiries} sub={openInquiries ? "답변 필요" : "모두 답변됨"} href="/ax/tasks?tab=inquiry" tone={openInquiries ? "error" : undefined} icon={<IconTile color="var(--mod-customer)" size={32}><MessageSquare size={16} /></IconTile>} />
        <KpiCard label="지연 프로젝트" value={delayed} sub={delayed ? "대표 확인 필요" : "정상"} href="/ax/projects?filter=delayed" tone={delayed ? "error" : undefined} icon={<IconTile color="var(--mod-alert)" size={32}><AlertTriangle size={16} /></IconTile>} />
      </div>

      {pendingApprovals.length > 0 && (
        <Card className="border-accent/50 p-5">
          <SectionTitle action={<Link href="/ax/opportunities?tab=approvals" className="text-[0.85rem] font-semibold text-ink-2 hover:text-ink">전체 보기 →</Link>}>
            <span className="flex items-center gap-2"><ShieldCheck size={18} className="text-accent" /> {isAdmin ? "대표님 확인이 필요합니다" : "대표 승인 대기"}</span>
          </SectionTitle>
          <div className="divide-y divide-line">
            {pendingApprovals.slice(0, 3).map((ap, i) => {
              const co = st.companies.find((c) => c.id === ap.companyId);
              const who = st.users.find((u) => u.id === ap.requestedBy);
              return (
                <Link key={ap.id} href="/ax/opportunities?tab=approvals" className={cx("flex items-center gap-3 py-3 hover:bg-surface-2/60", i >= 2 && "hidden md:flex")}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={ap.kind === "discount" ? "warning" : ap.kind === "promise" ? "info" : "accent"}>{ap.kind === "discount" ? "할인" : ap.kind === "promise" ? "고객 약속" : "제안"}</Badge>
                      {/* 대표가 승인 여부를 판단하려면 무엇을 승인하는지 읽혀야 한다.
                          좁은 화면에서 한 줄로 자르면 제목도 요약도 절반만 보였다. */}
                      <span className="min-w-0 flex-1 line-clamp-2 font-semibold md:line-clamp-1">{ap.title}</span>
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[0.82rem] text-ink-2 md:line-clamp-1">{ap.summary}</div>
                    <div className="mt-0.5 text-[0.78rem] text-ink-3">{co?.name} · {who?.name} {who?.title} 요청 · {fmtRelative(ap.requestedAt)}{ap.baseAmount ? ` · ${fmtWon(ap.baseAmount)} / 할인 ${ap.discountPct}%` : ""}</div>
                  </div>
                  <ArrowRight size={16} className="shrink-0 text-ink-3" />
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card id="tut-brief" className="p-5">
            <SectionTitle action={<div className="flex items-center gap-2"><AiReadyBadge onClick={() => openAi({ title: "오늘의 업무 브리핑 — AI 적용 설명", key: "brief" })} /><Link href="/ax/brief" className="text-[0.85rem] font-semibold text-ink-2 hover:text-ink">전체 보기 →</Link></div>}>
              <span className="flex items-center gap-2"><Sparkles size={18} className="text-accent" /> 오늘의 업무 브리핑</span>
            </SectionTitle>
            <BriefList items={brief} limit={3} />
          </Card>

        </div>

        <div className="space-y-6">
          {newOpps.length > 0 && (
            <Card className="p-5">
              <SectionTitle action={<Link href="/ax/opportunities?tab=pipeline" className="text-[0.85rem] font-semibold text-ink-2 hover:text-ink">기회 →</Link>}>
                <span className="flex items-center gap-2"><TrendingUp size={18} className="text-accent" /> 새 매출기회</span>
              </SectionTitle>
              <div className="divide-y divide-line">
                {newOpps.slice(0, 3).map((o) => (
                  <Link key={o.id} href="/ax/opportunities?tab=pipeline" className="block py-3 hover:bg-surface-2/60">
                    <div className="flex items-center gap-2"><Badge tone={OPP_STATUS[o.status].tone}>{o.source === "rule" ? "규칙 발견" : "고객 관심"}</Badge><span className="min-w-0 flex-1 line-clamp-2 font-semibold md:line-clamp-1">{o.serviceName}</span></div>
                    <div className="mt-0.5 text-[0.8rem] text-ink-3">{st.companies.find((c) => c.id === o.companyId)?.name} · {fmtRelative(o.createdAt)}</div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
          <Card className="p-5">
            <SectionTitle action={<Link href="/ax/schedule" className="text-[0.85rem] font-semibold text-ink-2 hover:text-ink">일정 →</Link>}>
              <span className="flex items-center gap-2"><CalendarDays size={18} className="text-ink-3" /> 이번 주 일정 {todaySchedules.length > 0 && <Badge tone="accent">오늘 {todaySchedules.length}</Badge>}</span>
            </SectionTitle>
            {weekSchedules.length === 0 ? <div className="py-6 text-center text-[0.9rem] text-ink-3">이번 주 일정이 없습니다.</div> : <div className="divide-y divide-line">{weekSchedules.slice(0, 7).map((s, i) => <div key={s.id} className={i >= 4 ? "hidden md:block" : undefined}><ScheduleItem s={s} showCompany /></div>)}</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}
