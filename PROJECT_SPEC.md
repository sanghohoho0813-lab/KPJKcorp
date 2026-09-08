# PROJECT_SPEC — KPJK Consulting Operations AX + Client Portal

> Source of Truth: 미래AI랩 AX + Platform Unified Design & Development System v3.0
> Company Master Prompt: KPJK CORPORATION v1.0 (2026-09-08)
> 이 파일은 이번 프로젝트의 최종 설계도다. 일상 개발은 이 파일을 우선 읽는다.

---

## 1. STRATEGY LOCK (PASS 1-A)

| 항목 | 결정 |
|---|---|
| AX VERDICT | **FULL / GO** — 반복 상담·자료요청·후속관리 존재, 고객 수 증가 시 기억 의존 한계, Portal Self-Service 가능 |
| CAPITAL INDEPENDENCE | PASS — 정책자금/투자 없이도 "담당자 1인당 관리 고객 수 확대 + 누락 감소"라는 경제적 이유가 있음 |
| PRIMARY CONSTRAINT | 고객·프로젝트 증가 시 고객정보/상담/자료/진행/일정/후속업무가 카톡·파일·기억에 분산 → 자료 찾는 시간↑, 후속 누락↑, 진행 파악 어려움, 고객의 반복 문의, 담당자 1인당 관리 고객 수 제한. 핵심은 **기업고객 단위 SSOT + 고객 Portal 연결** |
| CONSTRAINT 유형 | TIME LEAK(주) + REVENUE LEAK(관리 가능 고객 수 제한) |
| CORE VALUE 1 | OPERATION EFFICIENCY — 분산 정보 통합, 반복 확인·누락 감소 |
| CORE VALUE 2 | CUSTOMER EXPERIENCE — 고객이 진행상황·요청자료·일정·결과물을 직접 확인/참여 |
| CORE VALUE 3 | MANAGEMENT CAPACITY — 동일 인력으로 더 많은 기업고객/프로젝트 관리 |
| MONEY KPI — COST | 자료요청→제출 완료 소요기간, 후속업무 누락건수, 고객정보 검색시간 |
| MONEY KPI — REVENUE/CUSTOMER | 진행상황 단순문의 건수, Portal 직접 자료제출 비율, Portal Self-Service 이용률 |
| MONEY KPI — SCALE | 담당자 1인당 동시 관리 기업 수, 동시 진행 프로젝트 수 |
| BASELINE STATUS | **REQUIRED / UNKNOWN** — 측정지점만 구현(Activity Event + Timestamp). 개선율 미표시 |
| PRIMARY CONVERSION (Portal) | 고객이 요청자료를 Portal에서 직접 제출 완료 |
| PROCESS REDESIGN | ELIMINATE(반복 확인/중복입력) → STANDARDIZE(11단계 프로젝트 상태, 7단계 자료 상태) → DIGITIZE(Company/Project/DocRequest/Schedule/Task/Inquiry) → AUTOMATE(알림·누락체크·상태변경 연동) → AI(요약·브리핑·초안만) |
| CUSTOMER JOB-TO-BE-DONE | "내 컨설팅이 어디까지 됐고, 내가 지금 뭘 내야 하는지, 다음 일정이 뭔지" 5초 안에 확인 |
| SHARED DATA ASSET | Company 단위 Activity/Event Log (요청→제출→검토→단계변경→문의→답변). 12개월 축적 시 "프로젝트 유형별 표준 소요기간 / 병목 단계 / 고객 응답 패턴" 판단 가능 |
| DATA MOAT SCORE | 독점성 2 / 시간축 2 / Outcome 1 / 반복성 2 / 권리 2 / AI활용 1 = **10 (강함, 단 Outcome 연결은 실운영 후)** |
| PORTAL / PLATFORM READINESS | Portal 필요: **HIGH** (고객 Self-Service가 Constraint 직결). Industry Platform: **LOW** — 이번 단계 미추진 (NOT BUILDING) |
| MOAT CANDIDATE | Workflow(컨설팅 단계 표준) + Proprietary Data(고객별 이력) + Switching Cost(고객 Portal 이력) |
| RISK LEVEL | LOW–MID. AI는 L1 Assist만. 법률·세무 판단 자동화 없음. 고객별 데이터 격리 필수 |
| DELIVERY STAGE | **DEMO** (Demo Seed, 로컬 Store). Supabase/Auth는 CONDITIONAL |
| STRATEGIC ACCEPTANCE | Primary Closed Loop(자료제출→검토→단계변경→Portal 반영) 실동작 + Secondary Loop(문의→답변) 실동작 + Strategic P0 = 0 |

