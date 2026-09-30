"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Trash2, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import type { Company, Payment, PaymentKind } from "@/lib/types";
import { PAYMENT_KIND_LABEL, netOf, paymentTotals, won } from "@/lib/work-status";
import { daysFromTo, dueText, todayYmd } from "@/lib/vault";
import { Badge, Button, Card, Input, Select, cx } from "@/components/ui/ui";
import { Confirm } from "@/components/ui/overlay";

/**
 * 수금 — 계약금 · 중도금 · 성공보수. 받기로 한 날이 지나면 빨갛게, 7일 안이면 먼저 알려 준다.
 * 금액이 정해지지 않았으면 "미정"으로 두고 합계에서 뺀다 — 모르는 숫자를 채워 넣지 않는다.
 */
export function MoneySection({ company }: { company: Company }) {
  const all = useStore((s) => s.payments);
  // 선택 함수 안에서 filter 하면 매번 새 배열이 나와 화면이 끝없이 다시 그려진다 — 원본을 받아 여기서 거른다
  const allProjects = useStore((s) => s.projects);
  const allContracts = useStore((s) => s.contracts);
  const projects = useMemo(() => allProjects.filter((p) => p.companyId === company.id && !p.archived), [allProjects, company.id]);
  const contracts = useMemo(() => allContracts.filter((c) => c.companyId === company.id), [allContracts, company.id]);
  const add = useStore((s) => s.addPayment);
  const toast = useStore((s) => s.toast);
  const role = useStore((s) => s.session?.role);
  const me = useStore((s) => s.session?.userId) ?? "";
  const may = can(role, "payment.write");
  const today = todayYmd();
  const list = all.filter((p) => p.companyId === company.id).sort((a, b) => Number(!!a.receivedAt) - Number(!!b.receivedAt) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const t = paymentTotals(list, today);
  const contractSum = contracts.filter((c) => c.status === "signed" && c.amount).reduce((s, c) => s + (c.amount ?? 0), 0);
  const gap = contractSum > 0 ? contractSum - t.billed : 0;

  return (
    <Card className="p-5" id="money-section">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Wallet size={18} className="text-accent" /><span className="text-[1.05rem] font-bold">수금</span>
        <span className="text-[0.78rem] text-ink-3">계약금 · 중도금 · 성공보수</span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label="청구 합계" value={won(t.billed)} hint={t.unknown ? `금액 미정 ${t.unknown}건` : undefined} />
        <Tile label="받은 돈" value={won(t.received)} tone="success" />
        <Tile label="못 받은 돈" value={won(t.unpaid)} tone={t.overdue ? "error" : undefined} hint={t.overdue ? `예정일 지난 건 ${t.overdue}건` : "연체 없음"} />
        <Tile label={t.agent ? "영업자 수수료" : "내 몫 비율"} value={t.agent ? won(t.agent) : t.marginPct !== null ? `${t.marginPct}%` : "-"} hint={t.agent && t.marginPct !== null ? `내 몫 ${t.marginPct}%` : undefined} />
      </div>
      {gap !== 0 && may && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[0.82rem]">
          <span className="min-w-0 flex-1">체결된 계약 금액 {won(contractSum)} · 수금 항목 {won(t.billed)} — <b>{won(Math.abs(gap))} {gap > 0 ? "덜 적힘" : "더 적힘"}</b></span>
          {gap > 0 && <Button size="sm" variant="outline" onClick={() => { add({ companyId: company.id, kind: "interim", label: "계약 잔금", amount: gap, dueDate: dateAfter(7) }, me); toast("차이만큼 '계약 잔금' 항목을 넣었습니다. 받기로 한 날을 확인해 주세요."); }}>차이만큼 수금 항목 추가</Button>}
        </div>
      )}

      <div className="mt-3 divide-y divide-line rounded-xl border border-line">
        {list.length === 0 && <p className="px-4 py-6 text-center text-[0.85rem] text-ink-3">아직 수금 항목이 없습니다. 계약금·중도금·성공보수를 넣으면 받을 날을 챙겨 드립니다.</p>}
        {list.map((p) => <PaymentRow key={p.id} p={p} may={may} projectName={projects.find((x) => x.id === p.projectId)?.name} today={today} />)}
      </div>
      {may && <AddPayment company={company} projects={projects.map((p) => ({ id: p.id, name: p.name }))} />}
    </Card>
  );
}

