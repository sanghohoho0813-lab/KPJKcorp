"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, ArrowRight, BookOpen, Briefcase, CalendarDays, FolderOpen, MessageSquare, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { buildBrief, briefSummaryCounts } from "@/lib/brief";
import { daysBetween, isSameDay, fmtRelative, fmtFull, fmtWon } from "@/lib/format";
import { stageLabel } from "@/lib/stages";
import { OPP_STATUS } from "@/lib/services";
import { useNow } from "@/lib/hooks";
import { AiReadyBadge, Card, KpiCard, SectionTitle, Badge, IconTile } from "@/components/ui/ui";
import { BriefList, ScheduleItem, StageBadge, StageProgressBar } from "@/components/domain/domain";

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
  const liveOpps = st.opportunities.filter((o) => !["won", "dropped"].includes(o.status) && (!assigneeId || o.assigneeId === assigneeId));

  // 먼저 확인할 기업 — companies with urgent brief items
  const focusCompanies = Array.from(new Set(brief.filter((b) => b.companyId).map((b) => b.companyId!))).slice(0, 4).map((cid) => {
    const c = st.companies.find((x) => x.id === cid)!;
    const p = st.projects.find((x) => x.companyId === cid && !["done", "aftercare"].includes(x.stage));
    const issues = brief.filter((b) => b.companyId === cid);
    return { c, p, issues };
  });

  const recentInquiries = st.inquiries.filter((i) => !assigneeId || i.assigneeId === assigneeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);

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

      <div id="tut-kpi" className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-6">
        <KpiCard label={isAdmin ? "내 승인 대기" : "대표 승인 대기"} value={pendingApprovals.length} sub={pendingApprovals.length ? (isAdmin ? "지금 확인 필요" : "대표 확인 대기 중") : "대기 없음"} href="/ax/opportunities?tab=approvals" tone={pendingApprovals.length ? "error" : undefined} icon={<IconTile color="var(--mod-alert)" size={32}><ShieldCheck size={16} /></IconTile>} />
        <KpiCard label="매출기회" value={liveOpps.length} sub={newOpps.length ? `새 관심 ${newOpps.length}건` : "진행 중"} href="/ax/opportunities?tab=pipeline" accentValue={newOpps.length > 0} icon={<IconTile color="var(--mod-sales)" size={32}><TrendingUp size={16} /></IconTile>} />
        <KpiCard label="진행 중 프로젝트" value={active.length} sub={`전체 ${st.projects.length}건`} href="/ax/projects" icon={<IconTile color="var(--mod-ops)" size={32}><Briefcase size={16} /></IconTile>} />
        <KpiCard label="자료 검토 대기" value={docWaiting} sub={counts.docs ? `기한 이슈 ${counts.docs}건` : "기한 이슈 없음"} href="/ax/documents" tone={counts.docs ? "error" : undefined} icon={<IconTile color="var(--mod-doc)" size={32}><FolderOpen size={16} /></IconTile>} />
        <KpiCard label="미처리 문의" value={openInquiries} sub={openInquiries ? "답변 필요" : "모두 답변됨"} href="/ax/inquiries" tone={openInquiries ? "error" : undefined} icon={<IconTile color="var(--mod-customer)" size={32}><MessageSquare size={16} /></IconTile>} />
        <KpiCard label="지연 프로젝트" value={delayed} sub={delayed ? "대표 확인 필요" : "정상"} href="/ax/projects?filter=delayed" tone={delayed ? "error" : undefined} icon={<IconTile color="var(--mod-alert)" size={32}><AlertTriangle size={16} /></IconTile>} />
      </div>

      {pendingApprovals.length > 0 && (
        <Card className="border-accent/50 p-5">
          <SectionTitle action={<Link href="/ax/opportunities?tab=approvals" className="text-[0.85rem] font-semibold text-ink-2 hover:text-ink">전체 보기 →</Link>}>
            <span className="flex items-center gap-2"><ShieldCheck size={18} className="text-accent" /> {isAdmin ? "대표님 확인이 필요합니다" : "대표 승인 대기"}</span>
          </SectionTitle>
          <div className="divide-y divide-line">
            {pendingApprovals.slice(0, 3).map((ap) => {
              const co = st.companies.find((c) => c.id === ap.companyId);
              const who = st.users.find((u) => u.id === ap.requestedBy);
              return (
                <Link key={ap.id} href="/ax/opportunities?tab=approvals" className="flex items-center gap-3 py-3 hover:bg-surface-2/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={ap.kind === "discount" ? "warning" : ap.kind === "promise" ? "info" : "accent"}>{ap.kind === "discount" ? "할인" : ap.kind === "promise" ? "고객 약속" : "제안"}</Badge>
                      <span className="truncate font-semibold">{ap.title}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[0.82rem] text-ink-2">{ap.summary}</div>
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
            <div className="mb-3 flex flex-wrap gap-2 text-[0.82rem]">
              <Badge tone={counts.followups ? "error" : "neutral"}>후속연락 필요 {counts.followups}</Badge>
              <Badge tone={counts.docs ? "error" : "neutral"}>자료 기한 이슈 {counts.docs}</Badge>
              <Badge tone={counts.stalled ? "warning" : "neutral"}>정체 프로젝트 {counts.stalled}</Badge>
              <Badge tone="info">오늘 미팅 {counts.meetings}</Badge>
              <Badge tone={counts.inquiries ? "error" : "neutral"}>미답변 문의 {counts.inquiries}</Badge>
            </div>
            <BriefList items={brief} limit={5} />
          </Card>

          <Card className="p-5">
            <SectionTitle action={<Link href="/ax/clients" className="text-[0.85rem] font-semibold text-ink-2 hover:text-ink">기업고객 →</Link>}>먼저 확인할 기업</SectionTitle>
            {focusCompanies.length === 0 ? (
              <div className="py-6 text-center text-[0.9rem] text-ink-3">지금 특별히 확인할 기업이 없습니다.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {focusCompanies.map(({ c, p, issues }) => (
                  <Link key={c.id} href={`/ax/clients/${c.id}`} className="card card-hover block p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[1rem] font-bold">{c.name}</div>
                        <div className="text-[0.8rem] text-ink-3">{c.industry} · 담당 {st.users.find((u) => u.id === c.consultantId)?.name}</div>
                      </div>
                      {p && <StageBadge stage={p.stage} />}
                    </div>
                    {p && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[0.8rem] text-ink-2"><span>{p.name}</span><span>{stageLabel(p.stage)}</span></div>
                        <StageProgressBar stage={p.stage} className="mt-1.5" />
                      </div>
                    )}
                    <div className="mt-3 space-y-1">
                      {issues.slice(0, 2).map((i) => (
                        <div key={i.id} className="flex items-center gap-1.5 text-[0.82rem] text-error"><AlertTriangle size={13} /> {i.title.replace(c.name, "").trim()}</div>
                      ))}
                    </div>
                    <div className="mt-2 text-[0.82rem] font-semibold text-accent">다음 Action: {issues[0]?.nextAction}</div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle action={<Link href="/ax/projects" className="text-[0.85rem] font-semibold text-ink-2 hover:text-ink">전체 →</Link>}>최근 프로젝트 현황</SectionTitle>
            <div className="divide-y divide-line">
              {active.slice(0, 5).map((p) => {
                const c = st.companies.find((x) => x.id === p.companyId);
                const docs = st.docRequests.filter((d) => d.projectId === p.id);
                const missing = docs.filter((d) => d.status === "requested" || d.status === "revision").length;
                return (
                  <Link key={p.id} href={`/ax/projects/${p.id}`} className="flex items-center gap-3 py-3 hover:bg-surface-2/60">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><span className="truncate font-semibold">{c?.name}</span><span className="truncate text-[0.85rem] text-ink-2">{p.name}</span></div>
                      <StageProgressBar stage={p.stage} className="mt-1.5 max-w-xs" />
                    </div>
                    <div className="hidden text-right text-[0.8rem] text-ink-3 sm:block">{missing ? <span className="text-error">미제출 {missing}</span> : "자료 완료"}<br />마감 {daysBetween(now.toISOString(), p.dueDate)}일</div>
                    <StageBadge stage={p.stage} />
                  </Link>
                );
              })}
            </div>
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
                    <div className="flex items-center gap-2"><Badge tone={OPP_STATUS[o.status].tone}>{o.source === "rule" ? "규칙 발견" : "고객 관심"}</Badge><span className="truncate font-semibold">{o.serviceName}</span></div>
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
            {weekSchedules.length === 0 ? <div className="py-6 text-center text-[0.9rem] text-ink-3">이번 주 일정이 없습니다.</div> : <div className="divide-y divide-line">{weekSchedules.slice(0, 7).map((s) => <ScheduleItem key={s.id} s={s} showCompany />)}</div>}
          </Card>
          <Card className="p-5">
            <SectionTitle action={<Link href="/ax/inquiries" className="text-[0.85rem] font-semibold text-ink-2 hover:text-ink">문의 →</Link>}>최근 고객 문의</SectionTitle>
            <div className="divide-y divide-line">
              {recentInquiries.map((iq) => (
                <Link key={iq.id} href={`/ax/inquiries?focus=${iq.id}`} className="block py-3 hover:bg-surface-2/60">
                  <div className="flex items-center gap-2"><Badge tone={iq.status === "open" ? "error" : "success"}>{iq.status === "open" ? "미답변" : "답변완료"}</Badge><span className="truncate font-semibold">{iq.title}</span></div>
                  <div className="mt-0.5 text-[0.8rem] text-ink-3">{st.companies.find((c) => c.id === iq.companyId)?.name} · {fmtRelative(iq.createdAt)}</div>
                </Link>
              ))}
            </div>
          </Card>
          <Link href="/ax/why" className="card card-hover flex items-center gap-3 p-4 md:hidden">
            <IconTile color="var(--mod-ai)"><BookOpen size={18} /></IconTile>
            <div className="flex-1 text-[0.9rem] font-semibold">왜 이 AX를 만들었나요?</div>
            <ArrowRight size={16} className="text-ink-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
