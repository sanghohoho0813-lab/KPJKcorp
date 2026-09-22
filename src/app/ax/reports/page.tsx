"use client";

import { useMemo, useState } from "react";
import { BarChart3, Download, Printer } from "lucide-react";
import { useStore } from "@/lib/store";
import { daysBetween, fmtDateTime } from "@/lib/format";
import { INTERNAL_STAGES } from "@/lib/stages";
import { Badge, Button, Card, DemoBadge, PageHeader, SectionTitle, Tabs, cx } from "@/components/ui/ui";
import { ActivityFeed } from "@/components/domain/domain";
import { AreaBar, WhyEvidence, useSprint } from "@/components/domain/Coach";
import { BaselineCard } from "@/components/domain/BaselineCard";
import { coverageOf } from "@/lib/evidence";
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";

export default function ReportsPage() {
  const st = useStore();
  const toast = useStore((s) => s.toast);
  const logExport = useStore((s) => s.logEvidenceExport);
  const me = useStore((s) => s.session?.userId) ?? "u_admin";
  const [tab, setTab] = useState<"sprint" | "kpi" | "ops" | "evidence">("sprint");
  const sprint = useSprint();
  const now = new Date().toISOString();

  const m = useMemo(() => {
    const done = st.docRequests.filter((d) => d.submittedAt && d.requestedAt);
    const leadDays = done.map((d) => daysBetween(d.requestedAt, d.submittedAt!));
    const avgLead = leadDays.length ? (leadDays.reduce((a, b) => a + b, 0) / leadDays.length).toFixed(1) : "-";
    const portalUploads = st.activities.filter((a) => a.type === "document_uploaded" && a.actorRole === "client").length;
    const inquiries = st.inquiries.length;
    const progressInq = st.inquiries.filter((i) => i.category === "진행상황").length;
    const answered = st.inquiries.filter((i) => i.status !== "open" && i.messages.length >= 2);
    const respHrs = answered.map((i) => (new Date(i.messages[1].createdAt).getTime() - new Date(i.messages[0].createdAt).getTime()) / 3600000);
    const avgResp = respHrs.length ? (respHrs.reduce((a, b) => a + b, 0) / respHrs.length).toFixed(1) : "-";
    const overdueDocs = st.docRequests.filter((d) => (d.status === "requested" || d.status === "revision") && daysBetween(d.dueDate, now) > 0).length;
    const consultants = st.users.filter((u) => u.role === "consultant");
    const perConsultant = consultants.map((u) => ({ u, companies: st.companies.filter((c) => c.consultantId === u.id).length, projects: st.projects.filter((p) => p.consultantId === u.id && !["done", "aftercare"].includes(p.stage)).length }));
    const portalLogins = st.activities.filter((a) => a.type === "portal_login").length;
    const stageCount = INTERNAL_STAGES.map((s) => ({ s, n: st.projects.filter((p) => p.stage === s.key).length }));

    // 매출 축 — 전부 실제 Event 건수. 표본이 적으면 비율 대신 건수로만 말한다.
    const opps = st.opportunities;
    const oppFromClient = opps.filter((o) => o.source === "portal_interest" || o.source === "portal_request").length;
    const oppContacted = opps.filter((o) => o.status !== "interest").length;
    const oppWon = opps.filter((o) => o.status === "won").length;
    const approvals = st.approvals;
    const approvalPending = approvals.filter((a) => a.status === "pending").length;
    const approvalDecided = approvals.filter((a) => a.status !== "pending");
    const approvalHrs = approvalDecided.filter((a) => a.decidedAt).map((a) => (new Date(a.decidedAt!).getTime() - new Date(a.requestedAt).getTime()) / 3600000);
    const avgApproval = approvalHrs.length ? (approvalHrs.reduce((x, y) => x + y, 0) / approvalHrs.length).toFixed(1) : "-";
    const contractsSigned = st.contracts.filter((c) => c.status === "signed").length;
    const contractsSent = st.contracts.filter((c) => c.status === "sent").length;
    const consultCount = st.consultations.length;
    // 견적 — 상담과 계약 사이 구간. 표본이 적으므로 건수로만 말한다.
    const quotes = st.quotes;
    const quotesSent = quotes.filter((q) => ["sent", "accepted", "declined", "converted"].includes(q.status)).length;
    const quotesAccepted = quotes.filter((q) => ["accepted", "converted"].includes(q.status)).length;
    const quotesConverted = quotes.filter((q) => q.status === "converted").length;
    const respHrsQ = quotes.filter((q) => q.sentAt && q.respondedAt).map((q) => (new Date(q.respondedAt!).getTime() - new Date(q.sentAt!).getTime()) / 86400000);
    const avgQuoteResp = respHrsQ.length ? (respHrsQ.reduce((x, y) => x + y, 0) / respHrsQ.length).toFixed(1) : "-";

    // 운영 사용량 축
    const aiSuggested = st.activities.filter((a) => a.actorRole === "system").length;
    const portalCompanies = new Set(st.activities.filter((a) => a.actorRole === "client" && a.companyId).map((a) => a.companyId)).size;
    const autoTasks = st.tasks.filter((t) => t.source === "auto").length;
    const autoTasksDone = st.tasks.filter((t) => t.source === "auto" && t.status === "done").length;
    const surveys = st.surveys.length;

    // 기록 보유 기간 — "성과 기간"이 아니라 "이 로그가 담고 있는 기간"
    const ats = st.activities.map((a) => a.at).sort();
    const logSpanDays = ats.length ? Math.max(1, daysBetween(ats[0], ats[ats.length - 1]) + 1) : 0;

    return {
      avgLead, portalUploads, inquiries, progressInq, avgResp, overdueDocs, perConsultant, portalLogins, stageCount,
      activeProjects: st.projects.filter((p) => !["done", "aftercare"].includes(p.stage)).length,
      oppTotal: opps.length, oppFromClient, oppContacted, oppWon,
      approvalPending, approvalDecided: approvalDecided.length, avgApproval,
      contractsSigned, contractsSent, consultCount,
      quotesTotal: quotes.length, quotesSent, quotesAccepted, quotesConverted, avgQuoteResp,
      aiSuggested, portalCompanies, autoTasks, autoTasksDone, surveys,
      events: st.activities.length, logSpanDays,
    };
  }, [st, now]);

  const exportCsv = () => {
    const rows = [["at", "type", "company", "project", "actor", "role", "text"], ...st.activities.map((a) => [a.at, a.type, st.companies.find((c) => c.id === a.companyId)?.name ?? "", st.projects.find((p) => p.id === a.projectId)?.name ?? "", st.users.find((u) => u.id === a.actorId)?.name ?? a.actorId, a.actorRole, a.text])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `kpjk_evidence_${now.slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    logExport(me, st.activities.length);
    toast("Evidence Log CSV를 내려받았습니다.");
  };

  interface Metric { name: string; point: string; value: string; baseline?: string }
  const axes: { key: string; title: string; desc: string; items: Metric[] }[] = [
    {
      key: "usage",
      title: "운영 사용량",
      desc: "시스템이 실제로 쓰이고 있는가 — 사용량이 없으면 그 뒤의 어떤 숫자도 의미가 없다.",
      items: [
        { name: "기록된 Event", point: "Activity append-only 로그", value: `${m.events}건` },
        { name: "기록 보유 기간", point: "최초 ~ 최신 Event 간격", value: m.logSpanDays ? `${m.logSpanDays}일` : "-" },
        { name: "Portal 이용 기업", point: "고객 행동(로그인·제출·문의)이 있는 기업 수", value: `${m.portalCompanies} / ${st.companies.length}개사` },
        { name: "자동 생성 업무", point: "Task.source = auto", value: `${m.autoTasks}건 (완료 ${m.autoTasksDone})` },
        { name: "규칙·시스템 제안 건수", point: "actorRole = system 인 Event", value: `${m.aiSuggested}건` },
        { name: "개선 의견 제출", point: "survey_submitted", value: `${m.surveys}건` },
      ],
    },
    {
      key: "efficiency",
      title: "업무 효율",
      desc: "같은 인력으로 더 많은 고객을 놓치지 않고 관리할 수 있는가.",
      items: [
        { name: "자료요청 → 제출 소요기간", point: "document_requested → document_uploaded", value: `${m.avgLead}일`, baseline: "측정 필요" },
        { name: "후속업무 누락 (기한 초과)", point: "기한 지난 미제출·보완필요", value: `${m.overdueDocs}건`, baseline: "측정 필요" },
        { name: "고객 문의 대응시간", point: "inquiry_created → inquiry_answered", value: `${m.avgResp}시간`, baseline: "측정 필요" },
        { name: "대표 승인 소요시간", point: "approval_requested → approval_decided", value: m.avgApproval === "-" ? "표본 없음" : `${m.avgApproval}시간`, baseline: "측정 필요" },
        { name: "담당자 1인당 관리 기업", point: "Company.consultantId 집계", value: m.perConsultant.map((x) => `${x.u.name} ${x.companies}`).join(" · "), baseline: "측정 필요" },
        { name: "동시 진행 프로젝트", point: "stage ∉ {done, aftercare}", value: `${m.activeProjects}건` },
      ],
    },
    {
      key: "customer",
      title: "고객",
      desc: "고객이 직접 참여하고 있는가. 참여가 늘면 단순 확인 문의가 줄어든다.",
      items: [
        { name: "Portal 접속", point: "portal_login", value: `${m.portalLogins}회` },
        { name: "고객 직접 자료제출", point: "document_uploaded (actor = client)", value: `${m.portalUploads}건` },
        { name: "진행상황 단순문의 비중", point: "Inquiry.category = 진행상황", value: `${m.progressInq} / ${m.inquiries}건`, baseline: "측정 필요" },
        { name: "고객 발신 추가요청", point: "portal_interest · portal_request", value: `${m.oppFromClient}건` },
        { name: "결과자료 열람", point: "result_downloaded", value: `${st.activities.filter((a) => a.type === "result_downloaded").length}회` },
      ],
    },
    {
      key: "revenue",
      title: "매출",
      desc: "문의 → 상담 → 견적 → 계약이 어디서 끊기는가. 표본이 쌓이기 전에는 비율 대신 건수로만 본다.",
      items: [
        { name: "누적 상담 기록", point: "Consultation", value: `${m.consultCount}건` },
        { name: "매출기회", point: "Opportunity 생성", value: `${m.oppTotal}건 (고객 발신 ${m.oppFromClient})` },
        { name: "기회 → 담당자 접촉", point: "status ≠ interest", value: `${m.oppContacted} / ${m.oppTotal}건` },
        { name: "견적 발송", point: "quote_sent", value: `${m.quotesSent} / 작성 ${m.quotesTotal}건` },
        { name: "견적 → 수락", point: "Quote.status ∈ {accepted, converted}", value: `${m.quotesAccepted} / ${m.quotesSent}건`, baseline: "표본 부족" },
        { name: "견적 회신 소요일", point: "quote_sent → quote_responded", value: m.avgQuoteResp === "-" ? "표본 없음" : `${m.avgQuoteResp}일`, baseline: "측정 필요" },
        { name: "견적 → 계약 전환", point: "quote_converted", value: `${m.quotesConverted} / ${m.quotesSent}건`, baseline: "표본 부족" },
        { name: "기회 → 추가계약", point: "status = won", value: `${m.oppWon} / ${m.oppTotal}건`, baseline: "표본 부족" },
        { name: "계약 체결 / 발송", point: "Contract.status", value: `${m.contractsSigned}건 / 발송 ${m.contractsSent}건` },
        { name: "대표 승인 처리", point: "approval_decided", value: `처리 ${m.approvalDecided}건 · 대기 ${m.approvalPending}건` },
      ],
    },
  ];

  return (
    <div>
      <PageHeader title="리포트 · 실증" desc="KPI 측정지점과 Evidence Log입니다. 실제 Baseline이 없는 숫자는 개선율로 표시하지 않습니다." badge={<DemoBadge />} actions={<><Button variant="outline" icon={<Download size={16} />} onClick={exportCsv}>Evidence CSV</Button><Link href="/print/evidence" className="pressable lift inline-flex h-11 items-center gap-2 rounded-[var(--radius-btn)] bg-accent px-4 text-[0.9rem] font-semibold text-accent-ink"><Printer size={16} /> 실증 리포트 인쇄 · PDF</Link></>} />
      <Tabs tabs={[{ key: "kpi", label: "KPI 측정지점" }, { key: "ops", label: "운영 현황" }, { key: "evidence", label: "Evidence Log", count: st.activities.length }]} value={tab} onChange={setTab} />
      <div className="mt-5">
        {tab === "sprint" && (
          <div className="space-y-5">
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-soft text-accent"><Compass size={18} /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[1.05rem] font-bold">{sprint.active ? `AX 실증 ${sprint.day}일차` : "실증 모드 시작 전"}</h2>
                  <p className="mt-0.5 text-[0.85rem] text-ink-2">
                    {sprint.active
                      ? `미션 ${sprint.doneCount} / ${sprint.missions.length} 완료 · 이 기간에 기록된 Event만 집계합니다.`
                      : "AX 코치에서 실증을 시작하면 이 화면이 기간 기준으로 집계됩니다. 지금은 전체 기간 기준입니다."}
                  </p>
                </div>
                <Link href="/ax/coach" className="link-more link-accent shrink-0">AX 코치 <ArrowRight size={14} /></Link>
              </div>
            </Card>

            <BaselineCard />

            <Card className="p-5">
              <SectionTitle action={<span className="tnum text-[0.85rem] text-ink-3">평균 {sprint.score} / 100</span>}>Evidence Coverage</SectionTitle>
              <p className="-mt-1 mb-4 text-[0.85rem] text-ink-2">
                6개 영역이 각각 얼마나 채워졌는지입니다. 목표치는 14일 실증 기준 최소 건수이며, 성과나 개선율이 아닙니다.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {sprint.areas.map((a) => (
                  <div key={a.key} className="rounded-xl border border-line p-4">
                    <AreaBar a={a} />
                    <p className="mt-2 text-[0.8rem] leading-relaxed text-ink-2">{a.why}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={coverageOf(a) >= 100 ? "success" : coverageOf(a) >= 40 ? "warning" : "error"}>
                        {coverageOf(a) >= 100 ? "충분" : coverageOf(a) >= 40 ? "수집 중" : a.count === 0 ? "기록 없음" : "부족"}
                      </Badge>
                      <Link href={a.href} className="link-more text-[0.8rem]">{a.how} →</Link>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="coach-box p-5">
              <WhyEvidence />
            </Card>

            <Card className="p-5">
              <SectionTitle>미션 진행</SectionTitle>
              <div className="divide-y divide-line">
                {sprint.missions.map((m) => (
                  <div key={m.key} className="flex items-center gap-3 py-2.5">
                    <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[0.7rem] font-bold", m.done ? "bg-success text-white" : "bg-surface-2 text-ink-3")}>{m.done ? "✓" : `D${m.day}`}</span>
                    <span className={cx("min-w-0 flex-1 text-[0.9rem]", m.done ? "font-semibold" : "text-ink-2")}>{m.title}</span>
                    <span className="shrink-0 text-[0.78rem] text-ink-3">{m.progress}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
        {tab === "kpi" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-[0.88rem] text-warning">
              <b>BASELINE STATUS: REQUIRED / UNKNOWN</b> — 도입 전 값(Before)이 아직 없습니다. 운영 시작 후 4주간 수집하며, 그 전까지는 개선율을 만들지 않고 <b>현재 표본 수</b>만 표시합니다.
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="card p-4"><div className="text-[0.75rem] font-bold text-ink-3">기록된 Event</div><div className="tnum text-[1.5rem] font-bold">{m.events}</div></div>
              <div className="card p-4"><div className="text-[0.75rem] font-bold text-ink-3">기록 보유 기간</div><div className="tnum text-[1.5rem] font-bold">{m.logSpanDays}일</div></div>
              <div className="card p-4"><div className="text-[0.75rem] font-bold text-ink-3">Baseline 수집</div><div className="text-[1.1rem] font-bold text-warning">미시작</div></div>
            </div>

            {axes.map((g) => (
              <Card key={g.key} className="p-5">
                <SectionTitle>{g.title}</SectionTitle>
                <p className="-mt-1 mb-3 text-[0.85rem] text-ink-2">{g.desc}</p>
                <div className="divide-y divide-line">
                  {g.items.map((k) => (
                    <div key={k.name} className="flex flex-col gap-1 py-3 md:flex-row md:items-center md:gap-4">
                      <div className="min-w-0 md:w-[34%]">
                        <div className="font-semibold">{k.name}</div>
                        <div className="mt-0.5 text-[0.78rem] text-ink-3">{k.point}</div>
                      </div>
                      <div className={cx("tnum min-w-0 flex-1 font-semibold", k.value === "표본 없음" && "text-ink-3")}>{k.value}</div>
                      <div className="shrink-0">{k.baseline ? <Badge tone="warning">{k.baseline}</Badge> : <span className="text-[0.78rem] text-ink-3">측정 중</span>}</div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}

            <Card className="p-5">
              <SectionTitle>이 리포트를 외부에 설명할 때</SectionTitle>
              <ol className="list-decimal space-y-1.5 pl-5 text-[0.88rem] text-ink-2">
                <li><b className="text-ink">무엇이 바뀌었나</b> — 기억·카톡·개별파일 → 고객이 직접 참여하는 하나의 기록 체계</li>
                <li><b className="text-ink">근거는 무엇인가</b> — 위 지표는 전부 Event Log에서 계산되며 수기 입력이 없습니다</li>
                <li><b className="text-ink">아직 없는 것은 무엇인가</b> — 도입 전 Baseline. 그래서 개선율을 제시하지 않습니다</li>
                <li><b className="text-ink">언제 말할 수 있나</b> — 운영 4주 후 Before/After 비교가 가능해집니다</li>
              </ol>
              <p className="mt-3 text-[0.8rem] text-ink-3">Evidence Pack 구조: Baseline → Trigger → Recommendation → Human Approval → Action → Result → KPI Delta → Provenance.</p>
            </Card>
          </div>
        )}
        {tab === "ops" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <SectionTitle>단계별 프로젝트 분포</SectionTitle>
              <div className="space-y-2">
                {m.stageCount.map(({ s, n }) => (
                  <div key={s.key} className="flex items-center gap-3 text-[0.88rem]"><span className="w-20 shrink-0 text-ink-2">{s.label}</span><div className="h-5 flex-1 overflow-hidden rounded-md bg-surface-2"><div className="h-full rounded-md bg-primary/80" style={{ width: `${Math.max(n ? 8 : 0, (n / Math.max(1, st.projects.length)) * 100)}%` }} /></div><span className="tnum w-6 text-right font-semibold">{n}</span></div>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <SectionTitle>담당자별 관리 현황</SectionTitle>
              <table className="tbl"><thead><tr><th>담당자</th><th>관리 기업</th><th>진행 프로젝트</th></tr></thead><tbody>{m.perConsultant.map((x) => <tr key={x.u.id}><td className="font-semibold">{x.u.name} <span className="text-ink-3">{x.u.title}</span></td><td className="tnum">{x.companies}</td><td className="tnum">{x.projects}</td></tr>)}</tbody></table>
              <div className="mt-3 text-[0.78rem] text-ink-3">SCALE KPI: 같은 인력으로 관리 가능한 기업 수 추이를 월별로 기록합니다.</div>
            </Card>
            <Card className="p-5 lg:col-span-2">
              <SectionTitle><span className="flex items-center gap-2"><BarChart3 size={18} className="text-ink-3" /> Data Asset — 12개월 후 가능해지는 판단</span></SectionTitle>
              <div className="grid gap-3 md:grid-cols-3 text-[0.88rem]">
                <div className="rounded-xl bg-surface-2 p-4"><b>프로젝트 유형별 표준 소요기간</b><p className="mt-1 text-ink-2">경영진단·연구소·정책자금별 단계 소요일을 근거로 계약 시 일정 약속의 정확도를 높입니다.</p></div>
                <div className="rounded-xl bg-surface-2 p-4"><b>병목 단계 식별</b><p className="mt-1 text-ink-2">어느 단계에서 가장 오래 멈추는지(주로 자료제출)를 데이터로 확인해 요청 방식·양식을 개선합니다.</p></div>
                <div className="rounded-xl bg-surface-2 p-4"><b>고객 응답 패턴</b><p className="mt-1 text-ink-2">기업별 자료 제출 리드타임·문의 빈도를 알면 리마인드 시점과 담당 배분을 최적화할 수 있습니다.</p></div>
              </div>
            </Card>
          </div>
        )}
        {tab === "evidence" && (
          <Card className="p-5">
            <div className="mb-3 text-[0.85rem] text-ink-2">Evidence Pack 구조: Baseline → Trigger → Recommendation → Human Approval → Action → Result → KPI Delta → Provenance → User/Time Log. 모든 Event는 Append-only로 기록됩니다. 마지막 기록: {st.activities[0] ? fmtDateTime(st.activities[0].at) : "-"}</div>
            <ActivityFeed items={st.activities} showCompany />
          </Card>
        )}
      </div>
    </div>
  );
}
