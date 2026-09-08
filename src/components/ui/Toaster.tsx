"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useStore } from "@/lib/store";

export function Toaster() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  if (!toasts.length) return null;
  return (
    <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <button key={t.id} onClick={() => dismiss(t.id)} className="anim-fade-up pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl bg-shell px-4 py-3 text-[0.9rem] font-semibold text-white shadow-2xl">
          {t.tone === "error" ? <XCircle size={18} className="text-error" /> : t.tone === "info" ? <Info size={18} className="text-info" /> : <CheckCircle2 size={18} className="text-success" />}
          {t.text}
        </button>
      ))}
    </div>
  );
}
