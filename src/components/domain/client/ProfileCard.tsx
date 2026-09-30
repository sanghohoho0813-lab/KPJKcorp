"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCopy, FileCheck2, Hash, Pencil, Plus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import type { Company, CustomField, ProfileGroup } from "@/lib/types";
import { GROUP_LABEL, GROUP_ORDER, digitsOf, normalizeDate, numberSegments, profileAsText, profileRows, todayLocal, type ProfileRow } from "@/lib/company-profile";
import { formatBizNo, formatCorpNo, formatPhone } from "@/lib/company-options";
import { Badge, Button, Card, Input, SectionTitle, cx } from "@/components/ui/ui";

/**
 * 회사 기본 정보 카드 — 신청서에 옮겨 적는 값을 한 장에.
 * 번호는 조각마다 따로 복사하고(칸이 나뉜 신청서), "숫자만"은 하이픈 없이 복사한다.
 */
export function ProfileCard({ company }: { company: Company }) {
  const vault = useStore((s) => s.companyVaults.find((v) => v.companyId === company.id));
  const role = useStore((s) => s.session?.role);
  const may = can(role, "company.update");
  const [showEmpty, setShowEmpty] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<ProfileGroup | null>(null);
  const today = todayLocal();
  const rows = useMemo(() => profileRows(company, vault, today), [company, vault, today]);
  const filled = rows.filter((r) => r.value && r.key !== "jointCert").length;
  const total = rows.filter((r) => r.key !== "jointCert").length;
  const empties = rows.filter((r) => !r.value).length;
  const allEmpty = filled === 0;

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied((c) => (c === tag ? null : c)), 1500);
    } catch { /* 클립보드 권한이 없으면 조용히 넘어간다 */ }
  };

  return (
    <Card className="p-5" id="profile-card">
      <SectionTitle action={
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" icon={copied === "all" ? <Check size={14} /> : <ClipboardCopy size={14} />} onClick={() => copy(profileAsText(company, rows), "all")} disabled={allEmpty}>{copied === "all" ? "복사됨" : "전체 복사"}</Button>
          <Button size="sm" variant="ghost" icon={copied === "digits" ? <Check size={14} /> : <Hash size={14} />} onClick={() => copy(profileAsText(company, rows, true), "digits")} disabled={allEmpty} title="번호에서 하이픈을 뺀 채로 전체 복사">{copied === "digits" ? "복사됨" : "숫자만"}</Button>
        </div>
      }>
        <span className="flex flex-wrap items-center gap-2">회사 기본 정보 <Badge>{filled}/{total} 입력됨</Badge></span>
      </SectionTitle>
      <p className="-mt-1 mb-3 text-[0.8rem] text-ink-3">번호는 <b className="text-ink-2">조각마다 따로</b> 복사됩니다 — 칸이 나뉜 신청서에 하나씩 붙이세요. 값을 누르면 보이는 그대로 복사됩니다.</p>

      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
        {GROUP_ORDER.map((g) => {
          const list = rows.filter((r) => r.group === g && (showEmpty || allEmpty || r.value || editing === r.key));
          // 이 묶음에 채운 칸이 하나도 없으면 "칸 채우기"를 열기 전까지 숨긴다
          if (!list.length && !(may && (showEmpty || allEmpty))) return null;
          return (
            <section key={g} className={cx("min-w-0", g === "credential" && "md:col-span-2")}>
              <h3 className="mb-1.5 text-[0.78rem] font-bold uppercase tracking-wide text-ink-3">{GROUP_LABEL[g]}</h3>
              <div className="divide-y divide-line rounded-xl border border-line">
                {list.map((r) => (
                  <Row key={r.key} row={r} company={company} may={may && r.edit !== "none"} editing={editing === r.key} onEdit={(v) => setEditing(v ? r.key : null)} copied={copied} copy={copy} />
                ))}
                {g === "credential" && <p className="px-3 py-2 text-[0.75rem] text-ink-3">비밀번호는 여기에 적지 않습니다. 받았는지와 어디에 두었는지만 서류함에 적습니다.</p>}
                {may && (showEmpty || allEmpty) && (adding === g
                  ? <CustomFieldForm company={company} group={g} onDone={() => setAdding(null)} />
                  : <button type="button" onClick={() => setAdding(g)} className="pressable flex w-full items-center gap-1.5 px-3 py-2 text-left text-[0.8rem] font-semibold text-ink-3 hover:text-accent"><Plus size={13} /> {GROUP_LABEL[g]}에 칸 추가</button>)}
              </div>
            </section>
          );
        })}
      </div>

      {!allEmpty && empties > 0 && (
        <button type="button" onClick={() => setShowEmpty((v) => !v)} className="pressable mt-2 inline-flex min-h-9 items-center sm:min-h-0 text-[0.82rem] font-semibold text-accent">
          {showEmpty ? "아직 안 적은 칸 접기" : `아직 안 적은 ${empties}칸 채우기 · 칸 추가`}
        </button>
      )}
    </Card>
  );
}

