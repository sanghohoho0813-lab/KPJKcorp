"use client";

import { useState } from "react";
import Link from "next/link";
import { CloudOff, FlaskConical, RefreshCw, WifiOff, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { demoForced, serverAvailable } from "@/lib/server/client";
import { discardOutbox, retryOutbox } from "@/lib/server/sync";
import { Confirm } from "@/components/ui/overlay";

/**
 * 서버 저장 실패·연결 끊김을 화면 위에 알린다.
 *
 * 화면은 먼저 바뀌고 저장은 뒤따른다. 알려주지 않으면 "저장된 줄" 알고 넘어간다.
 * - 못 보낸 변경이 있으면 빨간 줄이 사라지지 않는다(닫기 없음). 연결되면 자동으로 다시 보낸다.
 * - 서버가 연결된 사이트인데 이 브라우저만 데모 모드면, 여기서 입력한 것은 다른 기기에서 보이지 않는다고 늘 알린다.
 */
export function ServerBanner({ audience }: { audience: "internal" | "client" }) {
  const serverMode = useStore((s) => s.serverMode);
  const hydrated = useStore((s) => s.hydrated);
  const err = useStore((s) => s.syncError);
  const unsaved = useStore((s) => s.unsaved ?? 0);
  const refresh = useStore((s) => s.refreshFromServer);
  const toast = useStore((s) => s.toast);
  const leaveDemo = useStore((s) => s.leaveEmergencyDemo);
  const [busy, setBusy] = useState(false);
  const [drop, setDrop] = useState(false);
  const [back, setBack] = useState(false);

  // 서버가 연결된 사이트에서 이 브라우저만 데모 — 가장 헷갈리는 상황이라 항상 크게 보인다
  if (hydrated && !serverMode && serverAvailable() && demoForced()) {
    return (
      <div role="alert" className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-error/40 bg-error-bg px-3 py-2.5 text-[0.85rem] text-ink" data-testid="demo-forced-banner">
        <FlaskConical size={16} className="shrink-0 text-error" />
        <span className="min-w-0 flex-1"><b className="text-error">이 브라우저는 데모 모드입니다.</b> 여기서 입력한 내용은 서버에 저장되지 않아 다른 기기·다른 사람에게 보이지 않습니다.</span>
        {audience === "internal" && <Link href="/ax/settings?open=data" className="pressable inline-flex min-h-9 items-center rounded-lg px-2 font-semibold text-ink-2 hover:bg-surface-2">입력한 내용 엑셀로 받기</Link>}
        <button type="button" onClick={() => setBack(true)} className="pressable inline-flex min-h-9 items-center rounded-lg bg-error px-3 font-semibold text-white">서버로 돌아가기</button>
        <Confirm open={back} onClose={() => setBack(false)} danger confirmText="서버로 돌아가기"
          title="서버로 돌아갈까요?"
          desc="이 브라우저의 데모 데이터는 지워집니다. 데모 모드에서 직접 입력한 기업이 있다면 먼저 '입력한 내용 엑셀로 받기'로 받아 두고, 서버에 로그인한 뒤 기업고객 → 일괄 등록으로 올리세요."
          onConfirm={() => { leaveDemo(); window.location.replace("/login"); }} />
      </div>
    );
  }
  if (!serverMode) return null;

  if (unsaved > 0) {
    const text = audience === "client"
      ? "방금 입력하신 내용이 아직 서버에 전달되지 않았습니다. 인터넷이 연결되면 자동으로 다시 보냅니다. 이 화면을 닫지 말아 주세요."
      : `서버에 아직 저장되지 않은 변경 ${unsaved}건 — 인터넷 연결을 확인해 주세요. 이 브라우저에 보관해 두었다가 연결되면 자동으로 다시 보냅니다.`;
    return (
      <div role="alert" className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-error/40 bg-error-bg px-3 py-2.5 text-[0.85rem] text-ink" data-testid="unsaved-banner">
        <CloudOff size={16} className="shrink-0 text-error" />
        <span className="min-w-0 flex-1">{text}{audience === "internal" && err && <span className="mt-0.5 block text-[0.78rem] text-ink-3">{err}</span>}</span>
        <button type="button" disabled={busy} className="pressable inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg bg-error px-3 font-semibold text-white"
          onClick={async () => {
            setBusy(true);
            try {
              const r = await retryOutbox();
              if (r.left === 0) { await refresh(); toast("저장되지 않았던 변경을 모두 서버에 보냈습니다."); }
              else toast(`아직 ${r.left}건을 보내지 못했습니다${r.reason ? ` — ${r.reason}` : ""}`, "error");
            } finally { setBusy(false); }
          }}>
          <RefreshCw size={14} className={busy ? "animate-spin" : undefined} /> 다시 보내기
        </button>
        {audience === "internal" && <button type="button" onClick={() => setDrop(true)} className="pressable inline-flex min-h-9 shrink-0 items-center rounded-lg px-2 text-[0.8rem] font-semibold text-ink-3 hover:bg-surface-2">버리기</button>}
        <Confirm open={drop} onClose={() => setDrop(false)} danger confirmText="버리고 서버 내용 불러오기"
          title={`저장되지 않은 변경 ${unsaved}건을 버릴까요?`}
          desc="버리면 되돌릴 수 없습니다. 서버에 저장된 내용으로 화면을 다시 불러옵니다. 보통은 인터넷이 돌아올 때까지 기다리면 됩니다."
          onConfirm={async () => { discardOutbox(); await refresh(); }} />
      </div>
    );
  }

  if (!err) return null;
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