const dateAfter = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return todayYmd(d); };

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "success" | "error" }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <div className="text-[0.75rem] font-semibold text-ink-3">{label}</div>
      <div className={cx("tnum mt-0.5 text-[1.1rem] font-bold", tone === "error" && "text-error", tone === "success" && "text-success")}>{value}</div>
      {hint && <div className="text-[0.72rem] text-ink-3">{hint}</div>}
    </div>
  );
}

function PaymentRow({ p, may, projectName, today }: { p: Payment; may: boolean; projectName?: string; today: string }) {
  const update = useStore((s) => s.updatePayment);
  const remove = useStore((s) => s.removePayment);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "";
  const [confirm, setConfirm] = useState(false);
  const d = p.dueDate && !p.receivedAt ? daysFromTo(today, p.dueDate) : null;
  return (
    <div className={cx("flex flex-wrap items-center gap-2 px-3 py-2.5", d !== null && d < 0 && "bg-error-bg/30")} data-payment={p.id}>
      <button type="button" disabled={!may} onClick={() => { update(p.id, { receivedAt: p.receivedAt ? undefined : today }, me); if (!p.receivedAt) toast(`입금 확인: ${p.label}`); }}
        className={cx("pressable inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[0.75rem] font-bold", p.receivedAt ? "border-success/40 bg-success-bg text-success" : "border-line text-ink-2 hover:bg-surface-2")}
        aria-pressed={!!p.receivedAt} aria-label={`${p.label} ${p.receivedAt ? "입금 확인 취소" : "입금 확인"}`}>
        {p.receivedAt ? <><Check size={13} /> 입금됨</> : "입금 확인"}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cx("font-semibold", p.receivedAt && "text-ink-3")}>{p.label}</span>
          <Badge>{PAYMENT_KIND_LABEL[p.kind]}</Badge>
          {projectName && <span className="truncate text-[0.75rem] text-ink-3">{projectName}</span>}
          {d !== null && d < 0 && <Badge tone="error">{dueText(d)}</Badge>}
          {d !== null && d >= 0 && d <= 7 && <Badge tone="warning">{dueText(d)}</Badge>}
        </div>
        <div className="mt-0.5 text-[0.75rem] text-ink-3">
          {p.receivedAt ? `입금 ${p.receivedAt}` : p.dueDate ? `받기로 한 날 ${p.dueDate}` : "받기로 한 날 미정"}
          {p.agentFee ? ` · 영업자 ${p.agentName || "이름 없음"} ${won(p.agentFee)} → 내 몫 ${won(netOf(p))}` : ""}
        </div>
      </div>
      <span className={cx("tnum shrink-0 text-[0.95rem] font-bold", p.receivedAt && "text-ink-3 line-through decoration-ink-3/40")}>{won(p.amount)}</span>
      {may && (
        <>
          {!p.receivedAt && <Input type="date" value={p.dueDate ?? ""} onChange={(e) => update(p.id, { dueDate: e.target.value || undefined }, me)} className="h-9 w-auto shrink-0" aria-label={`${p.label} 받기로 한 날`} />}
          <button type="button" onClick={() => setConfirm(true)} className="pressable icon-btn shrink-0 text-ink-3 hover:text-error" aria-label={`${p.label} 지우기`}><Trash2 size={15} /></button>
        </>
      )}
      <Confirm open={confirm} onClose={() => setConfirm(false)} danger confirmText="지우기" title={`${p.label} 지울까요?`} desc="지운 사실은 기록에 남습니다."
        onConfirm={() => { remove(p.id, me); setConfirm(false); }} />
    </div>
  );
}

