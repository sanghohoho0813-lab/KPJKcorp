"use client";

import { useState } from "react";
import { Pencil, Plus, Printer, X } from "lucide-react";
import Link from "next/link";
import { useStore, quoteGross, quoteNet } from "@/lib/store";
import type { Quote, QuoteItem, QuoteStatus } from "@/lib/types";
import { addDays, daysBetween, fmtWon } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { Badge, Button, Field, Input, Select, Textarea, cx, type Tone } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; clientLabel: string; tone: Tone }> = {
  draft: { label: "작성 중", clientLabel: "준비 중", tone: "neutral" },
  approval_pending: { label: "대표 승인대기", clientLabel: "준비 중", tone: "warning" },
  sent: { label: "발송 · 회신 대기", clientLabel: "확인 요청", tone: "info" },
  accepted: { label: "고객 수락", clientLabel: "수락함", tone: "success" },
  declined: { label: "보류", clientLabel: "보류", tone: "error" },
  converted: { label: "계약 전환", clientLabel: "계약 진행", tone: "success" },
};

function dateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ---------------- 견적 작성 ---------------- */

/** 작성과 수정(발송 전)이 같은 폼을 쓴다. 발송된 견적은 고객이 이미 본 금액이라 여기로 들어올 수 없다. */
export function NewQuoteModal(props: { open: boolean; onClose: () => void; companyId?: string; quoteId?: string | null }) {
  if (!props.open) return null;
  return <QuoteFormInner key={props.quoteId ?? "new"} {...props} />;
}

