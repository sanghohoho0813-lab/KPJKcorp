"use client";

import { cx } from "@/components/ui/ui";

/**
 * 고객 화면 숫자 한 줄 — 큰 숫자 칸 네 개(휴대폰에서 첫 화면을 다 차지하던 것) 대신 한 장의 카드에 네 칸.
 * 숫자는 실제 기록에서 센 값만 받는다.
 */
export function StatStrip({ items }: { items: { label: string; value: number; tone?: "error" | "accent"; note?: string }[] }) {
  return (
    <div className="card grid divide-x divide-line overflow-hidden" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} data-testid="stat-strip">
      {items.map((it) => (
        <div key={it.label} className="min-w-0 px-1.5 py-3 text-center md:px-4 md:py-4">
          <div className={cx("tnum text-[1.5rem] font-extrabold leading-none md:text-[1.9rem]", it.value > 0 && it.tone === "error" && "text-error", it.value > 0 && it.tone === "accent" && "text-accent")}>{it.value}</div>
          <div className="mt-1.5 truncate text-[0.72rem] font-semibold text-ink-2 md:text-[0.82rem]">{it.label}</div>
          {it.note && <div className="mt-0.5 truncate text-[0.66rem] font-semibold text-error md:text-[0.72rem]">{it.note}</div>}
        </div>
      ))}
    </div>
  );
}
