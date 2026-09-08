"use client";

import { useState } from "react";
import { FileText, FolderUp, Upload } from "lucide-react";
import { useStore, usePortalCompanyId } from "@/lib/store";
import { daysBetween, fmtDate, fmtDateTime, fmtSize, relativeDay } from "@/lib/format";
import type { DocumentRequest } from "@/lib/types";
import { Badge, Button, Card, EmptyState, KpiCard, PageHeader, SegmentedControl, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";
import { DocStatusBadge } from "@/components/domain/domain";
import { UploadModal } from "@/components/domain/DocActions";

export default function PortalDocumentsPage() {
  const st = useStore();
  const companyId = usePortalCompanyId();
  const [upload, setUpload] = useState<DocumentRequest | null>(null);
  const [view, setView] = useState<DocumentRequest | null>(null);
  const [filter, setFilter] = useState<"all" | "todo" | "done">("all");
  const now = new Date().toISOString();
  const docs = st.docRequests.filter((d) => d.companyId === companyId && d.status !== "planned");
  const todo = docs.filter((d) => d.status === "requested" || d.status === "revision");
  const submitted = docs.filter((d) => d.status === "submitted");
  const reviewing = docs.filter((d) => d.status === "reviewing");
  const revision = docs.filter((d) => d.status === "revision");
  const order = { revision: 0, requested: 1, submitted: 2, reviewing: 3, done: 4, planned: 5 } as const;
  const rows = docs.filter((d) => filter === "all" ? true : filter === "todo" ? d.status === "requested" || d.status === "revision" : d.status === "done" || d.status === "submitted" || d.status === "reviewing").sort((a, b) => order[a.status] - order[b.status] || a.dueDate.localeCompare(b.dueDate));

  return (
    <div>
      <PageHeader title="요청자료 제출" desc="검토에 필요한 파일을 상태별로 확인하고 업로드하세요. 제출하면 담당 컨설턴트에게 바로 전달됩니다." actions={todo[0] && <Button variant="accent" icon={<Upload size={16} />} onClick={() => setUpload(todo[0])}>파일 업로드</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="미제출" value={todo.filter((d) => d.status === "requested").length} sub={todo.some((d) => daysBetween(d.dueDate, now) > 0) ? "기한 지난 자료 있음" : "기한 내"} tone={todo.length ? "error" : undefined} />
        <KpiCard label="제출완료" value={submitted.length + docs.filter((d) => d.status === "done").length} sub="담당자에게 전달됨" />
        <KpiCard label="검토중" value={reviewing.length} sub="담당 컨설턴트 확인 중" />
        <KpiCard label="보완필요" value={revision.length} sub="재제출 필요" tone={revision.length ? "error" : undefined} />
      </div>
      <div className="mb-4"><SegmentedControl size="sm" value={filter} onChange={setFilter} options={[{ key: "all", label: "전체" }, { key: "todo", label: `제출 필요 ${todo.length}` }, { key: "done", label: "제출됨" }]} /></div>
      <Card className="overflow-hidden" id="tut-p-docs">
        {rows.length === 0 ? <EmptyState icon={<FolderUp size={30} />} title="요청된 자료가 없습니다" desc="담당 컨설턴트가 자료를 요청하면 여기에 표시됩니다." /> : (
          <div className="divide-y divide-line">
            {rows.map((d) => {
              const overdue = (d.status === "requested" || d.status === "revision") && daysBetween(d.dueDate, now) > 0;
              const last = d.files[d.files.length - 1];
              return (
                <div key={d.id} className={cx("flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:px-5", overdue && "bg-error-bg/30")}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><DocStatusBadge status={d.status} client /><span className="font-bold">{d.name}</span></div>
                    {d.description && <div className="mt-0.5 text-[0.85rem] text-ink-2">{d.description}</div>}
                    {d.status === "revision" && d.reviewNote && <div className="mt-1.5 rounded-lg bg-error-bg px-3 py-2 text-[0.85rem] text-error"><b>보완 요청:</b> {d.reviewNote}</div>}
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[0.78rem] text-ink-3">
                      <span className={cx(overdue && "font-semibold text-error")}>기한 {fmtDate(d.dueDate)} ({relativeDay(d.dueDate)})</span>
                      {last && <span>제출 {fmtDateTime(last.uploadedAt)} · {last.fileName} ({fmtSize(last.size)})</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {(d.status === "requested") && <Button variant="accent" size="sm" icon={<Upload size={14} />} onClick={() => setUpload(d)}>업로드</Button>}
                    {d.status === "revision" && <Button variant="outline" size="sm" icon={<Upload size={14} />} onClick={() => setUpload(d)}>재제출</Button>}
                    {(d.status === "submitted" || d.status === "reviewing" || d.status === "done") && <Button variant="ghost" size="sm" icon={<FileText size={14} />} onClick={() => setView(d)}>{d.status === "done" ? "보기" : "확인"}</Button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <UploadModal req={upload} open={!!upload} onClose={() => setUpload(null)} />
      <Modal open={!!view} onClose={() => setView(null)} title={view?.name} size="sm">
        {view && (
          <div className="space-y-3 text-[0.9rem]">
            <div className="flex items-center gap-2"><DocStatusBadge status={view.status} client /><span className="text-ink-2">{view.status === "done" ? "담당자 확인이 완료된 자료입니다." : view.status === "reviewing" ? "담당 컨설턴트가 검토하고 있습니다." : "제출이 완료되어 담당자에게 전달되었습니다."}</span></div>
            <div><div className="mb-1 text-[0.8rem] font-bold text-ink-3">제출 파일</div>{view.files.map((f) => <div key={f.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-2"><span className="flex items-center gap-2 font-semibold"><FileText size={15} className="text-ink-3" />{f.fileName} <Badge>v{f.version}</Badge></span><span className="text-[0.8rem] text-ink-3">{fmtDateTime(f.uploadedAt)}</span></div>)}</div>
            {view.status !== "done" && <p className="text-[0.8rem] text-ink-3">추가 파일을 제출하려면 담당자에게 문의해 주세요.</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
