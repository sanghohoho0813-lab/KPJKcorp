import type { Finding } from "../engine/types";
import type { AnalysisView, FindingCase, Judgment, Run, Site, StoredFile } from "./model";
import { CATEGORY, DETECTOR, STATUS, amountLabel, calcSteps, keyLabel, plainWhy } from "./explain";
import { categoryOf, unlinked } from "./analysis";
import { reflectedTotal } from "./workflow";

/**
 * 결과보고서 자료 — 화면이 그대로 인쇄(PDF 저장)한다.
 * 원칙: 손실을 확정하지 않는다 · 반영 금액은 사용자가 입력한 값만 · 합성 자료로만 시험된 프로그램임을 밝힌다.
 */
export interface ReportModel {
  title: string;
  createdAt: string;
  site: Site;
  run: Run;
  files: { kind: string; fileName: string; format: string; sha256: string; pii: string }[];
  summary: { label: string; value: string }[];
  byCategory: { label: string; plain: string; count: number }[];
  byStatus: { label: string; count: number }[];
  reflected: { total: number | null; entered: number; noneChosen: number };
  items: {
    no: number; key: string; category: string; detector: string; title: string; message: string; amount: string; why: string;
    steps: string[]; evidence: string[]; caveat?: string; status: string; action?: string;
    reflected?: string; history: string[]; present: boolean;
  }[];
  links: { label: string; count: number }[];
  gaps: string[];
  judgments: { at: string; by: string; scope: string; what: string; version: number; status: string; source: string }[];
  limits: string[];
}

const KIND: Record<string, string> = { contract: "계약 내역서", change: "변경 내역서", settlement: "정산서", cost: "매입 · 지급 자료" };
const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

export function judgmentText(j: Judgment): string {
  const p = j.payload;
  if (p.type === "column") return `열 지정: ${p.sheet} — ${p.columns.map((c) => `${c.col + 1}열=${c.group ? c.group + "." : ""}${c.role}`).join(", ")}`;
  if (p.type === "link") return `${p.same ? "같은 항목" : "다른 항목"}: "${p.a.name} ${p.a.spec}" ↔ "${p.b.name} ${p.b.spec}"`;
  return `회사 규칙(${p.same ? "같음" : "다름"}): "${p.a.name} ${p.a.spec}" ↔ "${p.b.name} ${p.b.spec}"`;
}

