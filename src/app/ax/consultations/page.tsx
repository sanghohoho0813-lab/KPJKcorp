"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ClipboardList, FileSignature, Plus, Receipt, ShieldCheck, Sparkles, Pencil } from "lucide-react";
import { useStore, quoteNet } from "@/lib/store";
import { AxInsightButton } from "@/components/ai/AxInsight";
import { useUi } from "@/lib/ui-store";
import { fmtDate, fmtDateTime, fmtWon } from "@/lib/format";
import { AiReadyBadge, Badge, Button, Card, PageHeader, SegmentedControl, Tabs, EmptyState, cx } from "@/components/ui/ui";
import { SearchBox } from "@/components/domain/domain";
import { NewConsultationModal } from "@/components/domain/ConsultationModal";
import { ContractModal, useMay } from "@/components/domain/EntityModals";
import { NewQuoteModal, QuoteDetailModal, QUOTE_STATUS } from "@/components/domain/QuoteModals";
import type { Consultation, Quote } from "@/lib/types";

const CS_TYPES: Consultation["type"][] = ["초기상담", "후속상담", "정기미팅", "대표미팅"];

/**
 * 상담 기록 목록 — 한 건 = 한 줄 요약(기업 · 유형 · 날짜 · 다음 Action). 누르면 전체 내용이 펼쳐진다.
 * 12건이 휴대폰에서 8,800px까지 늘어나던 것을 줄이고, 검색·유형으로 바로 찾게 한다.
 */
