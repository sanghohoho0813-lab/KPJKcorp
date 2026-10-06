"use client";

import { useState } from "react";
import { BadgeCheck, Eye, Plus, Save, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { CERT_CATALOG, certSuggestions, certView } from "@/lib/company-snapshot";
import { normalizeDate } from "@/lib/company-profile";
import type { Certification, Company } from "@/lib/types";
import { Badge, Button, Card, Input, SectionTitle, cx } from "@/components/ui/ui";

/**
 * 인증 현황 — 고객 화면 "우리 회사 한눈에"의 보유 인증 · 갱신 시기가 된다.
 * 인증서를 보고 이름 · 취득일 · 유효기간을 넣는다. 유효기간이 120일 안으로 들어오면 고객·담당자 화면에 "갱신 준비"로 보인다.
 * 아래 "검토해 볼 인증"은 기업정보 규칙으로 고른 후보이며 자격 판정이 아니다.
 */
type Row = { name: string; acquiredAt: string; expiresAt: string };

export function CertificationsCard({ company: c }: { company: Company }) {
  const role = useStore((s) => s.session?.role);
  const me = useStore((s) => s.session?.userId ?? "");
  const update = useStore((s) => s.updateCompany);
  const toast = useStore((s) => s.toast);
  const may = can(role, "company.update");
  const init = (): Row[] => (c.certifications ?? []).map((x) => ({ name: x.name, acquiredAt: x.acquiredAt ?? "", expiresAt: x.expiresAt ?? "" }));
  const [rows, setRows] = useState<Row[]>(init);
  const [editing, setEditing] = useState(false);
  const view = certView(c);
  const sugg = certSuggestions(c);
  const set = (i: number, k: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const save = () => {
    const bad = rows.find((r) => r.name.trim() && ((r.acquiredAt && !normalizeDate(r.acquiredAt)) || (r.expiresAt && !normalizeDate(r.expiresAt))));
    if (bad) { toast(`${bad.name} — 날짜를 읽지 못했습니다. 예: 2026-09-01`, "error"); return; }
    const next: Certification[] = rows.filter((r) => r.name.trim()).map((r) => ({
      name: r.name.trim(),
      ...(r.acquiredAt ? { acquiredAt: normalizeDate(r.acquiredAt)! } : {}),
      ...(r.expiresAt ? { expiresAt: normalizeDate(r.expiresAt)! } : {}),
    }));
    update(c.id, { certifications: next }, me);
    setEditing(false);
    toast(next.length ? `인증 ${next.length}건을 저장했습니다. 고객 화면에 바로 보입니다.` : "인증 기록을 비웠습니다.");
  };

  return (
    <Card className="p-5" id="certifications-card">
      <SectionTitle action={may && !editing ? <Button size="sm" variant="ghost" onClick={() => { setRows(init().length ? init() : [{ name: "", acquiredAt: "", expiresAt: "" }]); setEditing(true); }}>{view.length ? "고치기" : "입력하기"}</Button> : undefined}>
        <span className="flex flex-wrap items-center gap-2"><BadgeCheck size={17} className="text-accent" /> 인증 현황 <Badge tone="info"><Eye size={12} className="mr-0.5 inline" />고객 화면에 보임</Badge></span>
      </SectionTitle>

      {!editing ? (
        view.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-2 px-4 py-3 text-[0.88rem] text-ink-2">아직 기록된 인증이 없습니다. 인증서를 받으면 이름 · 취득일 · 유효기간을 넣어 주세요 — 유효기간이 다가오면 갱신 시기를 알려 줍니다.</div>
        ) : (
          <ul className="space-y-1.5" data-testid="cert-list">
            {view.map((x) => (
              <li key={x.name} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-[0.88rem]">
                <b className="min-w-0 flex-1 truncate">{x.name}</b>
                {x.acquiredAt && <span className="text-[0.78rem] text-ink-3">{x.acquiredAt} 취득</span>}
                <span className={cx("rounded-full px-2 py-0.5 text-[0.75rem] font-bold", x.state === "expired" ? "bg-error-bg text-error" : x.state === "expiring" ? "bg-warning-bg text-warning" : "bg-success-bg text-success")}>
                  {x.state === "expired" ? "유효기간 지남" : x.state === "expiring" ? `갱신 D-${x.daysLeft}` : x.expiresAt ? `${x.expiresAt}까지` : "유효기간 없음"}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="space-y-2" data-testid="cert-editor">
          <datalist id="cert-catalog">{CERT_CATALOG.map((n) => <option key={n} value={n} />)}</datalist>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-line p-2.5 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
              <label className="col-span-2 text-[0.75rem] font-semibold text-ink-3 sm:col-span-1">인증 이름<Input list="cert-catalog" value={r.name} onChange={(e) => set(i, "name", e.target.value)} placeholder="예: 벤처기업확인" aria-label="인증 이름" className="mt-0.5 !h-10" /></label>
              <label className="text-[0.75rem] font-semibold text-ink-3">취득일<Input type="date" value={r.acquiredAt} onChange={(e) => set(i, "acquiredAt", e.target.value)} aria-label="취득일" className="mt-0.5 !h-10" /></label>
              <label className="text-[0.75rem] font-semibold text-ink-3">유효기간 끝<Input type="date" value={r.expiresAt} onChange={(e) => set(i, "expiresAt", e.target.value)} aria-label="유효기간 끝" className="mt-0.5 !h-10" /></label>
              <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="pressable icon-btn justify-self-end text-ink-3 hover:bg-error-bg hover:text-error" aria-label={`${r.name || "이"} 줄 지우기`}><Trash2 size={16} /></button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => setRows((rs) => [...rs, { name: "", acquiredAt: "", expiresAt: "" }])}>인증 추가</Button>
            <span className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => { setRows(init()); setEditing(false); }}>취소</Button>
            <Button size="sm" variant="accent" icon={<Save size={14} />} onClick={save} data-testid="cert-save">저장</Button>
          </div>
        </div>
      )}

      {sugg.length > 0 && (
        <div className="mt-3 text-[0.8rem] text-ink-2">
          <span className="font-semibold text-ink-3">고객 화면의 &lsquo;검토해 볼 인증&rsquo; · </span>
          {sugg.map((x) => <span key={x.name} title={x.why} className="mr-1.5 inline-block rounded-full border border-line px-2 py-0.5">{x.name} <span className="text-ink-3">({x.basis})</span></span>)}
        </div>
      )}
    </Card>
  );
}
