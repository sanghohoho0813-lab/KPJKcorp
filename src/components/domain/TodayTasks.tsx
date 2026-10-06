"use client";

import Link from "next/link";
import { Check, ListChecks } from "lucide-react";
import { useStore } from "@/lib/store";
import { daysBetween, isSameDay } from "@/lib/format";
import type { Task } from "@/lib/types";
import { Card, SectionTitle, cx } from "@/components/ui/ui";
import { DueText, PriorityBadge } from "@/components/domain/domain";
import { QuickTaskBar } from "@/components/domain/QuickTaskBar";
import { useMay } from "@/components/domain/EntityModals";

/**
 * 대시보드 "오늘 할 업무" — 업무함까지 가지 않고 여기서 바로 끝내고(체크) 바로 적는다(한 줄 등록).
 * 내 업무 중 기한 초과 + 오늘 마감. 급한 것 → 기한 순.
 */
export function TodayTasksCard({ limit = 5 }: { limit?: number }) {
  const tasks = useStore((s) => s.tasks);
  const companies = useStore((s) => s.companies);
  const me = useStore((s) => s.session?.userId);
  const update = useStore((s) => s.updateTaskStatus);
  const toast = useStore((s) => s.toast);
  const may = useMay();
  const now = new Date();
  const nowIso = now.toISOString();
  const pr = (t: Task) => (t.priority === "urgent" ? 0 : t.priority === "normal" ? 1 : 2);
  const mine = tasks
    .filter((t) => t.assigneeId === me && (t.status === "todo" || t.status === "doing") && (isSameDay(t.dueDate, now) || daysBetween(t.dueDate, nowIso) > 0))
    .sort((a, b) => pr(a) - pr(b) || a.dueDate.localeCompare(b.dueDate));
  const doneToday = tasks.filter((t) => t.assigneeId === me && t.status === "done" && t.completedAt && isSameDay(t.completedAt, now)).length;

  const complete = (t: Task) => {
    if (!me) return;
    const before = t.status;
    update(t.id, "done", me);
    toast(`완료: ${t.title}`, "success", { label: "되돌리기", run: () => update(t.id, before, me) });
  };

  return (
    <Card className="p-5" id="today-tasks">
      <SectionTitle action={<Link href="/ax/tasks" className="link-more">업무함 →</Link>}>
        <span className="flex items-center gap-2"><ListChecks size={18} className="text-accent" /> 오늘 할 업무 <span className="text-[0.85rem] font-semibold text-ink-3">{mine.length}건{doneToday ? ` · 오늘 ${doneToday}건 완료` : ""}</span></span>
      </SectionTitle>
      {mine.length === 0 ? (
        <div className="rounded-xl bg-success-bg/60 px-4 py-3 text-[0.9rem] font-semibold text-success">오늘 마감인 업무를 모두 처리했습니다.</div>
      ) : (
        <ul className="divide-y divide-line" data-testid="today-tasks">
          {mine.slice(0, limit).map((t) => {
            const c = companies.find((x) => x.id === t.companyId);
            return (
              <li key={t.id} className="flex items-start gap-3 py-2.5">
                <button type="button" onClick={() => complete(t)} aria-label={`${t.title} 완료`}
                  className="pressable group relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-line-2 hover:border-accent after:absolute after:-inset-2.5 after:content-[''] md:after:content-none">
                  <Check size={14} className="text-accent opacity-0 group-hover:opacity-60" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {t.priority === "urgent" && <PriorityBadge priority={t.priority} />}
                    <span className="line-clamp-2 font-semibold">{t.title}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[0.8rem] text-ink-3">
                    <DueText iso={t.dueDate} />
                    <span>· {t.type}</span>
                    {c && <Link href={`/ax/clients/${c.id}`} className="-my-1 py-1 hover:text-accent">· {c.name}</Link>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {mine.length > limit && <Link href="/ax/tasks" className={cx("mt-1 block text-center text-[0.82rem] font-semibold text-ink-3 hover:text-ink")}>{mine.length - limit}건 더 보기</Link>}
      {may("task.create") && <QuickTaskBar className="mt-3 border-dashed" />}
    </Card>
  );
}
