import { useMemo, useState } from "react";
import type { EvidenceRef, Finding } from "../../../engine/types";
import type { AnalysisView, CaseStatus, FindingCase } from "../../../app/model";
import { categoryOf, unlinked } from "../../../app/analysis";
import { CATEGORY, DETECTOR, NOT_LOSS, STATUS, amountLabel, calcSteps, keyLabel, plainWhy } from "../../../app/explain";
import { NEXT } from "../../../app/workflow";
import { useApp, won, when, errMsg } from "../state";
import type { SiteCtx } from "./Site";
import { Badge, Button, Card, Empty, Field, Note } from "./kit";
import { Grid, cellAddr } from "./Grid";


export function Findings({ ctx, view }: { ctx: SiteCtx; view: AnalysisView }) {
  const { data } = ctx;
  const findings = view.result.findings;
  const caseOf = useMemo(() => new Map(data.cases.map((c) => [c.key, c])), [data.cases]);
  const [sel, setSel] = useState<string>(findings[0]?.key ?? "");
  const [cat, setCat] = useState<"all" | "calc" | "unconfirmed" | "gaps">("all");
  const gone = data.cases.filter((c) => !c.present);
  const gaps = gapList(ctx, view);
  const shown = cat === "gaps" ? [] : findings.filter((f) => cat === "all" || categoryOf(f) === cat);
  const cur = findings.find((f) => f.key === sel);
  return (
    <div className="stack">
      <div className="summary-cards">
        {(["calc", "unconfirmed"] as const).map((k) => (
          <button key={k} className={`sum-card${cat === k ? " on" : ""}`} onClick={() => setCat(cat === k ? "all" : k)} data-testid={`cat-${k}`}>
            <span className="sum-n">{findings.filter((f) => categoryOf(f) === k).length}</span>
            <span className="sum-label">{CATEGORY[k].label}</span>
            <span className="sum-plain">{CATEGORY[k].plain}</span>
          </button>
        ))}
        <button className={`sum-card${cat === "gaps" ? " on" : ""}`} onClick={() => setCat(cat === "gaps" ? "all" : "gaps")} data-testid="cat-gaps">
          <span className="sum-n">{gaps.length}</span>
          <span className="sum-label">자료 부족 · 결과 보류</span>
          <span className="sum-plain">자료가 없거나 읽기가 불확실해서 점검하지 못했거나 결과를 내지 않은 곳입니다.</span>
        </button>
      </div>
      <Note tone="neutral">{NOT_LOSS} 실제로 받을 돈이나 손해인지는 아래 처리 단계에서 담당자가 확인해 기록합니다.</Note>
      {cat === "gaps" ? (
        <Card title="자료 부족 · 결과 보류">{gaps.length ? <ul className="list">{gaps.map((g) => <li key={g}>{g}</li>)}</ul> : <Empty title="없습니다" />}</Card>
      ) : !findings.length ? (
        <Card><Empty title="확인할 결과가 없습니다">이번 자료에서는 계산이 맞지 않거나 서로 다른 곳을 찾지 못했습니다. 자료 부족 · 결과 보류 목록도 함께 확인하세요.</Empty></Card>
      ) : (
        <div className="split split-wide">
          <aside className="side-list" data-testid="finding-list">
            {shown.map((f) => {
              const c = caseOf.get(f.key);
              return (
                <button key={f.key} className={`side-item finding-item${sel === f.key ? " on" : ""}`} onClick={() => setSel(f.key)} data-testid="finding-item">
                  <span className="row between"><Badge tone={categoryOf(f) === "calc" ? "accent" : "info"}>{f.detector === "D10" ? "중복 가능성" : CATEGORY[categoryOf(f)].label}</Badge><Badge tone={STATUS[c?.status ?? "open"].tone}>{STATUS[c?.status ?? "open"].label}</Badge></span>
                  <span className="finding-title">{f.title}</span>
                  <span className="small muted">{amountLabel(f)} · {f.evidence[0]?.sheet} {f.evidence[0] ? f.evidence[0].row + 1 + "행" : ""}</span>
                </button>
              );
            })}
            {gone.length > 0 && <div className="side-title">이번 분석에 없는 결과 {gone.length}건(기록 보존)</div>}
            {gone.map((c) => <div key={c.key} className="side-item gone"><span className="small">{c.snapshot.title}</span><Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge></div>)}
          </aside>
          {cur ? <Detail key={cur.key} ctx={ctx} f={cur} c={caseOf.get(cur.key)} /> : <Empty title="왼쪽에서 결과를 고르세요" />}
        </div>
      )}
    </div>
  );
}

