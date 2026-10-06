"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Building2, ChevronRight, Eye, Minus, TrendingUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { growthBoard } from "@/lib/growth";
import { companyQuests, fmtMoneyKo, fmtPct, questLevel, revenueTrend } from "@/lib/company-snapshot";
import { profileOfCompany, programsForCompany } from "@/lib/programs";
import { openOnly } from "@/lib/programs-client";
import { AxInsightButton } from "@/components/ai/AxInsight";
import { Badge, Button, Card, EmptyState, PageHeader, cx } from "@/components/ui/ui";

/**
 * 기업 성장관리 — 고객사마다 "지금 몇 단계이고, 다음에 무엇을 하면 되는가".
 * 고객 화면 "우리 회사 한눈에"의 성장 체크리스트와 같은 계산(companyQuests · growthBoard)을 그대로 쓴다.
 * 담당자는 여기서 어느 고객이 멈춰 있는지, 어떤 과제를 고객이 직접 요청했는지 한 번에 본다.
 */
export default function GrowthPage() {
  const st = useStore();
  const router = useRouter();
  const setPreview = useStore((s) => s.setPortalPreview);
  const rows = useMemo(() => {
    const now = new Date();
    const programs = openOnly(st.programs);
    return st.companies.filter((c) => !c.archived).map((c) => {
      const board = growthBoard({ company: c, projects: st.projects, opportunities: st.opportunities, docRequests: st.docRequests, quotes: st.quotes, results: st.results, schedules: st.schedules, now });
      const pr = programsForCompany(programs, c.id, profileOfCompany(c));
      const quests = companyQuests({ company: c, docRequests: st.docRequests, schedules: st.schedules, opportunities: st.opportunities, activeCount: board.active.length, completedCount: board.completed.length, mainProgress: board.active[0]?.progress, programCount: pr.sent.length + pr.matches.length, now });
      return { c, board, quests, level: questLevel(quests), trend: revenueTrend(c) };
    }).sort((a, b) => a.level.pct - b.level.pct);
  }, [st.companies, st.projects, st.opportunities, st.docRequests, st.quotes, st.results, st.schedules, st.programs]);

  const asked = rows.reduce((n, r) => n + r.board.review.length, 0);
  const suggested = rows.reduce((n, r) => n + r.board.suggested.length + r.board.proposed.length, 0);
  const avg = rows.length ? Math.round(rows.reduce((n, r) => n + r.level.pct, 0) / rows.length) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="기업 성장관리"
        desc="고객사별 성장 단계 · 성장 체크리스트 · 다음 할 일. 고객 화면 '우리 회사 한눈에'와 같은 기준으로 계산합니다."
        actions={<AxInsightButton topic="growth" />}
      />

      {rows.length === 0 ? (
        <Card><EmptyState icon={<Building2 size={28} />} title="아직 관리 중인 기업고객이 없습니다" desc="기업고객을 등록하고 기본 정보 · 연도별 매출을 넣으면, 이 화면에 성장 단계와 다음 할 일이 자동으로 계산됩니다." action={<Link href="/ax/clients"><Button variant="accent">기업고객 등록하러 가기</Button></Link>} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4" data-testid="growth-summary">
            {[
              { l: "관리 중인 기업", v: `${rows.length}곳` },
              { l: "체크리스트 평균 진행", v: `${avg}%` },
              { l: "고객이 요청한 검토 과제", v: `${asked}건`, hot: asked > 0 },
              { l: "다음 검토 과제 제안", v: `${suggested}건` },
            ].map((t) => (
              <Card key={t.l} className="px-4 py-3.5">
                <div className="text-[0.8rem] font-semibold text-ink-2">{t.l}</div>
                <div className={cx("tnum mt-1 text-[1.5rem] font-extrabold", t.hot && "text-accent")}>{t.v}</div>
              </Card>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2" data-testid="growth-list">
            {rows.map(({ c, board, quests, level, trend }) => {
              const dir = trend.direction;
              return (
                <Card key={c.id} className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/ax/clients/${c.id}`} className="truncate text-[1.08rem] font-bold hover:underline">{c.name}</Link>
                        {c.sample && <Badge tone="info">샘플</Badge>}
                      </div>
                      <div className="mt-0.5 truncate text-[0.82rem] text-ink-3">{[c.industry || c.bizCategory, c.region || c.address, c.employees ? `${c.employees}명` : undefined].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[0.72rem] font-semibold text-ink-3">성장 단계</div>
                      <div className="font-extrabold"><span className="text-accent">{level.level}</span>/5 · {level.name}</div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[0.78rem] text-ink-2"><span>성장 체크리스트</span><span className="tnum font-semibold">{level.done}/{level.total}</span></div>
                    <div className="flex gap-1" aria-label={`성장 체크리스트 ${level.done}/${level.total}`}>
                      {quests.map((q) => <span key={q.key} title={`${q.title}${q.done ? " — 완료" : q.locked ? " — 아직 열리지 않음" : ""}`} className={cx("h-2 flex-1 rounded-full", q.done ? "bg-success" : q.locked ? "bg-line" : "bg-line-2")} />)}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[0.82rem]">
                    <div className="rounded-lg bg-surface-2/60 px-3 py-2">
                      <div className="text-[0.72rem] text-ink-3">{trend.latest ? `${trend.latest.year}년 매출` : "연도별 매출"}</div>
                      <div className="flex items-center gap-1 font-bold">
                        {trend.latest ? fmtMoneyKo(trend.latest.revenue) : "재무제표 받으면 기록"}
                        {trend.yoyPct !== undefined && (
                          <span className={cx("inline-flex items-center text-[0.75rem]", dir === "up" ? "text-success" : dir === "down" ? "text-error" : "text-ink-3")}>
                            {dir === "up" ? <ArrowUpRight size={13} /> : dir === "down" ? <ArrowDownRight size={13} /> : <Minus size={13} />}{fmtPct(trend.yoyPct)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg bg-surface-2/60 px-3 py-2">
                      <div className="text-[0.72rem] text-ink-3">과제</div>
                      <div className="font-bold">진행 {board.active.length} · 완료 {board.completed.length} · 검토 {board.review.length + board.proposed.length}</div>
                    </div>
                  </div>

                  {level.next ? (
                    <div className="mt-3 rounded-xl border border-accent/30 bg-soft/40 px-3.5 py-2.5">
                      <div className="text-[0.72rem] font-bold text-accent">다음 할 일</div>
                      <div className="font-semibold">{level.next.title}{level.next.progress && <span className="ml-1.5 text-[0.8rem] font-normal text-ink-3">{level.next.progress}</span>}</div>
                      <div className="mt-0.5 text-[0.8rem] text-ink-2">{level.next.why}</div>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-success/30 bg-success-bg/40 px-3.5 py-2.5 text-[0.85rem] font-semibold text-success">체크리스트를 모두 마쳤습니다</div>
                  )}

                  {(board.review.length > 0 || board.suggested.length > 0) && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[0.78rem]">
                      {board.review.map((x) => <span key={`r${x.area}`} className="rounded-full border border-accent/40 bg-surface px-2 py-0.5 font-semibold text-accent">고객 요청 · {x.area}</span>)}
                      {board.suggested.slice(0, 2).map((x) => <span key={`s${x.area}`} title={x.reason} className="rounded-full border border-line px-2 py-0.5 text-ink-2">검토 제안 · {x.area}</span>)}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    <Link href={`/ax/clients/${c.id}?tab=portal`} className="pressable inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[0.82rem] font-semibold text-ink-2 hover:bg-surface-2"><TrendingUp size={14} /> 성장 요청 · 제안 관리 <ChevronRight size={13} /></Link>
                    <button type="button" onClick={() => { setPreview(c.id); router.push("/portal"); }} className="pressable inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[0.82rem] font-semibold text-ink-2 hover:bg-surface-2"><Eye size={14} /> 고객 화면으로 보기</button>
                  </div>
                </Card>
              );
            })}
          </div>
          <p className="text-[0.78rem] text-ink-3">성장 단계는 체크리스트 진행으로 계산하는 관리 지표입니다. 회사의 가치나 자격을 판정하지 않습니다.{rows.some((r) => r.c.sample) && " 샘플 기업의 매출은 예시 수치입니다."}</p>
        </>
      )}
    </div>
  );
}