function AddPayment({ company, projects }: { company: Company; projects: { id: string; name: string }[] }) {
  const add = useStore((s) => s.addPayment);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "";
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PaymentKind>("deposit");
  const [projectId, setProjectId] = useState("");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentFee, setAgentFee] = useState("");
  const [agentName, setAgentName] = useState("");
  const num = (s: string) => (s.replace(/\D/g, "") ? Number(s.replace(/\D/g, "")) : undefined);
  const fmt = (s: string) => (num(s) !== undefined ? num(s)!.toLocaleString("ko-KR") : "");
  const bump = (n: number) => setAmount(String((num(amount) ?? 0) + n));
  const submit = () => {
    const pname = projects.find((p) => p.id === projectId)?.name;
    const id = add({ companyId: company.id, projectId: projectId || undefined, kind, label: label.trim() || `${pname ? `${pname} ` : ""}${PAYMENT_KIND_LABEL[kind]}`, amount: num(amount), dueDate: due || undefined, agentFee: num(agentFee), agentName: agentName.trim() || undefined }, me);
    if (id) { toast("수금 항목을 넣었습니다."); setLabel(""); setAmount(""); setDue(""); setAgentFee(""); setAgentName(""); setOpen(false); }
  };
  if (!open) return <Button className="mt-3" variant="outline" icon={<Plus size={15} />} onClick={() => setOpen(true)}>수금 항목 넣기</Button>;
  const net = (num(amount) ?? 0) - (num(agentFee) ?? 0);
  return (
    <div className="mt-3 space-y-2.5 rounded-xl border border-line p-3" id="add-payment">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-[0.8rem] text-ink-2">종류
          <Select className="mt-1" value={kind} onChange={(e) => setKind(e.target.value as PaymentKind)} aria-label="수금 종류">
            {(Object.keys(PAYMENT_KIND_LABEL) as PaymentKind[]).map((k) => <option key={k} value={k}>{PAYMENT_KIND_LABEL[k]}</option>)}
          </Select>
        </label>
        <label className="text-[0.8rem] text-ink-2">관련 프로젝트
          <Select className="mt-1" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="관련 프로젝트">
            <option value="">전체 계약</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </label>
        <label className="text-[0.8rem] text-ink-2">이름 (선택)
          <Input className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={PAYMENT_KIND_LABEL[kind]} />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[0.8rem] text-ink-2">금액 (원)
          <Input className="mt-1 tnum" inputMode="numeric" value={fmt(amount)} onChange={(e) => setAmount(e.target.value)} placeholder="미정이면 비워 두세요" aria-label="금액" />
          <span className="mt-1 flex flex-wrap gap-1">
            {([["+10만", 100000], ["+100만", 1000000], ["+1,000만", 10000000]] as const).map(([l, n]) => <button key={l} type="button" onClick={() => bump(n)} className="pressable rounded-full border border-line px-2 py-0.5 text-[0.72rem] font-semibold">{l}</button>)}
            <button type="button" onClick={() => setAmount("")} className="pressable rounded-full px-2 py-0.5 text-[0.72rem] text-ink-3">지우기</button>
          </span>
        </label>
        <label className="text-[0.8rem] text-ink-2">받기로 한 날
          <Input className="mt-1" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="받기로 한 날" />
        </label>
      </div>
      {agentOpen ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[0.8rem] text-ink-2">영업자 수수료 (원)<Input className="mt-1 tnum" inputMode="numeric" value={fmt(agentFee)} onChange={(e) => setAgentFee(e.target.value)} placeholder="없음" /></label>
          <label className="text-[0.8rem] text-ink-2">영업자 이름<Input className="mt-1" value={agentName} onChange={(e) => setAgentName(e.target.value)} /></label>
          {num(amount) !== undefined && num(agentFee) !== undefined && <p className="text-[0.78rem] text-ink-2 sm:col-span-2">→ 내 몫 {won(net)}</p>}
        </div>
      ) : <button type="button" onClick={() => setAgentOpen(true)} className="text-[0.78rem] font-semibold text-ink-3 hover:text-ink">+ 영업자 수수료가 있으면</button>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)}>취소</Button>
        <Button variant="accent" onClick={submit}>추가</Button>
      </div>
    </div>
  );
}
