"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { useStore, usePortalCompanyId } from "@/lib/store";
import { CUSTOMER_STEPS, customerStageMessage, stageProgress, stageToCustomerStep } from "@/lib/stages";
import { fmtDate, fmtRelative, relativeDay } from "@/lib/format";
import { Badge, Card, PageHeader, SegmentedControl, cx, Progress } from "@/components/ui/ui";

function Inner() {
  const st = useStore();
  const companyId = usePortalCompanyId();
  const params = useSearchParams();
  const c = st.companies.find((x) => x.id === companyId);
  const projects = st.projects.filter((p) => p.companyId === companyId && p.clientVisible).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const [sel, setSel] = useState<string>(params.get("p") ?? projects.find((p) => !["done", "aftercare"].includes(p.stage))?.id ?? projects[0]?.id ?? "");
  const p = projects.find((x) => x.id === sel) ?? projects[0];
  if (!c) return null;
  if (!p) return <Card className="p-8 text-center text-ink-2">진행 중인 프로젝트가 없습니다.</Card>;
  const step = stageToCustomerStep(p.stage);
  const consultant = st.users.find((u) => u.id === p.consultantId);
  const now = new Date().toISOString();
  const next = st.schedules.filter((s) => s.projectId === p.id && s.visibleToClient && s.start >= now).sort((a, b) => a.start.localeCompare(b.start))[0];
  const docs = st.docRequests.filter((d) => d.projectId === p.id && d.status !== "planned");
  const todo = docs.filter((d) => d.status === "requested" || d.status === "revision");
  // step completion dates from activity log
  const stageActs = st.activities.filter((a) => a.projectId === p.id && a.type === "project_stage_changed").sort((a, b) => a.at.localeCompare(b.at));
  const clientActs = st.activities.filter((a) => a.projectId === p.id && ["document_uploaded", "document_reviewed", "document_revision_requested", "project_stage_changed", "result_shared", "inquiry_answered", "contract_signed"].includes(a.type)).slice(0, 8);
  const nextAction = todo.length ? `${todo[0].name} 제출` : step === 3 ? "담당 컨설턴트의 검토 결과를 기다려 주세요" : step === 5 ? "대표 미팅 일정 확인" : step >= 6 ? "완료자료 확인" : next ? `${next.title} 참석` : "담당자 안내를 기다려 주세요";

  return (
    <div className="space-y-5">
      <PageHeader title="프로젝트 진행 Timeline" desc={`${c.name} ${p.name} 프로젝트의 현재 위치를 한눈에 확인합니다.`} badge={<Badge tone="accent">현재 단계: {CUSTOMER_STEPS[step].label}</Badge>} actions={projects.length > 1 ? <SegmentedControl size="sm" value={p.id} onChange={setSel} options={projects.map((x) => ({ key: x.id, label: x.name }))} /> : undefined} />

      {/* SIGNATURE 04 — Client Journey Timeline */}
      <Card className="p-5 md:p-8" id="tut-p-timeline">
        <div className="hidden md:block">
          <div className="relative flex items-start justify-between">
            <div className="absolute left-[7%] right-[7%] top-6 h-1 bg-surface-2" />
            <div className="absolute left-[7%] top-6 h-1 bg-accent transition-all" style={{ width: `${(step / (CUSTOMER_STEPS.length - 1)) * 86}%` }} />
            {CUSTOMER_STEPS.map((s) => {
              const done = s.idx < step;
              const cur = s.idx === step;
              return (
                <div key={s.key} className="relative flex w-[14%] flex-col items-center text-center">
                  <span className={cx("flex h-12 w-12 items-center justify-center rounded-full border-4 border-surface text-[1rem] font-bold shadow-sm", done ? "bg-primary text-white" : cur ? "bg-accent text-accent-ink ring-4 ring-soft" : "bg-surface-2 text-ink-3")}>{done ? <Check size={20} /> : s.idx + 1}</span>
                  <span className={cx("mt-3 text-[0.95rem] font-bold", cur ? "text-accent" : done ? "text-ink" : "text-ink-3")}>{s.label}</span>
                  <span className="mt-0.5 text-[0.78rem] text-ink-3">{done ? "완료" : cur ? "진행 중" : "예정"}</span>
                </div>
              );
            })}
          </div>
        </div>
        <ol className="space-y-0 md:hidden">
          {CUSTOMER_STEPS.map((s, i) => {
            const done = s.idx < step;
            const cur = s.idx === step;
            return (
              <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
                {i < CUSTOMER_STEPS.length - 1 && <span className={cx("absolute left-[15px] top-8 h-full w-0.5", done ? "bg-accent" : "bg-surface-2")} />}
                <span className={cx("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.85rem] font-bold", done ? "bg-primary text-white" : cur ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-3")}>{done ? <Check size={16} /> : s.idx + 1}</span>
                <div><div className={cx("font-bold", cur ? "text-accent" : done ? "" : "text-ink-3")}>{s.label} <span className="text-[0.78rem] font-normal text-ink-3">{done ? "완료" : cur ? "진행 중" : "예정"}</span></div>{(cur || done) && <div className="text-[0.82rem] text-ink-2">{cur ? customerStageMessage(p.stage) : s.desc}</div>}</div>
              </li>
            );
          })}
        </ol>
        <div className="mt-6 rounded-xl bg-soft/50 px-5 py-4 md:mt-8">
          <div className="text-[0.78rem] font-bold text-accent">현재 상태</div>
          <div className="mt-1 text-[1rem] font-semibold">{customerStageMessage(p.stage)}</div>
          <Progress value={stageProgress(p.stage)} className="mt-3" />
          <div className="mt-1 text-right text-[0.8rem] tnum text-ink-2">{stageProgress(p.stage)}%</div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-5"><div className="text-[0.78rem] font-bold text-ink-3">다음 조치</div><div className="mt-1 text-[1.15rem] font-bold">{nextAction}</div>{todo[0] && <Link href="/portal/documents" className="mt-2 inline-block text-[0.85rem] font-semibold text-accent">요청자료로 이동 →</Link>}</Card>
        <Card className="p-5"><div className="text-[0.78rem] font-bold text-ink-3">{next ? "다음 일정" : "예상 완료"}</div><div className="mt-1 text-[1.15rem] font-bold">{next ? fmtDate(next.start) : fmtDate(p.dueDate)}</div><div className="text-[0.82rem] text-ink-2">{next ? `${next.title.replace(c.name, "").trim()} (${relativeDay(next.start)})` : relativeDay(p.dueDate)}</div></Card>
        <Card className="p-5"><div className="text-[0.78rem] font-bold text-ink-3">담당 컨설턴트</div><div className="mt-1 text-[1.15rem] font-bold">{consultant?.name} {consultant?.title}</div><Link href="/portal/inquiries" className="mt-1 inline-block text-[0.85rem] font-semibold text-accent">문의하기 →</Link></Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-[1.05rem] font-bold">프로젝트 정보</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.9rem]">
            <dt className="text-ink-3">프로젝트</dt><dd className="font-semibold">{p.name}</dd>
            <dt className="text-ink-3">시작일</dt><dd className="tnum">{fmtDate(p.startDate, { year: true })}</dd>
            <dt className="text-ink-3">예상 완료</dt><dd className="tnum">{fmtDate(p.dueDate, { year: true })}</dd>
            <dt className="text-ink-3">요청자료</dt><dd>{docs.length - todo.length} / {docs.length} 제출</dd>
            <dt className="text-ink-3">범위</dt><dd className="col-span-1 text-ink-2">{p.description}</dd>
          </dl>
          {stageActs.length > 0 && <div className="mt-3 text-[0.78rem] text-ink-3">최근 단계 변경: {fmtRelative(stageActs[stageActs.length - 1].at)}</div>}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-[1.05rem] font-bold">최근 진행 내역</h2>
          {clientActs.length === 0 ? <div className="text-ink-3">아직 진행 내역이 없습니다.</div> : (
            <ol className="space-y-2.5">
              {clientActs.map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-[0.88rem]"><span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", a.actorRole === "client" ? "bg-accent" : "bg-primary")} /><div><div>{a.text.replace("고객 제출", "제출").replace(` (${c.name})`, "")}</div><div className="text-[0.75rem] text-ink-3">{fmtRelative(a.at)}</div></div></li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function PortalProjectsPage() {
  return <Suspense><Inner /></Suspense>;
}
