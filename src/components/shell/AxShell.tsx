"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Eye,
  FolderOpen,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  RotateCcw,
  Settings,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  MessageSquarePlus,
  Compass,
} from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { NEXT_FEATURES, useUi } from "@/lib/ui-store";
import { useIsMobile, useIsPreviewFrame } from "@/lib/hooks";
import { LiveClock } from "./LiveClock";
import { NotificationBell } from "./Notifications";
import { DevicePreviewButton, DevicePreviewOverlay } from "./DevicePreview";
import { Tutorial } from "./Tutorial";
import { FontScalePicker, FontScaleStepper } from "./FontScale";
import { GlobalSearch, SearchTrigger } from "./GlobalSearch";
import { Presentation, PresentationButton } from "./Presentation";
import { NextSheet } from "./NextSheet";
import { AiReadyModal, DraftModal } from "@/components/ai/AiModals";
import { Toaster } from "@/components/ui/Toaster";
import { Modal, Sheet, Confirm } from "@/components/ui/overlay";
import { Avatar, Badge, Button, DemoBadge, NextBadge, PageSkeleton, cx } from "@/components/ui/ui";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Hover tooltip — used where the label is shortened. */
  hint?: string;
  id?: string;
  /** live count key — resolved in NavLink so the sidebar shows what needs attention */
  badge?: "approvals" | "tasks";
}

interface NavGroup {
  key: string;
  label: string;
  /** Icon color on the dark sidebar. One family per group — never per item. */
  color: string;
  /** Same family, darkened for the light mobile drawer. */
  inkColor: string;
  items: NavItem[];
}

/**
 * Sidebar IA — 4 groups. Order inside 핵심 운영 follows the real consulting
 * lifecycle: 고객 → 상담·계약 → 프로젝트 → 실행(자료·일정·업무) → 소통 → 결과.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    key: "today",
    label: "오늘",
    color: "var(--nav-core)",
    inkColor: "var(--nav-core-ink)",
    items: [
      { href: "/ax/dashboard", label: "대시보드", icon: <LayoutDashboard size={18} />, hint: "오늘의 코치 · 브리핑", id: "tut-nav-dashboard" },
      { href: "/ax/opportunities", label: "승인 · 매출기회", icon: <ShieldCheck size={18} />, hint: "대표 승인 대기 · 추가서비스 기회", id: "tut-nav-approvals", badge: "approvals" },
      { href: "/ax/tasks", label: "업무함", icon: <CheckSquare size={18} />, hint: "내 업무 · 고객 문의", badge: "tasks" },
    ],
  },
  {
    key: "client",
    label: "고객 · 프로젝트",
    color: "var(--nav-client)",
    inkColor: "var(--nav-client-ink)",
    items: [
      { href: "/ax/clients", label: "기업고객", icon: <Building2 size={18} />, id: "tut-nav-clients" },
      { href: "/ax/consultations", label: "상담 · 견적 · 계약", icon: <ClipboardList size={18} /> },
      { href: "/ax/projects", label: "프로젝트", icon: <Briefcase size={18} />, id: "tut-nav-projects" },
      { href: "/ax/documents", label: "자료관리", icon: <FolderOpen size={18} />, hint: "요청자료 · 결과자료", id: "tut-nav-documents" },
    ],
  },
  {
    key: "ops",
    label: "운영",
    color: "var(--nav-ai)",
    inkColor: "var(--nav-ai-ink)",
    items: [
      { href: "/ax/schedule", label: "일정", icon: <CalendarDays size={18} /> },
      { href: "/ax/reports", label: "리포트 · 실증", icon: <BarChart3 size={18} />, hint: "Evidence · KPI" },
    ],
  },
];

/** 메인 운영 메뉴와 같은 무게로 보이면 안 되는 것들 — 사이드바 하단에 따로 둔다. */
const NAV_UTILITY: NavItem[] = [
  { href: "/ax/coach", label: "AX 코치", icon: <Compass size={17} />, hint: "실증 14일 · 오늘의 미션" },
  { href: "/ax/settings", label: "설정", icon: <Settings size={17} />, id: "tut-nav-settings" },
  { href: "/ax/why", label: "Why AX", icon: <BookOpen size={17} />, hint: "기획의도", id: "tut-nav-why" },
];

