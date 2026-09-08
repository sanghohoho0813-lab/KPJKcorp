"use client";

import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtDateTime, fmtSize } from "@/lib/format";
import { Badge, Card, EmptyState, IconTile, PageHeader } from "@/components/ui/ui";

export default function ResultsPage() {
  const st = useStore();
  const results = [...st.results].sort((a, b) => b.sharedAt.localeCompare(a.sharedAt));
  const viewed = (id: string) => st.activities.filter((a) => a.type === "result_downloaded" && a.text.includes(st.results.find((r) => r.id === id)?.name ?? "§")).length;
  return (
    <div>
      <PageHeader title="결과자료" desc="고객에게 공유한 보고서·제안서·분석자료입니다. 공유 시 고객 Portal 완료자료에 표시되고 알림이 전송됩니다." badge={<Badge>{results.length}건</Badge>} />
      {results.length === 0 ? <Card><EmptyState icon={<FileCheck2 size={30} />} title="공유된 결과자료가 없습니다" desc="프로젝트 상세에서 '결과자료 공유'로 등록할 수 있습니다." /></Card> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {results.map((r) => (
            <Card key={r.id} className="flex items-start gap-3 p-4">
              <IconTile color="var(--mod-evidence)"><FileCheck2 size={18} /></IconTile>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="truncate font-bold">{r.name}</span><Badge>{r.kind}</Badge></div>
                <div className="mt-0.5 text-[0.85rem] text-ink-2">{r.description}</div>
                <div className="mt-1.5 text-[0.75rem] text-ink-3"><Link href={`/ax/clients/${r.companyId}`} className="hover:text-accent">{st.companies.find((c) => c.id === r.companyId)?.name}</Link> · {st.projects.find((p) => p.id === r.projectId)?.name}</div>
                <div className="mt-0.5 text-[0.75rem] text-ink-3">{fmtDateTime(r.sharedAt)} · {fmtSize(r.size)} · {st.users.find((u) => u.id === r.sharedBy)?.name} · 고객 열람 {viewed(r.id)}회</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
