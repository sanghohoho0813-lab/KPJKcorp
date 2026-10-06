"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BellRing, ChevronRight, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtRelative } from "@/lib/format";
import type { Notification } from "@/lib/types";
import { isUnreadFor } from "@/lib/notifications";

/**
 * 다른 기기에서 방금 생긴 일을 화면 구석에 띄운다.
 * 예: 고객이 폰에서 서류를 올리면 대표 PC 에 "○○ 자료 도착 — 확인하기", 담당자가 자료를 요청하면 고객 폰에 "새 자료 요청".
 * 내가 만든 알림은 띄우지 않는다(서버에서 처음 도착한 것만). 30초 뒤 저절로 사라지고, 마우스를 올리면 멈춘다.
 * 고객이 보낸 문의·상담 요청·자료는 놓치면 안 된다 — 왼쪽 색 띠 + 종류 이름으로 한눈에 구분한다.
 */
const KIND: [RegExp, string][] = [
  [/문의/, "고객 문의"], [/상담 요청|관심/, "상담 요청"], [/자료|제출/, "자료 도착"], [/취소/, "요청 취소"], [/견적/, "견적 회신"], [/승인/, "승인"],
];
const kindOf = (title: string) => KIND.find(([re]) => re.test(title))?.[1] ?? "새 알림";
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
  const [hover, setHover] = useState(false);
  const left = useRef(30000);
  useEffect(() => {
    if (hover) return;
    const started = Date.now();
    const t = setTimeout(() => dismiss(n.id), left.current);
    return () => { clearTimeout(t); left.current = Math.max(4000, left.current - (Date.now() - started)); };
  }, [n.id, dismiss, hover]);
  return (
    <div role="status" data-testid="live-popup" data-nid={n.id} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="anim-pop pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-accent/50 bg-surface shadow-2xl ring-4 ring-accent/10">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-accent" />
      <div className="flex items-start gap-3 p-3.5 pl-5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-soft text-accent"><BellRing size={18} /></span>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { markRead(n.id); dismiss(n.id); router.push(n.href); }}>
          <div className="flex items-center gap-1.5 text-[0.75rem] font-bold text-accent"><span className="rounded bg-accent px-1.5 py-px text-[0.68rem] text-accent-ink">{kindOf(n.title)}</span>{who && <span className="truncate">{who}</span>}</div>
          <div className="text-[0.92rem] font-bold leading-snug">{who ? n.title.replace(`: ${who}`, "").replace(who, "").trim() || n.title : n.title}</div>
          {n.body && <div className="mt-0.5 line-clamp-2 text-[0.82rem] text-ink-2">{n.body}</div>}
          <div className="mt-1 flex items-center gap-1 text-[0.78rem] font-semibold text-accent">확인하기 <ChevronRight size={14} /><span className="ml-auto font-normal text-ink-3">{fmtRelative(n.at)}</span></div>
        </button>
        <button type="button" aria-label="알림 닫기" onClick={() => dismiss(n.id)} className="pressable -mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2"><X size={16} /></button>
      </div>
    </div>
  );
}

/**
 * 브라우저 탭 제목 앞에 안 읽은 알림 수 — "(2) KPJK …".
 * 담당자가 다른 탭(메일·엑셀)을 보고 있어도 고객 문의가 왔다는 것을 탭에서 바로 알 수 있다.
 */
export function UnreadTitle({ audience }: { audience: "internal" | "client" }) {
  const n = useStore((s) => s.notifications.filter((x) => x.audience === audience && isUnreadFor(x, s.session?.userId)).length);
  const pathname = usePathname();
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(/^\(\d+\) /, "");
      const next = n ? `(${n}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    // 화면을 옮기면 제목이 새로 붙는다 — 그 뒤에 다시 붙인다
    const t = setTimeout(apply, 300);
    return () => clearTimeout(t);
  }, [n, pathname]);
  return null;
}
