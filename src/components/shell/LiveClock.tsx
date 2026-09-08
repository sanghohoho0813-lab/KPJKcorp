"use client";

import { useNow } from "@/lib/hooks";
import { fmtClock, fmtCompact, fmtMobileDate } from "@/lib/format";

export function LiveClock({ compact, className }: { compact?: boolean; className?: string }) {
  const now = useNow(1000);
  if (!now) return <span className={className} style={{ minWidth: compact ? 88 : 200 }} />;
  if (compact)
    return (
      <span className={`tnum flex flex-col items-end whitespace-nowrap leading-tight ${className ?? ""}`}>
        <span className="text-[0.72rem] font-semibold text-ink-2">{fmtMobileDate(now)}</span>
        <span className="text-[0.85rem] font-bold">{fmtClock(now)}</span>
      </span>
    );
  return (
    <span className={`tnum flex items-baseline gap-2 whitespace-nowrap ${className ?? ""}`}>
      <span className="text-[0.8rem] font-semibold text-ink-2">{fmtCompact(now)}</span>
      <span className="text-[0.95rem] font-bold">{fmtClock(now)}</span>
    </span>
  );
}
