"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, FileSignature, RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtDate, fmtWon } from "@/lib/format";
import { daysFromTo, todayYmd } from "@/lib/vault";
import { missingEndContracts, renewalStage, RENEWAL_STAGE_LABEL, type RenewalStage } from "@/lib/renewal";
import type { Contract } from "@/lib/types";
import { Badge, Card, EmptyState, LinkButton, SegmentedControl, cx, type Tone } from "@/components/ui/ui";

/** 종료 며칠 전부터 '만료 임박'으로 보는가 — 갱신 협의 규칙의 가장 긴 기준일(90일)보다 짧게, 견적을 낼 시간은 남게 */
export const RENEWAL_SOON_DAYS = 60;

type View = "all" | "soon" | "noend";
const STATUS: Record<Contract["status"], { label: string; tone: Tone }> = { signed: { label: "서명 완료", tone: "success" }, sent: { label: "서명 대기", tone: "warning" }, draft: { label: "초안", tone: "neutral" } };
const STAGE_TONE: Record<RenewalStage, Tone> = { none: "neutral", quote_draft: "info", quote_sent: "info", accepted: "success", declined: "error", renewed: "success" };

interface Row { ct: Contract; left?: number; stage: RenewalStage; soon: boolean; noEnd: boolean }

/**
 * 계약 목록 — 대표가 "어느 계약이 곧 끝나고, 갱신은 어디까지 갔는지"를 한 화면에서 본다.
 *  만료 임박: 서명 계약 중 종료 60일 전부터 종료 후 60일까지(갱신 계약으로 이어진 것은 빠진다), 가까운 순.
 *  종료일 없음: 서명했는데 종료일이 비어 만료 전 갱신 협의 업무가 만들어지지 않는 계약.
 * 갱신 진행은 갱신 견적 상태로만 말한다(견적 없이 구두로 갱신한 것은 알 수 없다).
 */
