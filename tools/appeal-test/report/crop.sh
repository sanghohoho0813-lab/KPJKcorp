#!/usr/bin/env bash
# 보고서에 넣는 화면 자르기 — 화면 흐름 시험 원본(flow/screens)에서 필요한 부분만 잘라 낸다(내용은 바꾸지 않음).
#   bash tools/appeal-test/report/crop.sh <증빙 폴더> <잘라 둘 폴더>
set -euo pipefail
SRC="$1/flow/screens"; DST="$2"; mkdir -p "$DST"
c() { ffmpeg -y -hide_banner -loglevel error -i "$SRC/$1" -vf "crop=$3" "$DST/$2"; }
c 02_phone_submitted.png 02_phone_submitted.png 780:800:0:700   # 고객 휴대폰: 제출 후 상태
c 05_phone_revision.png  05_phone_revision.png  780:800:0:700   # 고객 휴대폰: 보완필요 · 사유
c 07_phone_done.png      07_phone_done.png      780:800:0:700   # 고객 휴대폰: 확인완료
c 09_phone_progress.png  09_phone_progress.png  780:800:0:150   # 고객 휴대폰: 진행현황 4단계
c 03_pc_tasks.png        pc_tasks_crop.png      2140:335:670:652 # 담당자 PC: 자동 생성 업무 목록
c 04_pc_revision.png     pc_revision.png        1350:920:760:730 # 담당자 PC: 보완 요청
c 06_pc_history.png      pc_history.png         1200:860:690:740 # 담당자 PC: 기업 이력
cp "$SRC/03b_pc_task_row.png" "$DST/pc_task_row.png"             # 담당자 PC: 업무 한 줄(원본 그대로)
ls "$DST"
