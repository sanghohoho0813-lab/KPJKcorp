"use client";

import { useStore } from "@/lib/store";
import { Badge, PageHeader } from "@/components/ui/ui";
import { ResultsGrid } from "@/components/domain/ResultsGrid";

/**
 * 결과자료는 자료관리(/ax/documents?tab=results) 안으로 들어갔지만,
 * 기존 링크와 기업고객 카드에서 넘어오는 경로를 위해 단독 화면도 유지한다.
 */
export default function ResultsPage() {
  const results = useStore((s) => s.results);
  return (
    <div>
      <PageHeader title="결과자료" desc="고객에게 공유한 보고서·제안서·분석자료입니다. 공유 시 고객 Portal 완료자료에 표시되고 알림이 전송됩니다." badge={<Badge>{results.length}건</Badge>} />
      <ResultsGrid />
    </div>
  );
}
