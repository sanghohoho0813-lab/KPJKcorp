"use client";

import { useStore } from "@/lib/store";
import { dailySearchMinutes, labelOf, summarize } from "@/lib/baseline-survey";
import { fmtDate, fmtDateTime } from "@/lib/format";

/**
 * 도입 전 기준선 조사 — 외부 제출용 A4.
 *
 * 벤처기업확인·정책자금·보증 심사에 그대로 낼 수 있어야 한다. 그래서
 * 이 값이 "대표자가 기억으로 적은 것"이라는 사실을 표에도, 하단 고지에도 적는다.
 * 개선율·절감시간은 넣지 않는다 — 도입 후 수치는 아직 측정 중이기 때문이다.
 */
export default function PrintBaselinePage() {
  const st = useStore();
  const org = st.settings.org ?? { name: "KPJK CORPORATION" };
  const res = (st.settings.baselineSurveys ?? []).find((x) => x.phase === "before" && !x.draft);

  if (!res) {
    return (
      <div className="print-hide rounded-xl border border-line bg-surface p-8 text-center text-ink-2">
        아직 도입 전 기준선 조사가 기록되지 않았습니다. AX 코치 또는 리포트 화면에서 먼저 조사를 마쳐 주세요.
      </div>
    );
  }

  const groups = summarize(res.answers, res.metrics);
  const pains = Array.isArray(res.answers.biggestPainPoints) ? res.answers.biggestPainPoints : [];
  const search = dailySearchMinutes(res.metrics);

  return (
    <article className="print-sheet bg-surface p-[14mm] text-ink shadow-sm print:shadow-none">
      <header className="border-b-2 border-ink pb-3">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[0.7rem] font-bold tracking-[0.2em] text-ink-3">AX BASELINE SURVEY</div>
            <h1 className="mt-1 text-[1.6rem] font-black leading-tight">KPJK Business AX 도입 전 기준선 조사</h1>
          </div>
          <div className="text-right text-[0.8rem] leading-relaxed">
            <div className="text-[1rem] font-bold">{org.name}</div>
            {org.ceo && <div>대표 {org.ceo}</div>}
            {org.bizNo && <div>사업자등록번호 {org.bizNo}</div>}
          </div>
        </div>
      </header>

      <section className="mt-3 grid grid-cols-3 gap-x-6 border-b border-line pb-3 text-[0.85rem]">
        <div><span className="text-ink-3">조사일</span> <b className="ml-1.5">{fmtDate(res.recordedAt, { year: true })}</b></div>
        <div><span className="text-ink-3">응답자</span> <b className="ml-1.5">{res.respondentName} 대표</b></div>
        <div><span className="text-ink-3">기준</span> <b className="ml-1.5">도입 전 실제 업무 경험</b></div>
      </section>

      <section className="mt-4">
        <h2 className="text-[1rem] font-bold">1. 도입 전 기준선</h2>
        <p className="mt-1 text-[0.8rem] leading-relaxed text-ink-3">
          아래 값은 시스템 도입 전 업무 상태를 대표자가 직접 기록한 것입니다. 각 항목은 구간 선택으로 응답했으며,
          응답하지 않은 항목은 임의로 채우지 않고 &ldquo;미입력&rdquo;으로 둡니다.
        </p>
        <table className="mt-2 w-full text-[0.85rem]">
          <thead>
            <tr className="border-y border-ink text-left">
              <th className="py-1 pr-3 font-semibold whitespace-nowrap">구분</th>
              <th className="py-1 font-semibold">항목</th>
              <th className="py-1 text-right font-semibold">도입 전 (대표 입력)</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) =>
              g.rows.map((r, i) => (
                <tr key={`${g.key}-${r.label}`} className="border-b border-line">
                  <td className="py-1 pr-3 align-top font-semibold whitespace-nowrap">{i === 0 ? g.title : ""}</td>
                  <td className="py-1 text-ink-2">
                    {r.label}
                    {r.computed && <span className="ml-1.5 text-[0.72rem] text-ink-3">(입력값 기준 계산)</span>}
                  </td>
                  <td className="py-1 text-right tnum">{r.value}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
        {search !== undefined && (
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
            &ldquo;하루 자료 검색 약 {search}분&rdquo;은 응답한 두 값(하루 검색 횟수 × 건당 소요시간)을 곱한 계산치이며, 시스템 측정값이 아닙니다.
          </p>
        )}
      </section>

      {pains.length > 0 && (
        <section className="mt-4">
          <h2 className="text-[1rem] font-bold">2. 가장 부담이 컸던 업무</h2>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[0.85rem]">
            {pains.map((k) => <li key={k}>{labelOf("biggestPainPoints", k) ?? k}</li>)}
          </ol>
        </section>
      )}

      {res.recentPainExample && (
        <section className="mt-4">
          <h2 className="text-[1rem] font-bold">{pains.length > 0 ? "3" : "2"}. 실제 불편 사례</h2>
          <blockquote className="mt-2 whitespace-pre-line border-l-2 border-ink-3 pl-3 text-[0.85rem] leading-relaxed text-ink-2">
            {res.recentPainExample}
          </blockquote>
        </section>
      )}

      <footer className="mt-6 border-t border-line pt-2.5 text-[0.75rem] leading-relaxed text-ink-3">
        <p>
          본 자료의 도입 전 수치는 시스템 도입 전 대표자의 실제 업무 경험을 기준으로 입력한 Baseline이며,
          도입 후 수치는 향후 시스템 Event Log 및 실제 사용데이터를 통해 별도 측정합니다.
        </p>
        <p className="mt-1.5">
          문항 버전 {res.surveyVersion} · 출력 {fmtDateTime(new Date().toISOString())}
        </p>
      </footer>
    </article>
  );
}
