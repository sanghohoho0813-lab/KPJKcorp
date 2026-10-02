/**
 * 서버(Supabase) 연결 점검.
 *
 * 연결 첫날 막히는 곳은 거의 정해져 있다: 연결 정보 오타, 잘못된 키(특히 service_role),
 * setup.sql 을 안 돌렸거나 옛 버전을 돌린 것, 대표 계정 연결 누락, 파일 보관함 누락.
 * 설정 화면의 버튼 한 번으로 이것들을 순서대로 확인하고, 막힌 곳마다 "무엇을 하면 되는지"를 한 줄로 알려 준다.
 *
 * 읽기만 한다. 아무것도 만들거나 고치지 않는다.
 */

export type CheckStatus = "ok" | "warn" | "fail" | "skip";
export interface CheckItem {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** 막혔을 때 할 일 */
  fix?: string;
}

/** setup.sql 이 만드는 표 — 하나라도 없으면 SQL 을 다시 돌려야 한다 */
export const EXPECTED_TABLES = [
  "profiles", "companies", "projects", "consultations", "contracts", "document_requests", "document_files", "schedules", "notices", "tasks",
  "inquiries", "inquiry_messages", "results", "opportunities", "quotes", "approvals", "activities", "notifications", "surveys", "app_settings",
  "company_vaults", "company_files", "journal_entries", "payments", "support_programs", "leads",
] as const;
export const EXPECTED_BUCKETS = ["documents", "results", "vault"] as const;

const RERUN = "Supabase → SQL Editor 에서 최신 setup.sql 을 전체 선택(Ctrl+A) 후 붙여넣어 다시 실행하세요. 여러 번 실행해도 데이터는 지워지지 않습니다.";

/** 점검에 필요한 만큼만 — 테스트에서 가짜로 바꿔 끼울 수 있게 */
type Err = { code?: string; message?: string } | null;
export interface HealthClient {
  auth: { getSession(): Promise<{ data: { session: { user: { id: string; email?: string } } | null } }> };
  from(table: string): { select(cols: string, opts?: { count?: "exact" }): { limit(n: number): PromiseLike<{ error: Err; count?: number | null }> } };
  rpc(fn: string): PromiseLike<{ data: unknown; error: Err }>;
  storage: { from(bucket: string): { list(path?: string, opts?: { limit?: number }): Promise<{ error: Err }> } };
}

export interface HealthInput {
  url?: string;
  key?: string;
  client: HealthClient | null;
  fetcher?: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number }>;
}

/** JWT 가운데 조각에서 role 을 읽는다 (서명 검증 아님 — "무슨 키를 넣었나" 확인용) */
export function keyRole(key: string): string | undefined {
  if (key.startsWith("sb_secret_")) return "service_role";
  if (key.startsWith("sb_publishable_")) return "anon";
  const part = key.split(".")[1];
  if (!part) return undefined;
  try {
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")));
    return typeof json.role === "string" ? json.role : undefined;
  } catch {
    return undefined;
  }
}

const missingTable = (e: Err) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|Could not find the table/i.test(e.message ?? ""));
const missingColumn = (e: Err) => !!e && (e.code === "42703" || e.code === "PGRST204" || /column .* does not exist/i.test(e.message ?? ""));

