"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Briefcase, CalendarDays, Eye, FileCheck2, FolderUp, HelpCircle, Home, LayoutDashboard, LogOut, MessageSquare, Sparkles, UserRound, ChevronRight } from "lucide-react";
import { useStore, useCurrentUser, usePortalCompanyId } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { useIsMobile, useIsPreviewFrame } from "@/lib/hooks";
import { NotificationBell } from "./Notifications";
import { DevicePreviewButton, DevicePreviewOverlay } from "./DevicePreview";
import { Tutorial } from "./Tutorial";
import { FontScaleStepper } from "./FontScale";
import { Presentation } from "./Presentation";
import { Toaster } from "@/components/ui/Toaster";
import { Modal } from "@/components/ui/overlay";
import { Avatar, PageSkeleton, cx } from "@/components/ui/ui";
import { AiReadyModal, DraftModal } from "@/components/ai/AiModals";

const NAV = [
  { href: "/portal", label: "홈", icon: <Home size={20} /> },
  { href: "/portal/projects", label: "내 프로젝트", icon: <Briefcase size={20} /> },
  { href: "/portal/documents", label: "요청자료", icon: <FolderUp size={20} /> },
  { href: "/portal/schedule", label: "일정", icon: <CalendarDays size={20} /> },
  { href: "/portal/results", label: "완료자료", icon: <FileCheck2 size={20} /> },
  { href: "/portal/services", label: "함께 검토", icon: <Sparkles size={20} /> },
  { href: "/portal/inquiries", label: "문의하기", icon: <MessageSquare size={20} /> },
  { href: "/portal/notifications", label: "알림", icon: <Bell size={20} /> },
  { href: "/portal/me", label: "내 정보", icon: <UserRound size={20} /> },
];

function isActive(pathname: string, href: string) {
  return href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);
}

