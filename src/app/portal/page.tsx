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
 * 대표가 매일 들어와 1분 안에 보는 순서: 우리 회사 현재 상태(담당 컨설턴트·다음 일정) → 우리 회사 한눈에(매출·업력·임직원·인증)
 * → 성장 체크리스트 | 지금 할 일 · 최근 안내 → 성장 여정(완료→진행→다음 검토) → 앞으로 검토할 과제(근거) → 맞는 지원사업
 * → 완료한 성장과제 · 진행 이력 → 성장 플랫폼 메뉴판.
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
      {/* 우리 회사 한눈에 — 최근 매출·업력·임직원·보유 인증을 큰 숫자로, 아래에 매출 추이와 인증 현황 */}
      <CompanySnapshot company={c} board={board} />
      {/* 다음 단계 — 왼쪽: 성장 체크리스트 / 오른쪽: 지금 할 일 · 최근 안내 */}
      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <GrowthQuests company={c} board={board} limit={3} />
        <div className="space-y-5">
          <NowActions actions={board.actions} companyId={c.id} />
          <RecentUpdates companyId={c.id} />
        </div>
      </div>
      <GrowthJourney board={board} />
      {/* 앞으로 검토하면 좋은 과제 — 근거(기업정보·진행 이력)와 함께 */}
      <NextGrowth board={board} companyId={c.id} />
      <ProgramsPreview company={c} />
      {/* 우리 회사가 어떻게 운영되고 있는지 — 완료한 과제와 최근 진행 이력(단계 변경·검토 완료·결과 공유) */}
      <GrowthHistory board={board} companyId={c.id} />
      <PortalHub company={c} board={board} />
    </div>
  );
}
