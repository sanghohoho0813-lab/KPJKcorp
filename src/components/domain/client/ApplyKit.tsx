"use client";

import { useMemo, useState } from "react";
import { Download, ExternalLink, Plus, Send, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { KIT_LABEL, defaultApplyOn, kitFileName, kitIncluded, kitRequestItems, kitRows, kitSheets, kitSummary, kitZipName, type KitRow, type KitState } from "@/lib/apply-kit";
import { profileOfCompany, programsForCompany } from "@/lib/programs";
import { openOnly } from "@/lib/programs-client";
import { slotsOf, todayYmd } from "@/lib/vault";
import { buildXlsx, buildZip, downloadBytes } from "@/lib/xlsx";
import { loadFileData } from "@/lib/vault-files";
import { DOC_BUCKET, downloadUrl } from "@/lib/server/storage";
import type { Company } from "@/lib/types";
import { Badge, Button, Input, Select, cx } from "@/components/ui/ui";

/**
 * 공고 신청 묶음 — 공고(또는 신청 예정일)를 정하면 이 기업 서류를 신청일 기준으로 점검한다.
 * 모자란 것만 고객에게 요청하고(기한은 신청일 앞으로), 준비된 파일은 번호·서류명으로 정리해 zip 한 번에.
 * 자격·승인 가능성은 판단하지 않는다.
 */

const TONE: Record<KitState, "success" | "info" | "warning" | "error" | "neutral"> = {
  ready: "success", checking: "info", expires: "error", noFile: "warning", open: "info", justBefore: "warning", missing: "neutral",
};
const ASKABLE: KitState[] = ["missing", "expires", "noFile", "justBefore"];
const NONE = "__none";
const MANUAL = "__manual";
const dueIso = (day: string) => new Date(`${day}T18:00:00`).toISOString();

export function useKitPanel(company: Company, initialProgramId: string | undefined, onClose: () => void) {
  const vault = useStore((s) => s.companyVaults.find((v) => v.companyId === company.id));
  const files = useStore((s) => s.companyFiles);
  const reqs = useStore((s) => s.docRequests);
  const programs = useStore((s) => s.programs);
  const users = useStore((s) => s.users);
  const session = useStore((s) => s.session);
  const request = useStore((s) => s.requestPolicyDocs);
  const logActivity = useStore((s) => s.logActivity);
  const toast = useStore((s) => s.toast);
  const me = session?.userId ?? "";
  const mayRequest = can(session?.role, "doc.request");
  const today = todayYmd();

  // 공고 — 담당자가 보낸 공고 → 이 기업 조건에 맞는 공고(실제 공고만). 링크로 들어온 공고는 맞지 않아도 맨 앞에
  const options = useMemo(() => {
    const { sent, matches } = programsForCompany(openOnly(programs), company.id, profileOfCompany(company));
    const list = [...sent.map((m) => ({ p: m.program, tag: "담당자 추천", dl: m.deadline.label })), ...matches.slice(0, 20).map((m) => ({ p: m.program, tag: "", dl: m.deadline.label }))];
    const linked = initialProgramId ? programs.find((p) => p.id === initialProgramId) : undefined;
    if (linked && !list.some((x) => x.p.id === linked.id)) list.unshift({ p: linked, tag: "", dl: linked.applyEnd ? `마감 ${linked.applyEnd}` : "상시" });
    return list;
  }, [programs, company, initialProgramId]);

  const [pick, setPick] = useState<string>(() => (initialProgramId && options.some((o) => o.p.id === initialProgramId) ? initialProgramId : options[0]?.p.id ?? NONE));
  const program = options.find((o) => o.p.id === pick)?.p;
  const [manualTitle, setManualTitle] = useState("");
  const title = pick === MANUAL ? manualTitle.trim() : program?.title;
  const [applyOn, setApplyOn] = useState(() => defaultApplyOn(program?.applyEnd, today));
  const choose = (v: string) => {
    setPick(v);
    const p = options.find((o) => o.p.id === v)?.p;
    setApplyOn(defaultApplyOn(p?.applyEnd, today));
  };

  const [extras, setExtras] = useState<string[]>([]);
  const [extraText, setExtraText] = useState("");
  const rows = useMemo(() => kitRows({ entity: company.entityType, companyId: company.id, vault, files, reqs, applyOn: applyOn || today, today, extras }), [company, vault, files, reqs, applyOn, today, extras]);
  const sum = kitSummary(rows);
  // 서류함에 파일이 있는 다른 칸 — 공고문이 요구하면 한 번에 더한다(대표자 신분증 등)
  const quickAdds = useMemo(() => slotsOf(vault).filter((m) => !m.noFile && files.some((f) => f.companyId === company.id && f.slot === m.key) && !rows.some((r) => r.label.replace(/\s+/g, "") === m.label.replace(/\s+/g, ""))).map((m) => m.label), [vault, files, company.id, rows]);
  const addExtra = (label: string) => { const l = label.trim(); if (l) setExtras((xs) => (xs.includes(l) ? xs : [...xs, l])); setExtraText(""); };

  const [on, setOn] = useState<Record<string, boolean>>({});
  const checked = (r: KitRow) => ASKABLE.includes(r.state) && (on[r.key] ?? r.ask);
  const picks = rows.filter(checked);
  const [busy, setBusy] = useState(false);

  const sendRequests = () => {
    if (!picks.length || !mayRequest) return;
    const items = kitRequestItems(picks, applyOn, title, today);
    const label = title ? `「${title.length > 24 ? `${title.slice(0, 24)}…` : title}」 ` : "";
    const n = request(company.id, items.map((i) => ({ label: i.label, description: i.description, validMonths: i.validMonths, dueDate: dueIso(i.dueDay) })), dueIso(items[0].dueDay), me, {
      notifyTitle: `${label}신청 서류 ${items.length}개를 요청드렸습니다`,
      notifyBody: `${applyOn} 신청 예정입니다. 자료제출에서 발급 방법을 보고 기한 안에 올려 주세요.`,
      tag: `신청 서류: ${title || "공고 미지정"}`,
    });
    if (n) { toast(`서류 ${n}개를 요청했습니다. 기한은 신청일(${applyOn}) 앞으로 잡았고, 고객 알림은 한 번 갑니다.`); setOn({}); }
  };

  const download = async () => {
    setBusy(true);
    try {
      const entries: [string, Uint8Array][] = [];
      const missing = new Set<string>();
      for (const [i, r] of rows.entries()) {
        if (!kitIncluded(r)) continue;
        for (const [k, s] of r.sources.entries()) {
          let blob: Blob | null = null;
          if (s.kind === "vault") blob = await loadFileData(s.file);
          else if (s.file.storagePath) {
            const u = await downloadUrl(DOC_BUCKET, s.file.storagePath);
            if (u.ok && u.url) { const res = await fetch(u.url).catch(() => null); if (res?.ok) blob = await res.blob(); }
          }
          if (!blob) { missing.add(`${r.key}#${k}`); continue; }
          entries.push([kitFileName(i + 1, r.label, s.file.fileName, k, r.sources.length), new Uint8Array(await blob.arrayBuffer())]);
        }
      }
      const when = new Date();
      const by = users.find((u) => u.id === me);
      const sheet = buildXlsx(kitSheets(rows, { companyName: company.name, programTitle: title, applyOn, madeBy: by ? `${by.name} ${by.title}` : undefined, when, missingFiles: missing }));
      downloadBytes(buildZip([["00_서류목록.xlsx", sheet], ...entries], when), kitZipName(company.name, title, when), "application/zip");
      logActivity({ type: "vault_updated", companyId: company.id, actorId: me, actorRole: session?.role ?? "consultant", text: `신청 서류 묶음 내려받음: ${title || "공고 미지정"} · 파일 ${entries.length}개 · 신청 예정 ${applyOn}` });
      toast(missing.size ? `파일 ${entries.length}개와 서류 목록을 묶었습니다. 원본을 열 수 없는 ${missing.size}개는 목록에 표시했습니다.` : `파일 ${entries.length}개와 서류 목록을 묶어 내려받았습니다.`);
    } catch {
      toast("묶음을 만들지 못했습니다. 잠시 뒤 다시 눌러 주세요.", "error");
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <div className="space-y-3" data-testid="apply-kit">
      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <label className="block min-w-0 text-[0.82rem] font-semibold text-ink-2">공고
          <Select className="mt-1" value={pick} onChange={(e) => choose(e.target.value)} aria-label="공고">
            {options.map((o) => <option key={o.p.id} value={o.p.id}>{o.tag ? `[${o.tag}] ` : ""}{o.p.title} · {o.dl}</option>)}
            <option value={MANUAL}>직접 입력</option>
            <option value={NONE}>공고 없이 — 공통 서류만</option>
          </Select>
        </label>
        <label className="block text-[0.82rem] font-semibold text-ink-2">신청 예정일
          <Input className="mt-1" type="date" value={applyOn} min={today} onChange={(e) => setApplyOn(e.target.value || today)} aria-label="신청 예정일" />
        </label>
      </div>
      {pick === MANUAL && <Input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="공고문 제목 그대로" aria-label="공고명" />}
      {program && pick !== MANUAL && (
        <p className="flex flex-wrap items-center gap-x-2 text-[0.78rem] text-ink-3">
          {program.agency && <span>{program.agency}</span>}<span>{program.applyEnd ? `접수 마감 ${program.applyEnd}` : "상시 · 예산 소진 시"}</span>
          {program.url && <a href={program.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-accent">공고문 <ExternalLink size={12} /></a>}
        </p>
      )}
      {options.length === 0 && pick !== MANUAL && <p className="text-[0.78rem] text-ink-3">이 기업에 맞는 공고가 아직 없습니다 — 공고명을 직접 넣거나 공통 서류만 점검할 수 있습니다.</p>}

      {/* 요약판 */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[10px] border border-line bg-line text-center sm:grid-cols-5" data-testid="kit-summary">
        {[["파일 준비", `${sum.ready}/${sum.total}`, "text-success"], ["다시 발급", sum.reissue, sum.reissue ? "text-error" : ""], ["없음", sum.missing, sum.missing ? "text-warning" : ""], ["요청 중", sum.open, ""], ["신청 직전", sum.justBefore, ""]].map(([l, v, c], i) => (
          <div key={String(l)} className={cx("bg-surface px-2 py-2", i >= 3 && "hidden sm:block")}><div className={cx("tnum text-[1.15rem] font-bold leading-tight", String(c))}>{v}</div><div className="text-[0.72rem] font-semibold text-ink-3">{l}</div></div>
        ))}
      </div>

      <ul className="divide-y divide-line rounded-xl border border-line" data-testid="kit-rows">
        {rows.map((r, i) => {
          const askable = ASKABLE.includes(r.state);
          return (
            <li key={r.key} data-kit={r.key} data-state={r.state} className="flex items-start gap-3 px-3.5 py-2.5">
              {askable && mayRequest
                ? <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={checked(r)} onChange={(e) => setOn((m) => ({ ...m, [r.key]: e.target.checked }))} aria-label={`${r.label} 요청`} />
                : <span className="tnum mt-0.5 w-4 shrink-0 text-center text-[0.72rem] font-bold text-ink-3">{String(i + 1).padStart(2, "0")}</span>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{r.label}</span>
                  <Badge tone={TONE[r.state]}>{KIT_LABEL[r.state]}</Badge>
                  {r.extra && <Badge>공고문</Badge>}
                  {r.unsure && <Badge>법인이면</Badge>}
                </div>
                <div className="mt-0.5 text-[0.78rem] text-ink-3">{r.note}</div>
                {kitIncluded(r) && <div className="mt-0.5 truncate text-[0.75rem] text-ink-2" title={r.sources.map((s) => s.file.fileName).join(", ")}>파일: {r.sources.map((s) => s.file.fileName).join(", ")}</div>}
              </div>
              {r.extra && <button type="button" onClick={() => setExtras((xs) => xs.filter((x) => x !== r.label))} aria-label={`${r.label} 빼기`} className="pressable icon-btn shrink-0 text-ink-3 hover:text-ink"><X size={15} /></button>}
            </li>
          );
        })}
      </ul>

      <div className="space-y-1.5">
        <div className="text-[0.82rem] font-semibold text-ink-2">공고문에 있는 서류 더하기</div>
        <div className="flex gap-2">
          <Input value={extraText} onChange={(e) => setExtraText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExtra(extraText); } }} placeholder="예: 수출실적증명서, 특허 등록원부" aria-label="더할 서류 이름" />
          <Button variant="outline" icon={<Plus size={15} />} onClick={() => addExtra(extraText)} disabled={!extraText.trim()}>더하기</Button>
        </div>
        {quickAdds.length > 0 && <div className="flex flex-wrap gap-1.5">{quickAdds.map((l) => <button key={l} type="button" onClick={() => addExtra(l)} className="pressable rounded-md border border-line px-2 py-1 text-[0.75rem] font-semibold text-ink-2 hover:bg-surface-2">+ {l}</button>)}</div>}
      </div>
      <p className="text-[0.75rem] text-ink-3">기관·사업마다 요구 서류가 다릅니다. 공고문을 보고 서류를 더하세요. 자격·승인 가능성은 판단하지 않고, 서류가 신청일에 유효한지만 봅니다.</p>
    </div>
  );

  // 휴대폰: 닫기는 위 X 로, 두 버튼은 반씩 나눠 짧은 이름으로 — 버튼 줄이 화면 밖으로 밀리지 않게
  const footer = (
    <>
      <Button variant="ghost" onClick={onClose} className="max-sm:hidden">닫기</Button>
      {mayRequest && (
        <Button variant="outline" icon={<Send size={15} />} disabled={!picks.length} onClick={sendRequests} className="max-sm:flex-1 max-sm:px-2" aria-label={picks.length ? `모자란 서류 ${picks.length}개 요청` : "요청할 서류 없음"}>
          <span className="sm:hidden">{picks.length ? `요청 ${picks.length}개` : "요청 없음"}</span>
          <span className="hidden sm:inline">{picks.length ? `모자란 서류 ${picks.length}개 요청` : "요청할 서류 없음"}</span>
        </Button>
      )}
      <Button variant="accent" icon={<Download size={15} />} disabled={busy} onClick={download} className="max-sm:flex-1 max-sm:px-2" aria-label={busy ? "묶는 중" : sum.files ? `파일 ${sum.files}개 내려받기` : "서류 목록만 내려받기"}>
        <span className="sm:hidden">{busy ? "묶는 중…" : sum.files ? `받기 · 파일 ${sum.files}개` : "목록 받기"}</span>
        <span className="hidden sm:inline">{busy ? "묶는 중…" : sum.files ? `파일 ${sum.files}개 내려받기` : "서류 목록만 내려받기"}</span>
      </Button>
    </>
  );

  return { body, footer };
}
