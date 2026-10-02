# KPJK AX 소개 릴스 (9:16, 자막, 약 4분)

`../VIDEO_STYLE_GUIDE.md` 규격으로 만든 첫 릴스입니다. 녹음된 TTS 한 개에서 대본을 받아쓰기로 되살리고,
문장 사이 쉼을 살짝 줄인 뒤(1.1배속 포함) 장면·자막을 그 시각에 맞춥니다.

| 파일 | 하는 일 |
|---|---|
| `asr.py` | 음성 받아쓰기(faster-whisper, 단어별 시각). 대본 글이 없을 때 사용 |
| `trim.py` | 0.3초 넘는 쉼만 55%로 줄인 `trimmed.wav` + 원본↔새 시각 대응표 `knots.json` |
| `chunks.txt` | 자막 조각 (사람이 나눔). `|` 는 줄바꿈, `**단어**` 는 강조. 한 줄 16자 이하 |
| `align.py` | `chunks.txt` 를 받아쓰기 단어 시각에 맞춰 `subs.json`(영상 시각) + `.srt` 생성. 글자가 하나라도 다르면 멈춤 |
| `capture.mjs` | 데모 모드 화면 캡처. 예시 자료 요청을 재무제표 · 법인등기부등본 · 주주명부 중심으로 바꾼 뒤, 휴대폰 제출 → 업무 자동 생성 → 검토 완료 → 휴대폰 반영을 찍음 |
| `comp.html` | 장면 구성 (1080×1920). 시각은 **원본 음성 기준**으로 적고, `knots.json` 으로 자동 환산 |
| `render.mjs` | 시험 프레임 / 전체 렌더 (MP4) |

`phone-programs.png` 는 예시 공고를 먼저 추가해야 나오므로 `../ax-intro/capture.mjs` 결과를 씁니다.

## 순서

```bash
A=tools/video/out/reel-ax            # 작업 폴더 (저장소에 안 올라감)
cd $A
python3 ../../reel-ax/asr.py <faster-whisper 설치 경로> raw.wav asr.json   # 대본 글이 있으면 생략 가능
ffmpeg -i raw.wav -af silencedetect=noise=-38dB:d=0.25 -f null - 2>&1 | grep -oE "silence_(start|end): [0-9.]+" | awk '{print $2}' | paste - - > sil.txt
python3 ../../reel-ax/trim.py
ffmpeg -i trimmed.wav -af "atempo=1.1,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000" -ac 2 voice.wav
cp ../../reel-ax/chunks.txt . && python3 ../../reel-ax/align.py
cd - && node tools/video/reel-ax/capture.mjs          # 앱을 데모 모드로 띄운 상태에서
node tools/video/reel-ax/render.mjs frames 10,60,120 guide   # 안전 영역 선과 함께 확인
node tools/video/reel-ax/render.mjs video
```

음성이 바뀌면 `comp.html` 의 장면 시각(원본 음성 기준)과 `render.mjs` 의 `DUR` 를 맞춥니다.
