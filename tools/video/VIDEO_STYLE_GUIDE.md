# KPJK 영상 스타일 가이드 — 릴스(9:16) · 자막 필수

> 2026-10 실사 안내 영상(`tools/video/ax-intro/`)의 색·글자·움직임을 표준으로 삼아 정리한 문서입니다.
> 앞으로 KPJK 영상은 **세로 9:16(1080×1920)** 으로 만들고, **음성 자막을 반드시** 넣습니다.
> 이 문서만 AI(Claude Code 등)에게 주면 같은 품질의 영상을 다시 만들 수 있게 썼습니다. 맨 아래에 바로 붙여 넣을 프롬프트가 있습니다.

---

## 0. 한 줄 요약

**어두운 차콜 배경 + 구리색 포인트 한 가지 + Pretendard 굵은 제목 + 느리고 부드러운 등장.**
화려한 효과 대신 "정보가 차분하게 하나씩 놓이는" 느낌이 이 스타일의 핵심입니다.

| 원칙 | 이유 |
|---|---|
| 색은 배경(차콜)과 포인트(구리) 두 계열만 | 색이 많으면 싸 보입니다. 포인트가 하나여야 시선이 그곳으로 갑니다 |
| 한 화면에 메시지 하나 | 휴대폰은 화면이 작습니다. 두 개를 말하면 둘 다 안 읽힙니다 |
| 움직임은 "들어올 때만" 천천히 | 계속 움직이면 정신없고, 튀어 들어오면 가벼워 보입니다 |
| 앱 화면은 진짜 화면 + "예시 데이터" 표기 | 신뢰가 브랜드입니다. 가짜 숫자·가짜 실적은 넣지 않습니다 |

---

## 1. 화면 규격 (9:16)

| 항목 | 값 |
|---|---|
| 해상도 | **1080 × 1920**, 30fps |
| 권장 길이 | 45~90초 (설명 영상도 90초 안에서 끝내는 것을 권장) |
| 인코딩 | H.264 High · `yuv420p` · CRF 18 · `+faststart` / AAC 48kHz 192kbps 스테레오 |
| 음량 | `loudnorm=I=-14:TP=-1.5:LRA=11` (모바일 SNS 기준 음량) |
| 파일명 | `KPJK_<주제>_릴스_<초>s.mp4` |

### 안전 영역 (릴스 화면의 버튼·글자에 가리지 않는 곳)

릴스는 위에 계정 이름, 아래에 설명 글·음악 표시, 오른쪽에 좋아요·댓글 버튼이 겹쳐 나옵니다.

```
 y=0    ┌───────────────────────────┐
        │   (위 220px: 비워 둠)       │  ← 상단 앱 UI
 y=220  ├───────────────────────────┤
        │                           │
        │   본문 영역                 │  x 72 ~ 960 (오른쪽 120px 은 버튼 자리)
        │   제목 · 도식 · 앱 화면       │
        │                           │
 y=1300 ├───────────────────────────┤
        │   자막 영역 (1330 ~ 1510)   │  ← 자막은 항상 여기 (x 132 ~ 948)
 y=1520 ├───────────────────────────┤
        │   (아래 400px: 비워 둠)      │  ← 설명 글·음악·버튼
 y=1920 └───────────────────────────┘
```

| 영역 | 범위 | 들어가는 것 |
|---|---|---|
| 상단 여백 | y 0–220 | 배경만. 글자 금지 |
| 본문 | x 72–960, y 220–1300 | 제목, 도식, 기기 화면 |
| 자막 | x 132–948, y 1330–1510 (가운데 정렬) | 음성 자막만. 오른쪽 버튼과 겹치지 않게 폭 816px 이내 |
| 하단 여백 | y 1520–1920 | 배경만. 글자 금지 ("예시 데이터" 표기도 본문 영역 안에 둔다) |
| 오른쪽 | x 960–1080 | 중요한 글자·버튼 금지 |

> 확인용: 장면 파일을 `?guide=1` 로 열면 안전 영역 선이 보이게 만들어 둡니다 (아래 기본 틀에 포함).

---

