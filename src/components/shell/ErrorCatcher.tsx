"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { isChunkError, recordError } from "@/lib/error-log";

/**
 * 화면 그리기 밖(버튼 동작·비동기 처리)에서 난 오류를 기록한다 — 오류 화면은 띄우지 않는다.
 * 새 버전 배포 뒤 옛 화면이 파일을 못 찾는 경우(chunk)는 아래에 안내 띠만 띄운다.
 * 자동으로 새로고침하지 않는 이유: 기업 등록처럼 입력 중이던 내용이 사라질 수 있다. 새로고침 시점은 사람이 고른다.
 */
const NOISE = /ResizeObserver loop|Script error\.?$|AbortError|The user aborted|Load failed$|cancelled$/i;

export function ErrorCatcher() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const handle = (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err ?? "");
      if (!msg || NOISE.test(msg)) return;
      recordError("event", err);
      if (isChunkError(err)) setStale(true);
    };
    const onError = (e: ErrorEvent) => handle(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => handle(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (!stale) return null;
  return (
    <div role="status" data-testid="stale-version" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[70] mx-auto flex max-w-[560px] items-center gap-3 rounded-2xl bg-shell px-4 py-3 text-[0.88rem] text-white shadow-2xl lg:bottom-6">
      <RefreshCw size={18} className="shrink-0 text-highlight" />
      <span className="min-w-0 flex-1 leading-snug">새 버전이 올라왔습니다. 입력 중인 내용을 마친 뒤 새로고침해 주세요.</span>
      <button type="button" onClick={() => location.reload()} className="pressable shrink-0 rounded-lg bg-accent px-3 py-2 font-bold text-accent-ink">새로고침</button>
      <button type="button" onClick={() => setStale(false)} aria-label="안내 닫기" className="pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-shell-text-2 hover:bg-white/10"><X size={16} /></button>
    </div>
  );
}
