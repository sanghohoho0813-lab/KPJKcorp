# KPJK AX 영상 V3.1 (실사용 릴스 · 사용 방법) — 9:16, 자막, 실제 화면

`VIDEO_STYLE_GUIDE_V3_1_FINAL.md`(스타일 가이드 V3.1) 기준으로 두 영상을 다시 만든 도구입니다.
결과물: `public/media/kpjk-ax-reel.mp4` (3분 57초) · `public/media/kpjk-ax-howto.mp4` (3분 35초).

| 파일 | 하는 일 |
|---|---|
| `audio.sh` | 원본 음성 → 1.13배속 → `tighten.py`(0.35초 넘는 쉼만 줄임) → 2단계 음량 맞춤(-14 LUFS) → `voice_pre.wav` |
| `asr.py` | 최종 음성 받아쓰기(faster-whisper, 단어별 시각) → `asr.json` |
| `subs.py` | `chunks.txt`(대본 조각, 한 줄 = 자막 하나)를 단어 시각에 맞춰 `subs.json` · `subs.srt` · `align.json`(문구 → 시각) |
| `capture.mjs` | 데모 모드 화면 캡처 (PC 1440×1000, 휴대폰 390×879 = 9:19.7 틀에 딱 맞는 크기). 스크롤 장면용 긴 화면(`*-long.png`) + 고정 막대(`*-frame.png`) + `meta.json` |
| `lib.py` | 장면 도우미 — 가이드 14-2 + 실제 기기 비율 휴대폰(실제 스크롤) · PC 부분 확대 · 강조 테두리 · 이동하는 데이터 점 |
| `reel/build.py`, `howto/build.py` | 장면표 → `comp.html`. 장면 경계·등장 시각은 모두 대본 문구로 찾는다 |
| `comp.tpl.html` | 가이드 14-1 틀 + V3.1 보강(`data-path` 스크롤, `data-focus`, `data-move`) |
| `frames.mjs` · `sheets.sh` · `sheet.mjs` | 시험 프레임(`?guide=1` 안전 영역 선) → 한 장 모아 보기 |
| `render.mjs` · `verify.sh` | 전체 렌더(MP4) · 길이/음량/끝 무음 확인 |

## 순서

```bash
W=tools/video/out/v31 && mkdir -p $W && cp -r tools/video/v31/* $W/ && cd $W    # 작업 폴더 (저장소에 안 올라감)
export FFMPEG=ffmpeg CHROME=<chromium 경로(선택)>
bash audio.sh reel <원본.wav 절대경로>        # → reel/voice_pre.wav (확인 후 -14.0 이 아니면 volume 으로 미세 보정해 voice.wav)
cd reel
python3 ../asr.py <faster-whisper 경로> voice.wav asr.json "KPJK, AX, CRM, 기업마당"   # 고유명사를 힌트로
python3 ../subs.py                      # chunks.txt + asr.json → subs.json · subs.srt · align.json (일치율 95%↑, 0.9초 미만 없음)
cd ..
OUT=$PWD/cap node capture.mjs           # 앱을 데모 모드(npm start, .env.local 없음)로 띄운 상태에서
cd reel && python3 build.py && bash ../sheets.sh $PWD   # 장면 확인
node ../render.mjs $PWD/comp.html $PWD/voice.wav $PWD/out.mp4 <DUR> 600 && bash ../verify.sh out.mp4
```

- 글꼴: `comp.tpl.html` 은 `/root/.fonts/PretendardVariable.ttf` 를 직접 읽습니다. 다른 컴퓨터에서는 그 경로만 바꿉니다.
- 휴대폰 틀은 본문 영역(높이 1080px)에 실제 비율로 들어가도록 폭 490px(단독) · 380px(PC와 함께)입니다.
- 화면 속 기업·인물·공고는 모두 데모 예시 데이터이고, 장면마다 "예시 데이터" 표기가 붙습니다.
