#!/usr/bin/env bash
# 기술시험(서버 규칙) 실행기 — 시험용 데이터베이스 kpjk_appeal 을 새로 만들고
# 000_supabase_stub.sql → supabase/setup.sql(운영과 같은 파일) → server-tests.sql 순서로 올린다.
#   bash tools/appeal-test/run-server-tests.sh [로그 파일]
# 운영 Supabase 에는 접속하지 않는다. 실패가 하나라도 있으면 종료 코드 1.
set -u
DB=kpjk_appeal
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
LOG="${1:-/dev/stdout}"
TMP="$(mktemp -d)"
cp "$ROOT/supabase/test/000_supabase_stub.sql" "$ROOT/supabase/setup.sql" "$HERE/server-tests.sql" "$TMP/" && chmod -R a+rX "$TMP"
run() { if [ "$(id -un)" = postgres ]; then psql "$@"; else su postgres -c "psql $(printf '%q ' "$@")"; fi; }
run -qtAc "select 1" >/dev/null 2>&1 || { echo "로컬 Postgres 가 꺼져 있습니다 (예: pg_ctlcluster 16 main start)"; exit 1; }
{
  echo "# 기술시험(서버 규칙) — 로컬 PostgreSQL · 운영과 같은 supabase/setup.sql · 가상 기업 · 시험 계정"
  echo "# 시작 $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S KST') · 커밋 $(git -C "$ROOT" rev-parse HEAD) · $(run -qtAc 'select version()' | head -1)"
  echo "# setup.sql sha256 $(sha256sum "$ROOT/supabase/setup.sql" | cut -c1-16) · server-tests.sql sha256 $(sha256sum "$HERE/server-tests.sql" | cut -c1-16)"
} > "$LOG"
run -q -c "drop database if exists $DB" -c "create database $DB" >/dev/null || exit 1
run -q -d $DB -f "$TMP/000_supabase_stub.sql" 2>&1 | grep -v "already exists" | grep -i error && exit 1
run -q -v ON_ERROR_STOP=1 -d $DB -f "$TMP/setup.sql" >/dev/null 2>"$TMP/setup.err" || { cat "$TMP/setup.err"; exit 1; }
run -X -q -d $DB -f "$TMP/server-tests.sql" 2>&1 | grep -v "^$" >> "$LOG"   # 확인 함수(void)가 찍는 빈 줄은 뺀다
echo "# 끝 $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S KST')" >> "$LOG"
rm -rf "$TMP"
grep -q "ERROR" "$LOG" && { grep "ERROR" "$LOG" | head -5; exit 1; }
grep -q "^TOTAL|[0-9]*|0$" "$LOG"
