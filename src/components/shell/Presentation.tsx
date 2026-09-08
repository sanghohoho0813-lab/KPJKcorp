"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { useUi } from "@/lib/ui-store";
import { useStore } from "@/lib/store";
import { useIsPreviewFrame } from "@/lib/hooks";

interface PStep {
  route: string;
  title: string;
  body: string;
  /** internal user must be viewing portal for a company */
  portal?: boolean;
}

/** PRESENTATION MODE — Guided Product Demo over real routes (3~5분). */
const STEPS: PStep[] = [
  { route: "/ax/why", title: "① 왜 이 AX인가", body: "고객·자료·일정·진행상황이 카톡과 파일에 흩어져 있던 구조를, 기업고객 단위의 하나의 데이터 흐름으로 바꿉니다." },
  { route: "/ax/dashboard", title: "② 오늘의 업무 브리핑", body: "대표가 시스템을 열면 기한 초과 자료, 정체 프로젝트, 미답변 문의가 우선순위로 정리됩니다. 각 항목에 '왜?' 근거가 붙습니다." },
  { route: "/ax/clients/co_a", title: "③ 기업고객 카드", body: "에이정밀 하나를 열면 상담·계약·프로젝트·자료·일정·문의·결과·이력이 한 화면에 연결됩니다. 이것이 Single Source of Truth입니다." },
  { route: "/ax/projects", title: "④ 프로젝트 운영 Board", body: "상담부터 완료까지 단계별 병목을 한눈에 봅니다. 카드를 열면 자료 누락 체크와 프로젝트 요약이 자동으로 정리됩니다." },
  { route: "/portal", title: "⑤ 고객 Portal", body: "고객이 로그인하면 5초 안에 '어디까지 진행됐는지, 지금 무엇을 내야 하는지, 다음 일정이 뭔지'를 알 수 있습니다.", portal: true },
  { route: "/portal/documents", title: "⑥ 고객이 직접 자료 제출", body: "고객이 요청자료를 업로드하면 내부 AX에 즉시 도착하고 담당자 검토 Task가 자동 생성됩니다. (직접 눌러보세요)", portal: true },
  { route: "/ax/documents", title: "⑦ 내부 검토 → 상태 반영", body: "담당자가 검토 완료 또는 보완 요청을 하면 고객 Portal의 상태와 알림이 자동으로 바뀝니다. 이것이 Closed Loop입니다." },
  { route: "/ax/inquiries", title: "⑧ 문의 → 답변 Loop", body: "고객 문의는 내부 Queue에 자동 등록되고, 답변하면 고객 Portal에 반영됩니다. 진행상황 전화 문의가 줄어듭니다." },
  { route: "/ax/reports", title: "⑨ 실증 · Evidence", body: "모든 행동이 Event와 Timestamp로 남습니다. 실제 Baseline이 쌓이면 소요기간·누락건수·Self-Service 비율을 측정합니다. Demo에서는 개선율을 만들지 않습니다." },
  { route: "/ax/settings", title: "⑩ 다음 단계", body: "알림 자동화, 문서 자동화, 운영 리포트, Portal Self-Service 확대, 외부 연동은 NEXT로 표시되어 현재 기능과 명확히 구분됩니다." },
];

export function PresentationButton({ className, labelClass }: { className?: string; labelClass?: string }) {
  const open = useUi((s) => s.openPresentation);
  const inFrame = useIsPreviewFrame();
  if (inFrame) return null;
  return (
    <button onClick={open} className={className} title="시연 모드">
      <Play size={16} /> <span className={labelClass}>시연</span>
    </button>
  );
}

export function Presentation() {
  const active = useUi((s) => s.presentation);
  const step = useUi((s) => s.presentationStep);
  const setStep = useUi((s) => s.setPresentationStep);
  const close = useUi((s) => s.closePresentation);
  const session = useStore((s) => s.session);
  const setPortalPreview = useStore((s) => s.setPortalPreview);
  const router = useRouter();
  const pathname = usePathname();
  const inFrame = useIsPreviewFrame();
  const cur = STEPS[step];

  useEffect(() => {
    if (!active || !cur) return;
    if (cur.portal && session && session.role !== "client" && !session.portalPreviewCompanyId) setPortalPreview("co_a");
    if (pathname !== cur.route) router.push(cur.route);
  }, [active, cur, pathname, router, session, setPortalPreview]);

  useEffect(() => {
    if (!active) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" && step < STEPS.length - 1) setStep(step + 1);
      if (e.key === "ArrowLeft" && step > 0) setStep(step - 1);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [active, step, setStep, close]);

  if (!active || !cur || inFrame || typeof document === "undefined") return null;

  return createPortal(
    <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-[68px] z-[75] flex justify-center px-3 lg:bottom-6">
      <div className="anim-fade-up pointer-events-auto w-full max-w-2xl rounded-2xl bg-shell p-4 text-white shadow-2xl md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="tnum mb-1 text-[0.72rem] font-bold tracking-wider text-highlight">시연 모드 · {step + 1} / {STEPS.length}</div>
            <div className="text-[1.05rem] font-bold">{cur.title}</div>
            <p className="mt-1 text-[0.88rem] leading-relaxed text-shell-text-2">{cur.body}</p>
          </div>
          <button onClick={close} className="pressable shrink-0 rounded-lg p-1.5 text-shell-text-3 hover:bg-white/10 hover:text-white" aria-label="시연 종료">
            <X size={20} />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => setStep(i)} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-accent" : "w-1.5 bg-white/25 hover:bg-white/50"}`} aria-label={`${i + 1}단계`} />
            ))}
          </div>
          <div className="flex gap-2">
            <button disabled={step === 0} onClick={() => setStep(step - 1)} className="pressable flex h-9 items-center gap-1 rounded-lg bg-white/10 px-3 text-[0.85rem] font-semibold hover:bg-white/20 disabled:opacity-30">
              <ChevronLeft size={16} /> 이전
            </button>
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(step + 1)} className="pressable flex h-9 items-center gap-1 rounded-lg bg-accent px-3 text-[0.85rem] font-semibold text-accent-ink">
                다음 <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={close} className="pressable flex h-9 items-center gap-1 rounded-lg bg-accent px-3 text-[0.85rem] font-semibold text-accent-ink">시연 종료</button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
