"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckSquare, Pencil, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { daysBetween, fmtDate, isSameDay } from "@/lib/format";
import type { Task, TaskStatus } from "@/lib/types";
import { Badge, Button, Card, EmptyState, KpiCard, PageHeader, SegmentedControl, Tabs, cx } from "@/components/ui/ui";
import { DueText, PriorityBadge, TaskStatusBadge } from "@/components/domain/domain";
import { NewTaskModal } from "@/components/domain/CreateModals";
import { EditTaskModal, useMay } from "@/components/domain/EntityModals";
import { ruleOfTask } from "@/lib/rules";
import { InquiryConsole } from "@/components/domain/InquiryConsole";

type Filter = "today" | "open" | "overdue" | "done" | "all";

function TasksInner() {
  const st = useStore();
  const update = useStore((s) => s.updateTaskStatus);
  const toast = useStore((s) => s.toast);
  const params = useSearchParams();
  const [tab, setTab] = useState<"task" | "inquiry">(params.get("tab") === "inquiry" ? "inquiry" : "task");
  const [filter, setFilter] = useState<Filter>("today");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const may = useMay();
  const now = new Date();
  const nowIso = now.toISOString();
  const me = st.session?.role === "consultant" ? st.session.userId : undefined;
  const all = useMemo(() => st.tasks.filter((t) => !me || t.assigneeId === me), [st.tasks, me]);
  const openTasks = all.filter((t) => t.status === "todo" || t.status === "doing");
  const today = openTasks.filter((t) => isSameDay(t.dueDate, now) || daysBetween(t.dueDate, nowIso) > 0);
  const overdue = openTasks.filter((t) => daysBetween(t.dueDate, nowIso) > 0);
  const done = all.filter((t) => t.status === "done");

  const rows = (filter === "today" ? today : filter === "open" ? openTasks : filter === "overdue" ? overdue : filter === "done" ? done : all).slice().sort((a, b) => {
    const pr = (t: Task) => (t.priority === "urgent" ? 0 : t.priority === "normal" ? 1 : 2);
    return pr(a) - pr(b) || a.dueDate.localeCompare(b.dueDate);
  });

  const setStatus = (t: Task, s: TaskStatus) => {
    update(t.id, s, st.session?.userId ?? "u_admin");
    if (s === "done") toast(`완료 처리: ${t.title}`);
  };

  return (
    <div>
      <PageHeader
        title="업무함"
        desc="내가 처리할 업무와 고객 문의를 한 곳에서 봅니다. 고객이 자료를 제출하거나 문의를 남기면 여기에 자동으로 생깁니다."
        actions={tab === "task" ? <Button variant="accent" icon={<Plus size={16} />} onClick={() => setOpen(true)}>업무 등록</Button> : undefined}
      />
      <Tabs
        tabs={[
          { key: "task", label: "내 업무", count: openTasks.length },
          { key: "inquiry", label: "고객 문의", count: st.inquiries.filter((i) => i.status === "open" && (!me || i.assigneeId === me)).length },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "inquiry" ? <div className="mt-5"><InquiryConsole embedded /></div> : <>
      <div className="mb-5 mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="오늘 처리" value={today.length} sub={overdue.length ? `기한 초과 ${overdue.length} 포함` : "기한 내"} accentValue={today.length > 0} />
        <KpiCard label="기한 초과" value={overdue.length} sub="먼저 처리" tone={overdue.length ? "error" : undefined} />
        <KpiCard label="미완료 전체" value={openTasks.length} sub={`자동 생성 ${openTasks.filter((t) => t.source === "auto").length}건`} />
        <KpiCard label="완료" value={done.length} sub="누적" />
      </div>
      <div className="mb-4"><SegmentedControl size="sm" value={filter} onChange={setFilter} options={[{ key: "today", label: "오늘" }, { key: "open", label: "미완료" }, { key: "overdue", label: "기한 초과" }, { key: "done", label: "완료" }, { key: "all", label: "전체" }]} /></div>
      <Card className="overflow-hidden">
        {rows.length === 0 ? <EmptyState icon={<CheckSquare size={30} />} title="해당 조건의 업무가 없습니다" desc={filter === "today" ? "오늘 처리할 업무를 모두 마쳤습니다." : undefined} /> : (
          <div className="divide-y divide-line">
            {rows.map((t) => {
              const c = st.companies.find((x) => x.id === t.companyId);
              const isDone = t.status === "done";
              return (
                <div key={t.id} className={cx("flex items-center gap-3 px-4 py-3 md:px-5", isDone && "opacity-60")}>
                  <button onClick={() => setStatus(t, isDone ? "todo" : "done")} // 체크박스는 이 화면에서 가장 자주 누르는 버튼이다. 보이는 크기는 24px로 두되
                    // 실제 터치 영역만 44px로 넓힌다(after 의사요소).
                    className={cx("pressable relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors after:absolute after:-inset-2.5 after:content-[''] md:after:content-none", isDone ? "border-success bg-success text-white" : "border-line-2 hover:border-accent")} aria-label={isDone ? "완료 취소" : "완료"}>
                    {isDone && <CheckSquare size={14} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={t.priority} />
                      <span className={cx("font-semibold", isDone && "line-through")}>{t.title}</span>
                      {t.ruleKey ? <Badge tone="info" >규칙 · {ruleOfTask(t.ruleKey)?.label.split(" ")[0] ?? "자동"}</Badge> : t.source === "auto" && <Badge tone="info">자동</Badge>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-[0.8rem] text-ink-3">
                      <span>{t.type}</span>
                      {c && <Link href={`/ax/clients/${c.id}`} className="hover:text-accent">· {c.name}</Link>}
                      <span>· {st.users.find((u) => u.id === t.assigneeId)?.name}</span>
                      {t.memo && <span>· {t.memo}</span>}
                      {t.completedAt && <span>· 완료 {fmtDate(t.completedAt)}</span>}
                    </div>
                  </div>
                  <div className="hidden w-24 text-right sm:block">{!isDone && <DueText iso={t.dueDate} />}</div>
                  <div className="flex items-center gap-1">
                    <TaskStatusBadge status={t.status} />
                    {!isDone && t.status !== "doing" && <Button size="sm" variant="ghost" onClick={() => setStatus(t, "doing")}>시작</Button>}
                    {!isDone && t.status !== "hold" && <Button size="sm" variant="ghost" onClick={() => setStatus(t, "hold")}>보류</Button>}
                    {may("task.update") && (
                      <button onClick={() => setEditId(t.id)} aria-label={`${t.title} 수정`} className="pressable rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink">
                        <Pencil size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      </>}
      <EditTaskModal open={!!editId} taskId={editId} onClose={() => setEditId(null)} />
      <NewTaskModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export default function TasksPage() {
  return <Suspense><TasksInner /></Suspense>;
}
