"use client";

import { use } from "react";
import { useStore, quoteGross, quoteNet } from "@/lib/store";
import { fmtDate, fmtWon } from "@/lib/format";
import { QUOTE_STATUS } from "@/components/domain/QuoteModals";

/**
 * 견적서 — 고객 발송용 A4 한 장.
 * 회사 정보는 설정에 입력된 것만 찍는다. 없으면 빈칸이다 — 값을 지어내지 않는다.
 */
export default function PrintQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const st = useStore();
  const q = st.quotes.find((x) => x.id === id);
  if (!q) return <div className="print-hide rounded-xl border border-line bg-surface p-8 text-center text-ink-2">견적을 찾을 수 없습니다.</div>;
  const c = st.companies.find((x) => x.id === q.companyId);
  const p = st.projects.find((x) => x.id === q.projectId);
  const author = st.users.find((u) => u.id === q.createdBy);
  const org = st.settings.org ?? { name: "KPJK CORPORATION" };
  const gross = quoteGross(q);
  const net = quoteNet(q);
  const vat = Math.round(net * 0.1);
  const isDraft = q.status === "draft" || q.status === "approval_pending";

  return (
    <article className="print-sheet relative bg-surface p-[16mm] text-ink shadow-sm print:shadow-none">
      {isDraft && <div className="print-hide mb-4 rounded-lg bg-warning-bg px-3 py-2 text-[0.8rem] font-semibold text-warning">아직 발송 전 견적입니다 ({QUOTE_STATUS[q.status].label}). 인쇄물에 &ldquo;초안&rdquo; 표시가 함께 찍힙니다.</div>}
      {isDraft && <div className="pointer-events-none absolute right-[16mm] top-[16mm] rotate-12 rounded border-2 border-error/50 px-3 py-1 text-[0.9rem] font-black tracking-widest text-error/50">초안</div>}

      <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4">
        <div>
          <div className="text-[0.7rem] font-bold tracking-[0.2em] text-ink-3">QUOTATION</div>
          <h1 className="mt-1 text-[1.9rem] font-black leading-none">견 적 서</h1>
        </div>
        <div className="text-right text-[0.8rem] leading-relaxed">
          <div className="text-[1rem] font-bold">{org.name}</div>
          {org.ceo && <div>대표 {org.ceo}</div>}
          {org.bizNo && <div>사업자등록번호 {org.bizNo}</div>}
          {org.address && <div>{org.address}</div>}
          {(org.phone || org.email) && <div>{[org.phone, org.email].filter(Boolean).join(" · ")}</div>}
        </div>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[0.88rem]">
        <Row k="수신" v={<><b>{c?.name ?? "-"}</b> {c?.contactName ? `${c.contactName} ${c.contactTitle ?? ""}` : ""} 귀중</>} />
        <Row k="견적번호" v={<span className="tnum">{q.id.replace("qt_", "Q-").toUpperCase()}</span>} />
        <Row k="견적일" v={fmtDate(q.sentAt ?? q.createdAt, { year: true })} />
        <Row k="유효기간" v={<>{fmtDate(q.validUntil, { year: true })} 까지</>} />
        <Row k="건명" v={q.title} />
        <Row k="수행기간" v={q.period} />
        {p && <Row k="관련 프로젝트" v={p.name} />}
        <Row k="담당" v={author ? `${author.name} ${author.title}` : "-"} />
      </section>

      {q.scope && (
        <section className="mt-5 rounded-lg bg-surface-2 px-4 py-3 text-[0.85rem] leading-relaxed">
          <div className="mb-1 text-[0.72rem] font-bold tracking-wide text-ink-3">범위</div>
          {q.scope}
        </section>
      )}

      <table className="mt-5 w-full border-collapse text-[0.88rem]">
        <thead>
          <tr className="border-y-2 border-ink text-left">
            <th className="w-10 py-2 pl-1 font-semibold">No</th>
            <th className="py-2 font-semibold">항목</th>
            <th className="py-2 pr-1 text-right font-semibold">금액 (원)</th>
          </tr>
        </thead>
        <tbody>
          {q.items.map((it, i) => (
            <tr key={i} className="border-b border-line">
              <td className="py-2.5 pl-1 tnum text-ink-3">{i + 1}</td>
              <td className="py-2.5">{it.name}{it.note && <span className="ml-2 text-[0.78rem] text-ink-3">{it.note}</span>}</td>
              <td className="py-2.5 pr-1 text-right tnum">{it.amount.toLocaleString("ko-KR")}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line">
            <td colSpan={2} className="py-2 pl-1 text-right text-ink-2">소계</td>
            <td className="py-2 pr-1 text-right tnum">{gross.toLocaleString("ko-KR")}</td>
          </tr>
          {q.discountPct > 0 && (
            <tr>
              <td colSpan={2} className="py-1 pl-1 text-right text-ink-2">할인 {q.discountPct}%</td>
              <td className="py-1 pr-1 text-right tnum text-error">−{(gross - net).toLocaleString("ko-KR")}</td>
            </tr>
          )}
          <tr>
            <td colSpan={2} className="py-1 pl-1 text-right text-ink-2">공급가액</td>
            <td className="py-1 pr-1 text-right tnum">{net.toLocaleString("ko-KR")}</td>
          </tr>
          <tr>
            <td colSpan={2} className="py-1 pl-1 text-right text-ink-2">부가세 (10%)</td>
            <td className="py-1 pr-1 text-right tnum">{vat.toLocaleString("ko-KR")}</td>
          </tr>
          <tr className="border-t-2 border-ink">
            <td colSpan={2} className="py-3 pl-1 text-right text-[1rem] font-bold">합계 (VAT 포함)</td>
            <td className="py-3 pr-1 text-right tnum text-[1.15rem] font-black">{(net + vat).toLocaleString("ko-KR")}</td>
          </tr>
        </tfoot>
      </table>
      <div className="mt-1 text-right text-[0.8rem] text-ink-2">일금 {fmtWon(net + vat)} 정 (부가세 포함)</div>

      <section className="mt-8 text-[0.8rem] leading-relaxed text-ink-2">
        <div className="font-bold text-ink">비고</div>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>본 견적은 유효기간 내 수락 시 적용되며, 이후에는 조건이 변경될 수 있습니다.</li>
          <li>수행 범위 외 추가 요청은 별도 협의합니다.</li>
          <li>계약 체결 시 본 견적의 내용이 계약서에 그대로 반영됩니다.</li>
        </ul>
      </section>

      <footer className="mt-12 flex items-end justify-between">
        <div className="text-[0.78rem] text-ink-3">{fmtDate(q.sentAt ?? q.createdAt, { year: true })}</div>
        <div className="text-right">
          <div className="text-[0.95rem] font-bold">{org.name}</div>
          {org.ceo && <div className="mt-0.5 text-[0.85rem]">대표 {org.ceo} <span className="ml-6 inline-block w-14 border-b border-ink-3 align-baseline text-ink-3">(인)</span></div>}
        </div>
      </footer>
    </article>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-line py-1.5">
      <span className="w-20 shrink-0 text-[0.78rem] font-semibold text-ink-3">{k}</span>
      <span className="min-w-0 flex-1">{v}</span>
    </div>
  );
}
