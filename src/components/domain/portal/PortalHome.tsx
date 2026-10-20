"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CalendarDays, Check, ChevronRight, FileCheck2, Megaphone, MessageSquare, Phone, Pin } from "lucide-react";
import { useStore } from "@/lib/store";
import { ENTITY_TYPES } from "@/lib/company-options";
import { fmtDate, fmtTime } from "@/lib/format";
import { profileOfCompany, programsForCompany } from "@/lib/programs";
import { openOnly } from "@/lib/programs-client";
import type { Company } from "@/lib/types";
import { CUSTOMER_STEPS, stageToCustomerStep } from "@/lib/stages";
import { Icon3D, PORTAL_ICON } from "./Icon3D";
import { isReport } from "@/lib/progress-report";
import { Avatar, cx } from "@/components/ui/ui";
import type { useGrowth } from "./GrowthBoard";

type Board = NonNullable<ReturnType<typeof useGrowth>>;

/**
 * 고객 Portal 홈 — "업무 목록"이 아니라 "우리 회사 성장 공간"으로 읽히게.
 * 모든 숫자는 실제 기록에서 센다(지어낸 지표·성과값 없음). 없는 것은 보이지 않는다.
 */

/* ------------------------------ 상단: 우리 회사 성장 홈 ------------------------------ */

/**
 * 머리 영역 — 앱 첫 화면처럼: 브랜드 색 위에 인사·회사·숫자, 그 아래 떠 있는 흰 카드 두 장
 * (지금 진행 중인 과제를 배달 추적처럼 단계 점으로 / 담당 컨설턴트에게 바로 연락).
 */
