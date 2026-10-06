"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, Building2, Check, ClipboardCopy, FileCheck2, Lock, Minus, Sparkles, TrendingUp, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { EMPLOYEE_BANDS } from "@/lib/company-options";
import { DOC_SOURCE_LABEL } from "@/lib/docparse";
import { businessAge, certSuggestions, certView, clientFacts, dayNumber, docCheckedAt, companyQuests, finSeries, fmtMoneyKo, fmtPct, questLevel, revenueTrend, yoyOf, type Quest } from "@/lib/company-snapshot";
import { formatYmd, todayLocal } from "@/lib/company-profile";
import { profileOfCompany, programsForCompany } from "@/lib/programs";
import { openOnly } from "@/lib/programs-client";
import type { Company } from "@/lib/types";
import { cx } from "@/components/ui/ui";
import type { useGrowth } from "./GrowthBoard";

type Board = NonNullable<ReturnType<typeof useGrowth>>;

/**
 * 고객 화면 "우리 회사 한눈에" — 대표가 들어오자마자 회사 현황을 숫자로 본다.
 * 업력 · 최근 매출과 전년 대비 · 임직원 · 계약 N일차 → 연도별 매출 → 성장 체크리스트(다음에 할 일).
 * 숫자는 모두 기록에서 온다(재무는 담당자가 재무제표를 보고 입력). 없는 숫자는 "아직 없음"으로 두고 지어내지 않는다.
 */

function useQuests(c: Company, board: Board) {
  const st = useStore();
  const programCount = useMemo(() => {
    const r = programsForCompany(openOnly(st.programs), c.id, profileOfCompany(c));
    return r.sent.length + r.matches.length;
  }, [st.programs, c]);
  return useMemo(() => {
    const quests = companyQuests({
      company: c, docRequests: st.docRequests, schedules: st.schedules, opportunities: st.opportunities,
      activeCount: board.active.length, completedCount: board.completed.length, mainProgress: board.active[0]?.progress, programCount,
    });
    return { quests, level: questLevel(quests) };
  }, [c, st.docRequests, st.schedules, st.opportunities, board, programCount]);
}

/* ------------------------------ 숫자 4칸 + 매출 추이 ------------------------------ */

