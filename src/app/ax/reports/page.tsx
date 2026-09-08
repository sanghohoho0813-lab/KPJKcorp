"use client";

import { useMemo, useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { useStore } from "@/lib/store";
import { daysBetween, fmtDateTime } from "@/lib/format";
import { INTERNAL_STAGES } from "@/lib/stages";
import { Badge, Button, Card, DemoBadge, PageHeader, SectionTitle, Tabs } from "@/components/ui/ui";
import { ActivityFeed } from "@/components/domain/domain";

export default function ReportsPage() {
  const st = useStore();
  const toast = useStore((s) => s.toast);
  const [tab, setTab] = useState<"kpi" | "ops" | "evidence">("kpi");
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
    return { avgLead, portalUploads, inquiries, progressInq, avgResp, overdueDocs, perConsultant, portalLogins, stageCount, activeProjects: st.projects.filter((p) => !["done", "aftercare"].includes(p.stage)).length };
  }, [st, now]);

  const exportCsv = () => {
    const rows = [["at", "type", "company", "project", "actor", "role", "text"], ...st.activities.map((a) => [a.at, a.type, st.companies.find((c) => c.id === a.companyId)?.name ?? "", st.projects.find((p) => p.id === a.projectId)?.name ?? "", st.users.find((u) => u.id === a.actorId)?.name ?? a.actorId, a.actorRole, a.text])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `kpjk_evidence_${now.slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast("Evidence Log CSV를 내려받았습니다.");
  };

  const kpis: { group: string; items: { name: string; point: string; demo: string; baseline: string }[] }[] = [
    { group: "EFFICIENCY", items: [
      { name: "자료요청 → 제출 완료 소요기간", point: "document_requested → document_uploaded 시각 차이", demo: `${m.avgLead}일 (Demo 평균)`, baseline: "측정 필요" },
      { name: "후속업무 누락건수", point: "기한 초과 상태의 Task/DocRequest 수 (주간)", demo: `${m.overdueDocs}건 (현재)`, baseline: "측정 필요" },
      { name: "고객 문의 대응시간", point: "inquiry_created → inquiry_answered", demo: `${m.avgResp}시간 (Demo 평균)`, baseline: "측정 필요" },
      { name: "고객정보 검색/확인 시간", point: "사용자 설문 + 화면 체류 (실운영 시)", demo: "-", baseline: "측정 필요" },
    ] },
    { group: "CUSTOMER", items: [
      { name: "진행상황 단순문의 건수", point: "Inquiry.category = 진행상황 (월간)", demo: `${m.progressInq} / ${m.inquiries}건`, baseline: "측정 필요" },
      { name: "Portal 직접 자료제출 비율", point: "document_uploaded(actor=client) / 전체 제출", demo: `${m.portalUploads}건 (Demo 전부 Portal)`, baseline: "측정 필요" },
      { name: "Portal Self-Service 이용률", point: "portal_login 사용자 / 전체 고객 (주간)", demo: `${m.portalLogins}회 접속`, baseline: "측정 필요" },
    ] },
    { group: "SCALE", items: [
      { name: "담당자 1인당 동시 관리 기업 수", point: "Company.consultantId 집계", demo: m.perConsultant.map((x) => `${x.u.name} ${x.companies}`).join(" · "), baseline: "측정 필요" },
      { name: "동시 진행 프로젝트 수", point: "stage ∉ {done, aftercare}", demo: `${m.activeProjects}건`, baseline: "측정 필요" },
    ] },
  ];

  return (
    <div>
      <PageHeader title="리포트 · 실증" desc="KPI 측정지점과 Evidence Log입니다. 실제 Baseline이 없는 숫자는 개선율로 표시하지 않습니다." badge={<DemoBadge />} actions={<Button variant="outline" icon={<Download size={16} />} onClick={exportCsv}>Evidence CSV</Button>} />
      <Tabs tabs={[{ key: "kpi", label: "KPI 측정지점" }, { key: "ops", label: "운영 현황" }, { key: "evidence", label: "Evidence Log", count: st.activities.length }]} value={tab} onChange={setTab} />
      <div className="mt-5">
        {tab === "kpi" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-[0.88rem] text-warning"><b>BASELINE STATUS: REQUIRED / UNKNOWN</b> — 도입 전 실제 값(Before)은 운영 시작 시 4주간 측정합니다. 아래 Demo 값은 샘플 데이터에서 계산된 값이며 성과가 아닙니다.</div>
            {kpis.map((g) => (
              <Card key={g.group} className="overflow-x-auto">
                <div className="border-b border-line px-5 py-3 font-bold">{g.group} KPI</div>
                <table className="tbl min-w-[760px]">
                  <thead><tr><th>지표</th><th>측정지점 (Event)</th><th>현재 Demo 값</th><th>Baseline (Before)</th><th>Target</th></tr></thead>
                  <tbody>{g.items.map((k) => <tr key={k.name}><td className="font-semibold">{k.name}</td><td className="text-ink-2">{k.point}</td><td className="tnum">{k.demo}</td><td><Badge tone="warning">{k.baseline}</Badge></td><td className="text-ink-3">실측 후 설정</td></tr>)}</tbody>
                </table>
              </Card>
            ))}
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