## 2. 색상

| 이름 | 값 | 쓰는 곳 |
|---|---|---|
| `--bg` | `#0f1216` | 맨 바탕 |
| `--shell` | `#171b20` | 배경 그라데이션 중간색 |
| `--shell2` | `#22272e` | 보조 면 |
| `--acc` | `#d47a4a` | **포인트 구리색** — 진행선, 번호 원, 체크 아이콘, 순환 선 |
| `--acc2` | `#b75b2a` | 진한 구리 (거의 안 씀, 눌린 상태 등) |
| `--hi` | `#e8b89a` | **강조 글자** — 제목 속 핵심 단어, 영문 소제목, 자막 강조 |
| `--ink` | `#f4f1ec` | 기본 글자 (순백 대신 따뜻한 흰색) |
| `--ink2` | `rgba(244,241,236,.72)` | 설명 글 |
| `--ink3` | `rgba(244,241,236,.46)` | 흐린 글자, 취소선 문장, "예시 데이터" 표기 |
| `--line` | `rgba(255,255,255,.09)` | 격자선, 구분선 |
| 상태 초록 | `#6fd39a` | "실시간 연동" 같은 켜짐 점에만 (작게) |

**배경 (세로용)**

```css
background:
  radial-gradient(70% 40% at 85% 8%,  rgba(212,122,74,.24), transparent 60%),  /* 오른쪽 위 구리빛 */
  radial-gradient(60% 35% at 10% 92%, rgba(232,184,154,.10), transparent 60%),  /* 왼쪽 아래 은은한 빛 */
  linear-gradient(170deg, #12161b 0%, #171b20 45%, #0d1014 100%);
```

- 그 위에 90px 격자선(`--line`)을 가운데만 보이게(radial mask) 깔고 투명도 .5.
- 배경 전체는 아주 천천히 떠다닌다: `translate(sin(t/9)*30px, cos(t/11)*20px) scale(1.04)`.

**규칙**
- 한 문장 안에서 강조색(`--hi`)은 **한 군데만**. ("이미 **작동하는 시스템**으로 구현")
- 빨강·파랑·초록 같은 다른 색을 제목에 쓰지 않는다.
- 유리 카드: `linear-gradient(160deg, rgba(255,255,255,.075), rgba(255,255,255,.025))` + 테두리 `rgba(255,255,255,.12)` + 둥근 모서리 28px + 그림자 `0 40px 80px -30px rgba(0,0,0,.7)`. 강조 카드는 테두리만 `rgba(232,184,154,.5)`.

---

## 3. 글자체

**Pretendard Variable** 하나만 씁니다. (영문도 Pretendard)

| 역할 | 16:9 원본 | **9:16 (릴스)** | 굵기 | 자간 | 줄 간격 |
|---|---|---|---|---|---|
| 영문 소제목 (EYEBROW) | 22px | **26px** | 700 | `.3em`, 대문자, `--hi` 색 | — |
| 큰 제목 h1 | 92px | **88px** | 800 | `-.025em` | 1.12 |
| 제목 h2 | 54–64px | **64px** | 800 | `-.02em` | 1.2 |
| 소제목 h3 | 40px | **46px** | 700 | `-.01em` | 1.3 |
| 설명 글 | 30px | **36px** | 500, `--ink2` | 0 | 1.5 |
| 태그·칩 | 26–32px | **32px** | 700 | 0 | — |
| **자막** | — | **46px** | 700 | `-.01em` | 1.42 |
| 예시 데이터 표기 | 18px | **22px** | 500, `--ink3` | 0 | — |

- 한국어는 `word-break: keep-all` — 단어 중간에서 줄이 바뀌지 않게.
- 제목은 **두 줄 이내**, 한 줄 9~11자(88px 기준). 길면 내용을 줄이지 글자를 줄이지 않는다.
- 영문 소제목은 장면의 성격을 알려주는 짧은 말: `STATE-BASED WORKFLOW`, `CLOSED LOOP`, `CUSTOMER PORTAL`, `CURRENT STAGE`, `BUSINESS ROADMAP`.

---

## 4. 움직임

