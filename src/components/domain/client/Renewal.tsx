"use client";

import { useMemo, useState } from "react";
import { Copy, FileText, Printer, RefreshCw, Send } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { fmtWon } from "@/lib/format";
import { todayYmd } from "@/lib/vault";
import { md } from "@/lib/progress-report";
import { buildRenewal, dotDay, lastRenewalFor, relationStart, renewalBody, renewalContract, renewalQuoteDraft, renewalStage, renewalStart, renewalTitle, RENEWAL_STAGE_LABEL, type RenewalSource } from "@/lib/renewal";
import type { Company } from "@/lib/types";
import { Badge, Button, LinkButton, SegmentedControl, Select, Textarea, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";
import { NoticeBody } from "@/components/domain/Notices";
import { NewQuoteModal } from "@/components/domain/QuoteModals";

/** 인쇄 화면(새 탭)으로 넘기는 고른 내용 — 주소에 담기엔 길어 이 브라우저에 둔다(계약마다 마지막 것 하나) */
export const renewalPrintKey = (contractId: string) => `kpjk-renewal-print:${contractId}`;

/** 기업 상세 · 업무함에서 쓰는 소스 묶음 */
export function useRenewalSource(company: Company | undefined, contractId: string | undefined): RenewalSource | undefined {
  const st = useStore();
  return useMemo(() => {
    const contract = st.contracts.find((x) => x.id === contractId);
    if (!company || !contract) return undefined;
    return {
      company, contract, projects: st.projects, docRequests: st.docRequests, results: st.results, schedules: st.schedules, inquiries: st.inquiries,
      consultations: st.consultations, notices: st.notices, activities: st.activities, selfRuns: st.selfRuns, opportunities: st.opportunities, quotes: st.quotes, programs: st.programs,
    };
  }, [company, contractId, st.contracts, st.projects, st.docRequests, st.results, st.schedules, st.inquiries, st.consultations, st.notices, st.activities, st.selfRuns, st.opportunities, st.quotes, st.programs]);
}

/**
 * 갱신 준비 (내부) — 계약 기간에 함께한 일과 다음 1년에 검토할 것을 기록에서 채운다.
 * 담당자는 뺄 줄을 끄고 한마디를 더해 고객 화면(공지)에 보내거나, 카톡용으로 복사하거나, A4 로 인쇄해 갱신 상담에 가져간다.
 * 갱신 견적은 지금 계약을 그대로 옮긴 초안에서 시작한다(금액은 이 창의 고객용 글에 들어가지 않는다).
 */
export function RenewalModal({ company, contractId, open, onClose }: { company: Company; contractId?: string; open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <Inner company={company} initial={contractId} onClose={onClose} />;
}

function Inner({ company: c, initial, onClose }: { company: Company; initial?: string; onClose: () => void }) {
  const st = useStore();
  const role = st.session?.role;
  const me = st.session?.userId ?? "";
  const signed = st.contracts.filter((x) => x.companyId === c.id && x.status === "signed");
  const [ctId, setCtId] = useState(() => (initial && signed.some((x) => x.id === initial) ? initial : renewalContract(st.contracts, c.id)?.id));
  const contract = signed.find((x) => x.id === ctId);
  const src = useRenewalSource(c, ctId);
  // 이 계약 기간 / 첫 계약부터 — 앞선 계약이 있을 때만 고른다
  const first = contract ? relationStart(st.contracts, contract, c, st.projects) : undefined;
  const [whole, setWhole] = useState(false);
  const since = whole && first ? first : undefined;
  const record = src ? buildRenewal(src, undefined, { since }) : undefined;
  const [view, setView] = useState<"pick" | "preview">("pick");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [pinned, setPinned] = useState(true);
  const [quote, setQuote] = useState(false);
  const last = lastRenewalFor(st.notices, c.id);
  // 이미 만든 갱신 견적이 살아 있으면 또 만들지 않는다(보류된 견적만 있을 때는 새로 만들 수 있다)
  const renew = contract ? renewalStage(contract, st.quotes) : undefined;
  const liveQuote = renew && renew.stage !== "none" && renew.stage !== "declined";

  const signer = st.users.find((u) => u.id === c.consultantId) ?? st.users.find((u) => u.id === me);
  const signature = signer ? `담당 ${signer.name} ${signer.title}`.trim() : undefined;
  const title = record ? renewalTitle(record) : "";
  const body = record ? renewalBody({ company: c, record, skip: off, note, signature }) : "";
  const picked = record ? record.sections.reduce((n, s) => n + s.lines.filter((l) => !off.has(l.key)).length, 0) : 0;
  const canSend = !!record && (picked > 0 || !!note.trim()) && can(role, "notice.write");
  const toggle = (key: string, on: boolean) => setOff((s) => { const n = new Set(s); if (on) n.delete(key); else n.add(key); return n; });

  const copy = async () => {
    try { await navigator.clipboard.writeText(`${title}\n\n${body}`); st.toast("함께한 기록을 복사했습니다. 카카오톡·문자에 붙여 넣으세요."); }
    catch { st.toast("복사하지 못했습니다. 미리 보기 글을 길게 눌러 직접 복사해 주세요.", "error"); }
  };
  const send = () => {
    if (!canSend) return;
    const id = st.createNotice({ companyId: c.id, title, body, pinned }, me);
    if (!id) return;
    st.toast(`함께한 기록을 보냈습니다. 고객 화면 '일정 · 공지'${pinned ? "와 홈 맨 위" : ""}에 보이고 알림이 갑니다.`);
    onClose();
  };
  const print = () => {
    if (!ctId) return;
    try { localStorage.setItem(renewalPrintKey(ctId), JSON.stringify({ off: [...off], note, since })); } catch { /* 고른 것 없이 전부 인쇄 */ }
    window.open(`/print/renewal/${encodeURIComponent(ctId)}`, "_blank");
  };

  const left = record?.daysLeft;
  const dday = left === undefined ? "종료일 미입력" : left > 0 ? `종료 D-${left}` : left === 0 ? "오늘 종료" : `종료 ${-left}일 지남`;

  return (
    <>
    <Modal open onClose={onClose} size="lg"
      title={<span className="flex items-center gap-2"><RefreshCw size={18} className="text-accent" /> 갱신 준비</span>}
      footer={record ? <>
        <Button variant="ghost" className="max-sm:hidden" onClick={onClose}>닫기</Button>
        {/* 휴대폰에서는 인쇄를 뺀다 — 갱신 상담용 A4 는 PC 에서 뽑는다 */}
        <Button variant="outline" className="max-sm:hidden" icon={<Printer size={15} />} onClick={print} disabled={!record}>인쇄</Button>
        <Button variant="outline" className="max-sm:flex-1" icon={<Copy size={15} />} onClick={copy} disabled={!canSend}>카톡용 복사</Button>
        <Button variant="accent" className="max-sm:flex-1" icon={<Send size={15} />} onClick={send} disabled={!canSend}>고객에게 보내기</Button>
      </> : <Button variant="ghost" onClick={onClose}>닫기</Button>}>
      {!contract ? (
        <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-[0.88rem] text-ink-2" data-testid="renewal-empty">
          서명된 계약이 없습니다. 계약이 서명되면 그 기간의 기록으로 갱신 준비를 할 수 있습니다.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="renewal-head">
            {signed.length > 1 ? (
              <Select value={ctId} onChange={(e) => { setCtId(e.target.value); setOff(new Set()); setWhole(false); }} aria-label="계약 고르기" className="max-w-full sm:w-72">
                {signed.map((x) => <option key={x.id} value={x.id}>{x.title}{x.endDate ? ` (~${md(x.endDate.slice(0, 10))})` : ""}</option>)}
              </Select>
            ) : <span className="font-bold">{contract.title}</span>}
            <Badge tone={left !== undefined && left <= 30 ? "warning" : "neutral"}>{dday}</Badge>
            {can(role, "finance.view") && contract.amount ? <span className="text-[0.8rem] text-ink-3">계약 {fmtWon(contract.amount)} <span className="max-sm:hidden">· 고객용 글에는 넣지 않음</span></span> : null}
          </div>
          {first && record && (
            <div className="mt-2" data-testid="renewal-range">
              <SegmentedControl size="sm" value={whole ? "whole" : "this"} onChange={(k) => { setWhole(k === "whole"); setOff(new Set()); }}
                options={[{ key: "this", label: "이 계약 기간" }, { key: "whole", label: `첫 계약부터 (${dotDay(first)}~)` }]} />
            </div>
          )}
          {record ? (
            <>
              <p className="mt-1.5 text-[0.8rem] leading-relaxed text-ink-3">
                {dotDay(record.from)}부터 {record.end && record.to === record.end ? `종료일 ${dotDay(record.end)}까지` : "오늘까지"} {record.days}일 · 고객에게 이미 보이는 기록으로만 채웠습니다<span className="max-sm:hidden">. 내부 메모·업무·수금·금액은 넣지 않습니다</span>.
                {last && <> 지난번 보낸 기록 {md(last.publishedAt.slice(0, 10))}.</>}
              </p>
              {record.counts.length > 0 && (
                <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${record.counts.length}, minmax(0, 1fr))` }} data-testid="renewal-counts">
                  {record.counts.map((x) => (
                    <div key={x.key} className="rounded-xl border border-line px-2.5 py-2 sm:px-3">
                      <div className="text-[1.25rem] font-black leading-none tnum">{x.n}</div>
                      <div className="mt-1 text-[0.75rem] text-ink-3">{x.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <SegmentedControl value={view} onChange={setView} options={[{ key: "pick", label: `내용 고르기 ${picked}` }, { key: "preview", label: "고객 화면 미리 보기" }]} />
                {liveQuote
                  ? <span data-testid="renewal-quote-open"><LinkButton size="sm" variant="outline" className="gap-1.5" href="/ax/consultations?tab=quote" icon={<FileText size={15} />}>{RENEWAL_STAGE_LABEL[renew!.stage]}</LinkButton></span>
                  : can(role, "quote.create") && <Button size="sm" variant="outline" icon={<FileText size={15} />} onClick={() => setQuote(true)} data-testid="renewal-quote">{renew?.stage === "declined" ? "갱신 견적 다시 만들기" : "갱신 견적 만들기"}</Button>}
              </div>

              {view === "pick" ? (
                <div className="mt-3 space-y-3" data-testid="renewal-lines">
                  {record.sections.length === 0 && (
                    <p className="rounded-xl bg-surface-2 px-4 py-5 text-center text-[0.86rem] text-ink-2" data-testid="renewal-none">
                      이 기간에 고객에게 보여 줄 기록이 아직 없습니다. 아래 한마디만 적어 보낼 수 있습니다.
                    </p>
                  )}
                  {record.sections.map((s) => (
                    <section key={s.key} data-renewal-section={s.key}>
                      <h4 className="mb-1 text-[0.82rem] font-bold text-ink-2">{s.title}</h4>
                      <ul className="divide-y divide-line rounded-xl border border-line">
                        {s.lines.map((l) => {
                          const on = !off.has(l.key);
                          return (
                            <li key={l.key}>
                              <label className="flex cursor-pointer items-start gap-3 px-3.5 py-2.5" data-line={l.key}>
                                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={on} onChange={(e) => toggle(l.key, e.target.checked)} aria-label={l.text} />
                                <span className={cx("min-w-0 flex-1 text-[0.9rem] leading-snug", !on && "text-ink-3 line-through")}>
                                  {l.text}
                                  {l.basis && <span className="ml-1.5 whitespace-nowrap text-[0.72rem] font-semibold text-ink-3">근거: {l.basis}</span>}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                  <label className="block">
                    <span className="mb-1 block text-[0.82rem] font-bold text-ink-2">담당자 한마디 <span className="font-normal text-ink-3">(선택)</span></span>
                    <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 내년에는 원가 개선 실행을 끝까지 함께 챙기겠습니다. 다음 주에 찾아뵙고 말씀드리겠습니다." aria-label="담당자 한마디" />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[0.86rem]">
                    <input type="checkbox" className="h-4 w-4" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
                    고객 홈 맨 위에 고정
                  </label>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl bg-surface-2 p-3" data-testid="renewal-preview">
                  <div className="mx-auto max-w-sm rounded-xl border border-accent/30 bg-surface px-4 py-3 shadow-sm">
                    <div className="font-bold leading-snug">{title}</div>
                    <div className="mt-0.5 text-[0.75rem] text-ink-3">오늘 · {c.name}</div>
                    <NoticeBody text={body} className="mt-2" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 rounded-xl bg-surface-2 px-4 py-5 text-center text-[0.86rem] text-ink-2">이 계약의 시작일이 아직 오지 않았습니다. 시작한 뒤에 기록이 쌓입니다.</p>
          )}
        </>
      )}
    </Modal>
    {quote && contract && (
      <NewQuoteModal open companyId={c.id} onClose={() => setQuote(false)}
        prefill={renewalQuoteDraft(contract, st.quotes, renewalStart(contract, todayYmd()))} />
    )}
    </>
  );
}
