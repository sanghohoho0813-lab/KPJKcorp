# 구간 음성 이어 붙이기 + 자막 시각(subs.json · subs.srt) + 구간 시각(secs_t.json)
import json, os, re, subprocess
W = os.path.abspath(os.environ.get("W") or os.path.dirname(os.path.abspath(__file__)))
D = json.load(open(os.path.join(W, "tts", "secs.json")))
LEAD, GAP = 1.2, 1.0          # 영상 앞 여백 · 구간 사이 쉼(초)
norm = lambda s: re.sub(r"[^0-9A-Za-z가-힣]", "", s)
subs, secs_t, t0, parts = [], [], LEAD, []
for s in D["secs"]:
    # 단어 시각 → 글자마다 (시작, 끝)
    chars = []
    for w in s["words"]:
        n = norm(w["w"])
        for i, ch in enumerate(n):
            chars.append((ch, w["t"], w["t"] + w["d"]))
    pos = 0
    for c in s["chunks"]:
        n = norm(c.replace("**", "").replace("\\n", ""))
        got = "".join(x[0] for x in chars[pos:pos + len(n)])
        if got != n: raise SystemExit(f"맞지 않음 {s['id']}: '{n}' vs '{got}'")
        a, b = chars[pos][1], chars[pos + len(n) - 1][2]
        subs.append({"in": round(t0 + a, 3), "out": round(t0 + b, 3), "text": c.replace("\\n", "\n"), "sec": s["id"]})
        pos += len(n)
    if pos != len(chars): raise SystemExit(f"남은 글자 {s['id']}")
    secs_t.append({"id": s["id"], "title": s["title"], "start": round(t0, 3), "end": round(t0 + s["dur"], 3)})
    parts.append((os.path.join(W, "tts", f"{s['id']}.mp3"), t0))
    t0 += s["dur"] + GAP
# 자막 사이를 메워 깜빡임 줄이기 · 최소 0.9초
for i, x in enumerate(subs):
    nxt = subs[i + 1]["in"] if i + 1 < len(subs) else x["out"] + 1.0
    x["out"] = round(max(x["out"] + 0.15, x["in"] + 0.9) if nxt - x["out"] > 0.6 else nxt - 0.05, 3)
short = [x for x in subs if x["out"] - x["in"] < 0.9]
dur = round(t0 - GAP + 4.0, 2)          # 마지막 말 뒤 4초 (마무리 화면)
json.dump(subs, open(os.path.join(W, "subs.json"), "w"), ensure_ascii=False, indent=0)
json.dump({"dur": dur, "secs": secs_t}, open(os.path.join(W, "secs_t.json"), "w"), ensure_ascii=False, indent=1)
fmt = lambda t: f"{int(t//3600):02}:{int(t%3600//60):02}:{int(t%60):02},{int(round(t%1*1000)) % 1000:03}"
with open(os.path.join(W, "subs.srt"), "w") as f:
    for i, x in enumerate(subs, 1): f.write(f"{i}\n{fmt(x['in'])} --> {fmt(x['out'])}\n{x['text'].replace('**', '')}\n\n")
# 음성: 구간을 제 시각에 놓고 섞기 → 음량 -14 LUFS
inp, flt = [], []
for i, (p, t) in enumerate(parts):
    inp += ["-i", p]; ms = int(round(t * 1000)); flt.append(f"[{i}:a]aresample=48000,adelay={ms}|{ms}[a{i}]")
flt.append("".join(f"[a{i}]" for i in range(len(parts))) + f"amix=inputs={len(parts)}:normalize=0,apad,atrim=0:{dur},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[o]")
subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *inp, "-filter_complex", ";".join(flt), "-map", "[o]", "-ac", "2", os.path.join(W, "voice.wav")], check=True)
print(f"자막 {len(subs)}개 · 0.9초 미만 {len(short)}개 · 영상 길이 {dur}s")
for s in secs_t: print(s["id"], s["start"], "~", s["end"], s["title"])