function gapList(ctx: SiteCtx, view: AnalysisView): string[] {
  const name = (id: string) => ctx.data.files.find((f) => f.id === id)?.fileName ?? id;
  return [
    ...view.result.skipped.map((s) => s.reason.replace(/^([0-9a-f-]{8,})(?= \/)/, (m) => name(m))),
    ...unlinked(view.result).filter((u) => u.other.length).map((u) => `${name(u.docId)}: 계약 내역서와 연결되지 않은 항목 ${u.other.length}줄 — '항목 연결 › 연결 안 됨'에서 확인`),
    ...(ctx.data.files.some((f) => f.active && f.kind === "change") ? [] : ["변경 내역서가 없어 변경 대조(D03)를 하지 않았습니다"]),
    ...(ctx.data.files.some((f) => f.active && f.kind === "cost") ? [] : ["매입 · 지급 장부가 없어 중복 가능성 점검(D10)을 하지 않았습니다"]),
    "기성 청구 · 원가 대조(D04 · D05)는 실제 자료로 검증하기 전이라 이 시연판에 없습니다",
  ];
}

function Evidence({ ctx, e, f }: { ctx: SiteCtx; e: EvidenceRef; f: Finding }) {
  const wb = ctx.data.books.get(e.docId);
  const sheet = wb?.sheets.find((s) => s.name === e.sheet);
  const cols = Object.values(e.cols);
  const addr = Object.entries(e.cols).map(([k, c]) => `${keyLabel(k)} ${cellAddr(e.sheet, e.row, c)} = ${e.values[k] || "(빈칸)"}`);
  return (
    <div className={`evidence ev-${e.role}`}>
      <div className="ev-head"><Badge tone={e.role === "base" ? "accent" : "info"}>{e.role === "base" ? "근거" : "비교 근거"}</Badge> <b>{e.fileName}</b> › {e.sheet} › {e.row + 1}행</div>
      <ul className="ev-cells small">{addr.map((a) => <li key={a}>{a}</li>)}</ul>
      {sheet ? <Grid sheet={sheet} from={e.row - 3} to={e.row + 3} marks={[{ row: e.row, cols, tone: e.role }]} testId="evidence-grid" /> : <Note tone="warning">원본 표를 찾지 못했습니다{f.detector === "D02" ? "(합계 근거는 위 칸 주소를 보세요)" : ""}.</Note>}
    </div>
  );
}

function Detail({ ctx, f, c }: { ctx: SiteCtx; f: Finding; c?: FindingCase }) {
  const steps = calcSteps(f);
  const side = f.evidence.length >= 2 && new Set(f.evidence.map((e) => e.docId + e.sheet)).size >= 2;
  return (
    <div className="stack" data-testid="finding-detail">
      <Card title={f.title} right={<Badge tone={categoryOf(f) === "calc" ? "accent" : "info"}>{f.detector} {DETECTOR[f.detector]} · {CATEGORY[categoryOf(f)].label}</Badge>}>
        <p>{plainWhy(f)}</p>
        <p className="small muted">{f.message}</p>
        <div className="amount-line"><b>{amountLabel(f)}</b><span className="muted small"> — 손실로 확정된 금액이 아닙니다</span></div>
        <div className="calc" data-testid="calc-steps">
          <div className="calc-title">계산 과정</div>
          <ol>{steps.map((s) => <li key={s}>{s}</li>)}</ol>
          <div className="small muted">식: {f.calc.expr}</div>
        </div>
        {f.caveat && <Note tone="warning"><b>문제가 아닐 수 있는 경우</b> — {f.caveat}</Note>}
        {categoryOf(f) === "unconfirmed" && <Note tone="info">이 결과는 자동 연결이나 추정에 기댑니다. 사람이 확인하기 전에는 불일치로 단정하지 않습니다.</Note>}
      </Card>
      <Card title="원본 근거">
        <div className={side ? "side-by-side" : "stack"}>{f.evidence.map((e, i) => <Evidence key={i} ctx={ctx} e={e} f={f} />)}</div>
      </Card>
      {c ? <CasePanel ctx={ctx} c={c} /> : <Note tone="warning">이 결과의 처리 기록이 아직 없습니다 — 다시 분석해 주세요.</Note>}
    </div>
  );
}

const ACTION_LABEL: Partial<Record<CaseStatus, string>> = { checking: "확인 시작", confirmed: "실제 문제로 확인", not_issue: "문제 아님", on_hold: "판단 보류", action: "조치 기록", done: "완료" };