모든 움직임은 **시간 t(초)를 넣으면 화면이 정해지는 함수 `render(t)`** 로 계산합니다. CSS 애니메이션·트랜지션은 쓰지 않습니다(프레임마다 결과가 같아야 끊김 없이 렌더됩니다).

### 곡선

```js
const eo  = (x) => 1 - Math.pow(1 - x, 3);                                         // 들어올 때: 빨리 출발해 부드럽게 멈춤
const eio = (x) => (x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2);              // 나갈 때·화면 이동: 천천히-빠르게-천천히
```

### 등장·퇴장

| 종류 (`data-a`) | 움직임 | 시간 |
|---|---|---|
| `up` (기본) | 아래 34px → 제자리 + 투명 → 선명 | 0.7초 |
| `left` | 왼쪽 60px → 제자리 | 0.7초 |
| `scale` | 94% → 100% | 0.8초 |
| `card` | 아래 60px + 92% → 제자리 100% | 0.8초 |
| `fade` | 투명도만 | 0.6초 |
| 장면 전체 | 투명도 교차 | 0.55초 |
| 앱 화면 교체 | 같은 자리에서 교차 페이드 | 0.35초 |
| 퇴장 | 투명도만 (움직이지 않음) | 등장 시간의 0.8배 |

### 리듬

- **여러 개를 보여줄 땐 차례로**: 카드·칩·단계는 0.75~0.85초 간격으로 하나씩.
- **목록이 쌓일 땐 지난 것을 흐리게**: 새 항목이 나오면 앞 항목은 투명도 .62 로.
- **앱 화면은 천천히 확대(켄 번즈)**: 장면 동안 100% → 106~110%, 위치도 20~40px 이동. 멈춘 화면처럼 보이지 않게.
- **선이 그려지는 효과**: 순환 도식·타임라인·화살표는 SVG `stroke-dasharray` 를 0→100% 로. 진행은 **음성에서 그 단어가 나오는 시각**에 맞춘다.
- **취소선**: "~가 아니라" 앞의 말에 구리색 선이 0.8초에 걸쳐 그어진다.
- 튀는 효과(바운스, 회전, 번쩍임, 흔들림)는 쓰지 않는다.

---

## 5. 자막 (필수)

자막은 **음성에서 말하는 문장 그대로**를 화면 아래 자막 영역에 넣습니다. 제목(핵심 요약)과 자막(말한 내용)은 역할이 다르므로 내용이 겹쳐도 둘 다 둡니다.

### 모양

| 항목 | 값 |
|---|---|
| 위치 | 가운데 정렬, 자막 영역(x 132–948, y 1330–1510) 안에서 **아래쪽 맞춤** (자막 아래 끝 y ≈ 1510), 상자 폭 최대 816px |
| 글자 | Pretendard 700, 46px, `--ink`, 줄 간격 1.42, `keep-all` |
| 바탕 | `rgba(15,18,22,.80)` 둥근 상자(모서리 20px, 안쪽 여백 16px 30px), 테두리 `rgba(255,255,255,.10)` |
| 강조 | 핵심 단어 한 개만 `--hi` 색 + 800 굵기 (`**단어**` 로 표시) |
| 줄 수 | **최대 2줄**, 한 줄 **최대 16자** (공백 포함 18자) |
| 등장·퇴장 | 투명도만 0.12초. 위아래로 움직이지 않는다 (읽는 눈이 흔들림) |
| 최소 표시 시간 | 0.9초. 그보다 짧으면 앞뒤 자막과 합친다 |

### 나누는 법

1. 대본을 **숨 쉬는 단위**로 자른다: 쉼표·마침표·"~고,", "~며," 같은 연결어에서.
2. 한 조각이 2줄(약 32자)을 넘으면 더 자른다. 조사 앞에서 자르지 않는다 ("시스템 / 을" ✗).
3. 숫자·고유명사(출원번호 등)는 한 줄에서 끊기지 않게 한다.
4. 1.1배속 같은 속도 조절은 **자막 시각을 정하기 전에** 끝낸다.
5. 자막 조각은 **사람이 직접 나눈다** (`chunks.txt`). 기계로 자르면 "것이었습니다", "됩니다" 같은 꼬리말이 혼자 남는다.
   시각만 기계로 맞춘다 (아래 "받아쓰기로 시각 맞추기").

