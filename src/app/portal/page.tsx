"use client";

import Link from "next/link";
import { Pin } from "lucide-react";
import { useStore, usePortalCompanyId, useCurrentUser } from "@/lib/store";
import { Card } from "@/components/ui/ui";
import { GrowthHistory, NextGrowth, NowActions, useGrowth } from "@/components/domain/portal/GrowthBoard";
import { GrowthJourney, PortalHero, PortalHub, ProgramsPreview, RecentUpdates } from "@/components/domain/portal/PortalHome";
import { NoticeList, liveNoticesFor } from "@/components/domain/Notices";
import { CompanySnapshot, GrowthQuests } from "@/components/domain/portal/CompanySnapshot";

/**
 * 고객 홈 — 우리 회사 성장 공간.
 * 위에서부터: 우리 회사 현재 상태(담당 컨설턴트·다음 일정) → 우리 회사 한눈에(숫자) → 성장 퀘스트 → 성장 플랫폼 메뉴판 → 지금 할 일 · 최근 안내
 * → 성장 여정(완료→진행→다음) → 맞는 지원사업 → 다음으로 검토할 과제 → 완료 이력.
 */
export default function PortalHome() {
  const st = useStore();
  const companyId = usePortalCompanyId();
  const user = useCurrentUser();
  const c = st.companies.find((x) => x.id === companyId);
  // 성장과제 판 — 기업정보·프로젝트·제안·요청자료·견적·결과·일정을 한 흐름으로 (lib/growth)
  const board = useGrowth(c);
  if (!c || !board) return null;
  const isClient = st.session?.role === "client";
  const displayName = isClient ? `${user?.name} ${user?.title}` : `${c.contactName} ${c.contactTitle}`;
  const now = new Date().toISOString();
  // 고정 공지는 맨 위 — 담당자가 "꼭 읽어 주세요"라고 표시한 것이다
  const pinned = liveNoticesFor(st.notices, c.id, now).filter((n) => n.pinned);

  return (
    <div className="space-y-5 md:space-y-6">
      {pinned.length > 0 && (
        <Card className="p-4 md:p-5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[0.95rem] font-bold"><Pin size={16} className="text-accent" /> 담당자 공지</span>
            <Link href="/portal/schedule#notices" className="link-more">전체 보기 →</Link>
          </div>
          <NoticeList items={pinned} limit={2} compact />
        </Card>
      )}
      <PortalHero company={c} board={board} displayName={displayName} />
      {/* 우리 회사 한눈에 — 업력·매출 추이·임직원·계약 일차를 숫자로, 그다음 할 일을 퀘스트로 */}
      <CompanySnapshot company={c} board={board} />
      <GrowthQuests company={c} board={board} limit={4} />
      <PortalHub company={c} board={board} />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <NowActions actions={board.actions} companyId={c.id} />
        <RecentUpdates companyId={c.id} />
      </div>
      <GrowthJourney board={board} />
      <ProgramsPreview company={c} />
      <NextGrowth board={board} companyId={c.id} />
      <GrowthHistory board={board} companyId={c.id} />
    </div>
  );
}
