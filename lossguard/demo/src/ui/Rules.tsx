import { useCallback, useEffect, useState } from "react";
import type { Judgment } from "../../../app/model";
import { useApp, when, errMsg } from "../state";
import { Badge, Button, Card, Empty, Note } from "./kit";

/** 회사 연결 규칙 — 한 현장에서 "이 이름 = 저 이름"이라고 확인한 판단을 같은 회사의 다른 현장에도 쓴다 */
export function Rules() {
  const { svc, user, toast } = useApp();
  const [rules, setRules] = useState<Judgment[]>();
  const fetchRules = useCallback(async () => { const c = await svc.company(); return (await svc.repo.listJudgments(c.id)).filter((j) => j.scope === "company").reverse(); }, [svc]);
  const load = useCallback(async () => setRules(await fetchRules()), [fetchRules]);
  useEffect(() => {
    let alive = true;
    (async () => { const r = await fetchRules(); if (alive) setRules(r); })();
    return () => { alive = false; };
  }, [fetchRules]);
  const withdraw = async (j: Judgment) => {
    try {
      const d = await svc.load(j.siteId);
      await svc.withdraw(d, j, user);
      toast("규칙을 거뒀습니다 — 각 현장을 다시 분석하면 반영됩니다");
      await load();
    } catch (e) { toast(errMsg(e), "error"); }
  };
  return (
    <div className="stack">
      <Card title="회사 연결 규칙">
        <Note tone="neutral">항목 연결 화면에서 "우리 회사 다른 현장에도 적용"을 고르고 판단하면 여기에 남습니다. 다른 현장을 분석할 때, 양쪽 문서에 그 이름이 <b>한 줄씩만</b> 있을 때만 자동으로 씁니다(같은 이름이 여러 줄이면 쓰지 않음). 그 현장에서 사람이 직접 판단한 줄에는 쓰지 않습니다.</Note>
        {!rules ? <p className="muted">불러오는 중…</p> : !rules.length ? <Empty title="아직 회사 규칙이 없습니다" /> : (
          <div className="table-wrap">
            <table className="plain" data-testid="rules-table">
              <thead><tr><th>규칙</th><th>판단</th><th>판 · 상태</th><th>누가 · 언제</th><th>출처(처음 판단한 현장)</th><th /></tr></thead>
              <tbody>{rules.map((j) => j.payload.type === "nameRule" && (
                <tr key={j.id} className={j.status !== "active" ? "row-muted" : ""}>
                  <td>"{j.payload.a.name} {j.payload.a.spec}" ↔ "{j.payload.b.name} {j.payload.b.spec}"</td>
                  <td><Badge tone={j.payload.same ? "rule" : "error"}>{j.payload.same ? "같은 항목" : "다른 항목"}</Badge></td>
                  <td>{j.version} · {j.status === "active" ? "사용 중" : j.status === "superseded" ? "새 판으로 바뀜" : "거둠"}</td>
                  <td className="small">{j.by}<br />{when(j.at)}</td>
                  <td className="small muted">{j.source.siteName}{j.source.fileName ? ` · ${j.source.fileName}` : ""} · 엔진 {j.source.engine}</td>
                  <td>{j.status === "active" && <Button small kind="ghost" onClick={() => withdraw(j)}>거두기</Button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
