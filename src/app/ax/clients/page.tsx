"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, LayoutGrid, List } from "lucide-react";
import { useStore } from "@/lib/store";
import { daysBetween, fmtDate, fmtRelative } from "@/lib/format";
import { stageLabel } from "@/lib/stages";
import { PageHeader, Badge, SegmentedControl, EmptyState, Card } from "@/components/ui/ui";
import { SearchBox, StageBadge, StageProgressBar } from "@/components/domain/domain";

export default function ClientsPage() {
  const st = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [view, setView] = useState<"card" | "table">("card");
  const [filter, setFilter] = useState<"all" | "mine" | "issue">("all");
  const now = new Date().toISOString();
  const me = st.session?.userId;

  const rows = useMemo(() => {
    return st.companies
      .map((c) => {
        const projects = st.projects.filter((p) => p.companyId === c.id);
        const active = projects.filter((p) => !["done", "aftercare"].includes(p.stage));
        const missing = st.docRequests.filter((d) => d.companyId === c.id && (d.status === "requested" || d.status === "revision"));
        const overdue = missing.filter((d) => daysBetween(d.dueDate, now) > 0).length;
        const openIq = st.inquiries.filter((i) => i.companyId === c.id && i.status === "open").length;
        const next = st.schedules.filter((s) => s.companyId === c.id && s.start >= now).sort((a, b) => a.start.localeCompare(b.start))[0];
        const last = st.activities.filter((a) => a.companyId === c.id).sort((a, b) => b.at.localeCompare(a.at))[0];
        const consultant = st.users.find((u) => u.id === c.consultantId);
        return { c, projects, active, missing, overdue, openIq, next, last, consultant, hasIssue: overdue > 0 || openIq > 0 };
      })
      .filter((r) => (filter === "mine" ? r.c.consultantId === me : filter === "issue" ? r.hasIssue : true))
      .filter((r) => !q || r.c.name.includes(q) || r.c.ceo.includes(q) || r.c.industry.includes(q) || r.c.contactName.includes(q));
  }, [st, q, filter, me, now]);

  return (
    <div>
      <PageHeader title="기업고객" desc="기업고객 단위로 상담·계약·프로젝트·자료·일정·문의를 연결합니다." badge={<Badge>{st.companies.length}개 기업</Badge>} actions={<SegmentedControl value={view} onChange={setView} options={[{ key: "card", label: <span className="flex items-center gap-1"><LayoutGrid size={14} /> 카드</span> }, { key: "table", label: <span className="flex items-center gap-1"><List size={14} /> 목록</span> }]} />} />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="md:w-80"><SearchBox value={q} onChange={setQ} placeholder="기업명, 대표, 업종, 담당자 검색" /></div>
        <SegmentedControl size="sm" value={filter} onChange={setFilter} options={[{ key: "all", label: "전체" }, { key: "mine", label: "내 담당" }, { key: "issue", label: "확인 필요" }]} />
      </div>

      {rows.length === 0 ? (
        <Card><EmptyState icon={<Building2 size={32} />} title="조건에 맞는 기업이 없습니다" desc="검색어나 필터를 바꿔보세요." /></Card>
      ) : view === "card" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ c, active, missing, overdue, openIq, next, last, consultant }) => (
            <Link key={c.id} href={`/ax/clients/${c.id}`} className="card card-hover flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="tnum flex h-7 w-7 items-center justify-center rounded-lg bg-shell text-[0.75rem] font-bold text-white">{c.code}</span><span className="truncate text-[1.05rem] font-bold">{c.name}</span></div>
                  <div className="mt-1 text-[0.82rem] text-ink-3">{c.industry} · {c.employees}명 · 매출 {c.revenue}</div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-ink-3" />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {overdue > 0 && <Badge tone="error">기한초과 {overdue}</Badge>}
                {missing.length > 0 && overdue === 0 && <Badge tone="warning">미제출 {missing.length}</Badge>}
                {openIq > 0 && <Badge tone="error">미답변 문의 {openIq}</Badge>}
                {missing.length === 0 && openIq === 0 && <Badge tone="success">이슈 없음</Badge>}
              </div>
              <div className="mt-4 space-y-2">
                {active.length ? active.slice(0, 2).map((p) => (
                  <div key={p.id}>
                    <div className="flex items-center justify-between text-[0.82rem]"><span className="truncate font-semibold text-ink-2">{p.name}</span><span className="text-ink-3">{stageLabel(p.stage)}</span></div>
                    <StageProgressBar stage={p.stage} className="mt-1" />
                  </div>
                )) : <div className="text-[0.82rem] text-ink-3">진행 중 프로젝트 없음</div>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[0.78rem] text-ink-3">
                <div>담당 <b className="text-ink-2">{consultant?.name}</b></div>
                <div>다음 일정 <b className="text-ink-2">{next ? fmtDate(next.start) : "-"}</b></div>
                <div className="col-span-2 truncate">최근 활동 · {last ? `${last.text} (${fmtRelative(last.at)})` : "-"}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <>
        {/* 모바일에서는 표를 가로로 밀지 않는다 — 한 기업 = 한 줄 카드 */}
        <div className="space-y-2 lg:hidden">
          {rows.map(({ c, active, missing, overdue, openIq, next, consultant }) => (
            <Link key={c.id} href={`/ax/clients/${c.id}`} className="card card-hover block p-4">
              <div className="flex items-center gap-2">
                <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-shell text-[0.7rem] font-bold text-white">{c.code}</span>
                <span className="truncate font-bold">{c.name}</span>
                {active[0] && <StageBadge stage={active[0].stage} />}
              </div>
              <div className="mt-1 truncate text-[0.82rem] text-ink-2">{active[0]?.name ?? "진행 중 프로젝트 없음"}{active.length > 1 ? ` 외 ${active.length - 1}` : ""}</div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.78rem] text-ink-3">
                {overdue > 0 ? <Badge tone="error">기한초과 {overdue}</Badge> : missing.length > 0 ? <Badge tone="warning">미제출 {missing.length}</Badge> : null}
                {openIq > 0 && <Badge tone="error">미답변 {openIq}</Badge>}
                <span className="ml-auto">담당 {consultant?.name} · 다음 {next ? fmtDate(next.start) : "-"}</span>
              </div>
            </Link>
          ))}
        </div>
        <Card className="hidden lg:block">
          <table className="tbl">
            <thead><tr><th>기업명</th><th>업종</th><th>담당</th><th>진행 프로젝트</th><th>현재 단계</th><th>미제출</th><th>문의</th><th>다음 일정</th><th>최초 상담</th></tr></thead>
            <tbody>
              {rows.map(({ c, active, missing, overdue, openIq, next, consultant }) => (
                <tr key={c.id} className="row-clickable" onClick={() => router.push(`/ax/clients/${c.id}`)}>
                  <td className="font-semibold">{c.name}</td>
                  <td className="text-ink-2">{c.industry}</td>
                  <td className="nowrap">{consultant?.name}</td>
                  <td>{active[0]?.name ?? <span className="text-ink-3">-</span>}{active.length > 1 && <span className="text-ink-3"> 외 {active.length - 1}</span>}</td>
                  <td>{active[0] ? <StageBadge stage={active[0].stage} /> : "-"}</td>
                  <td>{overdue ? <Badge tone="error">{missing.length} (초과 {overdue})</Badge> : missing.length ? <Badge tone="warning">{missing.length}</Badge> : <span className="text-ink-3">0</span>}</td>
                  <td>{openIq ? <Badge tone="error">{openIq}</Badge> : <span className="text-ink-3">0</span>}</td>
                  <td className="tnum">{next ? fmtDate(next.start) : "-"}</td>
                  <td className="tnum text-ink-3">{fmtDate(c.firstConsultDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        </>
      )}
    </div>
  );
}
