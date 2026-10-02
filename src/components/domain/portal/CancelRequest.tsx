"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import type { Opportunity } from "@/lib/types";
import { Confirm } from "@/components/ui/overlay";
import { cx } from "@/components/ui/ui";

/** 고객이 보낸 상담 요청·관심·지원사업 문의 — 담당자가 제안·견적으로 넘어가기 전까지 취소할 수 있다 */
export const cancellable = (o: Opportunity) => (o.source === "portal_interest" || o.source === "portal_request") && (o.status === "interest" || o.status === "contacted");

export function CancelRequestButton({ opp, className }: { opp: Opportunity; className?: string }) {
  const cancel = useStore((s) => s.cancelMyRequest);
  const toast = useStore((s) => s.toast);
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!cancellable(opp)) return null;
  return (
    <>
      <button type="button" disabled={busy} onClick={() => setOpen(true)} data-testid={`cancel-request-${opp.id}`}
        className={cx("pressable inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-[0.8rem] font-semibold text-ink-3 hover:bg-surface-2 hover:text-ink", className)}>
        <X size={14} /> 요청 취소
      </button>
      <Confirm open={open} onClose={() => setOpen(false)} danger confirmText="요청 취소"
        title="이 요청을 취소할까요?"
        desc={`${opp.serviceName} — 담당 컨설턴트에게 취소했다고 알려 드리고, 연락 예정이던 일정도 정리됩니다. 나중에 다시 요청하실 수 있습니다.`}
        onConfirm={async () => {
          setBusy(true);
          const r = await cancel(opp.id, user?.id ?? "");
          setBusy(false);
          toast(r.ok ? "요청을 취소했습니다. 담당 컨설턴트에게 알려 드렸습니다." : (r.reason ?? "취소하지 못했습니다."), r.ok ? "success" : "error");
        }} />
    </>
  );
}

/**
 * 대표·컨설턴트가 고객 화면(미리보기)을 볼 때 — 버튼을 막지 않고 "고객 대신 접수"로 받는다.
 * 고객이 전화로 말한 것을 대신 넣거나, 흐름을 시험할 때 쓴다. 기록에는 "담당자 대신 접수"로 남는다.
 */
export function useOnBehalf() {
  const role = useStore((s) => s.session?.role);
  const isClient = role === "client";
  return { isClient, onBehalf: !isClient && (role === "admin" || role === "consultant") };
}

export function OnBehalfNote() {
  return <p className="mt-2 rounded-lg bg-warning-bg/60 px-3 py-2 text-[0.78rem] text-ink-2" data-testid="on-behalf-note">미리보기 중입니다 — <b>고객 대신 접수</b>로 기록되고, 담당 컨설턴트에게 업무·알림이 실제로 갑니다.</p>;
}

/** 담당자: 고객에게 보낸 자료 요청 취소 (아직 제출 전인 것만). 고객 화면에서 빠지고 "취소되었습니다" 알림이 간다 */
export function CancelDocRequestButton({ id, name, className }: { id: string; name: string; className?: string }) {
  const cancel = useStore((s) => s.cancelDocRequest);
  const toast = useStore((s) => s.toast);
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} data-testid={`cancel-doc-${id}`} aria-label={`${name} 요청 취소`}
        className={cx("pressable inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[0.78rem] font-semibold text-ink-3 hover:bg-surface-2 hover:text-error", className)}>
        <X size={13} /> 요청 취소
      </button>
      <Confirm open={open} onClose={() => setOpen(false)} danger confirmText="요청 취소"
        title={`'${name}' 요청을 취소할까요?`}
        desc="고객 화면 요청자료에서 빠지고, 고객에게 '제출하지 않으셔도 됩니다' 알림이 갑니다."
        onConfirm={() => { cancel(id, user?.id ?? ""); toast("자료 요청을 취소했습니다. 고객에게 알렸습니다."); }} />
    </>
  );
}
