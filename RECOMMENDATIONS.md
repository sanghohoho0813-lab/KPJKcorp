# RECOMMENDATIONS — P2 이상 선택 개선 (구현하지 않고 기록)

> 첫 빌드 범위를 무한히 넓히지 않기 위해 여기에만 남긴다. 실제 사용 후 우선순위를 다시 정한다.

## 고객 가치 직결 (실운영 후 1순위 검토)
1. **알림 실제 발송** — 카카오 알림톡/이메일 연동. 현재는 Portal 알림 + 초안 복사까지. (NEXT-01)
2. **자료 제출 리마인드 자동화** — D-3 / D-1 / 당일 규칙은 이미 브리핑에 있음. 발송 채널만 붙이면 됨.
3. **파일 실제 저장** — Supabase Storage + 서명 URL. 버전 관리는 메타 구조 그대로 사용 가능.
4. **상담 요약 LLM 연결(AI-01)** — API Key 확보 시 `AiModals.tsx`의 consult 위치와 `Consultation.summary` 구조에 바로 연결.

## 운영 편의
5. 기업고객 카드에서 상담 기록 직접 작성 (현재 Seed 표시만)
6. 프로젝트 유형별 **자료 요청 템플릿** (경영진단 4종, 연구소 5종, 정책자금 4종 …) — 자료 요청 등록 시 일괄 생성
7. 일정 드래그 이동 / 반복 일정
8. 문의 첨부파일
9. 담당자 재배정 + 이관 이력
10. 검색: 전역 검색(기업·프로젝트·자료·문의)

## 리포트 / 실증
11. Baseline 측정 모드 — 운영 시작 후 4주간 자동 집계, 이후 Before/After 비교 카드
12. 담당자별 주간 리포트 자동 생성 (NEXT-03)
13. Evidence Pack PDF Export

## Product Shell
14. 다크 모드(현재 9 Theme는 Light Workspace 기준)
15. 키보드 단축키 (`g d` 대시보드 등)
16. Presentation Mode 스텝별 자동 데이터 하이라이트

## 아키텍처
17. Supabase 전환 시 `store.ts` Action → server actions + optimistic update
18. `Activity`를 append-only 테이블로 분리, RLS로 고객은 본인 회사 Activity만 조회
19. 다국어(영문) — 외국계 고객 발생 시

## 의도적으로 하지 않은 것 (재검토 조건 포함)
- 멀티테넌트 / 외부 컨설팅사 구독 — KPJK 실사용 6개월 + Baseline 개선 확인 후
- 정책자금 추천 엔진 — 별도 제품 영역, KPJK 실무 규칙 정리 이후
- 모바일 Native App — PWA로 충분한지 먼저 확인