function CasePanel({ ctx, c }: { ctx: SiteCtx; c: FindingCase }) {
  const { svc, user, toast } = useApp();
  const [to, setTo] = useState<CaseStatus | "">("");
  const [note, setNote] = useState("");
  const [action, setAction] = useState(c.action ?? "");
  const [amount, setAmount] = useState("");
  const [none, setNone] = useState(false);
  const [memo, setMemo] = useState("");
  const submit = async () => {
    if (!to) return;
    try {
      const reflected = to === "done" && c.status === "action" ? { amount: none ? null : Number(amount.replace(/[^\d]/g, "")), note } : undefined;
      if (reflected && !none && !amount.replace(/[^\d]/g, "")) { toast("실제 반영 금액을 적거나 '반영 금액 없음'을 골라 주세요", "error"); return; }
      await svc.step(c.siteId, c.key, to, { by: user, note: note || undefined, action: to === "action" ? action : undefined, reflected });
      toast(`'${STATUS[to].label}'(으)로 바꿨습니다`, "success");
      setTo(""); setNote(""); setAmount(""); setNone(false);
      await ctx.reload();
    } catch (e) { toast(errMsg(e), "error"); }
  };
  const addMemo = async () => { try { await svc.note(c.siteId, c.key, user, memo); setMemo(""); await ctx.reload(); } catch (e) { toast(errMsg(e), "error"); } };
  return (
    <Card title="처리 기록" right={<Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>} testId="case-panel">
      <div className="flow small">{(["open", "checking", "confirmed", "action", "done"] as CaseStatus[]).map((s, i) => <span key={s} className={`flow-step${c.status === s ? " on" : ""}`}>{i ? "→ " : ""}{STATUS[s].label}</span>)}<span className="muted"> (또는 문제 아님 · 판단 보류)</span></div>
      {c.reflected && <Note tone="success">실제 반영 금액: <b>{c.reflected.amount === null ? "없음" : won(c.reflected.amount)}</b>{c.reflected.note ? ` — ${c.reflected.note}` : ""} ({c.reflected.by}, 사용자가 입력한 값)</Note>}
      {c.action && <p className="small">조치: {c.action}</p>}
      <div className="row gap wrap">
        {NEXT[c.status].map((s) => <Button key={s} small kind={to === s ? "primary" : "secondary"} onClick={() => setTo(s)} testId={`step-${s}`}>{c.status === "done" && s === "checking" ? "다시 열기" : ACTION_LABEL[s] ?? STATUS[s].label}</Button>)}
      </div>
      {to && (
        <div className="form step-form" data-testid="step-form">
          {to === "action" && <Field label="조치 내용" hint="예: 발주처에 정정 요청 · 협력업체에 환급 요청"><input value={action} onChange={(e) => setAction(e.target.value)} data-testid="step-action-text" /></Field>}
          {to === "done" && c.status === "action" && (
            <div className="row gap wrap">
              <Field label="실제 반영 금액(원)" hint="실제로 정정 · 청구 · 환급된 금액만 적습니다. 추정 금액은 적지 않습니다"><input value={amount} onChange={(e) => setAmount(e.target.value)} disabled={none} inputMode="numeric" data-testid="step-amount" /></Field>
              <label className="check"><input type="checkbox" checked={none} onChange={(e) => setNone(e.target.checked)} data-testid="step-none" /> 반영 금액 없음</label>
            </div>
          )}
          <Field label={to === "not_issue" ? "문제가 아닌 이유(필수)" : to === "on_hold" ? "보류 이유(필수)" : to === "done" && c.status === "action" ? "근거 메모(예: 정정 견적서 수령)" : "메모(선택)"}><input value={note} onChange={(e) => setNote(e.target.value)} data-testid="step-note" /></Field>
          <div className="row end gap"><span className="small muted">확인자: {user || "(이름 없음 — 오른쪽 위에 적어 주세요)"}</span><Button onClick={() => setTo("")}>취소</Button><Button kind="primary" onClick={submit} testId="step-submit">저장</Button></div>
        </div>
      )}
      <div className="history">
        <div className="calc-title">이력</div>
        <ol className="timeline">{[...c.history].reverse().map((h, i) => (
          <li key={i}><span className="muted small">{when(h.at)}</span> <b>{h.by}</b> — {h.type === "status" ? `${STATUS[h.from!].label} → ${STATUS[h.to!].label}` : h.type === "reflected" ? `실제 반영 금액 ${h.amount === null ? "없음" : won(h.amount ?? 0)}` : h.type === "action" ? "조치" : h.type === "note" ? "메모" : "자동 기록"}{h.text ? `: ${h.text}` : ""}</li>
        ))}</ol>
        <div className="row gap"><input className="grow" placeholder="메모 남기기" value={memo} onChange={(e) => setMemo(e.target.value)} /><Button small onClick={addMemo} disabled={!memo.trim()}>메모</Button></div>
      </div>
    </Card>
  );
}
