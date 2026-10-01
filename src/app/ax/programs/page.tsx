"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Building2, Copy, Download, Link2, Phone, Plus, Trash2, UserPlus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useMay } from "@/components/domain/EntityModals";
import { CATEGORY_LABEL, PROGRAM_CATEGORIES, matchPrograms, matchProgram, profileOfCompany, type MatchProfile } from "@/lib/programs";
import { fetchBizinfo, lastSync, markSynced, openOnly, type LiveStatus } from "@/lib/programs-client";
import { REGIONS } from "@/lib/company-options";
import { fmtRelative } from "@/lib/format";
import type { Lead, LeadStatus, ProgramCategory, SupportProgram } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Tabs, Textarea, cx } from "@/components/ui/ui";
import { Chip } from "@/components/ui/chips";
import { Modal } from "@/components/ui/overlay";
import { ProgramCard, MATCH_NOTE } from "@/components/domain/programs/ProgramCard";

type Tab = "programs" | "companies" | "leads";
const LEAD_STATUS: Record<LeadStatus, { label: string; tone: "accent" | "info" | "success" | "neutral" }> = {
  new: { label: "새 요청", tone: "accent" }, contacted: { label: "연락함", tone: "info" }, converted: { label: "고객 전환", tone: "success" }, dropped: { label: "종료", tone: "neutral" },
};
const leadProfile = (l: Lead): MatchProfile => ({ region: l.region, industry: l.industry, foundedYear: l.foundedYear, employees: l.employees, entityType: l.entityType, interests: l.interests });
const SIX_HOURS = 6 * 3600 * 1000;

