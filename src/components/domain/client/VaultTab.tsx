"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, ExternalLink, Eye, FileText, FolderOpen, Lock, Plus, Send, Trash2, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import type { Company, CompanyFile, DocumentRequest } from "@/lib/types";
import { addDays, iso } from "@/lib/format";
import { ReviewDocModal } from "@/components/domain/DocActions";
import { OTHER_LABEL, OTHER_SLOT, dueText, previewKind, slotStatus, slotsOf, todayYmd, type SlotMeta, type SlotStatus } from "@/lib/vault";
import { fmtBytes, loadFileData, removeFileData, saveBlob } from "@/lib/vault-files";
import { fmtDate, relativeDay } from "@/lib/format";
import { Badge, Button, Card, EmptyState, Input, Select, cx } from "@/components/ui/ui";
import { Confirm, Modal } from "@/components/ui/overlay";
import { BulkUploadModal } from "./BulkUpload";

/**
 * 기업 서류함 — 어떤 서류를 받았고 언제 만료되는지. 올린 파일은 바로 열어 보고 내려받는다.
 * 파일은 내부 전용이다: 고객 Portal 에는 보이지 않는다(요청자료와 다르다).
 * 대신 칸마다 "고객에게 요청"을 누르면 고객 Portal 요청자료로 가고(알림 포함), 고객이 올리면 이 칸에 "고객이 올림"으로 보인다.
 * 검토 완료하면 칸이 "받음"이 된다(store.reviewDocument).
 */

