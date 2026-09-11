"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardList, FileSignature, Percent, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { fmtDate, fmtDateTime, fmtWon } from "@/lib/format";
import { AiReadyBadge, Badge, Button, Card, Field, Input, PageHeader, Tabs, EmptyState } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";
import { NewConsultationModal } from "@/components/domain/ConsultationModal";
import type { Contract } from "@/lib/types";

/** 할인은 대표 승인 후 진행 — 요청은 여기서 시작한다. */
function DiscountModal({ ct, onClose }: { ct: Contract | null; onClose: () => void }) {
  const st = useStore();
  const request = useStore((s) => s.requestApproval);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const [amount, setAmount] = useState("");
  const [pct, setPct] = useState("10");
  const [why, setWhy] = useState("");
  if (!ct) return null;
  const company = st.companies.find((c) => c.id === ct.companyId);
  const base = Number(amount.replace(/[^0-9]/g, "")) * 10000;
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const valid = base > 0 && p > 0;
  return (
    <Modal
      open={!!ct}
      onClose={onClose}
      title="할인 승인 요청"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button
            variant="accent"
            disabled={!valid}
            onClick={() => {
              request({ kind: "discount", title: `${company?.name ?? ""} ${ct.title} 할인 요청`, summary: why.trim() || `${ct.scope} · 할인 ${p}% 적용 여부를 결정해 주세요.`, companyId: ct.companyId, projectId: ct.projectId, baseAmount: base, discountPct: p }, me);
              toast("대표님께 할인 승인 요청을 보냈습니다.");
              setAmount(""); setPct("10"); setWhy("");
              onClose();
            }}
          >
            승인 요청
          </Button>
        </>
      }
    >
      <div className="rounded-xl bg-surface-2 px-4 py-3 text-[0.88rem]"><b>{company?.name}</b> · {ct.title}</div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="계약 금액 (만원)"><Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1200" /></Field>
        <Field label="요청 할인 (%)"><Input inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value)} /></Field>
      </div>
      {valid && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 rounded-xl bg-surface-2 px-4 py-2.5 text-[0.85rem]">
          <span className="text-ink-3">적용 시</span>
          <b className="tnum text-accent">{fmtWon(base * (1 - p / 100))}</b>
          <span className="tnum text-ink-3">(-{fmtWon(base * (p / 100))})</span>
        </div>
      )}
      <div className="mt-3">
        <Field label="요청 사유" hint="대표님이 5초 안에 판단할 수 있게 적어주세요.">
          <Input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="예: 정책자금 건을 함께 진행 중인 기존 고객" />
        </Field>
      </div>
    </Modal>
  );
}

