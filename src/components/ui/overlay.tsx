"use client";

import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEscape, useScrollLock } from "@/lib/hooks";
import { cx } from "./ui";

/**
 * Overlay lifecycle contract:
 * - Renders only while `open`; unmount removes backdrop, scroll lock, and focus trap.
 * - 입력칸이 있는 창은 바깥 클릭·ESC 로 닫히지 않는다. 닫기(X)·취소로만 닫는다.
 *   (카카오톡을 보려고 바깥을 한 번 눌렀다가 쓰던 내용이 통째로 사라진 일이 있었다 — 2026-10-01)
 *   입력칸이 없는 안내·확인 창은 예전처럼 바깥 클릭·ESC 로 닫힌다.
 * - Focus returns to the trigger element.
 */

/** 창 안에 사람이 쓰는 칸이 있는가 (읽기 전용·파일 선택·숨김 칸은 제외) */
function hasEditable(el: HTMLElement | null) {
  return !!el?.querySelector('input:not([type=hidden]):not([type=file]):not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), select:not([disabled]), [contenteditable="true"]');
}

/**
 * 바깥 클릭·ESC 를 받는 문지기. 입력칸이 있으면 닫지 않고 창을 살짝 흔들며 안내한다.
 * guard=false 를 주면 예전처럼 항상 닫힌다.
 */
function useSoftClose(panel: RefObject<HTMLDivElement | null>, onClose: () => void, open: boolean, guard: boolean | undefined) {
  const [nudge, setNudge] = useState(0);
  const soft = () => {
    if (guard === false || (guard === undefined && !hasEditable(panel.current))) { onClose(); return; }
    setNudge((n) => n + 1);
    // 흔들기 — 내용은 다시 그리지 않는다(다시 그리면 쓰던 상태가 날아간다). 클래스만 다시 붙인다
    const el = panel.current;
    if (el) { el.classList.remove("anim-nudge"); void el.offsetWidth; el.classList.add("anim-nudge"); }
  };
  useEscape(soft, open);
  return { soft, nudge };
}

function KeepOpenHint({ n }: { n: number }) {
  if (!n) return null;
  return (
    <div key={n} className="anim-pop-in pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-[0.78rem] font-semibold text-canvas shadow-lg" role="status">
      작성 중이라 닫지 않았습니다 — 닫으려면 X 또는 취소
    </div>
  );
}
function useFocusReturn(open: boolean) {
  const prev = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    prev.current = document.activeElement as HTMLElement | null;
    // cleanup에서 돌려준다 — open이 false로 바뀔 때뿐 아니라 오버레이가 통째로
    // 언마운트될 때도 포커스가 원래 자리로 간다.
    return () => {
      prev.current?.focus?.();
      prev.current = null;
    };
  }, [open]);
}

export function Modal({ open, onClose, title, children, footer, size = "md", id, headerActions, keepOpen }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl"; id?: string;
  /** 제목 줄 오른쪽, 닫기(X) 앞에 붙는 버튼 (예: 잠시 내려두기) */
  headerActions?: ReactNode;
  /** true: 항상 바깥 클릭·ESC 로 닫히지 않음 / false: 항상 닫힘 / 생략: 입력칸이 있으면 닫히지 않음 */
  keepOpen?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useScrollLock(open);
  const { soft, nudge } = useSoftClose(panel, onClose, open, keepOpen === undefined ? undefined : keepOpen);
  useFocusReturn(open);
  if (!open || typeof document === "undefined") return null;
  const w = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 md:items-center md:p-6" role="dialog" aria-modal="true" id={id}>
      <div className="anim-fade absolute inset-0 bg-black/45" onClick={soft} />
      <div ref={panel} className={cx("anim-pop relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl md:rounded-2xl", w)}>
        <KeepOpenHint n={nudge} />
        {title !== undefined && (
          <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-4">
            <h3 className="min-w-0 text-[1.1rem] font-bold">{title}</h3>
            <span className="flex shrink-0 items-center gap-1">
            {headerActions}
            <button onClick={onClose} className="pressable rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="닫기">
              <X size={20} />
            </button>
            </span>
          </div>
        )}
        <div className="thin-scroll flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children, side = "right", width = "max-w-lg", footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; side?: "left" | "right"; width?: string; footer?: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useScrollLock(open);
  const { soft, nudge } = useSoftClose(panel, onClose, open, undefined);
  useFocusReturn(open);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[50]" role="dialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-black/40" onClick={soft} />
      <div ref={panel} className={cx("absolute inset-y-0 flex w-full flex-col bg-surface shadow-2xl", width, side === "right" ? "anim-slide-left right-0" : "anim-slide-right left-0")}>
        <KeepOpenHint n={nudge} />
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-[1.1rem] font-bold">{title}</h3>
          <button onClick={onClose} className="pressable rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="닫기">
            <X size={20} />
          </button>
        </div>
        <div className="thin-scroll flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useScrollLock(open);
  const { soft, nudge } = useSoftClose(panel, onClose, open, undefined);
  useFocusReturn(open);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[55]" role="dialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-black/40" onClick={soft} />
      <div ref={panel} className="anim-slide-up pb-safe absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-surface shadow-2xl">
        <KeepOpenHint n={nudge} />
        <div className="sticky top-0 z-10 bg-surface px-5 pt-3">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-2" />
          {title && (
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-[1.05rem] font-bold">{title}</h3>
              <button onClick={onClose} className="pressable rounded-lg p-1.5 text-ink-3 hover:bg-surface-2" aria-label="닫기">
                <X size={20} />
              </button>
            </div>
          )}
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({ open, onClose, onConfirm, title, desc, confirmText = "확인", danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; desc?: string; confirmText?: string; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} size="sm" title={title} footer={
      <>
        <button onClick={onClose} className="pressable h-10 rounded-[10px] px-4 font-semibold text-ink-2 hover:bg-surface-2">취소</button>
        <button onClick={() => { onConfirm(); onClose(); }} className={cx("pressable h-10 rounded-[10px] px-4 font-semibold text-white", danger ? "bg-error" : "bg-primary")}>{confirmText}</button>
      </>
    }>
      {desc && <p className="text-[0.95rem] text-ink-2">{desc}</p>}
    </Modal>
  );
}