### 받아쓰기로 시각 맞추기 (권장)

TTS 원본만 있고 대본 글이 없거나, 시각을 정확히 맞추고 싶을 때:

1. 받아쓰기(faster-whisper `turbo`, 한국어, 단어별 시각)로 **원본 음성**의 단어 시각을 얻는다. 4분 음성 기준 CPU 로 약 2~3분.
   잘못 들은 글자(예: "다응에" → "다음에")는 고친다.
2. `chunks.txt` 의 자막 조각을 띄어쓰기·문장부호를 뺀 글자 단위로 받아쓰기와 맞춰, 각 조각의 첫 단어 시작 ~ 끝 단어 끝을 시각으로 쓴다.
   글자가 하나라도 다르면 멈춰서 알려 준다 (대본과 녹음이 다른 곳을 찾는 데도 쓸모 있다).
3. 쉼 단축 · 배속으로 바뀐 시각은 대응표(`knots.json`)로 환산한다. 장면 시각도 **원본 음성 기준**으로 적고 같은 표로 환산하면, 음성을 다시 다듬어도 장면을 고칠 필요가 없다.

### 시각 맞추는 법 (받아쓰기 없이)

1. 최종 음성(속도 조절 끝난 것)에서 쉬는 구간을 찾는다:
   `ffmpeg -i voice.wav -af silencedetect=noise=-38dB:d=0.35 -f null -`
2. 쉼과 쉼 사이 = 말하는 구간. 대본 문장을 순서대로 대응시킨다.
3. 한 구간 안에 자막이 여러 개면 **글자 수 비율**로 시간을 나눈다.
4. 영상 앞에 여백(예: 0.6초)을 두었다면 모든 자막 시각에 더한다.
5. `subs.json` 으로 저장하고, 같은 내용을 `.srt` 로도 내보낸다 (SNS 자동자막 대신 올리거나 편집 프로그램에서 고칠 때).

```json
[
  { "in": 0.6, "out": 3.1, "text": "고객이 늘수록, 정보는 **흩어졌습니다**" },
  { "in": 3.2, "out": 6.0, "text": "카카오톡, 엑셀, 문서,\n담당자의 기억에" }
]
```

---

## 6. 구성 요소

| 요소 | 9:16 규격 | 메모 |
|---|---|---|
| 휴대폰 틀 | 폭 520–620px, 모서리 54px, 검은 테두리 14px, 위 노치 | 고객 화면은 가장 크게 보여준다 (릴스 시청자도 휴대폰이라 공감이 크다) |
| 브라우저 틀 | 폭 936px(좌우 72px 여백), 위 막대 38px(점 3개 + 주소칸) | PC 화면은 세로 영상에서 작으므로 **필요한 부분만 확대(켄 번즈 1.4~1.8배)** 해서 보여준다 |
| 번호 태그 | 구리 원(38px) 안 숫자 + 글자, 어두운 반투명 상자, 테두리 `rgba(232,184,154,.45)` | 단계 설명 |
| 칩 | 반투명 둥근 상자, 32px 700 | 흩어지는 정보·키워드 |
| 체크 목록 | 구리 원 안 ✓ + 40px 700 글자 | 현재 단계·완료 항목 |
| 유리 카드 | 2장의 유리 카드 규칙 | 비교(우리 vs 협력사), 로드맵 단계 |
| 로고 | 흰 둥근 사각(132px, 모서리 34px) 안 KPJK | **마지막 장면에만** 크게. 진행 중엔 왼쪽 위(y 240)에 작게(56px) 넣어도 됨 |

### 16:9 → 9:16 바꿀 때

