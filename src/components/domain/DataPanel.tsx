"use client";

import { useRef, useState } from "react";
import { Cloud, CloudOff, Download, ShieldCheck, Upload, Building2, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/hooks";
import { can } from "@/lib/permissions";
import { fmtDateTime } from "@/lib/format";
import type { OrgInfo } from "@/lib/types";
import { Badge, Button, Field, Input, cx } from "@/components/ui/ui";
import { Confirm, Modal } from "@/components/ui/overlay";
import { serverConfigured } from "@/lib/server/client";
import { SamplePanel } from "./SampleData";

/**
 * 실사용 안전장치 — 서버가 붙기 전까지 실제 데이터를 넣기 시작했을 때 지켜주는 세 가지.
 * 1) 운영 모드: 20시간 자동 초기화 중지, 데모 초기화 잠금
 * 2) 백업 내보내기: 전체를 JSON 한 파일로
 * 3) 백업 가져오기: 다른 PC로 옮기거나 실수 복구
 */
export function DataPanel() {
  const st = useStore();
  const setLive = useStore((s) => s.setLiveMode);
  const exportBackup = useStore((s) => s.exportBackup);
  const importBackup = useStore((s) => s.importBackup);
  const setOrg = useStore((s) => s.setOrg);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const manage = can(st.session?.role, "data.manage");
  const live = !!st.settings.liveMode;
  const last = st.settings.lastBackupAt;
  // Date.now()는 렌더 중에 부를 수 없다 — 1분 틱으로 받는다
  const tick = useNow(60000);
  const staleDays = last && tick ? Math.floor((tick.getTime() - new Date(last).getTime()) / 86400000) : null;
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmLive, setConfirmLive] = useState<boolean | null>(null);
  const [pendingImport, setPendingImport] = useState<{ name: string; json: string; summary: string } | null>(null);
  const [orgOpen, setOrgOpen] = useState(false);

  const download = () => {
    const json = exportBackup(me);
    if (!json) { toast("백업을 만들 권한이 없습니다.", "error"); return; }
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kpjk-ax-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("백업 파일을 내려받았습니다. 안전한 곳에 보관하세요.");
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    let summary = "";
    try {
      const j = JSON.parse(text);
      const d = j?.data ?? {};
      summary = `기업 ${d.companies?.length ?? "?"} · 프로젝트 ${d.projects?.length ?? "?"} · 기록 ${d.activities?.length ?? "?"}건 · ${j?.exportedAt ? fmtDateTime(j.exportedAt) + " 내보냄" : "내보낸 시각 미상"}`;
    } catch { summary = "읽을 수 없는 파일"; }
    setPendingImport({ name: f.name, json: text, summary });
    if (fileRef.current) fileRef.current.value = "";
  };

  const doImport = () => {
    if (!pendingImport) return;
    const r = importBackup(pendingImport.json, me);
    if (!r.ok) { toast(r.reason, "error"); setPendingImport(null); return; }
    toast(`복원했습니다. 기업 ${r.counts.companies} · 프로젝트 ${r.counts.projects} · 기록 ${r.counts.activities}건. 운영 모드가 켜졌습니다.`);
    setPendingImport(null);
  };

  return (
    <div className="space-y-4">
      <ServerPanel />

      {/* 운영 모드 */}
      <div className={cx("rounded-xl border p-4", live ? "border-success/40 bg-success-bg/40" : "border-warning/40 bg-warning-bg/50")}>
        <div className="flex flex-wrap items-start gap-3">
          <ShieldCheck size={20} className={cx("mt-0.5 shrink-0", live ? "text-success" : "text-warning")} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{live ? "운영 모드 — 켜짐" : "데모 모드"}</span>
              <Badge tone={live ? "success" : "warning"}>{live ? "자동 초기화 중지" : "20시간 후 자동 초기화"}</Badge>
            </div>
            <p className="mt-1 text-[0.85rem] leading-relaxed text-ink-2">
              {st.serverMode
                ? "서버에 연결되어 있어 자동으로 켜져 있습니다. 데이터는 서버에 저장되며 이 브라우저를 지워도 사라지지 않습니다."
                : live
                  ? "실제 데이터가 보호됩니다. 자동 초기화가 멈추고, 데모 초기화 버튼이 잠기며, 로그인 화면의 데모 계정 안내가 사라집니다."
                  : "지금은 데모입니다. 20시간이 지나면 입력한 내용이 전부 초기값으로 돌아갑니다. 실제 업무 데이터를 넣기 시작하려면 먼저 운영 모드를 켜세요."}
            </p>
          </div>
          {manage && !st.serverMode && (
            <Button size="sm" variant={live ? "outline" : "accent"} onClick={() => setConfirmLive(!live)}>
              {live ? "데모 모드로" : "운영 모드 켜기"}
            </Button>
          )}
        </div>
      </div>

      {/* 백업 */}
      <div className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">백업</span>
          {last ? (
            <Badge tone={staleDays !== null && staleDays >= 7 ? "warning" : "neutral"}>마지막 {fmtDateTime(last)}{staleDays !== null && staleDays >= 7 ? ` · ${staleDays}일 전` : ""}</Badge>
          ) : (
            <Badge tone={live ? "error" : "neutral"}>아직 없음</Badge>
          )}
        </div>
        <p className="mt-1 text-[0.85rem] leading-relaxed text-ink-2">
          데이터가 이 브라우저에만 저장되는 동안, 백업 파일이 유일한 복사본입니다. 다른 PC에서 이어서 쓰거나 실수를 되돌릴 때 가져오기로 복원합니다.
          {live && (!last || (staleDays ?? 0) >= 7) && <b className="text-warning"> 운영 모드에서는 주 1회 이상 백업을 권합니다.</b>}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="accent" icon={<Download size={14} />} disabled={!manage} onClick={download}>백업 내보내기</Button>
          <Button size="sm" variant="outline" icon={<Upload size={14} />} disabled={!manage} onClick={() => fileRef.current?.click()}>백업 가져오기</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        {!manage && <p className="mt-2 text-[0.78rem] text-ink-3">백업과 복원은 대표 계정에서만 가능합니다.</p>}
      </div>

      <SamplePanel />

      {/* 회사 정보 (인쇄용) */}
      <div className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-bold"><Building2 size={16} className="text-ink-3" /> 인쇄물 회사 정보</span>
          {manage && <Button size="sm" variant="ghost" onClick={() => setOrgOpen(true)}>{st.settings.org ? "수정" : "입력"}</Button>}
        </div>
        {st.settings.org ? (
          <div className="mt-1 text-[0.85rem] text-ink-2">
            <b className="text-ink">{st.settings.org.name}</b>{st.settings.org.ceo ? ` · 대표 ${st.settings.org.ceo}` : ""}{st.settings.org.bizNo ? ` · ${st.settings.org.bizNo}` : ""}
            {st.settings.org.address && <div className="text-ink-3">{st.settings.org.address}</div>}
          </div>
        ) : (
          <p className="mt-1 text-[0.85rem] text-ink-2">견적서·실증 리포트 상단에 들어갑니다. 입력 전에는 회사명만 &ldquo;KPJK CORPORATION&rdquo;으로 나가고 나머지는 빈칸입니다 — 값을 지어내지 않습니다.</p>
        )}
      </div>

      <Confirm
        open={confirmLive !== null}
        onClose={() => setConfirmLive(null)}
        onConfirm={() => { if (confirmLive === null) return; setLive(confirmLive, me); toast(confirmLive ? "운영 모드를 켰습니다. 이제 자동 초기화되지 않습니다." : "데모 모드로 돌아왔습니다. 20시간 후 자동 초기화됩니다."); setConfirmLive(null); }}
        title={confirmLive ? "운영 모드를 켤까요?" : "데모 모드로 돌아갈까요?"}
        desc={confirmLive
          ? "이 시점부터 입력하는 데이터는 자동으로 지워지지 않습니다. 대신 데이터가 이 브라우저에만 있으므로 백업을 주기적으로 내려받아야 합니다."
          : "20시간 후 자동 초기화가 다시 켜집니다. 지금 들어 있는 실제 데이터가 있다면 먼저 백업을 내려받으세요."}
        confirmText={confirmLive ? "운영 모드 켜기" : "데모 모드로"}
        danger={!confirmLive}
      />

      <Confirm
        open={!!pendingImport}
        onClose={() => setPendingImport(null)}
        onConfirm={doImport}
        title="이 백업으로 전체를 교체할까요?"
        desc={`${pendingImport?.name ?? ""} — ${pendingImport?.summary ?? ""}. 지금 화면의 모든 데이터가 이 파일의 내용으로 바뀝니다. 되돌리려면 현재 상태를 먼저 내보내 두세요.`}
        confirmText="교체"
        danger
      />

      <OrgModal open={orgOpen} onClose={() => setOrgOpen(false)} onSave={(o) => { setOrg(o, me); toast("회사 정보를 저장했습니다."); setOrgOpen(false); }} initial={st.settings.org} />
    </div>
  );
}

