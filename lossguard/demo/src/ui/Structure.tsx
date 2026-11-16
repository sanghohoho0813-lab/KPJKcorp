import { useMemo, useState } from "react";
import type { GroupKey, LeafRole, ParsedSheet } from "../../../engine/types";
import type { AnalysisView } from "../../../app/model";
import { useApp, colLetter, errMsg } from "../state";
import type { SiteCtx } from "./Site";
import { Badge, Bar, Button, Card, Note } from "./kit";
import { Grid } from "./Grid";

export const ROLE: Record<LeafRole, string> = { no: "번호", name: "품명", spec: "규격", unit: "단위", qty: "수량", unitPrice: "단가", amount: "금액", note: "비고" };
export const GROUP: Record<GroupKey, string> = { mat: "재료비", lab: "노무비", exp: "경비", sum: "합계", before: "변경 전", after: "변경 후", delta: "증감" };
const KIND: Record<string, string> = { cover: "표지", summary: "요약(집계)", detail: "세부 내역", unitcost: "일위대가", other: "기타" };
const LINEK: Record<string, string> = { item: "항목", section: "구간 제목", subtotal: "소계", total: "합계", adjust: "조정", tax: "세금", note: "메모" };
const LEDGER: Record<string, string> = { date: "날짜", vendor: "거래처", vendorId: "사업자번호", item: "품목", spec: "규격", qty: "수량", unitPrice: "단가", supply: "공급가액", tax: "세액", total: "합계", docNo: "문서번호", site: "현장", note: "비고" };

export function Structure({ ctx, view }: { ctx: SiteCtx; view: AnalysisView }) {
  const { data } = ctx;
  const sheets = useMemo(() => view.result.docs.flatMap((d) => d.sheets.filter((s) => s.lines.length || s.columns.length).map((s) => ({ d, s }))), [view]);
  const ledgers = view.result.ledgers;
  const [sel, setSel] = useState(() => { const pick = sheets.find((x) => x.s.confidence < 0.7 && x.s.lines.length) ?? sheets.find((x) => x.s.kind === "detail") ?? sheets[0]; return pick ? `${pick.d.docId}|${pick.s.sheet}` : ""; });
  const fileName = (id: string) => data.files.find((f) => f.id === id)?.fileName ?? id;
  const cur = sheets.find((x) => `${x.d.docId}|${x.s.sheet}` === sel);
  return (
    <div className="split">
      <aside className="side-list">
        <div className="side-title">프로그램이 읽은 시트</div>
        {sheets.map(({ d, s }) => (
          <button key={`${d.docId}|${s.sheet}`} className={`side-item${sel === `${d.docId}|${s.sheet}` ? " on" : ""}`} onClick={() => setSel(`${d.docId}|${s.sheet}`)} data-testid="sheet-item">
            <span className="side-file">{fileName(d.docId)}</span>
            <span className="row between"><span>{s.sheet}</span><Badge tone={s.confidence < 0.7 ? "error" : s.kind === "detail" ? "info" : "neutral"}>{s.confidence < 0.7 ? "확인 필요" : KIND[s.kind]}</Badge></span>
          </button>
        ))}
        {ledgers.map((l) => (
          <button key={`${l.docId}|${l.sheet}`} className={`side-item${sel === `L|${l.docId}|${l.sheet}` ? " on" : ""}`} onClick={() => setSel(`L|${l.docId}|${l.sheet}`)}>
            <span className="side-file">{fileName(l.docId)}</span>
            <span className="row between"><span>{l.sheet}</span><Badge tone="neutral">매입 장부</Badge></span>
          </button>
        ))}
      </aside>
      <div className="stack">
        {cur && <SheetEditor key={sel} ctx={ctx} fileId={cur.d.docId} s={cur.s} />}
        {sel.startsWith("L|") && (() => {
          const l = ledgers.find((x) => `L|${x.docId}|${x.sheet}` === sel)!;
          const wb = data.books.get(l.docId)!;
          const sheet = wb.sheets[l.sheetIndex];
          return (
            <Card title={`${l.sheet} — 매입 · 지급 장부로 읽음`}>
              <p className="small">머리글 {l.headerRow + 1}행 · 거래 {l.records.length}줄 · 열: {l.columns.map((c) => `${colLetter(c.col)}=${LEDGER[c.role]}`).join(", ")}</p>
              {l.diagnostics.map((x) => <Note key={x} tone="neutral">{x}</Note>)}
              <Note tone="neutral">장부의 열 지정 고치기는 아직 없습니다(시연판 한계). 거래처 · 금액 열을 못 찾으면 중복 가능성 점검을 하지 않고 "자료 부족"으로 알립니다.</Note>
              <Grid sheet={sheet} from={Math.max(0, l.headerRow - 1)} to={l.headerRow + 25} roles={new Map(l.columns.map((c) => [c.col, LEDGER[c.role]]))} marks={[{ row: l.headerRow, cols: [], tone: "header" }]} />
            </Card>
          );
        })()}
      </div>
    </div>
  );
}

