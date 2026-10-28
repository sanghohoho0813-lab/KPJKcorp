# 기술검증 영상 — 벤처기업확인 기술혁신성 이의신청 (16:9, 약 4분 47초)

심사 의견("기술혁신성 · 차별성의 객관적 근거 부족")에 답하는 영상입니다. 대표님 대본(8구간)을 음성 · 자막으로 만들고,
**실제 앱 화면 · 실제 소스코드(줄 번호 그대로) · 실제 시험 기록 · 실제 커밋 날짜**를 장면에 연결합니다.
스타일은 `../VIDEO_STYLE_GUIDE.md`(차콜 + 구리색, Pretendard, 들어올 때만 천천히)의 16:9 값을 따릅니다.

| 파일 | 하는 일 |
|---|---|
| `chunks.txt` | 대본 — 한 줄 = 자막 하나, `# S1 …` = 구간. 화면 문구 · 음성 · 자막이 모두 여기서 나온다 |
| `synth.py` | 구간별 음성(edge-tts `ko-KR-InJoonNeural`) + 단어 시각. 이 환경의 프록시 인증서로 TLS 검증 |
| `align.py` | 구간을 이어 붙여 `voice.wav`(-14 LUFS) · 자막 시각 `subs.json` · `subs.srt` · 구간 시각 `secs_t.json` |
| `capture.mjs` | 데모 모드 앱을 실제로 눌러 PC(1440×900) · 휴대폰(390×844) 26장 + 강조 위치(`meta.json`) |
| `build.py` | 장면표 → `comp.html`. 장면 시각은 대본 문구로 찾고(`at`), 코드는 저장소 파일에서 줄 번호로 읽는다 |
| `comp.tpl.html` | 1920×1080 틀 — `render(t)` 하나로 프레임 결정(CSS 애니메이션 없음), 자막 · 장 표시 · 예시 데이터 표기 |
| `render.mjs` | 시험 프레임(`frames`) · 전체 렌더(`video`, 30fps H.264 + AAC) |
| `record-loop.mjs` | ① 장면용 **실제 화면 녹화** — 데모 모드 앱을 사람 속도로 조작하며 Chrome 화면 프레임(CDP screencast)을 받는다. 고객 제출 → 담당자 업무함 → 보완 요청 → 고객 보완 필요 → 재제출 → 검토 완료 · 이력 6클립. 덧그리는 것은 누른 자리 원 · PC 마우스 화살표뿐 |
| `server-loop.sql` · `server-loop.sh` | ① 장면 오른쪽 **서버 처리 기록**의 근거 — 로컬 Postgres 에 운영과 같은 `setup.sql` 을 올리고 고객 · 담당자 계정으로 실제 실행(파일 제출 → 트리거가 검토 업무 · 고객 알림 · 자동 기록 · 단계 변경 → 보완 요청 → 고객이 읽는 상태 → 재제출 → 검토 완료). 결과가 기대와 다르면 `build.py` 가 멈춘다 |
| `compare.mjs` | 전후 비교 영상 — 수정한 구간만 왼쪽 수정 전 · 오른쪽 수정 후 |

## 화면에 넣은 사실과 근거

| 화면 | 근거 |
|---|---|
| 특허 출원번호 10-2026-0177079 · "출원 완료" | 앱 설정 · 로드맵과 같은 표기. 출원일(2026. 9. 16.)은 대본 그대로 — 출원서와 맞는지 확인 |
| 내부 11단계 → 고객 4단계 | `src/lib/stages.ts` `INTERNAL_STAGES` · `CUSTOMER_STEPS` · `stageToCustomerStep()` |
| 고객 제출 → 검토 업무 자동 생성 | `supabase/setup.sql` `kpjk_after_client_file()` (캡처에서도 업무 `source = auto` · 담당 컨설턴트 배정 확인) |
| 업무 흐름 시험 228항목 · 권한 시험 202항목 | `tools/acceptance/daily.mjs` 출력 `== OK 228 / FAIL 0`, `supabase/test/run-rls.sh` 출력 `202 | 0` (2026-10-28 실행). 화면의 시험 이름은 기록에서 그대로 가져오며, 없으면 `build.py` 가 멈춘다 |
| 개발 이력 7개 날짜 | `git log` — 날짜가 커밋 기록에 없으면 `build.py` 가 멈춘다 |
| 공고 | `tools/acceptance/fixtures/bizinfo-open.json` (운영 서버 공개 목록에서 받은 실제 기업마당 공고) |

