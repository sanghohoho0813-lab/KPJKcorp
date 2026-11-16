#!/usr/bin/env node
/**
 * LossGuard 시연 서버 — 이 컴퓨터(127.0.0.1)에서만 열리는 정적 파일 서버.
 *  · 분석은 브라우저 안에서 한다. 올린 파일은 이 서버로도, 외부 서버 · AI API 로도 보내지 않는다.
 *  · 서버는 화면 파일 3개(index.html · app.js · app.css)만 GET 으로 내준다. 그 밖의 요청 · 방법은 거절한다.
 *  · 브라우저에는 외부 연결을 막는 보안 정책(CSP: connect-src 'none' 등)을 함께 보낸다.
 *
 * 실행:  node lossguard/demo/serve.mjs            → http://127.0.0.1:4310
 *        PORT=4400 node lossguard/demo/serve.mjs
 *        node lossguard/demo/serve.mjs --build-only <폴더>   (화면 파일만 만들기 — 시험용)
 * 처음 한 번 esbuild(화면 묶기 도구, 버전 고정)를 npx 로 내려받는다. 저장소의 package.json 은 바꾸지 않는다.
 */
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");
const ESBUILD = "esbuild@0.25.10";

export function build(outDir) {
  const r = spawnSync("npx", ["-y", ESBUILD, join(here, "src", "main.tsx"),
    "--bundle", "--format=esm", "--target=es2020", "--jsx=automatic", "--minify", "--legal-comments=none",
    `--outfile=${join(outDir, "app.js")}`,
    "--loader:.xlsx=binary", "--loader:.xls=binary", "--loader:.csv=binary",
    "--define:process.env.NODE_ENV=\"production\"", "--log-level=warning"], { cwd: repo, stdio: "inherit" });
  if (r.status !== 0) throw new Error("화면 파일을 만들지 못했습니다(esbuild).");
  return outDir;
}

const CSP = [
  "default-src 'none'", "script-src 'self'", "style-src 'self'", "img-src 'self' data: blob:", "font-src 'self'",
  "connect-src 'none'", "form-action 'none'", "frame-ancestors 'none'", "base-uri 'none'", "worker-src 'none'", "manifest-src 'none'",
].join("; ");
const HEADERS = {
  "Content-Security-Policy": CSP,
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cache-Control": "no-store",
};

const args = process.argv.slice(2);
if (args[0] === "--build-only") {
  const dir = resolve(args[1] ?? mkdtempSync(join(tmpdir(), "lossguard-demo-")));
  build(dir);
  console.log(dir);
} else {
  const dir = build(mkdtempSync(join(tmpdir(), "lossguard-demo-")));
  const files = {
    "/": ["text/html; charset=utf-8", readFileSync(join(here, "index.html"))],
    "/index.html": ["text/html; charset=utf-8", readFileSync(join(here, "index.html"))],
    "/app.js": ["text/javascript; charset=utf-8", readFileSync(join(dir, "app.js"))],
    "/app.css": ["text/css; charset=utf-8", existsSync(join(dir, "app.css")) ? readFileSync(join(dir, "app.css")) : Buffer.from("")],
  };
  const port = Number(process.env.PORT || 4310);
  createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { ...HEADERS, Allow: "GET, HEAD" }); res.end(); return; }
    const path = (req.url ?? "/").split("?")[0];
    const f = files[path];
    if (!f) { res.writeHead(404, HEADERS); res.end(); return; }
    res.writeHead(200, { ...HEADERS, "Content-Type": f[0], "Content-Length": f[1].length });
    res.end(req.method === "HEAD" ? undefined : f[1]);
  }).listen(port, "127.0.0.1", () => {
    console.log(`LossGuard 시연: http://127.0.0.1:${port}  (이 컴퓨터에서만 열림 · 파일은 브라우저 안에서만 분석 · 끝내려면 Ctrl+C)`);
  });
}