export function ContractBoard({ contracts, onEdit }: { contracts: Contract[]; onEdit?: (id: string) => void }) {
  const st = useStore();
  const today = todayYmd();
  const [view, setView] = useState<View>("all");
  const rows = useMemo<Row[]>(() => {
    const missing = new Set(missingEndContracts(contracts).map((c) => c.id));
    return contracts.map((ct) => {
      const left = ct.endDate ? daysFromTo(today, ct.endDate.slice(0, 10)) : undefined;
      const stage = ct.status === "signed" ? renewalStage(ct, st.quotes).stage : "none";
      // 끝난 지 60일이 넘은 계약은 임박 목록에서 내려간다 — 일회성 계약(인증 자문 등)이 계속 쌓이지 않게
      const soon = ct.status === "signed" && left !== undefined && left <= RENEWAL_SOON_DAYS && left >= -RENEWAL_SOON_DAYS && stage !== "renewed";
      return { ct, left, stage, soon, noEnd: missing.has(ct.id) };
    });
  }, [contracts, st.quotes, today]);
  const soon = rows.filter((r) => r.soon).sort((a, b) => (a.left ?? 0) - (b.left ?? 0));
  const noEnd = rows.filter((r) => r.noEnd);
  const shown = view === "soon" ? soon : view === "noend" ? noEnd : rows;
  const company = (id: string) => st.companies.find((c) => c.id === id)?.name ?? "";
  const project = (id: string) => st.projects.find((p) => p.id === id)?.name ?? "";

  const dday = (r: Row) => {
    if (r.ct.status !== "signed" || r.left === undefined) return null;
    if (r.stage === "renewed") return r.left <= RENEWAL_SOON_DAYS ? <Badge tone="success">갱신됨</Badge> : null;
    if (r.left < 0) return <Badge tone="error">{-r.left}일 지남</Badge>;
    if (r.left <= RENEWAL_SOON_DAYS) return <Badge tone={r.left <= 30 ? "warning" : "neutral"}>{r.left === 0 ? "오늘 종료" : `D-${r.left}`}</Badge>;
    return null;
  };
  const renew = (r: Row) => r.ct.status === "signed" && (
    <span className="flex flex-wrap items-center gap-1.5">
      {r.stage !== "none" && <Badge tone={STAGE_TONE[r.stage]}>{RENEWAL_STAGE_LABEL[r.stage]}</Badge>}
      {r.stage !== "renewed" && <span onClick={(e) => e.stopPropagation()}><LinkButton size="sm" variant="outline" className="gap-1" href={`/ax/clients/${r.ct.companyId}?renew=${encodeURIComponent(r.ct.id)}`} icon={<RefreshCw size={13} />}>갱신 준비</LinkButton></span>}
    </span>
  );

  if (contracts.length === 0) return <Card><EmptyState icon={<FileSignature size={30} />} title="계약이 없습니다" desc="견적을 고객이 수락하면 계약으로 전환됩니다. 견적 없이 맺은 기존 계약은 '계약 등록'으로 올립니다." /></Card>;

  return (
    <div data-testid="contract-board">
      {noEnd.length > 0 && view !== "noend" && (
        <button type="button" onClick={() => setView("noend")} data-testid="contract-noend-banner"
          className="pressable mb-3 flex w-full items-start gap-2 rounded-xl bg-warning-bg px-4 py-3 text-left text-[0.86rem] text-warning">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1">서명했지만 <b>종료일이 없는 계약 {noEnd.length}건</b> — 만료 전 갱신 협의 업무가 잡히지 않습니다. 눌러서 종료일을 넣어 주세요.</span>
        </button>
      )}
      <div className="mb-3" data-testid="contract-views">
        <SegmentedControl size="sm" value={view} onChange={setView} options={[
          { key: "all", label: `전체 ${rows.length}` },
          { key: "soon", label: `만료 임박 ${soon.length}` },
          ...(noEnd.length ? [{ key: "noend" as const, label: `종료일 없음 ${noEnd.length}` }] : []),
        ]} />
      </div>
      {view === "soon" && <p className="mb-2 text-[0.8rem] text-ink-3">종료 {RENEWAL_SOON_DAYS}일 전부터 종료 후 {RENEWAL_SOON_DAYS}일까지의 서명 계약입니다(갱신 계약으로 이어진 것은 빠집니다). 가까운 순.</p>}
      {shown.length === 0 ? (
        <Card><EmptyState icon={<FileSignature size={30} />} title={view === "soon" ? `${RENEWAL_SOON_DAYS}일 안에 끝나는 계약이 없습니다` : "해당하는 계약이 없습니다"} /></Card>
      ) : (
        <>
          <div className="space-y-2 lg:hidden">
            {shown.map((r) => (
              <div key={r.ct.id} className="card p-4" data-contract={r.ct.id} onClick={() => onEdit?.(r.ct.id)} role={onEdit ? "button" : undefined}>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/ax/clients/${r.ct.companyId}`} onClick={(e) => e.stopPropagation()} className="-my-2 truncate py-2 font-bold hover:text-accent">{company(r.ct.companyId)}</Link>
                  <Badge tone={STATUS[r.ct.status].tone}>{STATUS[r.ct.status].label}</Badge>
                  {dday(r)}
                </div>
                <div className="mt-1 text-[0.88rem] font-semibold">{r.ct.title}</div>
                <div className="mt-0.5 truncate text-[0.82rem] text-ink-2">{r.ct.scope.split("\n")[0]}</div>
                <div className="mt-2 flex flex-wrap gap-x-3 text-[0.78rem] text-ink-3">
                  <span>{r.ct.period}</span>
                  <span className={cx(r.noEnd && "font-semibold text-warning")}>종료 {r.ct.endDate ? fmtDate(r.ct.endDate) : r.noEnd ? "미입력" : "-"}</span>
                  <span>서명 {r.ct.signedAt ? fmtDate(r.ct.signedAt) : "-"}</span>
                  {r.ct.amount ? <span className="tnum">{fmtWon(r.ct.amount)}</span> : null}
                </div>
                {r.ct.status === "signed" && <div className="mt-3">{renew(r)}</div>}
              </div>
            ))}
          </div>
          {/* 칸이 많아 좁은 PC 창에서는 표만 옆으로 민다 — 화면 전체가 넘치지 않게 */}
          <Card className="hidden overflow-x-auto lg:block">
            <table className="tbl">
              <thead><tr><th>기업 · 계약</th><th>상태</th><th>기간</th><th>종료일</th><th>금액</th><th>서명</th><th>갱신</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.ct.id} data-contract={r.ct.id} className={onEdit ? "row-clickable" : undefined} onClick={() => onEdit?.(r.ct.id)}>
                    <td>
                      <Link href={`/ax/clients/${r.ct.companyId}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:text-accent">{company(r.ct.companyId)}</Link>
                      {/* 계약명 → 그 계약의 프로젝트로(프로젝트 이름은 계약명과 거의 같아 칸을 따로 두지 않는다) */}
                      <div className="text-[0.85rem]">{r.ct.projectId ? <Link href={`/ax/projects/${r.ct.projectId}`} title={project(r.ct.projectId)} onClick={(e) => e.stopPropagation()} className="text-ink-2 hover:text-accent">{r.ct.title}</Link> : <span className="text-ink-2">{r.ct.title}</span>}</div>
                    </td>
                    <td className="whitespace-nowrap"><Badge tone={STATUS[r.ct.status].tone}>{STATUS[r.ct.status].label}</Badge></td>
                    <td className="whitespace-nowrap">{r.ct.period}</td>
                    <td className="tnum"><span className="flex flex-wrap items-center gap-x-1.5 gap-y-1"><span className="whitespace-nowrap">{r.ct.endDate ? fmtDate(r.ct.endDate) : <span className={r.noEnd ? "font-semibold text-warning" : "text-ink-3"}>미입력</span>}</span>{dday(r)}</span></td>
                    <td className="tnum whitespace-nowrap font-semibold">{r.ct.amount ? fmtWon(r.ct.amount) : <span className="font-normal text-ink-3">-</span>}</td>
                    <td className="tnum whitespace-nowrap">{r.ct.signedAt ? fmtDate(r.ct.signedAt) : "-"}</td>
                    <td>{renew(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-[0.8rem] text-ink-3"><FileSignature size={14} /> 전자서명 연동은 향후 확장(NEXT) 항목입니다. 현재는 상태를 수동으로 관리합니다.</div>
          </Card>
        </>
      )}
    </div>
  );
}
