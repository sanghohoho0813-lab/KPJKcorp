"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { Monitor, Smartphone, X } from "lucide-react";
import { useUi } from "@/lib/ui-store";
import { useEscape, useIsMobile, useIsPreviewFrame, useScrollLock } from "@/lib/hooks";

/**
 * DEVICE PREVIEW SAFETY CONTRACT
 * - Desktop shows only "모바일 보기", Mobile shows only "PC 보기" (see shell buttons).
 * - Rendered via iframe of the SAME route with ?preview=1 so the inner document hides its own preview controls (no recursion).
 * - True viewport: 390×780 frame, scrollTop 0, own fixed/sticky context.
 */
export function DevicePreviewButton({ className, labelClass }: { className?: string; labelClass?: string }) {
  const isMobile = useIsMobile();
  const inFrame = useIsPreviewFrame();
  const open = useUi((s) => s.openPreview);
  if (inFrame) return null;
  return isMobile ? (
    <button onClick={() => open("desktop")} className={className} title="PC 화면 보기">
      <Monitor size={18} /> <span className={labelClass}>PC 보기</span>
    </button>
  ) : (
    <button onClick={() => open("mobile")} className={className} title="모바일 화면 보기">
      <Smartphone size={18} /> <span className={labelClass}>모바일 보기</span>
    </button>
  );
}

export function DevicePreviewOverlay() {
  const mode = useUi((s) => s.devicePreview);
  const close = useUi((s) => s.closePreview);
  const pathname = usePathname();
  const inFrame = useIsPreviewFrame();
  useScrollLock(!!mode);
  useEscape(close, !!mode);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (mode !== "desktop") return;
    const fn = () => {
      const w = wrapRef.current?.clientWidth ?? window.innerWidth;
      setScale(Math.min(1, (w - 16) / 1280));
    };
    fn();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [mode]);

  if (!mode || inFrame || typeof document === "undefined") return null;
  const src = `${pathname}?preview=1`;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/70" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-white md:px-4 md:py-3">
        <div className="flex min-w-0 items-center gap-2 whitespace-nowrap text-[0.85rem] font-semibold md:text-[0.9rem]">
          {mode === "mobile" ? <Smartphone size={18} className="shrink-0" /> : <Monitor size={18} className="shrink-0" />}
          <span className="truncate">{mode === "mobile" ? "모바일 미리보기 (390 × 780)" : "PC 미리보기 (1280px)"}</span>
          <span className="ml-1 hidden rounded-md bg-white/15 px-2 py-0.5 text-[0.7rem] sm:inline">동일 화면 · 동일 데이터</span>
        </div>
        <button onClick={close} className="pressable flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-white/10 px-3 py-1.5 text-[0.85rem] font-semibold hover:bg-white/20" aria-label="미리보기 닫기">
          <X size={18} /> 닫기
        </button>
      </div>
      <div ref={wrapRef} className="flex flex-1 items-start justify-center overflow-auto p-2 md:items-center" onClick={close}>
        {mode === "mobile" ? (
          <div className="anim-pop relative shrink-0 rounded-[44px] bg-[#111] p-3 shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ width: 390 + 24, height: 780 + 24 }}>
            <div className="absolute left-1/2 top-3 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-[#111]" />
            <iframe title="mobile preview" src={src} className="h-[780px] w-[390px] rounded-[34px] bg-white" />
          </div>
        ) : (
          <div className="anim-pop origin-top" style={{ width: 1280 * scale, height: 1400 * scale }} onClick={(e) => e.stopPropagation()}>
            <div className="overflow-hidden rounded-xl bg-white shadow-2xl" style={{ width: 1280, height: 1400, transform: `scale(${scale})`, transformOrigin: "top left" }}>
              <iframe title="desktop preview" src={src} className="h-[1400px] w-[1280px]" />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