function OrgModal({ open, onClose, onSave, initial }: { open: boolean; onClose: () => void; onSave: (o: OrgInfo) => void; initial?: OrgInfo }) {
  if (!open) return null;
  return <OrgModalInner onClose={onClose} onSave={onSave} initial={initial} />;
}

function OrgModalInner({ onClose, onSave, initial }: { onClose: () => void; onSave: (o: OrgInfo) => void; initial?: OrgInfo }) {
  const [f, setF] = useState<OrgInfo>(initial ?? { name: "KPJK CORPORATION" });
  const set = (k: keyof OrgInfo, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal open onClose={onClose} size="sm" title="인쇄물 회사 정보" footer={<><Button variant="ghost" onClick={onClose}>취소</Button><Button variant="accent" onClick={() => { if (!f.name.trim()) return; onSave(f); }}>저장</Button></>}>
      <div className="space-y-3">
        <Field label="회사명 *"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="대표자"><Input value={f.ceo ?? ""} onChange={(e) => set("ceo", e.target.value)} /></Field>
          <Field label="사업자번호"><Input value={f.bizNo ?? ""} onChange={(e) => set("bizNo", e.target.value)} placeholder="000-00-00000" /></Field>
        </div>
        <Field label="주소"><Input value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="전화"><Input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="이메일"><Input value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}

/**
 * 서버 연결 상태 + 컨설턴트 열람 범위.
 *
 * 열람 범위는 화면이 거르는 것이 아니라 데이터베이스가 거른다.
 * 여기서 바꾸면 서버 정책이 즉시 따라 바뀌고, 코드 배포가 필요 없다.
 */
function ServerPanel() {
  const st = useStore();
  const toast = useStore((s) => s.toast);
  const setScope = useStore((s) => s.setConsultantScope);
  const me = st.session?.userId ?? "u_admin";
  const manage = can(st.session?.role, "data.manage");
  const configured = serverConfigured();
  const on = st.serverMode;
  const scope = st.settings.consultantScope ?? "all";
  const [busy, setBusy] = useState(false);

  const consultants = st.users.filter((u) => u.role === "consultant" && u.active !== false).length;

  return (
    <div className={cx("rounded-xl border p-4", on ? "border-success/40 bg-success-bg/30" : "border-line")}>
      <div className="flex flex-wrap items-start gap-3">
        {on ? <Cloud size={20} className="mt-0.5 shrink-0 text-success" /> : <CloudOff size={20} className="mt-0.5 shrink-0 text-ink-3" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{on ? "서버 연결됨" : configured ? "서버 설정됨 · 연결 안 됨" : "서버 미연결"}</span>
            <Badge tone={on ? "success" : configured ? "warning" : "neutral"}>
              {on ? "여러 기기에서 같은 데이터" : configured ? "로그인 필요" : "이 브라우저에만 저장"}
            </Badge>
          </div>
          <p className="mt-1 text-[0.85rem] leading-relaxed text-ink-2">
            {on
              ? "입력하는 모든 내용이 서버에 저장됩니다. 대표님·컨설턴트·고객이 각자의 기기에서 같은 데이터를 봅니다. 접근 권한은 서버가 직접 막습니다."
              : configured
                ? "연결 정보는 들어와 있지만 아직 서버 계정으로 로그인하지 않았습니다. 로그아웃 후 서버 계정으로 다시 로그인해 주세요."
                : "지금은 이 브라우저 안에만 저장됩니다. 다른 PC에서는 아무것도 보이지 않고, 브라우저 데이터를 지우면 함께 사라집니다. 연결 방법은 supabase/README.md 에 있습니다."}
          </p>
          {st.syncError && (
            <p className="mt-2 rounded-lg bg-error-bg px-3 py-2 text-[0.82rem] font-semibold text-error">
              마지막 저장 실패: {st.syncError}
            </p>
          )}
        </div>
      </div>

      {on && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 text-[0.88rem] font-bold"><Users size={15} className="text-ink-3" /> 컨설턴트 열람 범위</span>
            <Badge tone={scope === "all" ? "info" : "accent"}>{scope === "all" ? "전체 기업" : "내 담당만"}</Badge>
          </div>
          <p className="mt-1 text-[0.85rem] leading-relaxed text-ink-2">
            {scope === "all"
              ? `컨설턴트 ${consultants}명이 모든 기업고객을 봅니다. 담당자가 자리를 비워도 다른 사람이 이어받기 쉽습니다.`
              : `컨설턴트는 자기가 담당인 기업만 봅니다. 대표님은 전부 보십니다. 외부 파트너 컨설턴트를 붙일 때 이 설정이 필요합니다.`}
            {" "}고객 계정은 어느 쪽이든 자기 회사만 봅니다.
          </p>
          {manage && (
            <Button
              size="sm" variant="outline" className="mt-3" disabled={busy}
              onClick={async () => {
                const next = scope === "all" ? "own" : "all";
                setBusy(true);
                const r = await setScope(next, me);
                setBusy(false);
                toast(r.ok
                  ? `컨설턴트 열람 범위를 ${next === "all" ? "전체 기업" : "내 담당만"}으로 바꿨습니다. 지금 접속 중인 사람에게도 즉시 적용됩니다.`
                  : (r.reason ?? "바꾸지 못했습니다."), r.ok ? "success" : "error");
              }}
            >
              {busy ? "바꾸는 중…" : scope === "all" ? "내 담당만 보이게" : "전체 기업 보이게"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
