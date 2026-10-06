# 완료·검수 기준 자동 검수 · 최종검수 요청서

계약서 별지 제1호 「완료·검수 기준」을 실제 화면에서 눌러 확인하고, 그 결과만으로 최종검수 요청서(계약 제12조③)를 만듭니다.

| 파일 | 하는 일 |
|---|---|
| `daily.mjs` | 매일 쓰는 흐름 41항목 — 대시보드 한 줄 업무 등록·완료·되돌리기, 업무함 검색·기한 묶음·보류, 기업 상세 '지금 할 일'·빠른 작업, 중복 기업 등록 막기, 휴대폰 |
| `run.mjs` | PC(1440px)·휴대폰(390px) 각각 새 브라우저로 검수 항목 8개를 실행 → `out/results.json` + 화면 캡처 |
| `report.mjs` | `results.json` 과 캡처로 A4 PDF 작성 → `out/KPJK_AX_1차완료보고_최종검수요청_날짜.pdf` |

## 실행

```bash
npm run build && npm start          # 다른 터미널
node tools/acceptance/run.mjs       # 약 3분
node tools/acceptance/daily.mjs     # 약 1분
node tools/acceptance/report.mjs    # 약 10초
```

Playwright 가 없으면 `npm i --no-save playwright && npx playwright install chromium` (저장소 의존성에는 넣지 않습니다).
환경변수 `APP_URL`(기본 http://localhost:3000), `CHROME_PATH`, `OUT` 으로 경로를 바꿀 수 있습니다.

## 원칙

- 문서 속 통과 여부·숫자는 전부 `results.json` 에서 옵니다. 손으로 고치지 않습니다. 실패한 항목이 있으면 그대로 "미충족"으로 찍힙니다.
- 데모 모드(샘플 데이터)에서 돕니다. 실제 고객 데이터로 돌리지 마세요.
- `out/quality.json`(선택)에 회귀 시험·서버 권한 시험 결과를 넣으면 측정일과 함께 실립니다.
  `{ "measuredAt": "2026-09-29", "items": ["…", "…"] }`
- 보내기 직전에 다시 뽑으면 날짜와 캡처가 최신으로 바뀝니다. "시험버전 주소"와 "전달일" 칸은 비워 두었습니다 — 직접 적어 주세요.