/** 이 칸과 이어진 요청자료 — 같은 이름으로 요청한 가장 최근 것 */
function linkedRequest(reqs: DocumentRequest[], companyId: string, label: string) {
  return reqs.filter((d) => d.companyId === companyId && d.name === label).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];
}
const OPEN_REQ = ["requested", "revision", "submitted", "reviewing"];
export function VaultTab({ company }: { company: Company }) {
  const vault = useStore((s) => s.companyVaults.find((v) => v.companyId === company.id));
  const allFiles = useStore((s) => s.companyFiles);
  const serverMode = useStore((s) => s.serverMode);
  const role = useStore((s) => s.session?.role);
  const may = can(role, "vault.write");
  const files = useMemo(() => allFiles.filter((f) => f.companyId === company.id), [allFiles, company.id]);
  const [bulk, setBulk] = useState<{ slot?: string } | null>(null);
  const [preview, setPreview] = useState<CompanyFile | null>(null);
  const today = todayYmd();

  const statuses = slotsOf(vault).map((m) => slotStatus(m, vault, files, today));
  // 손볼 것이 위로: 만료 → 만료 임박 → 안 받음 → 받음
  const rank = (s: SlotStatus) => (s.expired ? 0 : s.expiringSoon ? 1 : !s.received ? 2 : 3);
  const sorted = [...statuses].sort((a, b) => rank(a) - rank(b));
  const others = files.filter((f) => f.slot === OTHER_SLOT || !statuses.some((s) => s.meta.key === f.slot));
  const usable = statuses.filter((s) => s.usable).length;
  const reqs = useStore((s) => s.docRequests);
  const askMany = useStore((s) => s.requestCompanyDoc);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "";
  const mayRequest = can(role, "doc.request");
  // 아직 없거나 만료(임박)인데 고객에게 요청하지 않은 칸 — 파일 없이 받는 공동인증서는 제외
  const missing = statuses.filter((s) => !s.meta.noFile && (!s.received || s.expired || s.expiringSoon) && !OPEN_REQ.includes(linkedRequest(reqs, company.id, s.meta.label)?.status ?? ""));
  const [confirmMany, setConfirmMany] = useState(false);

  return (
    <div className="space-y-4" id="vault-tab">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><span className="text-[1.05rem] font-bold">서류함</span><Badge tone={usable === statuses.length ? "success" : "neutral"}>확보 {usable}/{statuses.length}</Badge><Badge>파일 {files.length}</Badge></div>
            <p className="mt-0.5 text-[0.8rem] text-ink-3">발급일을 넣으면 유효기간이 지났는지 먼저 알려 드립니다. 서류함 자체는 내부 전용이고, <b className="text-ink-2">고객에게 요청</b>한 서류만 고객 화면 요청자료에 나타납니다.</p>
          </div>
          {mayRequest && missing.length > 0 && <Button variant="outline" icon={<Send size={16} />} onClick={() => setConfirmMany(true)}>빈 서류 {missing.length}개 고객에게 요청</Button>}
          {may && <Button variant="accent" icon={<Upload size={16} />} onClick={() => setBulk({})}>한꺼번에 올리기</Button>}
        </div>
        {!serverMode && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-1.5 text-[0.75rem] text-ink-3">서버 연결 전: 원본 파일은 이 브라우저에만 보관됩니다.</p>}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {sorted.map((s) => <SlotCard key={s.meta.key} s={s} company={company} may={may} onUpload={() => setBulk({ slot: s.meta.key })} onPreview={setPreview} />)}
      </div>

      <Card className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <FolderOpen size={17} className="text-ink-3" />
          <span className="font-bold">{OTHER_LABEL}</span>
          <Badge>{others.length}</Badge>
          <span className="min-w-0 flex-1 text-[0.78rem] text-ink-3">특허 명세서·정관처럼 칸이 없는 서류. 폴더째 올리면 폴더 경로가 함께 남습니다.</span>
          {may && <Button size="sm" variant="outline" icon={<Upload size={14} />} onClick={() => setBulk({ slot: OTHER_SLOT })}>올리기</Button>}
        </div>
        {others.length === 0 ? <p className="py-3 text-center text-[0.82rem] text-ink-3">아직 없습니다.</p> : (
          <div className="divide-y divide-line rounded-xl border border-line">
            {others.map((f) => <FileRow key={f.id} f={f} company={company} may={may} onPreview={setPreview} showFolder />)}
          </div>
        )}
      </Card>

      {may && <AddSlotForm companyId={company.id} />}

      <Confirm open={confirmMany} onClose={() => setConfirmMany(false)} confirmText="고객에게 요청"
        title={`빈 서류 ${missing.length}개를 고객에게 요청할까요?`}
        desc={`${missing.map((x) => x.meta.label).join(", ")} — 고객 화면 '요청자료'에 올라가고 알림이 갑니다. 기한은 7일 뒤로 잡습니다.`}
        onConfirm={() => {
          const due = iso(addDays(new Date(), 7, 18));
          let n = 0;
          for (const x of missing) if (askMany(company.id, { name: x.meta.label, description: requestText(x.meta), dueDate: due }, me)) n += 1;
          toast(`${n}개 서류를 고객에게 요청했습니다. 고객 화면에 알림이 갑니다.`);
        }} />
      <BulkUploadModal company={company} vault={vault} open={!!bulk} initialSlot={bulk?.slot} onClose={() => setBulk(null)} />
      <PreviewModal file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function SlotCard({ s, company, may, onUpload, onPreview }: { s: SlotStatus; company: Company; may: boolean; onUpload: () => void; onPreview: (f: CompanyFile) => void }) {
  const setSlot = useStore((x) => x.setVaultSlot);
  const rename = useStore((x) => x.renameCustomSlot);
  const removeSlot = useStore((x) => x.removeCustomSlot);
  const toast = useStore((x) => x.toast);
  const me = useStore((x) => x.session?.userId) ?? "";
  const [open, setOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [asking, setAsking] = useState(false);
  const [review, setReview] = useState(false);
  const role = useStore((x) => x.session?.role);
  const reqs = useStore((x) => x.docRequests);
  const m: SlotMeta = s.meta;
  const req = linkedRequest(reqs, company.id, m.label);
  const reqOpen = !!req && OPEN_REQ.includes(req.status);
  const canAsk = can(role, "doc.request") && !m.noFile && !reqOpen && (!s.received || s.expired || s.expiringSoon);
  const tone = s.expired ? "border-error/40 bg-error-bg/30" : s.expiringSoon ? "border-warning/40 bg-warning-bg/30" : "border-line";

  return (
    <div className={cx("rounded-2xl border bg-surface p-3.5", tone)} data-slot={m.key}>
      <div className="flex items-start gap-2.5">
        <label className="mt-0.5 flex shrink-0 cursor-pointer items-center" title={m.noFile ? "받았으면 체크" : "파일 없이 받음만 표시"}>
          <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={s.received} disabled={!may || (!m.noFile && s.files.length > 0)}
            aria-label={`${m.label} 받음`} onChange={(e) => setSlot(company.id, m.key, { received: e.target.checked }, me)} />
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold">{m.label}</span>
            {!s.received && <Badge>안 받음</Badge>}
            {m.sensitive && <Badge tone="warning"><Lock size={10} /> 민감</Badge>}
            {m.custom && <Badge tone="info">직접 만든 칸</Badge>}
            {s.expired && <Badge tone="error">만료됨</Badge>}
            {!s.expired && s.daysLeft !== null && s.received && <Badge tone={s.expiringSoon ? "warning" : "neutral"}>{dueText(s.daysLeft)}</Badge>}
          </div>
          <p className="mt-0.5 text-[0.78rem] text-ink-3">
            {s.received
              ? [s.expiresOn ? `${s.expiresOn}까지 유효` : m.validMonths ? `유효 ${m.validMonths}개월 — 발급일을 넣어 주세요` : "기한 없음", s.state.note && `메모: ${s.state.note}`].filter(Boolean).join(" · ")
              : m.hint ?? (m.validMonths ? `유효 ${m.validMonths}개월` : "")}
          </p>
        </div>
        {may && !m.noFile && <button type="button" onClick={onUpload} className="pressable icon-btn shrink-0 text-ink-3 hover:text-accent" aria-label={`${m.label} 파일 올리기`}><Upload size={16} /></button>}
      </div>

      {/* 고객 Portal 요청과 이어진 상태 */}
      {req && (req.status !== "done" || req.files.length > 0) && (
        <div className={cx("mt-2 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-[0.8rem]", req.status === "submitted" || req.status === "reviewing" ? "bg-success-bg/60" : "bg-surface-2")} data-req={req.status}>
          {req.status === "requested" && <><Send size={14} className="text-info" /><span className="min-w-0 flex-1">고객에게 요청함 · 기한 {fmtDate(req.dueDate)} ({relativeDay(req.dueDate)})</span></>}
          {req.status === "revision" && <><Send size={14} className="text-warning" /><span className="min-w-0 flex-1">보완 요청함 — 고객이 다시 올리면 여기 표시됩니다</span></>}
          {(req.status === "submitted" || req.status === "reviewing") && <><CheckCircle2 size={14} className="text-success" /><span className="min-w-0 flex-1 font-semibold">고객이 Portal 로 올렸습니다{req.files.length ? ` · ${req.files[req.files.length - 1].fileName}` : ""}</span>
            <Button size="sm" variant="accent" onClick={() => setReview(true)}>확인하기</Button></>}
          {req.status === "done" && <><FileText size={14} className="text-ink-3" /><span className="min-w-0 flex-1">고객 제출본 · {req.files[req.files.length - 1]?.fileName}</span><Button size="sm" variant="ghost" onClick={() => setReview(true)}>보기</Button></>}
        </div>
      )}
      {canAsk && (
        <button type="button" onClick={() => setAsking(true)} className="pressable mr-3 mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-accent/40 px-3 text-[0.8rem] font-semibold text-accent hover:bg-soft/50">
          <Send size={14} /> 고객에게 요청
        </button>
      )}
      {asking && <AskModal company={company} meta={m} onClose={() => setAsking(false)} />}
      <ReviewDocModal req={review ? req ?? null : null} open={review} onClose={() => setReview(false)} />

      {s.files.length > 0 && (
        <div className="mt-2 divide-y divide-line rounded-xl border border-line">
          {s.files.map((f) => <FileRow key={f.id} f={f} company={company} may={may} onPreview={onPreview} />)}
        </div>
      )}

      <button type="button" onClick={() => setOpen((v) => !v)} className="pressable mt-1 inline-flex min-h-9 items-center sm:min-h-0 text-[0.78rem] font-semibold text-ink-3 hover:text-ink">{open ? "접기" : "발급일 · 메모" + (m.custom ? " · 칸 고치기" : "")}</button>
      {open && (
        <div className="mt-2 space-y-2">
          {m.validMonths !== undefined && (
            <label className="flex flex-wrap items-center gap-2 text-[0.8rem] text-ink-2">발급일
              <Input type="date" className="w-auto" value={s.state.issuedAt ?? ""} disabled={!may} aria-label={`${m.label} 발급일`}
                onChange={(e) => setSlot(company.id, m.key, { issuedAt: e.target.value || undefined }, me)} />
            </label>
          )}
          <label className="block text-[0.8rem] text-ink-2">{m.key === "jointCert" ? "보관 위치 (비밀번호는 적지 마세요)" : "메모"}
            <Input className="mt-1" defaultValue={s.state.note ?? ""} disabled={!may} aria-label={`${m.label} 메모`}
              onBlur={(e) => { if (e.target.value !== (s.state.note ?? "")) setSlot(company.id, m.key, { note: e.target.value || undefined }, me); }} />
          </label>
          {m.custom && may && (
            <div className="flex flex-wrap items-center gap-2 text-[0.8rem]">
              <Input className="w-auto flex-1" defaultValue={m.label} aria-label="서류 칸 이름" onBlur={(e) => rename(company.id, m.key, e.target.value, me)} />
              <button type="button" onClick={() => setConfirmRemove(true)} className="font-semibold text-ink-3 hover:text-error">칸 없애기</button>
            </div>
          )}
        </div>
      )}
      <Confirm open={confirmRemove} onClose={() => setConfirmRemove(false)} danger confirmText="칸 없애기" title={`'${m.label}' 칸을 없앨까요?`}
        desc="칸만 없앱니다. 이 칸에 올린 파일은 '기타 서류'로 옮겨져 그대로 남습니다."
        onConfirm={() => { removeSlot(company.id, m.key, me); toast("서류 칸을 없앴습니다. 파일은 기타 서류에 남아 있습니다."); setConfirmRemove(false); }} />
    </div>
  );
}

function FileRow({ f, company, may, onPreview, showFolder }: { f: CompanyFile; company: Company; may: boolean; onPreview: (f: CompanyFile) => void; showFolder?: boolean }) {
  const vault = useStore((s) => s.companyVaults.find((v) => v.companyId === company.id));
  const move = useStore((s) => s.moveCompanyFile);
  const remove = useStore((s) => s.removeCompanyFile);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "";
  const [confirm, setConfirm] = useState(false);
  const download = async () => {
    const b = await loadFileData(f);
    if (!b) { toast("파일을 찾지 못했습니다. 다른 브라우저에서 올린 파일일 수 있습니다.", "error"); return; }
    saveBlob(b, f.fileName);
  };
  const slotOptions = [...slotsOf(vault).filter((s) => !s.noFile).map((s) => ({ key: s.key, label: s.label })), { key: OTHER_SLOT, label: OTHER_LABEL }];
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <FileText size={15} className="shrink-0 text-ink-3" />
      <button type="button" onClick={() => onPreview(f)} className="min-w-0 flex-1 text-left" aria-label={`${f.fileName} 미리보기`}>
        <span className="block truncate text-[0.85rem] font-semibold hover:text-accent">{f.fileName}</span>
        <span className="block truncate text-[0.72rem] text-ink-3">{fmtBytes(f.size)} · {fmtDate(f.uploadedAt)}{f.issuedAt ? ` · 발급 ${f.issuedAt}` : ""}{showFolder && f.folder ? ` · 📁 ${f.folder}` : ""}</span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" onClick={() => onPreview(f)} className="pressable icon-btn text-ink-3 hover:text-ink" aria-label={`${f.fileName} 보기`}><Eye size={15} /></button>
        <button type="button" onClick={download} className="pressable icon-btn text-ink-3 hover:text-ink" aria-label={`${f.fileName} 내려받기`}><Download size={15} /></button>
        {may && (
          <>
            <Select value={f.slot} onChange={(e) => move(f.id, e.target.value, me)} aria-label={`${f.fileName} 칸 옮기기`} className="h-9 w-auto max-w-32 text-[0.75rem]">
              {slotOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </Select>
            <button type="button" onClick={() => setConfirm(true)} className="pressable icon-btn text-ink-3 hover:text-error" aria-label={`${f.fileName} 지우기`}><Trash2 size={15} /></button>
          </>
        )}
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} danger confirmText="지우기" title="이 파일을 지울까요?" desc={`${f.fileName} — 원본까지 지워집니다. 지운 사실은 기록에 남습니다.`}
        onConfirm={async () => { await removeFileData(f).catch(() => undefined); remove(f.id, me); setConfirm(false); toast("파일을 지웠습니다."); }} />
    </div>
  );
}

/** 미리보기 — PDF·사진·글자 파일은 창 안에서, 그 밖(한글·압축 등)은 내려받기만 */
export function PreviewModal({ file, onClose }: { file: CompanyFile | null; onClose: () => void }) {
  const [state, setState] = useState<{ id: string; url?: string; text?: string; failed?: boolean } | null>(null);
  const kind = file ? previewKind(file.fileName, file.mime) : "none";

  useEffect(() => {
    if (!file) return;
    let url: string | undefined;
    let alive = true;
    void loadFileData(file).then(async (b) => {
      if (!alive) return;
      if (!b) { setState({ id: file.id, failed: true }); return; }
      if (kind === "text") { setState({ id: file.id, text: (await b.text()).slice(0, 20000) }); return; }
      // PDF 는 파일 형식을 알려 줘야 브라우저가 안에서 연다
      const typed = kind === "pdf" && b.type !== "application/pdf" ? new Blob([b], { type: "application/pdf" }) : b;
      url = URL.createObjectURL(typed);
      setState({ id: file.id, url });
    });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [file, kind]);

  if (!file) return null;
  const cur = state?.id === file.id ? state : null;
  const openNew = () => { if (cur?.url) window.open(cur.url, "_blank", "noopener"); };
  const download = async () => { const b = await loadFileData(file); if (b) saveBlob(b, file.fileName); };

  return (
    <Modal open onClose={onClose} size="xl" title={<span className="block max-w-[70vw] truncate">{file.fileName} — 미리보기</span>}
      footer={<><span className="mr-auto text-[0.78rem] text-ink-3">{fmtBytes(file.size)}{file.folder ? ` · 📁 ${file.folder}` : ""}</span>{cur?.url && <Button variant="ghost" icon={<ExternalLink size={15} />} onClick={openNew}>새 창에서 열기</Button>}<Button variant="accent" icon={<Download size={15} />} onClick={download}>내려받기</Button></>}>
      <div id="vault-preview" className="min-h-[40vh]">
        {!cur ? <div className="flex h-[50vh] items-center justify-center text-ink-3">여는 중…</div>
          : cur.failed ? <EmptyState title="파일을 찾지 못했습니다" desc="다른 브라우저에서 올린 파일일 수 있습니다. 서버를 연결하면 어느 기기에서나 열립니다." />
          // eslint-disable-next-line @next/next/no-img-element -- 브라우저 안의 파일(blob)이라 이미지 최적화 대상이 아니다
          : kind === "image" && cur.url ? <img src={cur.url} alt={file.fileName} className="mx-auto max-h-[70vh] rounded-lg object-contain" />
          : kind === "pdf" && cur.url ? <><iframe src={cur.url} title={file.fileName} className="h-[70vh] w-full rounded-lg border border-line" /><p className="mt-1.5 text-[0.75rem] text-ink-3">휴대폰에서 첫 장만 보이면 &lsquo;새 창에서 열기&rsquo;로 전체를 보세요.</p></>
          : kind === "text" ? <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-[0.8rem]">{cur.text}</pre>
          : <EmptyState icon={<FileText size={30} />} title="이 형식은 여기서 미리 볼 수 없습니다" desc="한글(HWP)·압축 파일 등은 내려받아 여세요." action={<Button variant="accent" icon={<Download size={15} />} onClick={download}>내려받기</Button>} />}
      </div>
    </Modal>
  );
}

function AddSlotForm({ companyId }: { companyId: string }) {
  const add = useStore((s) => s.addCustomSlot);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "";
  const [label, setLabel] = useState("");
  const [months, setMonths] = useState("");
  const submit = () => {
    if (!label.trim()) return;
    const key = add(companyId, { label, validMonths: Number(months) || undefined }, me);
    if (key) { toast("서류 칸을 만들었습니다."); setLabel(""); setMonths(""); }
  };
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2 font-bold"><Plus size={16} className="text-ink-3" /> 서류 칸 추가</div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[12rem] flex-1 text-[0.8rem] text-ink-2">서류 이름<Input className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="예: 법인인감증명서, 특허 명세서" onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /></label>
        <label className="w-32 text-[0.8rem] text-ink-2">유효기간(개월)<Input className="mt-1" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, ""))} placeholder="없음" /></label>
        <Button variant="outline" onClick={submit} disabled={!label.trim()}>서류 칸 추가</Button>
      </div>
    </Card>
  );
}

