"use client";

/**
 * 스스로 준비하기 — 내부 화면.
 *  - ClientSelfRuns: 기업 상세 '고객 플랫폼' 탭 — 고객이 직접 한 일(상태 · 준비 · 근거) · 근거 확인
 *  - SelfOverview: 지원사업 매칭 '고객 직접 진행' 탭 — 전체 고객 현황 + 측정(실제 기업 · 샘플 기업 따로)
 *  - LearnAdmin: 지원사업 매칭 '학습 자료' 탭 — 등록 · 수정 · 공개(대표만) · 분류 이름 바꾸기 · 기본 안내 불러오기
 * 담당자는 고객이 고른 상태를 바꾸지 않는다(서버도 막는다). 근거 확인만 한다.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Download, Eye, EyeOff, Pencil, PlayCircle, Plus, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { useMay } from "@/components/domain/EntityModals";
import { checkProgress, isOpen, isTestCompany, resultBasis, selfMetrics, statusLabel } from "@/lib/self-run";
import { DEFAULT_LEARN_CATEGORIES, STARTER_LEARN, learnCategories } from "@/lib/learn";
import { OFFICIAL_LINKS, youtubeId } from "@/lib/official-links";
import { KPJK_CONSULTING_ALL } from "@/lib/company-options";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { saveToDisk, DOC_BUCKET } from "@/lib/server/storage";
import type { Company, LearnContent } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Input, Select, Textarea, cx } from "@/components/ui/ui";
import { Chip } from "@/components/ui/chips";
import { Modal } from "@/components/ui/overlay";
import { LearnBody } from "./SelfParts";

const KIND_LABEL = { program: "지원사업 직접 준비", growth: "성장과제 직접 실행", learn: "학습 완료" } as const;

/* ------------------------------ 기업 상세: 고객이 직접 한 일 ------------------------------ */

