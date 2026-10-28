# 녹음(받은 TTS · 육성) 한 파일 → 자막 시각 · 구간 시각 · 영상용 음성
#   W=<작업폴더> python3 align_voice.py <voice_raw.wav> <asr.json>
# voice_raw.wav: 쉼을 줄이고(v31/tighten.py) 음량을 맞춘 음성. asr.json: faster-whisper 단어 시각(받아쓰기)
# 대본(chunks.txt) 글자를 받아쓰기 글자에 맞춰(difflib) 각 자막의 첫 글자 ~ 끝 글자 시각을 얻는다.
# 맞지 않는 글자가 길게 이어지면(대본과 녹음이 다르면) 멈추고 그 곳을 알려 준다.
import array, difflib, json, os, re, subprocess, sys, wave
HERE = os.path.dirname(os.path.abspath(__file__))
W = os.path.abspath(os.environ.get("W") or HERE)
RAW, ASR = sys.argv[1], sys.argv[2]
LEAD, TAIL = 1.2, 4.0
norm = lambda s: re.sub(r"[^0-9A-Za-z가-힣]", "", s)
secs, cur = [], None
for l in open(os.path.join(HERE, "chunks.txt"), encoding="utf-8"):
    l = l.rstrip("\n")
    if not l.strip(): continue
    if l.startswith("# "): cur = {"id": l[2:4], "title": l[5:], "chunks": []}; secs.append(cur); continue
    cur["chunks"].append(l)
# 받아쓰기 글자 → 시각 (낱말 안에서는 글자 수로 나눈다)
hc, ht0, ht1 = [], [], []
for seg in json.load(open(ASR, encoding="utf-8")):
    for w in seg["words"]:
        n = norm(w["w"])
        for i, ch in enumerate(n):
            hc.append(ch); ht0.append(w["s"] + (w["e"] - w["s"]) * i / len(n)); ht1.append(w["s"] + (w["e"] - w["s"]) * (i + 1) / len(n))
H = "".join(hc)
S, owner = [], []          # 대본 글자 · (구간, 자막) 번호
for si, s in enumerate(secs):
    for ci, c in enumerate(s["chunks"]):
        for ch in norm(c.replace("**", "").replace("\\n", "")): S.append(ch); owner.append((si, ci))
S = "".join(S)
sm = difflib.SequenceMatcher(None, S, H, autojunk=False)
t0 = [None] * len(S); t1 = [None] * len(S); matched = 0
for a, b, n in sm.get_matching_blocks():
    for k in range(n): t0[a + k] = ht0[b + k]; t1[a + k] = ht1[b + k]
    matched += n
# 안 맞은 글자는 앞뒤 맞은 글자 사이를 고르게 채운다. 길게 비면 멈춘다
gaps, i = [], 0
while i < len(S):
    if t0[i] is None:
        j = i
        while j < len(S) and t0[j] is None: j += 1
        a = t1[i - 1] if i > 0 else 0.0
        b = t0[j] if j < len(S) else a + .1 * (j - i)
        for k in range(i, j): t0[k] = a + (b - a) * (k - i) / (j - i); t1[k] = a + (b - a) * (k - i + 1) / (j - i)
        gaps.append((j - i, S[i:j]))
        i = j
    else: i += 1
print(f"대본 {len(S)}자 · 받아쓰기와 일치 {matched / len(S) * 100:.1f}%")
long_ = [g for g in gaps if g[0] >= 6]
for g in sorted(gaps, reverse=True)[:6]: print("  안 맞은 곳", g[0], "자:", g[1][:30])
if long_: raise SystemExit("대본과 녹음이 다른 곳이 있습니다 — 위 '안 맞은 곳'을 확인하세요")
# 문장 사이 쉼 넣기(pauses.json: {"자막 첫머리": 초}) — 말 속도는 그대로, 화면을 눈으로 따라갈 시간만 더한다.
# 넣는 자리는 앞 문장 끝 ~ 이 문장 첫 글자 사이에서 가장 조용한 10ms (받아쓰기 시각이 조금 어긋나도 말을 자르지 않게)
PF = os.environ.get("PAUSES") or os.path.join(HERE, "pauses.json")
PAUSES = json.load(open(PF, encoding="utf-8")) if os.path.exists(PF) else {}
wf = wave.open(RAW, "rb"); SR, NCH, SW = wf.getframerate(), wf.getnchannels(), wf.getsampwidth()
if SW != 2: raise SystemExit("16비트 wav 만 받습니다")
PCM = wf.readframes(wf.getnframes()); wf.close()
def quietest(a, b):
    """a~b 에서 가장 길게 이어진 무음(-50dB 아래)의 한가운데. 받아쓰기 낱말 시각은 0.3~0.5초 어긋나기도 해 넓게 본다.
    쉼표로 이어 읽어 완전한 무음이 없으면, 숨소리 정도(-40dB 아래)로 가장 조용한 10ms — 말소리(-10~-25dB)는 자르지 않는다"""
    f = int(SR * .01); lo = 32768 ** 2 * 10 ** (-50 / 10); run, best, q = None, (0, a), (None, a)
    for k in range(int(a * SR), int(b * SR) - f, f):
        x = array.array("h", PCM[k * NCH * 2:(k + f) * NCH * 2])[::2]; e = sum(v * v for v in x) / len(x)
        if q[0] is None or e < q[0]: q = (e, (k + f / 2) / SR)
        if e < lo:
            run = run if run is not None else k
            if (k + f - run) / SR > best[0]: best = ((k + f - run) / SR, (run + k + f) / 2 / SR)
        else: run = None
    if best[0] >= .06: return best[1]
    if q[0] is not None and q[0] < 32768 ** 2 * 10 ** (-40 / 10): return q[1]
    raise SystemExit(f"{a:.2f}~{b:.2f}초 사이에 쉼이 없습니다 — 말을 자르게 됩니다")
