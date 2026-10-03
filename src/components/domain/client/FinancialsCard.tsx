"use client";

import { useState } from "react";
import { Eye, Plus, Save, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { fmtMoneyKo, fmtPct, parseMoneyKo, revenueTrend } from "@/lib/company-snapshot";
import { normalizeDate } from "@/lib/company-profile";
import type { Company, FinancialYear } from "@/lib/types";
import { Badge, Button, Card, Input, SectionTitle, cx } from "@/components/ui/ui";

/**
 * 재무·계약 현황 — 고객 화면 "우리 회사 한눈에"에 그대로 보인다.
 * 재무제표를 보고 연도별 숫자를 넣는다("420억" · "12억 3천만" · "1,234,000,000" 모두 읽음). 못 읽은 칸은 비워 둔다.
 * 계약 시작일은 고객 화면의 "계약 N일차"가 된다.
 */
type Draft = { year: string; revenue: string; operatingProfit: string; netIncome: string; source: string };
const toText = (n: number | undefined) => (typeof n === "number" ? n.toLocaleString("ko-KR") : "");

export function FinancialsCard({ company: c }: { company: Company }) {
  const role = useStore((s) => s.session?.role);
  const me = useStore((s) => s.session?.userId ?? "");
  const update = useStore((s) => s.updateCompany);
  const toast = useStore((s) => s.toast);
  const contracts = useStore((s) => s.contracts);
  const may = can(role, "company.update");
  const initial = (): Draft[] => [...(c.financials ?? [])].sort((a, b) => b.year - a.year)
    .map((f) => ({ year: String(f.year), revenue: toText(f.revenue), operatingProfit: toText(f.operatingProfit), netIncome: toText(f.netIncome), source: f.source ?? "재무제표" }));
  const [rows, setRows] = useState<Draft[]>(initial);
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(c.contractStartedAt ?? "");
  const trend = revenueTrend(c);
  const signed = contracts.filter((k) => k.companyId === c.id && k.status === "signed" && k.signedAt).map((k) => k.signedAt!.slice(0, 10)).sort()[0];

  const set = (i: number, k: keyof Draft, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const addYear = () => {
    const years = rows.map((r) => Number(r.year)).filter(Number.isFinite);
    const y = years.length ? Math.min(...years) - 1 : new Date().getFullYear() - 1;
    setRows((rs) => [...rs, { year: String(y), revenue: "", operatingProfit: "", netIncome: "", source: "재무제표" }]);
    setEditing(true);
  };
  const bad = rows.some((r) => !/^\d{4}$/.test(r.year) || ["revenue", "operatingProfit", "netIncome"].some((k) => r[k as keyof Draft].trim() && parseMoneyKo(r[k as keyof Draft]) === undefined));
  const dupYear = new Set(rows.map((r) => r.year)).size !== rows.length;

  const save = () => {
    if (bad || dupYear) { toast(dupYear ? "같은 연도가 두 번 있습니다." : "읽지 못한 숫자가 있습니다 — 빨간 칸을 고쳐 주세요.", "error"); return; }
    const now = new Date().toISOString();
    const prev = new Map((c.financials ?? []).map((f) => [f.year, f]));
    const next: FinancialYear[] = rows
      .map((r) => {
        const f: FinancialYear = { year: Number(r.year), revenue: parseMoneyKo(r.revenue), operatingProfit: parseMoneyKo(r.operatingProfit), netIncome: parseMoneyKo(r.netIncome), source: r.source.trim() || undefined };
        const old = prev.get(f.year);
        const same = old && old.revenue === f.revenue && old.operatingProfit === f.operatingProfit && old.netIncome === f.netIncome && (old.source ?? undefined) === f.source;
        return { ...f, updatedAt: same ? old!.updatedAt : now };
      })
      .filter((f) => f.revenue !== undefined || f.operatingProfit !== undefined || f.netIncome !== undefined)
      .sort((a, b) => a.year - b.year)
      // undefined 칸은 저장하지 않는다 (서버 jsonb 에 null 이 쌓이지 않게)
      .map((f) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) as unknown as FinancialYear);
    update(c.id, { financials: next }, me);
    setEditing(false);
    setRows([...next].sort((a, b) => b.year - a.year).map((f) => ({ year: String(f.year), revenue: toText(f.revenue), operatingProfit: toText(f.operatingProfit), netIncome: toText(f.netIncome), source: f.source ?? "" })));
    toast("연도별 재무를 저장했습니다.");
  };
  const saveStart = (v: string) => {
    const d = v.trim() ? normalizeDate(v) : undefined;
    if (v.trim() && !d) { toast("날짜를 읽지 못했습니다 — 예: 2026-09-01", "error"); return; }
    if ((d ?? "") === (c.contractStartedAt ?? "")) return;
    update(c.id, { contractStartedAt: d }, me);
    setStart(d ?? "");
    toast(d ? `계약 시작일을 ${d}로 저장했습니다.` : "계약 시작일을 지웠습니다.");
  };

  return (
    <Card className="p-5" id="financials-card">
      <SectionTitle action={may && !editing ? <Button size="sm" variant="ghost" onClick={() => { setRows(initial()); setEditing(true); if (!(c.financials ?? []).length) addYear(); }}>{(c.financials ?? []).length ? "고치기" : "입력하기"}</Button> : undefined}>
        <span className="flex flex-wrap items-center gap-2">재무 · 계약 현황 <Badge tone="info"><Eye size={12} className="mr-0.5 inline" />고객 화면에 보임</Badge></span>
      </SectionTitle>
      <p className="-mt-1 mb-3 text-[0.8rem] text-ink-3">고객 화면 "우리 회사 한눈에"의 매출 추이·전년 대비·계약 N일차가 됩니다. 재무제표를 보고 넣고, 모르는 칸은 비워 두세요.</p>

      {/* 계약 시작일 */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2.5">
        <span className="w-24 shrink-0 text-[0.82rem] font-semibold text-ink-3">계약 시작일</span>
        {may ? (
          <>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} onBlur={(e) => saveStart(e.target.value)} className="!h-9 !w-auto" aria-label="계약 시작일" data-testid="contract-start" />
            {signed && !c.contractStartedAt && <Button size="sm" variant="ghost" onClick={() => saveStart(signed)}>계약서 체결일 {signed} 쓰기</Button>}
          </>
        ) : <b className="text-[0.92rem]">{c.contractStartedAt ?? "—"}</b>}
      </div>

      {!editing ? (
        (c.financials ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-2 px-4 py-4 text-[0.88rem] text-ink-2">아직 연도별 재무가 없습니다. 고객 화면에는 "재무제표를 보내 주시면 기록됩니다"로 보입니다.</div>
        ) : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="연도별 재무 표">
            <table className="w-full min-w-[480px] text-[0.88rem]" data-testid="fin-table">
              <thead><tr className="border-b border-line text-left text-[0.75rem] text-ink-3"><th className="py-2 pr-3">연도</th><th className="py-2 pr-3 text-right">매출</th><th className="py-2 pr-3 text-right">영업이익</th><th className="py-2 pr-3 text-right">당기순이익</th><th className="py-2">출처</th></tr></thead>
              <tbody>
                {[...(c.financials ?? [])].sort((a, b) => b.year - a.year).map((f) => (
                  <tr key={f.year} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3 font-bold">{f.year}</td>
                    <td className="tnum py-2 pr-3 text-right">{fmtMoneyKo(f.revenue)}</td>
                    <td className="tnum py-2 pr-3 text-right">{fmtMoneyKo(f.operatingProfit)}</td>
                    <td className="tnum py-2 pr-3 text-right">{fmtMoneyKo(f.netIncome)}</td>
                    <td className="py-2 text-[0.8rem] text-ink-3">{f.source ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {trend.yoyPct !== undefined && <p className="mt-2 text-[0.82rem]">고객 화면: <b>{trend.latest!.year}년 매출 {fmtMoneyKo(trend.latest!.revenue)}</b> · 전년 대비 <b className={trend.yoyPct > 0 ? "text-success" : trend.yoyPct < 0 ? "text-error" : ""}>{fmtPct(trend.yoyPct)}</b></p>}
          </div>
        )
      ) : (
        <div className="space-y-2" data-testid="fin-editor">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-line p-2.5 sm:grid-cols-[80px_1fr_1fr_1fr_110px_auto] sm:items-center">
              <Input value={r.year} onChange={(e) => set(i, "year", e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" aria-label="연도" placeholder="2025" className={cx("!h-10", (!/^\d{4}$/.test(r.year) || rows.filter((x) => x.year === r.year).length > 1) && "!border-error")} />
              {(["revenue", "operatingProfit", "netIncome"] as const).map((k) => {
                const v = parseMoneyKo(r[k]);
                const badCell = r[k].trim() !== "" && v === undefined;
                return (
                  <label key={k} className="min-w-0">
                    <Input value={r[k]} onChange={(e) => set(i, k, e.target.value)} aria-label={k === "revenue" ? "매출" : k === "operatingProfit" ? "영업이익" : "당기순이익"} placeholder={k === "revenue" ? "매출 (예: 42억)" : k === "operatingProfit" ? "영업이익" : "당기순이익"} className={cx("!h-10", badCell && "!border-error")} />
                    <span className={cx("mt-0.5 block truncate text-[0.72rem]", badCell ? "text-error" : "text-ink-3")}>{badCell ? "읽지 못함" : v !== undefined ? `= ${fmtMoneyKo(v)}` : " "}</span>
                  </label>
                );
              })}
              <Input value={r.source} onChange={(e) => set(i, "source", e.target.value)} aria-label="출처" placeholder="재무제표" className="!h-10" />
              <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="pressable icon-btn justify-self-end text-ink-3 hover:bg-error-bg hover:text-error" aria-label={`${r.year}년 줄 지우기`}><Trash2 size={16} /></button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={addYear}>연도 추가</Button>
            <span className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => { setRows(initial()); setEditing(false); }}>취소</Button>
            <Button size="sm" variant="accent" icon={<Save size={14} />} onClick={save} disabled={bad || dupYear} data-testid="fin-save">저장</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
