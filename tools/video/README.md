# 영상 자동 녹화

앱 화면을 실제로 조작하면서 녹화해 두 편의 영상을 만듭니다. 대본은 `SCRIPT.md`.

> 새 영상은 **[VIDEO_STYLE_GUIDE.md](VIDEO_STYLE_GUIDE.md)** (릴스 9:16 · 자막 필수 · 색·글자·움직임 표준)를 따릅니다.

| 파일 | 만드는 영상 |
|---|---|
| `record-60s.mjs` | 실사 담당자용 1분 — `out/60s/KPJK_AX_실사용_60초.mp4` |
| `record-tutorial.mjs` | 대표·직원용 튜토리얼 2분 — `out/tutorial/KPJK_AX_튜토리얼_2분.mp4` |
| `rec.mjs` | 녹화 엔진 — Chrome 화면 프레임을 받아 ffmpeg 로 인코딩, 자막·커서·강조 표시를 화면 위에 그림 |
| `cards.mjs` | 타이틀·설명·마무리 카드, 휴대폰 목업 |

## 어떻게 녹화하나

- Chrome 의 화면 전송 기능(CDP screencast)으로 **실제 화면을 프레임 단위**로 받습니다. 화면 녹화 프로그램과 같은 결과입니다.
- 자막·마우스 커서·주황 강조 상자는 녹화 중인 페이지 위에 덧그립니다. **앱 코드는 한 줄도 바꾸지 않습니다.**
  녹화할 때만 알림(토스트)을 자막 위로 올리고, 목록 맨 아래 여백을 늘려 마지막 항목도 자막 위로 올 수 있게 합니다.
- 고객·담당자·대표 계정을 오갈 때의 로그인은 녹화 밖에서 처리하고, 장면 사이는 0.35초 교차 전환으로 잇습니다.
- 기본은 데모 모드(브라우저 저장소)의 샘플 데이터로 녹화합니다. 실제 고객 데이터로 녹화하지 마세요.
- **서버·Pilot 녹화** (`record-60s.mjs` 만): 실제 서버에 붙은 앱을 파일럿 계정으로 녹화합니다. 아래 "서버·Pilot 환경에서 녹화" 참고.
  자막·타이틀·마무리 카드의 "시연용 샘플" 문구가 "비식별 Pilot 기업 · 실제 서버 연결 상태에서 녹화"로 바뀝니다.
- 어느 쪽이든 **개선율·ROI·검증되지 않은 성과 수치는 넣지 않습니다.**

## 실행

```bash
# 1) 앱을 띄운다 (다른 터미널)
npm run build && npm start

# 2) 처음 한 번만 — 녹화 도구 설치 (저장소 의존성에는 넣지 않는다)
npm i --no-save playwright && npx playwright install chromium
pip install imageio-ffmpeg          # ffmpeg 가 이미 있으면 생략

# 3) 녹화
node tools/video/record-60s.mjs
node tools/video/record-tutorial.mjs
```

환경변수로 경로를 바꿀 수 있습니다.

| 변수 | 기본값 |
|---|---|
| `APP_URL` | `http://localhost:3000` |
| `CHROME_PATH` | Playwright 가 설치한 Chromium |
| `FFMPEG` | `imageio-ffmpeg` 의 ffmpeg, 없으면 `ffmpeg` |
| `OUT` | `tools/video/out/…` |

폰트는 앱과 같은 Pretendard 가 필요합니다. 인터넷이 되는 PC 에서는 앱이 자동으로 불러오므로 따로 할 일이 없습니다.

## 서버·Pilot 환경에서 녹화 (`record-60s.mjs`)

앱이 서버(Supabase)에 연결된 상태(`.env.local`)로 빌드·실행 중이어야 합니다. 녹화 브라우저는 앱 주소와 서버 주소만 엽니다.

**녹화 전 준비** — 대상(비식별) 기업에 고객 계정이 있고, 그 기업 프로젝트에 **'요청' 또는 '보완요청' 상태 자료요청 1건**이 있어야 합니다.
녹화하면서 실제로 제출·검토 완료까지 진행되므로, 다시 녹화하려면 자료요청을 새로 하나 만드세요.

```bash
VIDEO_SERVER=1 \
VIDEO_COMPANY_ID=co_xxxxxxxx VIDEO_COMPANY_NAME="Pilot 검증기업 A (비식별)" VIDEO_DOC="파일럿 시연자료 A-2" \
VIDEO_CEO_ID=… VIDEO_CEO_PW=… VIDEO_CONSULTANT_ID=… VIDEO_CONSULTANT_PW=… VIDEO_CLIENT_ID=… VIDEO_CLIENT_PW=… \
node tools/video/record-60s.mjs
```

- 기업 ID 는 기업 상세 화면 주소(`/ax/clients/co_…`)에서 확인합니다.
- 서버 주소는 `.env.local` 에서 읽습니다(다른 곳이면 `SUPABASE_URL`).
- 고객이 올리는 파일은 "Pilot 시연용 제출 파일입니다. 실제 서류가 아닙니다." 한 줄짜리 텍스트 파일입니다.
- 2026-09-30 로컬 Supabase 에서 녹화 확인: 60.9초 · 화면 오류 0 · 녹화 중 제출·자동 검토업무·검토 완료가 서버 기록에 남음.
