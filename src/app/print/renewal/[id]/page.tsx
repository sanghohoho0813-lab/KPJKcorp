"use client";

import { use, useState } from "react";
import { useStore } from "@/lib/store";
import { fmtDate } from "@/lib/format";
import { buildRenewal, dotDay } from "@/lib/renewal";
import { renewalPrintKey, useRenewalSource } from "@/components/domain/client/Renewal";

/**
 * 함께한 기록 — 갱신 상담에 가져가는 A4.
 * 갱신 준비 창에서 고른 줄 · 한마디를 그대로 찍는다(창을 거치지 않고 열면 전부). 금액 · 내부 메모는 없다.
 * 회사 정보는 설정에 입력된 것만 — 없으면 회사명만.
 */
export default function PrintRenewalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const st = useStore();
  const ct = st.contracts.find((x) => x.id === id);
  const c = st.companies.find((x) => x.id === ct?.companyId);
  const src = useRenewalSource(c, ct?.id);
  // 갱신 준비 창에서 고른 내용(이 브라우저). 인쇄 틀(PrintShell)은 브라우저에서 로그인을 확인한 뒤에만 이 화면을 그린다
  const [pick] = useState(() => readPick(id));
  const record = src ? buildRenewal(src, undefined, { since: pick.since }) : undefined;

  if (!ct || !c) return <div className="print-hide rounded-xl border border-line bg-surface p-8 text-center text-ink-2">계약을 찾을 수 없습니다.</div>;
  if (!record) return <div className="print-hide rounded-xl border border-line bg-surface p-8 text-center text-ink-2">이 계약은 아직 시작 전이라 정리할 기록이 없습니다.</div>;
  const org = st.settings.org ?? { name: "KPJK CORPORATION" };
  const signer = st.users.find((u) => u.id === c.consultantId);
  const sections = record.sections.map((s) => ({ ...s, lines: s.lines.filter((l) => !pick.off.has(l.key)) })).filter((s) => s.lines.length > 0);
  const until = record.end && record.to === record.end ? dotDay(record.end) : `${dotDay(record.to)} (오늘)`;

  return (
    <article className="print-sheet relative bg-surface p-[16mm] text-ink shadow-sm print:shadow-none" data-testid="renewal-print">
      <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4">
        <div>
          <div className="text-[0.7rem] font-bold tracking-[0.2em] text-ink-3">OUR RECORD TOGETHER</div>
          <h1 className="mt-1 text-[1.7rem] font-black leading-tight">함께한 기록</h1>
          <div className="mt-1 text-[0.9rem] text-ink-2">{c.name}{c.ceo ? ` · ${c.ceo} 대표님` : ""}</div>
        </div>
        <div className="text-right text-[0.8rem] leading-relaxed">
          <div className="text-[1rem] font-bold">{org.name}</div>
          {org.address && <div>{org.address}</div>}
          {(org.phone || org.email) && <div>{[org.phone, org.email].filter(Boolean).join(" · ")}</div>}
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-[0.86rem]">
        <Row k="계약" v={ct.title} />
        <Row k="함께한 기간" v={<span className="tnum">{dotDay(record.from)} ~ {until} · {record.days}일</span>} />
        {record.end && <Row k="계약 종료일" v={<span className="tnum">{dotDay(record.end)}</span>} />}
        <Row k="담당" v={signer ? `${signer.name} ${signer.title}` : "-"} />
      </section>

      {record.counts.length > 0 && (
        <section className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(3, record.counts.length)}, minmax(0, 1fr))` }}>
          {record.counts.map((x) => (
            <div key={x.key} className="rounded-lg border border-line px-3 py-2">
              <div className="text-[1.3rem] font-black leading-none tnum">{x.n}</div>
              <div className="mt-1 text-[0.72rem] text-ink-3">{x.label}</div>
            </div>
          ))}
        </section>
      )}

      {sections.map((s) => (
        <section key={s.key} className={s.key === "next" ? "mt-5 rounded-lg bg-surface-2 px-4 py-3" : "mt-4"} style={{ breakInside: "avoid" }}>
          <h2 className="text-[0.95rem] font-bold">{s.title}</h2>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[0.86rem] leading-relaxed">
            {s.lines.map((l) => (
              <li key={l.key}>{l.text}{l.basis && <span className="block text-[0.72rem] text-ink-3">근거: {l.basis}</span>}</li>
            ))}
          </ul>
        </section>
      ))}

      {pick.note.trim() && (
        <section className="mt-4" style={{ breakInside: "avoid" }}>
          <h2 className="text-[0.95rem] font-bold">담당자 한마디</h2>
          <p className="mt-1 whitespace-pre-line text-[0.86rem] leading-relaxed">{pick.note.trim()}</p>
        </section>
      )}

      <p className="mt-6 text-[0.72rem] leading-relaxed text-ink-3">
        이 기록은 KPJK 업무 시스템에 남은 진행 · 자료 · 상담 기록을 그대로 센 것입니다. 추정치나 효과 수치는 넣지 않았고,
        &lsquo;다음 1년에 함께 검토할 것&rsquo;은 검토해 볼 항목일 뿐 결과(선정 · 인증 · 금액)를 뜻하지 않습니다.
      </p>
      <footer className="mt-8 flex items-end justify-between">
        <div className="text-[0.78rem] text-ink-3">{fmtDate(new Date().toISOString(), { year: true })}</div>
        <div className="text-right text-[0.95rem] font-bold">{org.name}</div>
      </footer>
    </article>
  );
}

function readPick(id: string): { off: Set<string>; note: string; since?: string } {
  try {
    const raw = typeof window === "undefined" ? null : localStorage.getItem(renewalPrintKey(id));
    if (raw) {
      const v = JSON.parse(raw) as { off?: string[]; note?: string; since?: string };
      return { off: new Set(v.off ?? []), note: v.note ?? "", since: /^\d{4}-\d\d-\d\d$/.test(v.since ?? "") ? v.since : undefined };
    }
  } catch { /* 전부 찍는다 */ }
  return { off: new Set(), note: "" };
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-line py-1.5">
      <span className="w-20 shrink-0 text-[0.78rem] font-semibold text-ink-3">{k}</span>
      <span className="min-w-0 flex-1">{v}</span>
    </div>
  );
}