export function ClientSelfRuns({ company: c }: { company: Company }) {
  const runs = useStore((s) => s.selfRuns);
  const acts = useStore((s) => s.activities);
  const users = useStore((s) => s.users);
  const serverMode = useStore((s) => s.serverMode);
  const confirm = useStore((s) => s.confirmSelfEvidence);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId ?? "");
  const may = useMay();
  const mine = runs.filter((r) => r.companyId === c.id).sort((a, b) => b.statusAt.localeCompare(a.statusAt));
  const work = mine.filter((r) => r.kind !== "learn");
  const learned = mine.filter((r) => r.kind === "learn");
  return (
    <Card className="p-5" data-testid="client-self-runs">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-[1.05rem] font-bold">고객이 직접 진행한 일</h3>
        <Badge tone="success">스스로 준비하기</Badge>
        <span className="ml-auto text-[0.8rem] text-ink-3">학습 완료 {learned.length}건</span>
      </div>
      <p className="mb-3 text-[0.8rem] text-ink-3">상태는 고객이 직접 고른 값입니다(고객 입력). 고객이 올린 근거를 확인하면 &lsquo;담당자 확인&rsquo;이 붙습니다 — 상태는 바꾸지 않습니다.</p>
      {work.length === 0 ? <p className="rounded-xl bg-surface-2 px-4 py-3 text-[0.86rem] text-ink-2">아직 고객이 직접 시작한 일이 없습니다.</p> : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {work.map((r) => {
            const { done, total } = checkProgress(r);
            const basis = resultBasis(r);
            const hist = acts.filter((a) => a.meta?.runId === r.id).sort((a, b) => b.at.localeCompare(a.at));
            return (
              <li key={r.id} className="px-4 py-3" data-self-run={r.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[0.72rem] font-semibold text-ink-3">{KIND_LABEL[r.kind]}</span>
                  <Badge tone={isOpen(r) ? "info" : r.status === "selected" || r.status === "done" ? "success" : "neutral"}>{statusLabel(r.kind, r.status)}</Badge>
                  <Badge tone={basis.key === "confirmed" ? "success" : basis.key === "attached" ? "warning" : "neutral"}>{basis.label}</Badge>
                  {r.helpRef && <Link href="/ax/opportunities" className="text-[0.75rem] font-semibold text-accent">전문가 도움 요청함 →</Link>}
                </div>
                <div className="mt-1 font-semibold leading-snug">{r.kind === "program" ? r.targetTitle : r.targetKey}</div>
                <div className="mt-0.5 text-[0.78rem] text-ink-3">시작 {fmtDate(r.startedAt)} · 상태 {fmtDateTime(r.statusAt)}{total ? ` · 준비 ${done}/${total}` : ""}</div>
                {r.evidence.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {r.evidence.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[0.84rem]" data-evidence={e.id}>
                        <span className="min-w-0 flex-1"><b>{e.label}</b> {e.value ?? e.fileName}<span className="block text-[0.72rem] text-ink-3">{fmtDate(e.at)} 고객 첨부{e.confirmedAt ? ` · ${fmtDate(e.confirmedAt)} ${users.find((u) => u.id === e.confirmedBy)?.name ?? ""} 확인` : ""}</span></span>
                        {e.storagePath && serverMode && <Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={() => void saveToDisk(DOC_BUCKET, e.storagePath!, e.fileName ?? "근거").then((x) => { if (!x.ok) toast(x.reason ?? "내려받지 못했습니다.", "error"); })}>받기</Button>}
                        {e.confirmedAt ? <ShieldCheck size={17} className="text-success" aria-label="담당자 확인" />
                          : may("self.confirm") && <Button size="sm" variant="outline" icon={<ShieldCheck size={14} />} onClick={() => { confirm(r.id, e.id, me); toast("근거를 확인했습니다. 고객 화면에 '담당자 확인'으로 보입니다."); }}>확인</Button>}
                      </li>
                    ))}
                  </ul>
                )}
                {hist.length > 0 && (
                  <details className="mt-2"><summary className="cursor-pointer text-[0.78rem] font-semibold text-ink-2">기록 {hist.length}건</summary>
                    <ol className="mt-1 space-y-1 border-l border-line pl-3 text-[0.78rem] text-ink-2">{hist.slice(0, 10).map((a) => <li key={a.id}>{a.text} <span className="text-ink-3">· {fmtDateTime(a.at)}</span></li>)}</ol>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------ 전체 현황 + 측정 ------------------------------ */

export function SelfOverview() {
  const st = useStore();
  const sampleOf = useMemo(() => new Set(st.companies.filter(isTestCompany).map((c) => c.id)), [st.companies]);
  const m = useMemo(() => selfMetrics(st.selfRuns, st.activities, (id) => sampleOf.has(id)), [st.selfRuns, st.activities, sampleOf]);
  const runs = st.selfRuns.filter((r) => r.kind !== "learn").sort((a, b) => b.statusAt.localeCompare(a.statusAt));
  const rows: [string, (x: typeof m.real) => string][] = [
    ["학습 완료 (고객 직접 표시)", (x) => `${x.learned}건`],
    ["지원사업 직접 준비 시작", (x) => `${x.programStarted}건`],
    ["직접 신청 기록", (x) => `${x.programApplied}건`],
    ["성장과제 직접 완료", (x) => `${x.growthDone}건`],
    ["성장과제 검토 완료", (x) => `${x.growthReviewed}건`],
    ["직접 하다가 전문가 문의", (x) => `${x.helpRequested}건`],
    ["준비 시작 → 신청까지(중앙값)", (x) => (x.daysToApply === undefined ? "표본 없음" : `${x.daysToApply}일 (표본 ${x.applySamples})`)],
  ];
  return (
    <div className="space-y-4" data-testid="self-overview">
      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-3"><h3 className="font-bold">자기주도 실행 측정</h3><p className="text-[0.78rem] text-ink-3">고객이 남긴 기록을 그대로 센 값입니다. 샘플 기업과 이름이 [가상]으로 시작하는 촬영 · 시험용 기업은 따로 셉니다.</p></div>
        <table className="w-full text-[0.86rem]">
          <thead><tr className="bg-surface-2 text-left text-[0.75rem] text-ink-3"><th className="px-5 py-2 font-semibold">항목</th><th className="px-3 py-2 text-right font-semibold">실제 고객</th><th className="px-5 py-2 text-right font-semibold">샘플 · 시험</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map(([k, f]) => <tr key={k}><td className="px-5 py-2">{k}</td><td className="tnum px-3 py-2 text-right font-bold">{f(m.real)}</td><td className="tnum px-5 py-2 text-right text-ink-2">{f(m.sample)}</td></tr>)}
            <tr><td className="px-5 py-2">기존 방식 대비 업무처리시간 변화</td><td colSpan={2} className="px-5 py-2 text-right text-[0.8rem] text-ink-3">도입 전 기준선이 없어 계산하지 않습니다</td></tr>
          </tbody>
        </table>
      </Card>
      <Card className="p-5">
        <h3 className="mb-2 font-bold">고객 직접 진행 목록 <span className="text-ink-3">{runs.length}</span></h3>
        {runs.length === 0 ? <p className="text-[0.86rem] text-ink-2">아직 없습니다. 고객이 고객 화면의 &lsquo;스스로 준비하기&rsquo;에서 시작하면 여기에 모입니다.</p> : (
          <ul className="divide-y divide-line">
            {runs.map((r) => {
              const co = st.companies.find((c) => c.id === r.companyId);
              return (
                <li key={r.id}>
                  <Link href={`/ax/clients/${r.companyId}?tab=portal`} className="flex flex-wrap items-center gap-2 py-2.5 hover:bg-surface-2/60">
                    <span className="min-w-0 flex-1"><span className="font-semibold">{co?.name ?? r.companyId}</span>{co?.sample && <span className="ml-1 text-[0.72rem] text-ink-3">(샘플)</span>}{co && !co.sample && isTestCompany(co) && <span className="ml-1 text-[0.72rem] text-ink-3">(시연 · 시험)</span>}<span className="block truncate text-[0.8rem] text-ink-2">{KIND_LABEL[r.kind]} · {r.kind === "program" ? r.targetTitle : r.targetKey}</span></span>
                    <Badge tone={isOpen(r) ? "info" : "neutral"}>{statusLabel(r.kind, r.status)}</Badge>
                    <span className="text-[0.75rem] text-ink-3">{fmtDate(r.statusAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------ 학습 자료 관리 ------------------------------ */

type Draft = { id?: string; category: string; newCategory: string; title: string; audience: string; videoUrl: string; minutes: string; summary: string; body: string; prepItems: string; links: string; programTags: string; forAllPrograms: boolean; growthAreas: string[]; published: boolean };
const toDraft = (c?: LearnContent): Draft => ({
  id: c?.id, category: c?.category ?? DEFAULT_LEARN_CATEGORIES[0], newCategory: "", title: c?.title ?? "", audience: c?.audience ?? "", videoUrl: c?.videoUrl ?? "",
  minutes: c?.minutes ? String(c.minutes) : "", summary: c?.summary ?? "", body: (c?.body ?? []).join("\n"), prepItems: (c?.prepItems ?? []).join("\n"),
  links: (c?.links ?? []).map((l) => `${l.label} | ${l.url}`).join("\n"), programTags: (c?.programTags ?? []).join(", "), forAllPrograms: !!c?.forAllPrograms,
  growthAreas: c?.growthAreas ?? [], published: c?.published ?? false,
});
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function LearnAdmin() {
  const st = useStore();
  const may = useMay();
  const save = useStore((s) => s.saveLearn);
  const setPub = useStore((s) => s.setLearnPublished);
  const importStarter = useStore((s) => s.importStarterLearn);
  const rename = useStore((s) => s.renameLearnCategory);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "";
  const manage = may("learn.manage");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [preview, setPreview] = useState<LearnContent | null>(null);
  const [ren, setRen] = useState<{ from: string; to: string } | null>(null);
  const all = st.learnContents;
  const cats = learnCategories(all);
  const missingStarter = STARTER_LEARN.filter((x) => !all.some((y) => y.id === x.id)).length;
  const tableMissing = st.serverMode && st.serverMissing?.includes("learn_contents");

  const submit = () => {
    if (!draft) return;
    const category = draft.category === "__new" ? draft.newCategory : draft.category;
    const links = lines(draft.links).map((l) => { const [label, url] = l.split("|").map((x) => x.trim()); return { label: label ?? "", url: url ?? "" }; });
    const r = save({
      id: draft.id, category, title: draft.title, audience: draft.audience.trim() || undefined, videoUrl: draft.videoUrl, minutes: draft.minutes ? Number(draft.minutes) : undefined,
      summary: draft.summary, body: lines(draft.body), prepItems: lines(draft.prepItems), links, programTags: draft.programTags.split(/[,，]/).map((x) => x.trim()).filter(Boolean),
      forAllPrograms: draft.forAllPrograms, growthAreas: draft.growthAreas, published: draft.published,
    }, me);
    if (r.ok) { toast(draft.id ? "학습 자료를 고쳤습니다." : "학습 자료를 등록했습니다."); setDraft(null); setProblems([]); }
    else setProblems(r.problems);
  };

  return (
    <div className="space-y-4" data-testid="learn-admin">
      {tableMissing && <Card className="border-warning/40 bg-warning-bg/50 p-4 text-[0.85rem]">서버에 학습 자료 표가 아직 없습니다. Supabase 에서 최신 <code>setup.sql</code> 을 한 번 다시 실행하면 저장할 수 있습니다(기존 데이터는 그대로).</Card>}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.88rem]"><b>공개 {all.filter((x) => x.published).length}</b> · 비공개 {all.filter((x) => !x.published).length}</span>
        <span className="text-[0.78rem] text-ink-3">공개한 자료는 고객 화면 &lsquo;스스로 준비하기&rsquo;와 로그인 없는 <Link href="/learn" className="font-semibold text-accent" target="_blank">/learn</Link> 에 보입니다.</span>
        {manage && (
          <span className="ml-auto flex flex-wrap gap-2">
            {missingStarter > 0 && <Button variant="outline" icon={<BookOpen size={15} />} onClick={() => { const n = importStarter(me); if (n) toast(`기본 안내 ${n}개를 비공개로 불러왔습니다. 읽어 보고 공개하세요.`); }}>기본 안내 {missingStarter}개 불러오기</Button>}
            <Button variant="accent" icon={<Plus size={15} />} onClick={() => { setDraft(toDraft()); setProblems([]); }} data-testid="learn-new">새 자료</Button>
          </span>
        )}
      </div>
      {!manage && <p className="text-[0.8rem] text-ink-3">학습 자료 등록 · 수정 · 공개는 대표 계정에서 합니다.</p>}
      {all.length === 0 ? <Card><EmptyState icon={<BookOpen size={30} />} title="학습 자료가 없습니다" desc="'기본 안내 불러오기'로 KPJK 일반 안내 7개를 비공개로 넣고, 읽어 본 뒤 공개하세요. 영상은 YouTube 주소가 있을 때만 붙입니다." /></Card> : (
        cats.filter((k) => all.some((x) => x.category === k)).map((k) => (
          <Card key={k} className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2">
              <span className="min-w-0 font-bold">{k}</span><span className="shrink-0 whitespace-nowrap text-[0.78rem] text-ink-3">{all.filter((x) => x.category === k).length}개</span>
              {manage && <button type="button" className="ml-auto inline-flex min-h-9 shrink-0 items-center whitespace-nowrap text-[0.78rem] font-semibold text-ink-2 hover:text-ink" onClick={() => setRen({ from: k, to: k })}>이름 바꾸기</button>}
            </div>
            <ul className="divide-y divide-line">
              {all.filter((x) => x.category === k).map((x) => (
                <li key={x.id} className="flex flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-2" data-learn-row={x.id}>
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <span className="min-w-0 flex-1"><span className="font-semibold leading-snug">{x.title}</span>
                      <span className="line-clamp-2 block text-[0.75rem] text-ink-3">{youtubeId(x.videoUrl) ? <><PlayCircle size={11} className="inline" /> 영상</> : "글"} · 수정 {fmtDate(x.updatedAt)}{x.forAllPrograms ? " · 모든 공고 공통" : ""}{x.programTags.length ? ` · 공고 낱말 ${x.programTags.join(", ")}` : ""}{x.growthAreas.length ? ` · 과제 ${x.growthAreas.join(", ")}` : ""}</span></span>
                    <Badge tone={x.published ? "success" : "neutral"} className="shrink-0">{x.published ? "공개" : "비공개"}</Badge>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => setPreview(x)}>보기</Button>
                    {manage && <>
                      <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => { setDraft(toDraft(x)); setProblems([]); }}>수정</Button>
                      <Button size="sm" variant="outline" icon={x.published ? <EyeOff size={14} /> : <Eye size={14} />} onClick={() => { setPub(x.id, !x.published, me); toast(x.published ? "비공개로 바꿨습니다." : "공개했습니다."); }} data-learn-pub={x.id}>{x.published ? "비공개로" : "공개"}</Button>
                    </>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} size="lg" title={draft?.id ? "학습 자료 수정" : "새 학습 자료"}
        footer={<><Button variant="ghost" onClick={() => setDraft(null)}>취소</Button><Button variant="accent" onClick={submit} data-testid="learn-save">저장</Button></>}>
        {draft && (
          <div className="space-y-3 text-[0.86rem]">
            {problems.length > 0 && <ul className="rounded-xl bg-error-bg px-4 py-2.5 text-error">{problems.map((p) => <li key={p}>· {p}</li>)}</ul>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block font-semibold">분류
                <Select className="mt-1" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>{cats.map((k) => <option key={k}>{k}</option>)}<option value="__new">+ 새 분류</option></Select>
                {draft.category === "__new" && <Input className="mt-1" value={draft.newCategory} onChange={(e) => setDraft({ ...draft, newCategory: e.target.value })} placeholder="새 분류 이름" aria-label="새 분류 이름" />}
              </label>
              <label className="block font-semibold">예상 학습 시간(분)<Input className="mt-1" inputMode="numeric" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value.replace(/\D/g, "") })} /></label>
            </div>
            <label className="block font-semibold">제목<Input className="mt-1" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="제목" /></label>
            <label className="block font-semibold">추천 대상 (선택)<Input className="mt-1" value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value })} placeholder="예: 처음 정책자금을 알아보는 기업" /></label>
            <label className="block font-semibold">영상 주소 (선택 · YouTube 만)<Input className="mt-1" value={draft.videoUrl} onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" aria-label="영상 주소" />
              <span className="mt-0.5 block text-[0.74rem] font-normal text-ink-3">{draft.videoUrl.trim() ? (youtubeId(draft.videoUrl) ? "YouTube 영상으로 붙습니다." : "YouTube 주소가 아닙니다 — 저장하면 거절됩니다.") : "영상이 없으면 글 안내로 보입니다(재생 화면을 만들지 않습니다)."}</span></label>
            <label className="block font-semibold">핵심 설명<Textarea className="mt-1" rows={3} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></label>
            <label className="block font-semibold">본문 (한 줄에 하나)<Textarea className="mt-1" rows={5} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></label>
            <label className="block font-semibold">학습 후 준비할 것 (한 줄에 하나)<Textarea className="mt-1" rows={3} value={draft.prepItems} onChange={(e) => setDraft({ ...draft, prepItems: e.target.value })} /></label>
            <label className="block font-semibold">공식 사이트 (한 줄에 &ldquo;이름 | https://주소&rdquo;)<Textarea className="mt-1" rows={3} value={draft.links} onChange={(e) => setDraft({ ...draft, links: e.target.value })} aria-label="공식 사이트" /></label>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[0.75rem] text-ink-3">확인한 공식 기관에서 넣기:</span>
              {OFFICIAL_LINKS.map((l) => <button key={l.key} type="button" className="rounded-full border border-line px-2.5 py-0.5 text-[0.75rem] hover:border-accent" onClick={() => setDraft({ ...draft, links: [draft.links.trim(), `${l.label} | ${l.url}`].filter(Boolean).join("\n") })}>{l.label}</button>)}
            </div>
            <label className="block font-semibold">관련 지원사업 낱말 (쉼표로 · 공고 이름 · 분야 · 지원내용에 있으면 연결)<Input className="mt-1" value={draft.programTags} onChange={(e) => setDraft({ ...draft, programTags: e.target.value })} placeholder="예: 정책자금, 보증, 융자" /></label>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={draft.forAllPrograms} onChange={(e) => setDraft({ ...draft, forAllPrograms: e.target.checked })} />모든 공고에 공통으로 붙이기 (공고 찾기 · 공고문 읽기 · 서류 같은 자료)</label>
            <div><div className="mb-1 font-semibold">관련 성장과제</div><div className="flex flex-wrap gap-1.5">{KPJK_CONSULTING_ALL.map((a) => <Chip key={a} selected={draft.growthAreas.includes(a)} onClick={() => setDraft({ ...draft, growthAreas: draft.growthAreas.includes(a) ? draft.growthAreas.filter((x) => x !== a) : [...draft.growthAreas, a] })}>{a}</Chip>)}</div></div>
            <label className={cx("flex items-center gap-2 rounded-xl px-3 py-2", draft.published ? "bg-success-bg text-success" : "bg-surface-2")}><input type="checkbox" className="h-4 w-4" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} data-testid="learn-published" />공개 — 고객 화면과 /learn 에 바로 보입니다</label>
          </div>
        )}
      </Modal>
      <Modal open={!!preview} onClose={() => setPreview(null)} size="lg" title={preview?.title ?? ""}>{preview && <LearnBody c={preview} />}</Modal>
      <Modal open={!!ren} onClose={() => setRen(null)} size="sm" title="분류 이름 바꾸기"
        footer={<><Button variant="ghost" onClick={() => setRen(null)}>취소</Button><Button variant="accent" onClick={() => { if (!ren) return; const n = rename(ren.from, ren.to, me); if (n) toast(`${n}개 자료의 분류 이름을 바꿨습니다.`); setRen(null); }}>바꾸기</Button></>}>
        <Input value={ren?.to ?? ""} onChange={(e) => ren && setRen({ ...ren, to: e.target.value })} aria-label="새 분류 이름" />
      </Modal>
    </div>
  );
}
