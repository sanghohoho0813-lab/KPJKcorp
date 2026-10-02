"use client";

import { CancelRequestButton, OnBehalfNote, useOnBehalf } from "@/components/domain/portal/CancelRequest";
import { useMemo, useState } from "react";
import { Check, ChevronRight, MessageSquarePlus, Receipt, Sparkles, ThumbsUp } from "lucide-react";
import { useStore, usePortalCompanyId, useCurrentUser, quoteGross, quoteNet } from "@/lib/store";
import { useNow } from "@/lib/hooks";
import { KPJK_SERVICES, OPP_STATUS, SERVICE_BY_KEY, type ServiceDef } from "@/lib/services";
import { KPJK_CONSULTING } from "@/lib/company-options";
import { NextGrowth, useGrowth } from "@/components/domain/portal/GrowthBoard";
import { daysBetween, fmtDate, fmtRelative, fmtWon } from "@/lib/format";
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

  const { isClient, onBehalf } = useOnBehalf();
  const c = st.companies.find((x) => x.id === companyId);
  const board = useGrowth(c);
  const tick = useNow(60000);
  const nowIso = (tick ?? new Date(0)).toISOString();
  // 담당 컨설턴트가 고객 화면에 올린 제안 — 거둔 것은 보이지 않는다
  const proposals = useMemo(() => st.opportunities.filter((o) => o.companyId === companyId && o.source === "proposal" && o.status !== "dropped").sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [st.opportunities, companyId]);
  // 고객이 직접 남긴 관심 · 상담 요청만 — 내부 등록 기회(내부 메모 포함)는 고객에게 보이지 않는다
  const mine = useMemo(() => st.opportunities.filter((o) => o.companyId === companyId && (o.source === "portal_interest" || o.source === "portal_request") && o.status !== "dropped").sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [st.opportunities, companyId]);
  const askedKeys = useMemo(() => new Map(mine.map((o) => [o.serviceKey, o])), [mine]);
  const [peek, setPeek] = useState<ServiceDef | null>(null);
  // 고객이 받은 견적
  const myQuotes = useMemo(() => st.quotes.filter((q) => q.companyId === companyId && ["sent", "accepted", "declined", "converted"].includes(q.status)).sort((a, b) => (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt)), [st.quotes, companyId]);

  if (!c) return null;
  const consultant = st.users.find((u) => u.id === c.consultantId);
  // 관리자 미리보기에서도 "고객이 한 행동"으로 기록되어야 Loop가 실제와 같아진다.
  const contactUser = st.users.find((u) => u.role === "client" && u.companyId === c.id);
  const actorId = isClient ? (user?.id ?? contactUser?.id ?? "") : (user?.id ?? "");

  const submit = () => {
    if (!ask) return;
    if (!isClient && !onBehalf) { toast("고객 계정 또는 대표·컨설턴트 계정에서만 접수할 수 있습니다.", "error"); return; }
    raise(
      { companyId: c.id, serviceKey: ask.svc.key, note: note.trim() || undefined, reason: ask.reason, source: ask.kind === "request" ? "portal_request" : "portal_interest", onBehalf },
      actorId,
      isClient ? "client" : (st.session?.role ?? "consultant"),
    );
    toast(onBehalf ? `고객 대신 접수했습니다 — ${consultant ? `${consultant.name} ${consultant.title}에게 ` : ""}업무·알림이 갔습니다.` : ask.kind === "request" ? "상담 요청이 전달되었습니다. 담당 컨설턴트가 연락드립니다." : "관심으로 접수했습니다. 담당 컨설턴트가 확인합니다.");
    setNote("");
    setAsk(null);
  };

  return (
    <div className="space-y-5">
      <div id="tut-p-services">
        <h1 className="text-[1.5rem] font-bold md:text-[1.8rem]">함께 검토해볼 수 있는 것</h1>
        <p className="mt-1 text-[0.92rem] text-ink-2">
          담당 컨설턴트가 {c.name}에 맞춰 골라 드린 항목과 KPJK가 함께하는 컨설팅 분야입니다. 상담을 요청하시면 담당 컨설턴트가 확인 후 연락드립니다.
        </p>
      </div>

      {/* 받은 제안 — 회신을 기다리는 건이 가장 위. 고객이 눌러야 다음이 진행된다. */}
      {myQuotes.length > 0 && (
        <div className="space-y-3">
          {myQuotes.map((q) => {
            const waiting = q.status === "sent";
            // 유효기간이 지난 제안을 아무 표시 없이 수락 버튼과 함께 두면
            // 고객이 이미 만료된 금액으로 결정하게 된다. 상태는 바꾸지 않고 사실만 알린다.
            const expiredDays = waiting ? daysBetween(q.validUntil, nowIso) : 0;
            const expired = expiredDays > 0;
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

                {expired && (
                  <div className="mt-3 rounded-xl bg-warning-bg px-4 py-2.5 text-[0.85rem] text-warning">
                    <b>유효기간이 {expiredDays}일 지났습니다.</b> 지금 회신하셔도 괜찮습니다. 금액과 일정은 담당 컨설턴트가 다시 확인한 뒤 안내드립니다.
                  </div>
                )}

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
                <div className="flex items-center gap-1.5">
                  <Badge tone={OPP_STATUS[o.status].tone}>{OPP_STATUS[o.status].clientLabel}</Badge>
                  <CancelRequestButton opp={o} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 담당 컨설턴트 제안 — 왜 제안하는지는 컨설턴트가 직접 쓴 글 그대로 */}
      {proposals.length > 0 ? (
        <div id="portal-proposals" className="space-y-3">
          <SectionTitle>담당 컨설턴트 제안</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            {proposals.map((o) => {
              const service = SERVICE_BY_KEY[o.serviceKey];
              const asked = askedKeys.get(o.serviceKey);
              const by = st.users.find((u) => u.id === o.createdBy) ?? consultant;
              return (
                <div key={o.id} className="card flex flex-col p-5" data-proposal={o.serviceName}>
                  <div className="flex items-start gap-2">
                    <h2 className="flex-1 text-[1.15rem] font-bold">{o.serviceName}</h2>
                    {asked && <Badge tone={OPP_STATUS[asked.status].tone}>{OPP_STATUS[asked.status].clientLabel}</Badge>}
                  </div>
                  {service?.blurb && <p className="mt-1 text-[0.92rem] text-ink-2">{service.blurb}</p>}

                  {o.reason && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-soft px-4 py-3 text-[0.88rem]">
                      <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" />
                      <span><b className="text-ink">왜 제안드리나요</b><br /><span className="whitespace-pre-line">{o.reason}</span></span>
                    </div>
                  )}

                  {service?.points && service.points.length > 0 && (
                    <ul className="mt-3 flex-1 space-y-1 text-[0.88rem] text-ink-2">
                      {service.points.map((p) => (
                        <li key={p} className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-success" />{p}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 text-[0.78rem] text-ink-3">{by ? `${by.name} ${by.title ?? ""} · ` : ""}{fmtRelative(o.createdAt)}</div>

                  {asked ? (
                    <div className="mt-3 rounded-xl bg-success-bg px-4 py-2.5 text-[0.85rem] text-success">{asked.source === "portal_request" ? "상담을 요청하셨습니다." : "관심을 남기셨습니다."} 담당 컨설턴트가 연락드립니다.</div>
                  ) : service ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" icon={<ThumbsUp size={15} />} onClick={() => { setAsk({ svc: service, reason: o.reason ?? "담당 컨설턴트 제안", kind: "interest" }); setNote(""); }}>관심 있어요</Button>
                      <Button variant="accent" size="sm" icon={<MessageSquarePlus size={15} />} onClick={() => { setAsk({ svc: service, reason: o.reason ?? "담당 컨설턴트 제안", kind: "request" }); setNote(""); }}>상담 요청</Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState icon={<Check size={28} />} title="아직 담당 컨설턴트가 올린 제안이 없습니다." desc={`궁금한 분야가 있으면 아래에서 상담을 요청하시거나 ${consultant?.name ?? "담당 컨설턴트"} ${consultant?.title ?? ""}에게 문의해 주세요.`} />
      )}

      {/* 기업정보·진행 이력으로 고른 검토 과제 — 근거를 함께 */}
      {board && <NextGrowth board={board} companyId={c.id} only={["suggested"]} title="우리 회사 기준으로 검토해 볼 과제" />}

      {/* KPJK 컨설팅 분야 전체 — 눌러서 내용 보고 바로 상담 요청 */}
      <Card className="p-5" id="portal-kpjk-areas">
        <SectionTitle>KPJK 컨설팅 분야</SectionTitle>
        <div className="space-y-3">
          {KPJK_CONSULTING.map((g) => (
            <div key={g.group}>
              <div className="mb-1.5 text-[0.8rem] font-semibold text-ink-3">{g.group}</div>
              <div className="flex flex-wrap gap-2">
                {g.items.map((name) => {
                  const svc = KPJK_SERVICES.find((x) => x.name === name);
                  if (!svc) return null;
                  const asked = askedKeys.has(svc.key);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setPeek(svc)}
                      className={cx("inline-flex min-h-[40px] items-center gap-1 rounded-full border px-3.5 text-[0.88rem] font-medium transition-colors", asked ? "border-success bg-success-bg text-success" : "border-line bg-surface hover:border-accent hover:text-accent")}
                    >
                      {asked && <Check size={14} />}{name}<ChevronRight size={14} className="opacity-50" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

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
                if (!isClient) { toast("읽기 전용 미리보기입니다. 제안 회신은 고객 계정으로만 가능합니다.", "error"); return; }
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
            <Button variant="accent" onClick={submit}>{onBehalf ? "고객 대신 접수" : ask?.kind === "request" ? "상담 요청" : "관심 남기기"}</Button>
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
        {onBehalf && <OnBehalfNote />}
      </Modal>
      <Modal
        open={!!peek}
        onClose={() => setPeek(null)}
        title={peek?.name ?? ""}
        size="sm"
        footer={
          peek && askedKeys.has(peek.key) ? (
            <Button variant="ghost" onClick={() => setPeek(null)}>닫기</Button>
          ) : (
            <>
              <Button variant="outline" icon={<ThumbsUp size={15} />} onClick={() => { if (!peek) return; setAsk({ svc: peek, reason: "고객이 컨설팅 분야에서 직접 선택", kind: "interest" }); setNote(""); setPeek(null); }}>관심 있어요</Button>
              <Button variant="accent" icon={<MessageSquarePlus size={15} />} onClick={() => { if (!peek) return; setAsk({ svc: peek, reason: "고객이 컨설팅 분야에서 직접 선택", kind: "request" }); setNote(""); setPeek(null); }}>상담 요청</Button>
            </>
          )
        }
      >
        <p className="text-[0.92rem] text-ink-2">{peek?.blurb}</p>
        <ul className="mt-3 space-y-1 text-[0.88rem] text-ink-2">
          {peek?.points.map((p) => (
            <li key={p} className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-success" />{p}</li>
          ))}
        </ul>
        {peek && askedKeys.has(peek.key) && <div className="mt-3 rounded-xl bg-success-bg px-4 py-2.5 text-[0.85rem] text-success">이미 요청하셨습니다. 담당 컨설턴트가 연락드립니다.</div>}
      </Modal>
    </div>
  );
}
