#!/bin/bash
# 로컬 Supabase (Docker) — 실제 Supabase 와 같은 인증·DB·권한·파일 보관함을 이 PC 에 띄운다.
# README 1단계(대표 계정 → setup.sql)를 그대로 따른다. 실제 고객 데이터는 넣지 않는다.
#   ./local-supabase.sh start   : 띄우고 대표 계정 + setup.sql, .env.local 작성
#   ./local-supabase.sh reset   : 데이터 비우고 대표 계정 + setup.sql 부터 다시
#   ./local-supabase.sh stop
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${PILOT_WORK:-/var/tmp/kpjk-local-supabase}"
DBURL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
CEO_ID="${PILOT_CEO_ID:-ceo@pilot.test}"
CEO_PW="${PILOT_CEO_PW:-PilotCeo!2026}"
mkdir -p "$WORK" && cd "$WORK"
[ -f supabase/config.toml ] || (yes n | npx -y supabase@latest init --force >/dev/null)
status() { npx -y supabase@latest status -o json 2>/dev/null; }
key() { status | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[process.argv[1]]))' "$1"; }
bootstrap() {
  SR=$(key SERVICE_ROLE_KEY)   # 이 PC 안에서만 쓴다. 앱(.env.local)에는 절대 넣지 않는다.
  curl -sS -o /dev/null -X POST http://127.0.0.1:54321/auth/v1/admin/users -H "apikey: $SR" -H "Authorization: Bearer $SR" \
    -H "Content-Type: application/json" -d "{\"email\":\"$CEO_ID\",\"password\":\"$CEO_PW\",\"email_confirm\":true}"
  psql "$DBURL" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/setup.sql" 2>&1 | grep -v NOTICE | grep "^ *[0-9]" || true
}
case "$1" in
  start)
    npx -y supabase@latest start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,supavisor,mailpit,postgres-meta >/dev/null
    bootstrap
    # 실제 서버용 .env.local 을 덮지 않는다
    if [ -f "$ROOT/.env.local" ] && ! grep -q "127.0.0.1:54321" "$ROOT/.env.local"; then
      echo "기존 .env.local 이 실제 서버를 가리킵니다. 덮지 않습니다. 로컬로 시험하려면 그 파일을 다른 이름으로 옮긴 뒤 다시 실행하세요."; exit 1
    fi
    printf "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nNEXT_PUBLIC_SUPABASE_ANON_KEY=%s\n" "$(key ANON_KEY)" > "$ROOT/.env.local"
    echo ".env.local 작성 — 앱을 다시 빌드하세요 (npm run build && npm start)";;
  reset)
    psql "$DBURL" -q -c "drop schema if exists public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role; grant all on schema public to postgres, service_role; delete from auth.users;" 2>&1 | grep -v NOTICE | grep -v "^DETAIL\|^drop cascades" || true
    bootstrap;;
  stop) npx -y supabase@latest stop;;
  *) echo "사용: $0 start|reset|stop"; exit 1;;
esac
