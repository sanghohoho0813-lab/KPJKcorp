#!/usr/bin/env bash
# LossGuard 자동 시험 — 파일마다 OK/FAIL 을 찍고, 하나라도 실패하면 종료 코드 1
# 실행: bash lossguard/run-tests.sh
cd "$(dirname "$0")/.." || exit 1
fail=0
for f in lossguard/test/*.test.ts; do
  echo "== $f"
  if ! npx tsx "$f"; then echo "FAIL: $f"; fail=1; fi
done
if [ "$fail" -eq 0 ]; then echo "== LossGuard 시험 모두 통과"; else echo "== LossGuard 시험 실패 있음"; fi
exit "$fail"
