"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useUi } from "@/lib/ui-store";
import { useStore } from "@/lib/store";
import { useIsMobile, useIsPreviewFrame } from "@/lib/hooks";

interface Step {
  route: string;
  target: string; // element id
  title: string;
  body: string;
}

const AX_STEPS: Step[] = [
  { route: "/ax/dashboard", target: "tut-brief", title: "오늘의 업무 브리핑", body: "시스템을 열면 가장 먼저 '오늘 먼저 확인할 것'이 우선순위로 정리됩니다. 각 항목의 '왜?'를 눌러 근거를 확인할 수 있습니다." },
  { route: "/ax/dashboard", target: "tut-kpi", title: "핵심 지표", body: "진행 프로젝트, 자료 검토 대기, 미처리 문의, 지연 프로젝트를 한눈에 봅니다. 카드를 누르면 해당 목록으로 이동합니다." },
  { route: "/ax/clients", target: "tut-nav-clients", title: "기업고객 카드", body: "기업고객 하나를 열면 상담·계약·프로젝트·자료·일정·문의·결과자료·이력이 한 화면에서 연결됩니다." },
  { route: "/ax/documents", target: "tut-nav-documents", title: "자료 · 누락 관리", body: "고객이 Portal에서 제출한 자료가 여기에 도착합니다. 검토 완료 또는 보완 요청을 하면 고객 Portal 상태가 자동으로 바뀝니다." },
  { route: "/ax/documents", target: "tut-surface", title: "고객 화면으로 이동", body: "'고객 화면 보기'로 고객이 보는 Portal을 그대로 확인할 수 있습니다. 설정에서 테마·글자크기·튜토리얼 다시 보기가 가능합니다." },
];

const PORTAL_STEPS: Step[] = [
  { route: "/portal", target: "tut-p-progress", title: "현재 진행률", body: "내 컨설팅이 어디까지 진행됐는지, 지금 어떤 단계인지 바로 확인할 수 있습니다." },
  { route: "/portal", target: "tut-p-actions", title: "지금 해야 할 일", body: "제출할 자료가 있으면 여기에 표시됩니다. '요청자료 제출'을 누르면 바로 업로드할 수 있습니다." },
  { route: "/portal/documents", target: "tut-p-docs", title: "요청자료 제출", body: "요청받은 자료를 상태별로 확인하고 파일을 업로드합니다. 제출하면 담당 컨설턴트에게 바로 전달됩니다." },
];

type Spot = { top: number; left: number; width: number; height: number };

/** Locates the step target after navigation; keyed per step so its state resets cleanly. */
function StepView({ step, idx, total, isMobile, onPrev, onNext, onFinish }: { step: Step; idx: number; total: number; isMobile: boolean; onPrev: () => void; onNext: () => void; onFinish: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [spot, setSpot] = useState<Spot | null>(null);

  useEffect(() => {
    if (pathname !== step.route) router.push(step.route);
  }, [pathname, step.route, router]);

  useEffect(() => {
    let tries = 0;
    let timer = 0;
    const pad = 8;
    const measure = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      setSpot({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
    };
    const find = () => {
      const el = document.getElementById(step.target);
      if (el) {
        if (tries === 0) el.scrollIntoView({ block: "center", behavior: "smooth" });
        measure(el);
        if (tries < 10) {
          tries++;
          timer = window.setTimeout(find, 150);
        }
      } else if (tries < 30) {
        tries++;
        timer = window.setTimeout(find, 100);
      }
    };
    timer = window.setTimeout(find, 50);
    const onChange = () => {
      const el = document.getElementById(step.target);
      if (el) measure(el);
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [step.target, pathname]);

  const popBelow = spot ? spot.top + spot.height + 220 < window.innerHeight : true;
  const popoverStyle: React.CSSProperties = isMobile
    ? { left: 12, right: 12, bottom: 88 }
    : spot
      ? { left: Math.min(Math.max(12, spot.left), window.innerWidth - 380), top: popBelow ? spot.top + spot.height + 12 : Math.max(12, spot.top - 12 - 200) }
      : { left: "50%", top: "50%", transform: "translate(-50%,-50%)" };

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="튜토리얼">
      {spot ? (
        <div className="pointer-events-none absolute rounded-xl transition-all duration-200" style={{ ...spot, boxShadow: "0 0 0 9999px rgba(10,12,16,0.62)", outline: "2px solid var(--theme-accent)" }} />
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}
      <div className="anim-pop absolute w-[360px] max-w-[calc(100vw-24px)] rounded-2xl bg-surface p-5 shadow-2xl" style={popoverStyle}>
        <div className="mb-2 flex items-center justify-between">
          <span className="tnum text-[0.75rem] font-bold tracking-wide text-accent">STEP {idx + 1} / {total}</span>
          <button onClick={onFinish} className="pressable rounded-lg p-1 text-ink-3 hover:bg-surface-2" aria-label="튜토리얼 닫기">
            <X size={18} />
          </button>
        </div>
        <h3 className="text-[1.1rem] font-bold">{step.title}</h3>
        <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-2">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={onFinish} className="pressable text-[0.85rem] font-semibold text-ink-3 hover:text-ink">건너뛰기</button>
          <div className="flex gap-2">
            {idx > 0 && <button onClick={onPrev} className="pressable h-10 rounded-[10px] border border-line-2 px-4 text-[0.9rem] font-semibold hover:bg-surface-2">이전</button>}
            {idx < total - 1 ? (
              <button onClick={onNext} className="pressable h-10 rounded-[10px] bg-accent px-4 text-[0.9rem] font-semibold text-accent-ink">다음</button>
            ) : (
              <button onClick={onFinish} className="pressable h-10 rounded-[10px] bg-accent px-4 text-[0.9rem] font-semibold text-accent-ink">완료</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TutorialRun({ which }: { which: "ax" | "portal" }) {
  const close = useUi((s) => s.closeTutorial);
  const setSettings = useStore((s) => s.setSettings);
  const isMobile = useIsMobile();
  const [idx, setIdx] = useState(0);
  const steps = which === "ax" ? AX_STEPS : PORTAL_STEPS;
  const step = steps[idx];
  const finish = useCallback(() => {
    if (which === "ax") setSettings({ tutorialDoneAx: true });
    else setSettings({ tutorialDonePortal: true });
    close();
  }, [which, setSettings, close]);
  return <StepView key={`${which}-${idx}`} step={step} idx={idx} total={steps.length} isMobile={isMobile} onPrev={() => setIdx((i) => Math.max(0, i - 1))} onNext={() => setIdx((i) => Math.min(steps.length - 1, i + 1))} onFinish={finish} />;
}

export function Tutorial() {
  const which = useUi((s) => s.tutorial);
  const inFrame = useIsPreviewFrame();
  if (!which || inFrame || typeof document === "undefined") return null;
  return createPortal(<TutorialRun key={which} which={which} />, document.body);
}