function Row({ row: r, company, may, editing, onEdit, copied, copy }: {
  row: ProfileRow; company: Company; may: boolean; editing: boolean; onEdit: (on: boolean) => void;
  copied: string | null; copy: (text: string, tag: string) => void;
}) {
  const update = useStore((s) => s.updateCompany);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "";
  // 직접 만든 칸도 "123-4567" 같은 번호면 조각 복사를 준다 (공장 등록번호 등)
  const segs = r.numberKind || r.custom ? numberSegments(r.value) : [];
  const digits = segs.length ? digitsOf(r.value) : "";

  const save = (raw: string) => {
    const v = raw.trim();
    if (r.custom) {
      const list = (company.customFields ?? []).map((f) => (f.id === r.custom!.id ? { ...f, value: v } : f));
      update(company.id, { customFields: list }, me);
      onEdit(false);
      return;
    }
    if (!r.field) return;
    let value: unknown = v;
    if (r.edit === "date") {
      if (v && !normalizeDate(v)) { toast("날짜로 읽지 못했습니다. 예: 2019-03-05 또는 20190305", "error"); return; }
      value = v ? normalizeDate(v) : undefined;
    } else if (r.edit === "number") {
      const n = Number(v.replace(/[^\d]/g, ""));
      value = r.field === "employees" ? (n || 0) : n ? n : undefined;
    } else if (r.field === "bizNo") value = v.replace(/\D/g, "").length === 10 ? formatBizNo(v) : v;
    else if (r.field === "corpNo") value = v ? (v.replace(/\D/g, "").length === 13 ? formatCorpNo(v) : v) : undefined;
    else if (r.field === "contactPhone" || r.field === "companyPhone") value = v ? formatPhone(v) : r.field === "contactPhone" ? "" : undefined;
    else if (r.field === "name" && !v) { toast("기업명은 비울 수 없습니다.", "error"); return; }
    else if (r.field === "ceo" && !v) { toast("대표자명은 비울 수 없습니다.", "error"); return; }
    else if (!["name", "ceo", "contactName", "contactEmail", "address", "industry"].includes(r.field)) value = v || undefined;
    update(company.id, { [r.field]: value } as Partial<Company>, me);
    onEdit(false);
  };

  if (editing && r.edit === "gender") {
    return (
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="w-28 shrink-0 text-[0.8rem] text-ink-3">{r.label}</span>
        {(["male", "female"] as const).map((g) => (
          <button key={g} type="button" onClick={() => { update(company.id, { ceoGender: g }, me); onEdit(false); }}
            className={cx("pressable h-9 rounded-full border px-4 text-[0.85rem] font-semibold", company.ceoGender === g ? "border-accent bg-accent text-accent-ink" : "border-line text-ink-2")}>{g === "male" ? "남" : "여"}</button>
        ))}
        <button type="button" onClick={() => onEdit(false)} className="pressable icon-btn text-ink-3" aria-label="취소"><X size={15} /></button>
      </div>
    );
  }
  if (editing) return <EditLine row={r} onSave={save} onCancel={() => onEdit(false)} onRemove={r.custom ? () => { update(company.id, { customFields: (company.customFields ?? []).filter((f) => f.id !== r.custom!.id) }, me); onEdit(false); } : undefined} />;

  return (
    // 폰: 이름 위·값 아래(값이 한 줄을 다 쓴다) / PC: 이름 칸 옆에 값
    <div className={cx("group relative flex min-w-0 flex-col gap-0.5 px-3 py-2", may && "pr-11", "sm:flex-row sm:items-start sm:gap-2")}>
      <span className="text-[0.75rem] text-ink-3 sm:w-28 sm:shrink-0 sm:pt-0.5 sm:text-[0.8rem]">{r.label}</span>
      <div className="min-w-0 flex-1">
        {!r.value ? (
          <span className="text-[0.85rem] text-ink-3">—</span>
        ) : segs.length ? (
          <div className="flex flex-wrap items-center gap-1">
            {segs.map((sg, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-ink-3" aria-hidden>-</span>}
                <button type="button" onClick={() => copy(sg, `${r.key}:${i}`)} aria-label={`${r.label} ${sg} 만 복사`} title={`${sg} 만 복사 — 칸이 나뉜 신청서용`}
                  className={cx("pressable tnum inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border px-2 text-[0.9rem] font-semibold sm:min-h-0 sm:min-w-0 sm:px-1.5 sm:py-0.5", copied === `${r.key}:${i}` ? "border-success/40 bg-success-bg text-success" : "border-line bg-surface hover:border-accent/50")}>{sg}</button>
              </span>
            ))}
            <button type="button" onClick={() => copy(r.value, r.key)} className="pressable icon-btn text-ink-3 hover:text-ink" aria-label={`${r.label} 전체 복사`} title="하이픈 포함 전체 복사">
              {copied === r.key ? <Check size={14} className="text-success" /> : <ClipboardCopy size={14} />}
            </button>
            {digits !== r.value && (
              <button type="button" onClick={() => copy(digits, `${r.key}:d`)} title="숫자만 복사 — 하이픈 없이"
                className={cx("pressable inline-flex min-h-9 items-center rounded-full border px-3 text-[0.72rem] font-bold sm:min-h-0 sm:px-2 sm:py-0.5", copied === `${r.key}:d` ? "border-success/40 bg-success-bg text-success" : "border-line text-ink-3 hover:text-ink")}>{copied === `${r.key}:d` ? "복사됨" : "숫자만"}</button>
            )}
          </div>
        ) : r.copyable ? (
          <button type="button" onClick={() => copy(r.value, r.key)} title="눌러서 복사 — 보이는 그대로" className={cx("pressable -mx-1 inline-flex min-h-9 max-w-full items-center rounded px-1 text-left text-[0.9rem] font-medium break-words sm:min-h-0", copied === r.key ? "bg-success-bg text-success" : "hover:bg-surface-2")}>
            {r.value}{copied === r.key && <span className="ml-1.5 text-[0.75rem] font-bold">복사됨</span>}
          </button>
        ) : (
          <span className="text-[0.9rem] font-medium">{r.value}</span>
        )}
        {r.from && r.value && <div className="mt-0.5 flex items-center gap-1 text-[0.72rem] text-success"><FileCheck2 size={11} /> {r.from}</div>}
      </div>
      {may && (
        <button type="button" onClick={() => onEdit(true)} className="pressable icon-btn absolute right-1 top-1 text-ink-3 hover:text-ink md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100" aria-label={`${r.label} ${r.value ? "고치기" : "입력"}`}>
          {r.value ? <Pencil size={14} /> : <Plus size={14} />}
        </button>
      )}
    </div>
  );
}

