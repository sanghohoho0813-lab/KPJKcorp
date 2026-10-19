"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, BookOpen, CalendarDays, FolderOpen, MessageSquare, ListChecks, PhoneCall, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { AxInsightButton } from "@/components/ai/AxInsight";
import { useUi } from "@/lib/ui-store";
import { buildBrief, briefSummaryCounts } from "@/lib/brief";
import { daysBetween, daysLate, isSameDay, fmtRelative, fmtFull, fmtWon } from "@/lib/format";
import { OPP_STATUS } from "@/lib/services";
import { useNow } from "@/lib/hooks";
import { AiReadyBadge, Card, KpiCard, SectionTitle, Badge, IconTile, cx } from "@/components/ui/ui";
import { BriefList, ScheduleItem } from "@/components/domain/domain";
import { FirstRunOrCoach } from "@/components/domain/FirstRun";
import { CeoSummaryCard, OpsStrip } from "@/components/domain/CeoSummary";
import { useContactSources } from "@/components/domain/ContactLog";
import { contactStatus } from "@/lib/contact";
import { TodayTasksCard } from "@/components/domain/TodayTasks";

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

  const docWaiting = st.docRequests.filter((r) => (r.status === "submitted" || r.status === "reviewing") && (!assigneeId || r.assigneeId === assigneeId)).length;
  const weekSchedules = st.schedules.filter((s) => { const d = daysBetween(now.toISOString(), s.start); return d >= 0 && d <= 7 && (!assigneeId || s.assigneeId === assigneeId); }).sort((a, b) => a.start.localeCompare(b.start));
  const todaySchedules = weekSchedules.filter((s) => isSameDay(s.start, now));
  const openInquiries = st.inquiries.filter((i) => i.status === "open" && (!assigneeId || i.assigneeId === assigneeId)).length;
  // 오늘 할 업무(내 것) — 기한 초과 포함. 대표가 아닌 사람의 첫 칸
  const me = st.session?.userId;
  const myOpen = st.tasks.filter((t) => t.assigneeId === me && (t.status === "todo" || t.status === "doing"));
  const overdueMine = myOpen.filter((t) => daysLate(t.dueDate, now) > 0).length;
  const todayMine = myOpen.filter((t) => daysLate(t.dueDate, now) >= 0);
  // 연락 필요 — 설정의 '고객 연락 공백' 기준일을 넘긴 기업 (가까운 미팅이 잡힌 곳은 빼고)
  const { src: contactSrc, cycle } = useContactSources();
  const contactDue = useMemo(() => st.companies.filter((c) => !c.archived && (!assigneeId || c.consultantId === assigneeId) && contactStatus(c, contactSrc, cycle, now).due).length, [st.companies, assigneeId, contactSrc, cycle, now]);

  // 대표가 막고 있는 것 — 다른 무엇보다 먼저 보여야 팀이 멈추지 않는다.
  // 컨설턴트에게는 내가 올린 것만 — 다른 사람 요청은 내가 할 수 있는 일이 없다
  const pendingApprovals = st.approvals.filter((a) => a.status === "pending" && (!isConsultant || a.requestedBy === st.session?.userId)).sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const isAdmin = st.session?.role === "admin";
  const hasCompanies = st.companies.some((c) => !c.archived);
  const newOpps = st.opportunities.filter((o) => o.status === "interest" && (!assigneeId || o.assigneeId === assigneeId));


  const approvalsCard = pendingApprovals.length > 0 ? (
    <Card className="border-accent/50 p-5">
              <SectionTitle action={<Link href="/ax/opportunities?tab=approvals" className="link-more">전체 보기 →</Link>}>
                <span className="flex items-center gap-2"><ShieldCheck size={18} className="text-accent" /> {isAdmin ? "대표님 확인이 필요합니다" : isConsultant ? "내 요청 · 대표 승인 대기" : "대표 승인 대기"}</span>
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
  ) : null;

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[0.85rem] font-semibold text-ink-3">{fmtFull(now)}</div>
          <h1 className="text-[1.75rem] font-bold md:text-[2rem]">오늘 확인할 일</h1>
          <p className="mt-1 text-[0.95rem] text-ink-2">{user?.name} {user?.title}님, {isConsultant ? "담당 고객 기준으로" : "회사 전체 기준으로"} 먼저 봐야 할 이슈를 우선순위로 정리했습니다.</p>
        </div>
        <div className="flex items-center gap-1.5"><AxInsightButton topic="dashboard" /><Link href="/ax/why" className="pressable hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[0.85rem] font-semibold text-ink-2 hover:bg-surface-2 md:flex">
          <BookOpen size={16} /> 왜 이 AX를 만들었나요? <ArrowRight size={14} className="arrow-slide" />
        </Link></div>
      </div>

      <FirstRunOrCoach />

      {/* 첫 화면 숫자는 "지금 처리할 것"만 — 누르면 그 일로 바로 간다. 상태 숫자(운영 현황)는 아래에 둔다 */}
      <div id="tut-kpi" className="kpi-row grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {isAdmin
          ? <KpiCard label="내 승인 대기" value={pendingApprovals.length} sub={pendingApprovals.length ? "지금 확인 필요" : "대기 없음"} href="/ax/opportunities?tab=approvals" tone={pendingApprovals.length ? "error" : undefined} icon={<IconTile color="var(--mod-alert)" size={32}><ShieldCheck size={16} /></IconTile>} />
          : <KpiCard id="kpi-today" label="오늘 할 업무" value={todayMine.length} sub={overdueMine ? `기한 초과 ${overdueMine}건 포함` : todayMine.length ? "오늘 18시까지" : "모두 처리"} href="/ax/tasks" tone={overdueMine ? "error" : undefined} accentValue={!overdueMine && todayMine.length > 0} icon={<IconTile color="var(--mod-ops)" size={32}><ListChecks size={16} /></IconTile>} />}
        <KpiCard label="미답변 문의" value={openInquiries} sub={openInquiries ? "답변 필요" : "모두 답변됨"} href="/ax/tasks?tab=inquiry" tone={openInquiries ? "error" : undefined} icon={<IconTile color="var(--mod-customer)" size={32}><MessageSquare size={16} /></IconTile>} />
        <KpiCard label="자료 검토 대기" value={docWaiting} sub={counts.docs ? `기한 이슈 ${counts.docs}건` : "기한 이슈 없음"} href="/ax/documents" tone={counts.docs ? "error" : undefined} icon={<IconTile color="var(--mod-doc)" size={32}><FolderOpen size={16} /></IconTile>} />
        <KpiCard id="kpi-contact" label="연락 필요" value={contactDue} sub={contactDue ? `${cycle}일 넘게 연락 없음` : "공백 없음"} href="/ax/clients?filter=contact" tone={contactDue ? "error" : undefined} icon={<IconTile color="var(--mod-schedule)" size={32}><PhoneCall size={16} /></IconTile>} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {/* 대표: 팀이 기다리는 결정이 맨 앞 — 대표가 막고 있으면 다른 일이 멈춘다 */}
          {isAdmin && approvalsCard}
          {/* 오늘 할 업무 — 여기서 바로 체크하고 바로 적는다 (업무함까지 가지 않게) */}
          {hasCompanies && <TodayTasksCard />}
          <Card id="tut-brief" className="p-5">
            <SectionTitle action={<div className="flex items-center gap-2"><AiReadyBadge onClick={() => openAi({ title: "오늘의 업무 브리핑 — AI 적용 설명", key: "brief" })} /><Link href="/ax/brief" className="link-more">전체 보기 →</Link></div>}>
              <span className="flex items-center gap-2"><Sparkles size={18} className="text-accent" /> 오늘의 업무 브리핑</span>
            </SectionTitle>
            <BriefList items={brief} limit={3} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle action={<Link href="/ax/schedule" className="link-more">일정 →</Link>}>
              <span className="flex items-center gap-2"><CalendarDays size={18} className="text-ink-3" /> 이번 주 일정 {todaySchedules.length > 0 && <Badge tone="accent">오늘 {todaySchedules.length}</Badge>}</span>
            </SectionTitle>
            {weekSchedules.length === 0 ? <div className="py-6 text-center text-[0.9rem] text-ink-3">이번 주 일정이 없습니다.</div> : <div className="divide-y divide-line">{weekSchedules.slice(0, 7).map((s, i) => <div key={s.id} className={i >= 4 ? "hidden md:block" : undefined}><ScheduleItem s={s} showCompany compact /></div>)}</div>}
          </Card>
          {newOpps.length > 0 && (
            <Card className="p-5">
              <SectionTitle action={<Link href="/ax/opportunities?tab=pipeline" className="link-more">기회 →</Link>}>
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
          {/* 컨설턴트: 내가 올린 요청이 대표 결정을 기다리는 중 — 할 일은 아니라 오른쪽에 */}
          {!isAdmin && approvalsCard}
        </div>
      </div>

      {/* 운영 현황 — 상태 숫자(계약 별지의 6개 상태)와 대표자용 요약. 매일 바뀌는 할 일 아래에 둔다 */}
      {hasCompanies && (
        <div className="space-y-6" id="dash-status">
          <OpsStrip />
          <CeoSummaryCard />
        </div>
      )}
    </div>
  );
}
