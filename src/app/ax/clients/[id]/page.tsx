"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, CalendarDays, ChevronRight, Eye, FileCheck2, FileText, FolderOpen, Mail, MapPin, MessageSquare, MessageSquareText, Phone, Plus, Sparkles, UserRound } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { daysBetween, fmtDate, fmtDateTime, fmtSize, relativeDay, fmtRelative, fmtTime } from "@/lib/format";
import { stageLabel } from "@/lib/stages";
import { OPP_STATUS } from "@/lib/services";
import type { DocumentRequest } from "@/lib/types";
import { Badge, Button, Card, EmptyState, IconTile, KpiCard, SectionTitle, Stat, Tabs, AiReadyBadge } from "@/components/ui/ui";
import { ActivityFeed, DocStatusBadge, InquiryStatusBadge, ScheduleItem, StageBadge, StageProgressBar, DueText } from "@/components/domain/domain";
import { ReviewDocModal } from "@/components/domain/DocActions";
import { NewDocRequestModal, NewScheduleModal } from "@/components/domain/CreateModals";
import { NewConsultationModal } from "@/components/domain/ConsultationModal";

type TabKey = "overview" | "consult" | "contract" | "project" | "docs" | "schedule" | "inquiry" | "results" | "history";

export default function ClientCardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const st = useStore();
  const openAi = useUi((s) => s.openAi);
  const openDraft = useUi((s) => s.openDraft);
  const setPreview = useStore((s) => s.setPortalPreview);
  const [tab, setTab] = useState<TabKey>("overview");
  const [reviewReq, setReviewReq] = useState<DocumentRequest | null>(null);
  const [newDoc, setNewDoc] = useState<string | null>(null);
  const [newConsult, setNewConsult] = useState(false);
  const [newSchedule, setNewSchedule] = useState(false);

  const c = st.companies.find((x) => x.id === id);
  const now = new Date();
  const nowIso = now.toISOString();

  const data = useMemo(() => {
    if (!c) return null;
    const projects = st.projects.filter((p) => p.companyId === c.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
    const active = projects.filter((p) => !["done", "aftercare"].includes(p.stage));
    const consultations = st.consultations.filter((x) => x.companyId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    const contracts = st.contracts.filter((x) => x.companyId === c.id);
    const docs = st.docRequests.filter((x) => x.companyId === c.id);
    const missing = docs.filter((d) => d.status === "requested" || d.status === "revision");
    const waiting = docs.filter((d) => d.status === "submitted" || d.status === "reviewing");
    const schedules = st.schedules.filter((x) => x.companyId === c.id).sort((a, b) => a.start.localeCompare(b.start));
    const upcoming = schedules.filter((s) => s.start >= nowIso);
    const inquiries = st.inquiries.filter((x) => x.companyId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const results = st.results.filter((x) => x.companyId === c.id).sort((a, b) => b.sharedAt.localeCompare(a.sharedAt));
    const activities = st.activities.filter((x) => x.companyId === c.id);
    const opps = st.opportunities.filter((x) => x.companyId === c.id && x.status !== "dropped").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const consultant = st.users.find((u) => u.id === c.consultantId);
    return { projects, active, consultations, contracts, docs, missing, waiting, schedules, upcoming, inquiries, results, activities, opps, consultant };
  }, [c, st, nowIso]);

  if (!c || !data) {
    return (
      <Card>
        <EmptyState icon={<Building2 size={32} />} title="기업을 찾을 수 없습니다" action={<Button variant="outline" onClick={() => router.push("/ax/clients")}>기업고객 목록</Button>} />
      </Card>
    );
  }
  const { projects, active, consultations, contracts, docs, missing, waiting, schedules, upcoming, inquiries, results, activities, opps, consultant } = data;
  const openIq = inquiries.filter((i) => i.status === "open");

  const actions: { text: string; href?: string; onClick?: () => void; tone: "error" | "warning" | "info" }[] = [];
  for (const d of missing) actions.push({ text: `${d.name} ${daysBetween(d.dueDate, nowIso) > 0 ? "기한 초과 — 재요청" : "제출 대기"}`, onClick: () => setReviewReq(d), tone: daysBetween(d.dueDate, nowIso) > 0 ? "error" : "warning" });
  for (const d of waiting) actions.push({ text: `${d.name} 검토 필요`, onClick: () => setReviewReq(d), tone: "info" });
  for (const i of openIq) actions.push({ text: `문의 답변: ${i.title}`, href: `/ax/inquiries?focus=${i.id}`, tone: "error" });
  if (upcoming[0]) actions.push({ text: `${relativeDay(upcoming[0].start)} ${fmtTime(upcoming[0].start)} ${upcoming[0].title}`, href: "/ax/schedule", tone: "info" });

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "consult", label: "상담", count: consultations.length },
    { key: "contract", label: "계약", count: contracts.length },
    { key: "project", label: "프로젝트", count: projects.length },
    { key: "docs", label: "요청자료", count: docs.length },
    { key: "schedule", label: "일정", count: upcoming.length },
    { key: "inquiry", label: "문의", count: inquiries.length },
    { key: "results", label: "결과자료", count: results.length },
    { key: "history", label: "History", count: activities.length },
  ];

  return (
    <div className="space-y-5">
      <Link href="/ax/clients" className="inline-flex items-center gap-1 text-[0.85rem] font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={16} /> 기업고객</Link>

      {/* Header — SIGNATURE 01 Enterprise Client Card */}
      <Card className="p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="tnum flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-shell text-[1.2rem] font-black text-white">{c.code}</span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[1.6rem] font-bold md:text-[1.85rem]">{c.name}</h1>
                {active[0] && <StageBadge stage={active[0].stage} />}
              </div>
              <div className="mt-1 text-[0.9rem] text-ink-2">{c.industry} · 임직원 {c.employees}명 · 매출 {c.revenue} · 사업자번호 {c.bizNo}</div>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[0.85rem] md:grid-cols-3">
                <span className="flex items-center gap-1.5 text-ink-2"><UserRound size={14} className="text-ink-3" /> 대표 <b className="text-ink">{c.ceo}</b></span>
                <span className="flex items-center gap-1.5 text-ink-2"><UserRound size={14} className="text-ink-3" /> 담당자 <b className="text-ink">{c.contactName} {c.contactTitle}</b></span>
                <span className="flex items-center gap-1.5 text-ink-2"><Phone size={14} className="text-ink-3" /> {c.contactPhone}</span>
                <span className="flex items-center gap-1.5 text-ink-2"><Mail size={14} className="text-ink-3" /> {c.contactEmail}</span>
                <span className="flex items-center gap-1.5 text-ink-2"><MapPin size={14} className="text-ink-3" /> {c.address}</span>
                <span className="flex items-center gap-1.5 text-ink-2"><CalendarDays size={14} className="text-ink-3" /> 최초 상담 {fmtDate(c.firstConsultDate, { year: true })}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
            <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[0.85rem]"><span className="text-ink-3">담당 컨설턴트</span><b>{consultant?.name} {consultant?.title}</b></div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" icon={<Eye size={15} />} onClick={() => { setPreview(c.id); router.push("/portal"); }}>고객 화면 보기</Button>
              <Button size="sm" variant="outline" icon={<MessageSquareText size={15} />} onClick={() => openDraft({ kind: "progress_update", ctx: { companyName: c.name, contactName: c.contactName, consultantName: consultant?.name, stage: active[0] ? stageLabel(active[0].stage) : "-", note: upcoming[0]?.title } })}>진행 안내 초안</Button>
            </div>
          </div>
        </div>
        {c.memo && <div className="mt-4 rounded-xl bg-soft/50 px-4 py-3 text-[0.88rem] text-ink-2"><b className="text-ink">메모</b> · {c.memo}</div>}
      </Card>

      {/* Quick status */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="진행 프로젝트" value={active.length} sub={active[0]?.name ?? "없음"} icon={<IconTile color="var(--mod-ops)" size={30}><FolderOpen size={15} /></IconTile>} />
        <KpiCard label="자료 미제출 · 검토대기" value={<>{missing.length}<span className="text-[1rem] text-ink-3"> / {waiting.length}</span></>} sub={missing.some((d) => daysBetween(d.dueDate, nowIso) > 0) ? "기한 초과 있음" : "기한 내"} tone={missing.some((d) => daysBetween(d.dueDate, nowIso) > 0) ? "error" : undefined} icon={<IconTile color="var(--mod-doc)" size={30}><FileText size={15} /></IconTile>} />
        <KpiCard label="다음 일정" value={upcoming[0] ? fmtDate(upcoming[0].start) : "-"} sub={upcoming[0]?.title ?? "예정 일정 없음"} icon={<IconTile color="var(--mod-schedule)" size={30}><CalendarDays size={15} /></IconTile>} />
        <KpiCard label="최근 문의" value={inquiries.length} sub={openIq.length ? `답변 대기 ${openIq.length}건` : "답변 대기 없음"} tone={openIq.length ? "error" : undefined} icon={<IconTile color="var(--mod-customer)" size={30}><MessageSquare size={15} /></IconTile>} />
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} id="tut-client-tabs" />

      {tab === "overview" && (
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            <Card className="p-5">
              <SectionTitle>현재 진행 프로젝트</SectionTitle>
              {active.length === 0 ? <div className="text-[0.9rem] text-ink-3">진행 중 프로젝트가 없습니다.</div> : active.map((p) => (
                <Link key={p.id} href={`/ax/projects/${p.id}`} className="card card-hover mb-3 block p-4 last:mb-0">
                  <div className="flex items-center justify-between gap-2"><span className="font-bold">{p.name}</span><StageBadge stage={p.stage} /></div>
                  <div className="mt-1 text-[0.82rem] text-ink-2">{p.description}</div>
                  <StageProgressBar stage={p.stage} className="mt-3" />
                  <div className="mt-2 flex justify-between text-[0.78rem] text-ink-3"><span>시작 {fmtDate(p.startDate)}</span><span>마감 {fmtDate(p.dueDate)} ({relativeDay(p.dueDate)})</span></div>
                </Link>
              ))}
            </Card>
            {opps.length > 0 && (
              <Card className="p-5">
                <SectionTitle action={<Link href="/ax/opportunities?tab=pipeline" className="text-[0.85rem] font-semibold text-ink-2 hover:text-ink">기회 →</Link>}>매출기회</SectionTitle>
                <div className="divide-y divide-line">
                  {opps.map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center gap-2 py-2.5">
                      <Badge tone={OPP_STATUS[o.status].tone}>{OPP_STATUS[o.status].label}</Badge>
                      <span className="min-w-0 flex-1 truncate font-semibold">{o.serviceName}</span>
                      <span className="text-[0.78rem] text-ink-3">{o.source === "portal_interest" || o.source === "portal_request" ? "고객 발신" : o.source === "rule" ? "규칙 발견" : "내부"} · {fmtRelative(o.updatedAt)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            <Card className="p-5">
              <SectionTitle action={<AiReadyBadge onClick={() => openAi({ title: "상담 요약 — AI 적용 설명", key: "consult" })} />}>최근 상담 요약</SectionTitle>
              {consultations[0] ? (
                <div>
                  <div className="text-[0.82rem] text-ink-3">{fmtDateTime(consultations[0].date)} · {consultations[0].type} · {consultations[0].channel} · {st.users.find((u) => u.id === consultations[0].consultantId)?.name}</div>
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[0.9rem]">{consultations[0].summary.core.map((x) => <li key={x}>{x}</li>)}</ul>
                  <div className="mt-2 text-[0.85rem] text-ink-2"><b>다음 Action:</b> {consultations[0].summary.nextAction}</div>
                </div>
              ) : <div className="text-[0.9rem] text-ink-3">상담 기록이 없습니다.</div>}
            </Card>
          </div>
          <div className="space-y-5">
            <Card className="p-5">
              <SectionTitle>필요한 Action</SectionTitle>
              {actions.length === 0 ? <div className="text-[0.9rem] text-success">지금 필요한 Action이 없습니다.</div> : (
                <div className="space-y-1.5">
                  {actions.map((a, i) => {
                    const cls = `pressable flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-[0.88rem] font-semibold ${a.tone === "error" ? "bg-error-bg text-error" : a.tone === "warning" ? "bg-warning-bg text-warning" : "bg-info-bg text-info"}`;
                    return a.href ? <Link key={i} href={a.href} className={cls}>{a.text}<ChevronRight size={15} /></Link> : <button key={i} onClick={a.onClick} className={cls}>{a.text}<ChevronRight size={15} /></button>;
                  })}
                </div>
              )}
            </Card>
            <Card className="p-5">
              <SectionTitle>미제출 자료</SectionTitle>
              {missing.length === 0 ? <div className="text-[0.9rem] text-ink-3">미제출 자료가 없습니다.</div> : missing.map((d) => (
                <button key={d.id} onClick={() => setReviewReq(d)} className="flex w-full items-center justify-between border-b border-line py-2 text-left text-[0.88rem] last:border-0 hover:bg-surface-2/60">
                  <span className="font-semibold">{d.name}</span><span className="flex items-center gap-2"><DocStatusBadge status={d.status} /><DueText iso={d.dueDate} /></span>
                </button>
              ))}
            </Card>
            <Card className="p-5">
              <SectionTitle>최근 고객 활동</SectionTitle>
              <ActivityFeed items={activities.filter((a) => a.actorRole === "client")} limit={4} />
            </Card>
          </div>
        </div>
      )}

      {tab === "consult" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="accent" icon={<Plus size={15} />} onClick={() => setNewConsult(true)}>상담 기록 작성</Button>
          </div>
          {consultations.length === 0 && <Card><EmptyState icon={<FileText size={30} />} title="상담 기록이 없습니다" desc="상담이 끝나면 바로 기록해 두면 다음 담당자도 같은 맥락에서 이어갈 수 있습니다." /></Card>}
          {consultations.map((cs) => (
            <Card key={cs.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><Badge tone="info">{cs.type}</Badge><Badge>{cs.channel}</Badge><span className="text-[0.85rem] text-ink-2">{fmtDateTime(cs.date)} · {st.users.find((u) => u.id === cs.consultantId)?.name}</span></div>
                <AiReadyBadge label="AI 요약" onClick={() => openAi({ title: "상담 요약 — AI 적용 설명", key: "consult" })} />
              </div>
              <p className="mt-3 text-[0.9rem] leading-relaxed text-ink-2">{cs.notes}</p>
              <div className="mt-4 grid gap-4 rounded-xl bg-surface-2 p-4 text-[0.85rem] md:grid-cols-2">
                <SummaryBlock title="핵심 내용" items={cs.summary.core} />
                <SummaryBlock title="고객 요구사항" items={cs.summary.requirements} />
                <SummaryBlock title="약속사항" items={cs.summary.promises} />
                <SummaryBlock title="필요한 자료" items={cs.summary.documents} />
                <div className="md:col-span-2"><span className="font-bold text-ink">다음 Action</span> · {cs.summary.nextAction}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "contract" && (
        <>
        <div className="space-y-2 lg:hidden">
          {contracts.map((ct) => (
            <div key={ct.id} className="card p-4">
              <div className="flex items-center gap-2"><span className="truncate font-bold">{ct.title}</span><Badge tone={ct.status === "signed" ? "success" : ct.status === "sent" ? "warning" : "neutral"}>{ct.status === "signed" ? "서명 완료" : ct.status === "sent" ? "서명 대기" : "초안"}</Badge></div>
              <div className="mt-1 truncate text-[0.85rem] text-ink-2">{ct.scope}</div>
              <div className="mt-2 flex flex-wrap gap-x-3 text-[0.78rem] text-ink-3"><span>{ct.period}</span><span>송부 {ct.sentAt ? fmtDate(ct.sentAt) : "-"}</span><span>서명 {ct.signedAt ? fmtDate(ct.signedAt) : "-"}</span></div>
            </div>
          ))}
          {contracts.length === 0 && <div className="rounded-xl border border-dashed border-line-2 py-8 text-center text-[0.85rem] text-ink-3">계약 기록이 없습니다.</div>}
        </div>
        <Card className="hidden lg:block">
          <table className="tbl">
            <thead><tr><th>계약명</th><th>프로젝트</th><th>상태</th><th>기간</th><th>송부일</th><th>서명일</th><th>범위</th></tr></thead>
            <tbody>
              {contracts.map((ct) => (
                <tr key={ct.id}>
                  <td className="font-semibold">{ct.title}</td>
                  <td>{st.projects.find((p) => p.id === ct.projectId)?.name}</td>
                  <td><Badge tone={ct.status === "signed" ? "success" : ct.status === "sent" ? "warning" : "neutral"}>{ct.status === "signed" ? "서명 완료" : ct.status === "sent" ? "서명 대기" : "초안"}</Badge></td>
                  <td>{ct.period}</td>
                  <td className="tnum">{ct.sentAt ? fmtDate(ct.sentAt) : "-"}</td>
                  <td className="tnum">{ct.signedAt ? fmtDate(ct.signedAt) : "-"}</td>
                  <td className="text-ink-2">{ct.scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        </>
      )}

      {tab === "project" && (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/ax/projects/${p.id}`} className="card card-hover block p-5">
              <div className="flex items-center justify-between gap-2"><span className="text-[1.05rem] font-bold">{p.name}</span><StageBadge stage={p.stage} /></div>
              <div className="mt-1 text-[0.85rem] text-ink-2">{p.description}</div>
              <StageProgressBar stage={p.stage} className="mt-3" />
              <div className="mt-2 grid grid-cols-3 gap-2 text-[0.8rem] text-ink-3"><span>시작 {fmtDate(p.startDate)}</span><span>마감 {fmtDate(p.dueDate)}</span><span>담당 {st.users.find((u) => u.id === p.consultantId)?.name}</span></div>
            </Link>
          ))}
        </div>
      )}

      {tab === "docs" && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <span className="font-bold">요청자료 {docs.length}건</span>
            {active[0] && <Button size="sm" variant="accent" icon={<Plus size={15} />} onClick={() => setNewDoc(active[0].id)}>자료 요청</Button>}
          </div>
          <div className="divide-y divide-line lg:hidden">
            {docs.map((d) => (
              <button key={d.id} onClick={() => setReviewReq(d)} className="pressable block w-full px-4 py-3 text-left">
                <div className="flex items-center gap-2"><DocStatusBadge status={d.status} /><span className="truncate font-semibold">{d.name}</span></div>
                <div className="mt-1 truncate text-[0.82rem] text-ink-2">{st.projects.find((p) => p.id === d.projectId)?.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[0.78rem] text-ink-3">
                  <DueText iso={d.dueDate} pending={d.status === "requested" || d.status === "revision"} />
                  <span>담당 {st.users.find((u) => u.id === d.assigneeId)?.name}</span>
                </div>
              </button>
            ))}
            {docs.length === 0 && <div className="py-8 text-center text-[0.85rem] text-ink-3">요청자료가 없습니다.</div>}
          </div>
          <div className="hidden lg:block">
            <table className="tbl">
              <thead><tr><th>자료명</th><th>프로젝트</th><th>상태</th><th>제출기한</th><th>제출일</th><th>파일</th><th>담당</th></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="row-clickable" onClick={() => setReviewReq(d)}>
                    <td className="font-semibold">{d.name}</td>
                    <td className="text-ink-2">{st.projects.find((p) => p.id === d.projectId)?.name}</td>
                    <td><DocStatusBadge status={d.status} /></td>
                    <td className="nowrap"><DueText iso={d.dueDate} pending={d.status === "requested" || d.status === "revision"} /></td>
                    <td className="tnum">{d.submittedAt ? fmtDate(d.submittedAt) : "-"}</td>
                    <td className="text-ink-2">{d.files.length ? `${d.files[d.files.length - 1].fileName} (${fmtSize(d.files[d.files.length - 1].size)})` : "-"}</td>
                    <td>{st.users.find((u) => u.id === d.assigneeId)?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "schedule" && (
        <Card className="p-5">
          <SectionTitle action={<Button size="sm" variant="outline" icon={<Plus size={15} />} onClick={() => setNewSchedule(true)}>일정 등록</Button>}>일정</SectionTitle>
          {schedules.length === 0 ? <div className="text-ink-3">등록된 일정이 없습니다.</div> : (
            <>
              <div className="mb-1 text-[0.78rem] font-bold text-ink-3">예정</div>
              <div className="divide-y divide-line">{upcoming.map((s) => <ScheduleItem key={s.id} s={s} />)}</div>
              {schedules.filter((s) => s.start < nowIso).length > 0 && (
                <>
                  <div className="mb-1 mt-5 text-[0.78rem] font-bold text-ink-3">지난 일정</div>
                  <div className="divide-y divide-line opacity-70">{schedules.filter((s) => s.start < nowIso).reverse().map((s) => <ScheduleItem key={s.id} s={s} />)}</div>
                </>
              )}
            </>
          )}
        </Card>
      )}

      {tab === "inquiry" && (
        <div className="space-y-3">
          {inquiries.length === 0 && <Card><EmptyState icon={<MessageSquare size={30} />} title="문의가 없습니다" /></Card>}
          {inquiries.map((iq) => (
            <Link key={iq.id} href={`/ax/inquiries?focus=${iq.id}`} className="card card-hover block p-5">
              <div className="flex flex-wrap items-center gap-2"><InquiryStatusBadge status={iq.status} /><Badge>{iq.category}</Badge><span className="font-bold">{iq.title}</span></div>
              <div className="mt-1.5 line-clamp-2 text-[0.88rem] text-ink-2">{iq.messages[0]?.body}</div>
              <div className="mt-1.5 text-[0.78rem] text-ink-3">{fmtDateTime(iq.createdAt)} · 메시지 {iq.messages.length}</div>
            </Link>
          ))}
        </div>
      )}

      {tab === "results" && (
        <div className="grid gap-3 md:grid-cols-2">
          {results.length === 0 && <Card className="md:col-span-2"><EmptyState icon={<FileCheck2 size={30} />} title="공유된 결과자료가 없습니다" /></Card>}
          {results.map((r) => (
            <Card key={r.id} className="flex items-start gap-3 p-4">
              <IconTile color="var(--mod-evidence)"><FileCheck2 size={18} /></IconTile>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="truncate font-bold">{r.name}</span><Badge>{r.kind}</Badge></div>
                <div className="mt-0.5 text-[0.82rem] text-ink-2">{r.description}</div>
                <div className="mt-1 text-[0.75rem] text-ink-3">{st.projects.find((p) => p.id === r.projectId)?.name} · {fmtDate(r.sharedAt)} · {fmtSize(r.size)} · {st.users.find((u) => u.id === r.sharedBy)?.name}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "history" && (
        <Card className="p-5">
          <SectionTitle action={<Badge tone="info"><Sparkles size={12} /> Evidence Log</Badge>}>전체 이력 ({activities.length})</SectionTitle>
          <ActivityFeed items={activities} />
        </Card>
      )}

      <ReviewDocModal req={reviewReq} open={!!reviewReq} onClose={() => setReviewReq(null)} />
      <NewDocRequestModal projectId={newDoc} open={!!newDoc} onClose={() => setNewDoc(null)} />
      <NewConsultationModal open={newConsult} onClose={() => setNewConsult(false)} companyId={c.id} />
      <NewScheduleModal open={newSchedule} onClose={() => setNewSchedule(false)} companyId={c.id} projectId={active[0]?.id} />
    </div>
  );
}

function SummaryBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 font-bold text-ink">{title}</div>
      {items.length ? <ul className="list-disc space-y-0.5 pl-5 text-ink-2">{items.map((i) => <li key={i}>{i}</li>)}</ul> : <div className="text-ink-3">-</div>}
    </div>
  );
}

export { Stat };
