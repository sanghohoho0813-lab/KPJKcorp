"use client";

import { useMemo, useState } from "react";
import { BarChart3, MessageSquareText } from "lucide-react";
import { useStore } from "@/lib/store";
import { SURVEY, type Question } from "@/lib/survey";
import { fmtDate } from "@/lib/format";
import { Badge, Card, EmptyState, SegmentedControl, cx } from "@/components/ui/ui";

/**
 * 설문 응답 집계 — 저장만 되고 아무도 못 읽던 데이터를 읽는 화면.
 * 통계 그래프가 아니라 "다음에 무엇을 만들지"를 고르는 표다. 그래서 문항마다 상위 응답을 막대로만 보여준다.
 */
export function SurveyResults() {
  const st = useStore();
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "consultant" | "client">("all");
  const responses = useMemo(() => st.surveys.filter((r) => roleFilter === "all" || r.role === roleFilter), [st.surveys, roleFilter]);
  const n = responses.length;

  const countFor = (q: Question) => {
    const counts = new Map<string, number>();
    let scaleSum = 0; let scaleN = 0;
    for (const r of responses) {
      const v = r.answers[q.id];
      if (v === undefined || v === "") continue;
      if (q.type === "scale") { const num = Number(v); if (!Number.isNaN(num)) { scaleSum += num; scaleN += 1; } continue; }
      const arr = Array.isArray(v) ? v : [String(v)];
      for (const a of arr) counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return { rows, scaleAvg: scaleN ? +(scaleSum / scaleN).toFixed(1) : undefined, scaleN };
  };

  if (st.surveys.length === 0) {
    return <Card><EmptyState icon={<BarChart3 size={30} />} title="아직 제출된 응답이 없습니다" desc="직원과 고객이 설문을 제출하면 문항별 분포가 여기에 표시됩니다." /></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="accent">응답 {n}건</Badge>
        <SegmentedControl size="sm" value={roleFilter} onChange={setRoleFilter} options={[{ key: "all", label: "전체" }, { key: "admin", label: "대표" }, { key: "consultant", label: "직원" }, { key: "client", label: "고객" }]} />
        <span className="text-[0.8rem] text-ink-3">
          마지막 제출 {fmtDate([...st.surveys].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0].submittedAt)}
        </span>
      </div>

      {n === 0 ? (
        <Card><EmptyState title="이 역할의 응답이 없습니다" /></Card>
      ) : (
        SURVEY.map((sec) => (
          <Card key={sec.key} className="p-5">
            <h3 className="text-[1.05rem] font-bold">{sec.title}</h3>
            <div className="mt-3 space-y-5">
              {sec.questions.map((q) => {
                const { rows, scaleAvg, scaleN } = countFor(q);
                const max = rows[0]?.[1] ?? 0;
                return (
                  <div key={q.id}>
                    <div className="text-[0.9rem] font-semibold">{q.label}</div>
                    {q.type === "scale" ? (
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="tnum text-[1.6rem] font-bold text-accent">{scaleAvg ?? "-"}</span>
                        <span className="text-[0.8rem] text-ink-3">/ 5 평균 · {scaleN}명{q.scaleLabels ? ` · 1=${q.scaleLabels[0]} 5=${q.scaleLabels[1]}` : ""}</span>
                      </div>
                    ) : rows.length === 0 ? (
                      <div className="mt-1 text-[0.82rem] text-ink-3">응답 없음</div>
                    ) : (
                      <div className="mt-2 space-y-1.5">
                        {rows.map(([opt, c], i) => (
                          <div key={opt} className="flex items-center gap-3">
                            <span className={cx("min-w-0 flex-1 truncate text-[0.85rem]", i === 0 ? "font-bold" : "text-ink-2")}>{opt}</span>
                            <div className="h-2 w-[38%] shrink-0 overflow-hidden rounded-full bg-surface-2">
                              <span className={cx("block h-full rounded-full", i === 0 ? "bg-accent" : "bg-line-2")} style={{ width: `${Math.round((c / max) * 100)}%` }} />
                            </div>
                            <span className="tnum w-14 shrink-0 text-right text-[0.82rem] text-ink-2">{c}명 <span className="text-ink-3">{Math.round((c / n) * 100)}%</span></span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))
      )}

      {responses.some((r) => r.freeText) && (
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-[1.05rem] font-bold"><MessageSquareText size={18} className="text-accent" /> 자유 의견</h3>
          <div className="mt-3 divide-y divide-line">
            {responses.filter((r) => r.freeText).map((r) => (
              <div key={r.id} className="py-3">
                <p className="text-[0.9rem] leading-relaxed">{r.freeText}</p>
                <div className="mt-1 text-[0.75rem] text-ink-3">{r.userName} · {r.role === "admin" ? "대표" : r.role === "consultant" ? "직원" : "고객"} · {fmtDate(r.submittedAt)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
