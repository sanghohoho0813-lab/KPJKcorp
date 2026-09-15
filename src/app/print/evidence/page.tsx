"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useSprint } from "@/components/domain/Coach";
import { useAfterValues } from "@/components/domain/BaselineCard";
import { coverageOf, WHY_EVIDENCE } from "@/lib/evidence";
import { fmtDate, fmtDateTime } from "@/lib/format";

/**
 * AX 실증 리포트 — 정책자금·투자 심사 제출용.
 *
 * 원칙 (이 화면에서 특히 지킨다):
 * - 전부 Event Log에서 센 실제 건수다. 개선율·효과는 계산하지 않는다.
 * - 도입 전(Before)은 대표가 입력한 값이고, 그 사실을 표에 그대로 적는다.
 * - 표본이 적으면 적다고 쓴다. 심사자가 근거를 물었을 때 답할 수 없는 문장은 넣지 않는다.
 */
const METRIC_LABEL: Record<string, { label: string; unit: string; lowerIsBetter: boolean }> = {
  docLeadDays: { label: "자료요청 → 제출 소요", unit: "일", lowerIsBetter: true },
  missedFollowupsPerWeek: { label: "주간 후속 누락", unit: "건", lowerIsBetter: true },
  inquiryResponseHours: { label: "고객 문의 대응", unit: "시간", lowerIsBetter: true },
  consultationsPerMonth: { label: "월 상담 기록", unit: "건", lowerIsBetter: false },
  clientsPerConsultant: { label: "1인당 관리 기업", unit: "개사", lowerIsBetter: false },
  ceoHandledPct: { label: "대표가 직접 챙긴 비중", unit: "%", lowerIsBetter: true },
};

