"use client";

import { useState } from "react";
import Link from "next/link";
import { CloudOff, CloudUpload, FlaskConical, HardDrive, RefreshCw, WifiOff, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { demoForced, deployedWithoutServer, serverAvailable } from "@/lib/server/client";
import { clearCarryover, loadCarryover } from "@/lib/local-carryover";
import { can } from "@/lib/permissions";
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
  const live = useStore((s) => s.settings.liveMode);

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
          desc="이 브라우저의 데모 화면은 지워집니다. 여기서 직접 등록한 기업은 따로 보관해 두었다가, 서버에 로그인하면 화면 위에 '서버로 올리기'로 보여 드립니다."
          onConfirm={() => { leaveDemo(); window.location.replace("/login"); }} />
      </div>
    );
  }
  // 인터넷에 올린 사이트인데 서버가 연결되지 않은 빌드 — 실제로 쓰기 시작했다면(운영 모드) 늘 크게 알린다
  if (hydrated && !serverMode && live && deployedWithoutServer() && audience === "internal") {
    return (
      <div role="alert" className="mb-4 rounded-xl border border-error/40 bg-error-bg px-3 py-2.5 text-[0.85rem] text-ink" data-testid="no-server-banner">
        <div className="flex items-start gap-2">
          <HardDrive size={16} className="mt-0.5 shrink-0 text-error" />
          <span className="min-w-0 flex-1">
            <b className="text-error">이 사이트는 아직 서버에 연결되지 않았습니다.</b> 지금 입력하는 내용은 <b>이 기기 브라우저에만</b> 저장되어 휴대폰·다른 PC에서는 보이지 않습니다.
            <span className="mt-1 block text-[0.78rem] text-ink-2">Vercel → Settings → Environment Variables 에 <code>NEXT_PUBLIC_SUPABASE_URL</code> · <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> 를 넣고 <b>다시 배포</b>하면 연결됩니다. 여기서 등록한 기업은 서버 로그인 뒤 한 번에 올릴 수 있습니다.</span>
          </span>
        </div>
      </div>
    );
  }
  if (!serverMode) return null;

  if (audience === "internal") {
    const carry = <CarryoverCard />;
    if (unsaved === 0 && !err) return carry;
    return <>{carry}{bannerBody()}</>;
  }
  return bannerBody();

  function bannerBody() {
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
}

/**
 * 서버 연결 전 이 브라우저에만 입력해 둔 기업 — 한 번에 서버로 올린다.
 * (서버 로그인 순간 store 가 보관해 둔 것. 같은 사업자번호·이름이 서버에 있으면 건너뛴다)
 */
function CarryoverCard() {
  const role = useStore((s) => s.session?.role);
  const userId = useStore((s) => s.session?.userId);
  const upload = useStore((s) => s.uploadCarryover);
  const toast = useStore((s) => s.toast);
  const [, setVer] = useState(0);
  const [drop, setDrop] = useState(false);
  const carry = loadCarryover();
  if (!carry || !userId || !can(role, "company.create")) return null;
  const names = carry.companies.map((c) => c.name);
  return (
    <div role="status" className="mb-4 rounded-xl border border-accent/40 bg-accent/[0.06] px-3 py-3 text-[0.85rem] text-ink" data-testid="carryover-card">
      <div className="flex items-start gap-2">
        <CloudUpload size={17} className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <b>서버 연결 전에 이 브라우저에만 입력했던 기업 {names.length}곳이 있습니다.</b>
          <div className="mt-0.5 text-[0.8rem] text-ink-2">{names.slice(0, 5).join(" · ")}{names.length > 5 ? ` 외 ${names.length - 5}곳` : ""}</div>
          <div className="mt-0.5 text-[0.78rem] text-ink-3">올리면 휴대폰·다른 PC 어디서나 보입니다. 기업 기본 정보·담당자만 옮기며, 서버에 이미 있는 기업은 건너뜁니다.</div>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => setDrop(true)} className="pressable inline-flex min-h-9 items-center rounded-lg px-3 font-semibold text-ink-3 hover:bg-surface-2">올리지 않기</button>
        <button type="button" className="pressable inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-accent px-3 font-semibold text-accent-ink"
          onClick={() => {
            const r = upload(userId);
            setVer((v) => v + 1);
            if (!r) { toast("올리지 못했습니다. 대표·컨설턴트 계정으로 로그인했는지 확인해 주세요.", "error"); return; }
            toast(r.added.length ? `기업 ${r.added.length}곳을 서버에 올렸습니다${r.skipped.length ? ` · 이미 있던 ${r.skipped.length}곳은 건너뜀` : ""}.` : `모두 이미 서버에 있어 건너뛰었습니다 (${r.skipped.length}곳).`);
          }}>
          <CloudUpload size={15} /> 서버로 올리기
        </button>
      </div>
      <Confirm open={drop} onClose={() => setDrop(false)} danger confirmText="올리지 않기"
        title="이 기업들을 서버에 올리지 않을까요?"
        desc="이 브라우저에 보관해 둔 목록을 지웁니다. 되돌릴 수 없습니다. 서버에 이미 같은 기업을 다시 등록하셨다면 지워도 됩니다."
        onConfirm={() => { clearCarryover(); setVer((v) => v + 1); }} />
    </div>
  );
}
