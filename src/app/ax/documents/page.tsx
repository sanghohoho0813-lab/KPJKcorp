"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BellRing, FolderOpen, MessageSquareText } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { daysBetween, fmtDate, fmtSize, relativeDay } from "@/lib/format";
import type { DocStatus, DocumentRequest } from "@/lib/types";
import { Badge, Button, Card, EmptyState, KpiCard, PageHeader, SegmentedControl, NextBadge, Tabs, cx } from "@/components/ui/ui";
import { ResultsGrid } from "@/components/domain/ResultsGrid";
import { Modal } from "@/components/ui/overlay";
import { DocStatusBadge, DueText, SearchBox } from "@/components/domain/domain";
import { ReviewDocModal } from "@/components/domain/DocActions";

type Filter = "all" | "missing" | "waiting" | "revision" | "done";

function DocumentsInner() {
  const st = useStore();
  const params = useSearchParams();
  const openDraft = useUi((s) => s.openDraft);
  const [top, setTop] = useState<"requests" | "results">(params.get("tab") === "results" ? "results" : "requests");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [remind, setRemind] = useState(false);
  const [review, setReview] = useState<DocumentRequest | null>(() => {
    const f = params.get("focus");
    return f ? st.docRequests.find((d) => d.id === f) ?? null : null;
  });
  const now = new Date().toISOString();
  const me = st.session?.role === "consultant" ? st.session.userId : undefined;

  const all = st.docRequests.filter((d) => !me || d.assigneeId === me);
  const counts = {
    missing: all.filter((d) => d.status === "requested").length,
    waiting: all.filter((d) => d.status === "submitted" || d.status === "reviewing").length,
    revision: all.filter((d) => d.status === "revision").length,
    done: all.filter((d) => d.status === "done").length,
    overdue: all.filter((d) => (d.status === "requested" || d.status === "revision") && daysBetween(d.dueDate, now) > 0).length,
  };

  const order: Record<DocStatus, number> = { requested: 0, revision: 1, submitted: 2, reviewing: 3, planned: 4, done: 5 };
  const rows = all
    .filter((d) => filter === "all" ? d.status !== "done" : filter === "missing" ? d.status === "requested" : filter === "waiting" ? d.status === "submitted" || d.status === "reviewing" : filter === "revision" ? d.status === "revision" : d.status === "done")
    .filter((d) => !q || d.name.includes(q) || (st.companies.find((c) => c.id === d.companyId)?.name ?? "").includes(q))
    .sort((a, b) => order[a.status] - order[b.status] || a.dueDate.localeCompare(b.dueDate));

  const remindTargets = all
    .filter((d) => (d.status === "requested" || d.status === "revision") && daysBetween(d.dueDate, now) >= -1)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div>
      <PageHeader title="자료관리" desc="고객이 Portal에서 제출한 자료가 여기에 도착합니다. 마감 임박·보완필요 항목을 먼저 처리하고, 완성된 결과자료는 결과자료 탭에서 공유 이력을 확인합니다." actions={top === "requests" ? <Button variant="primary" icon={<BellRing size={16} />} onClick={() => setRemind(true)}>리마인드 대상 {remindTargets.length}</Button> : undefined} />
      <Tabs tabs={[{ key: "requests", label: "요청자료", count: counts.missing + counts.waiting + counts.revision }, { key: "results", label: "결과자료", count: st.results.length }]} value={top} onChange={setTop} />
      {top === "results" ? <div className="mt-5"><ResultsGrid /><p className="mt-3 text-[0.8rem] text-ink-3">결과자료를 공유하면 고객 Portal 완료자료에 표시되고 알림이 전송됩니다. 등록은 프로젝트 상세에서 합니다.</p></div> : <>
      <div className="mb-5 mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="미제출" value={counts.missing} sub={counts.overdue ? `기한 초과 ${counts.overdue}` : "기한 초과 없음"} tone={counts.overdue ? "error" : undefined} />
        <KpiCard label="검토 대기 · 검토중" value={counts.waiting} sub="담당자 검토 필요" accentValue={counts.waiting > 0} />
        <KpiCard label="보완필요" value={counts.revision} sub="고객 재제출 대기" tone={counts.revision ? "error" : undefined} />
        <KpiCard label="완료" value={counts.done} sub="검토 완료" />
      </div>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="md:w-72"><SearchBox value={q} onChange={setQ} placeholder="자료명, 기업명 검색" /></div>
        <SegmentedControl size="sm" value={filter} onChange={setFilter} options={[{ key: "all", label: "진행 중" }, { key: "missing", label: "미제출" }, { key: "waiting", label: "검토 대기" }, { key: "revision", label: "보완필요" }, { key: "done", label: "완료" }]} />
      </div>
      <Card className="overflow-hidden">
        {rows.length === 0 ? <EmptyState icon={<FolderOpen size={30} />} title="해당 조건의 자료가 없습니다" /> : (
          <>
          {/* 모바일: 가로 스크롤 대신 한 건 = 한 카드 */}
          <div className="divide-y divide-line lg:hidden">
            {rows.map((d) => {
              const c = st.companies.find((x) => x.id === d.companyId);
              const consultant = st.users.find((u) => u.id === d.assigneeId);
              const overdue = (d.status === "requested" || d.status === "revision") && daysBetween(d.dueDate, now) > 0;
              return (
                <button key={d.id} onClick={() => setReview(d)} className={cx("pressable block w-full px-4 py-3 text-left", overdue && "bg-error-bg/30")}>
                  <div className="flex items-center gap-2"><DocStatusBadge status={d.status} /><span className="min-w-0 flex-1 line-clamp-2 font-semibold md:line-clamp-1">{d.name}</span></div>
                  <div className="mt-1 truncate text-[0.85rem] text-ink-2">{c?.name} · {st.projects.find((p) => p.id === d.projectId)?.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[0.78rem] text-ink-3">
                    <DueText iso={d.dueDate} pending={d.status === "requested" || d.status === "revision"} />
                    <span>담당 {consultant?.name}</span>
                    {d.files.length > 0 && <span className="truncate">{d.files[d.files.length - 1].fileName}</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="hidden lg:block">
            <table className="tbl">
              <thead><tr><th>기업명</th><th>자료명</th><th>프로젝트</th><th>상태</th><th>마감</th><th>제출</th><th>담당자</th><th></th></tr></thead>
              <tbody>
                {rows.map((d) => {
                  const c = st.companies.find((x) => x.id === d.companyId);
                  const consultant = st.users.find((u) => u.id === d.assigneeId);
                  const overdue = (d.status === "requested" || d.status === "revision") && daysBetween(d.dueDate, now) > 0;
                  return (
                    <tr key={d.id} className={cx("row-clickable", overdue && "bg-error-bg/30")} onClick={() => setReview(d)}>
                      <td className="font-semibold"><Link href={`/ax/clients/${d.companyId}`} onClick={(e) => e.stopPropagation()} className="hover:text-accent">{c?.name}</Link></td>
                      <td><div className="font-semibold">{d.name}</div>{d.files.length > 0 && <div className="text-[0.75rem] text-ink-3">{d.files[d.files.length - 1].fileName} · {fmtSize(d.files[d.files.length - 1].size)}</div>}</td>
                      <td className="text-ink-2">{st.projects.find((p) => p.id === d.projectId)?.name}</td>
                      <td><DocStatusBadge status={d.status} /></td>
                      <td className="nowrap"><DueText iso={d.dueDate} pending={d.status === "requested" || d.status === "revision"} /></td>
                      <td className="tnum nowrap text-ink-2">{d.submittedAt ? fmtDate(d.submittedAt) : "-"}</td>
                      <td className="nowrap">{consultant?.name}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {(d.status === "requested" || d.status === "revision") && (
                            <Button size="sm" variant="ghost" icon={<MessageSquareText size={14} />} onClick={() => openDraft({ kind: d.status === "revision" ? "revision_reminder" : "doc_reminder", ctx: { companyName: c?.name, contactName: c?.contactName, consultantName: consultant?.name, docName: d.name, dueText: `${fmtDate(d.dueDate)} (${relativeDay(d.dueDate)})`, note: d.reviewNote } })}>안내 초안</Button>
                          )}
                          {(d.status === "submitted" || d.status === "reviewing") && <Button size="sm" variant="accent" onClick={() => setReview(d)}>검토</Button>}
                          {(d.status === "done" || d.status === "planned") && <Button size="sm" variant="outline" onClick={() => setReview(d)}>보기</Button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>
      <div className="mt-3 flex items-center gap-2 text-[0.78rem] text-ink-3"><Badge tone="info">RULE</Badge> 자료 누락 체크는 규칙 기반으로 동작합니다. 기한 초과 항목은 오늘의 업무 브리핑에 자동 반영됩니다.</div>
      </>}
      <ReviewDocModal req={review} open={!!review} onClose={() => setReview(null)} />
      <Modal open={remind} onClose={() => setRemind(false)} title={<span className="flex items-center gap-2"><BellRing size={18} /> 리마인드 대상 {remindTargets.length}건</span>} size="md">
        <p className="mb-3 text-[0.85rem] text-ink-2">기한이 어제·오늘이거나 지난 미제출·보완필요 자료입니다. 각 건의 안내 초안을 복사해 발송하세요.</p>
        {remindTargets.length === 0 ? <div className="rounded-xl bg-success-bg px-4 py-3 text-[0.9rem] font-semibold text-success">리마인드가 필요한 자료가 없습니다.</div> : (
          <div className="divide-y divide-line rounded-xl border border-line">
            {remindTargets.map((d) => {
              const c = st.companies.find((x) => x.id === d.companyId);
              const consultant = st.users.find((u) => u.id === d.assigneeId);
              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><DocStatusBadge status={d.status} /><span className="min-w-0 flex-1 line-clamp-2 font-semibold md:line-clamp-1">{d.name}</span></div><div className="text-[0.8rem] text-ink-3">{c?.name} · {c?.contactName} {c?.contactTitle} · <DueText iso={d.dueDate} /></div></div>
                  <Button size="sm" variant="outline" icon={<MessageSquareText size={14} />} onClick={() => openDraft({ kind: d.status === "revision" ? "revision_reminder" : "doc_reminder", ctx: { companyName: c?.name, contactName: c?.contactName, consultantName: consultant?.name, docName: d.name, dueText: `${fmtDate(d.dueDate)} (${relativeDay(d.dueDate)})`, note: d.reviewNote } })}>안내 초안</Button>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 text-[0.78rem] text-ink-3"><NextBadge /> 카카오톡/이메일 자동 발송은 향후 확장 기능입니다. 현재는 담당자가 초안을 확인 후 직접 발송합니다.</div>
      </Modal>
    </div>
  );
}

export default function DocumentsPage() {
  return <Suspense><DocumentsInner /></Suspense>;
}