회사 · 사람 · 자료는 데모 샘플이며 화면 장면마다 오른쪽 위에 "예시 데이터" 표기가 붙습니다.
성과 · 개선율 같은 숫자는 넣지 않았습니다(대본이 말한 시험 항목 수만).

## 2026-10-28 수정 (심사 설득력 보강 — 3개 구간만)

| 구간 | 바꾼 것 |
|---|---|
| ① 01:02 – 01:30 | 정지 화면 · 코드 → **실제 화면 녹화**(데모 환경) 6클립 + **서버 트리거 실제 실행 결과**(로컬 시험 DB). 클립은 실제 속도 그대로, 클립 사이 대기만 편집. 사건 순서(제출 → 업무 → 보완 요청 → 고객 화면 → 재제출 → 완료)가 어긋나면 `build.py` 가 멈춘다 |
| ② 02:03 – 02:12 | 구현 위치 카드 3장 → 일반 CRM 기능과 KPJK 통합 처리구조 비교(다른 CRM 에 없다고 단정하지 않음) |
| ③ 02:36 – 03:00 | 「기존 신청기술 기반 추가 고도화 \| 2026년 10월」 표기 · '신규' → '고도화' · 확장 도식에 "핵심 구조 그대로 유지" |

나레이션 · 자막 · 길이(4:47)는 그대로입니다. 나머지 구간은 수정 전과 화소 단위로 같습니다(16개 시각 비교).

## 다시 만들기

```bash
W=<작업 폴더>; mkdir -p $W && cd /home/user/KPJKcorp
# 1) 음성 · 자막 (대본을 고쳤거나 목소리를 바꿀 때)
W=$W /usr/bin/python3 tools/video/appeal/synth.py "+15%" ko-KR-InJoonNeural && W=$W python3 tools/video/appeal/align.py
# 2) 화면 (앱을 데모 모드로 띄운 뒤: npm run build && npm start)
OUT=$W/cap node tools/video/appeal/capture.mjs
# 3) 글꼴: $W/fonts/ 에 PretendardVariable.ttf · ngc-{latin,korean}-{400,700}.woff2 (npm pretendard · @fontsource/nanum-gothic-coding)
# 4) 시험 로그: $W/logs/daily.log · rls.log (daily.mjs · run-rls.sh 출력)
OUT=$W/rec node tools/video/appeal/record-loop.mjs                      # ① 실제 화면 녹화
bash tools/video/appeal/server-loop.sh > $W/logs/server-loop.txt          # ① 서버 실제 실행 (로컬 Postgres)
python3 tools/video/appeal/build.py $W
node tools/video/appeal/render.mjs frames $W/comp.html $W/test 5,30,70,120   # 확인
node tools/video/appeal/render.mjs video  $W/comp.html $W/voice.wav $W/out.mp4
```

**대표님 육성으로 바꾸려면**: 구간마다 녹음해 `tts/S1.mp3` ~ `S8.mp3` 로 두고, 단어 시각은 받아쓰기(`../v31/asr.py`)로 얻어
`tts/secs.json`(구간별 `words: [{t, d, w}]` · `dur`)에 넣으면 `align.py` 이후가 그대로 돕니다. 대본과 글자가 다르면 `align.py` 가 멈춰 어디가 다른지 알려 줍니다.
