"use client";

/**
 * 스스로 준비하기 — 고객 화면 부품.
 * 상태 고르기 · 체크리스트 · 근거(접수번호 · 확인서) · 전문가 도움(선택) · 진행 기록 · 학습 자료.
 * 기록은 고객 본인 계정에서만 남는다 — 담당자 미리보기에서는 읽기만(고객이 하지 않은 일을 고객 기록으로 만들지 않는다).
 */
import Link from "next/link";
import { useRef, useState } from "react";
import { BookOpen, Check, CheckCircle2, ExternalLink, FileUp, Hash, MessageSquarePlus, PlayCircle, ShieldCheck, Trash2 } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { useOnBehalf } from "@/components/domain/portal/CancelRequest";
import { GROWTH_STATUSES, PROGRAM_STATUSES, checkProgress, resultBasis, statusLabel, type CheckItem } from "@/lib/self-run";
import { safeHttpsUrl, youtubeEmbed, youtubeId } from "@/lib/official-links";
import { fmtDate, fmtDateTime, fmtSize, uid } from "@/lib/format";
import { uploadSelfEvidence } from "@/lib/server/storage";
import type { LearnContent, SelfRun, SelfRunKind, SelfRunStatus } from "@/lib/types";
import { Badge, Button, Input, Progress, Select, Textarea, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";

/** 지금 화면을 보는 사람이 기록을 남길 수 있는가 — 고객 본인만 */
export function useCanRecord() {
  const { isClient } = useOnBehalf();
  return isClient;
}

/** 미리보기 · 비회원 안내 한 줄 */
export function ReadOnlyNote() {
  return <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[0.8rem] text-ink-2">담당자 미리보기입니다 — 진행 기록은 고객 계정에서만 남습니다.</p>;
}

/** 경로 표시 — 직접 하기(무료)와 전문가 도움(선택)을 늘 구분해 보인다 */
export function PathTag({ kind }: { kind: "self" | "expert" }) {
  return kind === "self"
    ? <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2.5 py-0.5 text-[0.72rem] font-bold text-success">직접 하기 · 무료</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-[0.72rem] font-bold text-ink-2">전문가 도움 · 선택</span>;
}

/** 단계 제목 — 1 이해하기 · 2 교육 · 3 체크리스트 · 4 신청 · 5 결과 */
export function Step({ n, title, sub, children, id, done }: { n: number; title: string; sub?: string; children: React.ReactNode; id?: string; done?: boolean }) {
  return (
    <section id={id} className="card scroll-mt-20 p-4 md:p-5" data-self-step={n}>
      <div className="mb-3 flex items-start gap-3">
        <span className={cx("tnum flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.85rem] font-bold", done ? "bg-success text-white" : "bg-soft text-accent-strong")}>
          {done ? <Check size={16} strokeWidth={3} /> : n}
        </span>
        <div className="min-w-0">
          <h2 className="text-[1.05rem] font-bold leading-snug">{title}</h2>
          {sub && <p className="mt-0.5 text-[0.8rem] leading-relaxed text-ink-3">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** 상태 고르기 — 지금 상태를 한 번 눌러 바꾼다(되돌리기도 가능). 고객 본인만 */
export function StatusPicker({ run }: { run: SelfRun }) {
  const set = useStore((s) => s.setSelfStatus);
  const toast = useStore((s) => s.toast);
  const can = useCanRecord();
  const list = run.kind === "program" ? PROGRAM_STATUSES : run.kind === "growth" ? GROWTH_STATUSES : [];
  const pick = (to: SelfRunStatus) => {
    if (!can) return;
    if (set(run.id, to)) toast(`'${statusLabel(run.kind, to)}'(으)로 기록했습니다.${to === "applied" || to === "selected" || to === "not_selected" || to === "done" ? " 담당 컨설턴트에게도 알려 드렸습니다." : ""}`);
  };
  return (
    <div>
      <div role="radiogroup" aria-label="진행 상태" className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="self-status">
        {list.map((s) => {
          const on = run.status === s.key;
          return (
            <button key={s.key} type="button" role="radio" aria-checked={on} disabled={!can} onClick={() => pick(s.key)} data-status={s.key}
              className={cx("pressable min-h-12 rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-70", on ? "border-accent bg-soft" : "border-line bg-surface hover:border-accent/50")}>
              <span className={cx("block text-[0.9rem] font-bold", on && "text-accent-strong")}>{on && <Check size={14} className="mr-1 inline" strokeWidth={3} />}{s.label}</span>
              <span className="mt-0.5 block text-[0.72rem] leading-snug text-ink-3">{s.hint}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[0.75rem] text-ink-3">고른 상태는 <b>고객 입력</b>으로 기록됩니다{run.statusAt ? ` · 마지막 변경 ${fmtDateTime(run.statusAt)}` : ""}.</p>
    </div>
  );
}

/** 체크리스트 — 누르면 바로 저장. 기록이 없으면(시작 전) 비활성 */
export function CheckList({ run, items }: { run?: SelfRun; items: CheckItem[] }) {
  const toggle = useStore((s) => s.toggleSelfCheck);
  const can = useCanRecord();
  const done = run ? checkProgress(run).done : 0;
  return (
    <div>
      {run && <div className="mb-2 flex items-center gap-3"><Progress value={items.length ? (done / items.length) * 100 : 0} height={6} className="flex-1" /><span className="tnum text-[0.8rem] font-bold text-ink-2">{done}/{items.length}</span></div>}
      <ul className="divide-y divide-line rounded-xl border border-line" data-testid="self-checks">
        {items.map((it) => {
          const on = !!run?.checks[it.key];
          return (
            <li key={it.key}>
              <label className={cx("flex min-h-12 items-start gap-3 px-3.5 py-2.5", run && can ? "cursor-pointer" : "cursor-default")}>
                <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[var(--theme-accent)]" checked={on} disabled={!run || !can}
                  onChange={(e) => run && toggle(run.id, it.key, e.target.checked)} data-check={it.key} aria-label={it.label} />
                <span className="min-w-0">
                  <span className={cx("block text-[0.9rem] font-semibold leading-snug", on && "text-ink-2 line-through decoration-ink-3/60")}>{it.label}</span>
                  {it.hint && <span className="mt-0.5 block text-[0.76rem] leading-snug text-ink-3">{it.hint}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const EV_LABELS: Record<SelfRunKind, string[]> = {
  program: ["접수번호", "접수확인서", "선정통보서", "기타 근거"],
  growth: ["신고 · 접수번호", "인정서 · 확인서", "기타 근거"],
  learn: [],
};

/** 근거 — 접수번호(글) 또는 확인서 파일. 담당자가 확인하기 전까지는 "고객 첨부 · 확인 전" */
export function EvidenceBox({ run }: { run: SelfRun }) {
  const add = useStore((s) => s.addSelfEvidence);
  const remove = useStore((s) => s.removeSelfEvidence);
  const serverMode = useStore((s) => s.serverMode);
  const users = useStore((s) => s.users);
  const toast = useStore((s) => s.toast);
  const can = useCanRecord();
  const labels = EV_LABELS[run.kind];
  const [label, setLabel] = useState(labels[0] ?? "근거");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const basis = resultBasis(run);
  const saveNumber = () => {
    if (!value.trim()) return;
    if (add(run.id, { kind: "number", label, value })) { setValue(""); toast("근거를 남겼습니다. 담당자가 확인하면 '담당자 확인'으로 바뀝니다."); }
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const fileId = uid("ef");
      let storagePath: string | undefined;
      if (serverMode) {
        const r = await uploadSelfEvidence(run.companyId, run.id, fileId, f);
        if (!r.ok) { toast(r.reason ?? "파일을 올리지 못했습니다.", "error"); return; }
        storagePath = r.path;
      }
      if (add(run.id, { kind: "file", label, fileName: f.name, size: f.size, storagePath })) toast(serverMode ? "확인서를 올렸습니다." : "확인서를 기록했습니다(데모: 파일 내용은 이 브라우저에 저장하지 않습니다).");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  return (
    <div data-testid="self-evidence">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[0.85rem] font-bold">근거 자료</span>
        <Badge tone={basis.key === "confirmed" ? "success" : basis.key === "attached" ? "info" : "neutral"}>{basis.label}</Badge>
        <span className="text-[0.75rem] text-ink-3">선택 사항 · 접수번호나 확인서를 남겨 두면 나중에 찾기 쉽습니다</span>
      </div>
      {run.evidence.length > 0 && (
        <ul className="mb-2 divide-y divide-line rounded-xl border border-line">
          {run.evidence.map((e) => (
            <li key={e.id} className="flex items-center gap-2.5 px-3.5 py-2.5 text-[0.86rem]" data-evidence={e.id}>
              {e.kind === "number" ? <Hash size={15} className="shrink-0 text-ink-3" /> : <FileUp size={15} className="shrink-0 text-ink-3" />}
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{e.label}</span> <span className="break-all text-ink-2">{e.value ?? e.fileName}{e.size ? ` · ${fmtSize(e.size)}` : ""}</span>
                <span className="block text-[0.72rem] text-ink-3">{fmtDate(e.at)} 고객 첨부{e.confirmedAt ? ` · ${fmtDate(e.confirmedAt)} ${users.find((u) => u.id === e.confirmedBy)?.name ?? "담당자"} 확인` : " · 확인 전"}</span>
              </span>
              {e.confirmedAt
                ? <ShieldCheck size={17} className="shrink-0 text-success" aria-label="담당자 확인" />
                : can && <button type="button" onClick={() => remove(run.id, e.id)} className="pressable tap rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-error" aria-label={`${e.label} 지우기`}><Trash2 size={15} /></button>}
            </li>
          ))}
        </ul>
      )}
      {can && labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={label} onChange={(e) => setLabel(e.target.value)} className="h-11 w-auto min-w-[8.5rem]" aria-label="근거 종류">
            {labels.map((l) => <option key={l}>{l}</option>)}
          </Select>
          <Input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveNumber(); } }} placeholder="번호 입력 (예: 2026-000123)" className="h-11 min-w-0 flex-1 basis-40" aria-label="접수번호" maxLength={120} />
          <Button variant="outline" onClick={saveNumber} disabled={!value.trim()}>번호 저장</Button>
          <Button variant="outline" icon={<FileUp size={15} />} onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "올리는 중…" : "파일 올리기"}</Button>
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.heic,.hwp,.hwpx,.doc,.docx" onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
      )}
    </div>
  );
}

/** 진행 기록 — 이 실행 기록에 남은 활동(시작 · 상태 · 근거 · 확인 · 도움 요청) */
export function RunHistory({ run }: { run: SelfRun }) {
  const acts = useStore((s) => s.activities);
  const list = acts.filter((a) => a.meta?.runId === run.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  if (!list.length) return null;
  return (
    <details className="group mt-3" data-testid="self-history">
      <summary className="pressable flex min-h-10 cursor-pointer list-none items-center gap-1.5 text-[0.85rem] font-semibold text-ink-2">진행 기록 {list.length}건 <span className="text-ink-3 transition-transform group-open:rotate-90">›</span></summary>
      <ol className="mt-1 space-y-1.5 border-l border-line pl-4">
        {list.map((a) => (
          <li key={a.id} className="text-[0.82rem]">
            <span className="text-ink">{a.text}</span>
            <span className="block text-[0.72rem] text-ink-3">{fmtDateTime(a.at)}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

/**
 * 전문가 도움 — 선택 경로. 직접 하기와 따로 돌아간다(이것 없이도 직접 하기는 끝까지 간다).
 * 직접 하던 기록이 있으면 그 상태 · 체크 진행을 담아 보내고, 없으면 기존 상담 요청 · 공고 문의 그대로.
 */
export function ExpertHelp({ run, what, onAsk, asked }: { run?: SelfRun; what: string; onAsk: (note: string) => boolean; asked?: string }) {
  const help = useStore((s) => s.requestSelfHelp);
  const toast = useStore((s) => s.toast);
  const { isClient, onBehalf } = useOnBehalf();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const send = () => {
    const okSent = run && isClient ? help(run.id, note) : onAsk(note);
    if (okSent) { toast("담당 컨설턴트에게 전달했습니다. 직접 하시던 기록은 그대로 남아 있습니다."); setOpen(false); setNote(""); }
    else toast(isClient || onBehalf ? "전달하지 못했습니다. 잠시 후 다시 시도해 주세요." : "고객 계정에서만 요청할 수 있습니다.", "error");
  };
  return (
    <div className="rounded-2xl border border-dashed border-line-2 px-4 py-3.5" data-testid="expert-help">
      <div className="flex flex-wrap items-center gap-2"><PathTag kind="expert" /><span className="font-bold">직접 하다가 막히면</span></div>
      <p className="mt-1.5 text-[0.84rem] leading-relaxed text-ink-2">
        복잡한 재무 · 세무 판단, 자금 조달 전략, 특수한 인증처럼 전문가 검토가 필요할 때만 선택하세요. 요청은 무료이고 비용이 생기지 않습니다.
        실제 컨설팅은 견적을 먼저 보내 드리고, 진행 여부는 대표님이 정합니다(유료).
      </p>
      {asked ? (
        <p className="mt-2 rounded-xl bg-success-bg px-3.5 py-2 text-[0.84rem] text-success" data-testid="expert-asked">{asked}</p>
      ) : (
        <Button variant="outline" className="mt-2.5" icon={<MessageSquarePlus size={15} />} onClick={() => setOpen(true)}>담당 컨설턴트에게 물어보기</Button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} size="sm" title={`${what} — 전문가에게 묻기`}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>취소</Button><Button variant="accent" onClick={send}>보내기</Button></>}>
        {run && <div className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[0.84rem]">지금 상태 <b>{statusLabel(run.kind, run.status)}</b>{checkProgress(run).total ? ` · 준비 ${checkProgress(run).done}/${checkProgress(run).total}` : ""}를 함께 보냅니다.</div>}
        <label className="mt-3 block text-[0.85rem] font-semibold text-ink-2">어디서 막히셨나요? (선택)
          <Textarea rows={3} className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 공고문의 제외 요건이 우리 회사에 해당하는지 모르겠습니다." />
        </label>
      </Modal>
    </div>
  );
}

/* ------------------------------ 학습 자료 ------------------------------ */

/** 학습 자료 한 장 — 목록용. 영상이 있으면 '영상' 표시(실제 YouTube 주소가 있을 때만) */
export function LearnCard({ c, href, done }: { c: LearnContent; href: string; done?: boolean }) {
  const hasVideo = !!youtubeId(c.videoUrl);
  return (
    <Link href={href} className="pressable card card-hover flex flex-col gap-1.5 p-4" data-learn={c.id}>
      <div className="flex flex-wrap items-center gap-1.5 text-[0.72rem] font-semibold text-ink-3">
        <span className="truncate">{c.category}</span>
        {c.minutes ? <span>· {c.minutes}분</span> : null}
        {hasVideo ? <span className="inline-flex items-center gap-0.5 text-accent-strong">· <PlayCircle size={12} /> 영상</span> : <span className="inline-flex items-center gap-0.5">· <BookOpen size={12} /> 글</span>}
        {done && <span className="ml-auto inline-flex items-center gap-0.5 font-bold text-success"><CheckCircle2 size={13} /> 학습 완료</span>}
      </div>
      <div className="font-bold leading-snug">{c.title}</div>
      <p className="line-clamp-2 text-[0.82rem] leading-relaxed text-ink-2">{c.summary}</p>
    </Link>
  );
}

/**
 * 학습 자료 본문 — 영상(있을 때만) · 핵심 설명 · 본문 · 학습 후 준비 · 공식 사이트.
 * publicMode: 로그인 없는 /learn — 준비 항목을 이 화면에서만 체크해 볼 수 있다(어디에도 저장하지 않는다).
 */
export function LearnBody({ c, publicMode }: { c: LearnContent; publicMode?: boolean }) {
  const vid = youtubeId(c.videoUrl);
  const links = c.links.filter((l) => safeHttpsUrl(l.url));
  const [ticked, setTicked] = useState<string[]>([]);
  return (
    <div className="space-y-4" data-testid="learn-body">
      {vid ? (
        <div>
          <div className="overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "16 / 9" }}>
            <iframe className="h-full w-full" src={youtubeEmbed(vid)} title={c.title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />
          </div>
          <p className="mt-1.5 text-[0.72rem] text-ink-3">{publicMode ? "YouTube 영상입니다. 이 화면은 시청 기록을 남기지 않습니다." : <>YouTube 영상입니다. 시청 여부는 이 화면이 알 수 없어, 다 보셨으면 아래 &lsquo;학습 완료&rsquo;를 직접 눌러 주세요.</>}</p>
        </div>
      ) : (
        <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[0.8rem] text-ink-2">글로 보는 안내 자료입니다{c.minutes ? ` · 약 ${c.minutes}분` : ""}.</p>
      )}
      <p className="text-[0.95rem] font-semibold leading-relaxed">{c.summary}</p>
      {c.body.length > 0 && (
        <ul className="space-y-2">
          {c.body.map((b, i) => <li key={i} className="flex gap-2 text-[0.9rem] leading-relaxed text-ink-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{b}</li>)}
        </ul>
      )}
      {c.prepItems.length > 0 && (
        <div className="rounded-2xl bg-soft/50 px-4 py-3">
          <div className="mb-1.5 text-[0.85rem] font-bold">학습 후 준비할 것</div>
          {publicMode ? (
            <>
              <ul className="space-y-0.5" data-testid="learn-public-checks">{c.prepItems.map((p) => (
                <li key={p}><label className="flex min-h-10 cursor-pointer items-start gap-2.5 py-1 text-[0.86rem]"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--theme-accent)]" checked={ticked.includes(p)} onChange={() => setTicked((xs) => (xs.includes(p) ? xs.filter((x) => x !== p) : [...xs, p]))} /><span className={cx(ticked.includes(p) && "text-ink-3 line-through")}>{p}</span></label></li>
              ))}</ul>
              <p className="mt-1 text-[0.72rem] text-ink-3">체크는 이 화면에서만 보이고 저장되지 않습니다.</p>
            </>
          ) : <ul className="space-y-1">{c.prepItems.map((p) => <li key={p} className="flex gap-2 text-[0.86rem]"><Check size={15} className="mt-0.5 shrink-0 text-success" />{p}</li>)}</ul>}
        </div>
      )}
      {links.length > 0 && (
        <div>
          <div className="mb-1.5 text-[0.85rem] font-bold">공식 사이트</div>
          <div className="flex flex-wrap gap-2">
            {links.map((l) => (
              <a key={l.url} href={safeHttpsUrl(l.url)} target="_blank" rel="noopener noreferrer" className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-[0.85rem] font-semibold hover:border-accent hover:text-accent">
                {l.label} <ExternalLink size={13} />
              </a>
            ))}
          </div>
        </div>
      )}
      {c.audience && <p className="text-[0.78rem] text-ink-3">추천 대상: {c.audience}</p>}
      <p className="text-[0.72rem] text-ink-3">수정일 {fmtDate(c.updatedAt)} · 일반 안내입니다. 대상 · 서류 · 요건은 해당 공고문과 기관 안내가 기준입니다.</p>
    </div>
  );
}

/** 학습 완료 — 고객이 직접 누른다(자동 판정 없음). 한 번만 기록 */
export function LearnDone({ c, companyId }: { c: LearnContent; companyId?: string }) {
  const runs = useStore((s) => s.selfRuns);
  const start = useStore((s) => s.startSelfRun);
  const toast = useStore((s) => s.toast);
  const user = useCurrentUser();
  const can = useCanRecord();
  const done = companyId ? runs.find((r) => r.companyId === companyId && r.kind === "learn" && r.targetKey === c.id) : undefined;
  if (!companyId) return null;
  if (done) return <p className="flex items-center gap-1.5 rounded-xl bg-success-bg px-3.5 py-2.5 text-[0.86rem] font-semibold text-success" data-testid="learn-done"><CheckCircle2 size={16} /> {fmtDate(done.startedAt)} 학습 완료로 기록했습니다(직접 표시)</p>;
  if (!can || !user) return <ReadOnlyNote />;
  return (
    <Button variant="accent" full icon={<CheckCircle2 size={16} />} data-testid="learn-done-btn"
      onClick={() => { if (start({ companyId, kind: "learn", targetKey: c.id, targetTitle: c.title })) toast("학습 완료로 기록했습니다. 우리 회사 성장 이력에 남습니다."); }}>
      다 읽었어요 — 학습 완료로 기록
    </Button>
  );
}
