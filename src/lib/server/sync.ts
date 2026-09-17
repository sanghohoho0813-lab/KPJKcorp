"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoreState } from "../store";
import type { DocumentFile, Message } from "../types";
import { explain, supa } from "./client";
import * as M from "./rows";

/**
 * 스토어 ↔ 서버 동기화.
 *
 * 설계 이유
 * ---------
 * 쓰기 액션이 45개다. 액션마다 서버 호출을 끼워 넣으면 45곳을 고쳐야 하고,
 * 새 기능을 만들 때마다 "서버에 보내는 것을 빠뜨렸는지" 매번 신경 써야 한다.
 * 대신 스토어의 set() 을 한 번 감싸서, 바뀐 배열을 찾아 바뀐 행만 보낸다.
 * 화면과 액션 코드는 서버가 붙었다는 사실 자체를 모른다.
 *
 * 그래서 생기는 한계 (숨기지 않는다)
 * - 마지막에 저장한 사람이 이긴다. 두 사람이 같은 기업을 동시에 고치면 뒤가 덮는다.
 *   컨설턴트 5명 규모에서는 충돌이 드물고, 모든 변경은 활동 기록에 남아 추적된다.
 * - 화면이 먼저 바뀌고 서버 저장은 뒤따른다. 실패하면 화면에 알린다.
 */

/** 부모 먼저. 프로젝트를 기업보다 먼저 보내면 외래키에 걸린다. */
const ORDER = [
  "companies", "projects",
  "consultations", "contracts", "docRequests", "schedules", "tasks",
  "inquiries", "results", "opportunities",
  "quotes", "approvals",
  "activities", "notifications", "surveys",
] as const;

type Key = (typeof ORDER)[number];

interface Spec {
  table: string;
  toRow: (x: never) => Record<string, unknown>;
  fromRow: (r: Record<string, unknown>) => unknown;
  /** 삭제를 허용하는가. 기록·알림은 지우지 않는다. */
  deletable: boolean;
  /** 기본 정렬 (읽어올 때) */
  order?: { column: string; ascending: boolean };
}

const SPEC: Record<Key, Spec> = {
  companies:     { table: "companies",         toRow: M.companyToRow as Spec["toRow"],      fromRow: M.companyFromRow,      deletable: true },
  projects:      { table: "projects",          toRow: M.projectToRow as Spec["toRow"],      fromRow: M.projectFromRow,      deletable: true },
  consultations: { table: "consultations",     toRow: M.consultationToRow as Spec["toRow"], fromRow: M.consultationFromRow, deletable: true,  order: { column: "date", ascending: false } },
  contracts:     { table: "contracts",         toRow: M.contractToRow as Spec["toRow"],     fromRow: M.contractFromRow,     deletable: true },
  docRequests:   { table: "document_requests", toRow: M.docRequestToRow as Spec["toRow"],   fromRow: M.docRequestFromRow,   deletable: true,  order: { column: "requested_at", ascending: false } },
  schedules:     { table: "schedules",         toRow: M.scheduleToRow as Spec["toRow"],     fromRow: M.scheduleFromRow,     deletable: true,  order: { column: "start_at", ascending: true } },
  tasks:         { table: "tasks",             toRow: M.taskToRow as Spec["toRow"],         fromRow: M.taskFromRow,         deletable: true,  order: { column: "due_date", ascending: true } },
  inquiries:     { table: "inquiries",         toRow: M.inquiryToRow as Spec["toRow"],      fromRow: M.inquiryFromRow,      deletable: true,  order: { column: "created_at", ascending: false } },
  results:       { table: "results",           toRow: M.resultToRow as Spec["toRow"],       fromRow: M.resultFromRow,       deletable: true,  order: { column: "shared_at", ascending: false } },
  opportunities: { table: "opportunities",     toRow: M.opportunityToRow as Spec["toRow"],  fromRow: M.opportunityFromRow,  deletable: true,  order: { column: "updated_at", ascending: false } },
  quotes:        { table: "quotes",            toRow: M.quoteToRow as Spec["toRow"],        fromRow: M.quoteFromRow,        deletable: true,  order: { column: "created_at", ascending: false } },
  approvals:     { table: "approvals",         toRow: M.approvalToRow as Spec["toRow"],     fromRow: M.approvalFromRow,     deletable: true,  order: { column: "requested_at", ascending: false } },
  // 기록은 추가만 한다. 서버에도 지우는 경로를 두지 않는다.
  activities:    { table: "activities",        toRow: M.activityToRow as Spec["toRow"],     fromRow: M.activityFromRow,     deletable: false, order: { column: "at", ascending: false } },
  notifications: { table: "notifications",     toRow: M.notificationToRow as Spec["toRow"], fromRow: M.notificationFromRow, deletable: false, order: { column: "at", ascending: false } },
  surveys:       { table: "surveys",           toRow: M.surveyToRow as Spec["toRow"],       fromRow: M.surveyFromRow,       deletable: false, order: { column: "submitted_at", ascending: false } },
};