export function CompanySnapshot({ company: c, board, showFactsLink = true }: { company: Company; board: Board; showFactsLink?: boolean }) {
  const today = todayLocal();
  const age = businessAge(c, today);
  const trend = revenueTrend(c);
  const band = EMPLOYEE_BANDS.find((b) => b.key === c.employeeBand)?.label;
  const { level } = useQuests(c, board);
  const certs = certView(c, today);
  const spark = finSeries(c).filter((f) => typeof f.revenue === "number" && f.revenue > 0).slice(-3);
  const sMax = Math.max(1, ...spark.map((f) => f.revenue!));
  const dir = trend.direction;
  const contractDay = dayNumber(c.contractStartedAt, today);

  return (
    <section className="card overflow-hidden" data-testid="company-snapshot">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-4 md:px-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-soft text-accent-strong"><Building2 size={18} /></span>
        <h2 className="text-[1.15rem] font-extrabold">우리 회사 한눈에</h2>
        {c.sample && <span className="rounded-full bg-warning-bg px-2.5 py-0.5 text-[0.75rem] font-bold text-warning" data-testid="sample-figures">샘플 회사 · 예시 수치</span>}
        {contractDay !== undefined && contractDay > 0 && <span className="ml-auto rounded-full bg-surface-2 px-2.5 py-1 text-[0.78rem] font-bold text-ink-2" data-testid="contract-day" title={`계약 시작 ${formatYmd(c.contractStartedAt!).replaceAll("-", ".")}`}>KPJK 계약 <span className="tnum">{contractDay.toLocaleString("ko-KR")}</span>일차</span>}
        <span className={cx("flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[0.78rem] font-bold text-ink-2", !(contractDay !== undefined && contractDay > 0) && "ml-auto")} data-testid="growth-level">
          <TrendingUp size={14} className="text-accent-strong" /> 성장 {level.level}/5단계 · {level.name}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4" data-testid="snapshot-tiles">
        {/* 1. 최근 매출 — 가장 크게. 전년 대비와 3개년 막대를 같이 */}
        <div className="col-span-2 border-b border-line p-5 lg:col-span-1 lg:border-b-0 lg:border-r md:p-6" data-testid="tile-revenue">
          <div className="flex items-center gap-1.5 text-[0.8rem] font-bold text-ink-3"><TrendIcon dir={dir} /> {trend.latest ? `${trend.latest.year}년 매출` : "최근 매출"}</div>
          <div className="mt-1.5 flex items-end gap-3">
            <div className="tnum text-[2rem] font-black leading-none tracking-tight md:text-[2.3rem]">{trend.latest ? fmtMoneyKo(trend.latest.revenue).replace(" 원", "") : "—"}{trend.latest && <> <small className="text-[0.9rem] font-bold text-ink-2">원</small></>}</div>
            {spark.length > 1 && (
              <div className="mb-1 ml-auto flex h-9 items-end gap-1" aria-hidden>
                {spark.map((f, i) => <span key={f.year} className={cx("w-2.5 rounded-sm", i === spark.length - 1 ? "bg-accent" : "bg-ink-3/30")} style={{ height: `${Math.max(18, Math.round((f.revenue! / sMax) * 100))}%` }} />)}
              </div>
            )}
          </div>
          <div className="mt-2">
            {trend.yoyPct !== undefined
              ? <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.82rem] font-extrabold", dir === "up" ? "bg-success-bg text-success" : dir === "down" ? "bg-error-bg text-error" : "bg-surface-2 text-ink-2")}>{dir === "up" ? "▲" : dir === "down" ? "▼" : "–"} 전년 대비 {fmtPct(trend.yoyPct)}</span>
              : <span className="text-[0.8rem] text-ink-3">{trend.latest ? "전년 매출이 기록되면 증감이 보입니다" : "재무제표를 보내 주시면 기록됩니다"}</span>}
          </div>
        </div>
        <BigTile k="age" label="업력" icon={<Building2 size={15} />} value={age ? <>{age.nthYear}<small>년차</small></> : "—"} sub={c.establishedAt ? `설립 ${formatYmd(c.establishedAt).replaceAll("-", ".")}` : "설립일 입력 전"} />
        <BigTile k="people" label="임직원" icon={<Users size={15} />} value={c.employees ? <>{c.employees.toLocaleString("ko-KR")}<small>명</small></> : band ?? "—"} sub={c.region || c.address || ""} />
        <BigTile k="certs" label="보유 인증" icon={<BadgeCheck size={15} />} value={<>{certs.length}<small>개</small></>}
          sub={certs.length ? certs.slice(0, 2).map((x) => x.name).join(" · ") + (certs.some((x) => x.state === "expiring" || x.state === "expired") ? " · 갱신 확인" : "") : "인증서를 보내 주시면 기록됩니다"}
          hot={certs.some((x) => x.state === "expiring" || x.state === "expired")} className="col-span-2 border-t lg:col-span-1 lg:border-t-0" />
      </div>

      <div className="grid gap-4 border-t border-line p-5 md:p-6 lg:grid-cols-[1.35fr_1fr]">
        <RevenueBars company={c} bare />
        <CertPanel company={c} />
      </div>

      {showFactsLink && (
        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3 md:px-6">
          <Link href="/portal/company" className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-xl px-1 text-[0.88rem] font-semibold text-ink-2 hover:text-ink" data-testid="facts-link">
            회사 기본 정보 · 계약 정보 전체 보기 <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </section>
  );
}

function BigTile({ k, label, icon, value, sub, hot, className }: { k: string; label: string; icon: React.ReactNode; value: React.ReactNode; sub?: string; hot?: boolean; className?: string }) {
  return (
    <div className={cx("min-w-0 border-line p-5 md:p-6 [&:not(:last-child)]:border-r", hot && "bg-warning-bg/40", className)} data-testid={`tile-${k}`}>
      <div className="flex items-center gap-1.5 text-[0.8rem] font-bold text-ink-3"><span className="text-accent-strong">{icon}</span>{label}</div>
      <div className="tnum mt-1.5 truncate text-[1.75rem] font-black leading-none tracking-tight md:text-[2rem] [&_small]:ml-0.5 [&_small]:text-[0.85rem] [&_small]:font-bold [&_small]:text-ink-2">{value}</div>
      {sub && <div className={cx("mt-2 line-clamp-2 text-[0.78rem] leading-snug", hot ? "font-semibold text-warning" : "text-ink-3")}>{sub}</div>}
    </div>
  );
}

/* ------------------------------ 인증 현황 — 보유 · 갱신 · 검토해 볼 인증 ------------------------------ */

export function CertPanel({ company: c }: { company: Company }) {
  const certs = certView(c);
  const sugg = certSuggestions(c);
  const label = (x: ReturnType<typeof certView>[number]) =>
    x.state === "expired" ? { t: "유효기간 지남", cls: "bg-error-bg text-error" }
      : x.state === "expiring" ? { t: `갱신 D-${x.daysLeft}`, cls: "bg-warning-bg text-warning" }
        : x.state === "valid" ? { t: `~ ${x.expiresAt!.slice(0, 7).replace("-", ".")}`, cls: "bg-success-bg text-success" }
          : { t: "보유", cls: "bg-success-bg text-success" };
  return (
    <div className="min-w-0 rounded-2xl bg-surface-2/60 p-4" data-testid="cert-panel">
      <div className="mb-2.5 flex items-center gap-1.5"><BadgeCheck size={16} className="text-accent-strong" /><h3 className="text-[0.95rem] font-bold">인증 현황</h3></div>
      {certs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-2 bg-surface px-3 py-2.5 text-[0.82rem] text-ink-2">아직 기록된 인증이 없습니다. 가진 인증서를 보내 주시면 담당자가 기록하고 갱신 시기를 챙깁니다.</div>
      ) : (
        <ul className="space-y-1.5">
          {certs.map((x) => { const l = label(x); return (
            <li key={x.name} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2" data-cert={x.name}>
              <Check size={14} className="shrink-0 text-success" strokeWidth={3} />
              <span className="min-w-0 flex-1 truncate text-[0.88rem] font-bold">{x.name}</span>
              {x.acquiredAt && <span className="hidden shrink-0 text-[0.72rem] text-ink-3 sm:inline">{x.acquiredAt.slice(0, 7).replace("-", ".")} 취득</span>}
              <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[0.72rem] font-bold", l.cls)}>{l.t}</span>
            </li>
          ); })}
        </ul>
      )}
      {sugg.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[0.75rem] font-bold text-ink-3">앞으로 검토해 볼 인증 <span className="font-normal">· 자격 판정이 아닙니다</span></div>
          <ul className="space-y-1.5">
            {sugg.map((x) => (
              <li key={x.name}>
                <Link href={`/portal/inquiries?new=${encodeURIComponent(`${x.name} 검토 문의`)}`} className="group flex items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2 hover:border-accent" data-cert-suggest={x.name}>
                  <Sparkles size={14} className="mt-0.5 shrink-0 text-accent-strong" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-1.5"><b className="text-[0.86rem]">{x.name}</b><span className="text-[0.7rem] text-ink-3">근거 · {x.basis}</span></span>
                    <span className="block text-[0.76rem] leading-snug text-ink-2">{x.why}</span>
                  </span>
                  <span className="shrink-0 self-center text-[0.75rem] font-semibold text-accent-strong group-hover:underline">물어보기</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TrendIcon({ dir }: { dir: "up" | "down" | "flat" | "unknown" }) {
  if (dir === "up") return <ArrowUpRight size={16} />;
  if (dir === "down") return <ArrowDownRight size={16} />;
  return <Minus size={16} />;
}

/** 연도별 매출 막대 — 최근 5개년, 막대 위에 금액, 막대 사이에 전년 대비 */
export function RevenueBars({ company: c, bare }: { company: Company; bare?: boolean }) {
  const series = finSeries(c).filter((f) => typeof f.revenue === "number" && f.revenue > 0).slice(-5);
  if (!series.length) {
    return (
      <div className={cx("rounded-2xl border border-dashed border-line-2 px-4 py-4 text-[0.88rem] text-ink-2", !bare && "mt-4")} data-testid="revenue-empty">
        <b className="text-ink">연도별 매출이 아직 없습니다.</b> 최근 3개년 재무제표를 보내 주시면 담당 컨설턴트가 기록하고, 전년 대비 증가·감소가 여기에 숫자로 보입니다.
        <Link href="/portal/documents" className="ml-1 font-semibold text-accent hover:underline">자료 제출 →</Link>
      </div>
    );
  }
  const max = Math.max(...series.map((f) => f.revenue!));
  const latest = series[series.length - 1];
  return (
    <div className={cx("rounded-2xl bg-surface-2/60 px-3 pb-3 pt-4 md:px-5", !bare && "mt-4")} data-testid="revenue-bars">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[0.92rem] font-bold">연도별 매출</h3>
        <span className="text-[0.75rem] text-ink-3">{latest.source || "재무제표"} 기준 · 담당 컨설턴트 기록{latest.updatedAt ? ` (${latest.updatedAt.slice(0, 10)})` : ""}</span>
      </div>
      <div className="flex items-end gap-2 md:gap-4" role="list" aria-label="연도별 매출">
        {series.map((f, i) => {
          const pct = yoyOf(series, i);
          const h = Math.max(8, Math.round((f.revenue! / max) * 120));
          const last = i === series.length - 1;
          return (
            <div key={f.year} role="listitem" className="flex min-w-0 flex-1 flex-col items-center" aria-label={`${f.year}년 ${fmtMoneyKo(f.revenue)}${pct !== undefined ? `, 전년 대비 ${fmtPct(pct)}` : ""}`}>
              <div className="tnum mb-1 truncate text-center text-[0.72rem] font-bold text-ink-2 md:text-[0.8rem]">{fmtMoneyKo(f.revenue).replace(" 원", "")}</div>
              <div className={cx("w-full max-w-[64px] rounded-t-lg", last ? "bg-accent" : "bg-ink-3/40")} style={{ height: h }} />
              <div className="mt-1.5 text-[0.75rem] font-semibold text-ink-2">{f.year}</div>
              <div className={cx("tnum h-4 text-[0.7rem] font-bold", pct === undefined ? "text-transparent" : pct > 0 ? "text-success" : pct < 0 ? "text-error" : "text-ink-3")}>{pct === undefined ? "·" : fmtPct(pct)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ 성장 체크리스트 ------------------------------ */

export function GrowthQuests({ company: c, board, limit }: { company: Company; board: Board; limit?: number }) {
  const { quests, level } = useQuests(c, board);
  const [all, setAll] = useState(false);
  // 할 일(열린 것) 먼저, 잠긴 것, 완료는 뒤로
  const ordered = [...quests.filter((q) => !q.done && !q.locked), ...quests.filter((q) => !q.done && q.locked), ...quests.filter((q) => q.done)];
  const shown = limit && !all ? ordered.slice(0, limit) : ordered;
  return (
    <section className="card p-5 md:p-6" data-testid="growth-quests">
      <div className="flex items-center gap-4">
        <Ring pct={level.pct} label={`${level.done}/${level.total}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-soft text-accent-strong"><Sparkles size={15} /></span>
            <h2 className="text-[1.1rem] font-extrabold">성장 체크리스트</h2>
            <span className="tnum ml-auto text-[0.85rem] font-bold text-ink-2" data-testid="quest-count">{level.done}/{level.total} 완료</span>
          </div>
          {/* 성장 단계 1~5 — 지금 위치를 칸으로 */}
          <div className="mt-2 flex items-center gap-1" role="progressbar" aria-label="성장 체크리스트 진행" aria-valuemin={0} aria-valuemax={100} aria-valuenow={level.pct}>
            {[1, 2, 3, 4, 5].map((n) => <span key={n} className={cx("h-2 flex-1 rounded-full", n < level.level ? "bg-accent" : n === level.level ? "bg-accent/60" : "bg-surface-2")} />)}
          </div>
          <div className="mt-1 text-[0.8rem] font-bold text-accent-strong">성장 {level.level}/5단계 · {level.name}</div>
        </div>
      </div>
      <p className="mt-2.5 text-[0.76rem] text-ink-3">기록(회사 정보·요청 자료·과제·일정·재무)을 보고 정해진 규칙으로 다음 할 일을 자동으로 정리합니다. 자금 가능 여부 같은 판단은 하지 않습니다.</p>

      {level.next && (
        <Link href={level.next.href} className="mt-3 flex items-center gap-3 rounded-2xl bg-soft/70 px-4 py-3 ring-1 ring-accent/25 hover:bg-soft" data-testid="next-quest">
          <span className="text-[0.72rem] font-extrabold tracking-wide text-accent-strong">다음 할 일</span>
          <span className="min-w-0 flex-1 truncate text-[0.95rem] font-bold">{level.next.title}</span>
          <ArrowRight size={16} className="shrink-0 text-accent-strong" />
        </Link>
      )}

      <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
        {shown.map((q) => <QuestRow key={q.key} q={q} />)}
      </ul>
      {limit && ordered.length > limit && (
        <button type="button" onClick={() => setAll((v) => !v)} className="pressable mt-2 min-h-9 text-[0.85rem] font-semibold text-accent">
          {all ? "접기" : `${ordered.length - limit}개 더 보기`}
        </button>
      )}
    </section>
  );
}

/** 진행률 고리 — 가운데 "완료/전체" */
function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 26, len = 2 * Math.PI * r;
  return (
    <div className="relative h-[68px] w-[68px] shrink-0" aria-hidden>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-surface-2" />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-accent transition-[stroke-dashoffset] duration-700" strokeDasharray={len} strokeDashoffset={len * (1 - Math.max(0.03, pct / 100))} />
      </svg>
      <span className="tnum absolute inset-0 flex flex-col items-center justify-center leading-none"><b className="text-[1rem]">{pct}%</b><span className="mt-0.5 text-[0.62rem] font-bold text-ink-3">{label}</span></span>
    </div>
  );
}

function QuestRow({ q }: { q: Quest }) {
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-3.5 py-3 sm:flex-nowrap" data-testid={`quest-${q.key}`} data-done={q.done ? "1" : "0"}>
      <span className={cx("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", q.done ? "bg-success text-white" : q.locked ? "bg-surface-2 text-ink-3" : "border-2 border-accent/50 text-accent")}>
        {q.done ? <Check size={14} strokeWidth={3} /> : q.locked ? <Lock size={12} /> : null}
      </span>
      <div className="min-w-0 flex-1 basis-[calc(100%-2.25rem)] sm:basis-auto">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={cx("text-[0.93rem] font-bold", q.done && "text-ink-2")}>{q.title}</span>
          {q.progress && <span className={cx("tnum text-[0.8rem] font-bold", q.done ? "text-success" : "text-accent-strong")}>{q.progress}</span>}
        </div>
        <p className="mt-0.5 text-[0.8rem] leading-snug text-ink-3">{q.why}</p>
      </div>
      {!q.done && !q.locked && (
        // 휴대폰: 글 아래로 내려 제목이 한 글자씩 꺾이지 않게 / PC: 오른쪽
        <Link href={q.href} className="pressable ml-9 inline-flex min-h-9 shrink-0 items-center rounded-lg bg-soft/60 px-3 text-[0.82rem] font-semibold text-accent-strong hover:bg-soft sm:ml-0 sm:self-center sm:bg-transparent sm:px-2.5">{q.cta} →</Link>
      )}
    </li>
  );
}

/* ------------------------------ 회사 기본 정보 (읽기 · 복사) ------------------------------ */

export function CompanyFacts({ company: c }: { company: Company }) {
  const users = useStore((s) => s.users);
  const consultant = users.find((u) => u.id === c.consultantId);
  const rows = clientFacts(c).filter((r) => r.value);
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500); } catch { /* 권한 없음 */ }
  };
  const docs = (["bizReg", "corpReg"] as const).filter((k) => docCheckedAt(c, k));
  return (
    <section className="card p-5 md:p-6" data-testid="company-facts">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[1.05rem] font-bold">회사 기본 정보</h2>
        <span className="text-[0.78rem] text-ink-3">값을 누르면 복사됩니다 — 신청서에 그대로 붙여 넣으세요</span>
      </div>
      <dl className="grid gap-x-6 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.key} className={cx("flex min-w-0 items-start gap-3 border-b border-line py-2.5", r.wide && "sm:col-span-2")}>
            <dt className="w-28 shrink-0 pt-0.5 text-[0.8rem] font-semibold text-ink-3">{r.label}</dt>
            <dd className="min-w-0 flex-1">
              <button type="button" onClick={() => copy(r.value, r.key)} className="pressable group inline-flex max-w-full items-start gap-1.5 text-left text-[0.92rem] font-semibold text-ink" aria-label={`${r.label} 복사`}>
                <span className="break-all">{r.value}</span>
                {copied === r.key ? <Check size={14} className="mt-1 shrink-0 text-success" /> : <ClipboardCopy size={13} className="mt-1 shrink-0 text-ink-3 opacity-60 group-hover:opacity-100" />}
              </button>
              {r.from && <div className="text-[0.72rem] text-ink-3">{r.from}</div>}
            </dd>
          </div>
        ))}
        <div className="flex min-w-0 items-start gap-3 border-b border-line py-2.5">
          <dt className="w-28 shrink-0 pt-0.5 text-[0.8rem] font-semibold text-ink-3">담당 컨설턴트</dt>
          <dd className="text-[0.92rem] font-semibold">{consultant ? `${consultant.name} ${consultant.title}` : "배정 전"}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.8rem]" data-testid="facts-docs">
        <FileCheck2 size={15} className="text-ink-3" />
        {docs.length
          ? docs.map((k) => <span key={k} className="rounded-full bg-success-bg px-2.5 py-0.5 font-semibold text-success">{DOC_SOURCE_LABEL[k]} 확인 · {docCheckedAt(c, k)!.slice(0, 10)}</span>)
          : <span className="text-ink-3">근거 서류(사업자등록증·법인등기부등본)는 담당자가 확인하면 여기에 표시됩니다.</span>}
      </div>
      <p className="mt-3 text-[0.75rem] text-ink-3">틀린 값이 있으면 <Link href="/portal/inquiries" className="font-semibold text-accent hover:underline">문의하기</Link>로 알려 주세요 — 담당자가 고칩니다.</p>
    </section>
  );
}
