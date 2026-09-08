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
  FileCheck2,
  FolderOpen,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  RotateCcw,
  Settings,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { NEXT_FEATURES, useUi } from "@/lib/ui-store";
import { useIsMobile, useIsPreviewFrame } from "@/lib/hooks";
import { LiveClock } from "./LiveClock";
import { NotificationBell } from "./Notifications";
import { DevicePreviewButton, DevicePreviewOverlay } from "./DevicePreview";
import { Tutorial } from "./Tutorial";
import { Presentation, PresentationButton } from "./Presentation";
import { NextSheet } from "./NextSheet";
import { AiReadyModal, DraftModal } from "@/components/ai/AiModals";
import { Toaster } from "@/components/ui/Toaster";
import { Modal, Sheet, Confirm } from "@/components/ui/overlay";
import { Avatar, Button, DemoBadge, NextBadge, PageSkeleton, SegmentedControl, cx } from "@/components/ui/ui";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  color: string;
  id?: string;
}

const NAV_MAIN: NavItem[] = [
  { href: "/ax/dashboard", label: "대시보드", icon: <LayoutDashboard size={19} />, color: "var(--mod-overview)", id: "tut-nav-dashboard" },
  { href: "/ax/clients", label: "기업고객", icon: <Building2 size={19} />, color: "var(--mod-customer)", id: "tut-nav-clients" },
  { href: "/ax/projects", label: "프로젝트", icon: <Briefcase size={19} />, color: "var(--mod-ops)", id: "tut-nav-projects" },
  { href: "/ax/consultations", label: "상담 / 계약", icon: <ClipboardList size={19} />, color: "var(--mod-sales)" },
  { href: "/ax/documents", label: "자료관리", icon: <FolderOpen size={19} />, color: "var(--mod-doc)", id: "tut-nav-documents" },
  { href: "/ax/schedule", label: "일정", icon: <CalendarDays size={19} />, color: "var(--mod-schedule)" },
  { href: "/ax/tasks", label: "업무 / 후속관리", icon: <CheckSquare size={19} />, color: "var(--mod-ops)" },
  { href: "/ax/inquiries", label: "문의 / 커뮤니케이션", icon: <MessageSquare size={19} />, color: "var(--mod-customer)" },
  { href: "/ax/results", label: "결과자료", icon: <FileCheck2 size={19} />, color: "var(--mod-evidence)" },
];
const NAV_GROWTH: NavItem[] = [
  { href: "/ax/brief", label: "AI 브리핑", icon: <Sparkles size={19} />, color: "var(--mod-ai)" },
  { href: "/ax/reports", label: "리포트", icon: <BarChart3 size={19} />, color: "var(--mod-evidence)" },
];
const NAV_SYSTEM: NavItem[] = [
  { href: "/ax/why", label: "Why AX · 기획의도", icon: <BookOpen size={19} />, color: "var(--mod-ai)", id: "tut-nav-why" },
  { href: "/ax/settings", label: "설정", icon: <Settings size={19} />, color: "var(--mod-system)", id: "tut-nav-settings" },
];

