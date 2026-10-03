"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Building2, CalendarCheck2, Check, ClipboardCopy, FileCheck2, Lock, Minus, Sparkles, Trophy, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { EMPLOYEE_BANDS } from "@/lib/company-options";
import { DOC_SOURCE_LABEL } from "@/lib/docparse";
import { businessAge, clientFacts, docCheckedAt, companyQuests, dayNumber, finSeries, fmtMoneyKo, fmtPct, questLevel, revenueTrend, yoyOf, type Quest } from "@/lib/company-snapshot";
import { formatYmd, todayLocal } from "@/lib/company-profile";
import { profileOfCompany, programsForCompany } from "@/lib/programs";
import { openOnly } from "@/lib/programs-client";
import type { Company } from "@/lib/types";
import { cx } from "@/components/ui/ui";
import type { useGrowth } from "./GrowthBoard";

type Board = NonNullable<ReturnType<typeof useGrowth>>;

/**
 * 고객 화면 "우리 회사 한눈에" — 대표가 들어오자마자 회사 현황을 숫자로 본다.
 * 업력 · 최근 매출과 전년 대비 · 임직원 · 계약 N일차 → 연도별 매출 → 성장 퀘스트(다음에 할 일).
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
  const contractDay = dayNumber(c.contractStartedAt, today);
  const withUsDay = dayNumber(c.firstConsultDate?.slice(0, 10), today);
  const band = EMPLOYEE_BANDS.find((b) => b.key === c.employeeBand)?.label;
  const { level } = useQuests(c, board);

  const tiles = [
    {
      key: "age", label: "업력", icon: <Building2 size={16} />,
      value: age ? <>{age.nthYear}<small>년차</small></> : "—",
      sub: c.establishedAt ? `설립 ${formatYmd(c.establishedAt).replaceAll("-", ".")}` : "설립일 입력 전",
    },
    {
      key: "revenue", label: trend.latest ? `${trend.latest.year}년 매출` : "최근 매출", icon: <TrendIcon dir={trend.direction} />,
      value: trend.latest ? fmtMoneyKo(trend.latest.revenue) : "—",
      sub: trend.yoyPct !== undefined
        ? <span className={cx("font-bold", trend.direction === "up" ? "text-success" : trend.direction === "down" ? "text-error" : "text-ink-2")}>전년 대비 {fmtPct(trend.yoyPct)}</span>
        : trend.latest ? "전년 매출이 기록되면 성장률이 보입니다" : "재무제표를 보내 주시면 기록됩니다",
    },
    {
      key: "people", label: "임직원", icon: <Users size={16} />,
      value: c.employees ? <>{c.employees.toLocaleString("ko-KR")}<small>명</small></> : band ?? "—",
      sub: [c.contactName && `담당 ${c.contactName} ${c.contactTitle}`.trim()].filter(Boolean)[0] ?? "",
    },
    {
      key: "together", label: contractDay ? "KPJK 계약" : "KPJK와 함께", icon: <CalendarCheck2 size={16} />,
      value: contractDay ? <>{contractDay.toLocaleString("ko-KR")}<small>일차</small></> : withUsDay ? <>{withUsDay.toLocaleString("ko-KR")}<small>일</small></> : "—",
      sub: contractDay ? `계약 ${formatYmd(c.contractStartedAt!).replaceAll("-", ".")}${withUsDay ? ` · 함께한 지 ${withUsDay.toLocaleString("ko-KR")}일` : ""}` : withUsDay ? "첫 상담일부터" : "",
    },
  ];

  return (
    <section className="card p-5 md:p-6" data-testid="company-snapshot">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-soft text-accent-strong"><Building2 size={18} /></span>
        <h2 className="text-[1.1rem] font-bold">우리 회사 한눈에</h2>
        {c.sample && <span className="rounded-full bg-warning-bg px-2.5 py-0.5 text-[0.75rem] font-bold text-warning" data-testid="sample-figures">샘플 회사 · 예시 수치</span>}
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[0.78rem] font-bold text-ink-2" data-testid="growth-level">
          <Trophy size={14} className="text-accent-strong" /> Lv.{level.level} {level.name}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4" data-testid="snapshot-tiles">
        {tiles.map((t) => (
          <div key={t.key} className="min-w-0 rounded-2xl border border-line bg-surface p-3.5 md:p-4" data-testid={`tile-${t.key}`}>
            <div className="flex items-center gap-1.5 text-[0.78rem] font-bold text-ink-3"><span className="text-accent-strong">{t.icon}</span>{t.label}</div>
            <div className="tnum mt-1.5 truncate text-[1.35rem] font-extrabold leading-tight tracking-tight md:text-[1.6rem] [&_small]:ml-0.5 [&_small]:text-[0.8rem] [&_small]:font-bold [&_small]:text-ink-2">{t.value}</div>
            {t.sub && <div className="mt-1 line-clamp-2 text-[0.78rem] leading-snug text-ink-3">{t.sub}</div>}
          </div>
        ))}
      </div>

      <RevenueBars company={c} />

      {showFactsLink && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/portal/company" className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3.5 text-[0.88rem] font-semibold text-ink-2 hover:bg-surface-2" data-testid="facts-link">
            회사 기본 정보 전체 보기 <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </section>
  );
}

function TrendIcon({ dir }: { dir: "up" | "down" | "flat" | "unknown" }) {
  if (dir === "up") return <ArrowUpRight size={16} />;
  if (dir === "down") return <ArrowDownRight size={16} />;
  return <Minus size={16} />;
}

/** 연도별 매출 막대 — 최근 5개년, 막대 위에 금액, 막대 사이에 전년 대비 */
export function RevenueBars({ company: c }: { company: Company }) {
  const series = finSeries(c).filter((f) => typeof f.revenue === "number" && f.revenue > 0).slice(-5);
  if (!series.length) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-line-2 px-4 py-4 text-[0.88rem] text-ink-2" data-testid="revenue-empty">
        <b className="text-ink">연도별 매출이 아직 없습니다.</b> 최근 3개년 재무제표를 보내 주시면 담당 컨설턴트가 기록하고, 전년 대비 증가·감소가 여기에 숫자로 보입니다.
        <Link href="/portal/documents" className="ml-1 font-semibold text-accent hover:underline">자료 제출 →</Link>
      </div>
    );
  }
  const max = Math.max(...series.map((f) => f.revenue!));
  const latest = series[series.length - 1];
  return (
    <div className="mt-4 rounded-2xl bg-surface-2/60 px-3 pb-3 pt-4 md:px-5" data-testid="revenue-bars">
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

/* ------------------------------ 성장 퀘스트 ------------------------------ */

export function GrowthQuests({ company: c, board, limit }: { company: Company; board: Board; limit?: number }) {
  const { quests, level } = useQuests(c, board);
  const [all, setAll] = useState(false);
  // 할 일(열린 것) 먼저, 잠긴 것, 완료는 뒤로
  const ordered = [...quests.filter((q) => !q.done && !q.locked), ...quests.filter((q) => !q.done && q.locked), ...quests.filter((q) => q.done)];
  const shown = limit && !all ? ordered.slice(0, limit) : ordered;
  return (
    <section className="card p-5 md:p-6" data-testid="growth-quests">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-soft text-accent-strong"><Sparkles size={18} /></span>
        <h2 className="text-[1.1rem] font-bold">성장 퀘스트</h2>
        <span className="tnum ml-auto text-[0.88rem] font-bold text-ink-2" data-testid="quest-count">{level.done}/{level.total} 완료</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="성장 퀘스트 진행" aria-valuemin={0} aria-valuemax={100} aria-valuenow={level.pct}>
          <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.max(4, level.pct)}%` }} />
        </div>
        <span className="tnum text-[0.85rem] font-extrabold text-accent-strong">{level.pct}%</span>
      </div>
      <p className="mt-2 text-[0.78rem] text-ink-3">기록(회사 정보·요청 자료·과제·일정·재무)을 보고 정해진 규칙으로 다음 할 일을 자동으로 정리합니다. 자금 가능 여부 같은 판단은 하지 않습니다.</p>

      {level.next && (
        <Link href={level.next.href} className="mt-3 flex items-center gap-3 rounded-2xl bg-soft/70 px-4 py-3 ring-1 ring-accent/25 hover:bg-soft" data-testid="next-quest">
          <span className="text-[0.72rem] font-extrabold tracking-wide text-accent-strong">다음 퀘스트</span>
          <span className="min-w-0 flex-1 truncate text-[0.95rem] font-bold">{level.next.title}</span>
          <ArrowRight size={16} className="shrink-0 text-accent-strong" />
        </Link>
      )}

      <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
        {shown.map((q) => <QuestRow key={q.key} q={q} />)}
      </ul>
      {limit && ordered.length > limit && (
        <button type="button" onClick={() => setAll((v) => !v)} className="pressable mt-2 min-h-9 text-[0.85rem] font-semibold text-accent">
          {all ? "접기" : `퀘스트 ${ordered.length - limit}개 더 보기`}
        </button>
      )}
    </section>
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
