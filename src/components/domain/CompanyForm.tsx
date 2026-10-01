"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Building2, Check, ClipboardPaste, FileUp, History, Loader2, Minimize2, Plus, RotateCcw, ScanLine, UserRound, X } from "lucide-react";
import { clearDraft, draftKey, loadDraft, saveDraft } from "@/lib/drafts";
import { useUi } from "@/lib/ui-store";
import { fmtDateTime } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Company, CompanyDocKind, CompanyDocMeta, EntityType } from "@/lib/types";
import { fmtSize } from "@/lib/format";
import {
  CONSULT_AREAS, CONTACT_TITLES, EMPLOYEE_BANDS, ENTITY_TYPES, INDUSTRY_CHIPS, industryOf, LEAD_SOURCES, REGIONS, REVENUE_BANDS,
  bandOfEmployees, formatBizNo, formatCorpNo, formatPhone, regionOfAddress,
} from "@/lib/company-options";
import { DOC_SOURCE_LABEL, PARSED_LABEL, PARSED_ORDER, bizNoValid, corpNoValid, kindLine, parseBusinessDoc, parseExtracted, parseKindLines, type BizKind, type ParsedDoc, type ParsedKey } from "@/lib/docparse";
import { ACCEPT_DOC, EXTRACT_METHOD_LABEL, extractTextFromFile, type ExtractMethod } from "@/lib/docextract";
import { Modal } from "@/components/ui/overlay";
import { Badge, Button, Input, Textarea, cx } from "@/components/ui/ui";
import { Chip, ChipMulti, ChipSelect } from "@/components/ui/chips";

/**
 * 기업고객 등록 · 수정 — "타자 대신 클릭".
 *
 * 1) 서류(사업자등록증·등기부등본)를 올리면 기본 정보가 채워진다. 값은 사람이 확인한 뒤에만 들어간다.
 * 2) 나머지는 칩을 눌러 고른다. 정확한 숫자가 있으면 언제든 직접 친다.
 * 3) 필수는 기업명·대표자 둘뿐. 담당자를 비우면 대표가 담당자가 된다.
 */

type CompanyForm = Omit<Company, "id" | "code">;

function dateInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY: (consultantId: string) => CompanyForm = (consultantId) => ({
  name: "", ceo: "", industry: "", bizNo: "", contactName: "", contactTitle: "", contactPhone: "", contactEmail: "", address: "",
  employees: 0, revenue: "", firstConsultDate: new Date().toISOString(), consultantId, memo: "", interests: [],
});

export function CompanyModal(props: { open: boolean; companyId?: string | null; onClose: () => void; onCreated?: (id: string) => void }) {
  // 열릴 때마다 새로 마운트해서 폼을 초기화한다. effect로 setState 하지 않는다.
  if (!props.open) return null;
  return <CompanyModalInner key={props.companyId ?? "new"} {...props} />;
}