/** Routes already reachable from the mobile bottom bar — excluded from 더보기. */
const MOBILE_PRIMARY = ["/ax/dashboard", "/ax/clients", "/ax/projects", "/ax/documents"];

function NavLink({ item, color, onClick, mobile, utility }: { item: NavItem; color: string; onClick?: () => void; mobile?: boolean; utility?: boolean }) {
  const pathname = usePathname();
  const badgeCount = useStore((s) => {
    if (item.badge === "approvals") return s.approvals.filter((a) => a.status === "pending").length;
    if (item.badge === "tasks") {
      const me = s.session?.role === "consultant" ? s.session.userId : undefined;
      const open = s.tasks.filter((t) => (t.status === "todo" || t.status === "doing") && (!me || t.assigneeId === me)).length;
      const iq = s.inquiries.filter((i) => i.status === "open" && (!me || i.assigneeId === me)).length;
      return open + iq;
    }
    return 0;
  });
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      id={item.id}
      href={item.href}
      title={item.hint}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cx(
        "pressable nav-item relative flex items-center gap-2.5 rounded-lg px-3",
        utility ? "py-[0.3rem] text-[0.82rem] font-medium" : "py-[0.35rem] text-[0.9rem] font-semibold",
        mobile
          ? active
            ? "bg-surface-2 text-ink"
            : "text-ink-2 hover:bg-surface-2"
          : active
            ? "bg-white/[0.10] text-white"
            : "text-shell-text-2 hover:bg-white/[0.05] hover:text-white",
      )}
    >
      {active && !mobile && <span aria-hidden className="nav-bar-in absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />}
      <span className="nav-icon flex h-5 w-5 shrink-0 items-center justify-center transition-opacity" style={{ color, opacity: active ? 1 : utility ? 0.6 : 0.75 }}>
        {item.icon}
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {badgeCount > 0 && (
        <span key={badgeCount} className={cx("anim-tick tnum shrink-0 rounded-full px-1.5 text-[0.72rem] font-bold", item.badge === "approvals" ? "bg-accent text-accent-ink" : mobile ? "bg-surface-2 text-ink-2" : "bg-white/15 text-white")}>{badgeCount}</span>
      )}
    </Link>
  );
}

