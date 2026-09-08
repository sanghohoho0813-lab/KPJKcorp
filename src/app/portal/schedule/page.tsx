"use client";

import { CalendarDays, MapPin } from "lucide-react";
import { useStore, usePortalCompanyId } from "@/lib/store";
import { SCHEDULE_TYPE } from "@/lib/stages";
import { fmtDate, fmtTime, relativeDay, isSameDay } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, cx } from "@/components/ui/ui";

export default function PortalSchedulePage() {
  const st = useStore();
  const companyId = usePortalCompanyId();
  const c = st.companies.find((x) => x.id === companyId);
  const now = new Date();
  const nowIso = now.toISOString();
  const all = st.schedules.filter((s) => s.companyId === companyId && s.visibleToClient).sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = all.filter((s) => s.start >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());
  const past = all.filter((s) => s.start < new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()).reverse();
  const clientLabel = (t: keyof typeof SCHEDULE_TYPE) => (t === "doc_due" ? "자료 제출기한" : t === "report" ? "결과보고" : t === "consult" ? "상담" : t === "followup" ? "담당자 연락 예정" : "미팅");

  const Item = ({ s }: { s: (typeof all)[number] }) => {
    const today = isSameDay(s.start, now);
    return (
      <div className={cx("flex items-start gap-4 rounded-xl border px-4 py-3", today ? "border-accent bg-soft/40" : "border-line")}>
        <div className="tnum w-16 shrink-0 text-center"><div className={cx("text-[0.72rem] font-bold", today ? "text-accent" : "text-ink-3")}>{relativeDay(s.start)}</div><div className="text-[1.05rem] font-bold">{fmtDate(s.start).replace(/(\d+)월 (\d+)일/, "$1/$2")}</div><div className="text-[0.8rem] text-ink-2">{s.type === "doc_due" ? `${fmtTime(s.start)}까지` : fmtTime(s.start)}</div></div>
        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SCHEDULE_TYPE[s.type].color }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="font-bold">{s.title.replace(c?.name ?? "§", "").trim()}</span><Badge>{clientLabel(s.type)}</Badge></div>
          {s.location && <div className="mt-0.5 flex items-center gap-1 text-[0.82rem] text-ink-2"><MapPin size={13} /> {s.location}</div>}
          {s.projectId && <div className="text-[0.75rem] text-ink-3">{st.projects.find((p) => p.id === s.projectId)?.name}</div>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="일정" desc="미팅·상담·자료 제출기한·결과보고 일정입니다. 변경이 필요하면 문의하기로 알려주세요." />
      <Card className="p-5">
        <h2 className="mb-3 text-[1.05rem] font-bold">예정된 일정 <span className="text-ink-3">{upcoming.length}</span></h2>
        {upcoming.length === 0 ? <EmptyState icon={<CalendarDays size={30} />} title="예정된 일정이 없습니다" /> : <div className="space-y-2">{upcoming.map((s) => <Item key={s.id} s={s} />)}</div>}
      </Card>
      {past.length > 0 && (
        <Card className="mt-5 p-5 opacity-80">
          <h2 className="mb-3 text-[1.05rem] font-bold">지난 일정</h2>
          <div className="space-y-2">{past.slice(0, 6).map((s) => <Item key={s.id} s={s} />)}</div>
        </Card>
      )}
      <div className="mt-3 text-[0.78rem] text-ink-3">일정은 담당 컨설턴트가 등록하며 변경 시 알림으로 안내됩니다. 기준 시각: {nowIso.slice(0, 10)}</div>
    </div>
  );
}
