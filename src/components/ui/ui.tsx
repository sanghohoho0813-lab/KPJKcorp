"use client";

import Link from "next/link";
import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef, useEffect, useRef, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Button ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent" | "outline";
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  full?: boolean;
}
const variantCls: Record<Variant, string> = {
  primary: "bg-primary text-white hover:brightness-110 border border-transparent",
  accent: "bg-accent text-accent-ink hover:brightness-105 border border-transparent",
  secondary: "bg-surface-2 text-ink hover:bg-line border border-transparent",
  outline: "bg-surface text-ink border border-line-2 hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 border border-transparent",
  danger: "bg-error text-white hover:brightness-110 border border-transparent",
};
const sizeCls = { sm: "h-9 px-3 text-[0.8rem] gap-1.5", md: "h-11 px-4 text-[0.9rem] gap-2", lg: "h-13 px-6 text-[1rem] gap-2" };
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "primary", size = "md", icon, full, className, children, ...rest }, ref) {
  return (
    <button ref={ref} className={cx("pressable inline-flex items-center justify-center rounded-[var(--radius-btn)] font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none", variantCls[variant], sizeCls[size], full && "w-full", className)} {...rest}>
      {icon}
      {children}
    </button>
  );
});

export function LinkButton({ href, variant = "outline", size = "md", icon, className, children }: { href: string; variant?: Variant; size?: "sm" | "md" | "lg"; icon?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={cx("pressable inline-flex items-center justify-center rounded-[var(--radius-btn)] font-semibold whitespace-nowrap transition-colors", variantCls[variant], sizeCls[size], className)}>
      {icon}
      {children}
    </Link>
  );
}

/* ---------- Badge ---------- */
export type Tone = "neutral" | "success" | "warning" | "error" | "info" | "accent";
const toneCls: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  error: "bg-error-bg text-error",
  info: "bg-info-bg text-info",
  accent: "bg-soft text-accent",
};
export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold whitespace-nowrap leading-5", toneCls[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function NextBadge({ tone = "ink" }: { tone?: "ink" | "shell" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md border border-dashed px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wide",
        tone === "shell" ? "border-white/25 text-shell-text-3" : "border-line-2 text-ink-3",
      )}
    >
      NEXT
    </span>
  );
}
export function DemoBadge({ className }: { className?: string }) {
  return <span className={cx("inline-flex items-center rounded-md bg-warning-bg px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wide text-warning", className)}>DEMO DATA</span>;
}
export function AiReadyBadge({ onClick, label = "AI READY" }: { onClick?: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="pressable inline-flex items-center gap-1 rounded-md border border-line-2 bg-surface px-2 py-0.5 text-[0.7rem] font-bold tracking-wide text-ink-2 hover:bg-surface-2">
      <Sparkles size={12} className="text-accent" /> {label}
    </button>
  );
}

/* ---------- Card & KPI ---------- */
export function Card({ children, className, hover, onClick, id }: { children: ReactNode; className?: string; hover?: boolean; onClick?: () => void; id?: string }) {
  return (
    <div id={id} onClick={onClick} className={cx("card", hover && "card-hover", onClick && "cursor-pointer", className)}>
      {children}
    </div>
  );
}

export function KpiCard({ label, value, sub, tone, href, icon, id, accentValue }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; href?: string; icon?: ReactNode; id?: string; accentValue?: boolean }) {
  const inner = (
    <div className="flex h-full flex-col justify-between gap-2 p-5">
      <div className="flex items-center justify-between">
        <span className="text-[0.85rem] font-semibold text-ink-2">{label}</span>
        {icon}
      </div>
      <div>
        <div className={cx("tnum text-[2.1rem] font-bold leading-none", accentValue ? "text-accent" : tone === "error" ? "text-error" : "text-ink")}>
          {typeof value === "number" ? <CountUp value={value} /> : value}
        </div>
        {sub && <div className="mt-2 text-[0.85rem] text-ink-2">{sub}</div>}
      </div>
    </div>
  );
  if (href)
    return (
      <Link id={id} href={href} className="card card-hover block h-full">
        {inner}
      </Link>
    );
  return (
    <div id={id} className="card h-full">
      {inner}
    </div>
  );
}

