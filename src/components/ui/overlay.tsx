"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEscape, useScrollLock } from "@/lib/hooks";
import { cx } from "./ui";

/**
 * Overlay lifecycle contract:
 * - Renders only while `open`; unmount removes backdrop, scroll lock, and focus trap.
 * - ESC + backdrop click close. Focus returns to the trigger element.
 */
function useFocusReturn(open: boolean) {
  const prev = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      prev.current = document.activeElement as HTMLElement | null;
    } else if (prev.current) {
      prev.current.focus?.();
      prev.current = null;
    }
  }, [open]);
}

export function Modal({ open, onClose, title, children, footer, size = "md", id }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl"; id?: string }) {
  useScrollLock(open);
  useEscape(onClose, open);
  useFocusReturn(open);
  if (!open || typeof document === "undefined") return null;
  const w = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 md:items-center md:p-6" role="dialog" aria-modal="true" id={id}>
      <div className="anim-fade absolute inset-0 bg-black/45" onClick={onClose} />
      <div className={cx("anim-pop relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl md:rounded-2xl", w)}>
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h3 className="text-[1.1rem] font-bold">{title}</h3>
            <button onClick={onClose} className="pressable rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="닫기">
              <X size={20} />
            </button>
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
  useScrollLock(open);
  useEscape(onClose, open);
  useFocusReturn(open);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[50]" role="dialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={cx("absolute inset-y-0 flex w-full flex-col bg-surface shadow-2xl", width, side === "right" ? "anim-slide-left right-0" : "anim-slide-right left-0")}>
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
  useScrollLock(open);
  useEscape(onClose, open);
  useFocusReturn(open);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[55]" role="dialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="anim-slide-up pb-safe absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-surface shadow-2xl">
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
