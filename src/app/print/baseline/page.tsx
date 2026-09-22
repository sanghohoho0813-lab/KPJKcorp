"use client";

import { useStore } from "@/lib/store";
import { PHASE_LABEL, dailySearchMinutes, labelOf, summarize } from "@/lib/baseline-survey";
import type { BaselinePhase, BaselineSurveyResponse } from "@/lib/types";
import { fmtDate, fmtDateTime } from "@/lib/format";

/**
 * 도입 전 기준선 조사 — 외부 제출용 A4.
 *
 * 벤처기업확인·정책자금·보증 심사에 그대로 낼 수 있어야 한다. 그래서
 * 이 값이 "대표자가 기억으로 적은 것"이라는 사실을 표에도, 하단 고지에도 적는다.
 * 개선율·절감시간은 넣지 않는다 — 두 시점의 기억을 나눈 값은 근거가 되지 못한다.
 *
 * 7일차·14일차 재조사가 기록되어 있으면 같은 표에 칸으로 붙인다. 별도 절로 빼면 같은
 * 항목이 두 번 나와 한 장을 넘기고, 읽는 사람이 두 표를 눈으로 맞춰야 한다.
 */
export default function PrintBaselinePage() {
  const st = useStore();
  const org = st.settings.org ?? { name: "KPJK CORPORATION" };
  const all = st.settings.baselineSurveys ?? [];
  const res = all.find((x) => x.phase === "before" && !x.draft);
  const followups = (["day7", "day14"] as const)
    .map((phase) => ({ phase, r: all.find((x) => x.phase === phase && !x.draft) }))
    .filter((x): x is { phase: Exclude<BaselinePhase, "before">; r: BaselineSurveyResponse } => !!x.r);

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
        <h2 className="text-[1rem] font-bold">1. 도입 전 기준선{followups.length > 0 ? " 및 도입 후 재조사" : ""}</h2>
        <p className="mt-1 text-[0.8rem] leading-relaxed text-ink-3">
          아래 값은 시스템 도입 전 업무 상태를 대표자가 직접 기록한 것입니다. 각 항목은 구간 선택으로 응답했으며,
          응답하지 않은 항목은 임의로 채우지 않고 &ldquo;미입력&rdquo;으로 둡니다.
          {followups.length > 0 && " 오른쪽 칸은 같은 질문을 도입 후 같은 방식으로 다시 받은 응답이며, 두 값 모두 대표자 입력값입니다."}
        </p>
        {/* 폰에서 이 화면을 열면 A4 폭(210mm)이 화면보다 넓다. 인쇄물 레이아웃은 그대로 두고
            화면에서만 표를 옆으로 밀 수 있게 한다 — 글자를 줄이면 인쇄물이 같이 작아진다. */}
        <div className="thin-scroll -mx-1 overflow-x-auto px-1 print:mx-0 print:overflow-visible print:px-0">
        <table className="mt-2 w-full min-w-[420px] text-[0.85rem] print:min-w-0">
          <thead>
            <tr className="border-y border-ink text-left">
              <th className="py-1 pr-3 font-semibold whitespace-nowrap">구분</th>
              <th className="py-1 font-semibold">항목</th>
              <th className="py-1 text-right font-semibold whitespace-nowrap">도입 전</th>
              {followups.map((f) => (
                <th key={f.phase} className="py-1 pl-3 text-right font-semibold whitespace-nowrap">{PHASE_LABEL[f.phase]}</th>
              ))}
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
                  {followups.map((f) => (
                    <td key={f.phase} className="py-1 pl-3 text-right tnum">
                      {r.followup ? r.followup(f.r.answers, f.r.metrics) : <span className="text-ink-3">–</span>}
                    </td>
                  ))}
                </tr>
              )),
            )}
          </tbody>
        </table>
        </div>
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
          본 자료의 수치는 대표자가 구간 선택으로 직접 응답한 값입니다. 시스템이 측정한 값이 아니며,
          {followups.length > 0
            ? " 시점 간 차이에 대한 개선율·절감시간·비용효과는 산출하지 않습니다. 시스템이 직접 집계할 수 있는 항목(자료 소요기간·후속 누락·문의 응답시간 등)은 Event Log 로 별도 측정합니다."
            : " 도입 후 수치는 향후 시스템 Event Log 및 실제 사용데이터를 통해 별도 측정합니다."}
        </p>
        <p className="mt-1.5">
          문항 버전 {res.surveyVersion} · 도입 전 {fmtDate(res.recordedAt, { year: true })}
          {followups.map((f) => ` · ${PHASE_LABEL[f.phase]} ${fmtDate(f.r.recordedAt, { year: true })}`).join("")}
          {" · 출력 "}{fmtDateTime(new Date().toISOString())}
        </p>
      </footer>
    </article>
  );
}
