"use client";

import { useStore, usePortalCompanyId, useCurrentUser } from "@/lib/store";
import { GrowthHistory, NextGrowth, NowActions, useGrowth, useGrowthHistory } from "@/components/domain/portal/GrowthBoard";
import { PinnedStrip, PortalHero, PortalHub, ProgramsPreview, RecentUpdates } from "@/components/domain/portal/PortalHome";
import { liveNoticesFor } from "@/components/domain/Notices";
import { CompanySnapshot, GrowthQuests } from "@/components/domain/portal/CompanySnapshot";

/**
 * 고객 홈 — 우리 회사 성장 공간.
 * 대표가 휴대폰으로 1분 안에 보는 순서: 브랜드 머리(진행 추적·담당 컨설턴트) → 아이콘 메뉴 → 고정 공지 → 지금 해야 할 일 · 최근 안내
 * → 맞는 지원사업(옆으로 넘김) → 우리 회사 한눈에(숫자) → 성장 체크리스트 → 다음으로 검토할 과제(근거) → 완료한 과제·이력.
 * 같은 목록을 두 번 두지 않는다 — 진행 중은 위 카드, 다음 검토는 과제 카드, 완료는 이력에만.
 */
export default function PortalHome() {
  const st = useStore();
  const companyId = usePortalCompanyId();
  const user = useCurrentUser();
  const c = st.companies.find((x) => x.id === companyId);
  // 성장과제 판 — 기업정보·프로젝트·제안·요청자료·견적·결과·일정을 한 흐름으로 (lib/growth)
  const board = useGrowth(c);
  const history = useGrowthHistory(companyId ?? "");
  if (!c || !board) return null;
  const isClient = st.session?.role === "client";
  const displayName = isClient ? `${user?.name} ${user?.title}` : `${c.contactName} ${c.contactTitle}`;
  const now = new Date().toISOString();
  // 고정 공지는 맨 위 — 담당자가 "꼭 읽어 주세요"라고 표시한 것이다
  const pinned = liveNoticesFor(st.notices, c.id, now).filter((n) => n.pinned);
  // PC: 체크리스트 옆에 이력 — 이력이 없으면 체크리스트를 넓게
  const hasHistory = board.completed.length > 0 || history.length > 0;

  return (
    <div className="space-y-5 md:space-y-6">
      {/* 앱 첫 화면 순서: 브랜드 머리(진행 추적·담당자) → 아이콘 메뉴(휴대폰) → 고정 공지 한 줄 → 지금 할 일 */}
      <PortalHero company={c} board={board} displayName={displayName} />
      <PortalHub company={c} board={board} />
      {pinned.length > 0 && <PinnedStrip title={pinned[0].title} more={pinned.length - 1} />}
      {/* 먼저 할 일 — 왼쪽: 지금 해야 할 일 / 오른쪽: 최근 안내 */}
      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <NowActions actions={board.actions} companyId={c.id} />
        <RecentUpdates companyId={c.id} />
      </div>
      {/* 맞는 지원사업 — 실제 공고만. 휴대폰은 옆으로 넘기는 카드 */}
      <div className="empty:hidden"><ProgramsPreview company={c} /></div>
      {/* 우리 회사 한눈에 — 최근 매출·업력·임직원·보유 인증. 휴대폰에서는 매출 막대·인증 목록을 접어 둔다 */}
      <CompanySnapshot company={c} board={board} collapsible />
      {/* 휴대폰: 체크리스트 → 다음 검토 과제 → 이력 / PC: 체크리스트 | 이력, 그 아래 다음 검토 과제 */}
      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <div className={hasHistory ? "lg:col-start-1 lg:row-start-1" : "lg:col-span-2"}><GrowthQuests company={c} board={board} limit={3} /></div>
        <div className="lg:col-span-2"><NextGrowth board={board} companyId={c.id} /></div>
        {hasHistory && <div className="lg:col-start-2 lg:row-start-1"><GrowthHistory board={board} companyId={c.id} /></div>}
      </div>
    </div>
  );
}