### AI METHOD MATRIX

| # | 기능 | Business Question | Input | Method | Output | Why This Method | Error Cost | Level | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| AI-01 | 상담 요약 | 이 상담에서 약속한 것/필요 자료/다음 행동은? | 상담 메모 | LLM (현재 AI READY, 규칙 기반 구조화 Demo) | 핵심내용/요구사항/약속/필요자료/다음Action | 비정형 텍스트 구조화는 LLM 적합 | LOW | L1 | Consultation.summary |
| AI-02 | 오늘의 업무 브리핑 | 오늘 먼저 확인할 것은? | 프로젝트/자료/일정/문의/Activity | **RULE** + LLM(문장화, AI READY) | 우선순위 목록 + 근거 | 우선순위는 규칙으로 충분, 문장화만 LLM | LOW | L1 | brief 생성 시각/항목 로그 |
| AI-03 | 프로젝트 요약 | 어디까지 왔고 다음은? | Project/DocRequest/Schedule/Activity | **RULE** (LLM AI READY) | 3~4문장 요약 | 구조화 데이터 요약은 규칙으로 가능 | LOW | L1 | — |
| AI-04 | 자료 누락 체크 | 필요 자료 중 무엇이 없나? | DocRequest 상태 | **RULE** | 제출/미제출/보완/검토대기 | IF로 충분, AI 포장 금지 | LOW | L1 | DocRequest 상태 이력 |
| AI-05 | 커뮤니케이션 초안 | 재요청/일정안내 문구 | Company/DocRequest/Schedule | **RULE 템플릿** (LLM AI READY) | 편집 가능한 초안 | 저위험, 담당자 확인 후 발송 | LOW | L1 | — |

AI 기능 수: 5 (AI Fit 통과). 실제 LLM API 미연결 → 모든 위치 `AI READY` 정직 표시.

### NOT BUILDING THIS PHASE
정책자금 실시간 추천 / 자동 자금조달 판단 / 법률·세무 자동판단 / 상품 자동추천 / 멀티테넌트 / 외부 구독결제 / 업계 Benchmark DB / 자체 ML / Native App / 외부 ERP·CRM 실시간 API / 대량 자동발송 / L4 자동실행 / 실제 파일 저장소(파일 메타만 저장) / 실결제

### FUTURE EXPANSION (NEXT, 5개)
알림 자동화 고도화 / 문서 작성·정리 자동화 / 운영 리포트 고도화 / 고객 Portal Self-Service 확대 / 외부서비스 연동 — 모두 `NEXT` Badge + Preview Sheet, 404 없음

---

## 2. USERS / ROLES

| Role | 사용자 | 접근 |
|---|---|---|
| ADMIN | 김영돈 대표, 관리자 | 전체 |
| CONSULTANT | 담당 컨설턴트 | 담당 고객·프로젝트 중심 (Demo: 전체 열람, 담당 필터 기본) |
| CLIENT | 기업고객 담당자/대표 | 본인 회사의 프로젝트/자료/일정/결과/문의만. 타사 데이터 접근 불가 |

Demo 계정: 대표(admin) / 박성훈 이사(consultant) / 이주연 컨설턴트(consultant) / 각 Demo 기업 담당자(client)

---

## 3. INFORMATION ARCHITECTURE