/** 향후 확장 — one level quieter than a real menu, collapsed by default. */
function NextGroup({ mobile }: { mobile?: boolean }) {
  const openNext = useUi((s) => s.openNext);
  const [open, setOpen] = useState(false);
  return (
    <div className={cx("mt-3 pt-2.5", mobile ? "border-t border-line" : "border-t border-white/[0.07]")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cx(
          "pressable flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[0.66rem] font-bold tracking-[0.16em] transition-colors",
          mobile ? "text-ink-3 hover:text-ink-2" : "text-shell-text-3 hover:text-shell-text-2",
        )}
      >
        <span>향후 확장</span>
        <NextBadge tone={mobile ? "ink" : "shell"} />
        <span className="flex-1" />
        <ChevronDown size={14} className={cx("shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {NEXT_FEATURES.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => openNext(f.key)}
              className={cx(
                "pressable flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-[0.82rem] font-medium transition-colors",
                mobile ? "text-ink-2 hover:bg-surface-2" : "text-shell-text-3 hover:bg-white/[0.05] hover:text-shell-text-2",
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: mobile ? "var(--nav-next-ink)" : "var(--nav-next)" }} />
              </span>
              <span className="flex-1 truncate">{f.title}</span>
              <ChevronRight size={13} className="shrink-0 opacity-60" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] flex-col bg-shell text-shell-text lg:flex">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[0.7rem] font-black tracking-wider text-shell">KPJK</span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[0.72rem] font-bold tracking-[0.1em] text-shell-text-2">KPJK CORPORATION</div>
          <div className="truncate text-[1.18rem] font-extrabold tracking-tight text-highlight">Business AX</div>
        </div>
      </div>
      {/* 메뉴는 로고에서 한 칸 더 내려온다 — 로고와 첫 메뉴가 붙어 있으면 둘이 한 덩어리로 읽힌다. */}
      <nav className="thin-scroll flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {NAV_GROUPS.map((g, i) => (
          <div key={g.key} className={cx(i > 0 && "mt-3 border-t border-white/[0.07] pt-2.5")}>
            <div className="px-3 pb-1 pt-0.5 text-[0.66rem] font-bold tracking-[0.16em] text-shell-text-3">{g.label}</div>
            <div className="space-y-0.5">
              {g.items.map((item) => (
                <NavLink key={item.href} item={item} color={g.color} />
              ))}
            </div>
          </div>
        ))}
        <NextGroup />
      </nav>
      <div className="border-t border-white/10 p-2">
        <div className="space-y-0.5">
          {NAV_UTILITY.map((item) => (
            <NavLink key={item.href} item={item} color="var(--nav-sys)" utility />
          ))}
        </div>
        <Link href="/ax/survey" className="pressable mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.06]">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center" style={{ color: "var(--nav-next)" }}><MessageSquarePlus size={17} /></span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[0.82rem] font-semibold text-shell-text-2">시스템 개선 의견</span>
            <span className="block text-[0.7rem] text-shell-text-3">2단계 사용 설문 · 약 2분</span>
          </span>
          <ChevronRight size={13} className="shrink-0 text-shell-text-3" />
        </Link>
        <div className="px-3 pb-1 pt-2 text-[0.7rem] text-shell-text-3">DEMO DATA · v1.2</div>
      </div>
    </aside>
  );
}

function CompanyPickerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const companies = useStore((s) => s.companies);
  const setPreview = useStore((s) => s.setPortalPreview);
  const router = useRouter();
  return (
    <Modal open={open} onClose={onClose} title="고객 화면 보기 — 어떤 기업으로 볼까요?" size="sm">
      <p className="mb-3 text-[0.85rem] text-ink-2">선택한 기업의 담당자가 보는 Portal을 그대로 확인합니다 (관리자 미리보기).</p>
      <div className="space-y-1.5">
        {companies.map((c) => (
          <button key={c.id} onClick={() => { setPreview(c.id); onClose(); router.push("/portal"); }} className="pressable flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-left hover:bg-surface-2">
            <span>
              <span className="font-semibold">{c.name}</span>
              <span className="ml-2 text-[0.8rem] text-ink-3">{c.contactName} {c.contactTitle}</span>
            </span>
            <ChevronRight size={16} className="text-ink-3" />
          </button>
        ))}
      </div>
    </Modal>
  );
}

