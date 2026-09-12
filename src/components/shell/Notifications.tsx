"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtRelative } from "@/lib/format";
import { cx } from "@/components/ui/ui";

export function NotificationBell({ audience, companyId, className, onNavigate }: { audience: "internal" | "client"; companyId?: string; className?: string; onNavigate?: () => void }) {
  const all = useStore((s) => s.notifications);
  const markRead = useStore((s) => s.markNotificationRead);
  const markAll = useStore((s) => s.markAllRead);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const list = all.filter((n) => n.audience === audience && (!companyId || n.companyId === companyId)).slice(0, 12);
  const unread = list.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className={cx("pressable relative rounded-lg p-2 text-ink-2 hover:bg-surface-2", className)} aria-label="알림">
        <Bell size={20} />
        {/* 안 읽은 알림이 있을 때만 맥박. 읽으면 즉시 멈춘다 — 상태를 말하는 모션이어야 한다. */}
        {unread > 0 && <span key={unread} className="anim-pulse anim-tick tnum absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[0.65rem] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="anim-pop absolute right-0 top-full z-40 mt-2 w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-bold">알림</span>
            <button onClick={() => markAll(audience, companyId)} className="text-[0.8rem] font-semibold text-ink-3 hover:text-ink">모두 읽음</button>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {list.length === 0 && <div className="px-4 py-8 text-center text-[0.9rem] text-ink-3">새 알림이 없습니다.</div>}
            {list.map((n) => (
              <Link key={n.id} href={n.href} onClick={() => { markRead(n.id); setOpen(false); onNavigate?.(); }} className={cx("block border-b border-line px-4 py-3 last:border-0 hover:bg-surface-2", !n.read && "bg-soft/40")}>
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                  <div className="min-w-0">
                    <div className="text-[0.9rem] font-semibold">{n.title}</div>
                    <div className="mt-0.5 line-clamp-2 text-[0.82rem] text-ink-2">{n.body}</div>
                    <div className="mt-1 text-[0.75rem] text-ink-3">{fmtRelative(n.at)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
