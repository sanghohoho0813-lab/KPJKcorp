#!/usr/bin/env bash
# 로컬 Postgres 에 시험 DB(kpjk_video)를 새로 만들고 stub → setup.sql → server-loop.sql 을 실행해 결과 줄만 출력한다.
set -eu
DB=kpjk_video
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP="$(mktemp -d)"
cp "$ROOT/supabase/test/000_supabase_stub.sql" "$ROOT/supabase/setup.sql" "$(dirname "$0")/server-loop.sql" "$TMP/" && chmod -R a+rX "$TMP"
run() { if [ "$(id -un)" = postgres ]; then psql "$@"; else su postgres -c "psql $(printf '%q ' "$@")"; fi; }
run -q -c "drop database if exists $DB" -c "create database $DB" >/dev/null
run -q -d $DB -f "$TMP/000_supabase_stub.sql" >/dev/null 2>&1 || true
run -q -v ON_ERROR_STOP=1 -d $DB -f "$TMP/setup.sql" >/dev/null 2>"$TMP/err" || { cat "$TMP/err"; exit 1; }
run -q -v ON_ERROR_STOP=1 -d $DB -f "$TMP/server-loop.sql" 2>&1 | grep -E "^[A-Z0-9]+\|" 
rm -rf "$TMP"