function PreviewBar({ companyName }: { companyName: string }) {
  const companies = useStore((s) => s.companies);
  const setPreview = useStore((s) => s.setPortalPreview);
  const [pick, setPick] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between gap-2 bg-shell px-4 py-2 text-[0.8rem] text-white md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 whitespace-nowrap rounded-md bg-accent px-1.5 py-0.5 text-[0.65rem] font-bold text-accent-ink">미리보기</span>
          <span className="truncate"><span className="hidden sm:inline">고객이 보는 화면입니다 · </span><b>{companyName}</b></span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => setPick(true)} className="pressable whitespace-nowrap rounded-md px-2 py-1 font-semibold text-shell-text-2 hover:bg-white/10">기업 변경</button>
          <Link href="/ax/dashboard" className="pressable flex items-center gap-1 whitespace-nowrap rounded-md bg-white/10 px-2.5 py-1 font-semibold hover:bg-white/20">
            <LayoutDashboard size={14} /> <span className="hidden sm:inline">Business AX 보기</span><span className="sm:hidden">AX</span>
          </Link>
        </div>
      </div>
      <Modal open={pick} onClose={() => setPick(false)} title="미리보기 기업 변경" size="sm">
        <div className="space-y-1.5">
          {companies.map((c) => (
            <button key={c.id} onClick={() => { setPreview(c.id); setPick(false); }} className="pressable flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-left hover:bg-surface-2">
              <span className="font-semibold">{c.name}</span>
              <ChevronRight size={16} className="text-ink-3" />
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);
  const session = useStore((s) => s.session);
  const settings = useStore((s) => s.settings);
  const setPreview = useStore((s) => s.setPortalPreview);
  const logout = useStore((s) => s.logout);
  const companies = useStore((s) => s.companies);
  const user = useCurrentUser();
  const companyId = usePortalCompanyId();
  const company = companies.find((c) => c.id === companyId);
  const openTutorial = useUi((s) => s.openTutorial);
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const inFrame = useIsPreviewFrame();

  useEffect(() => {
    if (!hydrated) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (session.role !== "client" && !session.portalPreviewCompanyId) setPreview("co_a");
  }, [hydrated, session, router, setPreview]);

  // First-run tutorial — only auto-opens on the portal home so it never pulls the user away from another screen.
  useEffect(() => {
    if (!hydrated || !session || session.role !== "client" || inFrame) return;
    if (!settings.tutorialDonePortal && pathname === "/portal") {
      const t = setTimeout(() => openTutorial("portal"), 600);
      return () => clearTimeout(t);
    }
  }, [hydrated, session, settings.tutorialDonePortal, inFrame, openTutorial, pathname]);

  const isInternal = session && session.role !== "client";
  const ready = hydrated && session && company;
  const btn = "pressable flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-[0.82rem] font-semibold text-ink-2 hover:bg-surface-2";

  return (
    <div className="min-h-screen bg-canvas">
      {isInternal && company && <PreviewBar companyName={company.name} />}
      {isInternal && (
        <div className="flex items-center gap-2 border-b border-warning/30 bg-warning-bg px-4 py-2 text-[0.8rem] font-semibold text-warning md:px-6">
          <Eye size={14} className="shrink-0" />
          <span>읽기 전용 미리보기입니다. 자료 제출·문의·회신은 고객 계정으로만 할 수 있습니다.</span>
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        {/* 글자 크기를 키우면 이 줄의 모든 요소가 같이 넓어진다. 줄일 수 있는 것(로고 문구·메뉴)은
            줄어들게 하고, 줄이면 안 되는 것(알림·계정)에만 shrink-0을 준다. */}
        <div className="mx-auto flex h-[var(--header-h)] max-w-[1280px] items-center gap-2 px-4 md:gap-3 md:px-6">
          <Link href="/portal" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-shell text-[0.65rem] font-black text-white">KPJK</span>
            <span className="truncate text-[1rem] font-bold"><span className="hidden xl:inline">KPJK Consulting </span>Portal</span>
          </Link>
          <nav className="ml-2 hidden min-w-0 items-center gap-0.5 overflow-hidden lg:flex">
            {NAV.slice(0, 7).map((n) => (
              <Link key={n.href} href={n.href} className={cx("pressable lift whitespace-nowrap rounded-lg px-2.5 py-2 text-[0.85rem] font-semibold transition-colors", isActive(pathname, n.href) ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex-1" />
          {/* 고객 화면에서도 글자 크기는 바로 바꿀 수 있어야 한다 — 대표님들 연령대가 넓다. */}
          <FontScaleStepper className="mr-1 shrink-0" />
          <div className="hidden shrink-0 items-center gap-1 lg:flex">
            <DevicePreviewButton className={cx(btn, "hdr-optional")} labelClass="hidden 2xl:inline" />
            {!inFrame && (
              <button onClick={() => openTutorial("portal")} className={btn} title="이용 안내" aria-label="이용 안내">
                <HelpCircle size={18} />
              </button>
            )}
          </div>
          <span className="shrink-0"><NotificationBell audience="client" companyId={companyId} /></span>
          <Link href="/portal/me" className="flex shrink-0 items-center gap-2 pl-1">
            <div className="hdr-optional hidden max-w-[180px] whitespace-nowrap text-right leading-tight sm:block">
              <div className="truncate text-[0.82rem] font-bold">{company?.name}</div>
              <div className="truncate text-[0.7rem] text-ink-3">{isInternal ? company?.contactName : user?.name} {isInternal ? company?.contactTitle : user?.title}</div>
            </div>
            <Avatar name={isInternal ? company?.contactName ?? "K" : user?.name ?? "K"} size={34} />
          </Link>
          {!isInternal && (
            <button onClick={() => { logout(); router.push("/login"); }} className="pressable hidden rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink lg:block" title="로그아웃" aria-label="로그아웃">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </header>
      <main className={cx("mx-auto w-full max-w-[1280px] px-4 py-5 md:px-6 md:py-8", isMobile && "pb-24")}>
        {ready ? <div key={pathname} className="anim-page">{children}</div> : <PageSkeleton />}
      </main>

      {/* Mobile bottom nav: 홈 / 진행현황 / 자료제출 / 문의 / MY */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface lg:hidden">
        {[
          { href: "/portal", label: "홈", icon: <Home size={22} /> },
          { href: "/portal/projects", label: "진행현황", icon: <Briefcase size={22} /> },
          { href: "/portal/documents", label: "자료제출", icon: <FolderUp size={22} /> },
          { href: "/portal/inquiries", label: "문의", icon: <MessageSquare size={22} /> },
          { href: "/portal/me", label: "MY", icon: <UserRound size={22} /> },
        ].map((i) => (
          <Link key={i.href} href={i.href} className={cx("pressable flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.7rem] font-semibold", isActive(pathname, i.href) ? "text-accent" : "text-ink-3")}>
            {i.icon}
            {i.label}
          </Link>
        ))}
      </nav>
      <AiReadyModal />
      <DraftModal />
      <Tutorial />
      <Presentation />
      <DevicePreviewOverlay />
      <Toaster />
    </div>
  );
}

export const PORTAL_NAV = NAV;
