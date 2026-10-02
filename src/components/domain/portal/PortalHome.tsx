"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CalendarDays, Check, ChevronRight, FileCheck2, FolderUp, Megaphone, MessageSquare, Phone, Sparkles, TrendingUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { ENTITY_TYPES, EMPLOYEE_BANDS, yearsSince } from "@/lib/company-options";
import { fmtDate, fmtTime } from "@/lib/format";
import { profileOfCompany, programsForCompany } from "@/lib/programs";
import { openOnly } from "@/lib/programs-client";
import type { Company } from "@/lib/types";
import { Avatar, cx } from "@/components/ui/ui";
import type { useGrowth } from "./GrowthBoard";

type Board = NonNullable<ReturnType<typeof useGrowth>>;

/**
 * 고객 Portal 홈 — "업무 목록"이 아니라 "우리 회사 성장 공간"으로 읽히게.
 * 모든 숫자는 실제 기록에서 센다(지어낸 지표·성과값 없음). 없는 것은 보이지 않는다.
 */

/* ------------------------------ 상단: 우리 회사 성장 홈 ------------------------------ */

export function PortalHero({ company: c, board, displayName }: { company: Company; board: Board; displayName: string }) {
  const users = useStore((s) => s.users);
  const schedules = useStore((s) => s.schedules);
  const consultant = users.find((u) => u.id === c.consultantId);
  const now = new Date();
  const nowIso = now.toISOString();
  const next = schedules.filter((s) => s.companyId === c.id && s.visibleToClient && s.start >= nowIso).sort((a, b) => a.start.localeCompare(b.start))[0];
  // 함께한 날 — 첫 상담일 기준(실제 기록). 없으면 보이지 않는다
  const since = c.firstConsultDate ? Math.floor((now.getTime() - Date.parse(c.firstConsultDate)) / 864e5) + 1 : undefined;
  const age = yearsSince(c.establishedAt);
  const chips = [
    c.industry || c.bizCategory,
    ENTITY_TYPES.find((e) => e.key === c.entityType)?.label,
    age !== undefined ? `업력 ${age}년` : undefined,
    c.employees ? `임직원 ${c.employees}명` : EMPLOYEE_BANDS.find((b) => b.key === c.employeeBand)?.label && `임직원 ${EMPLOYEE_BANDS.find((b) => b.key === c.employeeBand)?.label}`,
    c.region,
  ].filter(Boolean) as string[];
  const main = board.active[0];
  const tiles = [
    { label: "지금 할 일", short: "할 일", value: board.actions.filter((a) => a.key !== "doc_more").length, hot: board.actions.length > 0 },
    { label: "진행 중 과제", short: "진행 중", value: board.active.length },
    { label: "검토 중 과제", short: "검토 중", value: board.review.length + board.proposed.length },
    { label: "완료한 과제", short: "완료", value: board.completed.length },
  ];

  return (
    <section id="tut-p-progress" data-testid="portal-hero"
      className="relative overflow-hidden rounded-[1.6rem] p-5 text-shell-text shadow-[0_18px_50px_-24px_rgba(0,0,0,0.55)] md:p-8"
      style={{ background: "radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, var(--theme-accent) 34%, transparent) 0%, transparent 46%), linear-gradient(135deg, var(--theme-shell) 0%, var(--theme-shell-2) 100%)" }}>
      <div className="relative grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[0.78rem] font-semibold text-shell-text-3">
            <span className="rounded-full border border-white/15 px-2.5 py-0.5 tracking-[0.12em]">KPJK 성장 파트너</span>
            {since !== undefined && since > 0 && <span data-testid="partnership-days">함께한 지 <b className="text-shell-text">{since.toLocaleString("ko-KR")}일</b></span>}
          </div>
          <p className="mt-3 text-[0.92rem] text-shell-text-2">안녕하세요, <b className="text-shell-text">{c.name} {displayName}</b>님.</p>
          <h1 className="mt-1 text-[1.6rem] font-extrabold leading-tight tracking-tight md:text-[2.3rem]">{c.name} 현재 상태</h1>
          {chips.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{chips.map((t) => <span key={t} className="rounded-full bg-white/10 px-2.5 py-1 text-[0.78rem] font-semibold text-shell-text-2 ring-1 ring-white/10">{t}</span>)}</div>}
          {main && (
            <Link href={`/portal/projects?p=${main.project!.id}`} className="mt-5 block rounded-2xl bg-white/[0.08] px-4 py-3.5 ring-1 ring-white/10 transition-colors hover:bg-white/[0.12]">
              <div className="flex items-center gap-2 text-[0.88rem]"><TrendingUp size={16} className="shrink-0 text-highlight" /><span className="min-w-0 flex-1"><b className="block truncate sm:inline">{main.area}</b><span className="block truncate text-[0.78rem] text-shell-text-3 sm:ml-1.5 sm:inline sm:text-[0.88rem]">지금 {main.stepLabel} 단계</span></span><span className="tnum shrink-0 text-[1.2rem] font-extrabold text-highlight">{main.progress}%</span></div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-highlight transition-[width] duration-700" style={{ width: `${main.progress ?? 0}%` }} /></div>
            </Link>
          )}
        </div>

        {/* 담당 컨설턴트 — 누구에게 물으면 되는지가 늘 보이게 */}
        <div className="rounded-2xl bg-white/[0.08] p-4 ring-1 ring-white/10" data-testid="hero-consultant">
          <div className="text-[0.72rem] font-bold tracking-[0.12em] text-shell-text-3">담당 컨설턴트</div>
          <div className="mt-2 flex items-center gap-3">
            <Avatar name={consultant?.name ?? "K"} size={44} />
            <div className="min-w-0 leading-tight"><div className="truncate text-[1.05rem] font-bold">{consultant ? `${consultant.name} ${consultant.title}` : "배정 전"}</div><div className="mt-0.5 text-[0.78rem] text-shell-text-3">KPJK Consulting</div></div>
          </div>
          {next && (
            <Link href="/portal/schedule" className="mt-3 flex items-center gap-2 rounded-xl bg-white/[0.07] px-3 py-2 text-[0.82rem] hover:bg-white/[0.12]">
              <CalendarDays size={15} className="shrink-0 text-highlight" />
              <span className="min-w-0 flex-1 truncate">다음 일정 <b>{fmtDate(next.start)} {fmtTime(next.start)}</b> · {next.title.replace(c.name, "").trim()}</span>
            </Link>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="/portal/inquiries" className="pressable inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-[0.85rem] font-bold text-shell"><MessageSquare size={15} /> 문의하기</Link>
            {consultant?.phone
              ? <a href={`tel:${consultant.phone.replace(/[^0-9+]/g, "")}`} className="pressable inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 text-[0.85rem] font-bold ring-1 ring-white/15 hover:bg-white/15"><Phone size={15} /> 전화</a>
              : <Link href="/portal/schedule" className="pressable inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 text-[0.85rem] font-bold ring-1 ring-white/15 hover:bg-white/15"><CalendarDays size={15} /> 일정</Link>}
          </div>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-4 gap-1.5 md:gap-2" data-testid="growth-tiles">
        {tiles.map((t) => (
          <div key={t.label} className={cx("rounded-2xl px-2.5 py-2.5 ring-1 md:px-4 md:py-3", t.hot ? "bg-highlight/15 ring-highlight/30" : "bg-white/[0.06] ring-white/10")}>
            <div className="truncate text-[0.72rem] font-bold text-shell-text-3 md:text-[0.75rem]"><span className="md:hidden">{t.short}</span><span className="hidden md:inline">{t.label}</span></div>
            <div className={cx("tnum mt-1 text-[1.35rem] font-extrabold leading-none md:text-[1.7rem]", t.hot ? "text-highlight" : "text-shell-text")}>{t.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ 성장 플랫폼 — 한눈에 들어가는 메뉴판 ------------------------------ */

/** 메뉴판과 각 화면 위 길잡이가 같은 색을 쓴다 — 어디에 있는지 색으로도 안다 */
export const HUB_TONE: Record<string, string> = {
  "/portal/projects": "bg-[#e8f0ff] text-[#2f5bd3]",
  "/portal/documents": "bg-[#fff1e6] text-[#c25a12]",
  "/portal/programs": "bg-[#eafaf1] text-[#1f8a4c]",
  "/portal/services": "bg-[#f3ecff] text-[#6b3fd1]",
  "/portal/results": "bg-[#e9f7f7] text-[#13807f]",
  "/portal/inquiries": "bg-[#fdecef] text-[#c0304a]",
  "/portal/schedule": "bg-[#eef1f5] text-[#4a5568]",
  "/portal/notifications": "bg-[#eef1f5] text-[#4a5568]",
  "/portal/me": "bg-[#eef1f5] text-[#4a5568]",
};

export function PortalHub({ company: c, board }: { company: Company; board: Board }) {
  const st = useStore();
  const programs = useMemo(() => programsForCompany(openOnly(st.programs), c.id, profileOfCompany(c)), [st.programs, c]);
  const docsOpen = st.docRequests.filter((d) => d.companyId === c.id && (d.status === "requested" || d.status === "revision")).length;
  const proposals = st.opportunities.filter((o) => o.companyId === c.id && o.source === "proposal" && o.status !== "dropped").length;
  const results = st.results.filter((r) => r.companyId === c.id).length;
  const openIq = st.inquiries.filter((i) => i.companyId === c.id && i.status === "open").length;
  const progTotal = programs.sent.length + programs.matches.length;
  const progUrgent = [...programs.sent, ...programs.matches].filter((m) => m.deadline.urgent).length;
  const items: { href: string; label: string; icon: React.ReactNode; tone: string; big: string; sub: string; hot?: boolean }[] = [
    { href: "/portal/projects", label: "성장과제", icon: <TrendingUp size={20} />, tone: HUB_TONE["/portal/projects"], big: `${board.active.length}`, sub: board.active.length ? "진행 중" : "진행 중인 과제 없음" },
    { href: "/portal/documents", label: "요청자료", icon: <FolderUp size={20} />, tone: HUB_TONE["/portal/documents"], big: `${docsOpen}`, sub: docsOpen ? "제출할 자료" : "모두 제출함", hot: docsOpen > 0 },
    { href: "/portal/programs", label: "지원사업", icon: <Megaphone size={20} />, tone: HUB_TONE["/portal/programs"], big: `${progTotal}`, sub: progUrgent ? `마감 임박 ${progUrgent}` : "맞는 공고", hot: programs.sent.length > 0 },
    { href: "/portal/services", label: "함께 검토", icon: <Sparkles size={20} />, tone: HUB_TONE["/portal/services"], big: `${proposals + board.suggested.length}`, sub: proposals ? `담당자 제안 ${proposals}` : "검토해 볼 과제" },
    { href: "/portal/results", label: "완료자료", icon: <FileCheck2 size={20} />, tone: HUB_TONE["/portal/results"], big: `${results}`, sub: "받은 결과물" },
    { href: "/portal/inquiries", label: "문의", icon: <MessageSquare size={20} />, tone: HUB_TONE["/portal/inquiries"], big: `${openIq}`, sub: openIq ? "답변 기다리는 중" : "궁금하면 바로" },
  ];
  return (
    <section data-testid="portal-hub">
      <div className="mb-2.5 flex items-end justify-between px-0.5">
        <h2 className="text-[1.1rem] font-bold">우리 회사 성장 플랫폼</h2>
        <span className="hidden text-[0.78rem] text-ink-3 sm:inline">KPJK와 함께하는 모든 일이 여기에 모입니다</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5 md:grid-cols-6">
        {items.map((it) => (
          <Link key={it.href} href={it.href} data-hub={it.label}
            className={cx("card card-hover group flex flex-col p-3 md:p-4", it.hot && "ring-1 ring-accent/40")}>
            <span className={cx("flex h-10 w-10 items-center justify-center rounded-2xl", it.tone)}>{it.icon}</span>
            <span className="mt-2.5 text-[0.85rem] font-bold">{it.label}</span>
            <span className="mt-0.5 flex items-baseline gap-1"><span className={cx("tnum text-[1.35rem] font-extrabold leading-none", it.hot && "text-accent")}>{it.big}</span></span>
            <span className={cx("mt-1 truncate text-[0.72rem]", it.hot ? "font-semibold text-accent" : "text-ink-3")}>{it.sub}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ 성장 여정 — 완료 → 진행 → 다음 ------------------------------ */

export function GrowthJourney({ board }: { board: Board }) {
  const lanes = [
    { key: "done", title: "완료한 과제", items: board.completed.map((x) => ({ label: x.area, href: "/portal/results", note: x.doneAt ? `${fmtDate(x.doneAt)} 완료` : "완료" })), dot: "bg-success", empty: "아직 없습니다" },
    { key: "active", title: "진행 중", items: board.active.map((x) => ({ label: x.area, href: `/portal/projects?p=${x.project!.id}`, note: `${x.stepLabel} · ${x.progress}%` })), dot: "bg-accent", empty: "진행 중인 과제 없음" },
    { key: "next", title: "다음으로 검토", items: [...board.review, ...board.proposed, ...board.suggested].map((x) => ({ label: x.area, href: "/portal/services", note: x.statusLabel ?? "" })), dot: "bg-ink-3", empty: "담당 컨설턴트가 함께 정합니다" },
  ];
  if (!board.completed.length && !board.active.length && !board.review.length && !board.proposed.length && !board.suggested.length) return null;
  return (
    <section className="card p-5" data-testid="growth-journey">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[1.1rem] font-bold"><TrendingUp size={18} className="text-accent" /> 우리 회사 성장 여정</h2>
        <Link href="/portal/projects" className="link-more">전체 보기 →</Link>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {lanes.map((l, i) => (
          <div key={l.key} className="relative rounded-2xl bg-surface-2/70 p-3.5">
            <div className="mb-2 flex items-center gap-2 text-[0.8rem] font-bold text-ink-2"><span className={cx("h-2 w-2 rounded-full", l.dot)} />{l.title}<span className="tnum ml-auto text-ink-3">{l.items.length}</span></div>
            {l.items.length === 0 ? <div className="py-2 text-[0.82rem] text-ink-3">{l.empty}</div> : (
              <div className="space-y-1.5">
                {l.items.slice(0, 4).map((x) => (
                  <Link key={`${l.key}-${x.label}`} href={x.href} {...(l.key === "active" ? { "data-growth-active": x.label } : {})} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-[0.85rem] hover:ring-1 hover:ring-accent/40">
                    {l.key === "done" ? <Check size={14} className="shrink-0 text-success" /> : null}
                    <span className="min-w-0 flex-1 truncate font-semibold">{x.label}</span>
                    <span className="shrink-0 text-[0.72rem] text-ink-3">{x.note}</span>
                  </Link>
                ))}
                {l.items.length > 4 && <div className="px-1 text-[0.75rem] text-ink-3">외 {l.items.length - 4}건</div>}
              </div>
            )}
            {i < lanes.length - 1 && <ArrowRight size={16} className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-ink-3 md:block" />}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ 우리 회사에 맞는 지원사업 — 미리보기 ------------------------------ */

export function ProgramsPreview({ company: c }: { company: Company }) {
  const programs = useStore((s) => s.programs);
  const { sent, matches } = useMemo(() => programsForCompany(openOnly(programs), c.id, profileOfCompany(c)), [programs, c]);
  const ms = [...sent, ...matches];
  if (!ms.length) return null;
  const urgent = ms.filter((m) => m.deadline.urgent).length;
  return (
    <section className="card p-5" data-testid="program-teaser">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#eafaf1] text-[#1f8a4c]"><Megaphone size={18} /></span>
        <h2 className="text-[1.1rem] font-bold">우리 회사에 맞는 지원사업 {ms.length}건</h2>
        {sent.length > 0 && <span className="rounded-full bg-soft px-2.5 py-0.5 text-[0.78rem] font-bold text-accent">담당자 추천 {sent.length}건</span>}
        {urgent > 0 && <span className="text-[0.82rem] font-semibold text-error">마감 임박 {urgent}</span>}
        <Link href="/portal/programs" className="link-more ml-auto">전체 보기 →</Link>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {ms.slice(0, 3).map((m) => (
          <Link key={m.program.id} href="/portal/programs" className="flex flex-col rounded-2xl border border-line p-3.5 hover:border-accent">
            <div className="flex items-center gap-1.5 text-[0.72rem] font-bold">
              <span className={cx("rounded-md px-1.5 py-0.5", m.deadline.urgent ? "bg-error-bg text-error" : "bg-surface-2 text-ink-2")}>{m.deadline.label}</span>
              {sent.includes(m) && <span className="rounded-md bg-soft px-1.5 py-0.5 text-accent">담당자 추천</span>}
            </div>
            <div className="mt-2 line-clamp-2 text-[0.9rem] font-semibold leading-snug">{m.program.title}</div>
            <div className="mt-auto pt-2 text-[0.75rem] text-ink-3">{m.program.agency}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ 최근 안내 ------------------------------ */

export function RecentUpdates({ companyId }: { companyId: string }) {
  const notifications = useStore((s) => s.notifications);
  const results = useStore((s) => s.results);
  const notifs = notifications.filter((n) => n.audience === "client" && n.companyId === companyId).slice(0, 4);
  const resultCount = results.filter((r) => r.companyId === companyId).length;
  return (
    <section className="card p-5">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-[1.1rem] font-bold">최근 안내</h2><Link href="/portal/notifications" className="link-more">전체 보기 →</Link></div>
      {notifs.length === 0 ? <div className="py-2 text-[0.9rem] text-ink-3">새 안내가 없습니다.</div> : (
        <div className="divide-y divide-line">
          {notifs.map((n) => (
            <Link key={n.id} href={n.href} className="flex items-start gap-2.5 py-2.5">
              <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-line-2" : "bg-accent")} />
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{n.title}</span><span className="mt-0.5 block line-clamp-1 text-[0.8rem] text-ink-2">{n.body}</span></span>
              <ChevronRight size={15} className="mt-1 shrink-0 text-ink-3" />
            </Link>
          ))}
        </div>
      )}
      {resultCount > 0 && <Link href="/portal/results" className="mt-2 flex items-center justify-between rounded-xl bg-surface-2 px-4 py-2.5 text-[0.88rem] font-semibold"><span className="flex items-center gap-2"><FileCheck2 size={16} className="text-success" /> 완료자료 {resultCount}건</span><ArrowRight size={14} /></Link>}
    </section>
  );
}

