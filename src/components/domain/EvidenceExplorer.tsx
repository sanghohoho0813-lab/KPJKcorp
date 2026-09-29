"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/format";
import { EMPTY_FILTER, EVIDENCE_GROUPS, GROUP_OF, describeFilter, filterEvidence, isFiltered, type EvidenceFilter, type NameCtx, type Period } from "@/lib/evidence-filter";
import { ymdhm } from "@/lib/export-workbook";
import { buildXlsx, downloadBytes } from "@/lib/xlsx";
import { Button, Input, Select } from "@/components/ui/ui";
import { Chip } from "@/components/ui/chips";
import { ActivityFeed, SearchBox } from "./domain";

const PERIODS: { key: Period; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "today", label: "오늘" },
  { key: "7", label: "7일" },
  { key: "30", label: "30일" },
  { key: "custom", label: "기간 지정" },
];
const PAGE = 50;
const ROLE: Record<string, string> = { admin: "대표", consultant: "컨설턴트", client: "고객", system: "시스템" };

/**
 * 실증 기록 탐색 — 기간·분류·행위자·기업·검색어로 좁히고, 좁힌 그대로 내보낸다.
 * 심사·감사 때 "이 고객 건만", "지난달 권한 거절만"을 바로 뽑아 보여줄 수 있어야 한다.
 */
export function EvidenceExplorer() {
  const st = useStore();
  const toast = useStore((s) => s.toast);
  const logExport = useStore((s) => s.logEvidenceExport);
  const me = st.session?.userId ?? "";
  const tick = useNow(60000);
  const [f, setF] = useState<EvidenceFilter>(EMPTY_FILTER);
  const [shown, setShown] = useState(PAGE);
  const set = (patch: Partial<EvidenceFilter>) => { setF((x) => ({ ...x, ...patch })); setShown(PAGE); };

  const names: NameCtx = useMemo(() => ({
    userName: (id) => st.users.find((u) => u.id === id)?.name,
    companyName: (id) => (id ? st.companies.find((c) => c.id === id)?.name : undefined),
  }), [st.users, st.companies]);
  const list = useMemo(() => (tick ? filterEvidence(st.activities, f, tick, names) : st.activities), [st.activities, f, tick, names]);
  const staff = st.users.filter((u) => u.role !== "client");
  const companies = [...st.companies].sort((a, b) => Number(!!a.archived) - Number(!!b.archived) || a.name.localeCompare(b.name, "ko"));

  const rowsFor = () => list.map((a) => [
    ymdhm(a.at), EVIDENCE_GROUPS.find((g) => g.key === GROUP_OF[a.type])?.label ?? "", a.type,
    a.actorRole === "system" ? "시스템" : names.userName(a.actorId) ?? a.actorId, ROLE[a.actorRole] ?? a.actorRole,
    names.companyName(a.companyId) ?? "", st.projects.find((p) => p.id === a.projectId)?.name ?? "", a.text,
  ]);
  const HEAD = ["시각", "분류", "종류", "행위자", "역할", "기업", "프로젝트", "내용"];
  const stamp = () => ymdhm(new Date().toISOString()).slice(0, 10);

  const exportXlsx = () => {
    const cond = describeFilter(f, names);
    downloadBytes(buildXlsx([
      { name: "실증 기록", rows: [HEAD, ...rowsFor()] },
      { name: "조건", header: false, widths: [70], rows: [["KPJK Business AX · 실증 기록(Evidence Log)"], [], [`내보낸 시각: ${ymdhm(new Date().toISOString())}`], [`내보낸 사람: ${names.userName(me) ?? me}`], [`건수: ${list.length}건 / 전체 ${st.activities.length}건`], [], ...cond.map((c) => [c]), [], ["기록은 추가만 되고 고치지 않습니다(Append-only). 이 파일은 그 기록을 조건에 맞게 뽑은 사본입니다."]] },
    ]), `KPJK_실증기록_${stamp()}.xlsx`);
    logExport(me, list.length);
    toast(`실증 기록 ${list.length}건을 엑셀로 내려받았습니다.`);
  };
  const exportCsv = () => {
    const csv = [HEAD, ...rowsFor()].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadBytes("﻿" + csv, `KPJK_실증기록_${stamp()}.csv`, "text/csv;charset=utf-8");
    logExport(me, list.length);
    toast(`실증 기록 ${list.length}건을 CSV로 내려받았습니다.`);
  };

  return (
    <div>
      <div className="space-y-3" id="evidence-filters">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="lg:w-80"><SearchBox value={f.q} onChange={(q) => set({ q })} placeholder="내용·기업·사람 이름으로 검색" /></div>
          <div role="group" aria-label="기간" className="flex flex-wrap gap-1.5">
            {PERIODS.map((p) => <Chip key={p.key} selected={f.period === p.key} onClick={() => set({ period: p.key })}>{p.label}</Chip>)}
          </div>
        </div>
        {f.period === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={f.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} aria-label="시작일" className="w-auto" />
            <span className="text-ink-3">~</span>
            <Input type="date" value={f.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} aria-label="종료일" className="w-auto" />
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <Select value={f.group} onChange={(e) => set({ group: e.target.value as EvidenceFilter["group"] })} aria-label="분류">
            <option value="all">분류 전체</option>
            {EVIDENCE_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </Select>
          <Select value={f.actor} onChange={(e) => set({ actor: e.target.value })} aria-label="행위자">
            <option value="all">행위자 전체</option>
            <option value="client">고객 (모든 고객)</option>
            <option value="system">시스템 (자동 규칙)</option>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE[u.role]}</option>)}
          </Select>
          <Select value={f.company} onChange={(e) => set({ company: e.target.value })} aria-label="기업">
            <option value="all">기업 전체</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.archived ? " (보관)" : ""}</option>)}
          </Select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-line py-2.5">
        <span className="tnum text-[0.9rem] font-bold" id="evidence-count">{list.length}건</span>
        {isFiltered(f) && <span className="tnum text-[0.8rem] text-ink-3">/ 전체 {st.activities.length}건</span>}
        {isFiltered(f) && <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={() => set(EMPTY_FILTER)}>조건 지우기</Button>}
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="outline" icon={<FileSpreadsheet size={14} />} disabled={!list.length} onClick={exportXlsx}>{isFiltered(f) ? "이 결과 엑셀" : "엑셀"}</Button>
          <Button size="sm" variant="ghost" icon={<Download size={14} />} disabled={!list.length} onClick={exportCsv}>CSV</Button>
        </div>
      </div>

      <div className="mt-4">
        {list.length === 0 ? (
          <div className="py-10 text-center text-[0.9rem] text-ink-3">{st.activities.length ? "조건에 맞는 기록이 없습니다." : "아직 기록된 활동이 없습니다."}</div>
        ) : (
          <>
            <ActivityFeed items={list.slice(0, shown)} showCompany />
            {list.length > shown && (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>더 보기 ({shown} / {list.length})</Button>
              </div>
            )}
          </>
        )}
      </div>
      <p className="mt-4 text-[0.75rem] text-ink-3">마지막 기록 {st.activities[0] ? fmtDateTime(st.activities[0].at) : "-"} · 기록은 추가만 되고 고치거나 지울 수 없습니다. 내보낸 사실도 기록됩니다.</p>
    </div>
  );
}