export async function runServerCheck(input: HealthInput): Promise<CheckItem[]> {
  const out: CheckItem[] = [];
  const { url, key, client } = input;

  // 1) 연결 정보
  if (!url || !key) {
    out.push({
      key: "env", label: "연결 정보", status: "fail",
      detail: !url && !key ? "주소와 키가 모두 비어 있습니다. 지금은 이 브라우저에만 저장되는 데모 모드입니다." : !url ? "NEXT_PUBLIC_SUPABASE_URL 이 비어 있습니다." : "NEXT_PUBLIC_SUPABASE_ANON_KEY 가 비어 있습니다.",
      fix: "Supabase → Project Settings → API 의 Project URL 과 anon public 키를 .env.local(배포 시 호스팅 환경변수)에 넣고 앱을 다시 띄우세요. supabase/README.md 2단계.",
    });
    return out;
  }
  const urlOk = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(url) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url);
  const role = keyRole(key);
  if (role === "service_role") {
    out.push({
      key: "env", label: "연결 정보", status: "fail",
      detail: "service_role(비밀) 키가 들어 있습니다. 이 키는 모든 권한 검사를 통과하고, 브라우저로 그대로 나갑니다.",
      fix: "즉시 anon public 키로 바꾸고, Supabase → Project Settings → API 에서 service_role 키를 재발급(Reset)하세요.",
    });
    return out;
  }
  out.push({
    key: "env", label: "연결 정보",
    status: urlOk && role === "anon" ? "ok" : "warn",
    detail: `${url.replace(/^https?:\/\//, "").replace(/\/$/, "")} · ${role === "anon" ? "anon 키" : "키 종류를 알 수 없음"}`,
    fix: !urlOk ? "주소는 https://프로젝트ID.supabase.co 꼴이어야 합니다. 끝에 /rest/v1 같은 경로를 붙이지 마세요." : role !== "anon" ? "Project Settings → API 의 'anon public' 키가 맞는지 확인하세요." : undefined,
  });

  // 2) 서버 응답
  const fetcher = input.fetcher ?? ((u: string, init?: RequestInit) => fetch(u, init));
  try {
    const r = await fetcher(`${url.replace(/\/$/, "")}/auth/v1/health`, { headers: { apikey: key } });
    if (r.ok) out.push({ key: "reach", label: "서버 응답", status: "ok", detail: "Supabase 서버가 응답합니다." });
    else {
      out.push({
        key: "reach", label: "서버 응답", status: "fail", detail: `서버가 ${r.status} 로 응답했습니다.`,
        fix: r.status === 401 || r.status === 403 ? "키가 이 프로젝트의 것이 아닙니다. 같은 프로젝트의 URL 과 anon 키를 짝으로 넣으세요." : "Supabase 대시보드에서 프로젝트가 일시정지(Paused) 상태인지 확인하세요. 무료 플랜은 1주일 미접속 시 멈춥니다.",
      });
      return out;
    }
  } catch {
    out.push({ key: "reach", label: "서버 응답", status: "fail", detail: "서버에 닿지 못했습니다.", fix: "인터넷 연결과 주소 오타를 확인하세요. 회사 방화벽이 supabase.co 를 막는 경우도 있습니다." });
    return out;
  }
  if (!client) return out;

  // 3) 로그인
  const { data } = await client.auth.getSession();
  const user = data.session?.user;
  if (!user) {
    out.push({ key: "session", label: "서버 로그인", status: "warn", detail: "서버 계정으로 로그인하지 않았습니다. 표·권한 점검은 로그인 뒤에 할 수 있습니다.", fix: "로그아웃 후 Supabase 에서 만든 대표 계정으로 다시 로그인하세요." });
    return out;
  }
  out.push({ key: "session", label: "서버 로그인", status: "ok", detail: `${user.email ?? user.id} 으로 로그인됨` });

  // 4) 표 — head(HEAD 요청)로 세면 안 된다: 없는 표의 404 가 본문 없이 와서 supabase-js 가 "성공"으로 돌려준다.
  //    GET 으로 한 줄만 받아 오류 본문(PGRST205 등)을 읽는다.
  const results = await Promise.all(EXPECTED_TABLES.map(async (t) => ({ t, r: await client.from(t).select("*", { count: "exact" }).limit(1) })));
  const missing = results.filter((x) => missingTable(x.r.error)).map((x) => x.t);
  const other = results.filter((x) => x.r.error && !missingTable(x.r.error));
  if (missing.length) {
    out.push({ key: "tables", label: `표 ${EXPECTED_TABLES.length}개`, status: "fail", detail: `없는 표 ${missing.length}개: ${missing.join(", ")}`, fix: RERUN });
  } else if (other.length) {
    out.push({ key: "tables", label: `표 ${EXPECTED_TABLES.length}개`, status: "warn", detail: `읽기 오류: ${other.map((x) => `${x.t}(${x.r.error?.code ?? x.r.error?.message})`).join(", ")}`, fix: RERUN });
  } else {
    const n = (t: string) => results.find((x) => x.t === t)?.r.count ?? 0;
    out.push({ key: "tables", label: `표 ${EXPECTED_TABLES.length}개`, status: "ok", detail: `모두 있음 · 기업 ${n("companies")} · 프로젝트 ${n("projects")} · 기록 ${n("activities")}건` });
  }

  // 5) 최신 설정 항목 (옛 setup.sql 을 돌린 경우 여기서 걸린다)
  if (!missing.includes("app_settings")) {
    const r = await client.from("app_settings").select("baseline_surveys, consultant_scope, auto_rules").limit(1);
    out.push(missingColumn(r.error)
      ? { key: "columns", label: "최신 설정 항목", status: "fail", detail: "회사 설정 표에 최근 추가된 칸(기준선 조사·열람 범위·자동 규칙)이 없습니다. 옛 setup.sql 로 설치된 상태입니다.", fix: RERUN }
      : r.error
        ? { key: "columns", label: "최신 설정 항목", status: "warn", detail: `확인하지 못했습니다 (${r.error.code ?? r.error.message})` }
        : { key: "columns", label: "최신 설정 항목", status: "ok", detail: "기준선 조사·열람 범위·자동 규칙 칸이 있습니다." });
  }

  // 6) 내 권한
  const roleRes = await client.rpc("kpjk_role");
  if (roleRes.error) {
    out.push({ key: "role", label: "권한 함수 · 내 역할", status: "fail", detail: "권한을 판단하는 함수가 없거나 호출할 수 없습니다.", fix: RERUN });
  } else if (!roleRes.data) {
    out.push({ key: "role", label: "권한 함수 · 내 역할", status: "fail", detail: "이 계정에 역할이 없습니다(대표 계정 연결 누락). 아무 데이터도 보이지 않는 상태입니다.", fix: "setup.sql 실행 결과의 '다음 할 일' 칸에 적힌 한 줄을 이 계정 이메일로 바꿔 실행하세요. README 1단계." });
  } else {
    const label = roleRes.data === "admin" ? "대표" : roleRes.data === "consultant" ? "컨설턴트" : roleRes.data === "staff" ? "사무직원" : roleRes.data === "client" ? "고객" : String(roleRes.data);
    out.push({ key: "role", label: "권한 함수 · 내 역할", status: "ok", detail: `${label} 권한으로 동작 중` });
  }

  // 7) 파일 보관함
  const buckets = await Promise.all(EXPECTED_BUCKETS.map(async (b) => ({ b, r: await client.storage.from(b).list("", { limit: 1 }) })));
  const noBucket = buckets.filter((x) => x.r.error && /not found|does not exist/i.test(x.r.error.message ?? "")).map((x) => x.b);
  const bucketErr = buckets.filter((x) => x.r.error && !noBucket.includes(x.b));
  out.push(noBucket.length
    ? { key: "buckets", label: `파일 보관함 ${EXPECTED_BUCKETS.length}개`, status: "fail", detail: `없는 보관함: ${noBucket.join(", ")} — ${noBucket.map((b) => (b === "documents" ? "고객이 요청자료를 올릴 수 없습니다" : b === "results" ? "결과물을 올릴 수 없습니다" : "기업 서류함에 파일을 둘 수 없습니다")).join(", ")}.`, fix: RERUN }
    : bucketErr.length
      ? { key: "buckets", label: `파일 보관함 ${EXPECTED_BUCKETS.length}개`, status: "warn", detail: `확인하지 못한 보관함: ${bucketErr.map((x) => x.b).join(", ")}` }
      : { key: "buckets", label: `파일 보관함 ${EXPECTED_BUCKETS.length}개`, status: "ok", detail: "자료(documents)·결과물(results)·서류함(vault) 보관함이 있습니다." });

  return out;
}

/** 점검 결과를 한 덩어리 글로 — 담당 개발자·지원 창구에 그대로 붙여 보낼 수 있게. 키 값은 넣지 않는다 */
export function checkReport(items: CheckItem[], at: Date) {
  const mark: Record<CheckStatus, string> = { ok: "정상", warn: "주의", fail: "막힘", skip: "건너뜀" };
  return [`[KPJK Business AX 서버 점검 · ${at.toLocaleString("ko-KR")}]`, ...items.map((i) => `- ${i.label}: ${mark[i.status]} — ${i.detail}${i.fix ? `\n  → ${i.fix}` : ""}`)].join("\n");
}
