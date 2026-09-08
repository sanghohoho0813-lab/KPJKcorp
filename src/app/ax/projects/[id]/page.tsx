"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Briefcase, CheckCircle2, ChevronDown, FileText, Plus, Share2, Sparkles, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { CUSTOMER_STEPS, INTERNAL_STAGES, stageLabel, stageProgress, stageToCustomerStep } from "@/lib/stages";
import { projectSummary } from "@/lib/brief";
import { daysBetween, fmtDate, fmtDateTime, fmtSize, relativeDay } from "@/lib/format";
import type { DocumentRequest, InternalStage } from "@/lib/types";
import { AiReadyBadge, Badge, Button, Card, EmptyState, Field, Input, Select, Stat, Textarea, SectionTitle, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";
import { ActivityFeed, DocStatusBadge, DueText, ScheduleItem, StageBadge } from "@/components/domain/domain";
import { ReviewDocModal } from "@/components/domain/DocActions";
import { NewDocRequestModal, NewScheduleModal, NewTaskModal } from "@/components/domain/CreateModals";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const st = useStore();
  const openAi = useUi((s) => s.openAi);
  const changeStage = useStore((s) => s.changeProjectStage);
  const shareResult = useStore((s) => s.shareResult);
  const toast = useStore((s) => s.toast);
  const [reviewReq, setReviewReq] = useState<DocumentRequest | null>(null);
  const [newDoc, setNewDoc] = useState(false);
  const [newSchedule, setNewSchedule] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [share, setShare] = useState(false);
  const [resName, setResName] = useState("");
  const [resKind, setResKind] = useState<"보고서" | "제안서" | "분석자료" | "체크리스트" | "기타">("보고서");
  const [resDesc, setResDesc] = useState("");
  const now = new Date();

  const p = st.projects.find((x) => x.id === id);
  const data = useMemo(() => {
    if (!p) return null;
    const c = st.companies.find((x) => x.id === p.companyId)!;
    const docs = st.docRequests.filter((d) => d.projectId === p.id);
    const schedules = st.schedules.filter((s) => s.projectId === p.id).sort((a, b) => a.start.localeCompare(b.start));
    const tasks = st.tasks.filter((t) => t.projectId === p.id && t.status !== "done").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const activities = st.activities.filter((a) => a.projectId === p.id);
    const results = st.results.filter((r) => r.projectId === p.id);
    const contract = st.contracts.find((x) => x.projectId === p.id);
    const summary = projectSummary(p, st.docRequests, st.schedules, st.activities, now);
    return { c, docs, schedules, tasks, activities, results, contract, summary, consultant: st.users.find((u) => u.id === p.consultantId) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, st]);

  if (!p || !data) return <Card><EmptyState icon={<Briefcase size={32} />} title="프로젝트를 찾을 수 없습니다" action={<Button variant="outline" onClick={() => router.push("/ax/projects")}>목록으로</Button>} /></Card>;
  const { c, docs, schedules, tasks, activities, results, contract, summary, consultant } = data;
  const stageIdx = INTERNAL_STAGES.findIndex((s) => s.key === p.stage);
  const nextStage = INTERNAL_STAGES[stageIdx + 1]?.key;
  const customerStep = stageToCustomerStep(p.stage);

  const doShare = () => {
    if (!resName.trim()) { toast("결과자료명을 입력해 주세요.", "error"); return; }
    shareResult({ projectId: p.id, companyId: p.companyId, name: resName.trim(), kind: resKind, description: resDesc.trim(), size: 1_200_000 + Math.floor(Math.random() * 3_000_000), sharedBy: st.session?.userId ?? "u_admin" }, st.session?.userId ?? "u_admin");
    toast("결과자료를 공유했습니다. 고객 Portal 완료자료에 표시됩니다.");
    setShare(false); setResName(""); setResDesc("");
  };

  return (
    <div className="space-y-5">
      <Link href="/ax/projects" className="inline-flex items-center gap-1 text-[0.85rem] font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={16} /> 프로젝트</Link>

      <Card className="p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href={`/ax/clients/${c.id}`} className="text-[0.9rem] font-semibold text-ink-2 hover:text-accent">{c.name} →</Link>
            <div className="mt-1 flex flex-wrap items-center gap-2"><h1 className="text-[1.6rem] font-bold md:text-[1.85rem]">{p.name}</h1><StageBadge stage={p.stage} /><Badge>{p.type}</Badge></div>
            <p className="mt-1 text-[0.9rem] text-ink-2">{p.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" icon={<Plus size={15} />} onClick={() => setNewDoc(true)}>자료 요청</Button>
            <Button variant="outline" size="sm" icon={<Plus size={15} />} onClick={() => setNewSchedule(true)}>일정</Button>
            <Button variant="outline" size="sm" icon={<Plus size={15} />} onClick={() => setNewTask(true)}>업무</Button>
            <Button variant="outline" size="sm" icon={<Share2 size={15} />} onClick={() => setShare(true)}>결과자료 공유</Button>
            <Button variant="accent" size="sm" icon={<ArrowRight size={15} />} onClick={() => setStageOpen(true)}>단계 변경</Button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl bg-surface-2 p-4 md:grid-cols-5">
          <Stat label="담당" value={`${consultant?.name} ${consultant?.title}`} />
          <Stat label="시작일" value={fmtDate(p.startDate)} />
          <Stat label="마감일" value={<>{fmtDate(p.dueDate)} <span className="text-ink-3">({relativeDay(p.dueDate)})</span></>} />
          <Stat label="계약" value={contract ? (contract.status === "signed" ? `서명 완료 (${fmtDate(contract.signedAt)})` : contract.status === "sent" ? "서명 대기" : "초안") : "-"} />
          <Stat label="현재 단계 진입" value={`${fmtDate(p.stageChangedAt)} (${daysBetween(p.stageChangedAt, now.toISOString())}일 전)`} />
        </div>

        {/* SIGNATURE 03 — Dual Progress */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-[0.8rem] font-bold text-ink-3"><span>내부 단계 ({INTERNAL_STAGES.length})</span><span className="tnum">{stageProgress(p.stage)}%</span></div>
          <div className="thin-scroll flex gap-1 overflow-x-auto pb-1">
            {INTERNAL_STAGES.map((s, i) => (
              <div key={s.key} className={cx("flex h-8 min-w-[64px] flex-1 items-center justify-center rounded-md text-[0.72rem] font-bold", i < stageIdx ? "bg-primary/85 text-white" : i === stageIdx ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-3")}>{s.short}</div>
            ))}
          </div>
          <div className="mt-3 mb-2 text-[0.8rem] font-bold text-ink-3">고객이 보는 단계 (7) — 같은 데이터에서 자동 매핑</div>
          <div className="flex gap-1">
            {CUSTOMER_STEPS.map((s) => (
              <div key={s.key} className={cx("flex h-8 flex-1 items-center justify-center rounded-md text-[0.72rem] font-bold", s.idx < customerStep ? "bg-success-bg text-success" : s.idx === customerStep ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-3")}>{s.label}</div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle action={<AiReadyBadge onClick={() => openAi({ title: "프로젝트 요약 — AI 적용 설명", key: "project" })} />}><span className="flex items-center gap-2"><Sparkles size={18} className="text-accent" /> 프로젝트 요약</span></SectionTitle>
            <div className="space-y-1 text-[0.95rem] leading-relaxed">{summary.lines.map((l) => <p key={l}>{l}</p>)}</div>
            <div className="mt-3 rounded-xl bg-soft/60 px-4 py-3 text-[0.9rem]"><b className="text-accent">다음 Action</b> · {summary.nextAction}</div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <span className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} className="text-ink-3" /> 자료 누락 체크 <Badge tone="info">RULE</Badge></span>
              <span className="text-[0.85rem] text-ink-2">제출 {summary.submitted} / {summary.total}</span>
            </div>
            {docs.length === 0 ? <EmptyState title="요청한 자료가 없습니다" action={<Button size="sm" variant="outline" onClick={() => setNewDoc(true)}>자료 요청</Button>} /> : (
              <div className="divide-y divide-line">
                {docs.map((d) => (
                  <button key={d.id} onClick={() => setReviewReq(d)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-2/60">
                    <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", d.status === "done" ? "bg-success-bg text-success" : d.status === "requested" || d.status === "revision" ? "bg-error-bg text-error" : "bg-warning-bg text-warning")}>{d.status === "done" ? <CheckCircle2 size={16} /> : d.status === "requested" || d.status === "revision" ? <Upload size={16} /> : <FileText size={16} />}</span>
                    <div className="min-w-0 flex-1"><div className="truncate font-semibold">{d.name}</div><div className="text-[0.78rem] text-ink-3">{d.files.length ? `${d.files[d.files.length - 1].fileName} · ${fmtSize(d.files[d.files.length - 1].size)}` : d.description || "-"}</div></div>
                    <DocStatusBadge status={d.status} />
                    <span className="hidden w-24 text-right sm:block"><DueText iso={d.dueDate} pending={d.status === "requested" || d.status === "revision"} /></span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle>이력 (Evidence)</SectionTitle>
            <ActivityFeed items={activities} limit={12} />
          </Card>
        </div>
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle>예정 일정</SectionTitle>
            {schedules.filter((s) => s.start >= now.toISOString()).length === 0 ? <div className="text-[0.9rem] text-ink-3">예정 일정이 없습니다.</div> : <div className="divide-y divide-line">{schedules.filter((s) => s.start >= now.toISOString()).map((s) => <ScheduleItem key={s.id} s={s} />)}</div>}
          </Card>
          <Card className="p-5">
            <SectionTitle>미완료 업무</SectionTitle>
            {tasks.length === 0 ? <div className="text-[0.9rem] text-ink-3">미완료 업무가 없습니다.</div> : tasks.map((t) => (
              <Link key={t.id} href="/ax/tasks" className="flex items-center justify-between border-b border-line py-2 text-[0.88rem] last:border-0"><span className="truncate font-semibold">{t.title}</span><DueText iso={t.dueDate} /></Link>
            ))}
          </Card>
          <Card className="p-5">
            <SectionTitle>공유된 결과자료</SectionTitle>
            {results.length === 0 ? <div className="text-[0.9rem] text-ink-3">아직 공유된 결과자료가 없습니다.</div> : results.map((r) => (
              <div key={r.id} className="border-b border-line py-2 text-[0.88rem] last:border-0"><div className="font-semibold">{r.name}</div><div className="text-[0.78rem] text-ink-3">{r.kind} · {fmtDateTime(r.sharedAt)}</div></div>
            ))}
          </Card>
        </div>
      </div>

      {/* Stage change */}
      <Modal open={stageOpen} onClose={() => setStageOpen(false)} title="프로젝트 단계 변경" size="sm">
        <p className="mb-3 text-[0.85rem] text-ink-2">단계를 변경하면 고객 Portal의 진행률·Timeline이 자동으로 바뀌고 고객에게 알림이 전송됩니다.</p>
        <div className="space-y-1.5">
          {INTERNAL_STAGES.map((s, i) => (
            <button key={s.key} disabled={s.key === p.stage} onClick={() => { changeStage(p.id, s.key as InternalStage, st.session?.userId ?? "u_admin"); toast(`단계가 '${s.label}'(으)로 변경되었습니다. 고객 Portal에 반영됩니다.`); setStageOpen(false); }} className={cx("pressable flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-[0.9rem] font-semibold", s.key === p.stage ? "border-accent bg-soft/60 text-accent" : s.key === nextStage ? "border-line-2 hover:bg-surface-2" : "border-line text-ink-2 hover:bg-surface-2")}>
              <span><span className="tnum mr-2 text-ink-3">{i + 1}</span>{s.label}</span>
              {s.key === p.stage ? <Badge tone="accent">현재</Badge> : s.key === nextStage ? <Badge tone="info">다음</Badge> : null}
            </button>
          ))}
        </div>
      </Modal>

      {/* Share result */}
      <Modal open={share} onClose={() => setShare(false)} title="결과자료 공유" size="sm" footer={<><Button variant="ghost" onClick={() => setShare(false)}>취소</Button><Button variant="accent" onClick={doShare} icon={<Share2 size={15} />}>공유</Button></>}>
        <div className="space-y-3">
          <Field label="자료명"><Input value={resName} onChange={(e) => setResName(e.target.value)} placeholder="예: 경영진단 최종 보고서" autoFocus /></Field>
          <Field label="종류"><Select value={resKind} onChange={(e) => setResKind(e.target.value as typeof resKind)}>{["보고서", "제안서", "분석자료", "체크리스트", "기타"].map((k) => <option key={k}>{k}</option>)}</Select></Field>
          <Field label="설명"><Textarea value={resDesc} onChange={(e) => setResDesc(e.target.value)} className="min-h-20" placeholder="고객에게 보이는 설명" /></Field>
          <p className="text-[0.78rem] text-ink-3">이 데모에서는 파일 메타만 기록됩니다.</p>
        </div>
      </Modal>

      <ReviewDocModal req={reviewReq} open={!!reviewReq} onClose={() => setReviewReq(null)} />
      <NewDocRequestModal projectId={newDoc ? p.id : null} open={newDoc} onClose={() => setNewDoc(false)} />
      <NewScheduleModal open={newSchedule} onClose={() => setNewSchedule(false)} companyId={c.id} projectId={p.id} />
      <NewTaskModal open={newTask} onClose={() => setNewTask(false)} companyId={c.id} projectId={p.id} />
    </div>
  );
}

export { ChevronDown, stageLabel };