function Header() {
  const user = useCurrentUser();
  const logout = useStore((s) => s.logout);
  const openTutorial = useUi((s) => s.openTutorial);
  const router = useRouter();
  const inFrame = useIsPreviewFrame();
  const [pick, setPick] = useState(false);
  const btn = "pressable flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-[0.82rem] font-semibold text-ink-2 hover:bg-surface-2";
  const lbl = "hidden 2xl:inline";
  return (
    <header className="sticky top-0 z-30 flex h-[var(--header-h)] items-center gap-2 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-2 lg:hidden">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-shell text-[0.65rem] font-black text-white">KPJK</span>
        <span className="truncate text-[0.95rem] font-bold">Business AX</span>
      </div>
      <div className="hidden items-center gap-3 lg:flex">
        <SearchTrigger />
        <span className="hdr-optional hidden xl:flex"><LiveClock compact /></span>
        <DemoBadge className="hdr-optional hidden 2xl:inline-flex" />
      </div>
      <div className="flex-1" />
      <div className="hidden items-center gap-1 lg:flex">
        {/* 대표/직원 전환 버튼을 제거했다 — 버튼 하나로 권한이 바뀌면 권한 체계가 성립하지 않는다.
            역할은 로그인한 계정으로만 정해진다. */}
        <button id="tut-surface" onClick={() => setPick(true)} className={cx(btn, "hdr-optional")} title="고객 화면 보기">
          <Eye size={18} /> <span className={lbl}>고객 화면 보기</span>
        </button>
        <FontScaleStepper className="mx-1" />
        <DevicePreviewButton className={btn} labelClass={lbl} />
        <PresentationButton className={cx(btn, "hdr-optional")} labelClass={lbl} />
        {!inFrame && (
          <button onClick={() => openTutorial("ax")} className={btn} title="튜토리얼">
            <HelpCircle size={18} />
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 lg:hidden">
        <SearchTrigger compact />
        <FontScaleStepper />
        <span className="hdr-optional"><LiveClock compact /></span>
      </div>
      <span className="shrink-0"><NotificationBell audience="internal" /></span>
      <div className="hidden items-center gap-2 pl-2 lg:flex">
        <Avatar name={user?.name ?? "K"} size={34} />
        <div className="hdr-optional hidden whitespace-nowrap leading-tight xl:block">
          <div className="text-[0.82rem] font-bold">{user?.name}</div>
          <div className="text-[0.7rem] text-ink-3">{user?.title}</div>
        </div>
        <button onClick={() => { logout(); router.push("/login"); }} className="pressable ml-1 rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink" title="로그아웃" aria-label="로그아웃">
          <LogOut size={18} />
        </button>
      </div>
      <CompanyPickerModal open={pick} onClose={() => setPick(false)} />
    </header>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const setMore = useUi((s) => s.setMoreSheet);
  const items = [
    { href: "/ax/dashboard", label: "오늘", icon: <LayoutDashboard size={22} /> },
    { href: "/ax/clients", label: "고객", icon: <Building2 size={22} /> },
    { href: "/ax/projects", label: "프로젝트", icon: <Briefcase size={22} /> },
    { href: "/ax/documents", label: "자료", icon: <FolderOpen size={22} /> },
  ];
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface lg:hidden">
      {items.map((i) => {
        const active = pathname.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={cx("pressable flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.7rem] font-semibold", active ? "text-accent" : "text-ink-3")}>
            {i.icon}
            {i.label}
          </Link>
        );
      })}
      <button onClick={() => setMore(true)} className="pressable flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.7rem] font-semibold text-ink-3">
        <MoreHorizontal size={22} />
        더보기
      </button>
    </nav>
  );
}

function MoreSheet() {
  const open = useUi((s) => s.moreSheet);
  const setMore = useUi((s) => s.setMoreSheet);
  const openTutorial = useUi((s) => s.openTutorial);
  const user = useCurrentUser();
  const session = useStore((s) => s.session);
  const logout = useStore((s) => s.logout);
  const resetDemo = useStore((s) => s.resetDemo);
  const toast = useStore((s) => s.toast);
  const router = useRouter();
  const [pick, setPick] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const close = () => setMore(false);
  const btn = "pressable flex items-center gap-2 rounded-xl border border-line px-3 py-3 text-[0.85rem] font-semibold text-ink-2 hover:bg-surface-2";
  return (
    <>
      <Sheet open={open} onClose={close} title="더보기">
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-surface-2 p-3">
          <Avatar name={user?.name ?? "K"} />
          <div className="flex-1 leading-tight">
            <div className="font-bold">{user?.name} {user?.title}</div>
            <div className="text-[0.75rem] text-ink-3">{session?.role === "admin" ? "대표 화면" : "직원 화면"}</div>
          </div>
          <Badge tone={session?.role === "admin" ? "accent" : "neutral"}>{session?.role === "admin" ? "대표" : "컨설턴트"}</Badge>
        </div>
        <div className="mb-4 rounded-xl border border-line p-3">
          <div className="mb-2 text-[0.82rem] font-semibold text-ink-2">글자 크기</div>
          <FontScalePicker />
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button onClick={() => { close(); setPick(true); }} className={btn}><Eye size={18} /> 고객 화면 보기</button>
          <DevicePreviewButton className={btn} />
          <PresentationButton className={btn} />
          <button onClick={() => openTutorial("ax")} className={btn}><HelpCircle size={18} /> 튜토리얼</button>
          <button onClick={() => setConfirmReset(true)} className={btn}><RotateCcw size={18} /> 데모 초기화</button>
          <button onClick={() => { logout(); router.push("/login"); }} className={btn}><LogOut size={18} /> 로그아웃</button>
          <Link href="/ax/coach" onClick={close} className={cx(btn, "col-span-2 border-accent/60")}><Compass size={18} className="text-accent" /> AX 코치 <span className="ml-auto text-[0.75rem] font-normal text-ink-3">오늘의 실증 미션</span></Link>
        </div>
        {NAV_GROUPS.map((g, gi) => {
          const items = g.items.filter((i) => !MOBILE_PRIMARY.includes(i.href));
          if (!items.length) return null;
          return (
            <div key={g.key} className={cx(gi > 0 && "mt-3 border-t border-line pt-2.5")}>
              <div className="px-3 pb-1 pt-0.5 text-[0.66rem] font-bold tracking-[0.16em] text-ink-3">{g.label}</div>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink key={item.href} item={item} color={g.inkColor} onClick={close} mobile />
                ))}
              </div>
            </div>
          );
        })}
        <div className="mt-3 border-t border-line pt-3">
          <div className="px-3 pb-1 pt-0.5 text-[0.66rem] font-bold tracking-[0.16em] text-ink-3">시스템</div>
          <div className="space-y-0.5">
            {NAV_UTILITY.map((item) => <NavLink key={item.href} item={item} color="var(--nav-sys-ink)" onClick={close} mobile />)}
            <Link href="/ax/survey" onClick={close} className="pressable flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.9rem] font-semibold text-ink-2 hover:bg-surface-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center" style={{ color: "var(--nav-next-ink)" }}><MessageSquarePlus size={17} /></span>
              <span className="flex-1">시스템 개선 의견</span>
              <ChevronRight size={13} className="text-ink-3" />
            </Link>
          </div>
        </div>
        <NextGroup mobile />
      </Sheet>
      <CompanyPickerModal open={pick} onClose={() => setPick(false)} />
      <Confirm open={confirmReset} onClose={() => setConfirmReset(false)} onConfirm={() => { resetDemo(); toast("데모 데이터를 초기화했습니다."); }} title="데모 초기화" desc="모든 Action 상태, 고객 제출, 문의를 초기 상태로 되돌립니다." confirmText="초기화" danger />
    </>
  );
}

