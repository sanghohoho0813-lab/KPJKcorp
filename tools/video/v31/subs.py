#  subs.py — 대본(chunks.txt)을 최종 음성의 단어 시각(asr.json)에 맞춥니다. 글자는 대본 그대로, 시각만 음성에서. (V3.1 8장)
import json, re, difflib, sys
OFFSET = 0.6
norm = lambda s: re.sub(r"[^0-9A-Za-z가-힣]", "", s)
CH = [l.replace("\\n", "\n") for l in open("chunks.txt").read().strip().split("\n")]
sc, owner = [], []
for i, c in enumerate(CH):
    n = norm(c.replace("**", "")); sc += list(n); owner += [i] * len(n)
script = "".join(sc)
ac, at0, at1 = [], [], []
for sg in json.load(open("asr.json")):
    for w in sg["words"]:
        n = norm(w["w"])
        if not n: continue
        d = (w["e"] - w["s"]) / len(n)
        for k, ch in enumerate(n):
            ac.append(ch); at0.append(w["s"] + k * d); at1.append(w["s"] + (k + 1) * d)
asr = "".join(ac)
sm = difflib.SequenceMatcher(None, script, asr, autojunk=False)
t0 = [None] * len(script); t1 = [None] * len(script); matched = 0
for a, b, size in sm.get_matching_blocks():
    for k in range(size):
        t0[a + k] = at0[b + k]; t1[a + k] = at1[b + k]; matched += 1
known = [i for i in range(len(script)) if t0[i] is not None]
import bisect
for i in range(len(script)):
    if t0[i] is None:
        j = bisect.bisect_left(known, i)
        prev = known[j - 1] if j > 0 else None
        nxt = known[j] if j < len(known) else None
        if prev is None: t0[i] = t1[i] = t0[nxt]
        elif nxt is None: t0[i] = t1[i] = t1[prev]
        else:
            f = (i - prev) / (nxt - prev); t0[i] = t1[prev] + (t0[nxt] - t1[prev]) * f; t1[i] = t0[i]
print(f"대본 {len(script)}자 중 음성과 맞은 글자 {matched} ({matched/len(script):.1%})")
out = []
low = []
for i, c in enumerate(CH):
    idx = [k for k, o in enumerate(owner) if o == i]
    m = sum(1 for k in idx if k in set(known)) if False else None
    out.append({"in": t0[idx[0]] + OFFSET, "out": t1[idx[-1]] + OFFSET, "text": c})
kset = set(known)
for i, c in enumerate(CH):
    idx = [k for k, o in enumerate(owner) if o == i]
    r = sum(1 for k in idx if k in kset) / len(idx)
    if r < .6: low.append((i, round(r, 2), c))
for i, s in enumerate(out):
    nxt = out[i + 1]["in"] if i + 1 < len(out) else s["out"] + 1.0
    s["in"] = max(0.0, s["in"] - 0.05); s["out"] = min(s["out"] + 0.35, nxt - 0.08)
for i, s in enumerate(out):
    if s["out"] - s["in"] < 0.9:
        lim = out[i + 1]["in"] - 0.08 if i + 1 < len(out) else s["in"] + 0.9
        s["out"] = min(max(s["out"], s["in"] + 0.9), lim)
for s in out: s["in"], s["out"] = round(s["in"], 2), round(s["out"], 2)
json.dump(out, open("subs.json", "w"), ensure_ascii=False, indent=1)
def ts(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s_, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s_:02},{ms:03}"
with open("subs.srt", "w") as f:
    for i, s in enumerate(out, 1):
        f.write(f"{i}\n{ts(s['in'])} --> {ts(s['out'])}\n{s['text'].replace('**', '')}\n\n")
json.dump({"script": script, "t0": [round(x + OFFSET, 3) for x in t0]}, open("align.json", "w"), ensure_ascii=False)
short = [s for s in out if s["out"] - s["in"] < 0.9]
order = all(out[i]["in"] < out[i + 1]["in"] for i in range(len(out) - 1))
print("조각", len(out), "· 0.9초 미만", len(short), "· 순서", order, "· 60% 미만 조각", low)
