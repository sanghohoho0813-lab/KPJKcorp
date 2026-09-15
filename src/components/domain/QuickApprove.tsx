"use client";

import { useState } from "react";
import { Check, ChevronRight, ShieldCheck, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { fmtRelative, fmtWon } from "@/lib/format";
import { Badge, Button, Textarea, cx } from "@/components/ui/ui";
import { Sheet } from "@/components/ui/overlay";

const KIND_LABEL: Record<string, string> = { discount: "할인", proposal: "제안", promise: "고객 약속" };

/**
 * 모바일 빠른 승인 — 대표가 휴대폰에서 승인을 끝낸다.
 * 한 번에 한 건만 보여준다. 목록을 스크롤하며 고르게 하지 않는다 — 판단할 것 하나, 버튼 둘.
 */
export function QuickApproveBar() {
  const st = useStore();
  const [open, setOpen] = useState(false);
  const pending = st.approvals.filter((a) => a.status === "pending").sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  if (!can(st.session?.role, "approval.decide") || pending.length === 0) return null;

  return (
    <>
      {/* 하단 Nav 바로 위에 붙는다. lg 이상(PC)에서는 승인 화면이 있으므로 숨긴다 */}
      <div className="fixed inset-x-0 z-30 px-3 lg:hidden" style={{ bottom: "calc(var(--bottomnav-h) + 8px)" }}>
        <button
          onClick={() => setOpen(true)}
          className="pressable lift anim-rise flex w-full items-center gap-3 rounded-2xl border border-accent/40 bg-surface px-4 py-3 text-left shadow-lg"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink"><ShieldCheck size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.92rem] font-bold">대표 승인 대기 {pending.length}건</span>
            <span className="block truncate text-[0.78rem] text-ink-3">{pending[0].title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[0.82rem] font-semibold text-accent">처리 <ChevronRight size={15} /></span>
        </button>
      </div>
      <QuickApproveSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function QuickApproveSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const st = useStore();
  const decide = useStore((s) => s.decideApproval);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const [note, setNote] = useState("");
  const [choice, setChoice] = useState<"approved" | "rejected" | null>(null);
  const [done, setDone] = useState(0);
  const pending = st.approvals.filter((a) => a.status === "pending").sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const ap = pending[0];
  const company = st.companies.find((c) => c.id === ap?.companyId);
  const requester = st.users.find((u) => u.id === ap?.requestedBy);
  const net = ap?.baseAmount && ap?.discountPct ? ap.baseAmount * (1 - ap.discountPct / 100) : undefined;

  const submit = () => {
    if (!ap || !choice) return;
    decide(ap.id, choice, me, note.trim() || undefined);
    setDone((n) => n + 1);
    setNote("");
    setChoice(null);
    toast(choice === "approved" ? "승인했습니다." : "반려했습니다.");
  };

  return (
    <Sheet open={open} onClose={onClose} title={<span className="flex items-center gap-2"><ShieldCheck size={18} className="text-accent" /> 빠른 승인 <Badge tone="accent">{pending.length}건 남음</Badge></span>}>
      {!ap ? (
        <div className="py-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-success"><Check size={24} /></span>
          <div className="mt-3 font-bold">대기 중인 승인이 없습니다</div>
          {done > 0 && <div className="mt-1 text-[0.85rem] text-ink-2">방금 {done}건을 처리했습니다.</div>}
          <Button className="mt-4" variant="outline" onClick={onClose}>닫기</Button>
        </div>
      ) : (
        <div className="anim-rise" key={ap.id}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ap.kind === "discount" ? "warning" : ap.kind === "promise" ? "info" : "accent"}>{KIND_LABEL[ap.kind] ?? ap.kind}</Badge>
            {company && <span className="text-[0.85rem] font-semibold text-ink-2">{company.name}</span>}
            <span className="ml-auto text-[0.75rem] text-ink-3">{fmtRelative(ap.requestedAt)} · {requester?.name}</span>
          </div>
          <h3 className="mt-2 text-[1.1rem] font-bold leading-snug">{ap.title}</h3>
          <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-2">{ap.summary}</p>

          {ap.baseAmount !== undefined && (
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-center">
              <div><div className="text-[0.68rem] font-bold text-ink-3">계약 금액</div><div className="tnum text-[0.9rem] font-bold">{fmtWon(ap.baseAmount)}</div></div>
              <div><div className="text-[0.68rem] font-bold text-ink-3">할인</div><div className="tnum text-[0.9rem] font-bold text-warning">{ap.discountPct}%</div></div>
              {net !== undefined && <div><div className="text-[0.68rem] font-bold text-ink-3">적용 시</div><div className="tnum text-[0.9rem] font-bold text-accent">{fmtWon(net)}</div></div>}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => setChoice("approved")} className={cx("pressable flex h-14 items-center justify-center gap-2 rounded-xl border-2 text-[1rem] font-bold transition-colors", choice === "approved" ? "border-success bg-success text-white" : "border-line-2 text-ink-2")}>
              <Check size={20} /> 승인
            </button>
            <button onClick={() => setChoice("rejected")} className={cx("pressable flex h-14 items-center justify-center gap-2 rounded-xl border-2 text-[1rem] font-bold transition-colors", choice === "rejected" ? "border-error bg-error text-white" : "border-line-2 text-ink-2")}>
              <X size={20} /> 반려
            </button>
          </div>

          {choice && (
            <div className="anim-fade mt-3">
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={choice === "approved" ? "담당자에게 남길 말 (선택)" : "반려 사유 (권장)"} />
              <Button full variant={choice === "approved" ? "accent" : "danger"} size="lg" className="mt-2" onClick={submit}>
                {choice === "approved" ? "승인 확정" : "반려 확정"}{pending.length > 1 ? " · 다음 건으로" : ""}
              </Button>
            </div>
          )}
          <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-3">
            {choice === "rejected" ? "반려하면 해당 건은 종료되고 담당자에게 알림이 갑니다." : "승인하면 담당자에게 다음 업무가 자동으로 생성됩니다."} 오래된 요청부터 보여줍니다.
          </p>
        </div>
      )}
    </Sheet>
  );
}
