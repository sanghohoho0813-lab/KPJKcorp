"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtRelative } from "@/lib/format";
import { isUnreadFor } from "@/lib/notifications";
import { groupByDay } from "@/lib/day-groups";
import { cx } from "@/components/ui/ui";

const SHOWN = 12;

export function NotificationBell({ audience, companyId, className, onNavigate }: { audience: "internal" | "client"; companyId?: string; className?: string; onNavigate?: () => void }) {
  const all = useStore((s) => s.notifications);
  const markRead = useStore((s) => s.markNotificationRead);
  const markAll = useStore((s) => s.markAllRead);
  const me = useStore((s) => s.session?.userId);
  const [open, setOpen] = useState(false);
  // 휴대폰: 종 아래에 화면 폭으로 펼친다(종이 오른쪽 끝이 아니라 창이 왼쪽으로 잘리던 문제)
  const [top, setTop] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const mine = all.filter((n) => n.audience === audience && (!companyId || n.companyId === companyId)).sort((a, b) => b.at.localeCompare(a.at));
  const list = mine.slice(0, SHOWN);
  // 숫자는 보이는 12건이 아니라 안 읽은 알림 전체
  const unread = mine.filter((n) => isUnreadFor(n, me)).length;
  const groups = groupByDay(list, (n) => n.at);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", fn);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fn); document.removeEventListener("keydown", esc); };
  }, [open]);

  const toggle = () => {
    if (!open && ref.current) setTop(Math.round(ref.current.getBoundingClientRect().bottom) + 8);
    setOpen((v) => !v);
  };
  const go = (id: string) => { markRead(id); setOpen(false); onNavigate?.(); };

  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} className={cx("pressable relative rounded-lg p-2 text-ink-2 hover:bg-surface-2", className)} aria-label="알림" aria-expanded={open}>
        <Bell size={20} />
        {/* 안 읽은 알림이 있을 때만 맥박. 읽으면 즉시 멈춘다 — 상태를 말하는 모션이어야 한다. */}
        {unread > 0 && <span key={unread} className="anim-pulse anim-tick tnum absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[0.65rem] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div data-testid="bell-panel" style={{ "--bell-top": `${top}px` } as React.CSSProperties}
          className="anim-pop absolute right-0 top-full z-40 mt-2 w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-2xl max-sm:fixed max-sm:inset-x-3 max-sm:top-[var(--bell-top)] max-sm:mt-0 max-sm:w-auto max-sm:max-w-none">
          <div className="flex items-center justify-between border-b border-line py-1.5 pl-4 pr-2">
            <span className="font-bold">알림{unread > 0 && <span className="tnum ml-1.5 text-[0.82rem] font-semibold text-accent-strong">안 읽음 {unread}</span>}</span>
            {unread > 0 && <button onClick={() => markAll(audience, companyId)} className="pressable min-h-10 rounded-lg px-2.5 text-[0.82rem] font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">모두 읽음</button>}
            {unread === 0 && <span className="min-h-10" />}
          </div>
          <div className="max-h-[min(420px,60vh)] overflow-y-auto overscroll-contain">
            {list.length === 0 && <div className="px-4 py-8 text-center text-[0.9rem] text-ink-3">새 알림이 없습니다.</div>}
            {groups.map((g) => (
              <div key={g.key} data-bell-group={g.key}>
                <div className="sticky top-0 z-[1] border-b border-line bg-surface-2/95 px-4 py-1 text-[0.72rem] font-bold text-ink-3 backdrop-blur">{g.label}</div>
                {g.items.map((n) => {
                  const unreadOne = isUnreadFor(n, me);
                  return (
                    <Link key={n.id} href={n.href} onClick={() => go(n.id)} className={cx("block border-b border-line px-4 py-3 last:border-0 hover:bg-surface-2", unreadOne && "bg-soft/40")}>
                      <div className="flex items-start gap-2">
                        <span className={cx("mt-2 h-2 w-2 shrink-0 rounded-full", unreadOne ? "bg-accent" : "bg-transparent")} />
                        <div className="min-w-0 flex-1">
                          <div className={cx("text-[0.9rem]", unreadOne ? "font-bold" : "font-medium text-ink-2")}>{n.title}</div>
                          <div className="mt-0.5 line-clamp-2 text-[0.82rem] text-ink-2">{n.body}</div>
                          <div className="mt-1 text-[0.75rem] text-ink-3">{fmtRelative(n.at)}</div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
          {audience === "client" && (
            <Link href="/portal/notifications" onClick={() => { setOpen(false); onNavigate?.(); }} data-testid="bell-all"
              className="flex min-h-11 items-center justify-center gap-1 border-t border-line text-[0.85rem] font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">
              알림 전체 보기{mine.length > SHOWN ? ` (${mine.length})` : ""} <ChevronRight size={15} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