/** 고객에게 보이는 요청 안내 — 어디서 떼는지 + 카톡도 된다 */
function requestText(m: SlotMeta) {
  return [m.whereToGet, m.hint, "카카오톡으로 보내셔도 되고, 이 화면에서 바로 올리셔도 됩니다."].filter(Boolean).join("\n");
}

function AskModal({ company, meta, onClose }: { company: Company; meta: SlotMeta; onClose: () => void }) {
  const ask = useStore((s) => s.requestCompanyDoc);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "";
  const [due, setDue] = useState(() => iso(addDays(new Date(), 7, 18)).slice(0, 10));
  const [desc, setDesc] = useState(() => requestText(meta));
  const send = () => {
    const id = ask(company.id, { name: meta.label, description: desc.trim(), dueDate: new Date(`${due}T18:00:00`).toISOString() }, me);
    if (!id) { toast("자료를 요청할 권한이 없습니다.", "error"); return; }
    toast(`${meta.label}을(를) 고객에게 요청했습니다. 고객 화면에 알림이 갑니다.`);
    onClose();
  };
  return (
    <Modal open onClose={onClose} size="sm" title={<span className="flex items-center gap-2"><Send size={17} /> {meta.label} 요청</span>}
      footer={<><Button variant="ghost" onClick={onClose}>취소</Button><Button variant="accent" icon={<Send size={15} />} onClick={send}>고객에게 요청</Button></>}>
      <p className="mb-3 text-[0.85rem] text-ink-2">{company.name} 고객 화면의 <b>요청자료</b>에 올라가고 알림이 갑니다. 고객이 올리면 이 서류함 칸에 바로 표시됩니다.</p>
      <label className="block text-[0.85rem] font-semibold text-ink-2">제출 기한
        <Input type="date" className="mt-1" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
      <label className="mt-3 block text-[0.85rem] font-semibold text-ink-2">고객에게 보일 안내
        <textarea className="mt-1 min-h-24 w-full rounded-[10px] border border-line-2 bg-surface px-3.5 py-2.5 text-[0.9rem]" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </label>
    </Modal>
  );
}