| 16:9 원본 | 9:16에서는 |
|---|---|
| 가로로 늘어선 6개 카드 | 2열 × 3행 또는 한 장씩 차례로 크게 |
| 휴대폰(왼쪽) + PC(오른쪽) | **PC 위 · 휴대폰 아래 겹치기**, 단계 태그는 세로 목록 |
| 가로 타임라인 | **세로 타임라인** (왼쪽 선 + 오른쪽 글자) |
| 가로 로드맵 4칸 | 세로 4단 (단계 사이 `↓` 대신 짧은 구리선) |
| 가로 타원 순환도 | **세로 타원** (가로 반지름 360, 세로 반지름 470, 중심 540·760), 노드 6개 |
| 좌우 2단 비교 | 위아래 2단 |
| 로고만 나오는 3초 인트로 | **없앤다.** 릴스는 첫 화면이 바로 메시지여야 한다 |

---

## 7. 장면 흐름 (릴스용)

| 순서 | 길이 | 내용 | 원칙 |
|---|---|---|---|
| ① 첫 문장(후킹) | 0–3초 | 대표님이 겪는 문제 한 문장, 큰 글자 | 로고·인사 금지. 공감 → 문제 순서 |
| ② 문제 | 3–12초 | 왜 그런 일이 생기는지 (흩어지는 칩 등) | 원인을 보여준다 |
| ③ 구조 | 12–30초 | 해결하는 방식 (순환 도식 등) | 기능 나열이 아니라 원리 |
| ④ 실제 화면 | 30–60초 | 진짜 앱 화면 + 단계 태그 | "예시 데이터" 표기 필수 |
| ⑤ 정리·행동 | 마지막 5–8초 | 한 문장 정리 + 로고 + 다음 행동(상담 문의 등) | 과장된 약속 금지 |

콘텐츠 순서 원칙: **공감 → 문제 → 원인 → 해결 → 행동.**

---

## 8. 내용 원칙 (디자인보다 우선)

- 성과·개선율·고객 수·금액 같은 **숫자를 만들지 않는다.** 확인된 사실만.
- 특허는 등록 전이면 반드시 **"출원 완료" + 출원번호**. "등록 특허", "검증된 기술" 금지.
- "AI가 자동으로 진단", "지원금·정책자금 자동 판단", "무조건 된다", "상용화 완료", "이미 많은 기업이 사용" 같은 표현 금지.
- 앱 화면은 데모 예시 데이터만. 실제 고객 이름·자료는 넣지 않는다. 화면이 나오는 장면엔 "화면 속 기업·인물은 예시 데이터입니다".
- 공포 마케팅·과장 대신 **현실적인 기준, 실행 순서, 체크리스트**.

---

## 9. 만드는 방법 (기술)

```
대본 → TTS 녹음 → 음성 다듬기(이어붙이기·1.1배·음량) → 쉼 찾기 → 자막 시각(subs.json)
     → 앱 화면 캡처(데모) → 장면 파일(comp.html, render(t)) → 시험 프레임 확인 → 전체 렌더 → MP4 + SRT
```

| 단계 | 명령/도구 |
|---|---|
| 문장 사이 쉼 줄이기 | 쉼(-38dB, 0.25초 이상)을 찾아 **0.3초 넘는 부분만 55%로** 줄인다. 말소리는 건드리지 않고 쉼의 가운데만 잘라내므로 소리가 튀지 않는다 (`reel-ax/trim.py`). 4분 32초 음성에서 약 8초가 줄어 "쉼이 살짝 길다"는 느낌이 사라졌다 |
| 음성 다듬기 | `ffmpeg -i a1.wav -i a2.wav -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1,atempo=1.1,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]" -map "[a]" -ac 2 voice.wav` |
| 쉼 찾기 | `ffmpeg -i voice.wav -af silencedetect=noise=-38dB:d=0.35 -f null -` |
| 앱 화면 캡처 | Playwright, 데모 모드. PC 1440×900·배율 2, 휴대폰 390×844·배율 2 (`ax-intro/capture.mjs` 참고) |
| 장면 렌더 | Playwright 로 장면 파일을 1080×1920 으로 열고, 1/30초마다 `render(t)` → JPEG 캡처 → ffmpeg 로 바로 넘김 (`ax-intro/render.mjs` 와 같은 방식, 화면 크기만 바꿈) |
| 인코딩 | `-f image2pipe -framerate 30 -c:v mjpeg -i -` + 음성 `adelay` → `libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart`, `aac -b:a 192k` |
| 확인 | 장면마다 1~2장 시험 프레임 → 이어 붙인 한 장(contact sheet)으로 겹침·잘림 확인 → 전체 렌더 후 다시 몇 장 확인 |

