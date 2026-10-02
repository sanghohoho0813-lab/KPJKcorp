import wave, json
w = wave.open('raw.wav'); sr = w.getframerate(); n = w.getnframes(); data = w.readframes(n); w.close()
dur = n / sr
sil = [tuple(map(float, l.split())) for l in open('sil.txt') if l.strip()]
def keep(g):  # 쉼 길이 → 줄인 길이 (0.3초 넘는 부분만 55%로)
    return g if g <= 0.3 else 0.3 + (g - 0.3) * 0.55
out = bytearray(); knots = []  # (원본 시각, 새 시각)
pos = 0.0; t_new = 0.0
def take(a, b):
    global t_new
    i, j = int(a * sr) * 2, int(b * sr) * 2
    out.extend(data[i:j]); t_new += (j - i) / 2 / sr
for (s, e) in sil:
    e = min(e, dur)
    take(pos, s); knots.append((s, t_new))
    g = e - s
    if s < 0.01: k = min(g, 0.12)
    elif e >= dur - 0.01: k = min(g, 0.6)
    else: k = keep(g)
    h = k / 2
    take(s, s + h); take(e - h, e)
    knots.append((e, t_new)); pos = e
take(pos, dur); knots.append((dur, t_new))
if knots[0][0] > 0: knots.insert(0, (0.0, 0.0))  # 맨 앞에 무음이 없을 때도 0초부터 대응
o = wave.open('trimmed.wav', 'wb'); o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes(bytes(out)); o.close()
json.dump(knots, open('knots.json', 'w'))
print('raw', round(dur, 2), '→ trimmed', round(t_new, 2), '→ 1.1x', round(t_new / 1.1, 2))
