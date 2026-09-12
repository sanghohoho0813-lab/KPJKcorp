"use client";

import { useStore } from "@/lib/store";
import type { FontScale } from "@/lib/types";
import { cx } from "@/components/ui/ui";

/**
 * 글자 크기 조절.
 *
 * 기준점은 "지금까지 쓰던 크기"(s = 19px)이고 위로만 커진다. 더 작게 만들 수 있게
 * 열어두면 대표님이 화면에 담기는 정보량을 늘리려고 계속 줄이게 되는데,
 * 그 방향은 이미 한 번 검토해서 가독성 문제로 되돌린 적이 있다.
 */
export const FONT_STEPS: { key: FontScale; label: string; px: number }[] = [
  { key: "s", label: "기본", px: 19 },
  { key: "m", label: "크게", px: 21 },
  { key: "l", label: "더 크게", px: 23 },
  { key: "xl", label: "최대", px: 25 },
];

export function useFontScale() {
  const value = useStore((s) => s.settings.fontScale);
  const setSettings = useStore((s) => s.setSettings);
  const idx = Math.max(0, FONT_STEPS.findIndex((f) => f.key === value));
  return {
    value: FONT_STEPS[idx].key,
    label: FONT_STEPS[idx].label,
    idx,
    set: (k: FontScale) => setSettings({ fontScale: k }),
    step: (d: 1 | -1) => {
      const next = FONT_STEPS[Math.min(FONT_STEPS.length - 1, Math.max(0, idx + d))];
      if (next.key !== FONT_STEPS[idx].key) setSettings({ fontScale: next.key });
    },
    canUp: idx < FONT_STEPS.length - 1,
    canDown: idx > 0,
  };
}

/** 헤더용 — 한 번 누를 때마다 한 단계. PC·모바일 어디서나 같은 자리에 둔다. */
export function FontScaleStepper({ tone = "ink", className }: { tone?: "ink" | "shell"; className?: string }) {
  const f = useFontScale();
  const base = "pressable flex h-8 w-8 items-center justify-center font-bold transition-all disabled:opacity-30 disabled:pointer-events-none";
  const skin = tone === "shell" ? "text-shell-text-2 hover:bg-white/10" : "text-ink-2 hover:bg-surface-2";
  return (
    <div className={cx("flex items-center rounded-[10px] border", tone === "shell" ? "border-white/15" : "border-line-2", className)} title={`글자 크기 — ${f.label}`}>
      <button type="button" onClick={() => f.step(-1)} disabled={!f.canDown} aria-label="글자 작게" className={cx(base, skin, "rounded-l-[9px] text-[0.78rem]")}>
        가
      </button>
      <span className={cx("w-px self-stretch my-1.5", tone === "shell" ? "bg-white/15" : "bg-line-2")} />
      <button type="button" onClick={() => f.step(1)} disabled={!f.canUp} aria-label="글자 크게" className={cx(base, skin, "rounded-r-[9px] text-[1.02rem]")}>
        가
      </button>
    </div>
  );
}

/** 설정 화면용 — 4단계를 한 번에 보여주고, 버튼 자체가 그 크기로 보인다. */
export function FontScalePicker() {
  const f = useFontScale();
  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5">
        {FONT_STEPS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => f.set(o.key)}
            aria-pressed={f.value === o.key}
            className={cx(
              "pressable flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border transition-all",
              f.value === o.key ? "border-accent bg-soft text-accent shadow-sm" : "border-line text-ink-2 hover:border-line-2 hover:bg-surface-2",
            )}
          >
            <span className="font-bold leading-none" style={{ fontSize: `${o.px}px` }}>가</span>
            <span className="text-[0.72rem] font-semibold leading-none">{o.label}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[0.78rem] leading-relaxed text-ink-3">
        글자만 커지는 것이 아니라 버튼·여백·표까지 같이 커집니다. 화면이 좁아지면 한 단계 낮추세요.
      </p>
    </div>
  );
}
