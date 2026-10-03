"use client";

import { useStore, usePortalCompanyId } from "@/lib/store";
import { PageHeader } from "@/components/ui/ui";
import { useGrowth } from "@/components/domain/portal/GrowthBoard";
import { CompanyFacts, CompanySnapshot, GrowthQuests } from "@/components/domain/portal/CompanySnapshot";

/**
 * 우리 회사 — 숫자로 보는 현황(업력·매출 추이·임직원·계약 일차) · 성장 체크리스트 전체 · 회사 기본 정보(복사).
 * 내부 메모·대표자 생년월일·주주 구성 같은 내부 칸은 보이지 않는다(lib/company-snapshot 의 clientFacts).
 */
export default function PortalCompanyPage() {
  const companyId = usePortalCompanyId();
  const c = useStore((s) => s.companies.find((x) => x.id === companyId));
  const board = useGrowth(c);
  if (!c || !board) return null;
  return (
    <div className="space-y-5">
      <PageHeader title="우리 회사" desc="회사 현황을 숫자로 보고, 다음에 할 일을 하나씩 점검해 나갑니다." />
      <CompanySnapshot company={c} board={board} showFactsLink={false} />
      <GrowthQuests company={c} board={board} />
      <CompanyFacts company={c} />
    </div>
  );
}
