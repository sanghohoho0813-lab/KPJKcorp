"use client";

import { Download, FileCheck2 } from "lucide-react";
import { useStore, usePortalCompanyId } from "@/lib/store";
import { fmtDate, fmtSize } from "@/lib/format";
import { Badge, Button, Card, EmptyState, IconTile, PageHeader } from "@/components/ui/ui";

export default function PortalResultsPage() {
  const st = useStore();
  const companyId = usePortalCompanyId();
  const download = useStore((s) => s.downloadResult);
  const toast = useStore((s) => s.toast);
  const results = st.results.filter((r) => r.companyId === companyId).sort((a, b) => b.sharedAt.localeCompare(a.sharedAt));
  const open = (id: string) => {
    download(id, st.session?.userId ?? "c_a");
    toast("열람 기록이 저장되었습니다. (데모: 실제 파일은 운영 시 안전한 저장소에서 제공됩니다)", "info");
  };
  return (
    <div>
      <PageHeader title="완료자료" desc="담당 컨설턴트가 전달한 보고서·제안서·분석자료를 확인합니다." badge={<Badge>{results.length}건</Badge>} />
      {results.length === 0 ? <Card><EmptyState icon={<FileCheck2 size={30} />} title="아직 전달된 결과자료가 없습니다" desc="결과자료가 공유되면 알림으로 안내드립니다." /></Card> : (
        <div className="grid gap-3 md:grid-cols-2">
          {results.map((r) => (
            <Card key={r.id} className="flex items-start gap-3 p-5">
              <IconTile color="var(--mod-evidence)" size={44}><FileCheck2 size={20} /></IconTile>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-bold">{r.name}</span><Badge>{r.kind}</Badge></div>
                <div className="mt-0.5 text-[0.85rem] text-ink-2">{r.description}</div>
                <div className="mt-1 text-[0.75rem] text-ink-3">{st.projects.find((p) => p.id === r.projectId)?.name} · {fmtDate(r.sharedAt, { year: true })} · {fmtSize(r.size)} · {st.users.find((u) => u.id === r.sharedBy)?.name}</div>
                <Button size="sm" variant="outline" className="mt-3" icon={<Download size={14} />} onClick={() => open(r.id)}>열람 / 다운로드</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