### Business AX (`/ax/*`) — Sidebar 280px
01 대시보드 `/ax/dashboard` · 02 기업고객 `/ax/clients`, `/ax/clients/[id]` · 03 프로젝트 `/ax/projects`, `/ax/projects/[id]` · 04 상담/계약 `/ax/consultations` · 05 자료관리 `/ax/documents` · 06 일정 `/ax/schedule` · 07 업무/후속관리 `/ax/tasks` · 08 문의/커뮤니케이션 `/ax/inquiries` · 09 결과자료 `/ax/results` · 10 AI 브리핑 `/ax/brief` · 11 리포트 `/ax/reports` · 12 설정 `/ax/settings` · Why AX `/ax/why` · NEXT(확장) Preview Sheet

Mobile Bottom Nav: 오늘 / 고객 / 프로젝트 / 자료 / 더보기(Sheet: 나머지 전부)

### Client Portal (`/portal/*`)
01 홈 `/portal` · 02 내 프로젝트 `/portal/projects` · 03 요청자료 `/portal/documents` · 04 일정 `/portal/schedule` · 05 완료자료 `/portal/results` · 06 문의하기 `/portal/inquiries` · 07 알림 `/portal/notifications` · 08 내 정보 `/portal/me`

Mobile Bottom Nav: 홈 / 진행현황 / 자료제출 / 문의 / MY

### 공통
`/login` (Demo Role 선택 로그인) · `/` → 역할별 홈으로 이동

---

## 4. DATA MODEL / SSOT

Core Entity: Company, Contact(User role=client), Consultation, Contract, Project, DocumentRequest, Document, Schedule, Task, Inquiry, Message, ResultFile, Activity, Notification, User

| Entity | System of Record | 입력 주체 | 업데이트 | 민감도 | AI 사용 |
|---|---|---|---|---|---|
| Company/Contact | store.companies / users | 내부 | 상담·계약 시 | 중 | 요약 입력 |
| Project (+stage) | store.projects | 내부 | 단계 변경 Action | 중 | 브리핑/요약 |
| DocumentRequest/Document | store.docRequests | 내부 요청 / 고객 제출 / 내부 검토 | Closed Loop | 높음(파일) | 누락 체크 |
| Schedule | store.schedules | 내부 (고객 공개 flag) | — | 중 | 브리핑 |
| Task | store.tasks | 내부 + 자동 생성 | 상태 변경 | 낮음 | 브리핑 |
| Inquiry/Message | store.inquiries | 고객 작성 / 내부 답변 | Secondary Loop | 중 | 초안 |
| Activity (Evidence) | store.activities | 시스템 자동 | Append-only | 중 | 브리핑 근거 |
| Notification | store.notifications | 시스템 자동 | 읽음 처리 | 낮음 | — |

**Dual Progress (Signature 03)** — Internal Stage(11) → Customer Step(7) 단일 매핑:
inquiry/consult→①상담 · contract→②계약 · doc_request/doc_received→③자료제출 · review→④자료검토 · in_progress/drafting→⑤결과작성 · ceo_meeting→⑥대표미팅 · done/aftercare→⑦완료

Data Source: **DEMO** (zustand + localStorage persist). Repository 분리: `src/lib/demo/seed.ts`(Seed) / `src/lib/store.ts`(Actions). 향후 Supabase 교체 시 store action 내부만 교체.

---

## 5. CLOSED LOOPS

**PRIMARY**: Portal 요청자료 확인 → 파일 제출(메타 저장) → [Event: document_uploaded] → 내부 알림 + 검토 Task 자동 생성 + 자료상태 `submitted` → 담당자 검토(`done`/`revision`) → [Event] → 프로젝트 단계 변경 → 고객 알림 + Portal Timeline/진행률 자동 반영

**SECONDARY**: Portal 문의 작성 → [Event] → 내부 문의 Queue + 알림 → 담당자 답변 → [Event] → Portal 답변/상태 확인 + 알림

---

## 6. VISUAL DIRECTION

