"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoreState } from "../store";
import type { DocumentFile, Message } from "../types";
import { explain, supa } from "./client";
import { isNetworkError } from "./auth";
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
  "consultations", "contracts", "docRequests", "schedules", "notices", "tasks",
  "companyVaults", "companyFiles", "journal", "payments",
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
  /** 추가만 하는 표(기록·설문). 서버가 수정 권한을 주지 않으므로 "있으면 건너뛰기"로 보낸다 */
  appendOnly?: boolean;
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
  companyVaults: { table: "company_vaults",    toRow: M.vaultToRow as Spec["toRow"],        fromRow: M.vaultFromRow,        deletable: true },
  companyFiles:  { table: "company_files",     toRow: M.companyFileToRow as Spec["toRow"],  fromRow: M.companyFileFromRow,  deletable: true,  order: { column: "uploaded_at", ascending: false } },
  journal:       { table: "journal_entries",   toRow: M.journalToRow as Spec["toRow"],      fromRow: M.journalFromRow,      deletable: true,  order: { column: "created_at", ascending: false } },
  payments:      { table: "payments",          toRow: M.paymentToRow as Spec["toRow"],      fromRow: M.paymentFromRow,      deletable: true,  order: { column: "created_at", ascending: true } },
  notices:       { table: "notices",           toRow: M.noticeToRow as Spec["toRow"],       fromRow: M.noticeFromRow,       deletable: true,  order: { column: "published_at", ascending: false } },
  tasks:         { table: "tasks",             toRow: M.taskToRow as Spec["toRow"],         fromRow: M.taskFromRow,         deletable: true,  order: { column: "due_date", ascending: true } },
  inquiries:     { table: "inquiries",         toRow: M.inquiryToRow as Spec["toRow"],      fromRow: M.inquiryFromRow,      deletable: true,  order: { column: "created_at", ascending: false } },
  results:       { table: "results",           toRow: M.resultToRow as Spec["toRow"],       fromRow: M.resultFromRow,       deletable: true,  order: { column: "shared_at", ascending: false } },
  opportunities: { table: "opportunities",     toRow: M.opportunityToRow as Spec["toRow"],  fromRow: M.opportunityFromRow,  deletable: true,  order: { column: "updated_at", ascending: false } },
  quotes:        { table: "quotes",            toRow: M.quoteToRow as Spec["toRow"],        fromRow: M.quoteFromRow,        deletable: true,  order: { column: "created_at", ascending: false } },
  approvals:     { table: "approvals",         toRow: M.approvalToRow as Spec["toRow"],     fromRow: M.approvalFromRow,     deletable: true,  order: { column: "requested_at", ascending: false } },
  // 기록은 추가만 한다. 서버에도 지우는 경로를 두지 않는다.
  activities:    { table: "activities",        toRow: M.activityToRow as Spec["toRow"],     fromRow: M.activityFromRow,     deletable: false, appendOnly: true, order: { column: "at", ascending: false } },
  notifications: { table: "notifications",     toRow: M.notificationToRow as Spec["toRow"], fromRow: M.notificationFromRow, deletable: false, order: { column: "at", ascending: false } },
  surveys:       { table: "surveys",           toRow: M.surveyToRow as Spec["toRow"],       fromRow: M.surveyFromRow,       deletable: false, appendOnly: true, order: { column: "submitted_at", ascending: false } },
};

/* ------------------------------ 읽어오기 -------------------------------- */

/** 조직 전체가 공유하는 설정. 테마·글자크기 같은 개인 취향은 여기 없다 — 기기마다 달라야 한다. */
export interface ServerSettings {
  org?: StoreState["settings"]["org"];
  baseline?: StoreState["settings"]["baseline"];
  baselineSurveys?: StoreState["settings"]["baselineSurveys"];
  sprintStartedAt?: string;
  autoRules?: Record<string, boolean | number>;
  consultantScope: "all" | "own";
}

export interface LoadResult {
  ok: boolean;
  reason?: string;
  /** 서버에 닿지 못했다 (권한·설치 문제와 구분) */
  offline?: boolean;
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
    if (bad?.error) return { ok: false, reason: explain(bad.error), offline: isNetworkError(bad.error) };

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
        autoRules: (st?.auto_rules ?? undefined) as Record<string, boolean | number> | undefined,
        consultantScope: (st?.consultant_scope ?? "all") as "all" | "own",
      },
    };
  } catch (e) {
    return { ok: false, offline: isNetworkError(e), reason: isNetworkError(e) ? "서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요." : e instanceof Error ? e.message : "서버에서 데이터를 가져오지 못했습니다." };
  }
}

