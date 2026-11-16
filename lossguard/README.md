# lossguard/ — 계약 · 변경 · 원가 · 정산 불일치 탐지 엔진 (프로토타입)

기획: [`../LOSSGUARD_SPEC.md`](../LOSSGUARD_SPEC.md) · 실증 준비: [`../LOSSGUARD_PILOT_KIT.md`](../LOSSGUARD_PILOT_KIT.md) · 개발 증빙: [`../LOSSGUARD_DEV_RECORD.md`](../LOSSGUARD_DEV_RECORD.md) · 권리자: 결정 전([`NOTICE`](NOTICE))

> **상태**: 작업 브랜치의 프로토타입. 기존 KPJK AX(`src/`) · 운영 DB · 인증과 연결되지 않는다(서로 불러오지 않음 — `test/boundary.test.ts`).
> **측정값은 모두 합성(가상) 자료로 잰 것**이며 실제 현장 자료의 성능이 아니다.

## 구조

| 폴더 | 내용 | 규칙 |
|---|---|---|
| `engine/` | 순수 계산 — 파일 읽기(.xlsx · .xls · CSV · HTML 표, 내용으로 판별 — `io/read.ts`) · 개인정보 검사/제거(`privacy/`) · 표 구조 인식 · 정규화 · 문서 간 항목 정합 · D01~D03 탐지 · 근거 · 지문. 입구는 `readWorkbook()` · `analyze()` | AX · 업종 묶음 · Node 모듈을 불러오지 않는다(브라우저 · 서버 공용). 업종 낱말을 쓰지 않는다 |
| `packs/construction-interior/` | 업종 규칙 묶음 1호(머리글 별칭 · 단위 · 같은 뜻 낱말 · 합계 낱말 · 문턱) | 새 업종 = 묶음 하나 추가 |
| `synth/` | 합성 현장 생성기(가상 품목 · 양식 8종 · 이름 바꿔 적기 · 오류 주입 · xlsx 쓰기 · 정답) | 실제 기업 자료 없음 |
| `eval/` | 평가 도구 — `run.ts`(기준선 대비 · 빼고 돌리기 · 재현성 · 근거 · 자기 검증 · 처리 시간) · `stress.ts`(과적합 점검 · 놓친 연결 원인 · 최소 사전) · `formats.ts`(파일 형식 견고성), `results/` 에 실행 기록(`results/INDEX.md`) | 결과는 실행 시각 · 엔진 판 · 커밋과 함께 저장 |
| `test/` | 자동 시험(170항목) | `fixtures/` 는 합성 파일을 LibreOffice 로 xlsx · xls · HTML 로 바꾼 것과 CP949 CSV |
| `cli/analyze.ts` · `cli/sanitize.ts` | 실제 자료 점검(분석 전 개인정보 검사 · 메모리에서 지움) · 개인정보를 지운 사본 만들기 | 결과 기본 위치 `private/`(커밋 제외) |

## 실행

```bash
bash lossguard/run-tests.sh                 # 자동 시험
npx tsx lossguard/eval/run.ts               # 평가(개발용 40 · 평가용 40 현장) → lossguard/eval/results/
npx tsx lossguard/eval/run.ts --quick       # 빠른 평가(10 · 10)
npx tsx lossguard/eval/stress.ts            # 과적합 점검(스트레스 세트 8종 × 30 현장)
npx tsx lossguard/eval/formats.ts           # 파일 형식 견고성(soffice · iconv 필요)
npx tsx lossguard/cli/sanitize.ts /경로/받은파일.xls …                              # 개인정보 검사 · 지운 사본(결과는 private/)
npx tsx lossguard/cli/analyze.ts --doc contract=/경로/계약.xls --amount 125000000   # 실제 자료 점검(결과는 private/)
npx tsx lossguard/test/fixtures/make-fixtures.ts   # 시험 파일 다시 만들기(soffice · iconv 필요)
```

## 지원 범위(이번 판)

- 읽기: `.xlsx` · `.xls`(Excel 97~2003) — 병합 · 숨긴 행/열/시트 · 공유 문자열 · 수식의 저장된 값. CSV/TSV(UTF-8 · CP949 · UTF-16) · HTML 표(보이는 값만 — 반올림 폭만큼 검산 여유). 암호 파일 · PDF · 한글 · 워드 · Excel 2003 XML 은 이유와 함께 거절.
- 개인정보: 주민 · 외국인등록번호 · 카드번호는 분석을 멈춤, 휴대전화 · 이메일 · 계좌 · 이름은 분석 전 지움/가명, 회사 전화 · 사업자번호는 알림. 자유 글 속 이름은 못 찾는다(`LOSSGUARD_SPEC.md` §K-4).
- 탐지: D01 줄 계산 · D02 합계(시트 안 · 요약 ↔ 세부 · 계약금액 · 표지) · D03 변경(증감 · 변경 금액 · 변경 전 ↔ 계약). D04 · D05 는 기술구조 · 가설만 정리했고 구현하지 않았다(`LOSSGUARD_SPEC.md` §K-5).
- 알려진 한계: 수량 열과 단가 열이 서로 바뀌어도 곱이 같아 산술로는 구분하지 못한다(이름 · 위치 · 크기로 정함). 사전에 없고 글자도 많이 다른 이름(예: "포세린 타일" ↔ "자기질 타일")은 대부분 연결하지 못한다.
