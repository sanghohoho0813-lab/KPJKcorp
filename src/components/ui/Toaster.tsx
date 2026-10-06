"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useStore } from "@/lib/store";

export function Toaster() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  // 알림 영역은 늘 두어야 화면 읽기 프로그램이 새 안내를 읽어 준다 (비어 있을 때 없앴다 다시 만들면 놓친다)
  return (
    <div role="status" aria-live="polite" data-testid="toasts" className="pb-safe pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => {
        const icon = t.tone === "error" ? <XCircle size={18} className="shrink-0 text-error" /> : t.tone === "info" ? <Info size={18} className="shrink-0 text-info" /> : <CheckCircle2 size={18} className="shrink-0 text-success" />;
        // 되돌리기가 있는 안내 — 잘못 누른 것을 바로 되돌릴 수 있게 버튼을 따로 둔다
        if (t.action) return (
          <div key={t.id} data-testid="toast-action" className="anim-fade-up pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl bg-shell py-2 pl-4 pr-2 text-[0.9rem] font-semibold text-white shadow-2xl">
            {icon}<span className="min-w-0 flex-1 truncate">{t.text}</span>
            <button onClick={() => { t.action?.run(); dismiss(t.id); }} className="pressable shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-[0.85rem] font-bold text-white hover:bg-white/25">{t.action.label}</button>
          </div>
        );
        return (
          <button key={t.id} onClick={() => dismiss(t.id)} className="anim-fade-up pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl bg-shell px-4 py-3 text-[0.9rem] font-semibold text-white shadow-2xl">
            {icon}
            {t.text}
          </button>
        );
      })}
    </div>
  );
}