자막은 ffmpeg 가 아니라 **장면 파일 안에서 HTML 로 그린다** (글꼴·색·위치를 디자인과 똑같이 맞추기 위해. ffmpeg 에 글자 기능이 없는 경우도 있다).

### 9:16 기본 틀 (장면 파일 시작점)

아래를 `comp.html` 로 저장하면 배경·격자·글자 규칙·등장 움직임·자막·안전 영역 확인선이 모두 들어 있는 상태에서 시작합니다. 장면은 `<div class="scene" data-in="시작" data-out="끝">` 으로 추가합니다.

```html
<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<style>
  :root { --bg:#0f1216; --shell:#171b20; --shell2:#22272e; --acc:#d47a4a; --acc2:#b75b2a; --hi:#e8b89a;
          --ink:#f4f1ec; --ink2:rgba(244,241,236,.72); --ink3:rgba(244,241,236,.46); --line:rgba(255,255,255,.09); }
  * { box-sizing:border-box; margin:0; padding:0; animation:none !important; transition:none !important; }
  html,body { width:1080px; height:1920px; overflow:hidden; background:var(--bg); color:var(--ink);
              font-family:'Pretendard Variable','Pretendard',sans-serif; -webkit-font-smoothing:antialiased; word-break:keep-all; }
  .bg { position:absolute; inset:-10%; background:
      radial-gradient(70% 40% at 85% 8%, rgba(212,122,74,.24), transparent 60%),
      radial-gradient(60% 35% at 10% 92%, rgba(232,184,154,.10), transparent 60%),
      linear-gradient(170deg, #12161b 0%, #171b20 45%, #0d1014 100%); }
  .grid { position:absolute; inset:0; opacity:.5;
      background-image:linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px);
      background-size:90px 90px; mask-image:radial-gradient(80% 55% at 50% 40%, #000 30%, transparent 85%); }
  .scene { position:absolute; inset:0; opacity:0; }
  .abs { position:absolute; }
  .eyebrow { font-size:26px; font-weight:700; letter-spacing:.3em; color:var(--hi); text-transform:uppercase; }
  .h1 { font-size:88px; font-weight:800; letter-spacing:-.025em; line-height:1.12; }
  .h2 { font-size:64px; font-weight:800; letter-spacing:-.02em; line-height:1.2; }
  .h3 { font-size:46px; font-weight:700; letter-spacing:-.01em; line-height:1.3; }
  .p  { font-size:36px; font-weight:500; color:var(--ink2); line-height:1.5; }
  .acc { color:var(--hi); }
  .glass { background:linear-gradient(160deg, rgba(255,255,255,.075), rgba(255,255,255,.025)); border:1px solid rgba(255,255,255,.12);
           border-radius:28px; box-shadow:0 40px 80px -30px rgba(0,0,0,.7); }
  .note { position:absolute; left:72px; top:1270px; font-size:22px; font-weight:500; color:var(--ink3); }
  /* 자막 */
  #sub { position:absolute; left:132px; right:132px; top:1330px; height:180px; display:flex; align-items:flex-end; justify-content:center; }
  #sub span { max-width:816px; padding:16px 30px; border-radius:20px; background:rgba(15,18,22,.80); border:1px solid rgba(255,255,255,.10);
              font-size:46px; font-weight:700; letter-spacing:-.01em; line-height:1.42; text-align:center; white-space:pre-line; }
  #sub b { color:var(--hi); font-weight:800; }
  /* 안전 영역 확인선 (?guide=1) */
  .guide { position:absolute; pointer-events:none; outline:2px dashed rgba(255,80,80,.7); display:none; }
  body.show-guide .guide { display:block; }
</style></head>
<body><div id="stage">
  <div class="bg" id="bg"></div><div class="grid"></div>

  <!-- 예시 장면: 첫 문장(후킹) -->
  <div class="scene" data-in="0" data-out="4">
    <div class="abs" style="left:72px;right:120px;top:520px">
      <div class="eyebrow" data-in="0.1" data-out="4" data-a="up">KPJK Consulting</div>
      <div class="h1" style="margin-top:28px" data-in="0.3" data-out="4" data-a="up">이 기업,<br>지금 <span class="acc">어디까지</span><br>왔을까요?</div>
      <div class="p" style="margin-top:36px" data-in="1.2" data-out="4" data-a="up">확인하는 데만 매번 시간이 듭니다</div>
    </div>
  </div>

  <div id="sub"><span></span></div>
  <div class="guide" style="left:0;right:0;top:0;height:220px"></div>
  <div class="guide" style="left:72px;width:888px;top:220px;height:1080px"></div>
  <div class="guide" style="left:132px;right:132px;top:1330px;height:180px"></div>
  <div class="guide" style="left:0;right:0;top:1520px;bottom:0"></div>
  <div class="guide" style="left:960px;right:0;top:220px;height:1300px"></div>
</div>
<script>
  // 자막: [시작, 끝, 문장] — **단어** 는 강조색, \n 은 줄바꿈
  const SUBS = window.SUBS || [
    [0.3, 2.2, '이 기업은 지금 **어디까지** 왔을까요?'],
    [2.3, 4.0, '확인하는 데만\n매번 시간이 듭니다'],
  ];
  if (new URLSearchParams(location.search).get('guide')) document.body.classList.add('show-guide');

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const eo = (x) => 1 - Math.pow(1 - x, 3);
  const eio = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const lerp = (a, b, x) => a + (b - a) * x;
  const vis = (t, tin, tout, d = .6) => Math.min(eo(clamp((t - tin) / d)), 1 - eio(clamp((t - (tout - d * .8)) / (d * .8))));
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const animated = [...document.querySelectorAll('[data-in]')];
  const subEl = document.querySelector('#sub span');
  let subIdx = -2;

  function render(t) {
    document.getElementById('bg').style.transform = `translate(${Math.sin(t / 9) * 30}px, ${Math.cos(t / 11) * 20}px) scale(1.04)`;
    for (const el of animated) {
      const tin = +el.dataset.in, tout = +el.dataset.out, a = el.dataset.a || 'fade';
      const isScene = el.classList.contains('scene');
      const p = eo(clamp((t - tin) / .8));
      el.style.opacity = el.tagName === 'IMG' ? vis(t, tin, tout, .35) : vis(t, tin, tout, isScene ? .55 : .7);
      if (a === 'up') el.style.transform = `translateY(${(1 - p) * 34}px)`;
      else if (a === 'left') el.style.transform = `translateX(${(1 - p) * -60}px)`;
      else if (a === 'scale') el.style.transform = `scale(${lerp(.94, 1, p)})`;
      else if (a === 'card') el.style.transform = `translateY(${(1 - p) * 60}px) scale(${lerp(.92, 1, p)})`;
    }
    // 화면 천천히 확대: data-kb="시작,끝,배율0,x0,y0,배율1,x1,y1"
    document.querySelectorAll('[data-kb]').forEach((im) => {
      const [a, b, s0, x0, y0, s1, x1, y1] = im.dataset.kb.split(',').map(Number);
      const k = eio(clamp((t - a) / (b - a)));
      im.style.transform = `translate(${lerp(x0, x1, k)}px, ${lerp(y0, y1, k)}px) scale(${lerp(s0, s1, k)})`;
    });
    // 자막
    const i = SUBS.findIndex(([a, b]) => t >= a - .12 && t < b + .12);
    if (i !== subIdx) { subIdx = i; if (i >= 0) subEl.innerHTML = esc(SUBS[i][2]).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
    if (i < 0) subEl.parentElement.style.opacity = 0;
    else { const [a, b] = SUBS[i]; subEl.parentElement.style.opacity = Math.min(clamp((t - a + .12) / .12), clamp((b + .12 - t) / .12)); }
  }
  window.render = render;
  render(0);
</script>
</body></html>
```