export default function ProgramsPage() {
  const st = useStore();
  const router = useRouter();
  const may = useMay();
  const upsert = useStore((s) => s.upsertPrograms);
  const share = useStore((s) => s.shareProgram);
  const remove = useStore((s) => s.removeProgram);
  const setLead = useStore((s) => s.updateLeadStatus);
  const convert = useStore((s) => s.convertLead);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "";
  const [tab, setTab] = useState<Tab>(() => {
    const q = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tab");
    return q === "leads" || q === "companies" ? q : "programs";
  });
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<"matched" | "urgent" | "all">("matched");
  const [q, setQ] = useState("");

  const companies = useMemo(() => st.companies.filter((c) => !c.archived && !c.sample), [st.companies]);
  const programs = useMemo(() => openOnly(st.programs), [st.programs]);
  // 공고별 맞는 고객 · 가망고객
  const byProgram = useMemo(() => {
    const out = new Map<string, { companies: { id: string; name: string; reasons: string[] }[]; leads: number }>();
    for (const p of programs) {
      const cs = companies.map((c) => ({ c, m: matchProgram(p, profileOfCompany(c)) })).filter((x) => x.m && x.m.score >= 3).map((x) => ({ id: x.c.id, name: x.c.name, reasons: x.m!.reasons }));
      const ls = st.leads.filter((l) => l.status !== "dropped" && l.status !== "converted").filter((l) => { const m = matchProgram(p, leadProfile(l)); return m && m.score >= 3; }).length;
      out.set(p.id, { companies: cs, leads: ls });
    }
    return out;
  }, [programs, companies, st.leads]);

  const sync = async (fresh = true) => {
    setBusy(true);
    const r = await fetchBizinfo(fresh);
    setBusy(false);
    setLive(r.status);
    if (r.status !== "ok") { if (fresh) toast(r.status === "not_configured" ? "기업마당 인증키가 아직 연결되지 않았습니다 — 아래 안내를 보세요." : "기업마당에서 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "error"); return; }
    const res = upsert(openOnly(r.items), me);
    markSynced();
    if (fresh) toast(`기업마당 공고 ${r.items.length}건 확인 — 새 공고 ${res.added}건, 바뀐 공고 ${res.updated}건`);
  };
  // 6시간마다 한 번은 저절로 (이 화면을 열 때)
  useEffect(() => {
    if (!may("program.manage")) return;
    const last = lastSync();
    if (!last || Date.now() - Date.parse(last) > SIX_HOURS) { const t = setTimeout(() => void sync(false), 0); return () => clearTimeout(t); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matchLink = typeof window !== "undefined" ? `${window.location.origin}/match?ref=${me}` : "/match";
  const copyLink = async () => {
    const text = `[KPJK] 우리 회사에 맞는 정부지원사업을 찾아보세요. 회사 조건만 고르면 지금 접수 중인 공고를 근거와 함께 보여 드립니다(로그인 없이 무료).\n${matchLink}`;
    try { await navigator.clipboard.writeText(text); toast("가망고객용 안내 문구와 링크를 복사했습니다. 카카오톡에 붙여 넣으세요."); } catch { toast(matchLink); }
  };

  const shown = programs
    .filter((p) => !q.trim() || `${p.title} ${p.agency} ${p.target ?? ""}`.includes(q.trim()))
    .filter((p) => filter === "all" || (filter === "matched" ? (byProgram.get(p.id)?.companies.length ?? 0) + (byProgram.get(p.id)?.leads ?? 0) > 0 : (() => { const m = matchProgram(p, {}); return !!m?.deadline.urgent; })()))
    .sort((a, b) => (a.applyEnd ?? "9999").localeCompare(b.applyEnd ?? "9999"));
  const newLeads = st.leads.filter((l) => l.status === "new").length;

  return (
    <div className="space-y-4">
      <PageHeader title="지원사업 매칭" badge={<Badge tone="accent">베타</Badge>}
        desc="공고를 고객·가망고객의 조건과 맞춰 봅니다. 자격 판정이 아니라 '검토해 볼 공고'와 그 근거입니다."
        actions={may("program.manage") ? <>
          <Button variant="outline" icon={<Download size={15} />} onClick={() => void sync(true)} disabled={busy}>{busy ? "불러오는 중…" : "기업마당에서 불러오기"}</Button>
          <Button variant="outline" icon={<Plus size={15} />} onClick={() => setAdding(true)}>공고 직접 추가</Button>
          <Button variant="accent" icon={<Link2 size={15} />} onClick={copyLink}>가망고객 링크 복사</Button>
        </> : undefined} />

      {live === "not_configured" && (
        <div className="card border-warning/40 bg-warning-bg/50 p-4 text-[0.85rem]" data-testid="bizinfo-setup">
          <b>기업마당 공고 자동 불러오기가 아직 연결되지 않았습니다.</b> 그 전까지는 &ldquo;공고 직접 추가&rdquo;로 넣은 공고로 매칭합니다.
          <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-ink-2">
            <li>기업마당(bizinfo.go.kr) → 정책정보 개방 → <b>API 사용 신청</b> → 인증키 발급(무료)</li>
            <li>Vercel → 프로젝트 → Settings → Environment Variables → 이름 <code className="rounded bg-surface px-1">BIZINFO_API_KEY</code>, 값 = 인증키 → 저장 → 재배포</li>
          </ol>
          <p className="mt-1 text-ink-3">이 키는 서버에만 있고 고객 화면으로 나가지 않습니다.</p>
        </div>
      )}
      {live === "error" && <Card className="p-3 text-[0.85rem] text-ink-2">기업마당에 연결하지 못했습니다. 잠시 후 &ldquo;기업마당에서 불러오기&rdquo;를 다시 눌러 주세요.</Card>}

      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "programs", label: "공고", count: programs.length },
        { key: "companies", label: "고객별", count: companies.length },
        { key: "leads", label: "가망고객", count: newLeads || undefined },
      ]} />

      {tab === "programs" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(["matched", "urgent", "all"] as const).map((k) => <Chip key={k} selected={filter === k} onClick={() => setFilter(k)}>{k === "matched" ? "고객·가망고객과 맞는 공고" : k === "urgent" ? "마감 7일 이내" : "전체"}</Chip>)}
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="공고명·기관 검색" className="!h-9 !w-auto min-w-40 flex-1 !rounded-full" aria-label="공고 검색" />
          </div>
          <p className="text-[0.78rem] text-ink-3">{MATCH_NOTE}</p>
          {shown.length === 0 ? (
            <Card><EmptyState icon={<Bell size={28} />} title={programs.length ? "조건에 맞는 공고가 없습니다" : "아직 공고가 없습니다"} desc={programs.length ? "필터를 '전체'로 바꿔 보세요." : "기업마당에서 불러오거나 공고를 직접 추가하세요."} /></Card>
          ) : shown.map((p) => {
            const info = byProgram.get(p.id) ?? { companies: [], leads: 0 };
            const pending = info.companies.filter((c) => !p.notified.includes(c.id));
            const m = matchProgram(p, {}) ?? { program: p, score: 0, reasons: [], cautions: [], deadline: { label: "", urgent: false } };
            return (
              <ProgramCard key={p.id} m={{ ...m, reasons: [] }} extra={
                <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[0.82rem]" data-program-match={p.id}>
                  {info.companies.length ? (
                    <div><b>맞는 고객 {info.companies.length}곳</b> · {info.companies.slice(0, 6).map((c) => <Link key={c.id} href={`/ax/clients/${c.id}`} className="mr-1.5 inline-block text-accent hover:underline" title={c.reasons.join(", ")}>{c.name}{p.notified.includes(c.id) ? " ✓" : ""}</Link>)}{info.companies.length > 6 ? `외 ${info.companies.length - 6}곳` : ""}</div>
                  ) : <div className="text-ink-3">조건이 맞는 고객 없음</div>}
                  {info.leads > 0 && <button type="button" className="mt-0.5 font-semibold text-accent" onClick={() => setTab("leads")}>맞는 가망고객 {info.leads}명 →</button>}
                </div>
              } actions={may("program.manage") ? <>
                {pending.length > 0 && <Button size="sm" variant="accent" icon={<Bell size={14} />} onClick={() => { const n = share(p.id, pending.map((c) => c.id), me); toast(`고객 ${n}곳에 알림을 보냈습니다. 고객 화면 '지원사업'에 보입니다.`); }}>맞는 고객 {pending.length}곳에 알림</Button>}
                {pending.length === 0 && info.companies.length > 0 && <span className="text-[0.78rem] font-semibold text-success">알림 보냄 ✓</span>}
                {p.source === "manual" && <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => { remove(p.id, me); toast("공고를 지웠습니다."); }}>지우기</Button>}
              </> : undefined} />
            );
          })}
        </div>
      )}

      {tab === "companies" && (
        <div className="space-y-2.5">
          {companies.length === 0 && <Card><EmptyState icon={<Building2 size={28} />} title="기업고객이 없습니다" /></Card>}
          {companies.map((c) => {
            const prof = profileOfCompany(c);
            const ms = matchPrograms(programs, prof, { strongOnly: true });
            const missing = [!prof.region && "지역", !prof.industry && "업종", !prof.foundedYear && "설립일"].filter(Boolean);
            return (
              <div key={c.id} className="card p-4" data-company-programs={c.name}>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/ax/clients/${c.id}`} className="font-bold hover:text-accent">{c.name}</Link>
                  <Badge tone={ms.length ? "accent" : "neutral"}>맞는 공고 {ms.length}건</Badge>
                  {ms.some((m) => m.deadline.urgent) && <Badge tone="error">마감 임박 {ms.filter((m) => m.deadline.urgent).length}</Badge>}
                  {missing.length > 0 && <span className="text-[0.75rem] text-warning">기업정보에 {missing.join("·")}이(가) 없어 덜 정확합니다</span>}
                </div>
                {ms.slice(0, 3).map((m) => <div key={m.program.id} className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.82rem]"><span className={cx("shrink-0 rounded px-1.5 text-[0.72rem] font-bold", m.deadline.urgent ? "bg-error-bg text-error" : "bg-surface-2 text-ink-3")}>{m.deadline.label}</span><span className="min-w-0 flex-1 truncate">{m.program.title}</span><span className="text-[0.72rem] text-ink-3">{m.reasons.slice(0, 2).join(" · ")}</span></div>)}
              </div>
            );
          })}
        </div>
      )}

      {tab === "leads" && (
        <div className="space-y-2.5">
          <Card className="flex flex-wrap items-center gap-2 p-4 text-[0.85rem]">
            <span className="min-w-0 flex-1 text-ink-2">로그인 없는 <b>지원사업 찾기</b> 화면에서 상담을 남긴 분들입니다. 링크를 카카오톡·블로그·명함 QR 로 알리세요.</span>
            <Button size="sm" variant="outline" icon={<Link2 size={14} />} onClick={copyLink}>링크 복사</Button>
            <a href="/match" target="_blank" rel="noopener noreferrer" className="text-[0.82rem] font-semibold text-accent">화면 열어 보기 →</a>
          </Card>
          {st.leads.length === 0 ? <Card><EmptyState icon={<UserPlus size={28} />} title="아직 가망고객이 없습니다" desc="'가망고객 링크 복사'로 지원사업 찾기 화면을 알려 보세요." /></Card>
            : [...st.leads].sort((a, b) => (a.status === "new" ? -1 : 0) - (b.status === "new" ? -1 : 0) || b.createdAt.localeCompare(a.createdAt)).map((l) => {
              const ms = matchPrograms(programs, leadProfile(l), { strongOnly: true });
              const picked = st.programs.filter((p) => l.programIds.includes(p.id));
              const msg = `[KPJK] ${l.contactName}님, 지원사업 찾기에서 남겨 주신 조건으로 지금 검토해 볼 공고는 ${ms.length}건입니다.${ms.slice(0, 3).map((m) => `\n· ${m.program.title} (${m.deadline.label})`).join("")}\n신청 가능 여부와 준비 서류를 함께 확인해 드리겠습니다. 편하신 시간 알려 주세요.`;
              const ageTxt = l.foundedYear ? `업력 ${new Date().getFullYear() - l.foundedYear}년` : "예비창업·업력 미입력";
              return (
                <div key={l.id} className={cx("card p-4", l.status === "new" && "border-accent")} data-lead={l.companyName}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={LEAD_STATUS[l.status].tone}>{LEAD_STATUS[l.status].label}</Badge>
                    <span className="font-bold">{l.companyName}</span>
                    <span className="text-[0.85rem] text-ink-2">{l.contactName}</span>
                    <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 text-[0.85rem] font-semibold text-accent"><Phone size={13} />{l.phone}</a>
                    <span className="ml-auto text-[0.75rem] text-ink-3">{fmtRelative(l.createdAt)}{l.refUserId ? ` · ${st.users.find((u) => u.id === l.refUserId)?.name ?? ""} 링크` : ""}</span>
                  </div>
                  <div className="mt-1 text-[0.8rem] text-ink-3">{[l.region, l.industry, ageTxt, l.employees !== undefined ? `직원 ${l.employees}명 내외` : "", l.interests.map((i) => CATEGORY_LABEL[i]).join("·")].filter(Boolean).join(" · ")}</div>
                  {l.message && <div className="mt-1 text-[0.85rem]">&ldquo;{l.message}&rdquo;</div>}
                  {picked.length > 0 && <div className="mt-1 text-[0.8rem]"><b>관심 공고</b> · {picked.map((p) => p.title).join(" / ")}</div>}
                  <div className="mt-1 text-[0.8rem] text-ink-2">지금 맞는 공고 <b>{ms.length}건</b>{ms.length ? ` — ${ms.slice(0, 2).map((m) => m.program.title).join(", ")}` : ""}</div>
                  {may("lead.manage") && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" icon={<Copy size={14} />} onClick={async () => { try { await navigator.clipboard.writeText(msg); toast("연락 문구를 복사했습니다."); } catch { toast(msg); } }}>연락 문구 복사</Button>
                      {l.status === "new" && <Button size="sm" variant="outline" icon={<Phone size={14} />} onClick={() => { setLead(l.id, "contacted", me); toast("연락함으로 표시했습니다."); }}>연락함</Button>}
                      {l.status !== "converted" ? <Button size="sm" variant="accent" icon={<Building2 size={14} />} onClick={() => { const id = convert(l.id, me); if (id) { toast(`${l.companyName}을(를) 기업고객으로 등록했습니다. 기업정보를 채워 주세요.`); router.push(`/ax/clients/${id}`); } }}>기업고객으로 전환</Button>
                        : l.companyId && <Link href={`/ax/clients/${l.companyId}`} className="inline-flex min-h-9 items-center text-[0.82rem] font-semibold text-accent">기업고객 보기 →</Link>}
                      {l.status !== "dropped" && l.status !== "converted" && <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={() => setLead(l.id, "dropped", me)}>종료</Button>}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {adding && <AddProgram onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddProgram({ onClose }: { onClose: () => void }) {
  const add = useStore((s) => s.addProgram);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "";
  const [f, setF] = useState<{ title: string; agency: string; category: ProgramCategory; regions: string[]; applyEnd: string; url: string; target: string }>({ title: "", agency: "", category: "금융", regions: [], applyEnd: "", url: "", target: "" });
  const submit = () => {
    if (!f.title.trim()) { toast("공고명을 넣어 주세요.", "error"); return; }
    if (f.url && !/^https?:\/\//.test(f.url.trim())) { toast("공고 주소는 http 로 시작해야 합니다.", "error"); return; }
    const id = add({ title: f.title.trim(), agency: f.agency.trim(), category: f.category, regions: f.regions, applyEnd: f.applyEnd || undefined, url: f.url.trim() || undefined, target: f.target.trim() || undefined, tags: [] } as Omit<SupportProgram, "id" | "source" | "notified" | "fetchedAt" | "createdBy">, me);
    if (id) { toast("공고를 추가했습니다. 맞는 고객이 바로 계산됩니다."); onClose(); }
  };
  return (
    <Modal open onClose={onClose} size="md" title="공고 직접 추가" footer={<><Button variant="ghost" onClick={onClose}>취소</Button><Button variant="accent" onClick={submit}>추가</Button></>}>
      <div className="space-y-3">
        <Field label="공고명 *"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="공고문 제목 그대로" aria-label="공고명" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="기관"><Input value={f.agency} onChange={(e) => setF({ ...f, agency: e.target.value })} placeholder="예: 중소벤처기업부" aria-label="기관" /></Field>
          <Field label="분야"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ProgramCategory })} aria-label="분야">{PROGRAM_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</Select></Field>
        </div>
        <div role="group" aria-label="대상 지역">
          <div className="mb-1.5 text-[0.85rem] font-semibold text-ink-2">대상 지역 (전국이면 비워 두세요)</div>
          <div className="flex flex-wrap gap-1.5">{REGIONS.map((r) => <Chip key={r} selected={f.regions.includes(r)} onClick={() => setF({ ...f, regions: f.regions.includes(r) ? f.regions.filter((x) => x !== r) : [...f.regions, r] })}>{r}</Chip>)}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="접수 마감일 (상시면 비움)"><Input type="date" value={f.applyEnd} onChange={(e) => setF({ ...f, applyEnd: e.target.value })} aria-label="접수 마감일" /></Field>
          <Field label="공고 주소"><Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" aria-label="공고 주소" /></Field>
        </div>
        <Field label="지원 대상 · 핵심 조건" hint="업종·업력·지역 같은 말이 들어가면 매칭이 정확해집니다."><Textarea rows={3} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="예: 경기도 소재 제조 중소기업, 창업 7년 이내" aria-label="지원 대상" /></Field>
      </div>
    </Modal>
  );
}