export default function ConsultationsPage() {
  const st = useStore();
  const openAi = useUi((s) => s.openAi);
  const [tab, setTab] = useState<"consult" | "contract">("consult");
  const consultations = [...st.consultations].sort((a, b) => b.date.localeCompare(a.date));
  const contracts = [...st.contracts].sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
  const [discount, setDiscount] = useState<Contract | null>(null);
  const [newConsult, setNewConsult] = useState(false);
  const pendingDiscount = (ct: Contract) => st.approvals.some((a) => a.kind === "discount" && a.projectId === ct.projectId && a.status === "pending");
  return (
    <div>
      <PageHeader title="상담 · 계약" desc="상담 기록은 구조화 요약으로 남기고, 계약 상태는 프로젝트 단계와 연결됩니다." actions={<Button variant="accent" icon={<Plus size={16} />} onClick={() => setNewConsult(true)}>상담 기록 작성</Button>} />
      <Tabs tabs={[{ key: "consult", label: "상담 기록", count: consultations.length }, { key: "contract", label: "계약", count: contracts.length }]} value={tab} onChange={setTab} />
      <div className="mt-5">
        {tab === "consult" ? (
          <div className="space-y-3">
            {consultations.map((cs) => {
              const c = st.companies.find((x) => x.id === cs.companyId);
              return (
                <Card key={cs.id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/ax/clients/${cs.companyId}`} className="font-bold hover:text-accent">{c?.name}</Link>
                      <Badge tone="info">{cs.type}</Badge><Badge>{cs.channel}</Badge>
                      <span className="text-[0.85rem] text-ink-2">{fmtDateTime(cs.date)} · {st.users.find((u) => u.id === cs.consultantId)?.name}</span>
                    </div>
                    <AiReadyBadge label="AI 요약" onClick={() => openAi({ title: "상담 요약 — AI 적용 설명", key: "consult" })} />
                  </div>
                  <p className="mt-3 text-[0.9rem] leading-relaxed text-ink-2">{cs.notes}</p>
                  <div className="mt-3 grid gap-3 rounded-xl bg-surface-2 p-4 text-[0.85rem] md:grid-cols-4">
                    <div><div className="mb-1 font-bold">핵심</div><ul className="list-disc pl-4 text-ink-2">{cs.summary.core.map((x) => <li key={x}>{x}</li>)}</ul></div>
                    <div><div className="mb-1 font-bold">요구사항</div><ul className="list-disc pl-4 text-ink-2">{cs.summary.requirements.map((x) => <li key={x}>{x}</li>)}</ul></div>
                    <div><div className="mb-1 font-bold">필요 자료</div>{cs.summary.documents.length ? <ul className="list-disc pl-4 text-ink-2">{cs.summary.documents.map((x) => <li key={x}>{x}</li>)}</ul> : <div className="text-ink-3">-</div>}</div>
                    <div><div className="mb-1 font-bold">다음 Action</div><div className="text-accent">{cs.summary.nextAction}</div></div>
                  </div>
                </Card>
              );
            })}
            {consultations.length === 0 && <Card><EmptyState icon={<ClipboardList size={30} />} title="상담 기록이 없습니다" desc="오른쪽 위 '상담 기록 작성'으로 첫 기록을 남길 수 있습니다." action={<Button variant="accent" icon={<Plus size={16} />} onClick={() => setNewConsult(true)}>상담 기록 작성</Button>} /></Card>}
          </div>
        ) : (
          <>
          <div className="space-y-2 lg:hidden">
            {contracts.map((ct) => (
              <div key={ct.id} className="card p-4">
                <div className="flex items-center gap-2">
                  <Link href={`/ax/clients/${ct.companyId}`} className="truncate font-bold hover:text-accent">{st.companies.find((c) => c.id === ct.companyId)?.name}</Link>
                  <Badge tone={ct.status === "signed" ? "success" : ct.status === "sent" ? "warning" : "neutral"}>{ct.status === "signed" ? "서명 완료" : ct.status === "sent" ? "서명 대기" : "초안"}</Badge>
                </div>
                <div className="mt-1 text-[0.88rem] font-semibold">{ct.title}</div>
                <div className="mt-0.5 truncate text-[0.82rem] text-ink-2">{ct.scope}</div>
                <div className="mt-2 flex flex-wrap gap-x-3 text-[0.78rem] text-ink-3">
                  <span>{ct.period}</span>
                  <span>송부 {ct.sentAt ? fmtDate(ct.sentAt) : "-"}</span>
                  <span>서명 {ct.signedAt ? fmtDate(ct.signedAt) : "-"}</span>
                </div>
                {ct.status !== "signed" && (
                  pendingDiscount(ct)
                    ? <div className="mt-2 text-[0.8rem] font-semibold text-warning">할인 승인 대기 중</div>
                    : <Button size="sm" variant="outline" className="mt-2" icon={<Percent size={14} />} onClick={() => setDiscount(ct)}>할인 승인 요청</Button>
                )}
              </div>
            ))}
          </div>
          <Card className="hidden lg:block">
            <table className="tbl">
              <thead><tr><th>기업</th><th>계약명</th><th>프로젝트</th><th>상태</th><th>기간</th><th>송부</th><th>서명</th><th>범위</th><th></th></tr></thead>
              <tbody>
                {contracts.map((ct) => (
                  <tr key={ct.id}>
                    <td className="font-semibold"><Link href={`/ax/clients/${ct.companyId}`} className="hover:text-accent">{st.companies.find((c) => c.id === ct.companyId)?.name}</Link></td>
                    <td>{ct.title}</td>
                    <td><Link href={`/ax/projects/${ct.projectId}`} className="text-ink-2 hover:text-accent">{st.projects.find((p) => p.id === ct.projectId)?.name}</Link></td>
                    <td><Badge tone={ct.status === "signed" ? "success" : ct.status === "sent" ? "warning" : "neutral"}>{ct.status === "signed" ? "서명 완료" : ct.status === "sent" ? "서명 대기" : "초안"}</Badge></td>
                    <td>{ct.period}</td>
                    <td className="tnum">{ct.sentAt ? fmtDate(ct.sentAt) : "-"}</td>
                    <td className="tnum">{ct.signedAt ? fmtDate(ct.signedAt) : "-"}</td>
                    <td className="text-ink-2">{ct.scope}</td>
                    <td className="nowrap text-right">
                      {ct.status !== "signed" && (pendingDiscount(ct) ? <Badge tone="warning">승인 대기</Badge> : <Button size="sm" variant="ghost" icon={<Percent size={14} />} onClick={() => setDiscount(ct)}>할인 승인</Button>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-[0.8rem] text-ink-3"><FileSignature size={14} /> 전자서명 연동은 향후 확장(NEXT) 항목입니다. 현재는 상태를 수동으로 관리합니다.</div>
          </Card>
          </>
        )}
        {tab === "contract" && (
          <div className="mt-3 flex items-start gap-2 text-[0.8rem] text-ink-3"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> 할인은 대표 승인 후 진행합니다. 요청하면 승인 · 매출기회 화면의 대표 승인 목록으로 올라갑니다.</div>
        )}
      </div>
      <DiscountModal ct={discount} onClose={() => setDiscount(null)} />
      <NewConsultationModal open={newConsult} onClose={() => setNewConsult(false)} />
    </div>
  );
}

export { Sparkles };
