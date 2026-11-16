import { useMemo, useState } from "react";
import type { Line, Link } from "../../../engine/types";
import type { AnalysisView, LinkOrigin } from "../../../app/model";
import { candidates, linkOrigin, unlinked } from "../../../app/analysis";
import { subjectOf } from "../../../app/judgments";
import { detailItems } from "../../../engine/analyze";
import pack from "../../../packs/construction-interior/index";
import { useApp, num, won, errMsg } from "../state";
import type { SiteCtx } from "./Site";
import { Badge, Bar, Button, Card, Empty, Note } from "./kit";

type Filter = "review" | "unlinked" | "auto" | "person" | "rule" | "rejected";
export const ORIGIN: Record<LinkOrigin, { label: string; tone: "warning" | "neutral" | "person" | "rule" | "error" | "info" }> = {
  auto: { label: "자동 연결", tone: "neutral" }, review: { label: "확인 필요", tone: "warning" }, person: { label: "사람이 확인", tone: "person" },
  rule: { label: "회사 규칙", tone: "rule" }, "person-rejected": { label: "사람이 다르다고 판단", tone: "error" }, "rule-rejected": { label: "회사 규칙(다름)", tone: "error" },
};
const PART: Record<string, string> = { name: "이름", spec: "규격", unit: "단위", price: "단가", section: "구간", align: "순서" };
const KIND: Record<string, string> = { change: "변경 내역서", settlement: "정산서", other: "기타 문서" };

export function Links({ ctx, view }: { ctx: SiteCtx; view: AnalysisView }) {
  const { data } = ctx;
  const others = view.result.docs.filter((d) => d.kind !== "contract" && detailItems(d).length);
  const [docId, setDocId] = useState(others[0]?.docId ?? "");
  const [filter, setFilter] = useState<Filter>("review");
  const contract = view.result.docs.find((d) => d.kind === "contract");
  const lineOf = useMemo(() => {
    const m = new Map<string, Line>();
    for (const d of view.result.docs) for (const s of d.sheets) for (const l of s.lines) m.set(`${d.docId}|${s.sheet}|${l.row}`, l);
    return (docId: string, sheet: string, row: number) => m.get(`${docId}|${sheet}|${row}`);
  }, [view]);
  if (!contract) return <Note tone="warning">계약 내역서가 없어 항목 연결을 하지 않았습니다.</Note>;
  if (!others.length) return <Note tone="info">비교할 문서(변경 내역서 · 정산서)가 없습니다.</Note>;
  const links = view.result.links.filter((l) => l.b.docId === docId);
  const un = unlinked(view.result).find((u) => u.docId === docId) ?? { base: [], other: [] };
  const rejected = data.judgments.filter((j) => j.status === "active" && j.scope === "site" && j.siteId === data.site.id && j.payload.type === "link" && !j.payload.same && j.payload.b.fileId === docId);
  const count = (o: LinkOrigin) => links.filter((l) => linkOrigin(view, l) === o).length;
  const fileName = (id: string) => data.files.find((f) => f.id === id)?.fileName ?? id;
  const chips: [Filter, string, number][] = [["review", "확인 필요", count("review")], ["unlinked", "연결 안 됨", un.other.length], ["auto", "자동 연결", count("auto")], ["person", "사람이 확인", count("person")], ["rule", "회사 규칙", count("rule")], ["rejected", "다르다고 판단", rejected.length]];
  const shown = filter === "unlinked" || filter === "rejected" ? [] : links.filter((l) => linkOrigin(view, l) === filter);
  return (
    <div className="stack">
      <Card title="계약 내역서의 항목이 다른 문서의 어느 줄과 같은지" right={
        <select value={docId} onChange={(e) => setDocId(e.target.value)} aria-label="비교 문서" data-testid="links-doc">{others.map((d) => <option key={d.docId} value={d.docId}>{KIND[d.kind] ?? d.kind}{d.round ? ` ${d.round}차` : ""} — {fileName(d.docId)}</option>)}</select>
      }>
        <p className="small muted">공통 번호가 없어서 프로그램이 이름 · 규격 · 단위 · 단가 · 구간으로 짝을 찾습니다. 확실하면 <b>자동 연결</b>, 애매하면 <b>확인 필요</b>로 남깁니다. 사람이 정한 연결은 자동 판단과 따로 표시되고, 누가 언제 정했는지 기록에 남습니다.</p>
        <div className="chips" role="tablist">
          {chips.map(([k, label, n]) => <button key={k} className={`chip${filter === k ? " on" : ""}`} onClick={() => setFilter(k)} data-testid={`chip-${k}`}>{label} <b>{n}</b></button>)}
        </div>
      </Card>
      {filter === "unlinked" ? <Unlinked ctx={ctx} docId={docId} other={un.other} base={un.base} contractItems={detailItems(contract)} contractId={contract.docId} />
        : filter === "rejected" ? (
          <Card title="사람이 '다른 항목'이라고 판단한 짝">
            {!rejected.length ? <Empty title="없습니다" /> : rejected.map((j) => j.payload.type === "link" && (
              <div className="pair" key={j.id}><LineBox title="계약" l={j.payload.a} /><LineBox title="비교" l={j.payload.b} /><div className="pair-side"><Badge tone="error">다르다고 판단</Badge><div className="small muted">{j.by} · {j.at.slice(0, 16).replace("T", " ")}</div></div></div>
            ))}
          </Card>
        ) : !shown.length ? <Card><Empty title="해당하는 연결이 없습니다" /></Card> : (
          <div className="stack" data-testid="pair-list">
            {shown.slice(0, 200).map((l) => <PairRow key={`${l.a.fp}|${l.b.fp}`} ctx={ctx} view={view} link={l} a={lineOf(l.a.docId, l.a.sheet, l.a.row)} b={lineOf(l.b.docId, l.b.sheet, l.b.row)} />)}
            {shown.length > 200 && <p className="muted small">처음 200개만 보입니다.</p>}
          </div>
        )}
    </div>
  );
}

