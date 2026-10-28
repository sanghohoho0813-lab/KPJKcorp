// 예전 서버(새 표가 아직 없는 곳)에서도 로그인 · 불러오기가 막히지 않는가 — 대표님이 최신 setup.sql 을 다시 돌리기 전 상황.
// PostgREST 를 흉내 내는 작은 서버: 새 표(learn_contents · self_runs)만 "표 없음(PGRST205)", 나머지는 빈 목록.
import http from "node:http";

async function main() {
  let fail = 0;
  const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };

  const NEW = ["learn_contents", "self_runs"];
  let mode: "missing" | "broken" = "missing";
  const server = http.createServer((req, res) => {
    const table = (req.url ?? "").split("?")[0].replace(/^\/rest\/v1\//, "");
    if (NEW.includes(table) || (mode === "broken" && table === "projects")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify(mode === "broken" && table === "projects"
        ? { code: "PGRST205", message: "Could not find the table 'public.projects' in the schema cache" }
        : { code: "PGRST205", message: `Could not find the table 'public.${table}' in the schema cache` }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json", "content-range": "*/0" });
    res.end(req.method === "HEAD" ? "" : "[]");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as { port: number }).port;
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

  const { loadAll } = await import("../../src/lib/server/sync");
  const { explain } = await import("../../src/lib/server/client");

  const r = await loadAll({ userId: "u1" });
  ok(r.ok, "새 표가 없어도 불러오기 성공(로그인이 막히지 않음)" + (r.ok ? "" : ` — ${r.reason}`));
  ok(JSON.stringify(r.missing?.sort()) === JSON.stringify(["learn_contents", "self_runs"]), "무엇이 없는지 알려 준다: " + (r.missing ?? []).join(","));
  ok(Array.isArray(r.data?.learnContents) && r.data!.learnContents!.length === 0 && Array.isArray(r.data?.selfRuns) && r.data!.selfRuns!.length === 0, "없는 표는 빈 목록");
  const rc = await loadAll({ userId: "u2", client: true });
  ok(rc.ok && rc.missing?.length === 2, "고객 계정도 같다");
  mode = "broken";
  const rb = await loadAll({ userId: "u3" });
  ok(!rb.ok, "원래 있어야 하는 표가 없으면 예전처럼 막고 알린다(빠뜨린 설치를 숨기지 않음)");
  ok(/setup\.sql/.test(explain({ code: "PGRST205", message: "Could not find the table 'public.x'" })), "표 없음 오류 안내: setup.sql 다시 실행");

  server.close();
  console.log(fail ? `\n${fail} FAIL` : "\nALL OK");
  process.exit(fail ? 1 : 0);
}
void main();