export function IconTile({ color, children, size = 40 }: { color: string; children: ReactNode; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-xl" style={{ width: size, height: size, background: `color-mix(in srgb, ${color} 13%, white)`, color }}>
      {children}
    </span>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({ title, desc, actions, badge, id }: { title: ReactNode; desc?: ReactNode; actions?: ReactNode; badge?: ReactNode; id?: string }) {
  return (
    <div id={id} className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-[1.75rem] font-bold md:text-[2rem]">{title}</h1>
          {badge}
        </div>
        {desc && <p className="mt-1 text-[0.95rem] text-ink-2">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-3 flex items-center justify-between", className)}>
      <h2 className="text-[1.15rem] font-bold">{children}</h2>
      {action}
    </div>
  );
}

/* ---------- Tabs ---------- */
export function Tabs<T extends string>({ tabs, value, onChange, id }: { tabs: { key: T; label: string; count?: number }[]; value: T; onChange: (k: T) => void; id?: string }) {
  return (
    <div id={id} className="hide-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b border-line px-1" role="tablist">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button key={t.key} role="tab" aria-selected={active} onClick={() => onChange(t.key)} className={cx("pressable relative -mb-px flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[0.9rem] font-semibold transition-colors", active ? "text-ink" : "text-ink-3 hover:text-ink-2")}>
            {t.label}
            {t.count !== undefined && <span className={cx("tnum rounded-full px-1.5 text-[0.7rem]", active ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-3")}>{t.count}</span>}
            {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedControl<T extends string>({ options, value, onChange, size = "md" }: { options: { key: T; label: ReactNode }[]; value: T; onChange: (k: T) => void; size?: "sm" | "md" }) {
  return (
    <div className="hide-scrollbar inline-flex max-w-full overflow-x-auto rounded-[10px] bg-surface-2 p-1">
      {options.map((o) => (
        <button key={o.key} onClick={() => onChange(o.key)} className={cx("pressable whitespace-nowrap rounded-lg font-semibold transition-colors", size === "sm" ? "px-2.5 py-1 text-[0.75rem]" : "px-3.5 py-1.5 text-[0.85rem]", o.key === value ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink-2")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Empty / Skeleton ---------- */
/**
 * 목록이 길어지면 모바일에서 화면 몇 개를 그냥 스크롤하게 된다.
 * 처음에는 몇 개만 보여주고 나머지는 눌러서 펼친다.
 */
export function MoreButton({ hidden, open, onToggle }: { hidden: number; open: boolean; onToggle: () => void }) {
  if (hidden <= 0) return null;
  return (
    <button
      onClick={onToggle}
      className="pressable mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-line px-4 py-2.5 text-[0.85rem] font-semibold text-ink-2 transition-colors hover:bg-surface-2"
    >
      {open ? "접기" : `${hidden}개 더 보기`}
      <ChevronRight size={14} className={cx("transition-transform", open ? "-rotate-90" : "rotate-90")} />
    </button>
  );
}

export function EmptyState({ icon, title, desc, action }: { icon?: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-ink-3">{icon}</div>}
      <div className="text-[1rem] font-semibold">{title}</div>
      {desc && <div className="max-w-md text-[0.9rem] text-ink-2">{desc}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

/* ---------- Forms ---------- */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx("h-11 w-full rounded-[10px] border border-line-2 bg-surface px-3.5 text-[0.95rem] text-ink placeholder:text-ink-3 focus:border-accent", className)} {...rest} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx("min-h-28 w-full rounded-[10px] border border-line-2 bg-surface px-3.5 py-2.5 text-[0.95rem] text-ink placeholder:text-ink-3 focus:border-accent", className)} {...rest} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx("h-11 w-full rounded-[10px] border border-line-2 bg-surface px-3 text-[0.95rem] text-ink focus:border-accent", className)} {...rest}>
      {children}
    </select>
  );
});
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.85rem] font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.78rem] text-ink-3">{hint}</span>}
    </label>
  );
}

/* ---------- Misc ---------- */
export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white", className)} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.slice(0, 1)}
    </span>
  );
}

/**
 * 숫자가 바뀔 때 짧게 세어 올린다. 값이 변했다는 걸 눈으로 잡게 하는 용도라
 * 260ms 안에 끝내고, 모션을 끈 사용자에게는 첫 프레임에 바로 최종값이 된다.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    const reduce = typeof document !== "undefined" && document.documentElement.dataset.motion === "reduce";
    const dur = reduce ? 0 : 260;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = dur === 0 ? 1 : Math.min(1, (t - start) / dur);
      setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{shown}</span>;
}

export function Progress({ value, className, height = 10 }: { value: number; className?: string; height?: number }) {
  return (
    <div className={cx("progress", className)} style={{ height }}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function RowLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cx("card card-hover flex items-center justify-between gap-3 p-4", className)}>
      <div className="min-w-0 flex-1">{children}</div>
      <ChevronRight size={18} className="shrink-0 text-ink-3" />
    </Link>
  );
}

export function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[0.78rem] font-semibold text-ink-3">{label}</div>
      <div className="mt-0.5 text-[0.95rem] font-semibold text-ink">{value}</div>
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx("border-line", className)} />;
}