function QuoteFormInner({ open, onClose, companyId, quoteId }: { open: boolean; onClose: () => void; companyId?: string; quoteId?: string | null }) {
  const st = useStore();
  const create = useStore((s) => s.createQuote);
  const update = useStore((s) => s.updateQuote);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const editing = st.quotes.find((q) => q.id === quoteId);

  const [company, setCompany] = useState(editing?.companyId ?? companyId ?? st.companies[0]?.id ?? "");
  const [project, setProject] = useState(editing?.projectId ?? "");
  const [opp, setOpp] = useState(editing?.opportunityId ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [scope, setScope] = useState(editing?.scope ?? "");
  const [period, setPeriod] = useState(editing?.period ?? "3개월");
  const [items, setItems] = useState<QuoteItem[]>(editing?.items.length ? editing.items.map((i) => ({ ...i })) : [{ name: "", amount: 0 }]);
  const [discount, setDiscount] = useState(String(editing?.discountPct ?? 0));
  const [valid, setValid] = useState(() => dateInput(editing ? new Date(editing.validUntil) : addDays(new Date(), 14)));

  const cid = companyId ?? company;
  const projects = st.projects.filter((p) => p.companyId === cid);
  const opps = st.opportunities.filter((o) => o.companyId === cid && !["won", "dropped"].includes(o.status));
  const pct = Math.max(0, Math.min(100, Number(discount) || 0));
  const gross = items.reduce((s, i) => s + i.amount, 0);
  const net = Math.round(gross * (1 - pct / 100));
  const ok = !!cid && title.trim() && items.some((i) => i.name.trim() && i.amount > 0);

  const setItem = (i: number, patch: Partial<QuoteItem>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const submit = () => {
    if (!ok) { toast("견적명과 항목을 한 개 이상 입력해 주세요.", "error"); return; }
    if (editing) {
      const discountChanged = pct !== editing.discountPct;
      update(editing.id, {
        projectId: project || undefined, title: title.trim(), scope: scope.trim(), period,
        items: items.filter((i) => i.name.trim() && i.amount > 0), discountPct: pct,
        // 날짜가 그대로면 보내지 않는다 — 시각만 재구성돼 "유효기간 변경"으로 잘못 기록되는 것을 막는다
        validUntil: valid === dateInput(new Date(editing.validUntil)) ? undefined : new Date(`${valid}T23:59:00`).toISOString(),
      }, me);
      toast(discountChanged && editing.approvalId ? "견적을 수정했습니다. 할인율이 바뀌어 대표 승인을 다시 받아야 합니다." : "견적을 수정했습니다.");
      onClose();
      return;
    }
    create(
      {
        companyId: cid,
        projectId: project || undefined,
        opportunityId: opp || undefined,
        title: title.trim(),
        scope: scope.trim(),
        period,
        items: items.filter((i) => i.name.trim() && i.amount > 0),
        discountPct: pct,
        validUntil: new Date(`${valid}T23:59:00`).toISOString(),
      },
      me,
    );
    toast(pct > 0 ? "견적을 작성했습니다. 할인이 있어 대표 승인 후 발송할 수 있습니다." : "견적을 작성했습니다. 검토 후 발송하세요.");
    setTitle(""); setScope(""); setItems([{ name: "", amount: 0 }]); setDiscount("0");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "견적 수정" : "견적 작성"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="accent" onClick={submit}>저장</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {!companyId && !editing && (
          <Field label="기업">
            <Select value={company} onChange={(e) => { setCompany(e.target.value); setProject(""); setOpp(""); }}>
              {st.companies.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="프로젝트" hint="선택">
          <Select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">연결 안 함</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        {opps.length > 0 && !editing && (
          <Field label="매출기회 연결" hint="연결하면 계약 전환 시 기회도 같이 닫힙니다.">
            <Select value={opp} onChange={(e) => setOpp(e.target.value)}>
              <option value="">연결 안 함</option>
              {opps.map((o) => <option key={o.id} value={o.id}>{o.serviceName}</option>)}
            </Select>
          </Field>
        )}
        <Field label="기간">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {["1개월", "2개월", "3개월", "4개월", "6개월", "12개월"].map((x) => <option key={x} value={x}>{x}</option>)}
          </Select>
        </Field>
        <Field label="유효기간"><Input type="date" value={valid} onChange={(e) => setValid(e.target.value)} /></Field>
      </div>

      <div className="mt-3 grid gap-3">
        <Field label="견적명"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 경영진단 2차 — 원가 개선 실행지원" /></Field>
        <Field label="범위" hint="고객이 그대로 읽습니다."><Textarea rows={2} value={scope} onChange={(e) => setScope(e.target.value)} placeholder="예: 개선안 실행 동행 · 월 2회 점검 · 성과 리포트" /></Field>
      </div>

      <div className="mt-4 rounded-xl border border-line p-4">
        <div className="mb-2 text-[0.85rem] font-bold">항목</div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex gap-2">
              <Input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="항목명" />
              <div className="flex w-[140px] shrink-0 items-center gap-1">
                <Input inputMode="numeric" value={it.amount ? String(it.amount / 10000) : ""} onChange={(e) => setItem(i, { amount: Number(e.target.value.replace(/[^0-9]/g, "")) * 10000 })} placeholder="0" />
                <span className="shrink-0 text-[0.8rem] text-ink-3">만원</span>
              </div>
              <button type="button" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} disabled={items.length === 1} className="pressable shrink-0 rounded-lg px-2 text-ink-3 hover:text-error disabled:opacity-30" aria-label="항목 삭제">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" icon={<Plus size={15} />} className="mt-2" onClick={() => setItems((xs) => [...xs, { name: "", amount: 0 }])}>항목 추가</Button>
      </div>

      <div className={cx("mt-3 rounded-xl border px-4 py-3", pct > 0 ? "border-warning/40 bg-warning-bg" : "border-line bg-surface-2")}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[120px]">
            <Field label="할인 (%)"><Input inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} /></Field>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pb-1">
            <span className="text-[0.8rem] text-ink-3">합계</span>
            <span className="tnum font-semibold">{fmtWon(gross)}</span>
            {pct > 0 && <><span className="text-[0.8rem] text-ink-3">할인 적용</span><span className="tnum text-[1.05rem] font-bold text-accent">{fmtWon(net)}</span></>}
          </div>
        </div>
        {pct > 0 && <p className="mt-2 text-[0.82rem] font-semibold text-warning">할인이 포함되어 대표 승인 후에만 발송할 수 있습니다.</p>}
      </div>
    </Modal>
  );
}

/* ---------------- 할인 승인 요청 ---------------- */

export function QuoteApprovalModal({ quote, onClose }: { quote: Quote | null; onClose: () => void }) {
  const request = useStore((s) => s.requestQuoteApproval);
  const toast = useStore((s) => s.toast);
  const companies = useStore((s) => s.companies);
  const me = useStore((s) => s.session?.userId) ?? "u_admin";
  const [why, setWhy] = useState("");
  if (!quote) return null;
  const c = companies.find((x) => x.id === quote.companyId);
  return (
    <Modal
      open={!!quote}
      onClose={onClose}
      title="할인 승인 요청"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="accent" onClick={() => { request(quote.id, why, me); toast("대표님께 할인 승인 요청을 보냈습니다."); setWhy(""); onClose(); }}>승인 요청</Button>
        </>
      }
    >
      <div className="rounded-xl bg-surface-2 px-4 py-3 text-[0.88rem]">
        <b>{c?.name}</b> · {quote.title}
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 text-ink-2">
          <span className="tnum">{fmtWon(quoteGross(quote))}</span>
          <span>할인 {quote.discountPct}%</span>
          <b className="tnum text-accent">{fmtWon(quoteNet(quote))}</b>
        </div>
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-[0.85rem] font-semibold text-ink-2">요청 사유</label>
        <Textarea rows={3} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="예: 정책자금 건을 함께 진행 중인 기존 고객입니다." />
      </div>
      <p className="mt-2 text-[0.8rem] text-ink-3">반려되면 할인이 0%로 되돌아가고 견적은 다시 작성 중 상태가 됩니다.</p>
    </Modal>
  );
}

/* ---------------- 견적 상세 · 실행 ---------------- */

