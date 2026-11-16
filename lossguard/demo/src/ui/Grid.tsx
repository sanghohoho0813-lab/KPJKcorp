import type { RawSheet } from "../../../engine/types";
import { colLetter } from "../state";

/** 원본 표 보기 — 행 번호 · 열 글자(엑셀과 같은 주소)와 근거 칸 강조. 원본 글자를 그대로 보여 준다 */
export interface Mark { row: number; cols: number[]; tone: "base" | "compare" | "header" }

export function Grid({ sheet, from, to, marks = [], roles, maxCols = 16, testId, caption }: { sheet: RawSheet; from: number; to: number; marks?: Mark[]; roles?: Map<number, string>; maxCols?: number; testId?: string; caption?: string }) {
  const width = Math.min(maxCols, Math.max(1, ...sheet.rows.slice(from, to + 1).map((r) => r?.length ?? 0), ...[...(roles?.keys() ?? [])].map((c) => c + 1)));
  const hidden = new Set(sheet.hiddenRows);
  const markOf = (r: number, c: number) => marks.find((m) => m.row === r && (m.cols.length === 0 || m.cols.includes(c)));
  const rowMark = (r: number) => marks.find((m) => m.row === r);
  const rows: number[] = [];
  for (let r = Math.max(0, from); r <= Math.min(to, sheet.rows.length - 1); r++) rows.push(r);
  return (
    <div className="grid-wrap" data-testid={testId}>
      {caption && <div className="grid-cap">{caption}</div>}
      <table className="sheet">
        <thead>
          <tr><th className="corner" />{Array.from({ length: width }, (_, c) => <th key={c}>{colLetter(c)}{roles?.get(c) && <span className="role-tag">{roles.get(c)}</span>}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r} className={`${rowMark(r) ? `row-${rowMark(r)!.tone}` : ""}${hidden.has(r) ? " row-hidden" : ""}`}>
              <th className="rownum">{r + 1}{hidden.has(r) && <span title="숨긴 행"> ⦸</span>}</th>
              {Array.from({ length: width }, (_, c) => {
                const cell = sheet.rows[r]?.[c];
                const m = markOf(r, c);
                const isNum = cell?.t === "num";
                return <td key={c} className={`${m && m.cols.includes(c) ? `cell-${m.tone}` : ""}${isNum ? " num" : ""}`} title={`${sheet.name}!${colLetter(c)}${r + 1}`}>{cell?.v ?? ""}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {sheet.rows.length > to + 1 && <div className="muted small grid-more">… 아래 {sheet.rows.length - to - 1}행 더 있음</div>}
    </div>
  );
}

export const cellAddr = (sheet: string, row: number, col: number) => `${sheet}!${colLetter(col)}${row + 1}`;