function SheetEditor({ ctx, fileId, s }: { ctx: SiteCtx; fileId: string; s: ParsedSheet }) {
  const { svc, user, toast } = useApp();
  const { data } = ctx;
  const wb = data.books.get(fileId);
  const sheet = wb?.sheets[s.sheetIndex];
  const width = Math.min(16, Math.max(0, ...(sheet?.rows.slice(0, 80).map((r) => r?.length ?? 0) ?? [0])));
  const init = () => Array.from({ length: width }, (_, c) => { const a = s.columns.find((x) => x.col === c); return { role: (a?.role ?? "") as LeafRole | "", group: (a?.group ?? "") as GroupKey | "" }; });
  const [cols, setCols] = useState(init);
  const [note, setNote] = useState("");
  const changed = cols.some((c, i) => { const a = s.columns.find((x) => x.col === i); return (a?.role ?? "") !== c.role || (a?.group ?? "") !== c.group; });
  const active = data.judgments.find((j) => j.status === "active" && j.scope === "site" && j.siteId === data.site.id && j.payload.type === "column" && j.payload.fileId === fileId && j.payload.sheet === s.sheet);
  const kinds = new Map<string, number>();
  for (const l of s.lines) kinds.set(l.kind, (kinds.get(l.kind) ?? 0) + 1);
  const headerText = (c: number) => s.columns.find((x) => x.col === c)?.label || s.headerRows.map((r) => sheet?.rows[r]?.[c]?.v ?? "").filter(Boolean).join(" > ");
  const save = async () => {
    if (!user.trim()) { toast("확인자 이름을 적어 주세요", "error"); return; }
    const columns = cols.map((c, col) => ({ col, role: c.role, group: c.group || undefined })).filter((c): c is { col: number; role: LeafRole; group: GroupKey | undefined } => !!c.role);
    if (!columns.some((c) => c.role === "name")) { toast("품명 열을 하나 정해 주세요", "error"); return; }
    try {
      await svc.judgeColumns(data, fileId, s.sheet, columns, s.columns.map((c) => ({ col: c.col, role: c.role, group: c.group })), user, note || undefined);
      toast("열 지정을 저장했습니다 — '다시 분석'을 누르면 결과에 반영됩니다", "success");
      await ctx.reload();
    } catch (e) { toast(errMsg(e), "error"); }
  };
  const withdraw = async () => {
    if (!active) return;
    try { await svc.withdraw(data, active, user); toast("열 지정 판단을 거뒀습니다 — 다시 분석하면 자동 판단으로 돌아갑니다"); await ctx.reload(); } catch (e) { toast(errMsg(e), "error"); }
  };
  const roleMap = new Map(s.columns.map((c) => [c.col, `${c.group ? GROUP[c.group] + " " : ""}${ROLE[c.role]}`]));
  const firstHeader = s.headerRows[0] ?? 0;
  return (
    <>
      <Card title={`${s.sheet} — ${KIND[s.kind]}`} right={<span className="row gap small">읽기 신뢰도 <Bar value={s.confidence} tone={s.confidence < 0.7 ? "error" : "success"} /> {s.confidence}</span>} testId="sheet-editor">
        {s.confidence < 0.7 && <Note tone="error">이 시트는 열을 확실히 읽지 못했습니다. 이 시트를 근거로 한 결과는 <b>보류</b>했습니다 — 아래에서 열을 지정한 뒤 다시 분석해 주세요.</Note>}
        <p className="small muted">머리글 {s.headerRows.map((r) => r + 1).join(", ") || "없음"}행 · 줄 {[...kinds.entries()].map(([k, n]) => `${LINEK[k] ?? k} ${n}`).join(" · ")} · 줄 계산이 맞는 항목 {s.checks.arithOk}/{s.checks.arithRows} · 합계 검산 {s.checks.totalOk}/{s.checks.totalRows}</p>
        {active && <Note tone="info" testId="column-judgment">사람이 지정한 열을 쓰고 있습니다 — {active.by} · {active.at.slice(0, 16).replace("T", " ")} · {active.version}판{active.note ? ` · "${active.note}"` : ""} <Button kind="ghost" small onClick={withdraw}>판단 거두기</Button></Note>}
        <div className="col-editor">
          <table className="plain">
            <thead><tr><th>열</th><th>머리글(원문)</th><th>프로그램이 정한 역할 · 근거</th><th>역할</th><th>묶음</th></tr></thead>
            <tbody>
              {cols.map((c, i) => {
                const a = s.columns.find((x) => x.col === i);
                return (
                  <tr key={i} className={a && (a.role !== c.role || (a.group ?? "") !== c.group) ? "row-changed" : !a && c.role ? "row-changed" : ""}>
                    <td><b>{colLetter(i)}</b></td>
                    <td>{headerText(i) || <span className="muted">(비어 있음)</span>}</td>
                    <td className="small">{a ? <>{a.group ? GROUP[a.group] + " " : ""}{ROLE[a.role]} <Badge tone={a.via === "decision" ? "person" : "neutral"}>{a.via === "name" ? "머리글" : a.via === "arith" ? "계산 관계" : a.via === "shape" ? "값 모양" : "사람 지정"}</Badge></> : <span className="muted">없음</span>}</td>
                    <td><select value={c.role} onChange={(e) => setCols(cols.map((x, j) => (j === i ? { ...x, role: e.target.value as LeafRole | "" } : x)))} data-testid={`col-role-${i}`} aria-label={`${colLetter(i)}열 역할`}><option value="">(쓰지 않음)</option>{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                    <td><select value={c.group} onChange={(e) => setCols(cols.map((x, j) => (j === i ? { ...x, group: e.target.value as GroupKey | "" } : x)))} aria-label={`${colLetter(i)}열 묶음`}><option value="">(없음)</option>{Object.entries(GROUP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="row gap end">
          <input className="grow" placeholder="왜 고치는지 메모(선택)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={() => setCols(init())} disabled={!changed}>되돌리기</Button>
          <Button kind="primary" onClick={save} disabled={!changed} testId="col-save">열 지정 저장</Button>
        </div>
      </Card>
      {sheet && <Card title="원본 미리 보기"><Grid sheet={sheet} from={Math.max(0, firstHeader - 1)} to={firstHeader + 30} roles={roleMap} marks={s.headerRows.map((r) => ({ row: r, cols: [], tone: "header" as const }))} testId="structure-grid" /></Card>}
    </>
  );
}