function ConsultList({ consultations, onNew, onEdit }: { consultations: Consultation[]; onNew: () => void; onEdit?: (id: string) => void }) {
  const st = useStore();
  const openAi = useUi((s) => s.openAi);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | Consultation["type"]>("all");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const nameOf = (id: string) => st.companies.find((x) => x.id === id)?.name ?? "";
  const userOf = (id: string) => st.users.find((u) => u.id === id)?.name ?? "";
  const needle = q.trim().toLowerCase().replace(/\s+/g, "");
  const rows = consultations.filter((cs) => (type === "all" || cs.type === type) && (!needle || [nameOf(cs.companyId), userOf(cs.consultantId), cs.notes, cs.summary.nextAction, ...cs.summary.core, ...cs.summary.requirements, ...cs.summary.promises, ...cs.summary.documents].join(" ").toLowerCase().replace(/\s+/g, "").includes(needle)));
  // 상담에서 만든 후속 업무(cs:상담id:…) — 정한 것이 실제로 처리됐는지 목록에서 바로 보인다
  const follow = (id: string) => { const ts = st.tasks.filter((t) => t.ruleKey?.startsWith(`cs:${id}:`)); return { all: ts.length, done: ts.filter((t) => t.status === "done").length }; };
  const types = CS_TYPES.filter((t) => consultations.some((cs) => cs.type === t));
  if (consultations.length === 0) return <Card><EmptyState icon={<ClipboardList size={30} />} title="상담 기록이 없습니다" desc="오른쪽 위 '상담 기록 작성'으로 첫 기록을 남길 수 있습니다." action={<Button variant="accent" icon={<Plus size={16} />} onClick={onNew}>상담 기록 작성</Button>} /></Card>;
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="md:w-80"><SearchBox value={q} onChange={setQ} placeholder="기업명 · 상담 내용 · 담당자 검색" /></div>
        {types.length > 1 && <SegmentedControl size="sm" value={type} onChange={setType} options={[{ key: "all" as const, label: `전체 ${consultations.length}` }, ...types.map((t) => ({ key: t, label: t }))]} />}
      </div>
      <Card className="overflow-hidden">
        {rows.length === 0 ? <EmptyState icon={<ClipboardList size={30} />} title="해당 조건의 상담 기록이 없습니다" /> : (
          <ul className="divide-y divide-line" data-testid="consult-list">
            {rows.map((cs, i) => {
              const isOpen = open.has(cs.id);
              const month = cs.date.slice(0, 7);
              const head = i === 0 || rows[i - 1].date.slice(0, 7) !== month;
              const f = follow(cs.id);
              return (
                <li key={cs.id} data-consult={cs.id}>
                  {head && <div className="bg-surface-2 px-4 py-1.5 text-[0.78rem] font-bold text-ink-2 md:px-5">{Number(month.slice(0, 4))}년 {Number(month.slice(5, 7))}월</div>}
                  <div className="flex items-start gap-2 px-4 py-3 md:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link href={`/ax/clients/${cs.companyId}`} className="tap font-bold hover:text-accent">{nameOf(cs.companyId)}</Link>
                        <Badge tone="info">{cs.type}</Badge>
                        <span className="text-[0.8rem] text-ink-3">{cs.channel} · {fmtDateTime(cs.date)} · {userOf(cs.consultantId)}</span>
                        {f.all > 0 && <span className={cx("text-[0.78rem] font-semibold", f.done === f.all ? "text-success" : "text-ink-2")}>후속 업무 {f.done}/{f.all} 완료</span>}
                      </div>
                      <button type="button" onClick={() => toggle(cs.id)} aria-expanded={isOpen} className="mt-1 block w-full text-left">
                        {!isOpen && <span className="line-clamp-1 text-[0.88rem] text-ink-2">{cs.notes}</span>}
                        {cs.summary.nextAction && <span className="mt-0.5 block truncate text-[0.85rem]"><b className="text-accent">다음</b> {cs.summary.nextAction}</span>}
                      </button>
                    </div>
                    <div className="flex shrink-0 items-center">
                      {onEdit && <button onClick={() => onEdit(cs.id)} aria-label="상담기록 수정" className="pressable icon-btn text-ink-3 hover:bg-surface-2 hover:text-ink"><Pencil size={15} /></button>}
                      <button type="button" onClick={() => toggle(cs.id)} aria-label={isOpen ? "접기" : "펼치기"} aria-expanded={isOpen} className="pressable icon-btn text-ink-3 hover:bg-surface-2 hover:text-ink"><ChevronDown size={18} className={cx("transition-transform", isOpen && "rotate-180")} /></button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="px-4 pb-4 md:px-5">
                      <p className="whitespace-pre-line text-[0.9rem] leading-relaxed text-ink-2">{cs.notes}</p>
                      <div className="mt-3 grid gap-3 rounded-xl bg-surface-2 p-4 text-[0.85rem] md:grid-cols-2">
                        {([["핵심", cs.summary.core], ["요구사항", cs.summary.requirements], ["우리가 약속한 것", cs.summary.promises], ["필요 자료", cs.summary.documents]] as const).filter(([, xs]) => xs.length > 0).map(([t, xs]) => (
                          <div key={t}><div className="mb-1 font-bold">{t}</div><ul className="list-disc pl-4 text-ink-2">{xs.map((x) => <li key={x}>{x}</li>)}</ul></div>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Link href={`/ax/clients/${cs.companyId}`} className="link-more">기업 상세 →</Link>
                        <AiReadyBadge label="AI 요약" onClick={() => openAi({ title: "상담 요약 — AI 적용 설명", key: "consult" })} />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ConsultationsInner() {
  const st = useStore();
  const params = useSearchParams();
  const [tab, setTab] = useState<"consult" | "quote" | "contract">(params.get("tab") === "quote" ? "quote" : params.get("tab") === "contract" ? "contract" : "consult");
  const consultations = [...st.consultations].sort((a, b) => b.date.localeCompare(a.date));
  const contracts = [...st.contracts].sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
  const [newConsult, setNewConsult] = useState(false);
  const [editCs, setEditCs] = useState<string | null>(null);
  const may = useMay();
  const [newQuote, setNewQuote] = useState(false);
  const [openQuote, setOpenQuote] = useState<Quote | null>(null);
  const [editQuote, setEditQuote] = useState<string | null>(null);
  const [newContract, setNewContract] = useState(false);
  const [editContract, setEditContract] = useState<string | null>(null);
  const quotes = [...st.quotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div>
      <PageHeader
        title={may("finance.view") ? "상담 · 견적 · 계약" : may("quote.create") ? "상담 · 견적" : "상담 기록"}
        badge={<AxInsightButton topic="consultations" />}
        desc="상담에서 정한 내용이 견적이 되고, 고객이 수락하면 계약으로 이어집니다. 할인은 발송 전에 대표 승인을 거칩니다."
        actions={tab === "quote"
          ? <Button variant="accent" icon={<Plus size={16} />} onClick={() => setNewQuote(true)}>견적 작성</Button>
          : tab === "contract"
            ? (may("contract.manage") ? <Button variant="accent" icon={<Plus size={16} />} onClick={() => setNewContract(true)}>계약 등록</Button> : undefined)
            : <Button variant="accent" icon={<Plus size={16} />} onClick={() => setNewConsult(true)}>상담 기록 작성</Button>}
      />
      <Tabs tabs={[
        { key: "consult" as const, label: "상담 기록", count: consultations.length },
        // 견적은 컨설턴트까지, 계약(금액)은 대표만 — 사무직원은 상담 기록만
        ...(may("quote.create") ? [{ key: "quote" as const, label: "견적", count: quotes.filter((q) => q.status !== "converted").length }] : []),
        ...(may("finance.view") ? [{ key: "contract" as const, label: "계약", count: contracts.length }] : []),
      ]} value={tab} onChange={setTab} />
      <div className="mt-5">
        {tab === "consult" || (tab === "quote" && !may("quote.create")) || (tab === "contract" && !may("finance.view")) ? (
          <ConsultList consultations={consultations} onNew={() => setNewConsult(true)} onEdit={may("consultation.update") ? setEditCs : undefined} />
        ) : tab === "quote" ? (
          <div className="space-y-3">
            {quotes.length === 0 && <Card><EmptyState icon={<Receipt size={30} />} title="작성된 견적이 없습니다" desc="상담에서 정한 범위를 그대로 견적으로 옮기면 계약까지 한 흐름으로 이어집니다." action={<Button variant="accent" icon={<Plus size={16} />} onClick={() => setNewQuote(true)}>견적 작성</Button>} /></Card>}
            {quotes.map((q) => {
              const c = st.companies.find((x) => x.id === q.companyId);
              const s2 = QUOTE_STATUS[q.status];
              return (
                <Card key={q.id} hover onClick={() => setOpenQuote(q)} className="p-4 md:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={s2.tone}>{s2.label}</Badge>
                    <span className="font-bold">{c?.name}</span>
                    {q.discountPct > 0 && <Badge tone="warning">할인 {q.discountPct}%</Badge>}
                    <span className="ml-auto tnum text-[1.05rem] font-bold text-accent">{fmtWon(quoteNet(q))}</span>
                  </div>
                  <div className="mt-1 font-semibold">{q.title}</div>
                  <div className="mt-0.5 text-[0.85rem] text-ink-2">{q.scope}</div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 text-[0.78rem] text-ink-3">
                    <span>{q.period}</span>
                    <span>항목 {q.items.length}건</span>
                    <span>작성 {fmtDate(q.createdAt)}</span>
                    {q.sentAt && <span>발송 {fmtDate(q.sentAt)}</span>}
                    {q.respondedAt && <span>회신 {fmtDate(q.respondedAt)}</span>}
                    <span>유효 {fmtDate(q.validUntil)}</span>
                  </div>
                  {q.status === "declined" && q.clientNote && <div className="mt-2 rounded-lg bg-error-bg px-3 py-2 text-[0.82rem] text-error">고객 보류 사유 · {q.clientNote}</div>}
                </Card>
              );
            })}
            <div className="flex items-start gap-2 text-[0.8rem] text-ink-3"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> 할인이 포함된 견적은 대표 승인 전에는 발송 버튼이 열리지 않습니다.</div>
          </div>
        ) : (
          <>
          <div className="space-y-2 lg:hidden">
            {contracts.map((ct) => (
              <div key={ct.id} className="card p-4" onClick={() => may("contract.manage") && setEditContract(ct.id)} role={may("contract.manage") ? "button" : undefined}>
                <div className="flex items-center gap-2">
                  <Link href={`/ax/clients/${ct.companyId}`} onClick={(e) => e.stopPropagation()} className="-my-2 truncate py-2 font-bold hover:text-accent">{st.companies.find((c) => c.id === ct.companyId)?.name}</Link>
                  <Badge tone={ct.status === "signed" ? "success" : ct.status === "sent" ? "warning" : "neutral"}>{ct.status === "signed" ? "서명 완료" : ct.status === "sent" ? "서명 대기" : "초안"}</Badge>
                </div>
                <div className="mt-1 text-[0.88rem] font-semibold">{ct.title}</div>
                <div className="mt-0.5 truncate text-[0.82rem] text-ink-2">{ct.scope}</div>
                <div className="mt-2 flex flex-wrap gap-x-3 text-[0.78rem] text-ink-3">
                  <span>{ct.period}</span>
                  <span>송부 {ct.sentAt ? fmtDate(ct.sentAt) : "-"}</span>
                  <span>서명 {ct.signedAt ? fmtDate(ct.signedAt) : "-"}</span>
                </div>

              </div>
            ))}
          </div>
          <Card className="hidden lg:block">
            <table className="tbl">
              <thead><tr><th>기업</th><th>계약명</th><th>프로젝트</th><th>상태</th><th>기간</th><th>종료일</th><th>금액</th><th>서명</th></tr></thead>
              <tbody>
                {contracts.map((ct) => (
                  <tr key={ct.id} className={may("contract.manage") ? "row-clickable" : undefined} onClick={() => may("contract.manage") && setEditContract(ct.id)}>
                    <td className="font-semibold"><Link href={`/ax/clients/${ct.companyId}`} onClick={(e) => e.stopPropagation()} className="hover:text-accent">{st.companies.find((c) => c.id === ct.companyId)?.name}</Link></td>
                    <td>{ct.title}</td>
                    <td><Link href={`/ax/projects/${ct.projectId}`} onClick={(e) => e.stopPropagation()} className="text-ink-2 hover:text-accent">{st.projects.find((p) => p.id === ct.projectId)?.name}</Link></td>
                    <td><Badge tone={ct.status === "signed" ? "success" : ct.status === "sent" ? "warning" : "neutral"}>{ct.status === "signed" ? "서명 완료" : ct.status === "sent" ? "서명 대기" : "초안"}</Badge></td>
                    <td>{ct.period}</td>
                    <td className="tnum">{ct.endDate ? fmtDate(ct.endDate) : <span className="text-ink-3">미입력</span>}</td>
                    <td className="tnum font-semibold">{ct.amount ? fmtWon(ct.amount) : <span className="font-normal text-ink-3">-</span>}</td>
                    <td className="tnum">{ct.signedAt ? fmtDate(ct.signedAt) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-[0.8rem] text-ink-3"><FileSignature size={14} /> 전자서명 연동은 향후 확장(NEXT) 항목입니다. 현재는 상태를 수동으로 관리합니다.</div>
          </Card>
          </>
        )}
      </div>
      <NewConsultationModal open={newConsult} onClose={() => setNewConsult(false)} />
      <NewConsultationModal open={!!editCs} consultationId={editCs} onClose={() => setEditCs(null)} />
      <NewQuoteModal open={newQuote} onClose={() => setNewQuote(false)} />
      <NewQuoteModal open={!!editQuote} quoteId={editQuote} onClose={() => setEditQuote(null)} />
      <QuoteDetailModal quote={openQuote} onClose={() => setOpenQuote(null)} onEdit={may("quote.update") ? setEditQuote : undefined} />
      <ContractModal open={newContract} onClose={() => setNewContract(false)} />
      <ContractModal open={!!editContract} contractId={editContract} onClose={() => setEditContract(null)} />
    </div>
  );
}

export default function ConsultationsPage() {
  return <Suspense><ConsultationsInner /></Suspense>;
}

export { Sparkles };