- Reference: 사용자 제공 Mockup 9장(AX-01~04, PORTAL-01~03, MOBILE-01, FLOW-01) → **Layout / Hierarchy / Density / Card Geometry / Badge 언어**를 채택
- Color: **Company Master Prompt §21 우선** (Dark #171B20 / Slate #343B44 / Accent #D47A4A / Secondary #6B7680 / Line #E7EAEE / Canvas #FAFAF8 / Soft #E8B89A). Mockup의 Teal/Navy는 KPJK 브랜드 지시와 충돌하므로 미채택 (DECISIONS.md #2)
- Default Theme: `KPJK Signature` (Onyx Gold Seed를 브랜드 Hue로 조정). Canonical 9 Theme 전부 Settings에서 실제 동작
- Orange Accent 사용처: Primary CTA / Current Progress / Selected State / 중요 Highlight 만. 본문·표·폼은 Neutral
- Semantic: 미제출·보완필요 = Rose(Error/Risk semantic), 검토중 = Amber, 제출완료·완료 = Green — Theme 무관 고정
- Typography: Root 19px (설정: 17/19/21), Sidebar 280px, 한글 `keep-all`, 숫자 `tabular-nums`
- Photo: `hero_main.png`(Why AX/Login Hero), `photo_consulting.png`(Why AX 현재/상담), `photo_analysis.png`(Why AX 분석/AI). AX 화면에는 KPI/AI/Action이 항상 사진보다 우선
- PROJECT SIGNATURE: ①Enterprise Client Card ②Today Brief ③Dual Progress ④Client Journey Timeline

---

## 7. IMPLEMENTATION PRIORITY

**SYSTEM CORE**: App Shell(AX/Portal) · Settings(Theme 10/Font/Motion/Role/Permission Matrix/Demo Reset/Tutorial Replay) · Tutorial(AX 4 Step, Portal 3 Step, Spotlight) · Presentation Mode(9 Step) · Why AX(14 Section) · Role Switcher · Device Preview(Desktop→Mobile, Mobile→PC, 재귀 금지) · Surface Switch(AX↔Portal 왕복) · Live Clock · Modal/Drawer/Sheet Integrity

**BUSINESS CORE**: Dashboard+Today Brief · Enterprise Client Card(9 Tab) · Project List/Kanban/Detail · Document Request Center · Schedule(List+Calendar) · Task · Inquiry Queue · Results · AI Brief · Reports(KPI 측정지점+Evidence Log)

**PLATFORM CORE**: Portal Home · Project Timeline · Document Upload · Schedule · Results · Inquiry · Notifications · Me

**CONDITIONAL** (미포함): Supabase / Auth / 실제 파일 저장 / LLM API / 이메일·카톡 발송

**PLUS**: Presentation 고도화, Report Export, 추가 Motion

---

## 8. PRODUCT SHELL PARITY MATRIX

| 기능 | Desktop | 실제 Mobile | 반대 Device Preview | Discoverable | Behavior Parity |
|---|---|---|---|---|---|
| 전체 Navigation | Sidebar | Bottom Nav + 더보기 Sheet | ✓ | ✓ | ✓ |
| 날짜 + 현재시각 | Header 전체 | Header 압축형 | ✓ | ✓ | ✓ |
| Theme | Settings | Settings | ✓ | ✓ | ✓ |
| Font Scale | Settings | Settings | ✓ | ✓ | ✓ |
| Role / Permission Preview | Header + Settings | 더보기 + Settings | ✓ | ✓ | ✓ |
| Tutorial | Header ? + Settings | 더보기 + Settings | ✓ | ✓ | ✓ |
| Why / Story | Sidebar + Dashboard | 더보기 | ✓ | ✓ | ✓ |
| Demo Reset | Settings + Header | 더보기 + Settings | ✓ | ✓ | ✓ |
| Surface Switch | Header | 더보기 | ✓ | ✓ | ✓ |

---

## 9. ACCEPTANCE (Master Prompt §30 + Unified U-7)

TEST 01 INTERNAL / TEST 02 CUSTOMER / TEST 03 CLOSED LOOP / TEST 04 COMMUNICATION / TEST 05 MOBILE 390px — 하나라도 Dead-End이면 미완료.
Responsive: 360/390/430/768/1024/1280/1440/1920. Theme 10종 Residual Accent 0. Overlay Escape 100%.

Quality Floor: Strategy ≥ 95 목표 / Business AX ≥ 95 / Portal ≥ 95 / P0 = 0. First Build 목표 70~80%.