/* ------------------------------ 밀어넣기 -------------------------------- */

type WithId = { id: string };

/**
 * insert: 새 행 — "추가, 이미 있으면 건너뛰기"
 * update: 이미 있던 행 — 바뀐 칸만 보낸다
 *
 * 왜 덮어쓰기(upsert) 한 번으로 보내지 않는가: 서버는 덮어쓰기에 "추가 권한 + 새 행을 읽을 권한"까지
 * 요구한다. 고객은 자료요청을 "제출함"으로 바꿀 수는 있어도 추가할 권한은 없고, 담당자는
 * 고객용 알림을 보낼 수는 있어도 읽을 권한은 없다 — 그래서 덮어쓰기는 거절됐다.
 * 바뀐 칸만 보내면 두 사람이 같은 행의 다른 칸을 고쳐도 서로 덮지 않는다.
 */
interface Change { key: Key; insert: Record<string, unknown>[]; update: { id: string; patch: Record<string, unknown> }[]; remove: string[] }

/** 지금 로그인한 사람 — 무엇을 서버에 쓸 수 있는지가 역할로 갈린다 */
interface Who { role?: string; userId?: string }

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

/**
 * 이 사람이 서버에 직접 쓸 수 있는 행인가.
 *
 * 한 번에 여러 행을 보내면 그중 한 줄이라도 권한에 걸릴 때 전부 거절된다.
 * 그래서 권한 밖의 행은 처음부터 빼고 보낸다. 빠진 것은 서버가 만든다 —
 * 고객 행동의 자동 후속(검토 업무·접수 알림·단계 변경·자동 기록)은 setup.sql 의 트리거가 맡는다.
 * 규칙은 setup.sql 2부의 정책과 같다. 정책을 바꾸면 여기도 같이 본다.
 */
export function writable(key: Key, row: Record<string, unknown>, isNew: boolean, who: Who): boolean {
  if (key === "activities") {
    // 내가 한 일은 내 이름으로. 작성자 없는 자동 기록(system)은 내부 계정만.
    const actor = String(row.actorId ?? "");
    if (actor && actor === who.userId) return true;
    if (who.role === "client") return false;
    return !UUID_LIKE.test(actor); // 다른 사람 이름으로는 남기지 않는다
  }
  if (who.role !== "client") return true;
  switch (key) {
    case "docRequests":   return !isNew;                       // 제출 표시(상태 변경)만
    case "inquiries":     return isNew;                        // 새 문의만 (답장 후 상태는 서버가 바꾼다)
    case "opportunities": return isNew;                        // 상담요청·관심 표시만
    case "quotes":        return !isNew;                       // 수락·보류 회신만
    case "notifications": return isNew ? row.audience === "internal" : row.audience === "client"; // 담당자 알림 보내기 · 내 알림 읽음
    case "surveys":       return isNew;
    default:              return false;                        // 업무·프로젝트 등 내부 자료
  }
}

/** 두 행(서버 모양)에서 값이 달라진 칸만 */
function changedColumns(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b)) if (JSON.stringify(a[k]) !== JSON.stringify(v)) out[k] = v;
  return out;
}