export default function PrintEvidencePage() {
  const st = useStore();
  const s = useSprint();
  const after = useAfterValues();
  const org = st.settings.org ?? { name: "KPJK CORPORATION" };
  const base = st.settings.baseline;
  const since = s.startedAt;
  const events = useMemo(() => {
    const list = since ? st.activities.filter((a) => a.at >= since) : st.activities;
    return list.filter((a) => a.actorRole !== "system" || a.type === "task_created" || a.type === "project_stage_changed");
  }, [st.activities, since]);
  const byRole = useMemo(() => {
    const m = { admin: 0, consultant: 0, client: 0, system: 0 } as Record<string, number>;
    for (const a of events) m[a.actorRole] = (m[a.actorRole] ?? 0) + 1;
    return m;
  }, [events]);
  const live = st.companies.filter((c) => !c.archived);
  const portalCompanies = new Set(events.filter((a) => a.actorRole === "client").map((a) => a.companyId)).size;
  const recent = events.slice(0, 40);

  return (
    <div className="space-y-6">
      <article className="print-sheet bg-surface p-[16mm] text-ink shadow-sm print:shadow-none">
        <header className="border-b-2 border-ink pb-4">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-[0.7rem] font-bold tracking-[0.2em] text-ink-3">AX EVIDENCE REPORT</div>
              <h1 className="mt-1 text-[1.7rem] font-black leading-tight">컨설팅 운영 AX 실증 리포트</h1>
              <div className="mt-1 text-[0.85rem] text-ink-2">
                {since ? <>실증 기간 {fmtDate(since, { year: true })} ~ {fmtDate(new Date().toISOString(), { year: true })} ({s.elapsedDays}일차{s.finished ? " · 14일 기간 종료" : ""})</> : <>실증 시작 전 — 전체 기록 기준</>}
              </div>
            </div>
            <div className="text-right text-[0.8rem] leading-relaxed">
              <div className="text-[1rem] font-bold">{org.name}</div>
              {org.ceo && <div>대표 {org.ceo}</div>}
              {org.bizNo && <div>사업자등록번호 {org.bizNo}</div>}
              <div className="mt-1 text-ink-3">출력 {fmtDateTime(new Date().toISOString())}</div>
            </div>
          </div>
        </header>

        <section className="mt-5">
          <h2 className="text-[1rem] font-bold">1. 이 리포트가 보여주는 것</h2>
          <p className="mt-1.5 text-[0.85rem] leading-relaxed text-ink-2">{WHY_EVIDENCE.lead}</p>
          <p className="mt-1.5 text-[0.8rem] leading-relaxed text-ink-3">
            아래 수치는 전부 시스템의 활동 기록(Timestamp가 붙은 Event)에서 센 실제 건수이며, 개선율이나 효과 추정치는 포함하지 않았습니다.
            &ldquo;도입 전&rdquo; 값은 대표가 직접 입력한 기준선이고, 시스템이 계산한 값이 아닙니다.
          </p>
        </section>

        <section className="mt-5">
          <h2 className="text-[1rem] font-bold">2. 운영 규모</h2>
          <div className="mt-2 grid grid-cols-4 gap-2 text-center">
            <Stat n={live.length} label="관리 기업" />
            <Stat n={st.projects.filter((p) => !p.archived).length} label="프로젝트" />
            <Stat n={st.users.filter((u) => u.role !== "client" && u.active !== false).length} label="내부 인원" />
            <Stat n={events.length} label={since ? "기간 내 기록" : "누적 기록"} />
          </div>
          <div className="mt-2 text-[0.78rem] text-ink-3">
            기록 주체별: 대표 {byRole.admin ?? 0} · 컨설턴트 {byRole.consultant ?? 0} · <b className="text-ink-2">고객 직접 {byRole.client ?? 0}</b> · 시스템 자동 {byRole.system ?? 0} — Portal을 실제로 사용한 기업 {portalCompanies} / {live.length}개사
          </div>
        </section>

        <section className="mt-5">
          <h2 className="text-[1rem] font-bold">3. 6개 영역 기록 현황 (Evidence Coverage)</h2>
          <table className="mt-2 w-full text-[0.85rem]">
            <thead><tr className="border-y border-ink text-left"><th className="py-1.5 font-semibold">영역</th><th className="py-1.5 font-semibold">무엇을 세는가</th><th className="py-1.5 text-right font-semibold">실측 / 기준</th><th className="w-28 py-1.5 text-right font-semibold">충족</th></tr></thead>
            <tbody>
              {s.areas.map((a) => {
                const pct = coverageOf(a);
                return (
                  <tr key={a.key} className="border-b border-line">
                    <td className="py-1.5 font-semibold">{a.label}</td>
                    <td className="py-1.5 text-ink-2">{a.why}</td>
                    <td className="py-1.5 text-right tnum">{a.count} / {a.target}건</td>
                    <td className="py-1.5 text-right">
                      <span className="inline-block h-2 w-16 overflow-hidden rounded-full bg-surface-2 align-middle"><span className="block h-full bg-ink" style={{ width: `${pct}%` }} /></span>
                      <span className="ml-2 tnum">{pct}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-1 text-[0.78rem] text-ink-3">기준 건수는 14일 실증 기준의 최소 표본이며 성과 목표가 아닙니다. 종합 {s.score} / 100 (6개 영역 평균).</div>
        </section>
      </article>

      <article className="print-sheet bg-surface p-[16mm] text-ink shadow-sm print:shadow-none">
        <section>
          <h2 className="text-[1rem] font-bold">4. 도입 전후 비교</h2>
          {!base ? (
            <p className="mt-2 rounded-lg bg-surface-2 px-4 py-3 text-[0.85rem] text-ink-2">도입 전 기준선이 아직 입력되지 않았습니다. 기준선 없이 &ldquo;달라졌다&rdquo;를 말할 수 없으므로 이 절은 비워 둡니다.</p>
          ) : (
            <>
              <table className="mt-2 w-full text-[0.85rem]">
                <thead><tr className="border-y border-ink text-left"><th className="py-1.5 font-semibold">지표</th><th className="py-1.5 text-right font-semibold">도입 전 (대표 입력)</th><th className="py-1.5 text-right font-semibold">현재 (시스템 실측)</th><th className="py-1.5 text-right font-semibold">차이</th></tr></thead>
                <tbody>
                  {Object.entries(METRIC_LABEL).map(([k, m]) => {
                    const b = base[k as keyof typeof base] as number | undefined;
                    const a = after[k as keyof typeof after] as number | undefined;
                    const diff = b !== undefined && a !== undefined ? +(a - b).toFixed(1) : undefined;
                    return (
                      <tr key={k} className="border-b border-line">
                        <td className="py-1.5">{m.label}</td>
                        <td className="py-1.5 text-right tnum">{b !== undefined ? `${b}${m.unit}` : "미입력"}</td>
                        <td className="py-1.5 text-right tnum">{a !== undefined ? `${a}${m.unit}` : "수집 중"}</td>
                        <td className="py-1.5 text-right tnum">{diff === undefined ? "-" : `${diff > 0 ? "+" : ""}${diff}${m.unit}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-1 text-[0.78rem] text-ink-3">
                표본: 자료 {after.sample.docs}건 · 문의 {after.sample.inquiries}건{base.recordedAt ? ` · 기준선 ${fmtDate(base.recordedAt, { year: true })} 기록` : ""}{base.note ? ` · 기준: ${base.note}` : ""}. 표본이 적은 항목의 차이는 성과로 읽지 않습니다.
              </div>
            </>
          )}
        </section>

        <section className="mt-5">
          <h2 className="text-[1rem] font-bold">5. 기록 발췌 (최근 {recent.length}건)</h2>
          <table className="mt-2 w-full text-[0.78rem]">
            <thead><tr className="border-y border-ink text-left"><th className="w-32 py-1 font-semibold">일시</th><th className="w-14 py-1 font-semibold">주체</th><th className="py-1 font-semibold">내용</th></tr></thead>
            <tbody>
              {recent.map((a) => (
                <tr key={a.id} className="border-b border-line">
                  <td className="py-1 tnum text-ink-3">{a.at.slice(0, 16).replace("T", " ")}</td>
                  <td className="py-1 text-ink-2">{a.actorRole === "client" ? "고객" : a.actorRole === "admin" ? "대표" : a.actorRole === "system" ? "시스템" : "담당"}</td>
                  <td className="py-1">{a.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1 text-[0.78rem] text-ink-3">전체 기록은 리포트 화면의 Evidence CSV로 내보낼 수 있습니다. 기록은 추가만 되고 수정·삭제되지 않습니다(append-only).</div>
        </section>
      </article>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-lg border border-line px-2 py-2.5">
      <div className="tnum text-[1.4rem] font-black leading-none">{n}</div>
      <div className="mt-1 text-[0.72rem] text-ink-3">{label}</div>
    </div>
  );
}
