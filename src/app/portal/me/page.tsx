"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, HelpCircle, LogOut, Mail, MessageSquare, Phone } from "lucide-react";
import { FontScalePicker } from "@/components/shell/FontScale";
import { useStore, usePortalCompanyId, useCurrentUser } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { fmtDate } from "@/lib/format";
import { MyPasswordForm } from "@/components/domain/MyPassword";
import { Avatar, Button, Card, SegmentedControl, DemoBadge } from "@/components/ui/ui";
import { Icon3D, PORTAL_ICON } from "@/components/domain/portal/Icon3D";

export default function PortalMePage() {
  const st = useStore();
  const companyId = usePortalCompanyId();
  const user = useCurrentUser();
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const logout = useStore((s) => s.logout);
  const openTutorial = useUi((s) => s.openTutorial);
  const router = useRouter();
  const c = st.companies.find((x) => x.id === companyId);
  if (!c) return null;
  const isClient = st.session?.role === "client";
  const name = isClient ? user?.name : c.contactName;
  const title = isClient ? user?.title : c.contactTitle;
  const email = isClient ? user?.email : c.contactEmail;
  const consultant = st.users.find((u) => u.id === c.consultantId);
  const logins = st.activities.filter((a) => a.type === "portal_login" && a.companyId === c.id).length;

  // 아래 탭에 없는 화면은 여기서 — 앱의 "내 정보" 메뉴처럼 한 줄씩
  const menu = [
    { href: "/portal/company", label: "우리 회사 정보" },
    { href: "/portal/schedule", label: "일정 · 공지" },
    { href: "/portal/results", label: "완료자료" },
    { href: "/portal/programs", label: "지원사업" },
    { href: "/portal/services", label: "함께 검토" },
    { href: "/portal/notifications", label: "알림" },
  ];

  return (
    <div>
      <h1 className="sr-only">내 정보</h1>
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="space-y-5">
          {/* 머리 — 브랜드 색 카드에 이름·회사 */}
          <section className="portal-hero-bg relative overflow-hidden rounded-[1.75rem] p-5 text-white md:p-6" data-testid="me-profile">
            <div className="relative flex items-center gap-4">
              <Avatar name={name ?? "K"} size={58} className="ring-4 ring-white/20" />
              <div className="min-w-0">
                <div className="truncate text-[1.25rem] font-extrabold">{name} {title}</div>
                <div className="truncate text-[0.88rem] text-white/85">{c.name}</div>
              </div>
            </div>
            <dl className="relative mt-4 space-y-1.5 text-[0.85rem] text-white/90">
              {email && <div className="flex items-center gap-2"><Mail size={14} className="shrink-0 text-white/70" /><dd className="truncate">{email}</dd></div>}
              {c.contactPhone && <div className="flex items-center gap-2"><Phone size={14} className="shrink-0 text-white/70" /><dd>{c.contactPhone}</dd></div>}
            </dl>
          </section>

          {/* 담당 컨설턴트 */}
          {consultant && (
            <Card className="flex items-center gap-3 p-4">
              <Avatar name={consultant.name} size={44} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[0.72rem] font-bold text-ink-3">담당 컨설턴트</div>
                <div className="truncate font-bold">{consultant.name} {consultant.title}</div>
                <div className="truncate text-[0.78rem] text-ink-3">{consultant.email}</div>
              </div>
              {consultant.phone && <a href={`tel:${consultant.phone.replace(/[^0-9+]/g, "")}`} aria-label="담당 컨설턴트에게 전화" className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-2"><Phone size={17} /></a>}
              <Link href="/portal/inquiries" aria-label="문의하기" className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink"><MessageSquare size={17} /></Link>
            </Card>
          )}

          {/* 메뉴 */}
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line" data-testid="me-menu">
              {menu.map((m) => (
                <li key={m.href}>
                  <Link href={m.href} className="pressable flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2/70">
                    <Icon3D name={PORTAL_ICON[m.href]} size="2.1rem" />
                    <span className="flex-1 font-semibold">{m.label}</span>
                    <ChevronRight size={17} className="text-ink-3" />
                  </Link>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => openTutorial("portal")} className="pressable flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2/70">
                  <span className="flex h-[2.1rem] w-[2.1rem] shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2"><HelpCircle size={18} /></span>
                  <span className="flex-1 font-semibold">이용 안내 다시 보기</span>
                  <ChevronRight size={17} className="text-ink-3" />
                </button>
              </li>
            </ul>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="font-bold">회사 정보</div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[0.85rem] text-ink-2"><span>대표 {c.ceo}</span><span>업종 {c.industry}</span><span>사업자번호 {c.bizNo}</span><span>첫 상담 {fmtDate(c.firstConsultDate, { year: true })}</span></div>
            <div className="mt-3 flex items-center gap-2 text-[0.8rem] text-ink-3"><Icon3D name="secure" size="1.6rem" /> 귀사의 프로젝트·자료·일정·문의만 표시됩니다. 다른 기업의 정보는 접근할 수 없습니다.</div>
          </Card>
          {isClient && (
            <Card className="p-5">
              <div className="mb-3 font-bold">비밀번호 바꾸기</div>
              <MyPasswordForm />
            </Card>
          )}
          <Card className="p-5">
            <div className="mb-3 font-bold">화면 설정</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div><div className="mb-1.5 text-[0.85rem] font-semibold text-ink-2">글자 크기</div><FontScalePicker /></div>
              <div><div className="mb-1.5 text-[0.85rem] font-semibold text-ink-2">모션 줄이기</div><SegmentedControl value={settings.reduceMotion ? "on" : "off"} onChange={(k) => setSettings({ reduceMotion: k === "on" })} options={[{ key: "off", label: "Off" }, { key: "on", label: "On" }]} /></div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-2 flex items-center gap-2 font-bold">이용 현황 <DemoBadge /></div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-surface-2 p-3"><div className="tnum text-[1.4rem] font-bold">{logins}</div><div className="text-[0.75rem] text-ink-3">Portal 접속</div></div>
              <div className="rounded-2xl bg-surface-2 p-3"><div className="tnum text-[1.4rem] font-bold">{st.activities.filter((a) => a.type === "document_uploaded" && a.companyId === c.id).length}</div><div className="text-[0.75rem] text-ink-3">자료 제출</div></div>
              <div className="rounded-2xl bg-surface-2 p-3"><div className="tnum text-[1.4rem] font-bold">{st.inquiries.filter((i) => i.companyId === c.id).length}</div><div className="text-[0.75rem] text-ink-3">문의</div></div>
            </div>
          </Card>
          {isClient && <Button variant="outline" full icon={<LogOut size={16} />} onClick={() => { logout(); router.push("/login"); }}>로그아웃</Button>}
        </div>
      </div>
    </div>
  );
}