export function QuoteDetailModal({ quote, onClose, onEdit }: { quote: Quote | null; onClose: () => void; onEdit?: (id: string) => void }) {
  const st = useStore();
  const send = useStore((s) => s.sendQuote);
  const convert = useStore((s) => s.convertQuote);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const [approvalFor, setApprovalFor] = useState<Quote | null>(null);
  // 유효기간은 지나도 상태를 자동으로 바꾸지 않는다 — 사람이 연장할지 재발송할지 정한다. 사실만 알린다.
  const tick = useNow(60000);
  if (!quote) return null;
  const q = st.quotes.find((x) => x.id === quote.id) ?? quote;
  const c = st.companies.find((x) => x.id === q.companyId);
  const s = QUOTE_STATUS[q.status];
  // 할인이 있는데 아직 승인 기록(approvalId)이 붙지 않았으면 발송할 수 없다.
  const needsApproval = q.discountPct > 0 && !q.approvalId;
  const expiredDays = tick ? daysBetween(q.validUntil, tick.toISOString()) : 0;

  return (
    <>
      <Modal
        open={!!quote}
        onClose={onClose}
        title={q.title}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>닫기</Button>
            {q.status === "draft" && (
              needsApproval
                ? <Button variant="accent" onClick={() => setApprovalFor(q)}>대표 승인 요청</Button>
                : <Button variant="accent" onClick={() => { send(q.id, me); toast("견적을 발송했습니다. 고객 Portal에 표시되고 회신 확인 업무가 생성되었습니다."); onClose(); }}>고객에게 발송</Button>
            )}
            {q.status === "accepted" && (
              <Button variant="accent" onClick={() => { convert(q.id, me); toast("계약으로 전환했습니다. 계약 탭에서 확인하세요."); onClose(); }}>계약으로 전환</Button>
            )}
            {(q.status === "draft" || q.status === "approval_pending") && onEdit && (
              <Button variant="outline" icon={<Pencil size={15} />} onClick={() => { onClose(); onEdit(q.id); }}>수정</Button>
            )}
            <Link href={`/print/quote/${q.id}`} className="pressable inline-flex h-11 items-center gap-2 rounded-[var(--radius-btn)] border border-line-2 bg-surface px-4 text-[0.9rem] font-semibold text-ink hover:bg-surface-2">
              <Printer size={15} /> 견적서 인쇄
            </Link>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={s.tone}>{s.label}</Badge>
          <span className="font-semibold">{c?.name}</span>
          <span className="text-[0.85rem] text-ink-3">{q.period} · 유효 {q.validUntil.slice(0, 10)}</span>
        </div>
        {q.scope && <p className="mt-2 text-[0.9rem] text-ink-2">{q.scope}</p>}

        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          {q.items.map((it, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-[0.88rem] last:border-0">
              <span className="min-w-0 flex-1">{it.name}{it.note && <span className="ml-2 text-[0.78rem] text-ink-3">{it.note}</span>}</span>
              <span className="tnum shrink-0 font-semibold">{fmtWon(it.amount)}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 bg-surface-2 px-4 py-2.5 text-[0.88rem]">
            <span className="flex-1 font-bold">합계</span>
            {q.discountPct > 0 && <span className="tnum text-ink-3 line-through">{fmtWon(quoteGross(q))}</span>}
            {q.discountPct > 0 && <Badge tone="warning">-{q.discountPct}%</Badge>}
            <span className="tnum text-[1.05rem] font-bold text-accent">{fmtWon(quoteNet(q))}</span>
          </div>
        </div>

        {needsApproval && <div className="mt-3 rounded-xl bg-warning-bg px-4 py-2.5 text-[0.85rem] font-semibold text-warning">할인 {q.discountPct}%가 포함되어 있어 대표 승인 전에는 발송할 수 없습니다.</div>}
        {q.status === "draft" && q.discountPct > 0 && q.approvalId && <div className="mt-3 rounded-xl bg-success-bg px-4 py-2.5 text-[0.85rem] font-semibold text-success">대표 승인 완료 — 할인 {q.discountPct}%로 발송할 수 있습니다.</div>}
        {q.status === "approval_pending" && <div className="mt-3 rounded-xl bg-warning-bg px-4 py-2.5 text-[0.85rem] font-semibold text-warning">대표 승인 대기 중입니다. 승인 · 매출기회 화면에서 처리할 수 있습니다.</div>}
        {q.status === "sent" && (expiredDays > 0
          ? <div className="mt-3 rounded-xl bg-warning-bg px-4 py-2.5 text-[0.85rem] text-warning"><b>유효기간이 {expiredDays}일 지났습니다.</b> 고객 화면에도 같은 안내가 표시됩니다. 연장하려면 새 견적으로 재발송하세요.</div>
          : <div className="mt-3 rounded-xl bg-info-bg px-4 py-2.5 text-[0.85rem] text-info">고객 Portal에 표시되어 있습니다. 회신이 오면 알림과 업무로 도착합니다.</div>)}
        {q.status === "declined" && <div className="mt-3 rounded-xl bg-error-bg px-4 py-2.5 text-[0.85rem] text-error"><b>고객 보류</b>{q.clientNote ? ` — ${q.clientNote}` : ""}</div>}
        {q.status === "converted" && <div className="mt-3 rounded-xl bg-success-bg px-4 py-2.5 text-[0.85rem] text-success">계약으로 전환되었습니다.</div>}
      </Modal>
      <QuoteApprovalModal quote={approvalFor} onClose={() => { setApprovalFor(null); onClose(); }} />
    </>
  );
}
