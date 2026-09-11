"use client";

import { useMemo, useState } from "react";
import { Check, MessageSquarePlus, Receipt, Sparkles, ThumbsUp } from "lucide-react";
import { useStore, usePortalCompanyId, useCurrentUser, quoteGross, quoteNet } from "@/lib/store";
import { OPP_STATUS, recommendServices, type ServiceDef } from "@/lib/services";
import { fmtDate, fmtRelative, fmtWon } from "@/lib/format";
import { Badge, Button, Card, EmptyState, SectionTitle, Textarea, cx } from "@/components/ui/ui";
import type { Quote } from "@/lib/types";
import { Modal } from "@/components/ui/overlay";

export default function PortalServicesPage() {
  const st = useStore();
  const companyId = usePortalCompanyId();
  const user = useCurrentUser();
  const raise = useStore((s) => s.raiseOpportunity);
  const respond = useStore((s) => s.respondQuote);
  const toast = useStore((s) => s.toast);
  const [ask, setAsk] = useState<{ svc: ServiceDef; reason: string; kind: "interest" | "request" } | null>(null);
  const [note, setNote] = useState("");
  const [reply, setReply] = useState<{ q: Quote; decision: "accepted" | "declined" } | null>(null);
  const [replyNote, setReplyNote] = useState("");

  const c = st.companies.find((x) => x.id === companyId);
  const mine = useMemo(() => st.opportunities.filter((o) => o.companyId === companyId && o.status !== "dropped").sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [st.opportunities, companyId]);
  // 고객에게는 발송된 견적만 보인다. 작성 중·승인 대기는 내부 상태다.
  const myQuotes = useMemo(() => st.quotes.filter((q) => q.companyId === companyId && ["sent", "accepted", "declined", "converted"].includes(q.status)).sort((a, b) => (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt)), [st.quotes, companyId]);

  const recos = useMemo(() => {
    if (!c) return [];
    return recommendServices({
      company: c,
      projects: st.projects.filter((p) => p.companyId === c.id),
      contracts: st.contracts.filter((x) => x.companyId === c.id),
      existing: new Set(st.opportunities.filter((o) => o.companyId === c.id).map((o) => o.serviceKey)),
    });
  }, [c, st.projects, st.contracts, st.opportunities]);

  if (!c) return null;
  const consultant = st.users.find((u) => u.id === c.consultantId);
  // 관리자 미리보기에서도 "고객이 한 행동"으로 기록되어야 Loop가 실제와 같아진다.
  const contactUser = st.users.find((u) => u.role === "client" && u.companyId === c.id);
  const actorId = st.session?.role === "client" ? (user?.id ?? contactUser?.id ?? "") : (contactUser?.id ?? "");

  const submit = () => {
    if (!ask) return;
    raise(
      { companyId: c.id, serviceKey: ask.svc.key, note: note.trim() || undefined, reason: ask.reason, source: ask.kind === "request" ? "portal_request" : "portal_interest" },
      actorId,
      "client",
    );
    toast(ask.kind === "request" ? "상담 요청이 전달되었습니다. 담당 컨설턴트가 연락드립니다." : "관심으로 접수했습니다. 담당 컨설턴트가 확인합니다.");
    setNote("");
    setAsk(null);
  };

  return (
    <div className="space-y-5">
      <div id="tut-p-services">
        <h1 className="text-[1.5rem] font-bold md:text-[1.8rem]">함께 검토해볼 수 있는 것</h1>
        <p className="mt-1 text-[0.92rem] text-ink-2">
          {c.name}의 현재 상황에서 검토 대상이 되는 항목입니다. 관심을 표시하면 담당 컨설턴트가 확인 후 연락드립니다.
        </p>
      </div>

      {/* 받은 제안 — 회신을 기다리는 건이 가장 위. 고객이 눌러야 다음이 진행된다. */}
      {myQuotes.length > 0 && (
        <div className="space-y-3">
          {myQuotes.map((q) => {
            const waiting = q.status === "sent";
            return (
              <Card key={q.id} className={cx("p-5", waiting && "border-accent")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={waiting ? "accent" : q.status === "declined" ? "neutral" : "success"}>
                    {waiting ? "확인 요청" : q.status === "accepted" ? "수락함" : q.status === "converted" ? "계약 진행 중" : "보류"}
                  </Badge>
                  <h2 className="flex items-center gap-2 text-[1.1rem] font-bold"><Receipt size={18} className="text-accent" /> {q.title}</h2>
                </div>
                {q.scope && <p className="mt-1 text-[0.9rem] text-ink-2">{q.scope}</p>}

                <div className="mt-3 overflow-hidden rounded-xl border border-line">
                  {q.items.map((it, i) => (
                    <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-[0.88rem] last:border-0">
                      <span className="min-w-0 flex-1">{it.name}</span>
                      <span className="tnum shrink-0">{fmtWon(it.amount)}</span>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-2 bg-surface-2 px-4 py-3">
                    <span className="flex-1 font-bold">합계</span>
                    {q.discountPct > 0 && <span className="tnum text-[0.85rem] text-ink-3 line-through">{fmtWon(quoteGross(q))}</span>}
                    {q.discountPct > 0 && <Badge tone="success">{q.discountPct}% 할인</Badge>}
                    <span className="tnum text-[1.2rem] font-bold text-accent">{fmtWon(quoteNet(q))}</span>
                  </div>
                </div>

                <div className="mt-2 text-[0.8rem] text-ink-3">기간 {q.period} · 유효기간 {fmtDate(q.validUntil)}{q.sentAt ? ` · ${fmtRelative(q.sentAt)} 받음` : ""}</div>

                {waiting ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="accent" icon={<Check size={15} />} onClick={() => { setReply({ q, decision: "accepted" }); setReplyNote(""); }}>이대로 진행할게요</Button>
                    <Button variant="outline" onClick={() => { setReply({ q, decision: "declined" }); setReplyNote(""); }}>조금 더 생각해볼게요</Button>
                  </div>
                ) : q.status === "declined" ? (
                  <div className="mt-3 rounded-xl bg-surface-2 px-4 py-2.5 text-[0.85rem] text-ink-2">보류로 회신하셨습니다{q.clientNote ? ` — “${q.clientNote}”` : ""}. 담당 컨설턴트가 확인 후 연락드립니다.</div>
                ) : (
                  <div className="mt-3 rounded-xl bg-success-bg px-4 py-2.5 text-[0.85rem] text-success">회신 감사합니다. {q.status === "converted" ? "계약 절차를 진행하고 있습니다." : "담당 컨설턴트가 다음 절차를 안내드립니다."}</div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* 내가 요청한 것 — 먼저 보여준다. 요청하고 나서 아무 반응이 없으면 신뢰가 깨진다. */}
      {mine.length > 0 && (
        <Card className="p-5">
          <SectionTitle>내가 요청한 내용</SectionTitle>
          <div className="divide-y divide-line">
            {mine.map((o) => (
              <div key={o.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{o.serviceName}</div>
                  {o.note && <div className="mt-0.5 text-[0.85rem] text-ink-2">“{o.note}”</div>}
                  <div className="mt-0.5 text-[0.78rem] text-ink-3">{fmtRelative(o.createdAt)} 접수 · 담당 {st.users.find((u) => u.id === o.assigneeId)?.name} {st.users.find((u) => u.id === o.assigneeId)?.title}</div>
                </div>
                <Badge tone={OPP_STATUS[o.status].tone}>{OPP_STATUS[o.status].clientLabel}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {recos.length === 0 ? (
        <EmptyState icon={<Check size={28} />} title="지금 추가로 안내드릴 항목이 없습니다." desc={`궁금한 점은 ${consultant?.name} ${consultant?.title}에게 문의해 주세요.`} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {recos.map(({ service, reason }) => (
            <Card key={service.key} className="flex flex-col p-5">
              <div className="flex items-start gap-2">
                <h2 className="flex-1 text-[1.15rem] font-bold">{service.name}</h2>
              </div>
              <p className="mt-1 text-[0.92rem] text-ink-2">{service.blurb}</p>

              <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-[0.85rem]">
                <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" />
                <span><b className="text-ink">이 항목을 보여드리는 이유</b><br />{reason}</span>
              </div>

              <ul className="mt-3 flex-1 space-y-1 text-[0.88rem] text-ink-2">
                {service.points.map((p) => (
                  <li key={p} className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-success" />{p}</li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" icon={<ThumbsUp size={15} />} onClick={() => { setAsk({ svc: service, reason, kind: "interest" }); setNote(""); }}>관심 있어요</Button>
                <Button variant="accent" size="sm" icon={<MessageSquarePlus size={15} />} onClick={() => { setAsk({ svc: service, reason, kind: "request" }); setNote(""); }}>상담 요청</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-[0.8rem] leading-relaxed text-ink-3">
        관심 표시는 계약이나 비용 발생과 무관합니다. 담당 컨설턴트가 현재 상황을 먼저 확인한 뒤 안내드립니다.
      </p>

      <Modal
        open={!!reply}
        onClose={() => setReply(null)}
        title={reply?.decision === "accepted" ? "이대로 진행합니다" : "조금 더 생각해볼게요"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReply(null)}>취소</Button>
            <Button
              variant={reply?.decision === "accepted" ? "accent" : "primary"}
              onClick={() => {
                if (!reply) return;
                respond(reply.q.id, reply.decision, actorId, replyNote.trim() || undefined);
                toast(reply.decision === "accepted" ? "회신이 전달되었습니다. 담당 컨설턴트가 계약 절차를 안내드립니다." : "회신이 전달되었습니다. 담당 컨설턴트가 연락드립니다.");
                setReply(null);
                setReplyNote("");
              }}
            >
              회신 보내기
            </Button>
          </>
        }
      >
        <div className="rounded-xl bg-surface-2 px-4 py-3 text-[0.88rem]">
          <b>{reply?.q.title}</b>
          <div className="tnum mt-0.5 text-ink-2">{reply ? fmtWon(quoteNet(reply.q)) : ""}</div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-[0.85rem] font-semibold text-ink-2">{reply?.decision === "accepted" ? "전달할 말 (선택)" : "어떤 점이 걸리시나요? (선택)"}</label>
          <Textarea rows={3} value={replyNote} onChange={(e) => setReplyNote(e.target.value)} placeholder={reply?.decision === "accepted" ? "예: 다음 주부터 시작 가능합니다." : "예: 예산 확정이 다음 달이라 그때 다시 논의하고 싶습니다."} />
        </div>
        <p className="mt-2 text-[0.8rem] text-ink-3">{reply?.decision === "accepted" ? "회신 즉시 담당 컨설턴트에게 전달되며, 계약서는 별도로 안내드립니다." : "보류로 회신해도 제안이 사라지지 않습니다. 언제든 다시 논의할 수 있습니다."}</p>
      </Modal>

      <Modal
        open={!!ask}
        onClose={() => setAsk(null)}
        title={ask?.kind === "request" ? "상담을 요청합니다" : "관심으로 남깁니다"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsk(null)}>취소</Button>
            <Button variant="accent" onClick={submit}>{ask?.kind === "request" ? "상담 요청" : "관심 남기기"}</Button>
          </>
        }
      >
        <div className="rounded-xl bg-surface-2 px-4 py-3 text-[0.88rem] font-semibold">{ask?.svc.name}</div>
        <div className="mt-3">
          <label className="mb-1 block text-[0.85rem] font-semibold text-ink-2">담당자에게 남길 말 (선택)</label>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 지금 진행 중인 건이 끝나면 검토하고 싶습니다." />
        </div>
        <p className="mt-2 text-[0.8rem] text-ink-3">
          {ask?.kind === "request" ? "담당 컨설턴트에게 바로 전달되며, 영업일 기준 1일 내 연락드립니다." : "담당 컨설턴트가 확인한 뒤 필요한 경우에만 연락드립니다."}
        </p>
      </Modal>
    </div>
  );
}
