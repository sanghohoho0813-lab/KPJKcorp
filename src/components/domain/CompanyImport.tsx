"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import { IMPORT_FIELDS, buildImportRows, companyTemplateSheets, findHeaderRow, mapHeaders, type ImportField, type ImportRow, type ImportStatus } from "@/lib/company-import";
import { buildXlsx, downloadBytes, parseDelimited, readTableFile, type ReadSheet } from "@/lib/xlsx";
import { Badge, Button, Select, Textarea, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";
import { Chip } from "@/components/ui/chips";

/**
 * 기업고객 일괄 등록 창.
 *
 * 흐름: 파일(또는 붙여넣기) → 열 맞추기 → 미리보기 → 등록.
 * 등록 전에는 아무것도 저장하지 않는다. 확인이 필요한 줄은 사유를 붙인 엑셀로 내려받아 고친 뒤 다시 올리면 된다.
 */

interface Source { label: string; sheets: ReadSheet[] }

export function downloadCompanyTemplate() {
  downloadBytes(buildXlsx(companyTemplateSheets()), "KPJK_기업고객_등록양식.xlsx");
}

export function CompanyImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: (count: number) => void }) {
  if (!open) return null;
  return <Inner onClose={onClose} onDone={onDone} />;
}

function Inner({ onClose, onDone }: { onClose: () => void; onDone?: (count: number) => void }) {
  const [src, setSrc] = useState<Source | null>(null);
  return (
    <Modal open onClose={onClose} size="lg" title={<span className="flex items-center gap-2"><FileSpreadsheet size={19} className="text-accent" /> 엑셀로 기업고객 등록</span>}
      footer={src ? undefined : <Button variant="ghost" onClick={onClose}>닫기</Button>}>
      {src ? <Review key={src.label} src={src} onBack={() => setSrc(null)} onClose={onClose} onDone={onDone} /> : <Pick onPicked={setSrc} />}
    </Modal>
  );
}

/* ---------------- 1. 파일 고르기 ---------------- */

function Pick({ onPicked }: { onPicked: (s: Source) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    setErr("");
    if (f.size > 10 * 1024 * 1024) { setErr("10MB 보다 큰 파일은 올릴 수 없습니다. 명단 시트만 남겨 저장해 주세요."); return; }
    setBusy(true);
    try {
      const sheets = (await readTableFile(f)).filter((s) => s.rows.some((r) => r.some((v) => v.trim())));
      if (!sheets.length) throw new Error("파일에 내용이 없습니다.");
      onPicked({ label: f.name, sheets });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "파일을 읽지 못했습니다.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const readPaste = () => {
    const rows = parseDelimited(paste.trim());
    if (rows.length < 2) { setErr("머리글 줄과 기업 한 줄 이상을 붙여넣어 주세요."); return; }
    onPicked({ label: "붙여넣은 내용", sheets: [{ name: "붙여넣기", rows }] });
  };

  return (
    <div className="space-y-4">
      <p className="text-[0.9rem] leading-relaxed text-ink-2">
        쓰시던 고객 명단을 그대로 올리세요. <b className="text-ink">상호·회사명·사업자등록번호</b>처럼 머리글 이름이 달라도 알아서 맞추고, 등록 전에 한 줄씩 확인할 수 있습니다.
      </p>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files?.[0]); }}
        disabled={busy}
        className={cx("pressable flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors", drag ? "border-accent bg-soft/60" : "border-line hover:border-accent/60 hover:bg-surface-2/60")}
      >
        <Upload size={26} className="text-accent" />
        <span className="font-bold">{busy ? "읽는 중…" : "엑셀·CSV 파일 고르기"}</span>
        <span className="text-[0.8rem] text-ink-3">.xlsx · .csv — PC 에서는 여기로 끌어다 놓아도 됩니다</span>
      </button>
      <input ref={fileRef} type="file" accept=".xlsx,.csv,.txt,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} aria-label="명단 파일" />

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
  const toast = useStore((s) => s.toast);

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

  const rows = useMemo(() => buildImportRows(sheet.rows, headerRow, mapping, { companies, users, me, nowIso }), [sheet, headerRow, mapping, companies, users, me, nowIso]);
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

  const submit = () => {
    if (!ok.length) return;
    const n = importCompanies(ok.map((r) => r.data), me, src.label);
    if (!n) { toast("등록하지 못했습니다. 권한이나 중복 여부를 확인해 주세요.", "error"); return; }
    const skipped = rows.length - n;
    toast(`${n}곳을 등록했습니다.${skipped ? ` 건너뛴 ${skipped}줄은 파일에서 고쳐 다시 올리면 됩니다.` : ""}`);
    onDone?.(n);
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

      {/* 열 맞추기 */}
      <details className="rounded-xl border border-line" open={missingRequired.length > 0}>
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
        ) : shown.slice(0, 300).map((r) => <PreviewRow key={r.line} r={r} />)}
        {shown.length > 300 && <p className="px-4 py-3 text-center text-[0.8rem] text-ink-3">외 {shown.length - 300}줄 — 등록에는 모두 포함됩니다</p>}
      </div>

      {/* 휴대폰에서 미리보기가 길어도 등록 버튼은 늘 화면 아래에 붙어 있다 */}
      <div className="sticky bottom-0 z-10 -mx-5 -mb-4 flex flex-wrap items-center gap-2 border-t border-line bg-surface px-5 py-3">
        {rows.length - ok.length > 0 && <Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={downloadProblems}>건너뛸 {rows.length - ok.length}줄 엑셀로 받기</Button>}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="accent" icon={<CheckCircle2 size={16} />} disabled={!ok.length || missingRequired.length > 0} onClick={submit}>{ok.length ? `${ok.length}곳 등록` : "등록할 줄 없음"}</Button>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ r }: { r: ImportRow }) {
  const ui = STATUS_UI[r.status];
  const sub = [r.data.ceo, r.data.bizNo, r.data.contactPhone || r.data.contactEmail, r.data.region].filter(Boolean).join(" · ");
  return (
    <div className={cx("flex items-start gap-3 px-4 py-2.5", r.status !== "ok" && "bg-surface-2/40")}>
      <span className="tnum mt-0.5 w-9 shrink-0 text-[0.75rem] text-ink-3">{r.line}행</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{r.data.name || <span className="text-ink-3">(기업명 없음)</span>}</span>
          <Badge tone={ui.tone}>{ui.label}</Badge>
        </div>
        {sub && <div className="mt-0.5 truncate text-[0.8rem] text-ink-3">{sub}</div>}
        {r.problems.map((p) => <div key={p} className={cx("mt-0.5 text-[0.8rem]", r.status === "error" ? "font-semibold text-error" : "text-ink-2")}>{p}</div>)}
        {r.notes.map((n) => <div key={n} className="mt-0.5 text-[0.78rem] text-ink-3">{n}</div>)}
      </div>
    </div>
  );
}
