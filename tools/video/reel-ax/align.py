import json, re
OFFSET = 0.5
segs = json.load(open('asr.json')); knots = json.load(open('knots.json'))
def M(t):
    for (a, ta), (b, tb) in zip(knots, knots[1:]):
        if a <= t <= b: return OFFSET + (ta + (tb - ta) * ((t - a) / (b - a) if b > a else 0)) / 1.1
    return OFFSET + knots[-1][1] / 1.1
norm = lambda s: re.sub(r'[\s,.?!*|]', '', s)
words = [[w['s'], w['e'], w['w'].strip().replace('다응에', '다음에')] for s in segs for w in s['words']]
chars = []  # (글자, 단어 번호)
for i, w in enumerate(words):
    for ch in norm(w[2]): chars.append((ch, i))
lines = [l.strip() for l in open('chunks.txt') if l.strip()]
pos, out, bad = 0, [], []
for l in lines:
    n = norm(l); got = ''.join(c for c, _ in chars[pos:pos + len(n)])
    if got != n: print('MISMATCH', l, '| asr:', got); break
    wi, wj = chars[pos][1], chars[pos + len(n) - 1][1]
    out.append([words[wi][0], words[wj][1], l.replace('|', '\n')]); pos += len(n)
    for part in l.split('|'):
        if len(part.replace('**', '')) > 16: bad.append(part)
print('aligned', len(out), 'of', len(lines), '| leftover chars', len(chars) - pos, '| over16:', bad)
# 영상 시각으로, 짧은 틈 메우기, 최소 0.9초
v = [[M(a), M(b), s] for a, b, s in out]
for i in range(len(v) - 1):
    if v[i + 1][0] - v[i][1] < 0.6: v[i][1] = v[i + 1][0] - 0.03
for x in v:
    if x[1] - x[0] < 0.9: x[1] = x[0] + 0.9
for i in range(len(v) - 1):
    if v[i][1] > v[i + 1][0] - 0.03: print('overlap', v[i][2][:12], round(v[i][1] - v[i + 1][0], 2)); v[i][1] = v[i + 1][0] - 0.03
v = [[round(a, 2), round(b, 2), s] for a, b, s in v]
json.dump(v, open('subs.json', 'w'), ensure_ascii=False, indent=0)
def ts(x):
    ms = int(round(x * 1000)); return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'
with open('KPJK_AX_릴스_자막.srt', 'w') as f:
    for i, (a, b, s) in enumerate(v, 1): f.write(f'{i}\n{ts(a)} --> {ts(b)}\n{s.replace("**", "")}\n\n')
json.dump(knots, open('knots.json', 'w'))
