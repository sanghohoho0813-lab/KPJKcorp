"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { SCHEDULE_TYPE } from "@/lib/stages";
import { isSameDay, fmtTime } from "@/lib/format";
import { Badge, Button, Card, PageHeader, SegmentedControl, cx, EmptyState } from "@/components/ui/ui";
import { ScheduleItem } from "@/components/domain/domain";
import { NewScheduleModal } from "@/components/domain/CreateModals";
import { EditScheduleModal, useMay } from "@/components/domain/EntityModals";

export default function SchedulePage() {
  const st = useStore();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState<Date>(new Date());
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const may = useMay();
  const me = st.session?.role === "consultant" ? st.session.userId : undefined;
  const now = new Date();
  const all = st.schedules.filter((s) => !me || s.assigneeId === me).sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = all.filter((s) => new Date(s.start) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()));

  // group upcoming by day
  const groupMap = new Map<string, typeof upcoming>();
  for (const s of upcoming) {
    const k = s.start.slice(0, 10);
    groupMap.set(k, [...(groupMap.get(k) ?? []), s]);
  }
  const groups = Array.from(groupMap.entries());

  // calendar grid
  const cells = useMemo(() => {
    const first = new Date(cursor);
    const startDay = first.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (arr.length % 7) arr.push(null);
    return arr;
  }, [cursor]);
  const daySchedules = all.filter((s) => isSameDay(s.start, selected));

  return (
    <div>
      <PageHeader title="일정" desc="상담·미팅·자료 제출기한·내부 마감·후속연락을 하나의 일정에서 관리합니다. 모든 일정은 기업·프로젝트와 연결됩니다." actions={<><SegmentedControl value={view} onChange={setView} options={[{ key: "list", label: <span className="flex items-center gap-1"><List size={14} /> 목록</span> }, { key: "calendar", label: <span className="flex items-center gap-1"><CalendarDays size={14} /> 달력</span> }]} /><Button variant="accent" icon={<Plus size={16} />} onClick={() => setOpen(true)}>일정 등록</Button></>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(SCHEDULE_TYPE) as (keyof typeof SCHEDULE_TYPE)[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-[0.78rem] text-ink-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SCHEDULE_TYPE[k].color }} />{SCHEDULE_TYPE[k].label}</span>
        ))}
      </div>
      {view === "list" ? (
        <div className="space-y-4">
          {groups.length === 0 && <Card><EmptyState icon={<CalendarDays size={30} />} title="예정된 일정이 없습니다" action={<Button variant="outline" onClick={() => setOpen(true)}>일정 등록</Button>} /></Card>}
          {groups.map(([day, items]) => {
            const d = new Date(day + "T00:00:00");
            const today = isSameDay(d.toISOString(), now);
            return (
              <Card key={day} className="p-5">
                <div className="mb-1 flex items-center gap-2"><span className={cx("text-[1rem] font-bold", today && "text-accent")}>{d.getMonth() + 1}월 {d.getDate()}일 ({["일", "월", "화", "수", "목", "금", "토"][d.getDay()]})</span>{today && <Badge tone="accent">오늘</Badge>}<span className="text-[0.8rem] text-ink-3">{items.length}건</span></div>
                <div className="divide-y divide-line">{items.map((s) => <ScheduleItem key={s.id} s={s} showCompany onEdit={may("schedule.update") ? setEditId : undefined} />)}</div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card className="p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="pressable rounded-lg p-2 hover:bg-surface-2" aria-label="이전 달"><ChevronLeft size={18} /></button>
              <span className="text-[1.1rem] font-bold">{cursor.getFullYear()}년 {cursor.getMonth() + 1}월</span>
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="pressable rounded-lg p-2 hover:bg-surface-2" aria-label="다음 달"><ChevronRight size={18} /></button>
            </div>
            <div className="grid grid-cols-7 text-center text-[0.75rem] font-bold text-ink-3">{["일", "월", "화", "수", "목", "금", "토"].map((w) => <div key={w} className="py-1">{w}</div>)}</div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const items = all.filter((s) => isSameDay(s.start, d));
                const isToday = isSameDay(d.toISOString(), now);
                const isSel = isSameDay(d.toISOString(), selected);
                return (
                  <button key={i} onClick={() => setSelected(d)} className={cx("pressable flex min-h-[64px] flex-col items-start rounded-lg border p-1.5 text-left transition-colors md:min-h-[80px]", isSel ? "border-accent bg-soft/50" : "border-line hover:bg-surface-2")}>
                    <span className={cx("tnum text-[0.8rem] font-bold", isToday ? "rounded-md bg-accent px-1.5 text-accent-ink" : "text-ink-2")}>{d.getDate()}</span>
                    <div className="mt-1 flex flex-wrap gap-0.5">{items.slice(0, 4).map((s) => <span key={s.id} className="h-1.5 w-1.5 rounded-full" style={{ background: SCHEDULE_TYPE[s.type].color }} />)}</div>
                    {items[0] && <span className="mt-0.5 hidden w-full truncate text-[0.68rem] text-ink-2 md:block">{items[0].title}</span>}
                  </button>
                );
              })}
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-2 text-[1rem] font-bold">{selected.getMonth() + 1}월 {selected.getDate()}일 일정</div>
            {daySchedules.length === 0 ? <div className="py-6 text-center text-[0.9rem] text-ink-3">일정이 없습니다.</div> : <div className="divide-y divide-line">{daySchedules.map((s) => <ScheduleItem key={s.id} s={s} showCompany onEdit={may("schedule.update") ? setEditId : undefined} />)}</div>}
          </Card>
        </div>
      )}
      <EditScheduleModal open={!!editId} scheduleId={editId} onClose={() => setEditId(null)} />
      <NewScheduleModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export { fmtTime };