export function AxShell({ children }: { children: ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);
  const session = useStore((s) => s.session);
  const settings = useStore((s) => s.settings);
  const openTutorial = useUi((s) => s.openTutorial);
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const inFrame = useIsPreviewFrame();

  useEffect(() => {
    if (!hydrated) return;
    if (!session || session.role === "client") router.replace("/login");
  }, [hydrated, session, router]);

  // First-run tutorial — only auto-opens on the dashboard so it never pulls the user away from another screen.
  useEffect(() => {
    if (!hydrated || !session || session.role === "client" || inFrame) return;
    if (!settings.tutorialDoneAx && pathname === "/ax/dashboard") {
      const t = setTimeout(() => openTutorial("ax"), 600);
      return () => clearTimeout(t);
    }
  }, [hydrated, session, settings.tutorialDoneAx, inFrame, openTutorial, pathname]);

  const ready = hydrated && session && session.role !== "client";

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <Header />
        <main className={cx("mx-auto w-full max-w-[1720px] px-4 py-5 md:px-6 md:py-7", isMobile && "pb-24")}>
          {ready ? <div key={pathname} className="anim-page">{children}</div> : <PageSkeleton />}
        </main>
      </div>
      <MobileNav />
      <MoreSheet />
      <GlobalSearch />
      <NextSheet />
      <AiReadyModal />
      <DraftModal />
      <Tutorial />
      <Presentation />
      <DevicePreviewOverlay />
      <Toaster />
    </div>
  );
}

export { Bell, Button };