렌더 스크립트는 `ax-intro/render.mjs` 를 복사해 다음만 바꿉니다: 화면 크기 `{ width: 1080, height: 1920 }`, `DUR`(영상 길이), `OFFSET_MS`(음성 시작 여백), 결과 파일 이름. 자막 파일은 `SUBS` 를 `.srt` 로 바꿔 함께 저장합니다.

---

## 10. 다 만든 뒤 확인표

- [ ] 1080×1920, 30fps, 길이가 음성 + 앞뒤 여백과 맞다
- [ ] 첫 3초 안에 메시지가 나온다 (로고 인트로 없음)
- [ ] 모든 말에 자막이 있다. 자막이 2줄 이하, 한 줄 16자 이하
- [ ] 자막·제목이 안전 영역 밖(위 220px, 아래 400px, 오른쪽 120px)으로 나가지 않는다 (`?guide=1` 로 확인)
- [ ] 강조색은 한 문장에 한 군데
- [ ] 앱 화면 장면에 "예시 데이터" 표기
- [ ] 만들어 낸 숫자·과장 표현·금지 표현 없음, 특허는 "출원 완료"
- [ ] 음량 -14 LUFS 근처, 끝 1초 페이드아웃
- [ ] 휴대폰으로 직접 재생해 글자가 읽히는지 확인