function CompanyModalInner({ open, companyId, onClose, onCreated }: { open: boolean; companyId?: string | null; onClose: () => void; onCreated?: (id: string) => void }) {
  const st = useStore();
  const create = useStore((s) => s.createCompany);
  const update = useStore((s) => s.updateCompany);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const editing = st.companies.find((c) => c.id === companyId);
  const consultants = st.users.filter((u) => u.role !== "client" && u.active !== false);
  // 쓰는 동안 이 브라우저에 계속 임시 저장한다 — 창이 닫혀도 다시 열면 그대로 이어서 쓴다
  const dKey = draftKey("company", companyId, me);
  const [restored] = useState(() => loadDraft<{ f: CompanyForm; fromDoc: string[] }>(dKey));
  const fresh = () => (editing ? { ...editing, interests: editing.interests ?? [] } : EMPTY(me));
  const [initial, setInitial] = useState<CompanyForm>(fresh);
  const [f, setF] = useState<CompanyForm>(() => restored?.data.f ?? initial);
  const [err, setErr] = useState<Partial<Record<keyof CompanyForm, string>>>({});
  /** 서류에서 읽어 채운 항목 — 라벨 옆에 "서류" 표시 */
  const [fromDoc, setFromDoc] = useState<Set<string>>(() => new Set(restored?.data.fromDoc ?? []));
  const [showRestored, setShowRestored] = useState(!!restored);
  /** 그 외 업태·종목 줄 — 빈 줄도 화면에는 남겨 둬야 새 줄을 쓸 수 있어 따로 들고 있다. 저장은 f.bizItemsExtra(줄마다 "업태 — 종목") */
  const [extra, setExtra] = useState<BizKind[]>(() => parseKindLines((restored?.data.f ?? initial).bizItemsExtra));
  const setExtraRows = (rows: BizKind[]) => {
    setExtra(rows);
    const text = rows.filter((r) => r.category?.trim() || r.item?.trim()).map((r) => kindLine({ category: r.category?.trim(), item: r.item?.trim() })).join("\n");
    set("bizItemsExtra", text || undefined);
  };
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const setFormOpen = useUi((s) => s.setCompanyFormOpen);
  useEffect(() => { setFormOpen(true); return () => setFormOpen(false); }, [setFormOpen]);
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => saveDraft(dKey, { f, fromDoc: [...fromDoc] }, f.name.trim() || (editing ? editing.name : "이름 없는 기업")), 300);
    return () => clearTimeout(t);
  }, [f, fromDoc, dirty, dKey, editing]);
  const startOver = () => {
    clearDraft(dKey);
    const base = fresh();
    setInitial(base); setF(base); setFromDoc(new Set()); setErr({}); setShowRestored(false); setExtra(parseKindLines(base.bizItemsExtra));
  };
  /** 닫기(X)·취소 — 쓰던 내용이 있으면 지우지 않고 남겨 둔다고 알린다 */
  const close = () => {
    if (dirty) toast("작성 중인 내용은 임시 저장했습니다. 다시 열거나 화면 아래 '이어서 쓰기'로 계속 쓸 수 있습니다.", "info");
    onClose();
  };

  const set = <K extends keyof CompanyForm>(k: K, v: CompanyForm[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErr((e) => ({ ...e, [k]: undefined }));
  };

  const applyDoc = (patch: Partial<CompanyForm>, kind: CompanyDocKind, meta: CompanyDocMeta) => {
    setF((x) => ({ ...x, ...patch, docs: { ...(x.docs ?? {}), [kind]: meta } }));
    if (patch.bizItemsExtra !== undefined) setExtra(parseKindLines(patch.bizItemsExtra));
    setFromDoc((s) => new Set([...s, ...Object.keys(patch)]));
    setErr({});
  };

  const validate = () => {
    const e: Partial<Record<keyof CompanyForm, string>> = {};
    if (!f.name.trim()) e.name = "기업명은 필수입니다.";
    else if (st.companies.some((c) => c.id !== companyId && c.name.trim() === f.name.trim())) e.name = "같은 이름의 기업이 이미 있습니다.";
    if (!f.ceo.trim()) e.ceo = "대표자명은 필수입니다.";
    if (f.bizNo && f.bizNo.replace(/\D/g, "").length !== 10) e.bizNo = "사업자번호는 숫자 10자리입니다.";
    if (f.corpNo && f.corpNo.replace(/\D/g, "").length !== 13) e.corpNo = "법인등록번호는 숫자 13자리입니다.";
    if (f.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contactEmail.trim())) e.contactEmail = "이메일 형식이 아닙니다.";
    if (f.employees < 0) e.employees = "0 이상이어야 합니다.";
    setErr(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) { toast("빨간 안내가 붙은 항목을 확인해 주세요.", "error"); return; }
    const t = (s: string | undefined) => (s ?? "").trim();
    const data: CompanyForm = {
      ...f,
      name: t(f.name), ceo: t(f.ceo), industry: t(f.industry), bizNo: t(f.bizNo),
      // 담당자를 비우면 대표가 담당자다 — 소규모 기업은 대부분 그렇다.
      contactName: t(f.contactName) || t(f.ceo), contactTitle: t(f.contactTitle) || (t(f.contactName) ? "" : "대표이사"),
      contactPhone: t(f.contactPhone), contactEmail: t(f.contactEmail), address: t(f.address), revenue: t(f.revenue), memo: t(f.memo),
      corpNo: t(f.corpNo) || undefined, bizCategory: t(f.bizCategory) || undefined, bizItem: t(f.bizItem) || undefined,
      companyPhone: t(f.companyPhone) || undefined, website: t(f.website) || undefined,
      region: f.region ?? regionOfAddress(f.address),
      employeeBand: f.employees > 0 ? bandOfEmployees(f.employees) : f.employeeBand,
      interests: f.interests?.length ? f.interests : undefined,
    };
    if (editing) {
      update(editing.id, data, me);
      clearDraft(dKey);
      toast("기업정보를 수정했습니다. 변경 항목이 활동 기록에 남았습니다.");
      onClose();
    } else {
      const id = create(data, me);
      if (!id) { toast("기업고객을 등록할 권한이 없습니다.", "error"); return; }
      clearDraft(dKey);
      toast(`${data.name}을(를) 등록했습니다.`);
      onClose();
      onCreated?.(id);
    }
  };

  const filled = (Object.keys(f) as (keyof CompanyForm)[]).filter((k) => {
    const v = f[k];
    if (k === "firstConsultDate" || k === "consultantId" || k === "docs" || k === "sample" || k === "archived" || k === "archivedAt") return false;
    return Array.isArray(v) ? v.length > 0 : typeof v === "number" ? v > 0 : !!v;
  }).length;
  const isCorp = f.entityType !== "sole" && f.entityType !== "other";
  const empBand = f.employees > 0 ? bandOfEmployees(f.employees) : f.employeeBand;

  return (
    <Modal
      open={open}
      onClose={close}
      keepOpen
      size="lg"
      title={<span className="flex items-center gap-2"><Building2 size={18} /> {editing ? "기업정보 수정" : "기업고객 등록"}</span>}
      headerActions={
        <button type="button" onClick={() => { saveDraft(dKey, { f, fromDoc: [...fromDoc] }, f.name.trim() || (editing ? editing.name : "이름 없는 기업")); toast("잠시 내려뒀습니다. 화면 아래 '이어서 쓰기'를 누르면 그대로 이어집니다.", "info"); onClose(); }}
          className="pressable inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[0.82rem] font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink" title="쓰던 내용은 그대로 두고 창만 내립니다">
          <Minimize2 size={16} /> <span className="hidden sm:inline">잠시 내려두기</span>
        </button>
      }
      footer={
        <>
          <span className="mr-auto text-[0.8rem] text-ink-3">입력 {filled}개 · 필수는 <b className="text-ink-2">기업명·대표자</b>뿐{dirty && <span className="ml-1.5 text-success">· 자동 임시저장 중</span>}</span>
          <Button variant="ghost" onClick={close}>취소</Button>
          <Button variant="accent" onClick={submit}>{editing ? "저장" : "등록"}</Button>
        </>
      }
    >
      <div className="space-y-6">
        {showRestored && restored && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-info/30 bg-info-bg/60 px-3 py-2.5 text-[0.85rem]" data-testid="draft-restored">
            <History size={16} className="shrink-0 text-info" />
            <span className="min-w-0 flex-1">작성 중이던 내용을 불러왔습니다 <span className="text-ink-3">({fmtDateTime(restored.savedAt)} 저장)</span></span>
            <Button size="sm" variant="ghost" onClick={startOver}>처음부터 다시</Button>
          </div>
        )}
        <DocFillPanel current={f} onApply={applyDoc} />

        {/* 1. 기본 정보 */}
        <Sec n={1} title="기본 정보" desc="서류를 올리면 대부분 자동으로 채워집니다">
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="기업명" required error={err.name} doc={fromDoc.has("name")}>
              <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="예: 주식회사 대한정밀" autoFocus={!editing} />
            </F>
            <F label="대표자" required error={err.ceo} doc={fromDoc.has("ceo")}>
              <Input value={f.ceo} onChange={(e) => set("ceo", e.target.value)} placeholder="성명" />
            </F>
          </div>
          <F chips label="사업자 형태" doc={fromDoc.has("entityType")}>
            <ChipSelect options={ENTITY_TYPES} value={f.entityType} onChange={(v) => set("entityType", v as EntityType | undefined)} />
          </F>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* 국세청 번호 끝자리 검증 — 막지는 않고 알려만 준다(서류에서 한 자리 잘못 읽은 경우를 잡는다) */}
            <F label="사업자등록번호" error={err.bizNo} doc={fromDoc.has("bizNo")}
              hint={f.bizNo.replace(/\D/g, "").length === 10 && !bizNoValid(f.bizNo) ? "검증번호가 맞지 않습니다 — 한 자리가 틀렸을 수 있으니 서류와 한 번 대조해 주세요." : undefined}>
              <Input value={f.bizNo} onChange={(e) => set("bizNo", formatBizNo(e.target.value))} placeholder="000-00-00000" inputMode="numeric" />
            </F>
            {isCorp && (
              <F label="법인등록번호" error={err.corpNo} doc={fromDoc.has("corpNo")}
                hint={(f.corpNo ?? "").replace(/\D/g, "").length === 13 && !corpNoValid(f.corpNo) ? "검증번호가 맞지 않습니다 — 서류와 한 번 대조해 주세요." : undefined}>
                <Input value={f.corpNo ?? ""} onChange={(e) => set("corpNo", formatCorpNo(e.target.value))} placeholder="000000-0000000" inputMode="numeric" />
              </F>
            )}
            <F label={isCorp ? "설립일" : "개업일"} doc={fromDoc.has("establishedAt")}>
              <Input type="date" value={f.establishedAt ?? ""} onChange={(e) => set("establishedAt", e.target.value || undefined)} />
            </F>
            <F label="대표자 생년월일" doc={fromDoc.has("ceoBirth")} hint="가업승계·보험 설계에 씁니다. 주민번호 뒷자리는 저장하지 않습니다.">
              <Input type="date" value={f.ceoBirth ?? ""} onChange={(e) => set("ceoBirth", e.target.value || undefined)} />
            </F>
          </div>
          {/* 사업자등록증 순서 그대로: 업태 → 종목. 첫 줄이 주업태·주종목, 그 아래는 몇 줄이든 추가.
              업종(분류)은 주업태에서 자동으로 고른다 — 같은 목록을 두 번 고르게 하지 않는다 */}
          <div role="group" aria-label="업태 · 종목">
            <span className="mb-1.5 flex items-center gap-1.5 text-[0.85rem] font-semibold text-ink-2">
              업태 · 종목 <span className="font-normal text-ink-3">(사업자등록증)</span>
              {(fromDoc.has("bizCategory") || fromDoc.has("bizItem") || fromDoc.has("bizItemsExtra")) && <Badge tone="success" className="!py-0 !text-[0.68rem]"><ScanLine size={10} /> 서류</Badge>}
            </span>
            <div className="space-y-2">
              <div className="grid grid-cols-[2.6rem_1fr_1fr] items-center gap-2 sm:grid-cols-[3rem_1fr_1fr_2.25rem]">
                <span className="rounded-md bg-accent/10 py-1 text-center text-[0.72rem] font-bold text-accent">주</span>
                <Input aria-label="주업태" value={f.bizCategory ?? ""} onChange={(e) => set("bizCategory", e.target.value || undefined)} placeholder="업태 예: 음식점업"
                  onBlur={(e) => { const ind = industryOf(e.target.value); if (ind && !f.industry) set("industry", ind); }} />
                <Input aria-label="주종목" value={f.bizItem ?? ""} onChange={(e) => set("bizItem", e.target.value || undefined)} placeholder="종목 예: 커피 전문점" />
              </div>
              {extra.map((r, i) => (
                <div key={i} className="grid grid-cols-[2.6rem_1fr_1fr] items-center gap-2 sm:grid-cols-[3rem_1fr_1fr_2.25rem]">
                  <button type="button" onClick={() => setExtraRows(extra.filter((_, j) => j !== i))} aria-label={`${i + 2}번째 업태·종목 지우기`}
                    className="pressable flex h-9 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-error sm:order-last"><X size={15} /></button>
                  <Input aria-label={`${i + 2}번째 업태`} value={r.category ?? ""} onChange={(e) => setExtraRows(extra.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))} placeholder="업태" />
                  <Input aria-label={`${i + 2}번째 종목`} value={r.item ?? ""} onChange={(e) => setExtraRows(extra.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))} placeholder="종목" />
                </div>
              ))}
              <button type="button" onClick={() => setExtra([...extra, {}])}
                className="pressable inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[0.82rem] font-semibold text-accent hover:bg-soft/50">
                <Plus size={15} /> 업태·종목 추가
              </button>
            </div>
            <span className="mt-1 block text-[0.78rem] text-ink-3">첫 줄이 주업태·주종목입니다. 사업자등록증에 여러 줄이면 아래에 이어서 넣으세요.</span>
          </div>
          <F chips label="업종" doc={fromDoc.has("industry")} hint="목록·현황표에서 묶어 보는 분류입니다. 업태를 넣으면 자동으로 골라집니다.">
            <ChipSelect options={INDUSTRY_CHIPS} value={f.industry || undefined} onChange={(v) => set("industry", v ?? "")} custom customPlaceholder="예: 정밀부품 제조" />
          </F>
        </Sec>

        {/* 2. 규모 · 지역 */}
        <Sec n={2} title="규모 · 지역" desc="정확한 숫자를 몰라도 구간만 누르면 됩니다">
          <F chips label="지역" doc={fromDoc.has("region")}>
            <ChipSelect options={REGIONS} value={f.region} onChange={(v) => set("region", v)} />
          </F>
          <F label="주소" doc={fromDoc.has("address")}>
            <Input value={f.address} onChange={(e) => { set("address", e.target.value); const r = regionOfAddress(e.target.value); if (r && !f.region) set("region", r); }} placeholder="사업장 소재지" />
          </F>
          <F chips label="임직원 규모" error={err.employees}>
            <div className="flex flex-wrap items-center gap-1.5">
              <ChipSelect options={EMPLOYEE_BANDS.map((b) => ({ key: b.key, label: b.label }))} value={empBand} onChange={(v) => { set("employeeBand", v); if (f.employees > 0) set("employees", 0); }} />
              <span className="mx-1 text-[0.8rem] text-ink-3">또는</span>
              <span className="flex items-center gap-1.5">
                <Input inputMode="numeric" value={f.employees > 0 ? String(f.employees) : ""} onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")) || 0; set("employees", n); set("employeeBand", bandOfEmployees(n)); }} placeholder="정확히" className="!h-9 !w-24 !rounded-full !text-[0.85rem]" />
                <span className="text-[0.85rem] text-ink-2">명</span>
              </span>
            </div>
          </F>
          <F chips label="매출 규모 (연)">
            <div className="flex flex-wrap items-center gap-1.5">
              <ChipSelect options={REVENUE_BANDS} value={f.revenueBand} onChange={(v) => set("revenueBand", v)} />
              <span className="mx-1 text-[0.8rem] text-ink-3">또는</span>
              <Input value={f.revenue} onChange={(e) => set("revenue", e.target.value)} placeholder="예: 120억" className="!h-9 !w-28 !rounded-full !text-[0.85rem]" />
            </div>
          </F>
        </Sec>

        {/* 3. 담당자 · 연락처 */}
        <Sec n={3} title="담당자 · 연락처" desc="비워두면 대표가 담당자가 됩니다">
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="담당자" error={err.contactName}>
              <div className="flex gap-1.5">
                <Input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder={f.ceo ? `비우면 ${f.ceo} (대표)` : "성명"} className="min-w-0" />
                {f.ceo && f.contactName !== f.ceo && (
                  <Button variant="outline" size="sm" className="shrink-0" icon={<UserRound size={14} />} onClick={() => { set("contactName", f.ceo); set("contactTitle", "대표이사"); }}>대표와 동일</Button>
                )}
              </div>
            </F>
            <F chips label="직책">
              <ChipSelect options={CONTACT_TITLES} value={f.contactTitle || undefined} onChange={(v) => set("contactTitle", v ?? "")} custom customPlaceholder="직책" />
            </F>
            <F label="담당자 연락처">
              <Input value={f.contactPhone} onChange={(e) => set("contactPhone", formatPhone(e.target.value))} placeholder="010-0000-0000" inputMode="tel" />
            </F>
            <F label="담당자 이메일" error={err.contactEmail}>
              <Input value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} inputMode="email" placeholder="Portal 계정 ID로 쓰입니다" />
            </F>
            <F label="회사 대표번호">
              <Input value={f.companyPhone ?? ""} onChange={(e) => set("companyPhone", formatPhone(e.target.value) || undefined)} inputMode="tel" placeholder="02-000-0000" />
            </F>
            <F label="홈페이지">
              <Input value={f.website ?? ""} onChange={(e) => set("website", e.target.value || undefined)} inputMode="url" placeholder="example.co.kr" />
            </F>
          </div>
        </Sec>

        {/* 4. 상담 정보 */}
        <Sec n={4} title="상담 정보" desc="무엇 때문에 왔는지 눌러두면 브리핑과 추천에 쓰입니다">
          <F chips label="관심 컨설팅 분야">
            <div className="space-y-2">
              {["자금", "인증", "법인", "세무·노무"].map((g) => (
                <div key={g} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-14 shrink-0 text-[0.75rem] font-bold text-ink-3">{g}</span>
                  <ChipMulti options={CONSULT_AREAS.filter((a) => a.group === g)} value={f.interests ?? []} onChange={(v) => set("interests", v)} />
                </div>
              ))}
            </div>
          </F>
          <F chips label="유입 경로">
            <ChipSelect options={LEAD_SOURCES} value={f.leadSource} onChange={(v) => set("leadSource", v)} />
          </F>
          <div className="grid gap-3 sm:grid-cols-2">
            <F chips label="담당 컨설턴트">
              <ChipSelect options={consultants.map((u) => ({ key: u.id, label: `${u.name} ${u.title}` }))} value={f.consultantId} onChange={(v) => set("consultantId", v ?? me)} />
            </F>
            <F label="최초 상담일">
              <div className="flex gap-1.5">
                <Input type="date" value={dateInput(f.firstConsultDate)} onChange={(e) => e.target.value && set("firstConsultDate", new Date(`${e.target.value}T09:00:00`).toISOString())} className="min-w-0" />
                <Chip selected={dateInput(f.firstConsultDate) === dateInput()} onClick={() => set("firstConsultDate", new Date().toISOString())} className="shrink-0">오늘</Chip>
              </div>
            </F>
          </div>
          <F label="메모" hint="상담에서 파악한 관심사·의사결정 방식 등">
            <Textarea value={f.memo} onChange={(e) => set("memo", e.target.value)} rows={3} className="!min-h-20" />
          </F>
        </Sec>
      </div>
    </Modal>
  );
}