function EditLine({ row, onSave, onCancel, onRemove }: { row: ProfileRow; onSave: (v: string) => void; onCancel: () => void; onRemove?: () => void }) {
  const [v, setV] = useState(row.raw ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <div className="px-3 py-2">
      <div className="mb-1 text-[0.8rem] text-ink-3">{row.label}</div>
      <div className="flex items-center gap-1.5">
        <Input autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder={row.placeholder}
          inputMode={row.edit === "number" || row.numberKind ? "numeric" : undefined} aria-label={row.label}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(v); if (e.key === "Escape") onCancel(); }} />
        <Button size="sm" variant="accent" onClick={() => onSave(v)}>저장</Button>
        <button type="button" onClick={onCancel} className="pressable icon-btn text-ink-3" aria-label="취소"><X size={15} /></button>
      </div>
      {onRemove && (confirmRemove
        ? <div className="mt-1.5 flex items-center gap-2 text-[0.8rem]"><span className="text-ink-2">칸을 없앨까요?</span><button type="button" className="font-bold text-error" onClick={onRemove}>네, 없앱니다</button><button type="button" className="text-ink-3" onClick={() => setConfirmRemove(false)}>아니요</button></div>
        : <button type="button" onClick={() => setConfirmRemove(true)} className="mt-1.5 text-[0.78rem] font-semibold text-ink-3 hover:text-error">칸 없애기</button>)}
    </div>
  );
}

function CustomFieldForm({ company, group, onDone }: { company: Company; group: ProfileGroup; onDone: () => void }) {
  const update = useStore((s) => s.updateCompany);
  const me = useStore((s) => s.session?.userId) ?? "";
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const add = () => {
    if (!label.trim()) return;
    const f: CustomField = { id: `cf${Date.now().toString(36)}`, group, label: label.trim(), value: value.trim() };
    update(company.id, { customFields: [...(company.customFields ?? []), f] }, me);
    onDone();
  };
  return (
    <div className="space-y-1.5 px-3 py-2.5">
      <div className="text-[0.8rem] font-semibold">{GROUP_LABEL[group]}에 칸 만들기</div>
      <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="칸 이름 — 예: 공장 등록번호" aria-label="칸 이름" />
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="내용" aria-label="칸 내용" onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
      <p className="text-[0.75rem] text-ink-3">비밀번호·주민등록번호는 여기에도 적지 않습니다.</p>
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={onDone}>취소</Button>
        <Button size="sm" variant="accent" disabled={!label.trim()} onClick={add}>넣기</Button>
      </div>
    </div>
  );
}
