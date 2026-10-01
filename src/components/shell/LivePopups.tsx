"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BellRing, ChevronRight, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtRelative } from "@/lib/format";
import type { Notification } from "@/lib/types";

/**
 * 다른 기기에서 방금 생긴 일을 화면 구석에 띄운다.
 * 예: 고객이 폰에서 서류를 올리면 대표 PC 에 "○○ 자료 도착 — 확인하기", 담당자가 자료를 요청하면 고객 폰에 "새 자료 요청".
 * 내가 만든 알림은 띄우지 않는다(서버에서 처음 도착한 것만). 15초 뒤 저절로 사라진다.
 */
export function LivePopups({ audience }: { audience: "internal" | "client" }) {
  // 선택자에서 새 배열을 만들면(?? []) 매번 다른 값이라 무한 렌더가 된다 — 밖에서 기본값
  const liveRaw = useStore((s) => s.live);
  const companies = useStore((s) => s.companies);
  const live = liveRaw ?? [];
  if (!live.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-3 top-[4.5rem] z-[70] flex flex-col items-end gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:top-auto md:w-[380px]" aria-live="polite">
      {live.slice(0, 3).map((n) => (
        <Card key={n.id} n={n} who={audience === "internal" ? companies.find((c) => c.id === n.companyId)?.name : undefined} />
      ))}
    </div>
  );
}

function Card({ n, who }: { n: Notification; who?: string }) {
  const router = useRouter();
  const dismiss = useStore((s) => s.dismissLive);
  const markRead = useStore((s) => s.markNotificationRead);
  useEffect(() => {
    const t = setTimeout(() => dismiss(n.id), 15000);
    return () => clearTimeout(t);
  }, [n.id, dismiss]);
  return (
    <div role="status" data-testid="live-popup" className="anim-pop pointer-events-auto w-full overflow-hidden rounded-2xl border border-accent/40 bg-surface shadow-xl">
      <div className="flex items-start gap-3 p-3.5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-soft text-accent"><BellRing size={18} /></span>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { markRead(n.id); dismiss(n.id); router.push(n.href); }}>
          {who && <div className="truncate text-[0.75rem] font-semibold text-accent">{who}</div>}
          <div className="text-[0.92rem] font-bold leading-snug">{who ? n.title.replace(`: ${who}`, "").replace(who, "").trim() || n.title : n.title}</div>
          {n.body && <div className="mt-0.5 line-clamp-2 text-[0.82rem] text-ink-2">{n.body}</div>}
          <div className="mt-1 flex items-center gap-1 text-[0.78rem] font-semibold text-accent">확인하기 <ChevronRight size={14} /><span className="ml-auto font-normal text-ink-3">{fmtRelative(n.at)}</span></div>
        </button>
        <button type="button" aria-label="알림 닫기" onClick={() => dismiss(n.id)} className="pressable -mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2"><X size={16} /></button>
      </div>
    </div>
  );
}
