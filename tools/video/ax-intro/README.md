# 실사 안내 영상 (AX 구조 설명, 약 2분)

기술보증기금 실사 초반에 보여줄 설명 영상입니다. 녹음한 TTS 음성에 맞춰 장면을 한 프레임씩 그려 MP4 로 만듭니다.
상위 폴더의 `record-*.mjs`(실제 화면 녹화)와 달리, 여기서는 **미리 찍어 둔 앱 화면 + 도식·자막 장면**을 합성합니다.

| 파일 | 하는 일 |
|---|---|
| `capture.mjs` | 데모 모드 앱에서 PC(1440×900)·휴대폰(390×844) 화면 21장을 찍어 `shots/` 에 저장 |
| `comp.html` | 장면 구성. `render(t)` 하나로 t초의 화면을 결정적으로 그림 (CSS 애니메이션 없음) |
| `render.mjs` | `render(t)` 를 30fps 로 돌려 캡처 → ffmpeg 로 음성과 합쳐 MP4 |

## 흐름 (영상 시각 기준, 음성은 1.2초 뒤에 시작)

| 구간 | 내용 |
|---|---|
| 0–19s | 현장 약 8년 · 흩어진 정보 · "지금 어디까지 / 다음에 무엇을" |
| 19–40s | 명단 관리 도구가 아니라 업무 흐름의 구조 — 이벤트 → 기업 상태 → 다음 행동 → 실행 → 상태 갱신 순환 도식 |
| 40–50s | 이미 작동하는 시스템 (화면 6장) |
| 50–62s | Closed Loop — 고객 휴대폰 제출 → 검토 업무 자동 생성 → 담당자 검토·상태 변경 → 고객 화면 반영 |
| 62–79s | 고객 Portal (현재 상태 → 할 일 → 진행 과제 → 다음 검토 → 고객 요청 → 내부 업무), 지원사업 공고 선별은 "기능 중 하나"로 5초 |
| 79–95s | 개발 주체(KPJK 주도 / 외부 전문 개발사 협력), 경과, **특허 출원 완료** (등록 아님) |
| 95–114s | 초기 실증 단계 · 사업화 4단계 |
| 114–121s | 마무리 |

## 표현 원칙 (바꿀 때도 지킬 것)

- 특허는 반드시 "출원 완료"와 출원번호만. "등록", "검증된 특허기술" 금지.
- "AI가 자동 진단", "정책자금 자동 추천·금액 판단", "상용화 완료", "모든 코드를 직접 개발", "이미 많은 기업이 사용" 금지.
- 성과·개선율·고객 수 같은 숫자를 만들지 않는다. 경과 타임라인의 월도 확인된 것(6월)만 적는다.
- 화면은 데모 예시 데이터만 쓰고, 화면이 나오는 장면에는 "예시 데이터" 표기를 둔다.

## 실행

```bash
# 녹음 파일: 여러 개면 이어 붙이고 1.1배속 (예)
ffmpeg -i a1.wav -i a2.wav -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1,atempo=1.1,aresample=48000[a]" -map "[a]" -ac 2 tools/video/out/ax-intro/voice.wav

# 앱을 데모 모드로 띄운 뒤 화면 캡처
OUT=tools/video/out/ax-intro/shots node tools/video/ax-intro/capture.mjs

# 확인용 프레임 몇 장 → out/ax-intro/test/
node tools/video/ax-intro/render.mjs frames 5,30,56,70,90
# 전체 렌더 → out/ax-intro/KPJK_AX_실사_안내.mp4
node tools/video/ax-intro/render.mjs video
```

환경변수: `ASSETS`(shots·voice.wav·결과물 폴더, 기본 `tools/video/out/ax-intro`), `FFMPEG`(기본 `ffmpeg`), `CHROME`(Chromium 경로).
음성 길이가 바뀌면 `comp.html` 의 `data-in` / `data-out` 시각과 `render.mjs` 의 `DUR` 를 함께 맞춥니다.
