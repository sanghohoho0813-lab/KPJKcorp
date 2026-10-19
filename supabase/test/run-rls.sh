#!/usr/bin/env bash
# 권한(RLS) 시험을 로컬 Postgres 에서 한 번에 — 시험용 데이터베이스를 새로 만들고
# 000_supabase_stub.sql → setup.sql → 010_rls_test.sql 순서로 올린 뒤 결과를 센다. 실패가 있으면 종료 코드 1.
#   bash supabase/test/run-rls.sh          (postgres 사용자로 psql 을 쓸 수 있어야 한다)
# 실제 Supabase 와 운영 데이터에는 손대지 않는다 — 로컬의 kpjk_rls 데이터베이스만 지우고 다시 만든다.
set -u
DB=kpjk_rls
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
cp "$DIR/000_supabase_stub.sql" "$DIR/../setup.sql" "$DIR/010_rls_test.sql" "$TMP/" && chmod -R a+rX "$TMP"
run() { if [ "$(id -un)" = postgres ]; then psql "$@"; else su postgres -c "psql $(printf '%q ' "$@")"; fi; }
run -qtAc "select 1" >/dev/null 2>&1 || { echo "로컬 Postgres 가 꺼져 있습니다 — 켜고 다시 실행하세요 (예: pg_ctlcluster 16 main start)"; exit 1; }
run -q -c "drop database if exists $DB" -c "create database $DB" >/dev/null || exit 1
# 역할(anon · authenticated)은 서버 전체에 남아 있어 두 번째부터 "이미 있음"이 난다 — 그 줄만 넘긴다
run -q -d $DB -f "$TMP/000_supabase_stub.sql" 2>&1 | grep -v "already exists" | grep -i error && exit 1
run -q -v ON_ERROR_STOP=1 -d $DB -f "$TMP/setup.sql" >/dev/null 2>"$TMP/setup.err" || { cat "$TMP/setup.err"; exit 1; }
OUT="$(run -d $DB -f "$TMP/010_rls_test.sql" 2>&1)"
echo "$OUT" | grep -E "^ *[0-9]+ \| 실패" || true
echo "$OUT" | grep -E "ERROR" | head -5
LINE="$(echo "$OUT" | grep -E '^ *[0-9]+ \| *[0-9]+ *$' | tail -1)"
echo "통과 | 실패 → $LINE"
FAIL="$(echo "$LINE" | awk -F'|' '{gsub(/ /,"",$2); print $2}')"
[ -n "$LINE" ] || FAIL=1
rm -rf "$TMP"
[ "$FAIL" = "0" ] && ! echo "$OUT" | grep -q ERROR
