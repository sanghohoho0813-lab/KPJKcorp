"use client";

import Link from "next/link";
import { useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Columns3, List, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { INTERNAL_STAGES, KANBAN_STAGES, stageLabel } from "@/lib/stages";
import { daysBetween, fmtDate, relativeDay } from "@/lib/format";
import type { InternalStage } from "@/lib/types";
import { Badge, Button, Card, PageHeader, SegmentedControl, cx } from "@/components/ui/ui";
import { ProjectModal, useMay } from "@/components/domain/EntityModals";
import { SearchBox, StageBadge, StageProgressBar } from "@/components/domain/domain";

function ProjectsInner() {
  const st = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "mine" | "delayed" | "done" | "archived">(params.get("filter") === "delayed" ? "delayed" : "all");
  const [stage, setStage] = useState<InternalStage | "all">("all");
  const [newOpen, setNewOpen] = useState(false);
  const may = useMay();
  const now = new Date().toISOString();
  const me = st.session?.userId;

  const rows = useMemo(() => st.projects.filter((p) => (filter === "archived" ? !!p.archived : !p.archived)).map((p) => {
    const c = st.companies.find((x) => x.id === p.companyId);
    const docs = st.docRequests.filter((d) => d.projectId === p.id);
    const missing = docs.filter((d) => d.status === "requested" || d.status === "revision");
    const idle = daysBetween(p.stageChangedAt, now);
    const lastAct = st.activities.filter((a) => a.projectId === p.id).sort((a, b) => b.at.localeCompare(a.at))[0];
    const idleAct = lastAct ? daysBetween(lastAct.at, now) : idle;
    const delayed = !["done", "aftercare"].includes(p.stage) && (idleAct >= 7 || daysBetween(now, p.dueDate) < 0);
    return { p, c, docs, missing, idle: idleAct, delayed, consultant: st.users.find((u) => u.id === p.consultantId) };
  }).filter((r) => (filter === "mine" ? r.p.consultantId === me : filter === "delayed" ? r.delayed : filter === "done" ? ["done", "aftercare"].includes(r.p.stage) : true))
    .filter((r) => !q || r.p.name.includes(q) || (r.c?.name ?? "").includes(q)), [st, q, filter, me, now]);

  const grouped = (stage: InternalStage) => rows.filter((r) => {
    if (stage === "consult") return r.p.stage === "inquiry" || r.p.stage === "consult";
    if (stage === "doc_request") return r.p.stage === "doc_request" || r.p.stage === "doc_received";
    if (stage === "done") return r.p.stage === "done" || r.p.stage === "aftercare";
    return r.p.stage === stage;
  });

  return (
    <div>
      <PageHeader title="프로젝트 운영 Board" desc="상담부터 완료까지 컨설팅 단계별 병목을 확인합니다." badge={<Badge>총 {st.projects.filter((p) => !p.archived).length}개</Badge>} actions={
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl value={view} onChange={setView} options={[{ key: "board", label: <span className="flex items-center gap-1"><Columns3 size={14} /> Board</span> }, { key: "list", label: <span className="flex items-center gap-1"><List size={14} /> 목록</span> }]} />
          {may("project.create") && <Button variant="accent" icon={<Plus size={16} />} onClick={() => setNewOpen(true)}>프로젝트 등록</Button>}
        </div>
      } />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="md:w-80"><SearchBox value={q} onChange={setQ} placeholder="프로젝트명, 기업명 검색" /></div>
        <SegmentedControl size="sm" value={filter} onChange={setFilter} options={[{ key: "all", label: "진행 전체" }, { key: "mine", label: "내 담당" }, { key: "delayed", label: "지연" }, { key: "done", label: "완료" }, { key: "archived", label: "보관" }]} />
      </div>

      {view === "board" ? (
        <>
        {/* 모바일: 가로로 미는 Kanban 대신 단계 요약 → 선택 → 목록 */}
        <div className="lg:hidden">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            <button onClick={() => setStage("all")} className={cx("pressable rounded-xl border px-3 py-2.5 text-left transition-colors", stage === "all" ? "border-accent bg-soft/60" : "border-line hover:bg-surface-2")}>
              <div className="text-[0.75rem] font-bold text-ink-3">전체</div>
              <div className="tnum text-[1.3rem] font-bold">{rows.length}</div>
            </button>
            {KANBAN_STAGES.map((k) => {
              const items = grouped(k);
              const hot = items.some((i) => i.delayed);
              return (
                <button key={k} onClick={() => setStage(k)} className={cx("pressable rounded-xl border px-3 py-2.5 text-left transition-colors", stage === k ? "border-accent bg-soft/60" : "border-line hover:bg-surface-2")}>
                  <div className="truncate text-[0.75rem] font-bold text-ink-3">{stageLabel(k)}</div>
                  <div className={cx("tnum text-[1.3rem] font-bold", hot && "text-error")}>{items.length}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 space-y-2">
            {(stage === "all" ? rows : grouped(stage)).map(({ p, c, missing, idle, delayed }) => (
              <Link key={p.id} href={`/ax/projects/${p.id}`} className={cx("card card-hover block p-4", delayed && "border-l-4 border-l-error")}>
                <div className="flex items-center gap-2"><span className="truncate font-bold">{c?.name}</span><StageBadge stage={p.stage} /></div>
                <div className="truncate text-[0.85rem] text-ink-2">{p.name}</div>
                <StageProgressBar stage={p.stage} className="mt-2.5" />
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.75rem]">
                  {missing.length > 0 && <Badge tone="error">미제출 {missing.length}</Badge>}
                  {delayed && <Badge tone="warning">{idle}일 정체</Badge>}
                  {!["done", "aftercare"].includes(p.stage) && <span className="ml-auto text-ink-3">마감 {relativeDay(p.dueDate)}</span>}
                </div>
              </Link>
            ))}
            {(stage === "all" ? rows : grouped(stage)).length === 0 && <div className="rounded-xl border border-dashed border-line-2 py-10 text-center text-[0.85rem] text-ink-3">해당 단계의 프로젝트가 없습니다.</div>}
          </div>
        </div>
        <div className="thin-scroll hidden overflow-x-auto pb-3 lg:block">
          <div className="flex min-w-max gap-3">
            {KANBAN_STAGES.map((stage) => {
              const items = grouped(stage);
              const hot = items.some((i) => i.delayed);
              return (
                <div key={stage} className={cx("flex w-[250px] shrink-0 flex-col rounded-2xl border p-2", hot ? "border-line-2 bg-surface-2/60" : "border-line bg-surface")}>
                  <div className="flex items-center justify-between px-2 py-2"><span className="font-bold">{stageLabel(stage)}{stage === "doc_request" && <span className="text-ink-3"> · 접수</span>}{stage === "done" && <span className="text-ink-3"> · 사후</span>}</span><span className="tnum rounded-full bg-surface-2 px-2 text-[0.75rem] font-bold text-ink-2">{items.length}</span></div>
                  <div className="space-y-2">
                    {items.map(({ p, c, missing, idle, delayed }) => (
                      <Link key={p.id} href={`/ax/projects/${p.id}`} className={cx("card card-hover block p-3", delayed && "border-l-4 border-l-error")}>
                        <div className="truncate font-bold">{c?.name}</div>
                        <div className="truncate text-[0.82rem] text-ink-2">{p.name}</div>
                        <StageProgressBar stage={p.stage} className="mt-2.5" />
                        <div className="mt-2 flex flex-wrap gap-1 text-[0.72rem]">
                          {missing.length > 0 && <Badge tone="error">미제출 {missing.length}</Badge>}
                          {delayed && <Badge tone="warning">{idle}일 정체</Badge>}
                          {!["done", "aftercare"].includes(p.stage) && <span className="ml-auto text-ink-3">마감 {relativeDay(p.dueDate)}</span>}
                        </div>
                      </Link>
                    ))}
                    {items.length === 0 && <div className="rounded-xl border border-dashed border-line-2 py-6 text-center text-[0.78rem] text-ink-3">없음</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </>
      ) : (
        <>
        {/* 목록 뷰도 모바일에서는 표 대신 카드 */}
        <div className="space-y-2 lg:hidden">
          {rows.map(({ p, c, docs, missing, idle, delayed, consultant }) => (
            <Link key={p.id} href={`/ax/projects/${p.id}`} className={cx("card card-hover block p-4", delayed && "border-l-4 border-l-error")}>
              <div className="flex items-center gap-2"><span className="truncate font-bold">{c?.name}</span><StageBadge stage={p.stage} /></div>
              <div className="truncate text-[0.85rem] text-ink-2">{p.name}</div>
              <StageProgressBar stage={p.stage} className="mt-2.5" />
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.78rem] text-ink-3">
                <span>담당 {consultant?.name}</span>
                <span>{missing.length ? <b className="text-error">미제출 {missing.length}/{docs.length}</b> : `자료 ${docs.filter((d) => d.status === "done").length}/${docs.length}`}</span>
                <span className="ml-auto">마감 {fmtDate(p.dueDate)}</span>
                {delayed && <Badge tone="warning">{idle}일 정체</Badge>}
              </div>
            </Link>
          ))}
          {rows.length === 0 && <div className="rounded-xl border border-dashed border-line-2 py-10 text-center text-[0.85rem] text-ink-3">해당 조건의 프로젝트가 없습니다.</div>}
        </div>
        <Card className="hidden lg:block">
          <table className="tbl">
            <thead><tr><th>기업</th><th>프로젝트</th><th>단계</th><th>진행</th><th>자료</th><th>담당</th><th>시작</th><th>마감</th><th>상태</th></tr></thead>
            <tbody>
              {rows.map(({ p, c, docs, missing, idle, delayed, consultant }) => (
                <tr key={p.id} className="row-clickable" onClick={() => router.push(`/ax/projects/${p.id}`)}>
                  <td className="font-semibold">{c?.name}</td>
                  <td>{p.name}</td>
                  <td><StageBadge stage={p.stage} /></td>
                  <td className="w-40"><StageProgressBar stage={p.stage} /></td>
                  <td>{missing.length ? <Badge tone="error">미제출 {missing.length}/{docs.length}</Badge> : <span className="text-ink-3">{docs.filter((d) => d.status === "done").length}/{docs.length} 완료</span>}</td>
                  <td className="nowrap">{consultant?.name}</td>
                  <td className="tnum text-ink-3">{fmtDate(p.startDate)}</td>
                  <td className="tnum">{fmtDate(p.dueDate)}</td>
                  <td>{delayed ? <Badge tone="warning">{idle}일 정체</Badge> : ["done", "aftercare"].includes(p.stage) ? <Badge tone="success">완료</Badge> : <Badge tone="success">정상</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        </>
      )}
      <div className="mt-4 text-[0.78rem] text-ink-3">내부 단계 {INTERNAL_STAGES.length}개 중 문의·자료접수·사후관리는 인접 컬럼에 합쳐 표시됩니다.</div>
      <ProjectModal open={newOpen} onClose={() => setNewOpen(false)} onCreated={(id) => router.push(`/ax/projects/${id}`)} />
    </div>
  );
}

export default function ProjectsPage() {
  return <Suspense><ProjectsInner /></Suspense>;
}
