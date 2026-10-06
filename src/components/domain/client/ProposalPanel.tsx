"use client";

import { useMemo, useState } from "react";
import { Check, Send, Sparkles, Undo2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { KPJK_CONSULTING } from "@/lib/company-options";
import { KPJK_SERVICES, OPP_STATUS, type ServiceDef } from "@/lib/services";
import { fmtRelative } from "@/lib/format";
import type { Company } from "@/lib/types";
import { Badge, Button, Card, SectionTitle, cx } from "@/components/ui/ui";
import { Confirm, Modal } from "@/components/ui/overlay";
import { useMay } from "@/components/domain/EntityModals";

/**
 * 고객 화면 "함께 검토해볼 수 있는 것"에 올릴 제안을 클릭으로 고른다.
 * 기본 내용(무엇을 보는지)은 분야별로 정해져 있고, "왜 제안하는지"는 담당자가 직접 쓴다.
 */
export function ProposalPanel({ company }: { company: Company }) {
  const opportunities = useStore((s) => s.opportunities);
  const users = useStore((s) => s.users);
  const propose = useStore((s) => s.proposeService);
  const withdraw = useStore((s) => s.withdrawProposal);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "";
  const may = useMay();
  const [pick, setPick] = useState<ServiceDef | null>(null);
  const [reason, setReason] = useState("");
  const [undo, setUndo] = useState<string | null>(null);

  const live = useMemo(() => opportunities.filter((o) => o.companyId === company.id && o.source === "proposal" && o.status !== "dropped").sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [opportunities, company.id]);
  const liveKeys = new Map(live.map((o) => [o.serviceKey, o]));
  // 고객이 같은 분야에 관심·상담 요청을 남겼는가
  const asked = new Map(opportunities.filter((o) => o.companyId === company.id && o.source !== "proposal" && o.status !== "dropped").map((o) => [o.serviceKey, o]));
  const canEdit = may("opportunity.advance");

  const open = (svc: ServiceDef) => {
    const cur = liveKeys.get(svc.key);
    setPick(svc);
    setReason(cur?.reason ?? "");
  };
  const send = () => {
    if (!pick) return;
    if (!reason.trim()) { toast("왜 제안하는지 한 줄 이상 적어 주세요. 고객 화면에 그대로 보입니다.", "error"); return; }
    const id = propose(company.id, pick.key, reason.trim(), me);
    if (!id) return;
    toast(`${pick.name} — 고객 화면에 올렸습니다. 고객에게 알림이 갑니다.`);
    setPick(null);
  };

  return (
    <Card className="p-5" id="proposal-panel">
      <SectionTitle>고객에게 제안하기</SectionTitle>
      <p className="-mt-1 mb-3 text-[0.85rem] text-ink-2">
        분야를 누르고 <b>왜 제안하는지</b>를 적으면 {company.name} 고객 화면의 <b>함께 검토해볼 수 있는 것</b>에 바로 보입니다.
      </p>

      <div className="space-y-3">
        {KPJK_CONSULTING.map((g) => (
          <div key={g.group}>
            <div className="mb-1.5 text-[0.78rem] font-semibold text-ink-3">{g.group}</div>
            <div className="flex flex-wrap gap-2">
              {g.items.map((name) => {
                const svc = KPJK_SERVICES.find((x) => x.name === name);
                if (!svc) return null;
                const on = liveKeys.has(svc.key);
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => open(svc)}
                    aria-pressed={on}
                    className={cx(
                      "inline-flex min-h-[40px] items-center gap-1 rounded-full border px-3.5 text-[0.88rem] font-medium transition-colors disabled:opacity-60",
                      on ? "border-accent bg-soft text-accent" : "border-line bg-surface hover:border-accent hover:text-accent",
                    )}
                  >
                    {on && <Check size={14} />}{name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 text-[0.85rem] font-bold">고객 화면에 올라간 제안 {live.length}</div>
      {live.length === 0 ? (
        <div className="mt-2 rounded-xl border border-dashed border-line-2 py-6 px-4 text-center text-[0.85rem] text-ink-3">아직 올린 제안이 없습니다. 위에서 분야를 고르고 이유를 적으면 고객 화면에 바로 올라갑니다.<br />기업정보 규칙으로 찾은 &lsquo;검토해 볼 과제&rsquo;는 제안하지 않아도 고객 화면에 근거와 함께 보입니다.</div>
      ) : (
        <div className="mt-2 divide-y divide-line rounded-xl border border-line">
          {live.map((o) => {
            const a = asked.get(o.serviceKey);
            return (
              <div key={o.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start" data-proposal-row={o.serviceName}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{o.serviceName}</span>
                    {a ? <Badge tone="success">고객 {a.source === "portal_request" ? "상담 요청" : "관심"} · {OPP_STATUS[a.status].label}</Badge> : <Badge>고객 확인 전</Badge>}
                  </div>
                  <div className="mt-1 line-clamp-2 whitespace-pre-line text-[0.85rem] text-ink-2">{o.reason}</div>
                  <div className="mt-0.5 text-[0.75rem] text-ink-3">{users.find((u) => u.id === o.createdBy)?.name} · {fmtRelative(o.createdAt)}</div>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => open(KPJK_SERVICES.find((s) => s.key === o.serviceKey) ?? KPJK_SERVICES[0])}>이유 고치기</Button>
                    <Button size="sm" variant="ghost" icon={<Undo2 size={14} />} onClick={() => setUndo(o.id)}>거두기</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!pick}
        onClose={() => setPick(null)}
        size="sm"
        title={<span className="flex items-center gap-2"><Sparkles size={17} className="text-accent" /> {pick?.name} 제안</span>}
        footer={<><Button variant="ghost" onClick={() => setPick(null)}>취소</Button><Button variant="accent" icon={<Send size={15} />} onClick={send}>{pick && liveKeys.has(pick.key) ? "고쳐서 다시 올리기" : "고객 화면에 올리기"}</Button></>}
      >
        <div className="rounded-xl bg-surface-2 px-4 py-3 text-[0.85rem]">
          <div className="font-semibold text-ink">고객에게 함께 보이는 기본 내용</div>
          <p className="mt-1 text-ink-2">{pick?.blurb}</p>
          <ul className="mt-2 space-y-0.5 text-ink-2">
            {pick?.points.map((p) => <li key={p} className="flex items-start gap-1.5"><Check size={14} className="mt-0.5 shrink-0 text-success" />{p}</li>)}
          </ul>
        </div>
        <label className="mt-3 block text-[0.85rem] font-semibold text-ink-2">
          왜 제안하나요 <span className="font-normal text-ink-3">(고객 화면에 그대로 보입니다)</span>
          <textarea
            className="mt-1 min-h-28 w-full rounded-[10px] border border-line-2 bg-surface px-3.5 py-2.5 text-[0.9rem]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={`예: 지난 미팅에서 말씀하신 내용을 보면 ${pick?.name ?? ""} 부분을 미리 점검해 두시면 좋겠습니다.`}
          />
        </label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {["상담 중 말씀하신 내용과 관련이 있어 먼저 점검해 보시길 권합니다.", "재무제표를 보니 함께 확인해 볼 부분이 있습니다.", "진행 중인 업무와 이어서 보면 준비가 수월합니다."].map((t) => (
            <button key={t} type="button" onClick={() => setReason((r) => (r.trim() ? `${r.trim()}\n${t}` : t))} className="rounded-full border border-line px-2.5 py-1 text-[0.75rem] text-ink-2 hover:border-accent hover:text-accent">+ {t}</button>
          ))}
        </div>
        <p className="mt-2 text-[0.78rem] text-ink-3">내부 메모는 여기에 쓰지 마세요. 금액·성과 약속도 쓰지 않습니다.</p>
      </Modal>

      <Confirm
        open={!!undo}
        onClose={() => setUndo(null)}
        title="제안을 거둘까요?"
        desc="고객 화면에서 사라집니다. 기록은 남습니다."
        confirmText="거두기"
        onConfirm={() => { if (undo) withdraw(undo, me); setUndo(null); toast("제안을 거뒀습니다."); }}
      />
    </Card>
  );
}
