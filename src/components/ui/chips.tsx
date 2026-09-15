"use client";

import { useState, type ReactNode } from "react";
import { Check, PenLine } from "lucide-react";
import { Input, cx } from "./ui";

/**
 * 클릭으로 고르는 입력.
 * - 한 번 더 누르면 해제된다 (선택 안 함도 정답일 수 있다).
 * - 손가락으로 누를 수 있게 높이 36px 이상.
 * - "직접 입력" 칩은 선택지에 없는 값을 받을 때만 나타난다 — 자유 입력을 막지 않는다.
 */

// max-w-full + 줄바꿈 허용: 글자를 키운 좁은 화면에서 "기업인증(메인비즈·이노비즈·ISO)" 같은 긴 칩이 화면을 밀어내지 않게 한다.
const base = "pressable inline-flex max-w-full min-h-9 items-center gap-1 whitespace-normal rounded-full border px-3 py-1.5 text-left text-[0.85rem] font-semibold leading-tight transition-colors";
const off = "border-line-2 bg-surface text-ink-2 hover:border-ink-3 hover:bg-surface-2";
const on = "border-accent bg-accent text-accent-ink";

export function Chip({ selected, onClick, children, className, title }: { selected?: boolean; onClick?: () => void; children: ReactNode; className?: string; title?: string }) {
  return (
    <button type="button" aria-pressed={!!selected} title={title} onClick={onClick} className={cx(base, selected ? on : off, className)}>
      {selected && <Check size={13} className="shrink-0" />}
      {children}
    </button>
  );
}

export function ChipSelect({ options, value, onChange, custom, customPlaceholder, className }: {
  options: { key: string; label: string; hint?: string }[] | string[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  /** 선택지에 없는 값을 직접 칠 수 있게 한다 */
  custom?: boolean;
  customPlaceholder?: string;
  className?: string;
}) {
  const opts = options.map((o) => (typeof o === "string" ? { key: o, label: o } : o));
  const known = opts.some((o) => o.key === value);
  // 직접 입력 칸은 "선택지에 없는 값이 이미 있거나" "사용자가 열었을 때" 보인다
  const [openCustom, setOpenCustom] = useState(false);
  const showCustom = custom && (openCustom || (!!value && !known));
  return (
    <div className={cx("flex flex-wrap gap-1.5", className)}>
      {opts.map((o) => (
        <Chip key={o.key} selected={value === o.key} title={o.hint} onClick={() => { onChange(value === o.key ? undefined : o.key); setOpenCustom(false); }}>
          {o.label}
        </Chip>
      ))}
      {custom && !showCustom && (
        <Chip onClick={() => { setOpenCustom(true); onChange(undefined); }} className="border-dashed"><PenLine size={13} /> 직접 입력</Chip>
      )}
      {showCustom && (
        <Input
          autoFocus={openCustom}
          value={known ? "" : (value ?? "")}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder={customPlaceholder ?? "직접 입력"}
          className="!h-9 !w-auto min-w-40 flex-1 !rounded-full !px-3.5 !text-[0.85rem]"
        />
      )}
    </div>
  );
}

export function ChipMulti({ options, value, onChange, className, max }: {
  options: { key: string; label: string; hint?: string }[] | string[];
  value: string[];
  onChange: (v: string[]) => void;
  className?: string;
  max?: number;
}) {
  const opts = options.map((o) => (typeof o === "string" ? { key: o, label: o } : o));
  const toggle = (k: string) => {
    if (value.includes(k)) onChange(value.filter((x) => x !== k));
    else if (!max || value.length < max) onChange([...value, k]);
  };
  return (
    <div className={cx("flex flex-wrap gap-1.5", className)}>
      {opts.map((o) => <Chip key={o.key} selected={value.includes(o.key)} title={o.hint} onClick={() => toggle(o.key)}>{o.label}</Chip>)}
    </div>
  );
}
