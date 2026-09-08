"use client";

import { useRouter } from "next/navigation";
import { HelpCircle, LogOut, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useStore, usePortalCompanyId, useCurrentUser } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { fmtDate } from "@/lib/format";
import { Avatar, Button, Card, PageHeader, SegmentedControl, DemoBadge } from "@/components/ui/ui";

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

  return (
    <div>
      <PageHeader title="내 정보" desc="계정·회사 정보와 화면 설정입니다." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-4"><Avatar name={name ?? "K"} size={56} /><div><div className="text-[1.2rem] font-bold">{name} {title}</div><div className="text-[0.88rem] text-ink-2">{c.name}</div></div></div>
          <dl className="mt-5 space-y-2 text-[0.9rem]">
            <div className="flex items-center gap-2"><Mail size={15} className="text-ink-3" /><dd>{email}</dd></div>
            <div className="flex items-center gap-2"><Phone size={15} className="text-ink-3" /><dd>{c.contactPhone}</dd></div>
            <div className="flex items-center gap-2"><UserRound size={15} className="text-ink-3" /><dd>담당 컨설턴트: {consultant?.name} {consultant?.title} · {consultant?.email}</dd></div>
          </dl>
          <div className="mt-5 rounded-xl bg-surface-2 p-4 text-[0.85rem]">
            <div className="font-bold">회사 정보</div>
            <div className="mt-1 grid grid-cols-2 gap-1 text-ink-2"><span>대표 {c.ceo}</span><span>업종 {c.industry}</span><span>사업자번호 {c.bizNo}</span><span>첫 상담 {fmtDate(c.firstConsultDate, { year: true })}</span></div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[0.8rem] text-ink-3"><ShieldCheck size={14} /> 귀사의 프로젝트·자료·일정·문의만 표시됩니다. 다른 기업의 정보는 접근할 수 없습니다.</div>
        </Card>
        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-3 font-bold">화면 설정</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div><div className="mb-1.5 text-[0.85rem] font-semibold text-ink-2">글자 크기</div><SegmentedControl value={settings.fontScale} onChange={(k) => setSettings({ fontScale: k })} options={[{ key: "small", label: "작게" }, { key: "base", label: "기본" }, { key: "large", label: "크게" }]} /></div>
              <div><div className="mb-1.5 text-[0.85rem] font-semibold text-ink-2">모션 줄이기</div><SegmentedControl value={settings.reduceMotion ? "on" : "off"} onChange={(k) => setSettings({ reduceMotion: k === "on" })} options={[{ key: "off", label: "Off" }, { key: "on", label: "On" }]} /></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" icon={<HelpCircle size={15} />} onClick={() => openTutorial("portal")}>이용 안내 다시 보기</Button>
              {isClient && <Button variant="ghost" size="sm" icon={<LogOut size={15} />} onClick={() => { logout(); router.push("/login"); }}>로그아웃</Button>}
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-2 flex items-center gap-2 font-bold">이용 현황 <DemoBadge /></div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-surface-2 p-3"><div className="tnum text-[1.4rem] font-bold">{logins}</div><div className="text-[0.75rem] text-ink-3">Portal 접속</div></div>
              <div className="rounded-xl bg-surface-2 p-3"><div className="tnum text-[1.4rem] font-bold">{st.activities.filter((a) => a.type === "document_uploaded" && a.companyId === c.id).length}</div><div className="text-[0.75rem] text-ink-3">자료 제출</div></div>
              <div className="rounded-xl bg-surface-2 p-3"><div className="tnum text-[1.4rem] font-bold">{st.inquiries.filter((i) => i.companyId === c.id).length}</div><div className="text-[0.75rem] text-ink-3">문의</div></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
