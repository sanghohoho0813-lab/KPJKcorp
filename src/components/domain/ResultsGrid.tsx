"use client";

import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtDateTime, fmtSize } from "@/lib/format";
import { Badge, Card, EmptyState, IconTile } from "@/components/ui/ui";

/** 고객에게 공유한 결과자료 목록. 자료관리 탭과 /ax/results 양쪽에서 같은 것을 쓴다. */
export function ResultsGrid() {
  const st = useStore();
  const results = [...st.results].sort((a, b) => b.sharedAt.localeCompare(a.sharedAt));
  const viewed = (name: string) => st.activities.filter((a) => a.type === "result_downloaded" && a.text.includes(name)).length;

  if (results.length === 0) {
    return (
      <Card>
        <EmptyState icon={<FileCheck2 size={30} />} title="공유된 결과자료가 없습니다" desc="프로젝트 상세에서 '결과자료 공유'로 등록할 수 있습니다." />
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {results.map((r) => (
        <Card key={r.id} className="flex items-start gap-3 p-4">
          <IconTile color="var(--mod-evidence)"><FileCheck2 size={18} /></IconTile>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><span className="truncate font-bold">{r.name}</span><Badge>{r.kind}</Badge></div>
            <div className="mt-0.5 text-[0.85rem] text-ink-2">{r.description}</div>
            <div className="mt-1.5 text-[0.75rem] text-ink-3">
              <Link href={`/ax/clients/${r.companyId}`} className="hover:text-accent">{st.companies.find((c) => c.id === r.companyId)?.name}</Link> · {st.projects.find((p) => p.id === r.projectId)?.name}
            </div>
            <div className="mt-0.5 text-[0.75rem] text-ink-3">{fmtDateTime(r.sharedAt)} · {fmtSize(r.size)} · {st.users.find((u) => u.id === r.sharedBy)?.name} · 고객 열람 {viewed(r.name)}회</div>
          </div>
        </Card>
      ))}
    </div>
  );
}