/* ---------------- 조각 ---------------- */

function Sec({ n, title, desc, children }: { n: number; title: string; desc?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[0.75rem] font-bold text-surface">{n}</span>
        <h4 className="text-[0.95rem] font-bold">{title}</h4>
        {desc && <span className="hidden text-[0.78rem] text-ink-3 sm:inline">— {desc}</span>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/**
 * 항목 라벨. 칩 묶음은 <label>로 감싸지 않는다 — label 안의 첫 버튼이 라벨 전체를 이름으로 갖게 되어
 * 스크린리더가 "사업자 형태 법인 개인사업자 기타" 를 첫 칩 이름으로 읽는다. 칩은 role=group 으로 묶는다.
 */
function F({ label, required, hint, error, doc, chips, children }: { label: string; required?: boolean; hint?: string; error?: string; doc?: boolean; chips?: boolean; children: ReactNode }) {
  const isErr = !!error;
  const head = (
    <span className="mb-1.5 flex items-center gap-1.5 text-[0.85rem] font-semibold text-ink-2">
      {label}{required && <span className="text-error">*</span>}
      {doc && <Badge tone="success" className="!py-0 !text-[0.68rem]"><ScanLine size={10} /> 서류</Badge>}
    </span>
  );
  const text = error ?? hint;
  const foot = text && <span className={cx("mt-1 block text-[0.78rem]", isErr ? "font-semibold text-error" : "text-ink-3")}>{text}</span>;
  if (chips) return <div role="group" aria-label={label}>{head}{children}{foot}</div>;
  return <label className="block">{head}{children}{foot}</label>;
}

/* ---------------- 서류로 채우기 ---------------- */

type Stage =
  | { kind: "idle" }
  | { kind: "busy"; ratio: number; label: string }
  | { kind: "error"; message: string }
  | { kind: "review"; parsed: ParsedDoc; method: ExtractMethod | "paste"; fileName: string; size: number }
  | { kind: "done"; parsed: ParsedDoc; method: ExtractMethod | "paste"; fileName: string; applied: ParsedKey[] };

function DocFillPanel({ current, onApply }: { current: CompanyForm; onApply: (patch: Partial<CompanyForm>, kind: CompanyDocKind, meta: CompanyDocMeta) => void }) {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [pasted, setPasted] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /** 폼에 이미 있는 값 (충돌 표시용) */
  const currentOf = (k: ParsedKey): string => {
    switch (k) {
      case "name": return current.name;
      case "bizNo": return current.bizNo;
      case "corpNo": return current.corpNo ?? "";
      case "ceo": return current.ceo;
      case "ceoBirth": return current.ceoBirth ?? "";
      case "establishedAt": return current.establishedAt ?? "";
      case "address": return current.address;
      case "bizCategory": return current.bizCategory ?? "";
      case "bizItem": return current.bizItem ?? "";
      case "bizItemsExtra": return current.bizItemsExtra ?? "";
      case "capital": return current.capital ? String(current.capital) : "";
    }
  };

  const toPatch = (p: ParsedDoc, keys: ParsedKey[]): Partial<CompanyForm> => {
    const patch: Partial<CompanyForm> = {};
    for (const k of keys) {
      const v = p[k];
      if (v === undefined) continue;
      if (k === "name") patch.name = String(v);
      else if (k === "bizNo") patch.bizNo = String(v);
      else if (k === "corpNo") { patch.corpNo = String(v); patch.entityType = "corporation"; }
      else if (k === "ceo") patch.ceo = String(v);
      else if (k === "ceoBirth") patch.ceoBirth = String(v);
      else if (k === "establishedAt") patch.establishedAt = String(v);
      else if (k === "address") { patch.address = String(v); const r = regionOfAddress(String(v)); if (r) patch.region = r; }
      else if (k === "bizCategory") {
        patch.bizCategory = String(v);
        // 주업태로 업종 칩을 고른다. 맞는 칩이 없으면 비워 둔다 — 업태 글자를 그대로 업종에 넣지 않는다
        const ind = industryOf(String(v));
        if (!current.industry && ind) patch.industry = ind;
      }
      else if (k === "bizItem") patch.bizItem = String(v);
      else if (k === "bizItemsExtra") patch.bizItemsExtra = String(v);
      else if (k === "capital") patch.capital = Number(v);
    }
    if (p.source === "corpReg" && !patch.entityType) patch.entityType = "corporation";
    return patch;
  };

  const finish = (parsed: ParsedDoc, method: ExtractMethod | "paste", fileName: string, size: number) => {
    const found = PARSED_ORDER.filter((k) => parsed[k] !== undefined);
    if (found.length === 0) { setStage({ kind: "review", parsed, method, fileName, size }); return; }
    const conflicts = found.filter((k) => { const cur = currentOf(k); return cur !== "" && cur !== String(parsed[k]); });
    // 빈 폼에 넣는 거라면 확인 없이 바로 채운다 — "알아서" 되어야 한다. 기존 값을 덮어쓸 때만 묻는다.
    if (conflicts.length === 0) { apply(parsed, found, method, fileName, size); return; }
    const c: Record<string, boolean> = {};
    for (const k of found) c[k] = true;
    setChecked(c);
    setStage({ kind: "review", parsed, method, fileName, size });
  };

  const apply = (parsed: ParsedDoc, keys: ParsedKey[], method: ExtractMethod | "paste", fileName: string, size: number) => {
    const kind: CompanyDocKind = parsed.source === "corpReg" ? "corpReg" : "bizReg";
    const patch = toPatch(parsed, keys);
    onApply(patch, kind, { fileName, size, readAt: new Date().toISOString(), method, fields: Object.keys(patch) });
    setStage({ kind: "done", parsed, method, fileName, applied: keys });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setStage({ kind: "busy", ratio: 0, label: "준비 중" });
    try {
      const res = await extractTextFromFile(file, (ratio, label) => setStage({ kind: "busy", ratio, label }), { namePass: true });
      finish(parseExtracted(res.text, res.alt), res.method, file.name, file.size);
    } catch (cause) {
      setStage({ kind: "error", message: cause instanceof Error ? cause.message : "파일을 읽지 못했습니다. 글자 붙여넣기로 시도해 보세요." });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onPaste = () => {
    if (!pasted.trim()) return;
    finish(parseBusinessDoc(pasted), "paste", "붙여넣은 글자", pasted.length);
  };

  const reset = () => { setStage({ kind: "idle" }); setChecked({}); };

  return (
    <div className={cx("rounded-2xl border-2 p-4 transition-colors", stage.kind === "done" ? "border-success/40 bg-success-bg/30" : drag ? "border-accent bg-soft" : "border-dashed border-accent/50 bg-soft/40")}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); void onFile(e.dataTransfer.files?.[0]); }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", stage.kind === "done" ? "bg-success text-white" : "bg-accent text-accent-ink")}>
          {stage.kind === "busy" ? <Loader2 size={18} className="animate-spin" /> : stage.kind === "done" ? <Check size={18} /> : <ScanLine size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[0.95rem] font-bold">{stage.kind === "done" ? "서류에서 읽어 채웠습니다" : "서류로 빠르게 채우기"}</div>
          <div className="text-[0.78rem] text-ink-2">
            {stage.kind === "done"
              ? <>{DOC_SOURCE_LABEL[stage.parsed.source]} · {EXTRACT_METHOD_LABEL[stage.method]} · <b>{stage.applied.length}개 항목</b> 반영 — 아래 <Badge tone="success" className="!py-0 !text-[0.68rem]">서류</Badge> 표시를 확인하세요
                {stage.method === "ocr" && <span className="mt-0.5 block font-semibold text-warning">그림으로 된 서류라 글자를 인식해 읽었습니다. 숫자는 정확한 편이지만 이름·주소는 한두 글자 틀릴 수 있어 한 번 확인해 주세요.</span>}</>
              : "사업자등록증 · 법인등기부등본 PDF나 사진을 올리면 기업명·사업자번호·대표자·주소·설립일을 읽어 채웁니다."}
          </div>
        </div>
        {stage.kind === "done" && <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={reset}>다른 서류</Button>}
      </div>

      {(stage.kind === "idle" || stage.kind === "error" || stage.kind === "busy") && (
        <div className="mt-3">
          <div className="flex gap-1.5">
            <Chip selected={mode === "file"} onClick={() => setMode("file")}><FileUp size={13} /> 파일 올리기</Chip>
            <Chip selected={mode === "paste"} onClick={() => setMode("paste")}><ClipboardPaste size={13} /> 글자 붙여넣기</Chip>
          </div>
          {mode === "file" ? (
            <div className="mt-2">
              <input ref={fileRef} type="file" accept={ACCEPT_DOC} className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
              <button type="button" disabled={stage.kind === "busy"} onClick={() => fileRef.current?.click()}
                className="pressable flex w-full flex-col items-center gap-1 rounded-xl border border-line-2 bg-surface px-4 py-5 text-center hover:border-accent disabled:opacity-70">
                <span className="text-[0.95rem] font-semibold">{stage.kind === "busy" ? stage.label : "PDF 또는 사진 선택 · 끌어다 놓기"}</span>
                <span className="text-[0.78rem] text-ink-3">홈택스·인터넷등기소 PDF는 거의 정확합니다. 사진은 글자 인식(OCR)이라 흐리면 못 읽을 수 있습니다.</span>
              </button>
              {stage.kind === "busy" && stage.ratio > 0 && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(stage.ratio * 100)}%` }} /></div>
              )}
            </div>
          ) : (
            <div className="mt-2">
              <Textarea rows={5} value={pasted} onChange={(e) => setPasted(e.target.value)} className="!min-h-24 !text-[0.88rem]" placeholder={"서류의 글자를 복사해서 붙여넣으세요.\n예) 등록번호 : 214-88-01234\n    상호 : 주식회사 대한정밀"} />
              <Button size="sm" variant="accent" className="mt-2" disabled={!pasted.trim()} onClick={onPaste}>글자에서 읽기</Button>
            </div>
          )}
          {stage.kind === "error" && (
            <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-lg bg-error-bg px-3 py-2 text-[0.82rem] text-error"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {stage.message}</p>
          )}
          <p className="mt-2 text-[0.72rem] leading-relaxed text-ink-3">파일 자체는 저장하지 않습니다. 읽은 값만 확인 후 반영되고, 어떤 서류를 언제 읽었는지만 기록에 남습니다. 주민등록번호 뒷자리는 읽지 않습니다.</p>
        </div>
      )}

      {stage.kind === "review" && (() => {
        const found = PARSED_ORDER.filter((k) => stage.parsed[k] !== undefined);
        const picked = found.filter((k) => checked[k]);
        return (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2 text-[0.82rem]">
              <Badge tone={stage.parsed.source === "unknown" ? "warning" : "info"}>{DOC_SOURCE_LABEL[stage.parsed.source]}</Badge>
              <Badge>{EXTRACT_METHOD_LABEL[stage.method]}</Badge>
              <span className="text-ink-3">{stage.fileName}{stage.method !== "paste" ? ` · ${fmtSize(stage.size)}` : ""}</span>
            </div>
            {found.length === 0 ? (
              <p className="mt-2 rounded-lg bg-warning-bg px-3 py-2.5 text-[0.85rem] text-warning">읽을 수 있는 항목을 찾지 못했습니다. 사진이 흐리거나 기울어졌을 수 있습니다. 글자 붙여넣기로 다시 시도해 보세요.</p>
            ) : (
              <>
                <p className="mt-2 text-[0.82rem] text-ink-2">이미 입력된 값과 다른 항목이 있습니다. 덮어쓸 항목만 체크하세요.</p>
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {found.map((k) => {
                    const value = k === "capital" ? `${Number(stage.parsed[k]).toLocaleString("ko-KR")}원` : String(stage.parsed[k]);
                    const cur = currentOf(k);
                    const over = cur !== "" && cur !== String(stage.parsed[k]);
                    return (
                      <li key={k}>
                        <label className={cx("flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2", checked[k] ? "border-accent bg-surface" : "border-line bg-surface/60")}>
                          <input type="checkbox" checked={!!checked[k]} onChange={(e) => setChecked((s) => ({ ...s, [k]: e.target.checked }))} className="mt-1 h-4 w-4 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[0.72rem] text-ink-3">{PARSED_LABEL[k]}</span>
                            <span className="block break-all text-[0.9rem] font-semibold">{value}</span>
                            {over && <span className="block text-[0.75rem] text-warning">현재 「{cur}」 → 덮어씀</span>}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={reset}>취소</Button>
              <span className="flex-1" />
              {found.length > 0 && <Button size="sm" variant="accent" disabled={picked.length === 0} icon={<Check size={14} />} onClick={() => apply(stage.parsed, picked, stage.method, stage.fileName, stage.size)}>{picked.length}개 적용</Button>}
            </div>
          </div>
        );
      })()}

      {stage.kind === "done" && stage.parsed.capital !== undefined && !stage.applied.includes("capital") && (
        <div className="mt-2 text-[0.78rem] text-ink-3">자본금 {stage.parsed.capital.toLocaleString("ko-KR")}원 (참고)</div>
      )}
    </div>
  );
}