/** 이전 상태와 새 상태를 비교해 달라진 행만 고른다 */
function diff(prev: Partial<StoreState>, next: Partial<StoreState>): Change[] {
  const out: Change[] = [];
  const who: Who = { role: next.session?.role, userId: next.session?.userId };
  for (const key of ORDER) {
    const a = prev[key] as WithId[] | undefined;
    const b = next[key] as WithId[] | undefined;
    if (!b || a === b) continue;                  // 참조가 같으면 손댄 적 없다
    const before = new Map((a ?? []).map((x) => [x.id, x]));
    const insert: Record<string, unknown>[] = [];
    const update: Change["update"] = [];
    for (const row of b) {
      const old = before.get(row.id);
      if (!writable(key, row as unknown as Record<string, unknown>, !old, who)) { before.delete(row.id); continue; }
      if (!old) insert.push(SPEC[key].toRow(row as never));
      else if (!SPEC[key].appendOnly && JSON.stringify(old) !== JSON.stringify(row)) {
        const patch = changedColumns(SPEC[key].toRow(old as never), SPEC[key].toRow(row as never));
        // 값을 지운 칸(있다가 undefined 가 된 것)은 toRow 가 건너뛴다 → 서버에 옛 값이 남아 새로고침하면 되살아났다.
        // 지운 칸만 따로 null 로 보낸다.
        const cleared: Record<string, null> = {};
        for (const [k, v] of Object.entries(old)) if (v !== undefined && (row as unknown as Record<string, unknown>)[k] === undefined) cleared[k] = null;
        if (Object.keys(cleared).length) Object.assign(patch, SPEC[key].toRow(cleared as never));
        delete patch.id;
        if (Object.keys(patch).length) update.push({ id: row.id, patch });
      }
      before.delete(row.id);
    }
    // 고객 계정은 아무것도 지우지 않는다 (정책상 지울 수 있는 표가 없다)
    const remove = SPEC[key].deletable && who.role !== "client" ? [...before.keys()] : [];
    if (insert.length || update.length || remove.length) out.push({ key, insert, update, remove });
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
        uploaded_at: f.uploadedAt, uploaded_by: M.personId(f.uploadedBy), version: f.version,
        storage_path: f.storagePath ?? null,
      });
    }
  }
  const pi = new Map((prev.inquiries ?? []).map((i) => [i.id, i]));
  for (const i of next.inquiries ?? []) {
    const known = new Set((pi.get(i.id)?.messages ?? []).map((m) => m.id));
    for (const m of i.messages) if (!known.has(m.id)) {
      msgs.push({
        id: m.id, inquiry_id: i.id, author_id: M.personId(m.authorId),
        author_role: m.authorRole, body: m.body, created_at: m.createdAt,
      });
    }
  }
  return { files, msgs };
}

let queue: Promise<void> = Promise.resolve();
let onError: ((msg: string) => void) | null = null;
let pending = 0;
let seq = 0;

export const setSyncErrorHandler = (fn: (msg: string) => void) => { onError = fn; };
export const pendingWrites = () => pending;
/** 보낸 변경의 누적 번호 — 다시 읽어오는 동안 내가 뭔가 바꿨는지 알아보는 데 쓴다 */
export const writeSeq = () => seq;

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
  seq += 1;
  queue = queue.then(() => flush(sb, changes, nested)).finally(() => { pending -= 1; });
}

/**
 * 새 행 추가. 그냥 insert 로 보낸다.
 * "있으면 건너뛰기(on conflict)"를 붙이면 서버가 "쓴 사람이 그 행을 읽을 수 있는가"까지 검사한다 —
 * 컨설턴트가 보내는 고객용 알림, 고객이 보내는 담당자 알림은 쓸 수는 있어도 읽을 수 없어서 거절됐다.
 * 이미 있는 행 때문에 묶음 전체가 실패하면(같은 변경이 두 번 간 경우) 한 줄씩 다시 보내고 중복은 넘긴다.
 */
async function insertRows(sb: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  const { error } = await sb.from(table).insert(rows);
  if (!error) return null;
  if (error.code !== "23505") return error;
  if (rows.length === 1) return null;
  let last: typeof error | null = null;
  for (const r of rows) {
    const { error: e } = await sb.from(table).insert(r);
    if (e && e.code !== "23505") last = e;
  }
  return last;
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
    const table = SPEC[c.key].table;
    if (c.insert.length) {
      const error = await insertRows(sb, table, c.insert);
      if (error) fail(table, error);
    }
    // 바뀐 칸이 같은 행끼리 묶어 한 번에 (예: 알림 모두 읽음)
    const groups = new Map<string, { patch: Record<string, unknown>; ids: string[] }>();
    for (const u of c.update) {
      const k = JSON.stringify(u.patch);
      (groups.get(k) ?? groups.set(k, { patch: u.patch, ids: [] }).get(k)!).ids.push(u.id);
    }
    for (const g of groups.values()) {
      const { error } = await sb.from(table).update(g.patch).in("id", g.ids);
      if (error) fail(table, error);
    }
  }
  // 2) 접혀 있던 자식들
  if (nested.files.length) {
    const error = await insertRows(sb, "document_files", nested.files);
    if (error) fail("제출 파일", error);
  }
  if (nested.msgs.length) {
    const error = await insertRows(sb, "inquiry_messages", nested.msgs);
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
