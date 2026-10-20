"use client";

import { Icon3D, PORTAL_ICON } from "@/components/domain/portal/Icon3D";
import Link from "next/link";
import { useStore, usePortalCompanyId } from "@/lib/store";
import { fmtRelative, fmtDateTime, fmtTime } from "@/lib/format";
import { groupByDay, type DayGroupKey } from "@/lib/day-groups";
import type { Notification } from "@/lib/types";
import { Button, Card, EmptyState, PageHeader, cx } from "@/components/ui/ui";

/** 묶음 제목이 날짜를 말하니 줄에는 짧게 — 오늘은 "3시간 전", 어제는 시각, 그 전은 날짜 */
const whenOf = (at: string, group: DayGroupKey) => {
  if (group === "today") return fmtRelative(at);
  if (group === "yesterday") return fmtTime(at);
  const d = new Date(at);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

/** 알림이 가리키는 메뉴의 그림 — 아래 탭·바로가기와 같은 그림이라 어디로 가는지 먼저 보인다 */
const iconOf = (href: string) => PORTAL_ICON[href.split(/[?#]/)[0]] ?? "bell";

export default function PortalNotificationsPage() {
  const companyId = usePortalCompanyId();
  const all = useStore((s) => s.notifications);
  const markRead = useStore((s) => s.markNotificationRead);
  const markAll = useStore((s) => s.markAllRead);
  const list = all.filter((n) => n.audience === "client" && n.companyId === companyId).sort((a, b) => b.at.localeCompare(a.at));
  const unread = list.filter((n) => !n.read).length;
  const groups = groupByDay(list, (n) => n.at);
  return (
    <div>
      <PageHeader icon={<Icon3D name="bell" size="2.4rem" />} title="알림"
        desc={unread > 0 ? `읽지 않은 알림 ${unread}건 · 누르면 해당 화면으로 갑니다.` : "자료 요청·검토 결과·일정·결과자료·문의 답변 안내입니다."}
        actions={unread > 0 && <Button variant="outline" size="sm" onClick={() => markAll("client", companyId)}>모두 읽음</Button>} />
      {list.length === 0 ? (
        <Card><EmptyState icon={<Icon3D name="bell" size="3rem" />} title="알림이 없습니다" desc="자료 요청이나 일정이 생기면 여기에 모입니다." /></Card>
      ) : (
        <div className="space-y-5" data-testid="notif-groups">
          {groups.map((g) => (
            <section key={g.key} data-notif-group={g.key} aria-label={g.label}>
              <h2 className="mb-1.5 flex items-baseline gap-2 px-1 text-[0.82rem] font-bold text-ink-2">
                {g.label}
                <span className="font-normal text-ink-3">{g.items.length}</span>
              </h2>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">
                  {g.items.map((n) => <Row key={n.id} n={n} group={g.key} onOpen={() => markRead(n.id)} />)}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ n, group, onOpen }: { n: Notification; group: DayGroupKey; onOpen: () => void }) {
  return (
    <li>
      <Link href={n.href} onClick={onOpen} data-unread={!n.read || undefined}
        className={cx("flex items-start gap-3 px-4 py-3.5 hover:bg-surface-2/60 sm:px-5", !n.read && "bg-soft/40")}>
        <span className="relative mt-0.5">
          <Icon3D name={iconOf(n.href)} size="2rem" muted={n.read} />
          {!n.read && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface" aria-label="읽지 않음" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className={cx("min-w-0 leading-snug", n.read ? "font-medium text-ink-2" : "font-bold")}>{n.title}</div>
            <time dateTime={n.at} className="shrink-0 pt-0.5 text-[0.75rem] text-ink-3" title={fmtDateTime(n.at)}>
              {whenOf(n.at, group)}
            </time>
          </div>
          <div className="mt-0.5 line-clamp-2 text-[0.86rem] leading-relaxed text-ink-2">{n.body}</div>
        </div>
      </Link>
    </li>
  );
}
