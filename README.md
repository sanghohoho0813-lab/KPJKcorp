# KPJK Consulting AX + Client Portal

케이피제이케이코퍼레이션 — 기업컨설팅 운영 AX(Business AX) + 기업고객 Portal. 고객의 행동(자료 제출·문의)이 내부 업무를 바꾸고, 내부의 결정(검토·단계 변경·답변)이 다시 고객 Portal로 돌아가는 **Connected Consulting Operations System**의 첫 빌드(Demo).

- 설계 원본: `PROJECT_SPEC.md` · 진행상황: `PROJECT_STATE.md` · 다음 작업: `BACKLOG.md` · 결정 기록: `DECISIONS.md` · QA: `QA_REPORT.md` · 후속 아이디어: `RECOMMENDATIONS.md`
- 규격: 미래AI랩 AX + Platform Unified Design & Development System v3.0

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

로그인 화면에서 데모 계정(대표 / 컨설턴트 / 기업고객)을 선택합니다. 비밀번호 없음.

## 구조

```
src/app/login            데모 로그인
src/app/ax/*             Business AX (대시보드·승인/매출기회·기업고객·상담/계약·프로젝트·자료관리·일정·업무·문의·AI 브리핑·리포트·Why AX·설정·개선의견 설문)
src/app/portal/*         Client Portal (홈·내 프로젝트·요청자료·일정·완료자료·함께 검토·문의·알림·내 정보)
src/lib/store.ts         SSOT + 모든 Action (Closed Loop). 실데이터 연결 시 이 파일의 Action 내부만 교체
src/lib/demo/seed.ts     Demo Seed (오늘 기준 상대 날짜)
src/lib/brief.ts         AI-02 브리핑 규칙 엔진 / AI-03 요약 / AI-05 초안 템플릿
src/lib/stages.ts        내부 11단계 ↔ 고객 7단계 매핑 (Dual Progress)
src/lib/services.ts      서비스 카탈로그 + 규칙 기반 추천(근거 문장 포함) + 기회 파이프라인
src/lib/survey.ts        AX 고도화 설문 문항 (2단계 → 3단계)
src/components/shell     App Shell · Tutorial · Presentation · Device Preview · Notifications
src/components/domain    Brief / Activity / Doc Review / Upload / Create Modals
src/components/ui        Button · Badge · Card · Modal · Drawer · Sheet …
```

## 상태

- Delivery Stage: **DEMO** (브라우저 로컬 저장, 파일 메타만 기록, 외부 LLM 미연결)
- 다음 단계(CONDITIONAL): Supabase Auth/RLS/Storage, LLM API(상담 요약), 알림 발송 연동