function LineBox({ title, l, sub }: { title: string; l?: { name: string; spec: string; unit: string; qty?: number; unitPrice?: number; amount?: number; sheet: string; row: number }; sub?: string }) {
  if (!l) return <div className="linebox muted">줄을 찾지 못함</div>;
  return (
    <div className="linebox">
      <div className="linebox-title">{title} <span className="muted small">{l.sheet} {l.row + 1}행{sub ? ` · ${sub}` : ""}</span></div>
      <div className="linebox-name">{l.name} <span className="muted">{l.spec}</span></div>
      <div className="small">{l.unit ? `${l.unit} · ` : ""}수량 {num(l.qty) || "-"} · 단가 {won(l.unitPrice)} · 금액 {won(l.amount)}</div>
    </div>
  );
}

function PairRow({ ctx, view, link, a, b }: { ctx: SiteCtx; view: AnalysisView; link: Link; a?: Line; b?: Line }) {
  const { svc, user, toast } = useApp();
  const { data } = ctx;
  const [company, setCompany] = useState(false);
  const origin = linkOrigin(view, link);
  const subject = subjectOf({ type: "link", same: true, a: { fileId: "", sheet: "", row: 0, fp: link.a.fp, name: "", spec: "", unit: "" }, b: { fileId: "", sheet: "", row: 0, fp: link.b.fp, name: "", spec: "", unit: "" } });
  const decided = data.judgments.find((j) => j.subject === subject && j.status === "active" && j.siteId === data.site.id && j.scope === "site");
  const judge = async (same: boolean) => {
    if (!a || !b) return;
    if (!user.trim()) { toast("확인자 이름을 적어 주세요", "error"); return; }
    try {
      await svc.judgeLink(data, { fileId: link.a.docId, line: a }, { fileId: link.b.docId, line: b }, same, user, company);
      toast(`${same ? "같은 항목" : "다른 항목"}으로 저장했습니다${company ? " · 회사 규칙으로도 남겼습니다" : ""} — 다시 분석하면 반영됩니다`, "success");
      await ctx.reload();
    } catch (e) { toast(errMsg(e), "error"); }
  };
  const diff = a && b && ((a.qty !== undefined && b.qty !== undefined && a.qty !== b.qty) || (a.unitPrice !== undefined && b.unitPrice !== undefined && a.unitPrice !== b.unitPrice));
  return (
    <div className={`pair pair-${origin}`} data-testid={`pair-${origin}`}>
      <LineBox title="계약" l={a} />
      <LineBox title="비교" l={b} sub={diff ? "수량 · 단가 다름" : undefined} />
      <div className="pair-side">
        <div className="row gap"><Badge tone={ORIGIN[origin].tone}>{ORIGIN[origin].label}</Badge><span className="small">점수 {link.score}</span></div>
        {link.via !== "decision" && <div className="parts">{Object.entries(link.parts).map(([k, v]) => <div key={k} className="part"><span>{PART[k] ?? k}</span><Bar value={v} tone={v >= 0.8 ? "success" : v >= 0.5 ? "warning" : "error"} /></div>)}</div>}
        {decided ? <Note tone="info">{decided.payload.type === "link" && decided.payload.same ? "같은 항목" : "다른 항목"}으로 판단함 · {decided.by}{ctx.pending.any ? " (다시 분석하면 반영)" : ""}</Note> : (
          <>
            <div className="row gap">
              <Button small kind="primary" onClick={() => judge(true)} testId="judge-same">같은 항목</Button>
              <Button small onClick={() => judge(false)} testId="judge-diff">다른 항목</Button>
            </div>
            <label className="check small"><input type="checkbox" checked={company} onChange={(e) => setCompany(e.target.checked)} data-testid="judge-company" /> 우리 회사 다른 현장에도 적용</label>
          </>
        )}
      </div>
    </div>
  );
}