export function PortalHero({ company: c, board, displayName }: { company: Company; board: Board; displayName: string }) {
  const users = useStore((s) => s.users);
  const schedules = useStore((s) => s.schedules);
  const consultant = users.find((u) => u.id === c.consultantId);
  const now = new Date();
  const nowIso = now.toISOString();
  const next = schedules.filter((s) => s.companyId === c.id && s.visibleToClient && s.start >= nowIso).sort((a, b) => a.start.localeCompare(b.start))[0];
  // 함께한 날 — 첫 상담일 기준(실제 기록). 없으면 보이지 않는다
  const since = c.firstConsultDate ? Math.floor((now.getTime() - Date.parse(c.firstConsultDate)) / 864e5) + 1 : undefined;
  // 업력·임직원은 아래 "우리 회사 한눈에"에 크게 나온다 — 여기서는 업종·형태·지역만 (같은 숫자를 두 번 보이지 않게)
  const chips = [
    c.industry || c.bizCategory,
    ENTITY_TYPES.find((e) => e.key === c.entityType)?.label,
    c.region,
  ].filter(Boolean) as string[];
  // 진행 중인 과제는 모두 여기서 본다(3건까지, 나머지는 진행현황) — 아래에 같은 목록을 다시 두지 않는다
  const active = board.active.slice(0, 3);
  const tiles = [
    { label: "지금 할 일", short: "할 일", value: board.actions.filter((a) => a.key !== "doc_more").length, hot: board.actions.length > 0, href: "#tut-p-actions" },
    { label: "진행 중 과제", short: "진행 중", value: board.active.length, href: "/portal/projects" },
    { label: "검토 중 과제", short: "검토 중", value: board.review.length + board.proposed.length, href: "#portal-next-growth" },
    { label: "완료한 과제", short: "완료", value: board.completed.length, href: board.completed.length ? "#growth-history" : "/portal/projects" },
  ];

  return (
    <section id="tut-p-progress" data-testid="portal-hero" className="-mx-4 -mt-5 md:mx-0 md:mt-0">
      <div className="portal-hero-bg relative overflow-hidden rounded-b-[2rem] px-5 pb-16 pt-5 text-white md:rounded-[1.75rem] md:px-8 md:pb-20 md:pt-7">
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 text-[0.75rem] font-semibold text-white/80">
            <span className="rounded-full bg-white/15 px-2.5 py-1 tracking-[0.06em] text-white">KPJK 성장 파트너</span>
            {since !== undefined && since > 0 && <span data-testid="partnership-days">함께한 지 <b className="text-white">{since.toLocaleString("ko-KR")}일</b></span>}
          </div>
          <p className="mt-3 text-[0.9rem] text-white/85">안녕하세요, <b className="font-semibold text-white">{displayName}</b>님</p>
          <h1 className="mt-0.5 text-[1.75rem] font-extrabold leading-tight tracking-tight md:text-[2.4rem]">{c.name}</h1>
          {chips.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">{chips.map((t) => <span key={t} className="rounded-full bg-white/15 px-2.5 py-1 text-[0.75rem] font-semibold text-white">{t}</span>)}</div>}
          <div className="mt-5 grid grid-cols-4 gap-1.5 md:max-w-[44rem] md:gap-2" data-testid="growth-tiles">
            {/* 숫자를 누르면 그 목록으로 간다 — 보기만 하는 숫자로 두지 않는다 */}
            {tiles.map((t) => (
              <Link key={t.label} href={t.href} className={cx("pressable rounded-2xl px-2.5 py-2 transition-colors md:px-4 md:py-2.5", t.hot ? "bg-white text-ink" : "bg-white/12 hover:bg-white/20")}>
                <div className={cx("truncate text-[0.7rem] font-bold md:text-[0.75rem]", t.hot ? "text-accent" : "text-white/80")}><span className="md:hidden">{t.short}</span><span className="hidden md:inline">{t.label}</span></div>
                <div className={cx("tnum mt-0.5 text-[1.35rem] font-extrabold leading-none md:text-[1.6rem]", t.hot && "text-accent")}>{t.value}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 떠 있는 카드 — 진행 추적 · 담당 컨설턴트 */}
      <div className="relative z-[1] mx-4 -mt-11 grid gap-3 md:mx-6 md:-mt-14 lg:grid-cols-[1.45fr_1fr] lg:items-start">
        <div className="card p-4 md:p-5">
          {active.length === 0 ? (
            <Link href="/portal/services" className="flex items-center gap-3">
              <Icon3D name="together" size="2.6rem" />
              <span className="min-w-0 flex-1"><b className="block">진행 중인 과제가 없습니다</b><span className="text-[0.82rem] text-ink-2">담당 컨설턴트와 함께 검토할 과제를 보세요</span></span>
              <ChevronRight size={18} className="shrink-0 text-ink-3" />
            </Link>
          ) : (
            <div className="space-y-3">
              {active.map((it, i) => <Tracker key={it.project!.id} it={it} big={i === 0} />)}
              {board.active.length > active.length && <Link href="/portal/projects" className="link-more block">진행 중인 과제 {board.active.length - active.length}건 더 보기 →</Link>}
            </div>
          )}
        </div>

        {/* 담당 컨설턴트 — 누구에게 물으면 되는지가 늘 보이게. 휴대폰은 한 줄(이름 + 둥근 버튼 둘)로 낮게 — 아이콘 메뉴가 첫 화면에 들어오게 */}
        <div className="card p-3.5 md:p-5" data-testid="hero-consultant">
          <div className="flex items-center gap-3">
            <Avatar name={consultant?.name ?? "K"} size={44} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[0.72rem] font-bold text-ink-3">담당 컨설턴트</div>
              <div className="mt-0.5 truncate text-[1.02rem] font-bold">{consultant ? `${consultant.name} ${consultant.title}` : "배정 전"}</div>
            </div>
            <div className="flex shrink-0 gap-2 md:hidden">
              <Link href="/portal/inquiries" aria-label="문의하기" className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-ink"><MessageSquare size={18} /></Link>
              {consultant?.phone
                ? <a href={`tel:${consultant.phone.replace(/[^0-9+]/g, "")}`} aria-label="전화" className="pressable flex h-11 w-11 items-center justify-center rounded-full border border-line-2 text-ink"><Phone size={18} /></a>
                : <Link href="/portal/schedule" aria-label="일정" className="pressable flex h-11 w-11 items-center justify-center rounded-full border border-line-2 text-ink"><CalendarDays size={18} /></Link>}
            </div>
          </div>
          {next && (
            <Link href="/portal/schedule" className="mt-3 hidden items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-[0.82rem] hover:bg-line/60 md:flex">
              <CalendarDays size={15} className="shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate">다음 일정 <b>{fmtDate(next.start)} {fmtTime(next.start)}</b> · {next.title.replace(c.name, "").trim()}</span>
            </Link>
          )}
          <div className="mt-3 hidden grid-cols-2 gap-2 md:grid">
            <Link href="/portal/inquiries" className="pressable inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-accent px-3 text-[0.88rem] font-bold text-accent-ink hover:brightness-110"><MessageSquare size={16} /> 문의하기</Link>
            {consultant?.phone
              ? <a href={`tel:${consultant.phone.replace(/[^0-9+]/g, "")}`} className="pressable inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line-2 px-3 text-[0.88rem] font-bold hover:bg-surface-2"><Phone size={16} /> 전화</a>
              : <Link href="/portal/schedule" className="pressable inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line-2 px-3 text-[0.88rem] font-bold hover:bg-surface-2"><CalendarDays size={16} /> 일정</Link>}
          </div>
        </div>
      </div>
    </section>
  );
}

/** 진행 추적 — 자료 요청 · 자료 검토 · 진행 · 완료 네 점 중 지금 어디인지 (배달 앱의 주문 추적처럼) */
function Tracker({ it, big }: { it: Board["active"][number]; big: boolean }) {
  const step = it.project ? stageToCustomerStep(it.project.stage) : 0;
  const ms = it.project?.nextMilestone;
  return (
    <Link href={`/portal/projects?p=${it.project!.id}`} data-growth-active={it.area} className={cx("block", !big && "border-t border-line pt-3")}>
      <div className="flex items-center gap-3">
        {big && <Icon3D name="growth" size="2.6rem" />}
        <span className="min-w-0 flex-1 leading-tight">
          <b className={cx("block truncate", big ? "text-[1.05rem]" : "text-[0.92rem]")}>{it.area}</b>
          <span className="mt-0.5 block truncate text-[0.8rem] text-ink-2">지금 <b className="text-accent">{it.stepLabel}</b> 단계{ms?.label ? ` · 다음 ${ms.label}${ms.date ? ` ${fmtDate(ms.date)}` : ""}` : ""}</span>
        </span>
        <span className="tnum shrink-0 text-[1.2rem] font-extrabold text-accent">{it.progress}%</span>
      </div>
      <ol className="mt-3 flex items-start" aria-label={`${it.area} 진행 단계`}>
        {CUSTOMER_STEPS.map((s, i) => (
          <li key={s.key} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center" aria-current={i === step ? "step" : undefined}>
            <span className="relative flex w-full items-center justify-center">
              {i > 0 && <span className={cx("absolute right-1/2 top-1/2 h-[3px] w-full -translate-y-1/2", i <= step ? "bg-accent" : "bg-line")} />}
              <span className={cx("relative z-[1] flex h-5 w-5 items-center justify-center rounded-full", i < step ? "bg-accent text-accent-ink" : i === step ? "bg-surface ring-[5px] ring-accent" : "bg-line")}>{i < step && <Check size={12} strokeWidth={3} />}</span>
            </span>
            {big && <span className={cx("w-full truncate px-0.5 text-[0.68rem] font-semibold", i === step ? "text-accent" : i < step ? "text-ink-2" : "text-ink-3")}>{s.label.replace(" 중", "")}</span>}
          </li>
        ))}
      </ol>
    </Link>
  );
}

/* ------------------------------ 바로 가기 — 앱 첫 화면의 아이콘 메뉴 ------------------------------ */

export function PortalHub({ company: c, board }: { company: Company; board: Board }) {
  const st = useStore();
  const programs = useMemo(() => programsForCompany(openOnly(st.programs), c.id, profileOfCompany(c)), [st.programs, c]);
  const docsOpen = st.docRequests.filter((d) => d.companyId === c.id && (d.status === "requested" || d.status === "revision")).length;
  // 담당자가 올린 제안 중 아직 답하지 않은 것
  const proposals = board.proposed.length;
  // 빨간 숫자는 "고객이 할 것"에만 — 낼 자료 · 담당자가 보낸 공고 · 담당자 제안
  const items: { href: string; label: string; badge?: number }[] = [
    { href: "/portal/documents", label: "자료제출", badge: docsOpen },
    { href: "/portal/projects", label: "진행현황" },
    { href: "/portal/schedule", label: "일정" },
    { href: "/portal/inquiries", label: "문의하기" },
    { href: "/portal/results", label: "완료자료" },
    { href: "/portal/programs", label: "지원사업", badge: programs.sent.length },
    { href: "/portal/services", label: "함께 검토", badge: proposals },
    { href: "/portal/company", label: "우리 회사" },
  ];
  return (
    // PC는 위 메뉴줄에 같은 메뉴가 늘 보인다 — 아이콘 메뉴는 휴대폰·태블릿에서만. 흰 카드 안에 작은 3D 그림(앱 바로가기 정도)
    <nav data-testid="portal-hub" aria-label="바로 가기" className="card px-2 py-3.5 lg:hidden">
      <ul className="grid grid-cols-4 gap-y-3">
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} data-hub={it.label} className="pressable flex flex-col items-center gap-1 rounded-2xl py-1 text-center">
              <span className="relative">
                <Icon3D name={PORTAL_ICON[it.href]} size="2.35rem" />
                {!!it.badge && <span className="tnum absolute -right-2 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[0.66rem] font-bold text-white ring-2 ring-surface">{it.badge}</span>}
              </span>
              <span className="text-[0.74rem] font-semibold text-ink">{it.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** 담당자가 "꼭 읽어 주세요"로 고정한 공지 — 홈에서는 한 줄 띠로 */
export function PinnedStrip({ title, more }: { title: string; more: number }) {
  return (
    <Link href="/portal/schedule#notices" data-testid="pinned-strip" className="pressable flex items-center gap-3 rounded-2xl bg-soft px-4 py-3 ring-1 ring-accent/15">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-accent"><Pin size={15} /></span>
      <span className="min-w-0 flex-1 leading-tight"><span className="block text-[0.7rem] font-bold text-accent">{isReport({ title }) ? "담당자 경과 보고" : "담당자 공지"}{more > 0 ? ` · 고정 ${more + 1}건` : ""}</span><span className="block truncate text-[0.9rem] font-semibold">{title}</span></span>
      <ChevronRight size={17} className="shrink-0 text-ink-3" />
    </Link>
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
    <section data-testid="program-teaser">
      <div className="mb-2.5 flex items-end gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-[1.1rem] font-bold"><Icon3D name="funding" size="1.7rem" />우리 회사에 맞는 지원사업 {ms.length}건</h2>
          <p className="text-[0.78rem] text-ink-3">{sent.length > 0 ? `담당자 추천 ${sent.length}건 · ` : ""}{urgent > 0 ? <span className="font-semibold text-error">마감 임박 {urgent}건 · </span> : null}실제 공고 · 자격은 담당자가 확인합니다</p>
        </div>
        <Link href="/portal/programs" className="link-more shrink-0">전체 보기 →</Link>
      </div>
      {/* 휴대폰: 옆으로 넘기는 카드 / PC: 세 칸 */}
      <div className="snap-row hide-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {ms.slice(0, 6).map((m, i) => (
          <Link key={m.program.id} href="/portal/programs" className={cx("card card-hover flex w-[78%] shrink-0 flex-col p-4 md:w-auto", i >= 3 && "md:hidden")}>
            <div className="flex items-center gap-1.5 text-[0.72rem] font-bold">
              <span className={cx("rounded-full px-2 py-0.5", m.deadline.urgent ? "bg-error-bg text-error" : "bg-[#eafaf1] text-[#1f6f42]")}>{m.deadline.label}</span>
              {sent.includes(m) && <span className="rounded-full bg-soft px-2 py-0.5 text-accent">담당자 추천</span>}
            </div>
            <div className="mt-2.5 line-clamp-2 text-[0.95rem] font-bold leading-snug">{m.program.title}</div>
            <div className="mt-auto flex items-center gap-1 pt-3 text-[0.75rem] text-ink-3"><Megaphone size={12} className="shrink-0" /><span className="truncate">{m.program.agency}</span></div>
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
      {resultCount > 0 && <Link href="/portal/results" className="mt-2 flex min-h-11 items-center justify-between rounded-xl bg-surface-2 px-4 text-[0.88rem] font-semibold"><span className="flex items-center gap-2"><FileCheck2 size={16} className="text-success" /> 완료자료 {resultCount}건</span><ArrowRight size={14} /></Link>}
    </section>
  );
}

