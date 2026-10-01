"use client";

import Link from "next/link";
import { ArrowRight, Bell, FileCheck2, Pin } from "lucide-react";
import { useStore, usePortalCompanyId, useCurrentUser } from "@/lib/store";
import { fmtDate, fmtRelative, fmtTime } from "@/lib/format";
import { Card } from "@/components/ui/ui";
import { ProgramTeaser } from "@/components/domain/programs/ProgramTeaser";
import { ActiveGrowth, CompanyStatusCard, GrowthHistory, NextGrowth, NowActions, useGrowth } from "@/components/domain/portal/GrowthBoard";
import { NoticeList, liveNoticesFor } from "@/components/domain/Notices";

export default function PortalHome() {
  const st = useStore();
  const companyId = usePortalCompanyId();
  const user = useCurrentUser();
  const c = st.companies.find((x) => x.id === companyId);
  // 성장과제 판 — 기업정보·프로젝트·제안·요청자료·견적·결과·일정을 한 흐름으로 (lib/growth)
  const board = useGrowth(c);
  if (!c || !board) return null;
  const isClient = st.session?.role === "client";
  const displayName = isClient ? `${user?.name} ${user?.title}` : `${c.contactName} ${c.contactTitle}`;
  const now = new Date().toISOString();

  const next = st.schedules.filter((s) => s.companyId === c.id && s.visibleToClient && s.start >= now).sort((a, b) => a.start.localeCompare(b.start))[0];
  const notifs = st.notifications.filter((n) => n.audience === "client" && n.companyId === c.id).slice(0, 3);
  // 고정 공지는 진행률보다 먼저 — 담당자가 "꼭 읽어 주세요"라고 표시한 것이다
  const pinned = liveNoticesFor(st.notices, c.id, now).filter((n) => n.pinned);
  const openIq = st.inquiries.filter((i) => i.companyId === c.id && i.status === "open").length;
  const results = st.results.filter((r) => r.companyId === c.id).length;
  const consultant = st.users.find((u) => u.id === c.consultantId);

  return (
    <div className="space-y-5">
      {pinned.length > 0 && (
        <Card className="p-4 md:p-5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[0.95rem] font-bold"><Pin size={16} className="text-accent" /> 담당자 공지</span>
            <Link href="/portal/schedule#notices" className="link-more">전체 보기 →</Link>
          </div>
          <NoticeList items={pinned} limit={2} compact />
        </Card>
      )}
      <CompanyStatusCard company={c} board={board}
        greeting={<>안녕하세요, <b className="text-ink">{c.name} {displayName}</b>님.</>}
        footer={<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-ink-3">
          <span>담당 컨설턴트 <b className="text-ink-2">{consultant?.name} {consultant?.title}</b></span>
          {next && <Link href="/portal/schedule" className="hover:text-accent">다음 일정 <b className="text-ink-2">{fmtDate(next.start)} {fmtTime(next.start)} {next.title.replace(c.name, "").trim()}</b></Link>}
          {openIq > 0 && <Link href="/portal/inquiries" className="hover:text-accent">답변 대기 문의 <b className="text-ink-2">{openIq}건</b></Link>}
        </div>} />

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <NowActions actions={board.actions} companyId={c.id} />
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-[1.1rem] font-bold"><Bell size={18} className="text-ink-3" /> 최근 안내</h2><Link href="/portal/notifications" className="link-more">전체 보기 →</Link></div>
          {notifs.length === 0 ? <div className="text-[0.9rem] text-ink-3">새 안내가 없습니다.</div> : (
            <div className="divide-y divide-line">
              {notifs.map((n) => (
                <Link key={n.id} href={n.href} className="block py-2.5"><div className="flex items-center gap-2">{!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}<span className="font-semibold">{n.title}</span></div><div className="mt-0.5 line-clamp-2 text-[0.82rem] text-ink-2">{n.body}</div><div className="text-[0.75rem] text-ink-3">{fmtRelative(n.at)}</div></Link>
              ))}
            </div>
          )}
          {results > 0 && <Link href="/portal/results" className="mt-3 flex items-center justify-between rounded-xl bg-surface-2 px-4 py-2.5 text-[0.88rem] font-semibold"><span className="flex items-center gap-2"><FileCheck2 size={16} className="text-success" /> 완료자료 {results}건</span><ArrowRight size={14} /></Link>}
        </Card>
      </div>

      <ProgramTeaser company={c} />
      <ActiveGrowth items={board.active} />
      <NextGrowth board={board} companyId={c.id} />
      <GrowthHistory board={board} companyId={c.id} />
    </div>
  );
}
