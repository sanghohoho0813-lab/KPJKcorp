"use client";

import { Download, FileCheck2 } from "lucide-react";
import { useStore, usePortalCompanyId } from "@/lib/store";
import { fmtDate, fmtSize } from "@/lib/format";
import { RESULT_BUCKET, saveToDisk } from "@/lib/server/storage";
import type { ResultFile } from "@/lib/types";
import { Badge, Button, Card, EmptyState, IconTile, PageHeader } from "@/components/ui/ui";

export default function PortalResultsPage() {
  const st = useStore();
  const companyId = usePortalCompanyId();
  const download = useStore((s) => s.downloadResult);
  const toast = useStore((s) => s.toast);
  const results = st.results.filter((r) => r.companyId === companyId).sort((a, b) => b.sharedAt.localeCompare(a.sharedAt));
  const open = async (r: ResultFile) => {
    if (r.storagePath) {
      const got = await saveToDisk(RESULT_BUCKET, r.storagePath, r.name);
      if (!got.ok) { toast(got.reason ?? "파일을 열지 못했습니다.", "error"); return; }
      // 열람 기록은 내려받기가 실제로 시작된 뒤에 남긴다 — 실패한 시도를 열람으로 세지 않는다.
      download(r.id, st.session?.userId ?? "");
      return;
    }
    download(r.id, st.session?.userId ?? "");
    toast("열람 기록이 저장되었습니다. (이 자료는 파일 없이 공유되었습니다 — 담당자에게 문의해 주세요)", "info");
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
                <div className="mt-1 text-[0.75rem] text-ink-3">{st.projects.find((p) => p.id === r.projectId)?.name} · {fmtDate(r.sharedAt, { year: true })}{r.size > 0 ? ` · ${fmtSize(r.size)}` : ""} · {st.users.find((u) => u.id === r.sharedBy)?.name}</div>
                <Button size="sm" variant="outline" className="mt-3" icon={<Download size={14} />} onClick={() => void open(r)}>열람 / 다운로드</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