/* ------------------------------ 읽어오기 -------------------------------- */

/** 조직 전체가 공유하는 설정. 테마·글자크기 같은 개인 취향은 여기 없다 — 기기마다 달라야 한다. */
export interface ServerSettings {
  org?: StoreState["settings"]["org"];
  baseline?: StoreState["settings"]["baseline"];
  baselineSurveys?: StoreState["settings"]["baselineSurveys"];
  sprintStartedAt?: string;
  autoRules?: Record<string, boolean>;
  consultantScope: "all" | "own";
}

export interface LoadResult {
  ok: boolean;
  reason?: string;
  data?: Partial<StoreState>;
  settings?: ServerSettings;
}

/**
 * 로그인 직후 한 번. 내가 볼 수 있는 것만 온다 — 걸러내는 일은 서버가 한다.
 * 화면은 지금까지처럼 통째로 들고 있는 목록을 그대로 쓴다.
 */
export async function loadAll(): Promise<LoadResult> {
  const sb = supa();
  if (!sb) return { ok: false, reason: "서버가 설정되지 않았습니다." };

  try {
    const [profiles, files, messages, settings, ...rest] = await Promise.all([
      sb.from("profiles").select("*").order("role"),
      sb.from("document_files").select("*").order("uploaded_at"),
      sb.from("inquiry_messages").select("*").order("created_at"),
      sb.from("app_settings").select("*").eq("id", 1).maybeSingle(),
      ...ORDER.map((k) => {
        const spec = SPEC[k];
        const q = sb.from(spec.table).select("*");
        return spec.order ? q.order(spec.order.column, { ascending: spec.order.ascending }) : q;
      }),
    ]);

    const bad = [profiles, files, messages, settings, ...rest].find((r) => r.error);
    if (bad?.error) return { ok: false, reason: explain(bad.error) };

    // 파일·메시지를 부모 안으로 접어 넣는다 — 화면이 기대하는 모양이다
    const filesBy = new Map<string, DocumentFile[]>();
    for (const r of (files.data ?? []) as Record<string, unknown>[]) {
      const k = String(r.request_id);
      (filesBy.get(k) ?? filesBy.set(k, []).get(k)!).push(M.docFileFromRow(r));
    }
    const msgsBy = new Map<string, Message[]>();
    for (const r of (messages.data ?? []) as Record<string, unknown>[]) {
      const k = String(r.inquiry_id);
      (msgsBy.get(k) ?? msgsBy.set(k, []).get(k)!).push(M.messageFromRow(r));
    }

    const data: Record<string, unknown> = { users: (profiles.data ?? []).map(M.userFromRow) };
    ORDER.forEach((k, i) => {
      const rows = (rest[i].data ?? []) as Record<string, unknown>[];
      if (k === "docRequests") data[k] = rows.map((r) => M.docRequestFromRow(r, filesBy.get(String(r.id)) ?? []));
      else if (k === "inquiries") data[k] = rows.map((r) => M.inquiryFromRow(r, msgsBy.get(String(r.id)) ?? []));
      else data[k] = rows.map(SPEC[k].fromRow);
    });

    const st = settings.data as Record<string, unknown> | null;
    return {
      ok: true,
      data: data as Partial<StoreState>,
      settings: {
        org: (st?.org ?? undefined) as StoreState["settings"]["org"],
        baseline: (st?.baseline ?? undefined) as StoreState["settings"]["baseline"],
        baselineSurveys: (st?.baseline_surveys ?? undefined) as StoreState["settings"]["baselineSurveys"],
        sprintStartedAt: (st?.sprint_started_at ?? undefined) as string | undefined,
        autoRules: (st?.auto_rules ?? undefined) as Record<string, boolean> | undefined,
        consultantScope: (st?.consultant_scope ?? "all") as "all" | "own",
      },
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "서버에서 데이터를 가져오지 못했습니다." };
  }
}