function Unlinked({ ctx, docId, other, base, contractItems, contractId }: { ctx: SiteCtx; docId: string; other: Line[]; base: Line[]; contractItems: Line[]; contractId: string }) {
  const { svc, user, toast } = useApp();
  const link = async (a: Line, b: Line) => {
    if (!user.trim()) { toast("확인자 이름을 적어 주세요", "error"); return; }
    try { await svc.judgeLink(ctx.data, { fileId: contractId, line: a }, { fileId: docId, line: b }, true, user, false); toast("같은 항목으로 연결했습니다 — 다시 분석하면 반영됩니다", "success"); await ctx.reload(); } catch (e) { toast(errMsg(e), "error"); }
  };
  return (
    <div className="stack">
      <Card title={`비교 문서에만 있는 항목 ${other.length}줄`}>
        <p className="small muted">새로 생긴 항목이거나, 이름이 많이 달라 짝을 못 찾은 항목입니다. 후보 중에 같은 것이 있으면 골라 주세요(점수는 참고용).</p>
        {!other.length ? <Empty title="없습니다" /> : other.map((l) => (
          <div className="pair" key={`${l.sheet}|${l.row}`} data-testid="unlinked-row">
            <LineBox title="비교 문서" l={l} />
            <div className="cands">
              {candidates(l, base.length ? base : contractItems, pack, 3).map((c) => (
                <div className="cand" key={`${c.line.sheet}|${c.line.row}`}>
                  <div><b>{c.line.name}</b> <span className="muted">{c.line.spec}</span> <span className="small muted">({c.line.sheet} {c.line.row + 1}행 · 점수 {c.score})</span></div>
                  <Button small onClick={() => link(c.line, l)} testId="cand-link">이것과 같은 항목</Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>
      <Card title={`계약에만 있는 항목 ${base.length}줄`}>
        <p className="small muted">비교 문서에서 빠졌거나(삭제 · 미시공), 이름이 달라 짝을 못 찾은 항목입니다.</p>
        {!base.length ? <Empty title="없습니다" /> : <ul className="list">{base.map((l) => <li key={`${l.sheet}|${l.row}`}>{l.name} <span className="muted">{l.spec}</span> <span className="small muted">({l.sheet} {l.row + 1}행 · 금액 {won(l.amount)})</span></li>)}</ul>}
      </Card>
    </div>
  );
}