---

## 11. Claude Code에 붙여 넣을 프롬프트

```
tools/video/VIDEO_STYLE_GUIDE.md 를 먼저 끝까지 읽고, 그 스타일 그대로 릴스(9:16, 1080×1920) 영상을 만들어줘.

[재료]
- 음성: (첨부한 TTS 파일들, 순서대로 이어 붙임) — 1.1배속, 음량 -14 LUFS
- 대본: (아래에 붙여 넣음)
- 보여줄 앱 화면: (예: 고객 Portal 홈, 자료 제출, 담당자 검토) — 데모 모드에서 직접 캡처

[해야 할 것]
1. 음성 다듬기 → 쉼 찾기 → 대본을 자막 조각으로 나눠 시각 맞추기 (2줄·한 줄 16자 이하)
2. 가이드 7장 흐름(후킹 → 문제 → 구조 → 실제 화면 → 정리·행동)으로 장면 표를 먼저 보여줘
3. 9장 기본 틀로 comp.html 작성, 장면마다 시험 프레임을 이어 붙인 한 장으로 확인 (?guide=1 로 안전 영역도)
4. 전체 렌더 → MP4 + SRT, 결과 프레임 몇 장 다시 확인 후 파일 보내줘
5. 10장 확인표를 하나씩 체크해서 결과를 알려줘

[지킬 것]
- 8장 내용 원칙 (만든 숫자·과장·금지 표현 없음, 특허는 출원 완료, 예시 데이터 표기)
- 자막은 HTML 안에서 그린다, CSS 애니메이션 쓰지 않는다
```

---

### 참고: 원본(16:9) 실사 안내 영상

- 장면 파일: `tools/video/ax-intro/comp.html` — 순환 도식(SVG 타원 + 노드 6개 + 따라 도는 점), 흩어지는 칩, 취소선, 켄 번즈, 타임라인 채우기 코드가 들어 있다. 9:16 장면을 만들 때 이 코드를 그대로 가져다 위치·크기만 바꾼다.
- 렌더: `tools/video/ax-intro/render.mjs` (2분 영상 약 6분 소요)

### 참고: 첫 릴스 (9:16)

- `tools/video/reel-ax/` — 이 가이드대로 만든 첫 릴스. 받아쓰기 → 쉼 줄이기 → 자막 맞추기 → 장면(원본 음성 기준 시각) → 렌더까지 전체 흐름이 들어 있다.
- 세로 흐름도(업무 발생 → 현재 상태 → 다음 할 일 + 되돌아오는 곡선), 세로 타원 순환도(노드 5개), 말풍선, 세로 타임라인, PC 화면 일부 확대 + 강조 테두리 예시가 있다.