/* ------------------------------ 밀어넣기 -------------------------------- */

type WithId = { id: string };

interface Change { key: Key; upsert: Record<string, unknown>[]; remove: string[] }

/** 이전 상태와 새 상태를 비교해 달라진 행만 고른다 */
function diff(prev: Partial<StoreState>, next: Partial<StoreState>): Change[] {
  const out: Change[] = [];
  for (const key of ORDER) {
    const a = prev[key] as WithId[] | undefined;
    const b = next[key] as WithId[] | undefined;
    if (!b || a === b) continue;                  // 참조가 같으면 손댄 적 없다
    const before = new Map((a ?? []).map((x) => [x.id, x]));
    const upsert: Record<string, unknown>[] = [];
    for (const row of b) {
      const old = before.get(row.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(row)) {
        upsert.push(SPEC[key].toRow(row as never));
      }
      before.delete(row.id);
    }
    const remove = SPEC[key].deletable ? [...before.keys()] : [];
    if (upsert.length || remove.length) out.push({ key, upsert, remove });
  }
  return out;
}

/** 자료요청 안의 파일 / 문의 안의 메시지 — 부모 배열 안에 접혀 있어 따로 본다 */
function diffNested(prev: Partial<StoreState>, next: Partial<StoreState>) {
  const files: Record<string, unknown>[] = [];
  const msgs: Record<string, unknown>[] = [];
  const pd = new Map((prev.docRequests ?? []).map((d) => [d.id, d]));
  for (const d of next.docRequests ?? []) {
    const known = new Set((pd.get(d.id)?.files ?? []).map((f) => f.id));
    for (const f of d.files) if (!known.has(f.id)) {
      files.push({
        id: f.id, request_id: d.id, file_name: f.fileName, size: f.size,
        uploaded_at: f.uploadedAt, uploaded_by: f.uploadedBy || null, version: f.version,
        storage_path: f.storagePath ?? null,
      });
    }
  }
  const pi = new Map((prev.inquiries ?? []).map((i) => [i.id, i]));
  for (const i of next.inquiries ?? []) {
    const known = new Set((pi.get(i.id)?.messages ?? []).map((m) => m.id));
    for (const m of i.messages) if (!known.has(m.id)) {
      msgs.push({
        id: m.id, inquiry_id: i.id, author_id: m.authorId || null,
        author_role: m.authorRole, body: m.body, created_at: m.createdAt,
      });
    }
  }
  return { files, msgs };
}

let queue: Promise<void> = Promise.resolve();
let onError: ((msg: string) => void) | null = null;
let pending = 0;

export const setSyncErrorHandler = (fn: (msg: string) => void) => { onError = fn; };
export const pendingWrites = () => pending;