export function buildReport(site: Site, files: StoredFile[], run: Run, view: AnalysisView, cases: FindingCase[], judgments: Judgment[], now: string): ReportModel {
  const fs: Finding[] = view.result.findings;
  const caseOf = new Map(cases.map((c) => [c.key, c]));
  const items = fs.map((f, i) => {
    const c = caseOf.get(f.key);
    return {
      no: i + 1, key: f.key, category: CATEGORY[categoryOf(f)].label, detector: `${f.detector} ${DETECTOR[f.detector] ?? ""}`.trim(),
      title: f.title, message: f.message, amount: amountLabel(f), why: plainWhy(f), steps: calcSteps(f),
      evidence: f.evidence.map((e) => `${e.fileName} › ${e.sheet} › ${e.row + 1}행 — ${Object.entries(e.values).map(([k, v]) => `${keyLabel(k)} ${v || "(빈칸)"}`).join(" · ")}`),
      caveat: f.caveat, status: c ? STATUS[c.status].label : STATUS.open.label, action: c?.action,
      reflected: c?.reflected ? (c.reflected.amount === null ? `반영 금액 없음(${c.reflected.by} 선택)` : `${won(c.reflected.amount)} — ${c.reflected.note || "근거 메모 없음"} (${c.reflected.by})`) : undefined,
      history: (c?.history ?? []).map((h) => `${h.at.slice(0, 16).replace("T", " ")} ${h.by} — ${h.type === "status" ? `${STATUS[h.from!].label} → ${STATUS[h.to!].label}` : h.type === "reflected" ? `반영 금액 ${h.amount === null ? "없음" : won(h.amount ?? 0)}` : h.type === "action" ? "조치" : h.type === "note" ? "메모" : "자동"}${h.text ? `: ${h.text}` : ""}`),
      present: c?.present ?? true,
    };
  });
  const gone = cases.filter((c) => !c.present);
  const cats = (["calc", "unconfirmed"] as const).map((k) => ({ label: CATEGORY[k].label, plain: CATEGORY[k].plain, count: fs.filter((f) => categoryOf(f) === k).length }));
  const statusCount = new Map<string, number>();
  for (const f of fs) { const s = STATUS[caseOf.get(f.key)?.status ?? "open"].label; statusCount.set(s, (statusCount.get(s) ?? 0) + 1); }
  const k = run.snapshot.counts;
  const unl = unlinked(view.result);
  const gaps = [
    ...view.result.skipped.map((s) => `${s.detector}: ${s.reason.replace(/^([0-9a-f-]{8,})(?= \/)/, (m) => files.find((f) => f.id === m)?.fileName ?? m)}`),
    ...unl.filter((u) => u.other.length).map((u) => `${files.find((f) => f.id === u.docId)?.fileName ?? u.docId}: 계약 내역서와 연결되지 않은 항목 ${u.other.length}줄(새로 생긴 항목이거나 이름이 많이 다른 항목 — 연결 화면에서 확인)`),
    ...(!files.some((f) => f.active && f.kind === "change") ? ["변경 내역서가 없어 변경 대조(D03)를 하지 않았습니다"] : []),
    ...(!files.some((f) => f.active && f.kind === "cost") ? ["매입 · 지급 자료가 없어 중복 가능성 점검(D10)을 하지 않았습니다"] : []),
    "기성 청구 · 원가 대조(D04 · D05)는 실제 자료로 검증하기 전이라 이 프로그램에 없습니다",
  ];
  return {
    title: `${site.name} — 정산 자료 점검 보고서`,
    createdAt: now,
    site, run,
    files: files.filter((f) => f.active).map((f) => ({ kind: `${KIND[f.kind] ?? f.kind}${f.round ? ` ${f.round}차` : ""}`, fileName: f.fileName, format: f.format, sha256: f.sha256.slice(0, 16) + "…", pii: f.pii.level === "none" ? "개인정보 없음" : `${f.pii.level === "info" ? "회사 정보만(그대로 둠)" : `개인정보 지움(칸 ${f.pii.changedCells}개)`}` })),
    summary: [
      { label: "분석", value: `${run.no}번째 · ${run.at.slice(0, 16).replace("T", " ")} · ${run.by}` },
      { label: "엔진 · 업종 묶음", value: `${run.engine} · ${run.pack}` },
      { label: "입력 지문", value: run.inputHash },
      { label: "확인할 결과", value: `${fs.length}건${gone.length ? ` (이전 분석에 있었으나 이번에 없는 결과 ${gone.length}건 별도)` : ""}` },
      { label: "항목 연결", value: `자동 ${k.auto} · 확인 필요 ${k.review} · 사람 확인 ${k.person} · 회사 규칙 ${k.rule} · 연결 안 됨(비교 문서) ${k.unlinkedOther}` },
    ],
    byCategory: cats,
    byStatus: [...statusCount.entries()].map(([label, count]) => ({ label, count })),
    reflected: reflectedTotal(cases),
    items,
    links: [
      { label: "자동 연결", count: k.auto }, { label: "확인 필요(사람 확인 전)", count: k.review }, { label: "사람이 같다고 확인", count: k.person },
      { label: "회사 규칙으로 연결", count: k.rule }, { label: "사람이 다르다고 판단", count: k.rejected }, { label: "연결 안 됨 — 비교 문서 항목", count: k.unlinkedOther },
    ],
    gaps,
    judgments: judgments.filter((j) => j.scope === "company" || j.siteId === site.id).map((j) => ({
      at: j.at.slice(0, 16).replace("T", " "), by: j.by, scope: j.scope === "company" ? "회사 규칙" : "이 현장", what: judgmentText(j), version: j.version,
      status: j.status === "active" ? "사용 중" : j.status === "superseded" ? "새 판으로 바뀜" : "거둠", source: `${j.source.siteName}${j.source.fileName ? ` · ${j.source.fileName}` : ""}${j.source.runNo ? ` · ${j.source.runNo}번째 분석 뒤` : ""} · 엔진 ${j.source.engine}`,
    })),
    limits: [
      "이 보고서는 문서 사이의 불일치와 확인할 곳을 보여 줄 뿐, 손실이나 받을 돈을 확정하지 않습니다. 금액은 문서 사이의 차이이며, 실제 반영 금액은 담당자가 입력한 값만 적었습니다.",
      "‘미확인 불일치’는 자동 연결이나 추정에 기댄 결과입니다. 사람이 확인하기 전에는 불일치로 단정하지 않습니다.",
      "이 프로그램은 가상(합성) 공사 자료로만 시험되었습니다. 실제 현장 자료에서의 정확도는 아직 측정되지 않았습니다.",
      "법률 · 세무 · 회계 판단이 아닙니다. 계약 조건 · 합의 내용은 원본 계약서와 담당자 확인으로 판단하세요.",
    ],
  };
}