ins, used, pos = [], set(), 0
for s in secs:
    for c in s["chunks"]:
        nc = norm(c.replace("**", "").replace("\\n", ""))
        key = next((k for k in PAUSES if nc.startswith(norm(k))), None)
        if key and pos > 0:
            ins.append((quietest(t1[pos - 1] - .3, t0[pos] + .5), round(float(PAUSES[key]), 3), pos)); used.add(key)
        pos += len(nc)
if set(PAUSES) - used: raise SystemExit(f"pauses.json 의 자막을 대본에서 못 찾음: {sorted(set(PAUSES) - used)}")
# 시각이 아니라 글자 순서로 민다 — 첫 글자(ㄱ 같은 막힘소리) 앞 무음 안에서 잘라도 그 문장 전체가 쉼 뒤로 간다
for x, p, k0 in ins:
    for k in range(k0, len(S)): t0[k] += p; t1[k] += p
if ins:
    out, k0 = [], 0
    F = int(SR * .01)    # 자른 자리 앞뒤 10ms 를 부드럽게 줄였다 키운다(숨소리 위에서 잘라도 딸깍 소리가 나지 않게)
    def ramp(buf, up):
        x = array.array("h", buf); n = len(x) // NCH
        for i in range(n):
            g = (i + 1) / n if up else 1 - i / n
            for c in range(NCH): x[i * NCH + c] = int(x[i * NCH + c] * g)
        return x.tobytes()
    for x, p, _ in sorted(ins):
        k = int(x * SR) * NCH * 2; seg = PCM[k0:k]
        if k0: seg = ramp(seg[:F * NCH * 2], True) + seg[F * NCH * 2:]
        out += [seg[:-F * NCH * 2] + ramp(seg[-F * NCH * 2:], False), bytes(int(p * SR) * NCH * 2)]; k0 = k
    tail = PCM[k0:]; out.append(ramp(tail[:F * NCH * 2], True) + tail[F * NCH * 2:]); PCM = b"".join(out)
    RAW = os.path.join(W, "voice_paused.wav")
    with wave.open(RAW, "wb") as wo: wo.setnchannels(NCH); wo.setsampwidth(2); wo.setframerate(SR); wo.writeframes(PCM)
    print(f"쉼 {len(ins)}곳 · 더한 길이 {sum(p for _, p, _ in ins):.2f}초 · 녹음 시각", ", ".join(f"{x:.2f}+{p}" for x, p, _ in sorted(ins)))
# 자막 · 구간
subs, ST, TTS = [], [], []
pos = 0
for si, s in enumerate(secs):
    words = []; sec0 = None
    for ci, c in enumerate(s["chunks"]):
        n = len(norm(c.replace("**", "").replace("\\n", "")))
        a, b = t0[pos], t1[pos + n - 1]
        if sec0 is None: sec0 = a
        subs.append({"in": round(LEAD + a, 3), "out": round(LEAD + b, 3), "text": c.replace("\\n", "\n"), "sec": s["id"]})
        # build.py 의 문구 → 시각(at)용: 자막을 낱말로 나눠 글자 시각을 그대로 넘긴다
        k = pos
        for wd in c.replace("**", "").replace("\\n", " ").split():
            m = len(norm(wd))
            if m: words.append({"t": round(t0[k] - sec0, 3), "d": round(t1[k + m - 1] - t0[k], 3), "w": wd}); k += m
        pos += n
    end = t1[pos - 1]
    ST.append({"id": s["id"], "title": s["title"], "start": round(LEAD + sec0, 3), "end": round(LEAD + end, 3)})
    TTS.append({"id": s["id"], "title": s["title"], "chunks": s["chunks"], "words": words, "dur": round(end - sec0, 3)})
for i, x in enumerate(subs):
    nxt = subs[i + 1]["in"] if i + 1 < len(subs) else x["out"] + 1.0
    x["out"] = round(max(x["out"] + 0.15, x["in"] + 0.9) if nxt - x["out"] > 0.6 else nxt - 0.05, 3)
short = [x for x in subs if x["out"] - x["in"] < 0.899]
raw_len = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", RAW]).decode())
dur = round(LEAD + max(ST[-1]["end"] - LEAD, raw_len - .3) + TAIL, 2)
os.makedirs(os.path.join(W, "tts"), exist_ok=True)
json.dump(subs, open(os.path.join(W, "subs.json"), "w"), ensure_ascii=False, indent=0)
json.dump({"dur": dur, "secs": ST}, open(os.path.join(W, "secs_t.json"), "w"), ensure_ascii=False, indent=1)
json.dump({"rate": "녹음", "voice": os.path.basename(RAW), "secs": TTS}, open(os.path.join(W, "tts", "secs.json"), "w"), ensure_ascii=False, indent=0)
fmt = lambda t: f"{int(t//3600):02}:{int(t%3600//60):02}:{int(t%60):02},{int(round(t%1*1000)) % 1000:03}"
with open(os.path.join(W, "subs.srt"), "w", encoding="utf-8") as f:
    for i, x in enumerate(subs, 1): f.write(f"{i}\n{fmt(x['in'])} --> {fmt(x['out'])}\n{x['text'].replace('**', '')}\n\n")
ms = int(LEAD * 1000)
subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", RAW, "-af", f"adelay={ms}|{ms},apad,atrim=0:{dur},aresample=48000",
                "-ac", "2", os.path.join(W, "voice.wav")], check=True)
print(f"자막 {len(subs)}개 · 0.9초 미만 {len(short)}개 · 영상 길이 {dur}s")
for s in ST: print(s["id"], s["start"], "~", s["end"], s["title"])