/**
 * 변경을 서버로 보낸다. 화면은 이미 바뀐 뒤다 — 여기서 기다리지 않는다.
 * 순서를 보장하려고 하나의 줄(queue)에 세운다. 부모를 먼저 만들지 않으면 외래키에 걸린다.
 */
export function pushChanges(prev: Partial<StoreState>, next: Partial<StoreState>) {
  const sb = supa();
  if (!sb) return;
  const changes = diff(prev, next);
  const nested = diffNested(prev, next);
  if (!changes.length && !nested.files.length && !nested.msgs.length) return;

  pending += 1;
  queue = queue.then(() => flush(sb, changes, nested)).finally(() => { pending -= 1; });
}

async function flush(
  sb: SupabaseClient,
  changes: Change[],
  nested: { files: Record<string, unknown>[]; msgs: Record<string, unknown>[] },
) {
  const fail = (what: string, e: Parameters<typeof explain>[0]) => {
    console.error(`[sync] ${what}`, e);
    onError?.(`${what} 저장 실패 — ${explain(e)}`);
  };

  // 1) 추가·수정은 부모 → 자식 순서로
  for (const c of changes) {
    if (!c.upsert.length) continue;
    const { error } = await sb.from(SPEC[c.key].table).upsert(c.upsert, { onConflict: "id" });
    if (error) fail(SPEC[c.key].table, error);
  }
  // 2) 접혀 있던 자식들
  if (nested.files.length) {
    const { error } = await sb.from("document_files").upsert(nested.files, { onConflict: "id" });
    if (error) fail("제출 파일", error);
  }
  if (nested.msgs.length) {
    const { error } = await sb.from("inquiry_messages").upsert(nested.msgs, { onConflict: "id" });
    if (error) fail("문의 메시지", error);
  }
  // 3) 삭제는 자식 → 부모 역순으로
  for (const c of [...changes].reverse()) {
    if (!c.remove.length) continue;
    const { error } = await sb.from(SPEC[c.key].table).delete().in("id", c.remove);
    if (error) fail(`${SPEC[c.key].table} 삭제`, error);
  }
}

/**
 * 조직 공용 설정은 목록이 아니라 한 행(app_settings)이라 diff 경로를 타지 않는다.
 * 그래서 따로 보낸다 — 회사 정보·기준선·기준선 조사·실증 시작일·시간 규칙·열람 범위.
 */
export async function pushSettings(patch: {
  org?: unknown; baseline?: unknown; baselineSurveys?: unknown;
  sprintStartedAt?: string; autoRules?: unknown; consultantScope?: "all" | "own";
}): Promise<{ ok: boolean; reason?: string }> {
  const sb = supa();
  if (!sb) return { ok: false, reason: "서버가 설정되지 않았습니다." };
  const row: Record<string, unknown> = {};
  if (patch.org !== undefined) row.org = patch.org;
  if (patch.baseline !== undefined) row.baseline = patch.baseline;
  if (patch.baselineSurveys !== undefined) row.baseline_surveys = patch.baselineSurveys;
  if (patch.sprintStartedAt !== undefined) row.sprint_started_at = patch.sprintStartedAt;
  if (patch.autoRules !== undefined) row.auto_rules = patch.autoRules;
  if (patch.consultantScope !== undefined) row.consultant_scope = patch.consultantScope;
  if (!Object.keys(row).length) return { ok: true };
  const { error } = await sb.from("app_settings").update(row).eq("id", 1);
  if (error) {
    const msg = `설정 저장 실패 — ${explain(error)}`;
    console.error("[sync] app_settings", error);
    onError?.(msg);
    return { ok: false, reason: explain(error) };
  }
  return { ok: true };
}

/** 조직이 공유하는 설정 키 — 기기별 취향(테마·글자크기)은 여기 없다 */
export const ORG_SETTING_KEYS = ["org", "baseline", "baselineSurveys", "sprintStartedAt", "autoRules"] as const;
