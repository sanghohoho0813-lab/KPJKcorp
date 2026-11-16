import { useMemo, useState } from "react";
import type { Line } from "../../../engine/types";
import type { AnalysisView } from "../../../app/model";
import { detailItems } from "../../../engine/analyze";
import { linkOrigin, unlinked } from "../../../app/analysis";
import { num, won } from "../state";
import type { SiteCtx } from "./Site";
import { Badge, Card, Empty } from "./kit";
import { ORIGIN } from "./Links";

const KIND: Record<string, string> = { change: "변경 내역서", settlement: "정산서", other: "기타 문서" };

/** 계약 내역서와 변경 · 정산 내역을 한 줄씩 나란히 — 연결된 짝의 수량 · 단가 · 금액 차이를 표시한다 */
export function Compare({ ctx, view }: { ctx: SiteCtx; view: AnalysisView }) {
  const others = view.result.docs.filter((d) => d.kind !== "contract" && detailItems(d).length);
  const [docId, setDocId] = useState(others[0]?.docId ?? "");
  const [onlyDiff, setOnlyDiff] = useState(true);
  const contract = view.result.docs.find((d) => d.kind === "contract");
  const rows = useMemo(() => {
    if (!contract) return [];
    const other = view.result.docs.find((d) => d.docId === docId);
    const lineAt = new Map<string, Line>();
    for (const s of other?.sheets ?? []) for (const l of s.lines) lineAt.set(`${s.sheet}|${l.row}`, l);
    const links = view.result.links.filter((l) => l.b.docId === docId);
    const byA = new Map(links.map((l) => [`${l.a.sheet}|${l.a.row}`, l]));
    return detailItems(contract).map((a) => {
      const lk = byA.get(`${a.sheet}|${a.row}`);
      const b = lk ? lineAt.get(`${lk.b.sheet}|${lk.b.row}`) : undefined;
      const dq = b && a.qty !== undefined && b.qty !== undefined ? b.qty - a.qty : undefined;
      const dp = b && a.unitPrice !== undefined && b.unitPrice !== undefined ? b.unitPrice - a.unitPrice : undefined;
      const da = b && a.amount !== undefined && b.amount !== undefined ? b.amount - a.amount : undefined;
      return { a, b, lk, dq, dp, da, changed: !b || !!dq || !!dp || !!da };
    });
  }, [view, docId, contract]);
  if (!contract || !others.length) return <Card><Empty title="나란히 볼 문서가 없습니다">계약 내역서와 변경 · 정산 내역서가 함께 있어야 합니다.</Empty></Card>;
  const extra = unlinked(view.result).find((u) => u.docId === docId)?.other ?? [];
  const shown = onlyDiff ? rows.filter((r) => r.changed) : rows;
  const fileName = (id: string) => ctx.data.files.find((f) => f.id === id)?.fileName ?? id;
  const sum = (k: "da") => rows.reduce((s, r) => s + (r[k] ?? 0), 0);
  return (
    <Card title="계약 ↔ 변경 · 정산 나란히 보기" right={
      <span className="row gap">
        <select value={docId} onChange={(e) => setDocId(e.target.value)} aria-label="비교 문서">{others.map((d) => <option key={d.docId} value={d.docId}>{KIND[d.kind] ?? d.kind}{d.round ? ` ${d.round}차` : ""} — {fileName(d.docId)}</option>)}</select>
        <label className="check small"><input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /> 차이 있는 줄만</label>
      </span>
    } testId="compare">
      <p className="small muted">짝은 '항목 연결' 화면의 결과를 따릅니다(자동 · 확인 필요 · 사람 확인 · 회사 규칙). 차이는 문서에 적힌 값의 차이이며 손실이 아닙니다. 연결된 줄 금액 차이 합 {won(sum("da"))}(참고).</p>
      <div className="table-wrap">
        <table className="plain compare-table">
          <thead><tr><th colSpan={4}>계약 내역서</th><th colSpan={4}>{KIND[view.result.docs.find((d) => d.docId === docId)?.kind ?? ""] ?? "비교 문서"}</th><th>차이(비교 − 계약)</th><th>연결</th></tr>
            <tr><th>품명 · 규격</th><th>수량</th><th>단가</th><th>금액</th><th>품명 · 규격</th><th>수량</th><th>단가</th><th>금액</th><th /><th /></tr></thead>
          <tbody>
            {shown.map(({ a, b, lk, dq, dp, da }) => (
              <tr key={`${a.sheet}|${a.row}`}>
                <td><b>{a.name}</b> <span className="muted">{a.spec}</span><div className="small muted">{a.sheet} {a.row + 1}행</div></td>
                <td className="num">{num(a.qty)}</td><td className="num">{won(a.unitPrice)}</td><td className="num">{won(a.amount)}</td>
                {b ? <>
                  <td><b>{b.name}</b> <span className="muted">{b.spec}</span><div className="small muted">{b.sheet} {b.row + 1}행</div></td>
                  <td className={`num${dq ? " diff" : ""}`}>{num(b.qty)}</td><td className={`num${dp ? " diff" : ""}`}>{won(b.unitPrice)}</td><td className={`num${da ? " diff" : ""}`}>{won(b.amount)}</td>
                </> : <td colSpan={4} className="muted">짝 없음 — 빠졌거나 이름이 달라 연결하지 못함</td>}
                <td className="small">{[dq ? `수량 ${dq > 0 ? "+" : ""}${num(dq)}` : "", dp ? `단가 ${dp > 0 ? "+" : ""}${won(dp)}` : "", da ? `금액 ${da > 0 ? "+" : ""}${won(da)}` : ""].filter(Boolean).join(" · ") || (b ? "같음" : "-")}</td>
                <td>{lk ? <Badge tone={ORIGIN[linkOrigin(view, lk)].tone}>{ORIGIN[linkOrigin(view, lk)].label}</Badge> : <Badge tone="error">없음</Badge>}</td>
              </tr>
            ))}
            {extra.map((b) => (
              <tr key={`x${b.sheet}|${b.row}`} className="row-extra"><td colSpan={4} className="muted">계약에 없음(새 항목이거나 이름이 달라 연결 못 함)</td><td><b>{b.name}</b> <span className="muted">{b.spec}</span><div className="small muted">{b.sheet} {b.row + 1}행</div></td><td className="num">{num(b.qty)}</td><td className="num">{won(b.unitPrice)}</td><td className="num">{won(b.amount)}</td><td /><td><Badge tone="error">없음</Badge></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {!shown.length && !extra.length && <Empty title="차이 있는 줄이 없습니다" />}
    </Card>
  );
}
