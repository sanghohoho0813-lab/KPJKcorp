import { useMemo } from "react";
import type { AnalysisView } from "../../../app/model";
import { buildReport } from "../../../app/report";
import { won, when } from "../state";
import type { SiteCtx } from "./Site";
import { Button, Note } from "./kit";

/** 결과보고서 — 화면 그대로 인쇄하거나 브라우저의 "PDF로 저장"으로 남긴다 */
export function ReportView({ ctx, view }: { ctx: SiteCtx; view: AnalysisView }) {
  const { data } = ctx;
  const last = data.runs[data.runs.length - 1];
  const rep = useMemo(() => (last ? buildReport(data.site, data.files, last, view, data.cases, data.judgments, new Date().toISOString()) : undefined), [data, view, last]);
  if (!rep) return <Note tone="info">분석한 뒤에 보고서를 만들 수 있습니다.</Note>;
  return (
    <div className="stack">
      <div className="row between no-print">
        <Note tone="neutral">인쇄 창에서 "PDF로 저장"을 고르면 PDF 파일로 남습니다. 보고서는 이 브라우저 안에서 만들어지며 어디로도 보내지 않습니다.</Note>
        <Button kind="primary" onClick={() => print()} testId="print">인쇄 · PDF로 저장</Button>
      </div>
      {ctx.pending.any && <Note tone="warning">마지막 분석 뒤에 바뀐 판단 · 파일이 있습니다. 보고서는 {last.no}번째 분석 기준입니다 — 반영하려면 다시 분석하세요.</Note>}
      <article className="report" data-testid="report">
        <header className="rep-head">
          <div className="rep-kicker">LossGuard 정산 자료 점검 보고서 · 시연판(가상 자료로 시험된 프로그램)</div>
          <h1>{rep.title}</h1>
          <div className="small muted">보고서 만든 때 {when(rep.createdAt)} · {rep.run.no}번째 분석 기준</div>
        </header>
        <section>
          <h2>1. 한눈에</h2>
          <table className="rep-table"><tbody>{rep.summary.map((s) => <tr key={s.label}><th>{s.label}</th><td>{s.value}</td></tr>)}</tbody></table>
          <div className="rep-cards">
            {rep.byCategory.map((c) => <div key={c.label} className="rep-card"><b>{c.count}</b><span>{c.label}</span><small>{c.plain}</small></div>)}
            <div className="rep-card"><b>{rep.reflected.total === null ? "없음" : won(rep.reflected.total)}</b><span>사용자가 입력한 실제 반영 금액</span><small>{rep.reflected.total === null ? "입력된 반영 금액이 없습니다. 이 보고서는 절감액을 추정하지 않습니다." : `입력 ${rep.reflected.entered}건${rep.reflected.noneChosen ? ` · '반영 금액 없음' ${rep.reflected.noneChosen}건` : ""}. 추정치가 아니라 담당자가 적은 값의 합입니다.`}</small></div>
          </div>
          <p className="small">처리 상태: {rep.byStatus.map((s) => `${s.label} ${s.count}`).join(" · ") || "-"}</p>
        </section>
        <section>
          <h2>2. 입력 파일</h2>
          <table className="rep-table"><thead><tr><th>종류</th><th>파일</th><th>형식</th><th>지문(SHA-256)</th><th>개인정보</th></tr></thead>
            <tbody>{rep.files.map((f) => <tr key={f.fileName + f.kind}><td>{f.kind}</td><td>{f.fileName}</td><td>{f.format}</td><td className="mono">{f.sha256}</td><td>{f.pii}</td></tr>)}</tbody></table>
        </section>
        <section>
          <h2>3. 확인할 결과 {rep.items.length}건</h2>
          {rep.items.map((it) => (
            <div className="rep-item" key={it.key}>
              <div className="rep-item-head"><b>{it.no}. {it.title}</b><span className="small">{it.category} · {it.detector} · 상태: {it.status}</span></div>
              <p className="small">{it.why}</p>
              <p className="small"><b>{it.amount}</b> — 손실로 확정된 금액이 아닙니다</p>
              <div className="small"><b>계산 과정</b><ol>{it.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>
              <div className="small"><b>원본 근거</b><ul>{it.evidence.map((e) => <li key={e}>{e}</li>)}</ul></div>
              {it.caveat && <p className="small"><b>문제가 아닐 수 있는 경우</b> — {it.caveat}</p>}
              {it.action && <p className="small"><b>조치</b> — {it.action}</p>}
              {it.reflected && <p className="small"><b>실제 반영 금액(입력값)</b> — {it.reflected}</p>}
              {it.history.length > 0 && <div className="small"><b>처리 이력</b><ul>{it.history.map((h, i) => <li key={i}>{h}</li>)}</ul></div>}
            </div>
          ))}
        </section>
        <section>
          <h2>4. 항목 연결</h2>
          <table className="rep-table"><tbody>{rep.links.map((l) => <tr key={l.label}><th>{l.label}</th><td>{l.count}</td></tr>)}</tbody></table>
        </section>
        <section>
          <h2>5. 자료 부족 · 하지 않은 점검</h2>
          <ul className="small">{rep.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
        </section>
        <section>
          <h2>6. 사람 판단 기록</h2>
          {rep.judgments.length ? <table className="rep-table small"><thead><tr><th>언제</th><th>누가</th><th>범위</th><th>판단</th><th>판 · 상태</th><th>출처</th></tr></thead>
            <tbody>{rep.judgments.map((j, i) => <tr key={i}><td>{j.at}</td><td>{j.by}</td><td>{j.scope}</td><td>{j.what}</td><td>{j.version} · {j.status}</td><td>{j.source}</td></tr>)}</tbody></table> : <p className="small">없음</p>}
        </section>
        <section className="rep-limits">
          <h2>7. 이 보고서의 한계</h2>
          <ul className="small">{rep.limits.map((l) => <li key={l}>{l}</li>)}</ul>
        </section>
      </article>
    </div>
  );
}
