"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardCopy, Home, RefreshCw, RotateCcw } from "lucide-react";
import { errorReport, isChunkError, readErrors, recordError } from "@/lib/error-log";

/**
 * 화면 하나가 그리는 도중 깨졌을 때 보여 주는 안내.
 * 운영 화면·고객 포털은 사이드바·메뉴를 그대로 두고 이 카드만 내용 자리에 뜬다(error.tsx 는 같은 구역의 layout 을 감싸지 않는다).
 * 영어 기본 오류 화면 대신, 지금 할 수 있는 것(다시 시도 · 홈으로 · 오류 내용 복사)을 바로 준다.
 */
export function ErrorScreen({ error, retry, home, homeLabel, full }: {
  error: Error & { digest?: string };
  retry: () => void;
  home: string;
  homeLabel: string;
  /** 바깥 틀까지 깨졌을 때 — 화면 전체를 쓴다 */
  full?: boolean;
}) {
  const chunk = isChunkError(error);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    recordError("render", error, error.digest);
  }, [error]);

  const copy = async () => {
    const text = errorReport(readErrors().slice(0, 5));
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt("아래 내용을 복사해 전달해 주세요", text);
    }
  };

  return (
    <div className={full ? "flex min-h-screen items-center justify-center bg-canvas px-4 py-10" : "flex justify-center px-1 py-8 md:py-14"}>
      <div role="alert" data-testid="error-screen" data-kind={chunk ? "chunk" : "render"} className="card w-full max-w-[560px] p-6 md:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning-bg text-warning">
          {chunk ? <RefreshCw size={24} /> : <AlertTriangle size={24} />}
        </div>
        <h1 className="mt-4 text-[1.3rem] font-extrabold tracking-tight">
          {chunk ? "새 버전이 올라왔습니다" : "이 화면을 여는 중에 문제가 생겼습니다"}
        </h1>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">
          {chunk
            ? "열어 두신 화면이 이전 버전이라 일부 파일을 찾지 못했습니다. 새로고침하면 최신 화면으로 열립니다."
            : "저장된 데이터는 그대로입니다. 다시 시도해 보시고, 같은 문제가 계속되면 아래 '오류 내용 복사'로 담당자에게 전달해 주세요."}
        </p>
        <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
          {chunk ? (
            <button type="button" onClick={() => location.reload()} className="pressable inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-bold text-accent-ink">
              <RefreshCw size={16} /> 새로고침
            </button>
          ) : (
            <button type="button" onClick={() => retry()} className="pressable inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-bold text-accent-ink">
              <RotateCcw size={16} /> 다시 시도
            </button>
          )}
          <Link href={home} className="pressable inline-flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 font-semibold text-ink-2 hover:bg-surface-2">
            <Home size={16} /> {homeLabel}
          </Link>
          {!chunk && (
            <button type="button" onClick={copy} className="pressable inline-flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 font-semibold text-ink-2 hover:bg-surface-2">
              <ClipboardCopy size={16} /> {copied ? "복사했습니다" : "오류 내용 복사"}
            </button>
          )}
        </div>
        {error.digest && <p className="mt-4 text-[0.75rem] text-ink-3">오류 번호 {error.digest}</p>}
      </div>
    </div>
  );
}
