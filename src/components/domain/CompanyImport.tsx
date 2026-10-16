"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import { FILL_LABEL, IMPORT_FIELDS, buildImportRows, companyTemplateSheets, findHeaderRow, mapHeaders, type ImportField, type ImportRow, type ImportStatus } from "@/lib/company-import";
import { buildXlsx, downloadBytes, parseDelimited } from "@/lib/xlsx";
import { ACCEPT_COMPANY_FILES, readCompanyFiles, type CompanySource } from "@/lib/company-sources";
import { Badge, Button, Select, Textarea, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";
import { Chip } from "@/components/ui/chips";

/**
 * 기업고객 일괄 등록 창.
 *
 * 흐름: 파일(또는 붙여넣기) → 열 맞추기 → 미리보기 → 등록.
 * 파일은 무엇이든 — 엑셀(.xlsx·.xls)·CSV 명단, 사업자등록증·등기부등본 PDF·사진 여러 장(lib/company-sources).
 * 등록 전에는 아무것도 저장하지 않는다. 확인이 필요한 줄은 사유를 붙인 엑셀로 내려받아 고친 뒤 다시 올리면 된다.
 */

type Source = CompanySource;

export function downloadCompanyTemplate() {
  downloadBytes(buildXlsx(companyTemplateSheets()), "KPJK_기업고객_등록양식.xlsx");
}

/** initialFiles — 한 곳씩 등록 창의 서류 칸에 엑셀이나 서류 여러 장을 올렸을 때 그대로 넘겨받아 바로 읽는다 */
export function CompanyImportModal({ open, onClose, onDone, initialFiles }: { open: boolean; onClose: () => void; onDone?: (count: number) => void; initialFiles?: File[] }) {
  if (!open) return null;
  return <Inner onClose={onClose} onDone={onDone} initialFiles={initialFiles} />;
}

function Inner({ onClose, onDone, initialFiles }: { onClose: () => void; onDone?: (count: number) => void; initialFiles?: File[] }) {
  const [src, setSrc] = useState<Source | null>(null);
  return (
    <Modal open onClose={onClose} size="lg" title={<span className="flex items-center gap-2"><FileSpreadsheet size={19} className="text-accent" /> 엑셀·서류로 한 번에 등록</span>}
      footer={src ? undefined : <Button variant="ghost" onClick={onClose}>닫기</Button>}>
      {src ? <Review key={src.label} src={src} onBack={() => setSrc(null)} onClose={onClose} onDone={onDone} /> : <Pick onPicked={setSrc} initialFiles={initialFiles} />}
    </Modal>
  );
}

/* ---------------- 1. 파일 고르기 ---------------- */

function Pick({ onPicked, initialFiles }: { onPicked: (s: Source) => void; initialFiles?: File[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<{ label: string; ratio?: number; done: number; total: number } | null>(null);
  const [drag, setDrag] = useState(false);

  const readFiles = async (list: FileList | File[] | null | undefined) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setErr("");
    setBusy({ label: "여는 중", done: 0, total: files.length });
    try {
      onPicked(await readCompanyFiles(files, (done, total, label, ratio) => setBusy({ done, total, label, ratio })));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "파일을 읽지 못했습니다.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  // 등록 창에서 넘겨받은 파일은 창이 열리자마자 읽는다 (한 번만)
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !initialFiles?.length) return;
    started.current = true;
    void readFiles(initialFiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiles]);

  const readPaste = () => {
    const rows = parseDelimited(paste.trim());
    if (rows.length < 2) { setErr("머리글 줄과 기업 한 줄 이상을 붙여넣어 주세요."); return; }
    onPicked({ label: "붙여넣은 내용", sheets: [{ name: "붙여넣기", rows }] });
  };

  return (
    <div className="space-y-4">
      <p className="text-[0.9rem] leading-relaxed text-ink-2">
        <b className="text-ink">쓰시던 엑셀 명단</b>(.xlsx·.xls·CSV)이나 <b className="text-ink">사업자등록증 PDF·사진 여러 장</b>을 그대로 올리세요. 머리글 이름이 달라도 알아서 맞추고, 등록 전에 한 줄씩 확인할 수 있습니다.
      </p>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void readFiles(e.dataTransfer.files); }}
        disabled={!!busy}
        className={cx("pressable flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors", drag ? "border-accent bg-soft/60" : "border-line hover:border-accent/60 hover:bg-surface-2/60")}
      >
        <Upload size={26} className="text-accent" />
        <span className="font-bold">{busy ? (busy.total > 1 ? `${busy.done + 1}/${busy.total} 읽는 중…` : "읽는 중…") : "파일 고르기 · 여러 개 가능"}</span>
        <span className="max-w-full truncate text-[0.8rem] text-ink-3">{busy ? busy.label : "엑셀(.xlsx·.xls)·CSV · 사업자등록증 PDF·사진 — PC 에서는 여기로 끌어다 놓아도 됩니다"}</span>
        {busy && <span className="mt-1 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(((busy.done + (busy.ratio ?? 0)) / Math.max(1, busy.total)) * 100)}%` }} /></span>}
      </button>
      <input ref={fileRef} type="file" multiple accept={ACCEPT_COMPANY_FILES} className="hidden" onChange={(e) => void readFiles(e.target.files)} aria-label="명단 파일" />

      <details className="group rounded-xl border border-line">
        <summary className="pressable cursor-pointer list-none px-4 py-3 text-[0.9rem] font-semibold">또는 엑셀에서 복사해 붙여넣기 <span className="text-ink-3 group-open:hidden">▾</span></summary>
        <div className="space-y-2 border-t border-line px-4 py-3">
          <Textarea rows={5} value={paste} onChange={(e) => { setPaste(e.target.value); setErr(""); }} placeholder={"엑셀에서 머리글 줄까지 함께 선택해 복사(Ctrl+C)한 뒤 여기에 붙여넣으세요(Ctrl+V)."} aria-label="붙여넣을 명단" />
          <div className="flex justify-end"><Button size="sm" variant="outline" onClick={readPaste} disabled={!paste.trim()}>붙여넣은 내용 읽기</Button></div>
        </div>
      </details>

      {err && <p role="alert" className="rounded-lg bg-error-bg px-3 py-2 text-[0.85rem] font-semibold text-error">{err}</p>}

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
        <p className="min-w-0 flex-1 text-[0.82rem] leading-relaxed text-ink-2">명단이 없으면 양식에 적어서 올리세요. 필수는 <b>기업명·대표자</b> 두 가지뿐입니다.</p>
        <Button size="sm" variant="outline" icon={<Download size={14} />} onClick={downloadCompanyTemplate}>양식 내려받기</Button>
      </div>
      <p className="flex gap-2 text-[0.78rem] leading-relaxed text-ink-3">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
        실제 고객 정보를 올리기 전에 고객 동의와 회사 내부 확인을 먼저 받아 주세요. 올린 파일은 저장하지 않고, 확인을 거친 값만 등록합니다.
      </p>
    </div>
  );
}

/* ---------------- 2. 확인 · 등록 ---------------- */

const STATUS_UI: Record<ImportStatus, { label: string; tone: "success" | "neutral" | "error" }> = {
  ok: { label: "등록 가능", tone: "success" },
  duplicate: { label: "이미 있음", tone: "neutral" },
  error: { label: "확인 필요", tone: "error" },
};

function Review({ src, onBack, onClose, onDone }: { src: Source; onBack: () => void; onClose: () => void; onDone?: (count: number) => void }) {
  const companies = useStore((s) => s.companies);
  const users = useStore((s) => s.users);
  const me = useStore((s) => s.session?.userId) ?? "";
  const importCompanies = useStore((s) => s.importCompanies);
  const updateCompany = useStore((s) => s.updateCompany);
  const toast = useStore((s) => s.toast);
  // 이미 있는 기업의 빈 칸 채우기 — 같은 번호·이름이면 기본 켜짐, 이름이 한 글자 다르거나 번호가 다르면 사람이 켠다
  const [fillOn, setFillOn] = useState<Record<number, boolean>>({});

  // 시트가 여럿이면 명단처럼 보이는(머리글을 두 개 이상 알아본) 첫 시트
  const firstGood = Math.max(0, src.sheets.findIndex((s) => mapHeaders(s.rows[findHeaderRow(s.rows)] ?? []).filter(Boolean).length >= 2));
  const [sheetIdx, setSheetIdx] = useState(firstGood);
  const sheet = src.sheets[sheetIdx];
  const headerRow = useMemo(() => findHeaderRow(sheet.rows), [sheet]);
  const header = sheet.rows[headerRow] ?? [];
  const [mapping, setMapping] = useState<(ImportField | null)[]>(() => mapHeaders(header));
  const [filter, setFilter] = useState<ImportStatus | "all">("all");
  // 기준 시각은 창을 연 순간으로 고정 — 미리보기와 등록 값이 같도록
  const [nowIso] = useState(() => new Date().toISOString());

  // 서류에서 만든 표면 줄마다 "어떤 서류를 어떻게 읽었는지"·확인할 점이 함께 온다
  const extras = sheetIdx === 0 ? src.extras : undefined;
  const rows = useMemo(() => buildImportRows(sheet.rows, headerRow, mapping, { companies, users, me, nowIso, extras }), [sheet, headerRow, mapping, companies, users, me, nowIso, extras]);
  const count = (s: ImportStatus) => rows.filter((r) => r.status === s).length;
  const ok = rows.filter((r) => r.status === "ok");
  const missingRequired = IMPORT_FIELDS.filter((f) => f.required && !mapping.includes(f.key));
  const recognized = mapping.filter(Boolean).length;
  const shown = rows.filter((r) => filter === "all" || r.status === filter);

  const changeSheet = (i: number) => {
    setSheetIdx(i);
    const s = src.sheets[i];
    setMapping(mapHeaders(s.rows[findHeaderRow(s.rows)] ?? []));
    setFilter("all");
  };

  const setCol = (col: number, key: ImportField | null) => {
    // 한 항목은 한 열에만 — 다른 열에 같은 항목이 있으면 그쪽을 비운다
    setMapping((m) => m.map((k, i) => (i === col ? key : key && k === key ? null : k)));
  };

  const downloadProblems = () => {
    const bad = rows.filter((r) => r.status !== "ok");
    // 원래 열 그대로 + 맨 끝에 사유. 고쳐서 다시 올리면 "확인할 것" 열은 알아서 무시된다
    const out = [[...header, "확인할 것"], ...bad.map((r) => [...header.map((_, i) => sheet.rows[r.line - 1]?.[i] ?? ""), r.problems.join(" / ")])];
    downloadBytes(buildXlsx([{ name: "확인 필요", rows: out }]), "KPJK_기업고객_확인필요.xlsx");
  };

  const fillable = (r: ImportRow) => !!r.match && (Object.keys(r.match.fill).length > 0 || !!r.match.renameTo);
  const fillChecked = (r: ImportRow) => fillOn[r.line] ?? !r.match?.similar;
  const fills = rows.filter((r) => r.status === "duplicate" && fillable(r) && fillChecked(r));

  const submit = () => {
    if (!ok.length && !fills.length) return;
    const n = ok.length ? importCompanies(ok.map((r) => r.data), me, src.label) : 0;
    if (ok.length && !n) { toast("등록하지 못했습니다. 권한이나 중복 여부를 확인해 주세요.", "error"); return; }
    // 있는 값은 건드리지 않는다 — 빈 칸만 (같은 회사로 고른 비슷한 이름은 상호도 서류대로)
    for (const r of fills) updateCompany(r.match!.id, { ...r.match!.fill, ...(r.match!.renameTo && fillChecked(r) ? { name: r.match!.renameTo } : {}) }, me);
    const skipped = rows.length - n - fills.length;
    toast([n ? `${n}곳을 등록했습니다.` : "", fills.length ? `이미 있던 ${fills.length}곳의 빈 칸을 채웠습니다.` : "", skipped ? `건너뛴 ${skipped}줄은 파일에서 고쳐 다시 올리면 됩니다.` : ""].filter(Boolean).join(" "));
    onDone?.(n + fills.length);
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* 출처 */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className="pressable icon-btn text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="다른 파일 고르기"><ArrowLeft size={17} /></button>
        <span className="min-w-0 flex-1 truncate font-semibold">{src.label}</span>
        {src.sheets.length > 1 && (
          <div className="w-full sm:w-52">
            <Select value={String(sheetIdx)} onChange={(e) => changeSheet(Number(e.target.value))} aria-label="시트">
              {src.sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
            </Select>
          </div>
        )}
      </div>

      {src.warnings?.map((w) => <p key={w} role="alert" className="flex items-start gap-1.5 rounded-lg bg-warning-bg px-3 py-2 text-[0.82rem] text-warning"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {w}</p>)}

      {/* 열 맞추기 — 서류에서 만든 표는 칸이 이미 맞춰져 있다 */}
      <details className={cx("rounded-xl border border-line", src.fromDocs && "hidden")} open={missingRequired.length > 0}>
        <summary className="pressable flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3">
          <span className="font-semibold">열 맞추기</span>
          <span className="text-[0.82rem] text-ink-3">{header.length}개 열 중 {recognized}개를 알아봤습니다</span>
          {missingRequired.length > 0 && <Badge tone="error">{missingRequired.map((f) => f.label).join("·")} 열을 골라 주세요</Badge>}
        </summary>
        <div className="grid gap-2 border-t border-line px-4 py-3 sm:grid-cols-2">
          {header.map((h, i) => (
            <label key={i} className="flex min-w-0 items-center gap-2 text-[0.85rem]">
              <span className="w-28 shrink-0 truncate font-semibold text-ink-2" title={h}>{h || `(${i + 1}번째 열)`}</span>
              <Select value={mapping[i] ?? ""} onChange={(e) => setCol(i, (e.target.value || null) as ImportField | null)} aria-label={`${h || i + 1} 열`} className="min-w-0 flex-1">
                <option value="">가져오지 않음</option>
                {IMPORT_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}{f.required ? " (필수)" : ""}</option>)}
              </Select>
            </label>
          ))}
        </div>
      </details>

      {/* 요약 */}
      <div role="group" aria-label="줄 거르기" className="flex flex-wrap gap-1.5">
        <Chip selected={filter === "all"} onClick={() => setFilter("all")}>전체 {rows.length}줄</Chip>
        <Chip selected={filter === "ok"} onClick={() => setFilter("ok")}>등록 가능 {count("ok")}</Chip>
        <Chip selected={filter === "duplicate"} onClick={() => setFilter("duplicate")}>이미 있음 {count("duplicate")}</Chip>
        <Chip selected={filter === "error"} onClick={() => setFilter("error")}>확인 필요 {count("error")}</Chip>
      </div>

      {/* 미리보기 */}
      <div className="max-h-[42vh] divide-y divide-line overflow-y-auto rounded-xl border border-line" id="import-preview">
        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-[0.88rem] text-ink-3">{rows.length ? "이 조건에 맞는 줄이 없습니다." : "머리글 아래에 기업 줄이 없습니다."}</p>
        ) : shown.slice(0, 300).map((r) => <PreviewRow key={r.line} r={r} showLine={!src.fromDocs} fill={fillable(r) ? { on: fillChecked(r), set: (v) => setFillOn((m) => ({ ...m, [r.line]: v })) } : undefined} />)}
        {shown.length > 300 && <p className="px-4 py-3 text-center text-[0.8rem] text-ink-3">외 {shown.length - 300}줄 — 등록에는 모두 포함됩니다</p>}
      </div>

      {/* 휴대폰에서 미리보기가 길어도 등록 버튼은 늘 화면 아래에 붙어 있다 */}
      <div className="sticky bottom-0 z-10 -mx-5 -mb-4 flex flex-wrap items-center gap-2 border-t border-line bg-surface px-5 py-3">
        {rows.length - ok.length > 0 && <Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={downloadProblems}>건너뛸 {rows.length - ok.length}줄 엑셀로 받기</Button>}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="accent" icon={<CheckCircle2 size={16} />} disabled={(!ok.length && !fills.length) || missingRequired.length > 0} onClick={submit}>{[ok.length ? `${ok.length}곳 등록` : "", fills.length ? `${fills.length}곳 빈 칸 채우기` : ""].filter(Boolean).join(" · ") || "등록할 줄 없음"}</Button>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ r, fill, showLine = true }: { r: ImportRow; fill?: { on: boolean; set: (v: boolean) => void }; showLine?: boolean }) {
  const ui = STATUS_UI[r.status];
  const sub = [r.data.ceo, r.data.bizNo, r.data.contactPhone || r.data.contactEmail, r.data.region].filter(Boolean).join(" · ");
  return (
    <div className={cx("flex items-start gap-3 px-4 py-2.5", r.status !== "ok" && "bg-surface-2/40")}>
      {showLine && <span className="tnum mt-0.5 w-9 shrink-0 text-[0.75rem] text-ink-3">{r.line}행</span>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{r.data.name || <span className="text-ink-3">(기업명 없음)</span>}</span>
          <Badge tone={ui.tone}>{ui.label}</Badge>
        </div>
        {sub && <div className="mt-0.5 truncate text-[0.8rem] text-ink-3">{sub}</div>}
        {r.problems.map((p) => <div key={p} className={cx("mt-0.5 text-[0.8rem]", r.status === "error" ? "font-semibold text-error" : "text-ink-2")}>{p}</div>)}
        {r.notes.map((n) => <div key={n} className="mt-0.5 text-[0.78rem] text-ink-3">{n}</div>)}
        {r.files && <div className="mt-0.5 flex items-center gap-1 truncate text-[0.75rem] text-ink-3"><FileText size={12} className="shrink-0" /> {r.files.join(" · ")}</div>}
        {fill && r.match && (
          <label className="mt-1.5 flex cursor-pointer items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[0.82rem]" data-testid="fill-existing">
            <input type="checkbox" checked={fill.on} onChange={(e) => fill.set(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <b>{r.match.similar ? "같은 회사입니다 — " : ""}「{r.match.name}」의 빈 칸 채우기</b>
              <span className="block text-ink-3">
                {[...(r.match.renameTo ? [`상호 → ${r.match.renameTo}`] : []), ...Object.keys(r.match.fill).map((k) => FILL_LABEL[k] ?? k)].join(" · ")} — 이미 있는 값은 바꾸지 않습니다
              </span>
            </span>
          </label>
        )}
      </div>
    </div>
  );
}
