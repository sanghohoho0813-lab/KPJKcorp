# 단위 시험 (브라우저 없이)

화면을 띄우지 않고 규칙만 확인하는 시험입니다. 각 파일이 스스로 OK/FAIL 을 찍고, 하나라도 실패하면 종료 코드 1.

```bash
for f in tools/test/*.test.ts; do npx tsx "$f" || echo "FAIL: $f"; done
```

| 파일 | 확인하는 것 |
|---|---|
| `xlsx.test.ts` | 엑셀 쓰기→읽기 왕복, 특수문자·줄바꿈, CSV 따옴표, EUC-KR(한국어 엑셀 CSV), 날짜 일련번호 |
| `company-import.test.ts` | 머리글 별칭 인식, 제목 줄 건너뛰기, 검사 규칙, 기존·파일 내 중복, 날짜·인원 해석 |
| `evidence-filter.test.ts` | 실증 기록 기간 경계·분류·행위자·기업·다중 검색어, 규칙 기준일 저장값 방어 |
| `server-health.test.ts` | 서버 연결 점검 9가지 상황(정상·service_role 키·주소·401·오프라인·미로그인·옛 SQL·역할 없음·보관함 없음) |

서버 권한(RLS)·열 이름 시험은 `supabase/test/` 에 있습니다.