function NavLink({ item, onClick, mobile }: { item: NavItem; onClick?: () => void; mobile?: boolean }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      id={item.id}
      href={item.href}
      onClick={onClick}
      className={cx(
        "pressable group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-semibold transition-colors",
        mobile ? (active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2") : active ? "bg-white/10 text-white" : "text-shell-text-2 hover:bg-white/5 hover:text-white",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${item.color} ${active ? 28 : 16}%, transparent)`, color: item.color }}>
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {active && !mobile && <span className="h-5 w-1 rounded-full bg-accent" />}
    </Link>
  );
}

function Sidebar() {
  const openNext = useUi((s) => s.openNext);
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] flex-col bg-shell text-shell-text lg:flex">
      <div className="flex h-[var(--header-h)] items-center gap-3 px-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[0.7rem] font-black tracking-wider text-shell">KPJK</span>
        <div className="leading-tight">
          <div className="text-[1rem] font-bold text-white">KPJK</div>
          <div className="text-[0.8rem] font-bold tracking-wide text-highlight">Business AX</div>
        </div>
      </div>
      <nav className="thin-scroll flex-1 overflow-y-auto px-3 pb-4">
        <div className="px-3 pb-2 pt-3 text-[0.7rem] font-bold tracking-widest text-shell-text-3">핵심 운영</div>
        <div className="space-y-0.5">{NAV_MAIN.map((i) => <NavLink key={i.href} item={i} />)}</div>
        <div className="px-3 pb-2 pt-5 text-[0.7rem] font-bold tracking-widest text-shell-text-3">성장 · 실증</div>
        <div className="space-y-0.5">{NAV_GROWTH.map((i) => <NavLink key={i.href} item={i} />)}</div>
        <div className="px-3 pb-2 pt-5 text-[0.7rem] font-bold tracking-widest text-shell-text-3">시스템</div>
        <div className="space-y-0.5">{NAV_SYSTEM.map((i) => <NavLink key={i.href} item={i} />)}</div>
        <div className="mt-5 rounded-xl border border-dashed border-white/15 p-3">
          <div className="mb-2 flex items-center gap-2 text-[0.72rem] font-bold tracking-widest text-shell-text-3">
            향후 확장 <NextBadge />
          </div>
          <div className="space-y-0.5">
            {NEXT_FEATURES.map((f) => (
              <button key={f.key} onClick={() => openNext(f.key)} className="pressable flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[0.85rem] text-shell-text-3 hover:bg-white/5 hover:text-shell-text-2">
                <span>{f.title}</span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        </div>
      </nav>
      <div className="border-t border-white/10 px-5 py-3 text-[0.75rem] text-shell-text-3">
        <div className="flex items-center justify-between">
          <span>DEMO DATA · v1.0</span>
          <span>미래AI랩 제작</span>
        </div>
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
  const session = useStore((s) => s.session);
  const login = useStore((s) => s.login);
  const logout = useStore((s) => s.logout);
  const openTutorial = useUi((s) => s.openTutorial);
  const router = useRouter();
  const inFrame = useIsPreviewFrame();
  const [pick, setPick] = useState(false);
  const btn = "pressable flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-[0.82rem] font-semibold text-ink-2 hover:bg-surface-2";
  const lbl = "hidden 2xl:inline";
  return (
    <header className="sticky top-0 z-30 flex h-[var(--header-h)] items-center gap-2 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2 lg:hidden">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-shell text-[0.65rem] font-black text-white">KPJK</span>
        <span className="text-[0.95rem] font-bold">Business AX</span>
      </div>
      <div className="hidden items-center gap-3 lg:flex">
        <span className="hidden xl:flex"><LiveClock /></span>
        <span className="flex xl:hidden"><LiveClock compact /></span>
        <DemoBadge className="hidden xl:inline-flex" />
      </div>
      <div className="flex-1" />
      <div className="hidden items-center gap-1 lg:flex">
        {!inFrame && (
          <SegmentedControl
            size="sm"
            value={session?.role === "admin" ? "admin" : "consultant"}
            onChange={(k) => login(k === "admin" ? "u_admin" : "u_park")}
            options={[
              { key: "admin", label: "대표" },
              { key: "consultant", label: "직원" },
            ]}
          />
        )}
        <button id="tut-surface" onClick={() => setPick(true)} className={btn} title="고객 화면 보기">
          <Eye size={18} /> <span className={lbl}>고객 화면 보기</span>
        </button>
        <DevicePreviewButton className={btn} labelClass={lbl} />
        <PresentationButton className={btn} labelClass={lbl} />
        {!inFrame && (
          <button onClick={() => openTutorial("ax")} className={btn} title="튜토리얼">
            <HelpCircle size={18} />
          </button>
        )}
      </div>
      <div className="lg:hidden">
        <LiveClock compact />
      </div>
      <NotificationBell audience="internal" />
      <div className="hidden items-center gap-2 pl-2 lg:flex">
        <Avatar name={user?.name ?? "K"} size={34} />
        <div className="hidden whitespace-nowrap leading-tight xl:block">
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
  const openNext = useUi((s) => s.openNext);
  const user = useCurrentUser();
  const session = useStore((s) => s.session);
  const login = useStore((s) => s.login);
  const logout = useStore((s) => s.logout);
  const resetDemo = useStore((s) => s.resetDemo);
  const toast = useStore((s) => s.toast);
  const router = useRouter();
  const [pick, setPick] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const close = () => setMore(false);
  const rest = [...NAV_MAIN.slice(4), ...NAV_GROWTH, ...NAV_SYSTEM];
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
          <SegmentedControl size="sm" value={session?.role === "admin" ? "admin" : "consultant"} onChange={(k) => login(k === "admin" ? "u_admin" : "u_park")} options={[{ key: "admin", label: "대표" }, { key: "consultant", label: "직원" }]} />
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button onClick={() => { close(); setPick(true); }} className={btn}><Eye size={18} /> 고객 화면 보기</button>
          <DevicePreviewButton className={btn} />
          <PresentationButton className={btn} />
          <button onClick={() => openTutorial("ax")} className={btn}><HelpCircle size={18} /> 튜토리얼</button>
          <button onClick={() => setConfirmReset(true)} className={btn}><RotateCcw size={18} /> 데모 초기화</button>
          <button onClick={() => { logout(); router.push("/login"); }} className={btn}><LogOut size={18} /> 로그아웃</button>
        </div>
        <div className="space-y-0.5">{rest.map((i) => <NavLink key={i.href} item={i} onClick={close} mobile />)}</div>
        <div className="mt-4 rounded-xl border border-dashed border-line-2 p-3">
          <div className="mb-2 flex items-center gap-2 text-[0.72rem] font-bold tracking-widest text-ink-3">향후 확장 <NextBadge /></div>
          {NEXT_FEATURES.map((f) => (
            <button key={f.key} onClick={() => openNext(f.key)} className="pressable flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[0.88rem] text-ink-2 hover:bg-surface-2">
              {f.title} <ChevronRight size={14} className="text-ink-3" />
            </button>
          ))}
        </div>
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
        <main className={cx("mx-auto w-full max-w-[1720px] px-4 py-5 md:px-6 md:py-7", isMobile && "pb-24")}>{ready ? children : <PageSkeleton />}</main>
      </div>
      <MobileNav />
      <MoreSheet />
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
