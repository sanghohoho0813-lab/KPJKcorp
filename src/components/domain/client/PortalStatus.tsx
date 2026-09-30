"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Eye, Link2, Link2Off } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Company } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import { liveNoticesFor } from "@/components/domain/Notices";
import { Badge, Button, Card, SectionTitle, cx } from "@/components/ui/ui";
import { SEVERITY_LABEL, companyAlerts, type OpsAlert } from "@/lib/work-status";

/**
 * 고객 플랫폼 연결 — 이 기업이 KPJK 고객 Portal 에서 무엇을 보고 있는가.
 * 연결은 "담당자 Portal 계정"이다. 계정이 있어야 고객이 진행상황을 보고 자료를 낸다.
 */
export function PortalStatus({ company, onMakeAccount }: { company: Company; onMakeAccount?: () => void }) {
  const st = useStore();
  const router = useRouter();
  const setPreview = useStore((s) => s.setPortalPreview);
  const accounts = st.users.filter((u) => u.role === "client" && u.companyId === company.id);
  const active = accounts.filter((u) => u.active !== false);
  const lastLogin = st.activities.filter((a) => a.companyId === company.id && a.type === "portal_login").sort((a, b) => b.at.localeCompare(a.at))[0];
  const nowIso = new Date().toISOString();
  const visible = {
    projects: st.projects.filter((p) => p.companyId === company.id && p.clientVisible && !p.archived).length,
    requests: st.docRequests.filter((d) => d.companyId === company.id && (d.status === "requested" || d.status === "revision")).length,
    notices: liveNoticesFor(st.notices, company.id, nowIso).length,
    results: st.results.filter((r) => r.companyId === company.id).length,
    schedules: st.schedules.filter((s) => s.companyId === company.id && s.visibleToClient && s.start >= nowIso).length,
  };
  const connected = active.length > 0;
  return (
    <Card className="p-5" id="portal-status">
      <SectionTitle action={<Button size="sm" variant="outline" icon={<Eye size={14} />} onClick={() => { setPreview(company.id); router.push("/portal"); }}>고객 화면 보기</Button>}>
        <span className="flex items-center gap-2">{connected ? <Link2 size={18} className="text-success" /> : <Link2Off size={18} className="text-warning" />} 고객 플랫폼 연결</span>
      </SectionTitle>
      {connected ? (
        <div className="space-y-1 text-[0.88rem]">
          {active.map((u) => <div key={u.id} className="flex flex-wrap items-center gap-2"><Badge tone="success">연결됨</Badge><b>{u.name}</b><span className="text-ink-3">{u.email}</span></div>)}
          <p className="text-[0.8rem] text-ink-3">마지막 접속 {lastLogin ? fmtDateTime(lastLogin.at) : "아직 없음"}</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-warning-bg px-3 py-2.5 text-[0.85rem] text-warning">
          <span className="min-w-0 flex-1">{accounts.length ? "담당자 Portal 계정이 사용 중지 상태입니다." : "아직 연결되지 않았습니다 — 담당자 Portal 계정을 만들면 고객이 진행상황을 보고 자료를 직접 냅니다."}</span>
          {onMakeAccount && !accounts.length && <Button size="sm" variant="accent" onClick={onMakeAccount}>계정 만들기</Button>}
        </div>
      )}
      <div className="mt-3 text-[0.78rem] font-semibold text-ink-3">고객에게 지금 보이는 것</div>
      <div className="mt-1 grid grid-cols-3 gap-2 md:grid-cols-5">
        {([["진행 프로젝트", visible.projects], ["내야 할 자료", visible.requests], ["공지", visible.notices], ["다가올 일정", visible.schedules], ["완료자료", visible.results]] as const).map(([l, n]) => (
          <div key={l} className="rounded-xl bg-surface-2 px-2.5 py-2"><div className="text-[0.72rem] text-ink-3">{l}</div><div className="tnum text-[1.1rem] font-bold">{n}</div></div>
        ))}
      </div>
      <p className="mt-2 text-[0.75rem] text-ink-3">서류함 · 업무 일기 · 수금 · 진행 상태 메모는 고객에게 보이지 않습니다.</p>
    </Card>
  );
}

/** 이 기업에서 지금 챙길 것 — 마감 지남 · 회신 지연 · 서류 만료 · 수금 연체 */
export function CompanyAlertsCard({ company, onOpen }: { company: Company; onOpen: (tab: OpsAlert["tab"]) => void }) {
  const projects = useStore((s) => s.projects);
  const vault = useStore((s) => s.companyVaults.find((v) => v.companyId === company.id));
  const files = useStore((s) => s.companyFiles);
  const payments = useStore((s) => s.payments);
  const alerts = companyAlerts({ company, projects: projects.filter((p) => p.companyId === company.id), vault, files: files.filter((f) => f.companyId === company.id), payments: payments.filter((p) => p.companyId === company.id) });
  if (!alerts.length) return null;
  return (
    <Card className="p-5" id="company-alerts">
      <SectionTitle><span className="flex items-center gap-2"><AlertTriangle size={17} className="text-warning" /> 지금 챙길 것 {alerts.length}건</span></SectionTitle>
      <ul className="space-y-1.5">
        {alerts.slice(0, 6).map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => onOpen(a.tab)} className={cx("pressable relative flex w-full items-center gap-2 overflow-hidden rounded-xl border py-2 pl-4 pr-3 text-left",
              a.severity === "critical" ? "border-error/30 bg-error-bg/40" : a.severity === "warning" ? "border-warning/30 bg-warning-bg/40" : "border-line bg-surface-2/50")}>
              <span className={cx("absolute inset-y-0 left-0 w-1", a.severity === "critical" ? "bg-error" : a.severity === "warning" ? "bg-warning" : "bg-line-2")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.88rem] font-semibold">{a.title}</span>
                {a.detail && <span className="block text-[0.75rem] text-ink-3">{a.detail}</span>}
              </span>
              <span className="shrink-0 text-[0.72rem] font-bold text-ink-3">{SEVERITY_LABEL[a.severity]}</span>
              <ChevronRight size={15} className="shrink-0 text-ink-3" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
