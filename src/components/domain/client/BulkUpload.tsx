"use client";

import { useEffect, useRef, useState } from "react";
import { FolderUp, Loader2, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Company, CompanyVault } from "@/lib/types";
import { CONFIDENCE_LABEL, OTHER_LABEL, OTHER_SLOT, classifyDocument, slotsOf, type ClassifyResult } from "@/lib/vault";
import { extractTextFromFile } from "@/lib/docextract";
import { parseBusinessDoc, PARSED_LABEL, PARSED_ORDER, type ParsedKey } from "@/lib/docparse";
import { storeFileData, fmtBytes } from "@/lib/vault-files";
import { uid } from "@/lib/format";
import { Badge, Button, Input, Select, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";

/**
 * 서류 한꺼번에 올리기 — 파일 여러 개 또는 폴더째.
 *
 * 대표는 서류를 한 번에 보낸다. 넣으면 글자를 읽어 "어느 칸인지" 먼저 골라 두고, 사람은 애매한 것만 본다.
 * 확실한 것도 자동으로 올리지는 않는다 — "확실한 것만 올리기" 한 번이면 된다.
 * 한 파일씩 차례로 읽는다(글자 인식을 여러 개 동시에 돌리면 휴대폰이 멈춘다).
 */

type Status = "reading" | "ready" | "done" | "error";
interface Item {
  id: string;
  file: File;
  folder?: string;
  status: Status;
  result?: ClassifyResult;
  /** 고른 칸 — 기본 칸·직접 만든 칸 키, "other", 또는 "new:이름" */
  target: string;
  issuedAt: string;
  parsed?: Partial<Record<ParsedKey, string | number>>;
  error?: string;
}

const READABLE = /\.(pdf|png|jpe?g|webp)$/i;
const MAX_OCR_BYTES = 8 * 1024 * 1024;

export function BulkUploadModal({ company, vault, open, onClose, initialSlot }: { company: Company; vault?: CompanyVault; open: boolean; onClose: () => void; initialSlot?: string }) {
  if (!open) return null;
  return <Inner company={company} vault={vault} onClose={onClose} initialSlot={initialSlot} />;
}

function Inner({ company, vault, onClose, initialSlot }: { company: Company; vault?: CompanyVault; onClose: () => void; initialSlot?: string }) {
  const serverMode = useStore((s) => s.serverMode);
  const addFiles = useStore((s) => s.addCompanyFiles);
  const addSlot = useStore((s) => s.addCustomSlot);
  const update = useStore((s) => s.updateCompany);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "";
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  /** 사람이 직접 켜고 끈 것만 기억한다. 손대지 않은 칸은 "기업 정보가 비어 있으면 반영" */
  const [choice, setChoice] = useState<Partial<Record<ParsedKey, boolean>>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const queue = useRef<Item[]>([]);
  const running = useRef(false);
  const slots = slotsOf(vault);

  // 폴더 고르기 — 표준 속성이 아니라 JSX 로 못 준다
  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "");
    folderRef.current?.setAttribute("directory", "");
  }, []);

  const patch = (id: string, p: Partial<Item>) => setItems((list) => list.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const runQueue = async () => {
    if (running.current) return;
    running.current = true;
    while (queue.current.length) {
      const it = queue.current.shift()!;
      let text = "";
      try {
        if (READABLE.test(it.file.name) && it.file.size <= MAX_OCR_BYTES) text = (await extractTextFromFile(it.file)).text;
        else if (/\.(txt|csv|md)$/i.test(it.file.name)) text = await it.file.text();
      } catch { text = ""; /* 못 읽으면 이름으로만 고른다 */ }
      const r = classifyDocument({ text, fileName: it.file.name }, slots);
      const target = initialSlot ?? (r.key ?? (r.suggestedLabel ? `new:${r.suggestedLabel}` : OTHER_SLOT));
      let parsed: Item["parsed"];
      if (text && (r.key === "bizReg" || r.key === "corpReg")) {
        const p = parseBusinessDoc(text);
        parsed = {};
        for (const k of PARSED_ORDER) if (p[k] !== undefined) parsed[k] = p[k] as string | number;
      }
      patch(it.id, { status: "ready", result: r, target, issuedAt: r.issuedAt ?? "", parsed });
    }
    running.current = false;
  };

  const addPicked = (list: FileList | File[] | null) => {
    if (!list) return;
    const files = Array.from(list).filter((f) => f.size > 0 && !f.name.startsWith("."));
    if (!files.length) return;
    const next: Item[] = files.map((f) => {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
      const folder = rel && rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : undefined;
      return { id: uid("cf"), file: f, folder, status: "reading" as Status, target: initialSlot ?? OTHER_SLOT, issuedAt: "" };
    });
    setItems((cur) => [...cur, ...next]);
    queue.current.push(...next);
    void runQueue();
    if (fileRef.current) fileRef.current.value = "";
    if (folderRef.current) folderRef.current.value = "";
  };

  // 서류에서 읽은 회사 정보 — 기업 정보에 비어 있는 칸만 기본으로 고른다
  const facts = (() => {
    const out: { key: ParsedKey; value: string | number; current: string }[] = [];
    for (const it of items) for (const [k, v] of Object.entries(it.parsed ?? {}) as [ParsedKey, string | number][]) {
      if (out.some((o) => o.key === k)) continue;
      const cur = company[k as keyof Company];
      const curText = cur === undefined || cur === null || cur === "" || cur === 0 ? "" : String(cur);
      if (String(v) === curText) continue;
      out.push({ key: k, value: v, current: curText });
    }
    return out;
  })();
  const willApply = (f: { key: ParsedKey; current: string }) => choice[f.key] ?? !f.current;

  const ready = items.filter((x) => x.status === "ready");
  const sure = ready.filter((x) => x.result?.confidence === "sure" && x.target === x.result.key);

  const upload = async (which: Item[]) => {
    if (!which.length) return;
    setBusy(true);
    const created = new Map<string, string>();
    const done: Parameters<typeof addFiles>[1] = [];
    for (const it of which) {
      let slot = it.target;
      if (slot.startsWith("new:")) {
        const label = slot.slice(4);
        slot = created.get(label) ?? addSlot(company.id, { label }, me) ?? OTHER_SLOT;
        created.set(label, slot);
      }
      const r = await storeFileData(serverMode, company.id, it.id, it.file);
      if (!r.ok) { patch(it.id, { status: "error", error: r.reason }); continue; }
      done.push({ id: it.id, slot, fileName: it.file.name, size: it.file.size, mime: it.file.type || "", folder: it.folder, issuedAt: it.issuedAt || undefined, storagePath: r.storagePath });
      patch(it.id, { status: "done" });
    }
    const n = addFiles(company.id, done, me);
    const apply = facts.filter(willApply);
    if (apply.length) {
      update(company.id, Object.fromEntries(apply.map((f) => [f.key, f.value])) as Partial<Company>, me);
    }
    setBusy(false);
    const failed = which.length - n;
    toast(`${n}건을 서류함에 올렸습니다.${apply.length ? ` 회사 정보 ${apply.length}칸도 채웠습니다.` : ""}${failed ? ` ${failed}건은 올리지 못했습니다.` : ""}`, failed ? "error" : "success");
    if (!failed && items.every((x) => x.status === "done" || which.includes(x))) onClose();
  };

  const options = [...slots.filter((s) => !s.noFile).map((s) => ({ key: s.key, label: s.label })), { key: OTHER_SLOT, label: OTHER_LABEL }];

  return (
    <Modal open onClose={busy ? () => undefined : onClose} size="lg" title={`${company.name} — 서류 한꺼번에 올리기`}>
      <div className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addPicked(e.dataTransfer.files); }}
          className={cx("rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors", drag ? "border-accent bg-soft/60" : "border-line")}
        >
          <p className="text-[0.9rem] font-semibold">파일이나 폴더를 여기에 끌어다 놓거나 고르세요</p>
          <p className="mt-1 text-[0.8rem] text-ink-3">글자를 읽어 어느 서류인지 먼저 골라 둡니다. 한글·압축 파일 등 무엇이든 올릴 수 있습니다(글자는 PDF·사진만 읽습니다).</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button variant="accent" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>파일 고르기</Button>
            <Button variant="outline" icon={<FolderUp size={16} />} onClick={() => folderRef.current?.click()}>폴더째 고르기</Button>
          </div>
          <input ref={fileRef} type="file" multiple className="hidden" aria-label="서류 파일" onChange={(e) => addPicked(e.target.files)} />
          <input ref={folderRef} type="file" multiple className="hidden" aria-label="서류 폴더" onChange={(e) => addPicked(e.target.files)} />
        </div>
        {!serverMode && <p className="rounded-lg bg-surface-2 px-3 py-2 text-[0.78rem] text-ink-3">지금은 서버 연결 전이라 원본이 <b>이 브라우저</b>에 보관됩니다. 다른 PC 에서는 보이지 않습니다.</p>}

        {items.length > 0 && (
          <div className="max-h-[40vh] divide-y divide-line overflow-y-auto rounded-xl border border-line" id="bulk-rows">
            {items.map((it) => (
              <div key={it.id} className={cx("px-3 py-2.5", it.status === "error" && "bg-error-bg/40")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[0.88rem] font-semibold" title={it.file.name}>{it.file.name}</span>
                  <span className="text-[0.75rem] text-ink-3">{fmtBytes(it.file.size)}</span>
                  {it.status === "reading" && <Badge><Loader2 size={11} className="animate-spin" /> 읽는 중</Badge>}
                  {it.status === "ready" && it.result && <Badge tone={it.result.confidence === "sure" ? "success" : it.result.confidence === "maybe" ? "warning" : "neutral"}>{CONFIDENCE_LABEL[it.result.confidence]}</Badge>}
                  {it.status === "done" && <Badge tone="success">올림</Badge>}
                  {it.status === "error" && <Badge tone="error">실패</Badge>}
                </div>
                {it.folder && <div className="mt-0.5 truncate text-[0.72rem] text-ink-3">📁 {it.folder}</div>}
                {it.status === "ready" && (
                  <>
                    {it.result && <p className="mt-0.5 text-[0.75rem] text-ink-3">{it.result.reason}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Select value={it.target} onChange={(e) => patch(it.id, { target: e.target.value })} aria-label={`${it.file.name} 어느 칸에`} className="w-auto min-w-44">
                        {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                        {it.result?.suggestedLabel && <option value={`new:${it.result.suggestedLabel}`}>새 칸 만들어 올리기 — {it.result.suggestedLabel}</option>}
                      </Select>
                      <Input type="date" value={it.issuedAt} onChange={(e) => patch(it.id, { issuedAt: e.target.value })} aria-label={`${it.file.name} 발급일`} className="w-auto" title="발급일 (유효기간 계산)" />
                      <Button size="sm" variant="ghost" onClick={() => upload([it])} disabled={busy}>이것만 올리기</Button>
                    </div>
                  </>
                )}
                {it.error && <p className="mt-1 text-[0.78rem] font-semibold text-error">{it.error}</p>}
              </div>
            ))}
          </div>
        )}

        {facts.length > 0 && (
          <div className="rounded-xl border border-accent/30 bg-soft/40 px-3 py-2.5" id="bulk-facts">
            <p className="text-[0.85rem] font-bold">서류에서 회사 정보를 찾았습니다 — 체크한 것만 반영합니다</p>
            <div className="mt-1.5 space-y-1">
              {facts.map((f) => (
                <label key={f.key} className="flex items-start gap-2 text-[0.82rem]">
                  <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent)]" checked={willApply(f)}
                    onChange={(e) => setChoice((c) => ({ ...c, [f.key]: e.target.checked }))} />
                  <span className="min-w-0"><b>{PARSED_LABEL[f.key]}</b> {f.key === "capital" ? `${Number(f.value).toLocaleString("ko-KR")}원` : String(f.value)}
                    {f.current && <span className="text-warning"> — 지금 값 「{f.current}」을 바꿉니다</span>}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="sticky bottom-0 z-10 -mx-5 -mb-4 flex flex-wrap items-center gap-2 border-t border-line bg-surface px-5 py-3">
          <span className="text-[0.8rem] text-ink-3">{items.length ? `${items.length}건 · 읽는 중 ${items.filter((x) => x.status === "reading").length}` : ""}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>닫기</Button>
            {sure.length > 0 && sure.length < ready.length && <Button variant="outline" onClick={() => upload(sure)} disabled={busy}>확실한 것만 올리기 ({sure.length})</Button>}
            <Button variant="accent" onClick={() => upload(ready)} disabled={busy || !ready.length}>{busy ? "올리는 중…" : `고른 것 전부 올리기 (${ready.length})`}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
