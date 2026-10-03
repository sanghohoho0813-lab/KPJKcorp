"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useStore } from "@/lib/store";

export function Toaster() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  // 알림 영역은 늘 두어야 화면 읽기 프로그램이 새 안내를 읽어 준다 (비어 있을 때 없앴다 다시 만들면 놓친다)
  return (
    <div role="status" aria-live="polite" data-testid="toasts" className="pb-safe pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <button key={t.id} onClick={() => dismiss(t.id)} className="anim-fade-up pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl bg-shell px-4 py-3 text-[0.9rem] font-semibold text-white shadow-2xl">
          {t.tone === "error" ? <XCircle size={18} className="text-error" /> : t.tone === "info" ? <Info size={18} className="text-info" /> : <CheckCircle2 size={18} className="text-success" />}
          {t.text}
        </button>
      ))}
    </div>
  );
}
