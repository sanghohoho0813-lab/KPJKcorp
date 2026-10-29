# 기술시험 (벤처기업확인 이의신청 — 기술시험 및 개선결과보고서)

앱 코드는 건드리지 않고 시험만 하는 도구입니다. 실제 고객 정보 대신 가상 기업 · 시험 계정을 씁니다. 운영 서버에는 쓰지 않습니다.

| 파일 | 하는 일 |
|---|---|
| `server-tests.sql` · `run-server-tests.sh` | 로컬 PostgreSQL 에 운영과 같은 `supabase/setup.sql` 을 올리고 TEST 01~06 · 과거 결함 재현 · 처리시간(30회)을 확인 |
| `stage-map.test.ts` | TEST 05 — 내부 11단계 → 고객 4단계 변환 |
| `regress-cases.test.ts` | 과거 결함(빈 프로젝트 번호 · 1,000줄 잘림) 재발 확인 |
| `flow-screens.mjs` | 데모 모드 앱에서 고객 제출 → 자동 업무 → 보완 → 재제출 → 완료 → 고객 화면 흐름과 증빙 화면 |
| `report/collect.mjs` | 로그 → `results.json` (보고서 숫자는 모두 여기서 나옴) |
| `report/crop.sh` | 화면 원본에서 보고서용 부분만 자르기 |
| `report/content.mjs` · `report/build.mjs` | 보고서 내용 · PDF/Word 만들기 |

```bash
bash tools/appeal-test/run-server-tests.sh <증빙>/logs/05_server_tests.log
npx tsx tools/appeal-test/stage-map.test.ts
npx tsx tools/appeal-test/regress-cases.test.ts
OUT=<증빙>/flow node tools/appeal-test/flow-screens.mjs          # 앱을 데모 모드로 띄운 뒤
node tools/appeal-test/report/collect.mjs <증빙>
bash tools/appeal-test/report/crop.sh <증빙> <그림 폴더>
node tools/appeal-test/report/build.mjs <증빙> <그림 폴더> <출력 폴더> <Noto Sans KR 글꼴 폴더>
```

실행 로그 · 화면 · 보고서 파일은 저장소에 넣지 않습니다(증빙 폴더에 따로 보관).
