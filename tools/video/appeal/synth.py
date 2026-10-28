# chunks.txt → 구간(S1~S8)별 TTS 음성 + 단어 시각.  사용: python synth.py <rate 예: +4%> <voice>
import asyncio, json, re, ssl, subprocess, sys, os
import edge_tts, edge_tts.communicate as C
C._SSL_CTX = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")   # 프록시 인증서로 검증(TLS 검증 유지)
W = os.path.abspath(os.environ.get("W") or os.path.dirname(os.path.abspath(__file__)))   # 작업 폴더(음성 · 결과물)
rate = sys.argv[1] if len(sys.argv) > 1 else "+0%"
voice = sys.argv[2] if len(sys.argv) > 2 else "ko-KR-InJoonNeural"
secs, cur = [], None
for l in open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "chunks.txt"), encoding="utf-8"):
    l = l.rstrip("\n")
    if not l.strip(): continue
    if l.startswith("# "): cur = {"id": l[2:4], "title": l[5:], "chunks": []}; secs.append(cur); continue
    cur["chunks"].append(l)
plain = lambda s: s.replace("**", "").replace("\\n", " ")
async def one(sec):
    text = " ".join(plain(c) for c in sec["chunks"])
    com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    words = []; out = os.path.join(W, "tts", f"{sec['id']}.mp3")
    with open(out, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary": words.append({"t": ch["offset"] / 1e7, "d": ch["duration"] / 1e7, "w": ch["text"]})
    sec["words"] = words
    sec["dur"] = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).decode())
async def main():
    os.makedirs(os.path.join(W, "tts"), exist_ok=True)
    for s in secs: await one(s)
    json.dump({"rate": rate, "voice": voice, "secs": secs}, open(os.path.join(W, "tts", "secs.json"), "w"), ensure_ascii=False, indent=0)
    tot = 0
    for s in secs: print(s["id"], f"{s['dur']:.1f}s", s["title"]); tot += s["dur"]
    print(f"합계 {tot:.1f}s (+ 구간 사이 쉼)")
asyncio.run(main())
