"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useStore, usePortalCompanyId } from "@/lib/store";
import { fmtRelative, fmtDateTime } from "@/lib/format";
import { Button, Card, EmptyState, PageHeader, cx } from "@/components/ui/ui";

export default function PortalNotificationsPage() {
  const companyId = usePortalCompanyId();
  const all = useStore((s) => s.notifications);
  const markRead = useStore((s) => s.markNotificationRead);
  const markAll = useStore((s) => s.markAllRead);
  const list = all.filter((n) => n.audience === "client" && n.companyId === companyId);
  const unread = list.filter((n) => !n.read).length;
  return (
    <div>
      <PageHeader title="알림" desc="자료 요청·검토 결과·일정·결과자료·문의 답변 안내입니다." actions={unread > 0 && <Button variant="outline" size="sm" onClick={() => markAll("client", companyId)}>모두 읽음 ({unread})</Button>} />
      <Card className="overflow-hidden">
        {list.length === 0 ? <EmptyState icon={<Bell size={30} />} title="알림이 없습니다" /> : (
          <div className="divide-y divide-line">
            {list.map((n) => (
              <Link key={n.id} href={n.href} onClick={() => markRead(n.id)} className={cx("block px-5 py-4 hover:bg-surface-2/60", !n.read && "bg-soft/30")}>
                <div className="flex items-start gap-3">
                  <span className={cx("mt-2 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-line-2" : "bg-accent")} />
                  <div className="min-w-0 flex-1"><div className="font-semibold">{n.title}</div><div className="mt-0.5 text-[0.88rem] text-ink-2">{n.body}</div><div className="mt-1 text-[0.75rem] text-ink-3">{fmtRelative(n.at)} · {fmtDateTime(n.at)}</div></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
