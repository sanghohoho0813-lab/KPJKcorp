"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Captions, Clock, Download, Maximize2, Smartphone } from "lucide-react";
import { cx } from "@/components/ui/ui";

/**
 * 영상 상세 페이지 (9:16 세로 영상 · 자막 포함 원본).
 * 영상이 주인공이다: 한 화면 안에서 영상 + 장면 바로가기 + 재생 속도까지 끝나게, 길게 스크롤되지 않게 둔다.
 * 사용처: /ax/video (실사용 영상), /ax/howto (사용 방법 영상), /ax/supplement (보완 설명 영상)
 */
export type Chapter = { at: number; label: string };

const RATES = [1, 1.25, 1.5];

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function VideoDetail({ src, poster, eyebrow, title, desc, duration, chapters, note, downloadName }: {
  src: string;
  poster: string;
  eyebrow: string;
  title: ReactNode;
  desc: ReactNode;
  /** 예: "4분 04초" */
  duration: string;
  /** 장면 시작 시각(초) — 영상의 실제 장면 전환 시각 */
  chapters: Chapter[];
  note: ReactNode;
  downloadName: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [rate, setRate] = useState(1);
  const [time, setTime] = useState(0);

  let active = 0;
  chapters.forEach((c, i) => { if (time >= c.at) active = i; });

  // 휴대폰에서 장면 목록이 옆으로 넘어가 있을 때 지금 장면이 보이게 맞춘다 (세로 스크롤은 건드리지 않음)
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = listRef.current;
    const el = box?.children[active] as HTMLElement | undefined;
    if (!box || !el || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo({ left: el.offsetLeft - 8, behavior: "smooth" });
  }, [active]);

  const changeRate = (r: number) => {
    setRate(r);
    if (ref.current) ref.current.playbackRate = r;
  };
  const jump = (at: number) => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = at;
    v.play().catch(() => {});
  };
  const fullscreen = () => {
    const v = ref.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.();
  };

  return (
    <div className="mx-auto max-w-[1180px]">
      <section className="relative overflow-hidden rounded-[28px] bg-shell text-white shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
        {/* 영상과 같은 배경 — 차콜 위 구리빛 */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 55% at 88% 0%, rgba(212,122,74,0.28), transparent 62%), radial-gradient(45% 45% at 0% 100%, rgba(232,184,154,0.10), transparent 60%)" }} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(70% 70% at 30% 40%, #000 25%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(70% 70% at 30% 40%, #000 25%, transparent 80%)",
          }}
        />

        <div className="relative grid gap-6 p-3 sm:p-7 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-12 lg:p-9">
          {/* 영상 */}
          <div className="mx-auto w-full max-w-[360px] lg:w-[clamp(260px,calc((100dvh-290px)*9/16),360px)]">
            <div className="rounded-[30px] bg-black/60 p-1 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.85)] ring-1 ring-white/10">
              <video
                ref={ref}
                data-testid="ax-video"
                src={src}
                poster={poster}
                controls
                playsInline
                preload="metadata"
                onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                onRateChange={(e) => setRate(e.currentTarget.playbackRate)}
                onLoadedMetadata={(e) => { e.currentTarget.playbackRate = rate; }}
                className="ax-video block aspect-[9/16] w-full rounded-[24px] bg-black object-contain"
              >
                브라우저가 영상 재생을 지원하지 않습니다. <a href={src} download>영상 내려받기</a>
              </video>
            </div>
            {/* 재생 속도 — 영상 밖 */}
            <div className="mt-3 flex items-center justify-center gap-1.5 whitespace-nowrap sm:gap-2" role="group" aria-label="재생 속도">
              <span className="mr-1 text-[0.78rem] font-semibold text-shell-text-3">속도</span>
              {RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  data-testid={`rate-${r}`}
                  aria-pressed={rate === r}
                  onClick={() => changeRate(r)}
                  className={cx(
                    "pressable tnum min-w-[58px] rounded-full px-3 py-2 text-[0.85rem] font-bold transition-colors",
                    rate === r ? "bg-accent text-accent-ink" : "bg-white/[0.07] text-shell-text-2 ring-1 ring-white/10 hover:bg-white/[0.12] hover:text-white",
                  )}
                >
                  {r === 1 ? "1배" : `${r}배`}
                </button>
              ))}
            </div>
          </div>

          {/* 설명 */}
          <div className="flex min-w-0 flex-col px-1 sm:px-0">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.24em] text-highlight">{eyebrow}</div>
            <h1 className="mt-3 text-[1.75rem] font-extrabold leading-[1.18] tracking-tight sm:text-[2.2rem] lg:text-[2.45rem]">{title}</h1>
            <p className="mt-3 max-w-[560px] text-[0.95rem] leading-relaxed text-shell-text-2">{desc}</p>
            <div className="mt-4 flex flex-wrap gap-1.5 text-[0.8rem] font-semibold text-shell-text-2 sm:gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 ring-1 ring-white/10"><Clock size={14} className="text-highlight" />{duration}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 ring-1 ring-white/10"><Smartphone size={14} className="text-highlight" />세로 9:16</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 ring-1 ring-white/10"><Captions size={14} className="text-highlight" />자막 포함</span>
            </div>

            <div className="mt-5 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-shell-text-3">장면 바로가기</div>
            {/* 휴대폰: 옆으로 넘기는 한 줄 · PC: 두 줄 목록 */}
            <div className="thin-scroll -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-1 sm:overflow-visible sm:px-0 sm:pb-0" data-testid="chapters" ref={listRef}>
              {chapters.map((c, i) => (
                <button
                  key={c.at}
                  type="button"
                  onClick={() => jump(c.at)}
                  aria-current={i === active ? "true" : undefined}
                  className={cx(
                    "pressable flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-[0.86rem] font-semibold transition-colors sm:gap-3 sm:py-1.5",
                    i === active ? "bg-white/[0.10] text-white ring-1 ring-highlight/40" : "bg-white/[0.05] text-shell-text-2 hover:bg-white/[0.08] hover:text-white sm:bg-transparent",
                  )}
                >
                  <span className={cx("tnum shrink-0 text-[0.8rem] font-bold sm:w-10", i === active ? "text-highlight" : "text-shell-text-3")}>{mmss(c.at)}</span>
                  <span className="whitespace-nowrap sm:min-w-0 sm:truncate">{c.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:mt-auto lg:pt-5">
              <button type="button" onClick={fullscreen} className="pressable inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[0.9rem] font-bold text-accent-ink hover:brightness-110">
                <Maximize2 size={16} /> <span>전체 화면<span className="hidden sm:inline">으로 보기</span></span>
              </button>
              <a href={src} download={downloadName} className="pressable inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.07] px-4 py-2.5 text-[0.9rem] font-bold text-shell-text-2 ring-1 ring-white/10 hover:bg-white/[0.12] hover:text-white">
                <Download size={16} /> <span className="sm:hidden">내려받기</span><span className="hidden sm:inline">영상 내려받기</span>
              </a>
            </div>
            <p className="mt-3 text-[0.75rem] leading-relaxed text-shell-text-3">{note}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
