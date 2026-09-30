"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Building2, ChevronRight, ClipboardCheck, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Company, Project } from "@/lib/types";
import { OVERDUE_CLS, SEVERITY_LABEL, WORK_STATUS, companyAlerts, companyProgress, isOpen, paymentTotals, won, workCell, type OpsAlert, type Severity } from "@/lib/work-status";
import { todayYmd } from "@/lib/vault";
import { Badge, Card, cx } from "@/components/ui/ui";
import { Chip } from "@/components/ui/chips";
import { WorkChip, WorkStatusSheet } from "./WorkTab";

/**
 * 업체별 현황표 — 여러 기업을 한 화면에서 보고, 빠뜨린 일이 없는지 확인한다.
 * 열은 KPJK 가 실제로 하고 있는 프로젝트 유형에서 만든다(데이터에 없는 업무를 칸으로 미리 만들지 않는다).
 * 급한 기업이 위로 온다: 지금 처리할 일 수 → 전체 경고 수 → 가장 가까운 기한.
 */
export function StatusBoard({ companies }: { companies: Company[] }) {
  const projects = useStore((s) => s.projects);
  const vaults = useStore((s) => s.companyVaults);
  const files = useStore((s) => s.companyFiles);
  const payments = useStore((s) => s.payments);
  const [sheet, setSheet] = useState<Project | null>(null);
  const [sev, setSev] = useState<Severity | "all">("all");
  const [showAll, setShowAll] = useState(false);
  const today = todayYmd();

  const rows = useMemo(() => companies.filter((c) => !c.archived).map((c) => {
    const ctx = { company: c, projects: projects.filter((p) => p.companyId === c.id && !p.archived), vault: vaults.find((v) => v.companyId === c.id), files: files.filter((f) => f.companyId === c.id), payments: payments.filter((p) => p.companyId === c.id), today };
    const alerts = companyAlerts(ctx);
    return { c, ctx, alerts, critical: alerts.filter((a) => a.severity === "critical").length, progress: companyProgress(ctx), money: paymentTotals(ctx.payments, today) };
  }).sort((a, b) => b.critical - a.critical || b.alerts.length - a.alerts.length || (Math.min(...a.alerts.map((x) => x.daysLeft ?? 9999), 9999) - Math.min(...b.alerts.map((x) => x.daysLeft ?? 9999), 9999)) || a.c.name.localeCompare(b.c.name, "ko")), [companies, projects, vaults, files, payments, today]);

  // 열 — 쓰고 있는 프로젝트 유형을 많은 순으로 (최대 6개, 나머지는 "그 외")
  const columns = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of rows) for (const p of r.ctx.projects) count.set(p.type || "기타", (count.get(p.type || "기타") ?? 0) + 1);
    const sorted = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    return sorted.length > 6 ? [...sorted.slice(0, 5), "그 외"] : sorted;
  }, [rows]);
  const colOf = (p: Project) => (columns.includes(p.type || "기타") ? p.type || "기타" : "그 외");

  const allAlerts = rows.flatMap((r) => r.alerts.map((a) => ({ ...a, name: r.c.name })));
  const count = (s: Severity) => allAlerts.filter((a) => a.severity === s).length;
  const shown = allAlerts.filter((a) => sev === "all" || a.severity === sev);
  const unpaid = rows.reduce((s, r) => s + r.money.unpaid, 0);
  const overduePay = rows.reduce((s, r) => s + r.money.overdue, 0);
  const tabHref = (a: OpsAlert) => `/ax/clients/${a.companyId}?tab=${a.tab === "money" ? "contract" : a.tab}`;

  return (
    <div className="space-y-4" id="status-board">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile icon={<AlertTriangle size={16} />} label="지금 처리할 일" value={`${count("critical")}건`} tone={count("critical") ? "error" : "success"} hint={count("critical") ? "마감 지남 · 수금 연체" : "급한 일이 없습니다"} onClick={() => setSev("critical")} />
        <Tile icon={<ClipboardCheck size={16} />} label="곧 처리할 일" value={`${count("warning")}건`} tone={count("warning") ? "warning" : undefined} hint="7일 이내 마감 · 서류 만료 · 회신 지연" onClick={() => setSev("warning")} />
        <Tile icon={<Building2 size={16} />} label="관리 중인 기업" value={`${rows.length}곳`} hint={`진행 업무 ${rows.reduce((s, r) => s + r.ctx.projects.filter((p) => isOpen(workCell(p, today).status)).length, 0)}건`} />
        <Tile icon={<Wallet size={16} />} label="못 받은 돈" value={won(unpaid)} tone={overduePay ? "error" : undefined} hint={overduePay ? `예정일 지난 건 ${overduePay}건` : "연체 없음"} />
      </div>

      {allAlerts.length > 0 && (
        <Card className="p-4" id="board-alerts">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-bold">지금 챙길 것</span>
            <div role="group" aria-label="급한 정도" className="flex flex-wrap gap-1">
              <Chip selected={sev === "all"} onClick={() => setSev("all")}>전체 {allAlerts.length}</Chip>
              {(["critical", "warning", "info"] as Severity[]).map((s) => <Chip key={s} selected={sev === s} onClick={() => setSev(s)}>{SEVERITY_LABEL[s]} {count(s)}</Chip>)}
            </div>
          </div>
          <ul className="space-y-1.5">
            {(showAll ? shown : shown.slice(0, 8)).map((a) => (
              <li key={`${a.companyId}:${a.id}`}>
                <Link href={tabHref(a)} className={cx("pressable relative flex items-center gap-2 overflow-hidden rounded-xl border py-2 pl-4 pr-3",
                  a.severity === "critical" ? "border-error/30 bg-error-bg/40" : a.severity === "warning" ? "border-warning/30 bg-warning-bg/40" : "border-line bg-surface-2/50")}>
                  <span className={cx("absolute inset-y-0 left-0 w-1", a.severity === "critical" ? "bg-error" : a.severity === "warning" ? "bg-warning" : "bg-line-2")} aria-hidden />
                  <span className="min-w-0 flex-1"><span className="block text-[0.86rem] font-semibold">{a.title}</span><span className="block text-[0.75rem] text-ink-3">{a.name}{a.detail ? ` · ${a.detail}` : ""}</span></span>
                  <ChevronRight size={15} className="shrink-0 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
          {shown.length > 8 && !showAll && <button type="button" onClick={() => setShowAll(true)} className="mt-2 text-[0.82rem] font-semibold text-accent">{shown.length - 8}건 더 보기</button>}
        </Card>
      )}

      {/* 폰: 기업 카드 */}
      <ul className="space-y-3 lg:hidden" id="board-cards">
        {rows.map((r) => {
          const open = r.ctx.projects.filter((p) => { const cell = workCell(p, today); return isOpen(cell.status) || cell.overdue; });
          const rest = r.ctx.projects.length - open.length;
          return (
            <li key={r.c.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <Link href={`/ax/clients/${r.c.id}`} className="text-[1.05rem] font-bold hover:text-accent">{r.c.name}</Link>
                {r.critical > 0 && <Badge tone="error">지금 처리 {r.critical}</Badge>}
                <span className="ml-auto text-[0.78rem] text-ink-3">진행 {r.progress.percent}%</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {open.length === 0 ? <span className="text-[0.82rem] text-ink-3">진행 중인 업무가 없습니다</span>
                  : open.map((p) => <span key={p.id} className="flex max-w-full items-center gap-1 text-[0.78rem]"><span className="truncate text-ink-2">{p.type}</span><WorkChip project={p} compact onClick={() => setSheet(p)} /></span>)}
                {rest > 0 && <span className="text-[0.75rem] text-ink-3">그 외 {rest}건(완료·보류)</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 text-[0.8rem] text-ink-3">
                <Link href={`/ax/clients/${r.c.id}?tab=vault`} className="hover:text-ink">서류 {r.progress.docsUsable}/{r.progress.docsTotal}</Link>
                {r.money.unpaid > 0 && <Link href={`/ax/clients/${r.c.id}?tab=contract`} className={r.money.overdue ? "font-semibold text-error" : "hover:text-ink"}>못 받은 돈 {won(r.money.unpaid)}</Link>}
              </div>
            </li>
          );
        })}
      </ul>

      {/* PC: 표 */}
      <Card className="hidden overflow-x-auto lg:block" id="board-table">
        <table className="tbl min-w-[860px]">
          <caption className="sr-only">업체별 진행 업무 현황</caption>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface">기업</th>
              {columns.map((col) => <th key={col} className="text-center">{col}</th>)}
              <th className="text-center">서류</th>
              <th className="text-right">못 받은 돈</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.c.id}>
                <th scope="row" className="sticky left-0 z-10 bg-surface text-left align-top font-normal">
                  <Link href={`/ax/clients/${r.c.id}`} className="font-bold hover:text-accent">{r.c.name}</Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.75rem] text-ink-3">
                    {r.critical > 0 && <Badge tone="error">!{r.critical}</Badge>}
                    <span>진행 {r.progress.percent}%</span>
                  </div>
                </th>
                {columns.map((col) => {
                  const ps = r.ctx.projects.filter((p) => colOf(p) === col);
                  return (
                    <td key={col} className="text-center align-top">
                      {ps.length === 0 ? <span className="text-ink-3">—</span> : (
                        <div className="flex flex-col items-center gap-1">
                          {ps.map((p) => <WorkChip key={p.id} project={p} compact onClick={() => setSheet(p)} />)}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="text-center align-top"><Link href={`/ax/clients/${r.c.id}?tab=vault`} className={cx("tnum font-semibold", r.progress.docsUsable < r.progress.docsTotal ? "text-ink" : "text-success")}>{r.progress.docsUsable}/{r.progress.docsTotal}</Link></td>
                <td className="text-right align-top"><span className={cx("tnum font-semibold", r.money.overdue ? "text-error" : "")}>{r.money.unpaid ? won(r.money.unpaid) : "—"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.78rem] text-ink-3" id="board-legend">
        <span className="font-semibold text-ink-2">색 보는 법</span>
        {(["not_started", "in_progress", "waiting_client", "done", "on_hold"] as const).map((w) => <span key={w} className={cx("rounded-full border px-2 py-0.5 font-semibold", WORK_STATUS[w].cls)}>{WORK_STATUS[w].short}</span>)}
        <span className={cx("rounded-full border px-2 py-0.5 font-semibold", OVERDUE_CLS)}>기한 지남</span>
        <span>· 칸을 누르면 상태를 바꿉니다 · 회신 7일 이상 대기·서류 만료 30일 이내는 &ldquo;곧 처리&rdquo;</span>
      </div>
      <WorkStatusSheet project={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}

function Tile({ icon, label, value, hint, tone, onClick }: { icon: React.ReactNode; label: string; value: string; hint?: string; tone?: "error" | "warning" | "success"; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cx("card flex flex-col items-start p-4 text-left", onClick && "pressable")}>
      <span className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-ink-3">{icon}{label}</span>
      <span className={cx("tnum mt-1 text-[1.35rem] font-bold", tone === "error" && "text-error", tone === "warning" && "text-warning", tone === "success" && "text-success")}>{value}</span>
      {hint && <span className="mt-0.5 text-[0.72rem] text-ink-3">{hint}</span>}
    </Tag>
  );
}
