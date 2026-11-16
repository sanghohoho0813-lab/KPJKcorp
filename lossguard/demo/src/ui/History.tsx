import { useState } from "react";
import type { StoredFile } from "../../../app/model";
import { diffRuns, diffIsEmpty, type RunDiff } from "../../../app/diff";
import { judgmentText } from "../../../app/report";
import { useApp, when, won, errMsg } from "../state";
import type { SiteCtx } from "./Site";
import { Badge, Button, Card, Empty, Note } from "./kit";
import { ORIGIN } from "./Links";

const ORIGIN_LABEL = (o: string) => (o === "none" ? "연결 없음" : ORIGIN[o as keyof typeof ORIGIN]?.label ?? o);

export function DiffView({ diff, files }: { diff: RunDiff; files: StoredFile[] }) {
  const name = (id: string) => files.find((f) => f.id === id)?.fileName ?? id;
  return (
    <div className="stack" data-testid="diff-view">
      <div className="diff-sum">
        <div><b>{diff.findings.added.length}</b><span>새로 나온 결과</span></div>
        <div><b>{diff.findings.removed.length}</b><span>사라진 결과</span></div>
        <div><b>{diff.findings.amountChanged.length}</b><span>금액이 바뀐 결과</span></div>
        <div><b>{diff.links.changed.length}</b><span>바뀐 연결</span></div>
        <div><b>{diff.columns.length}</b><span>열 지정이 바뀐 시트</span></div>
      </div>
      {diff.findings.added.length > 0 && <div><div className="calc-title">새로 나온 결과</div><ul className="list small">{diff.findings.added.map((f) => <li key={f.key}>{f.title} — {f.where}</li>)}</ul></div>}
      {diff.findings.removed.length > 0 && <div><div className="calc-title">사라진 결과(처리 기록은 남아 있음)</div><ul className="list small">{diff.findings.removed.map((f) => <li key={f.key}>{f.title} — {f.where}</li>)}</ul></div>}
      {diff.findings.amountChanged.length > 0 && <div><div className="calc-title">금액이 바뀐 결과</div><ul className="list small">{diff.findings.amountChanged.map((f) => <li key={f.key}>{f.title}: {won(f.before)} → {won(f.after)}</li>)}</ul></div>}
      {diff.links.changed.length > 0 && <div><div className="calc-title">바뀐 연결</div><ul className="list small">{diff.links.changed.slice(0, 30).map((c, i) => <li key={i}>"{c.aName}" ↔ "{c.bName}": {ORIGIN_LABEL(c.before)} → {ORIGIN_LABEL(c.after)}</li>)}</ul></div>}
      {diff.columns.length > 0 && <div><div className="calc-title">열 지정이 바뀐 시트</div><ul className="list small">{diff.columns.map((c) => <li key={c.fileId + c.sheet}>{name(c.fileId)} › {c.sheet}: 읽기 신뢰도 {c.confBefore} → {c.confAfter}</li>)}</ul></div>}
      <p className="small muted">항목 연결: 자동 {diff.counts.before.auto}→{diff.counts.after.auto} · 확인 필요 {diff.counts.before.review}→{diff.counts.after.review} · 사람 확인 {diff.counts.before.person}→{diff.counts.after.person} · 회사 규칙 {diff.counts.before.rule}→{diff.counts.after.rule}</p>
    </div>
  );
}

export function History({ ctx }: { ctx: SiteCtx }) {
  const { svc, user, toast } = useApp();
  const { data } = ctx;
  const [open, setOpen] = useState<number | null>(data.runs.length ? data.runs[data.runs.length - 1].no : null);
  const js = data.judgments.filter((j) => j.scope === "company" || j.siteId === data.site.id).slice().reverse();
  const withdraw = async (id: string) => {
    const j = data.judgments.find((x) => x.id === id);
    if (!j) return;
    try { await svc.withdraw(data, j, user); toast("판단을 거뒀습니다(기록은 남습니다) — 다시 분석하면 반영됩니다"); await ctx.reload(); } catch (e) { toast(errMsg(e), "error"); }
  };
  return (
    <div className="stack">
      <Card title={`분석 기록 ${data.runs.length}회`}>
        {!data.runs.length ? <Empty title="아직 분석하지 않았습니다" /> : (
          <div className="stack">
            {[...data.runs].reverse().map((r, i, arr) => {
              const prev = arr[i + 1];
              const d = prev ? diffRuns(prev.snapshot, r.snapshot) : undefined;
              return (
                <div className="run" key={r.id} data-testid="run-row">
                  <button className="run-head" onClick={() => setOpen(open === r.no ? null : r.no)}>
                    <b>{r.no}번째 분석</b> <span className="muted small">{when(r.at)} · {r.by} · 엔진 {r.engine} · 파일 {r.files.length}개 · 사람 판단 {r.judgmentIds.length}건{r.rulesApplied ? ` · 회사 규칙 적용 ${r.rulesApplied}건` : ""}</span>
                    <span className="row gap"><Badge tone="neutral">결과 {r.snapshot.findings.length}</Badge>{d && !diffIsEmpty(d) && <Badge tone="info">바뀜</Badge>}</span>
                  </button>
                  {open === r.no && (
                    <div className="run-body">
                      <p className="small muted">입력 지문 {r.inputHash} · 업종 묶음 {r.pack} · 파일: {r.files.map((f) => `${f.fileName}(${f.sha256.slice(0, 8)})`).join(", ")}</p>
                      {d ? (diffIsEmpty(d) ? <Note tone="neutral">이전 분석과 같습니다.</Note> : <DiffView diff={d} files={data.files} />) : <Note tone="neutral">첫 분석입니다.</Note>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Card title={`사람 판단 기록 ${js.length}건`} right={<span className="small muted">지우지 않고 판을 올려 남깁니다</span>}>
        {!js.length ? <Empty title="아직 사람 판단이 없습니다">문서 읽기 확인 · 항목 연결 화면에서 고친 것이 여기 남습니다.</Empty> : (
          <div className="table-wrap">
            <table className="plain" data-testid="judgment-table">
              <thead><tr><th>언제 · 누가</th><th>범위</th><th>판단</th><th>판</th><th>상태</th><th>출처</th><th /></tr></thead>
              <tbody>{js.map((j) => (
                <tr key={j.id} className={j.status !== "active" ? "row-muted" : ""}>
                  <td className="small">{when(j.at)}<br />{j.by}</td>
                  <td><Badge tone={j.scope === "company" ? "rule" : "person"}>{j.scope === "company" ? "회사 규칙" : "이 현장"}</Badge></td>
                  <td className="small">{judgmentText(j)}{j.note ? <div className="muted">"{j.note}"</div> : null}</td>
                  <td>{j.version}</td>
                  <td><Badge tone={j.status === "active" ? "success" : "neutral"}>{j.status === "active" ? "사용 중" : j.status === "superseded" ? "새 판으로 바뀜" : "거둠"}</Badge></td>
                  <td className="small muted">{j.source.siteName}{j.source.fileName ? ` · ${j.source.fileName}` : ""}{j.source.runNo ? ` · ${j.source.runNo}번째 분석 뒤` : ""} · 엔진 {j.source.engine}</td>
                  <td>{j.status === "active" && (j.scope === "site" ? j.siteId === data.site.id : true) && <Button small kind="ghost" onClick={() => withdraw(j.id)}>거두기</Button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
