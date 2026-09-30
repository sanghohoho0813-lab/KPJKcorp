"use client";

import { useState } from "react";
import { RefreshCw, WifiOff, X } from "lucide-react";
import { useStore } from "@/lib/store";

/**
 * 서버 저장 실패·연결 끊김을 화면 위에 한 줄로 알린다.
 *
 * 화면은 먼저 바뀌고 저장은 뒤따른다. 알려주지 않으면 "저장된 줄" 알고 넘어간다.
 * 연결이 돌아와 다시 읽기에 성공하면 저절로 사라진다. 서버 모드에서만 나온다.
 */
export function ServerBanner({ audience }: { audience: "internal" | "client" }) {
  const serverMode = useStore((s) => s.serverMode);
  const err = useStore((s) => s.syncError);
  const refresh = useStore((s) => s.refreshFromServer);
  const [busy, setBusy] = useState(false);
  if (!serverMode || !err) return null;
  // 고객에게는 내부 오류 문장을 그대로 보이지 않는다
  const text = audience === "client" ? "서버와 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요. 방금 입력한 내용이 반영되지 않았을 수 있습니다." : err;
  return (
    <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-bg/60 px-3 py-2.5 text-[0.82rem] text-ink" data-testid="server-banner">
      <WifiOff size={16} className="mt-0.5 shrink-0 text-warning" />
      <span className="min-w-0 flex-1">{text}</span>
      <button type="button" disabled={busy} className="pressable inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 font-semibold text-ink-2 hover:bg-surface-2 sm:min-h-0 sm:py-0.5"
        onClick={async () => { setBusy(true); try { await refresh(); } finally { setBusy(false); } }}>
        <RefreshCw size={14} className={busy ? "animate-spin" : undefined} /> 다시 연결
      </button>
      <button type="button" aria-label="안내 닫기" className="pressable inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 sm:min-h-0 sm:min-w-0 sm:p-0.5"
        onClick={() => useStore.setState({ syncError: undefined })}>
        <X size={14} />
      </button>
    </div>
  );
}
