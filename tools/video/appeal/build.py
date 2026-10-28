# 기술검증(이의신청) 영상 — 장면표 → comp.html (1920×1080)
# 입력(작업 폴더 W): subs.json · secs_t.json · tts/secs.json(단어 시각) · cap/*.png · cap/meta.json · logs/daily.log · fonts/
# 코드 화면은 저장소의 실제 파일에서 줄 번호 그대로 읽는다. 장면 시각은 대본 문구로 찾는다(at).
import html, json, os, re, sys
W = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
REPO = os.path.abspath(os.environ.get("REPO") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
HERE = os.path.dirname(os.path.abspath(__file__))
SUBS = json.load(open(f"{W}/subs.json"))
ST = json.load(open(f"{W}/secs_t.json"))
TTS = json.load(open(f"{W}/tts/secs.json"))
META = json.load(open(f"{W}/cap/meta.json"))
# 프로젝트 화면의 단계 막대 위치 — 캡처 후 같은 화면에서 잰 값(내부 11단계 + 고객 4단계 줄)
META["pc-project"]["boxes"].setdefault("stages", {"x": 355, "y": 655, "w": 1040, "h": 180})
DUR = ST["dur"]
SEC = {s["id"]: s for s in ST["secs"]}

# ---------- 대본 문구 → 시각 ----------
norm = lambda s: re.sub(r"[^0-9A-Za-z가-힣]", "", s)
CH, CT = [], []
for s, st in zip(TTS["secs"], ST["secs"]):
    for w in s["words"]:
        for ch in norm(w["w"]): CH.append(ch); CT.append(st["start"] + w["t"])
SCRIPT = "".join(CH)
def at(phrase, after=0.0):
    q = norm(phrase); i = SCRIPT.find(q)
    while i >= 0 and CT[i] < after: i = SCRIPT.find(q, i + 1)
    if i < 0: raise SystemExit(f"대본에 없음: {phrase}")
    return round(CT[i], 2)
def S(i): return SEC[f"S{i}"]["start"]
def E(i): return SEC[f"S{i}"]["end"]
def nxt(i): return S(i + 1) if i < 8 else DUR

# ---------- 도우미 ----------
def esc(t): return html.escape(t).replace("\n", "<br>")
def em(t): return "".join(f'<span class="acc">{p}</span>' if i % 2 else p for i, p in enumerate(esc(t).split("**")))
def box(cls, inner, tin, tout, style="", a="up", extra=""):
    return f'<div class="{cls}" style="{style}" data-in="{tin:.2f}" data-out="{tout:.2f}" data-a="{a}" {extra}>{inner}</div>'
def txt(cls, t, tin, tout, style="", a="up", extra=""): return box(cls, em(t), tin, tout, style, a, extra)
def strike(t, at_): return f'<span class="strike" data-strike="{at_:.2f}">{esc(t)}<i></i></span>'
def step(n, t, tin, tout, x, y, w, dim=None):
    d = f'data-dim="{dim:.2f}"' if dim else ""
    return box("tag", f'<span class="n">{n}</span><span style="white-space:normal;line-height:1.3">{em(t)}</span>', tin, tout, f"left:{x}px;top:{y}px;width:{w}px;font-size:22px", "right", d)
def tag(n, t, tin, tout, style, new=False, a="left", dim=None):
    d = f'data-dim="{dim:.2f}"' if dim else ""
    return box(f"tag{' new' if new else ''}", f'<span class="n">{n}</span><span>{em(t)}</span>', tin, tout, style, a, d)
SCENES = []
def scene(tin, tout, *parts): SCENES.append(box("scene", "\n".join(parts), tin, tout, a="fade"))

def shot_view(name, w, kb=None, focus=()):
    """화면 한 장(+강조 상자) — w: 표시 폭. kb=(a,b,s0,x0,y0,s1,x1,y1)"""
    m = META[name]; s = w / m["w"]; h = round(m["h"] * s)
    k = f'data-kb="{",".join(str(x) for x in kb)}"' if kb else ""
    fx = ""
    for key, a, b in focus:
        r = m["boxes"].get(key)
        if not r: raise SystemExit(f"위치 없음 {name}:{key}")
        pad = 6
        fx += f'<div class="focus" style="left:{r["x"]*s-pad:.0f}px;top:{r["y"]*s-pad:.0f}px;width:{r["w"]*s+2*pad:.0f}px;height:{r["h"]*s+2*pad:.0f}px" data-glow="{a:.2f},{b:.2f}"></div>'
    return h, f'<div class="kbw" style="width:{w}px;height:{h}px" {k}><img src="cap/{name}.png" style="width:{w}px;height:{h}px">{fx}</div>'
def browser(name, x, y, w, tin, tout, url="kpj-kcorp.vercel.app/ax", kb=None, focus=(), a="swap", vh=None):
    h, inner = shot_view(name, w, kb, focus)
    vh = vh or h
    return box("browser", f'<div class="bar"><i></i><i></i><i></i><b>{esc(url)}</b></div><div class="view" style="width:{w}px;height:{vh}px">{inner}</div>',
               tin, tout, f"left:{x}px;top:{y}px;width:{w}px", a)
def phone(name, x, y, w, tin, tout, kb=None, focus=(), a="swap"):
    h, inner = shot_view(name, w, kb, focus)
    return box("phone", f'<div class="notch"></div><div class="view" style="width:{w}px;height:{h}px">{inner}</div>', tin, tout, f"left:{x}px;top:{y}px", a)

def src(path, ranges, maxc=70):
    L = open(os.path.join(REPO, path), encoding="utf-8").read().split("\n"); out = []
    for i, (a, b) in enumerate(ranges):
        if i: out.append((None, "…"))
        for n in range(a, b + 1):
            t = L[n - 1].rstrip()
            if len(t) > maxc: t = t[:maxc - 1] + "…"
            out.append((n, t))
    return out
KW = r"\b(create|or|replace|function|returns|language|select|from|where|insert|into|values|if|then|end|not|exists|and|case|when|else|unique|index|on|policy|for|to|using|with|check|raise|exception|return|const|let|export|switch|true|false|null|is)\b"
def hl(t):
    t = html.escape(t)
    m = re.search(r"(--|//).*$", t)
    tail = ""
    if m: tail = f'<span class="c">{m.group(0)}</span>'; t = t[:m.start()]
    t = re.sub(r"(&#x27;[^&]*?&#x27;|`[^`]*`|&quot;[^&]*?&quot;)", r'<span class="s">\1</span>', t)
    t = re.sub(KW, r'<span class="k">\1</span>', t)
    return t + tail
def code(fname, desc, lines, x, y, w, tin, tout, hls=(), fs=17, glow=None, a="card"):
    rows = []
    for n, t in lines:
        if n is None: rows.append(f'<span class="ln gap"><span class="no">⋮</span></span>'); continue
        hb = "".join(f'<span class="hlbg" data-glow="{a_:.2f},{b_:.2f}"></span>' for (ln, a_, b_) in hls if ln == n)
        rows.append(f'<span class="ln">{hb}<span class="no">{n}</span><span>{hl(t) or " "}</span></span>')
    g = f'data-glow="{glow[0]:.2f},{glow[1]:.2f}"' if glow else ""
    return box("code", f'<div class="hd"><span class="f">{esc(fname)}</span><span class="d">{esc(desc)}</span></div><pre style="--fs:{fs}px">{"".join(rows)}</pre>',
               tin, tout, f"left:{x}px;top:{y}px;width:{w}px", a, g)
def wire(paths, w=1920, h=1080):
    return f'<svg class="wire" width="{w}" height="{h}" viewBox="0 0 {w} {h}">' + "".join(f'<path d="{d}" data-draw="{a:.2f},{b:.2f}" class="{c}"/>' for d, a, b, c in paths) + "</svg>"
def node(t, s, cx, cy, w, h, tin, tout, glow=None, cls="", a="scale"):
    g = f'data-glow="{glow[0]:.2f},{glow[1]:.2f}"' if glow else ""
    return box(f"node {cls}", f'<div class="t">{em(t)}</div>' + (f'<div class="s">{em(s)}</div>' if s else ""), tin, tout,
               f"left:{cx - w/2:.0f}px;top:{cy - h/2:.0f}px;width:{w}px;height:{h}px", a, g)

NOTE_SCREEN = "화면 속 기업 · 인물 · 자료는 예시 데이터입니다"
NOTE_PROG = "화면 속 기업 · 인물은 예시 데이터 · 공고는 실제 기업마당 공고입니다"
PATENT = "특허 출원 완료 · 출원번호 10-2026-0177079"

# =====================================================================
# 01 영상의 목적 (0 ~ S2)
t1 = at("기존에 제출한"); t2 = at("따라서 이번 영상에서는"); T = nxt(1)
scene(0, t1 + .3,
    txt("eyebrow abs", "기술혁신성 이의신청 · 기술검증 영상", .1, t1 + .3, "left:120px;top:250px"),
    txt("h1 abs", "심사 의견에 대한\n**기술 구현** 근거", .3, t1 + .3, "left:120px;top:300px"),
    txt("p abs", "KPJK Consulting AX — 상태 기반 후속행동 기술", .9, t1 + .3, "left:120px;top:520px"),
    box("glass abs", f'<div class="small" style="letter-spacing:.14em">벤처기업확인 심의 의견</div>'
        f'<div class="h3" style="margin-top:18px">기술혁신성 · 차별성에 관한<br><span class="acc">객관적인 근거</span>가 부족</div>',
        at("기술혁신성과 차별성"), t1 + .3, "left:1080px;top:330px;width:720px;padding:44px 48px", "card"),
)
scene(t1, t2 + .3,
    txt("h2 abs", "구현 원리와 차별점이\n충분히 **전달되지 않았습니다**", t1 + .1, t2 + .3, "left:120px;top:250px"),
    txt("p abs", "그래서 이번에는 실제 프로그램 화면과\n소스코드를 연결해 설명합니다", t1 + 1.6, t2 + .3, "left:120px;top:440px"),
    box("pill acc2 abs", esc(PATENT), t1 + 2.4, t2 + .3, "left:120px;top:640px", "up"),
    browser("pc-dashboard", 900, 190, 900, t1 + .3, t2 + .3, kb=(t1, t2 + .3, 1.0, 0, 0, 1.06, -30, -20), a="card"),
    tag("", "KPJK 시스템 실제 화면", t1 + 1.0, t2 + .3, "left:900px;top:120px").replace('<span class="n"></span>', ''),
)
c1, c2, c3 = at("기술혁신성 소명서"), at("실제 프로그램 화면"), at("소스코드를 연결해")
scene(t2, T + .3,
    txt("eyebrow abs", "이 영상의 구성", t2 + .1, T + .3, "left:120px;top:200px"),
    txt("h2 abs", "제출 자료 · 실제 화면 · 소스코드를 **연결**합니다", t2 + .2, T + .3, "left:120px;top:250px"),
    box("glass abs", '<div class="small" style="letter-spacing:.14em">함께 제출하는 자료</div><div class="h3" style="margin-top:16px">기술혁신성 소명서</div>'
        f'<div class="h3" style="margin-top:6px" data-in="{at("기술구현 검증보고서"):.2f}" data-out="{T+.3:.2f}" data-a="up">기술구현 검증보고서</div>', c1, T + .3, "left:120px;top:440px;width:520px;height:300px;padding:40px", "card"),
    box("glass abs", '<div class="small" style="letter-spacing:.14em">실제 프로그램</div><div class="h3" style="margin-top:16px">고객 휴대폰 ·<br>담당자 PC 화면</div>', c2, T + .3, "left:700px;top:440px;width:520px;height:300px;padding:40px", "card"),
    box("glass hl abs", '<div class="small" style="letter-spacing:.14em">소스코드 · 데이터베이스</div><div class="h3" style="margin-top:16px">규칙 · 트리거 ·<br>권한 정책</div>', c3, T + .3, "left:1280px;top:440px;width:520px;height:300px;padding:40px", "card"),
    wire([("M640 590 L700 590", c2 - .2, c2 + .4, ""), ("M1220 590 L1280 590", c3 - .2, c3 + .4, "")]),
)

# =====================================================================
# 02 핵심 기술의 정의
s2 = S(2); t_ev = at("기업 컨설팅 과정에서"); T = nxt(2)
t_na = at("아닙니다", s2)
scene(s2, t_ev + .3,
    txt("eyebrow abs", "Core Technology", s2 + .1, t_ev + .3, "left:120px;top:250px"),
    box("h1 abs", f'핵심은 {strike("고객정보 저장", t_na)}<br>{strike("일정관리", t_na + .3)}가 아닙니다', s2 + .3, t_ev + .3, "left:120px;top:310px"),
)
Y = 520; XS = [250, 605, 960, 1315, 1670]; NW, NH = 310, 150
tn = [at("기업 컨설팅 과정에서"), at("기업별 상태정보"), at("다음 행동을 생성"), at("각자의 역할에"), at("실행 결과가 다시")]
labels = [("업무 이벤트", "상담 · 계약 · 자료제출\n검토 · 승인"), ("기업별 상태 갱신", "기업별 상태정보와 연결"), ("후속행동 생성", "상태에 맞는 다음 행동"),
          ("역할별 출력", "담당자 · 고객이\n각자 받는 행동"), ("실행결과 재반영", "결과가 다음 업무로")]
parts = [txt("eyebrow abs", "State-based Follow-up", t_ev, T + .3, "left:120px;top:190px"),
         txt("h3 abs", "업무 이벤트 → 기업별 상태 갱신 → 후속행동 생성 → 역할별 출력 → **실행결과 재반영**", t_ev + .2, T + .3, "left:120px;top:236px;font-size:36px")]
for i, ((t, s_), cx) in enumerate(zip(labels, XS)):
    parts.append(node(t, s_, cx, Y, NW, NH, tn[i], T + .3, glow=(tn[i], (tn[i + 1] if i < 4 else at("이 구조가 2026년"))), cls=""))
wires = [(f"M{XS[i] + NW/2 + 6} {Y} L{XS[i+1] - NW/2 - 6} {Y}", tn[i + 1] - .5, tn[i + 1] + .1, "") for i in range(4)]
wires.append((f"M{XS[4]} {Y + NH/2 + 8} C {XS[4]} {Y + 230}, {XS[0]} {Y + 230}, {XS[0]} {Y + NH/2 + 8}", tn[4] + .4, tn[4] + 2.2, ""))
parts.append(wire(wires))
ev = ["상담", "계약", "자료제출", "검토", "승인"]
te = at("상담, 계약", s2)
for i, e_ in enumerate(ev):
    parts.append(box("chip", esc(e_), te + i * .32, T + .3, f"left:{120 + i * 170}px;top:320px;font-size:24px;padding:10px 20px", "up"))
tr = at("담당자와 고객이")
parts.append(box("pill abs", "담당자 — 처리할 업무", tr, T + .3, f"left:{XS[3] - 160}px;top:{Y - NH/2 - 128:.0f}px;font-size:21px;padding:10px 18px", "up"))
parts.append(box("pill abs", "고객 — 할 일 · 진행 단계", tr + .4, T + .3, f"left:{XS[3] - 160}px;top:{Y - NH/2 - 70:.0f}px;font-size:21px;padding:10px 18px", "up"))
tp = at("이 구조가 2026년")
parts.append(box("pill acc2 abs", f"{esc(PATENT)} · 2026. 9. 16. 출원", tp, T + .3, "left:0;right:0;margin:0 auto;width:max-content;top:800px", "up"))
scene(t_ev, T + .3, *parts)

# =====================================================================
# 03 핵심 기술 1 — 고객 행동 → 업무 자동생성
s3 = S(3); T = nxt(3)
a1 = at("고객이 휴대폰으로"); a1b = at("자료를 제출합니다"); a2 = at("서버는 제출된 자료를"); a3 = at("검토업무를 자동으로")
a4 = at("담당자가 자료를 검토하고"); a5 = at("고객 화면에도"); a6 = at("고객이 다시 자료를"); a7 = at("이는 단순히 알림을")
# ① 실제 화면 녹화(데모 환경) + 서버 처리 실제 실행(로컬 시험 DB). 클립은 실제 속도 그대로, 앞뒤 대기만 잘라 이어 놓는다.
REC = json.load(open(f"{W}/rec/meta.json"))
SRV = {}
for ln_ in open(f"{W}/logs/server-loop.txt", encoding="utf-8"):
    k, *v = ln_.strip().split("|")
    if k: SRV[k] = v
need = {"STEP1": ["client", "1"], "TASK": None, "NOTI": None, "ACT": None, "STAGE": ["doc_received"], "STEP3": ["consultant", "1"], "CLIENT": None, "RETASK": ["2"], "DONE": ["1"]}
for k, v in need.items():
    if k not in SRV or (v and SRV[k] != v): raise SystemExit(f"서버 실행 결과가 기대와 다름: {k} {SRV.get(k)}")
def clip(name, frm, to, t0):
    """녹화 클립 한 토막 — frm~to(클립 시각)을 영상 t0 부터 실제 속도로. 반환: (시작, 끝, 사건 → 영상 시각)"""
    c = REC["clips"][name]; f0, f1 = round(frm * REC["fps"]), round(min(to, c["dur"]) * REC["fps"])
    ev = {k: round(t0 + (v - frm), 2) for k, v in c["events"].items()}
    return {"name": name, "frames": c["frames"][f0:f1], "t0": t0, "t1": t0 + (f1 - f0) / REC["fps"], "ev": ev, "c": c, "frm": frm}
def zoom_to(c, key, w, vh, z, a, b):
    """녹화 화면을 key 상자 쪽으로 천천히 확대 — 화면 밖이 보이지 않게 이동량을 묶는다"""
    r = c["c"]["boxes"].get(key)
    if not r: raise SystemExit(f"녹화 위치 없음 {c['name']}:{key}")
    s0 = w / c["c"]["w"]; ih = c["c"]["h"] * s0
    cx, cy = (r["x"] + r["w"] / 2) * s0, (r["y"] + r["h"] / 2) * s0
    tx = min(0, max(w - w * z, w / 2 - cx * z)); ty = min(0, max(vh - ih * z, vh / 2 - cy * z))
    return (round(a, 2), round(b, 2), 1.0, 0, 0, z, round(tx), round(ty))
def seq_view(c, w, kb=None, focus=()):
    s0 = w / c["c"]["w"]; h = round(c["c"]["h"] * s0)
    k = f'data-kb="{",".join(str(x) for x in kb)}"' if kb else ""
    fx = ""
    for key, a, b in focus:
        r = c["c"]["boxes"].get(key)
        if not r: raise SystemExit(f"녹화 위치 없음 {c['name']}:{key}")
        fx += f'<div class="focus" style="left:{r["x"]*s0-6:.0f}px;top:{r["y"]*s0-6:.0f}px;width:{r["w"]*s0+12:.0f}px;height:{r["h"]*s0+12:.0f}px" data-glow="{a:.2f},{b:.2f}"></div>'
    d = json.dumps({"dir": f"rec/{c['name']}", "frames": c["frames"], "t0": round(c["t0"], 3), "fps": REC["fps"]})
    return h, f'<div class="kbw" style="width:{w}px;height:{h}px" {k}><img data-seq=\'{d}\' src="rec/{c["name"]}/{c["frames"][0]}" style="width:{w}px;height:{h}px">{fx}</div>'
def rec_phone(c, x, y, w, tin, tout, kb=None, focus=()):
    h, inner = seq_view(c, w, kb, focus)
    return box("phone", f'<div class="notch"></div><div class="view" style="width:{w}px;height:{h}px">{inner}</div>', tin, tout, f"left:{x}px;top:{y}px", "swap")
def rec_browser(c, x, y, w, tin, tout, url, kb=None, focus=()):
    h, inner = seq_view(c, w, kb, focus)
    return box("browser", f'<div class="bar"><i></i><i></i><i></i><b>{esc(url)}</b></div><div class="view" style="width:{w}px;height:{h}px">{inner}</div>', tin, tout, f"left:{x}px;top:{y}px;width:{w}px", "swap")

PX, PY, PWD = 80, 150, 300          # 고객 휴대폰
BX, BY, BWD = 420, 150, 1040        # 담당자 PC
SVX, SVW = 1500, 340                # 서버 처리 기록
PVH = round(BWD * 900 / 1440)
# 눈 따라가기 — 휴대폰 · 서버 기록 · PC 중 한 곳이 바뀐 뒤 다른 곳이 바뀌기까지 시간을 두고, 흐름점이 다음 화면으로 시선을 데려간다.
# 클립 안의 동작(누르기 · 입력 · 화면 이동)은 실제 속도 그대로. 기다리는 시간만 늘리고, 나레이션은 문장 사이 쉼(pauses.json)으로 맞춘다.
HOLD = 1.4                                   # 결과 화면(자동 생성 업무 · 보완 필요)을 그대로 보여 주는 시간
def ev0(name, k, frm): return REC["clips"][name]["events"][k] - frm
A = clip("a-submit", 0.6, 5.6, a1)
sub = A["ev"]["submit"]
r1 = sub + .9; r2 = r1 + .8; r3 = r2 + .8; r45 = r3 + .7     # 서버: 제출 기록 → 트리거 → 업무 생성 → 고객 알림 · 단계(같은 트리거 결과라 한 번에)
Bc = clip("b-task", 0.9, 6.8, r45 + .8 - ev0("b-task", "nav", 0.9))   # PC 는 서버 기록이 다 오른 뒤 움직인다
Cc = clip("c-revision", 1.0, 5.9, Bc["ev"]["task"] + HOLD)
r6 = Cc["ev"]["revision"] + .65
Dc = clip("d-status", 0.5, 4.7, r6 + .95)                     # 흐름점이 휴대폰에 닿을 때 고객이 앱을 연다
r7 = Dc["t0"]
Ec = clip("e-resubmit", 0.45, 3.7, Dc["ev"]["shown"] + HOLD)
r8 = Ec["ev"]["submit"] + .8
Fc = clip("f-done", 2.5, 7.3, r8 + .7)
r9 = Fc["ev"]["done"] + .8
order = [A["ev"]["submit"], Bc["ev"]["task"], Cc["ev"]["revision"], Dc["ev"]["shown"], Ec["ev"]["submit"], Fc["ev"]["done"], Fc["ev"]["history"]]
if order != sorted(order): raise SystemExit(f"녹화 사건 순서 확인: {order}")
# 나레이션 ↔ 화면 — (쉼을 넣을 자막 첫머리, 맞출 문구, 그 문구가 나와야 할 시각). 문구가 화면보다 이르면 그 자막 앞에 쉼을 더하고,
# 늦으면 앞서 넣은 쉼을 줄인다. 맞지 않으면 새 쉼 값을 적어 두고 멈춘다 → pauses.json 에 옮기고 align_voice.py 부터 다시
SYNC = [("서버는 제출된 자료를", "서버는 제출된 자료를", r1 - .3),
        ("담당자가 처리해야 할", "검토업무를 자동으로", Bc["ev"]["task"] - .8),
        ("담당자가 자료를 검토하고", "보완을 요청하면", Cc["ev"]["revision"] - .9),
        ("고객 화면에도", "필요한 상태가 반영", Dc["ev"]["shown"] - .5),
        ("고객이 다시 자료를", "담당자가 검토를", Fc["ev"]["done"] - 1.4),
        ("그 결과가 업무기록과", "그 결과가 업무기록과", Fc["ev"]["done"] + .4),
        ("이는 단순히 알림을", "이는 단순히 알림을", Fc["ev"]["history"] + 1.3)]
PF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pauses.json")
CUR = json.load(open(PF, encoding="utf-8")) if os.path.exists(PF) else {}
NEW, moved, late = dict(CUR), 0.0, []
for key, ph, want in SYNC:
    d = want - (at(ph, a1) + moved)
    nv = round(max(0.0, CUR.get(key, 0.0) + d), 2); moved += nv - CUR.get(key, 0.0)
    if nv > 0: NEW[key] = nv
    else: NEW.pop(key, None)
    if d + CUR.get(key, 0.0) < -.8: late.append(f"{ph} {-(d + CUR.get(key, 0.0)):.1f}초 늦음")
if late: print("나레이션이 화면보다 늦은 곳:", late)
if any(abs(NEW.get(k, 0) - CUR.get(k, 0)) > .05 for k in set(NEW) | set(CUR)):
    json.dump(NEW, open(f"{W}/pauses_new.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    raise SystemExit(f"쉼 조정 필요 → {W}/pauses_new.json 을 tools/video/appeal/pauses.json 으로 옮기고 align_voice.py 부터 다시: {NEW}")
if Fc["ev"]["history"] + 1.3 > a7: raise SystemExit(f"이력 화면을 볼 시간이 짧음: {Fc['ev']['history']} / a7 {a7}")
srv_t = [r1, r2, r3, r45, r45, r6, r7, r8, r9]
ROLE = {"고객": "c", "서버": "s", "담당자": "a"}
task_title, _, task_owner, task_type = SRV["TASK"]
lines = [("고객", "자료 제출 — <b>document_files</b> +1", "고객 계정으로 실행"),
         ("서버", "트리거 <b>kpjk_after_client_file()</b>", "제출을 기업 · 요청항목과 연결"),
         ("서버", f"업무 생성 · <b>{esc(task_title)}</b>", f"자동(auto) · 담당 {esc(task_owner)} · {esc(task_type)}"),
         ("서버", f"고객 알림 · {esc(SRV['NOTI'][0])}", "고객 화면 알림"),
         ("서버", "프로젝트 단계 → 자료접수", f"자동 기록({esc(SRV['ACT'][1])}) · {esc(SRV['ACT'][0])}"),
         ("담당자", "보완 요청 — 요청 상태 변경 1건", "담당자 계정으로 실행"),
         ("고객", f"고객이 읽는 상태 · <b>보완 요청</b>", esc(SRV["CLIENT"][3])),
         ("고객", "재제출 → 검토 업무 다시 생성", f"자동 생성 누적 {esc(SRV['RETASK'][0])}건"),
         ("담당자", "검토 완료 → 기록 · 진행상태", "요청 상태 완료 1건")]
srv_rows = "".join(f'<div class="srow" data-in="{srv_t[i]:.2f}" data-out="{a7 + .3:.2f}" data-a="up" data-dim="{next((x for x in srv_t[i + 1:] if x > srv_t[i] + .01), a7):.2f}">'
                   f'<span class="role {ROLE[r]}">{r}</span><div><div class="m">{m}</div><div class="d">{d}</div></div></div>' for i, (r, m, d) in enumerate(lines))
srv = box("srv", f'<div class="hd"><b>서버 처리 — 실제 실행 결과</b><span>로컬 시험 DB · 운영과 같은 setup.sql · 가상 데이터</span></div><div class="rows">{srv_rows}</div><div class="ft">같은 규칙을 서버 DB 에서 실제로 실행한 결과입니다. 왼쪽 녹화(데모 환경)와 데이터는 별개입니다.</div>',
          s3 + .4, a7 + .3, f"left:{SVX}px;top:{BY}px;width:{SVW}px;height:{PVH + 34}px", "card")
# 흐름 표시 — 실제 사건 시각에만 움직인다
yb = BY + PVH + 34 + 22
P2S = f"M{PX + PWD/2 + 12:.0f} {PY + 672} L{PX + PWD/2 + 12:.0f} {yb} L{SVX + 60} {yb} L{SVX + 60} {BY + PVH + 34}"   # 휴대폰 → 서버
S2P = f"M{SVX + 60} {BY + PVH + 34} L{SVX + 60} {yb} L{PX + PWD/2 + 12:.0f} {yb} L{PX + PWD/2 + 12:.0f} {PY + 672}"   # 서버 → 휴대폰
flows = [(P2S, sub + .1, r1 - .05),
         (f"M{SVX - 2} {BY + 210} L{BX + BWD + 6} {BY + 210}", r45 + .3, Bc["ev"]["nav"] - .1),
         (f"M{BX + BWD + 6} {BY + 470} L{SVX - 2} {BY + 470}", Cc["ev"]["revision"] + .05, r6 - .05),
         (S2P, r6 + .2, Dc["t0"] - .05),
         (P2S, Ec["ev"]["submit"] + .1, r8 - .05),
         (f"M{SVX - 2} {BY + 330} L{BX + BWD + 6} {BY + 330}", r8 + .2, Fc["t0"] - .05)]
flow_svg = '<svg class="wire" width="1920" height="1080" viewBox="0 0 1920 1080">' + "".join(
    f'<path id="fl{i}" d="{d_}" class="soft" data-draw="{a_:.2f},{b_:.2f}" data-fade="{b_ + .6:.2f}"/>' for i, (d_, a_, b_) in enumerate(flows)) + "</svg>"
flow_dots = "".join(f'<div class="fdot" data-move="fl{i},{a_:.2f},{b_:.2f}"></div>' for i, (d_, a_, b_) in enumerate(flows))
kb_b = zoom_to(Bc, "task", BWD, PVH, 1.45, Bc["ev"]["task"] - .2, Bc["ev"]["task"] + .9)
kb_c = zoom_to(Cc, "dialog", BWD, PVH, 1.3, Cc["ev"]["open"] + .1, Cc["ev"]["open"] + 1.0)
kb_f = zoom_to(Fc, "list", BWD, PVH, 1.3, Fc["ev"]["history"] + .2, Fc["ev"]["history"] + 1.2)
scene(s3, a7 + .3,
    box("rec abs", '<i></i>실제 화면 녹화 · 고객 휴대폰', s3 + .3, a7 + .3, f"left:{PX}px;top:104px", "fade"),
    box("rec abs", '<i></i>실제 화면 녹화 · 담당자 PC <span>데모 환경 · 예시 데이터 · 장면 사이 대기 구간만 편집</span>', s3 + .3, a7 + .3, f"left:{BX}px;top:104px", "fade"),
    rec_phone(A, PX, PY, PWD, s3 + .2, Dc["t0"] + .1, focus=[("row", s3 + .8, A["ev"]["open"])]),
    rec_phone(Dc, PX, PY, PWD, Dc["t0"], Ec["t0"] + .1, focus=[("row", Dc["ev"]["shown"] + .2, Ec["t0"])]),
    rec_phone(Ec, PX, PY, PWD, Ec["t0"], a7 + .3),
    rec_browser(Bc, BX, BY, BWD, s3 + .2, Cc["t0"] + .1, "kpj-kcorp.vercel.app/ax/tasks — 담당자 업무함", kb=kb_b, focus=[("task", Bc["ev"]["task"] + .9, Cc["t0"])]),
    rec_browser(Cc, BX, BY, BWD, Cc["t0"], Fc["t0"] + .1, "kpj-kcorp.vercel.app/ax/clients — 자료 검토", kb=kb_c, focus=[("btn", Cc["ev"]["typed"], Cc["ev"]["revision"] + .3)]),
    rec_browser(Fc, BX, BY, BWD, Fc["t0"], a7 + .3, "kpj-kcorp.vercel.app/ax/clients — 기업 이력", kb=kb_f),
    srv, flow_svg, flow_dots,
)
# 순환 도식
L = [("고객 행동", "자료 제출 · 재제출", 960, 250), ("내부 업무 발생", "검토 업무 자동 생성", 1440, 470), ("처리 결과", "검토 · 보완 요청 · 완료", 960, 690), ("고객 화면 반영", "보완 필요 · 진행 단계", 480, 470)]
b1, b2, b3 = at("고객의 행동이 내부 업무를"), at("그 처리 결과가 다시"), at("순환형 업무처리 구조")
tt = [b1, b1 + .8, b2, b2 + .8]
parts = [box("abs", f'<span class="p" style="font-size:30px">{strike("단순한 알림 발송", at("기능이 아니라", a7))}</span>', a7 + .1, T + .3, "left:120px;top:150px", "up")]
for i, (t, s_, cx, cy) in enumerate(L):
    parts.append(node(t, s_, cx, cy, 360, 150, tt[i], T + .3, glow=(tt[i], b3 + 2.5)))
arc = [("M1135 285 Q1400 300 1430 390", tt[1] - .5, tt[1] + .2), ("M1430 550 Q1400 660 1135 680", tt[2] - .5, tt[2] + .2),
       ("M785 680 Q520 660 490 550", tt[3] - .5, tt[3] + .2), ("M490 390 Q520 300 785 285", b3 - .3, b3 + .6)]
parts.append(wire([(d, a_, b_, "") for d, a_, b_ in arc]))
parts.append(txt("h3 abs", "**순환형** 업무처리 구조", b3, T + .3, "left:0;right:0;text-align:center;top:450px;font-size:38px", "scale"))
scene(a7, T + .3, *parts)

# =====================================================================
# 04 핵심 기술 2 — 상태관리 · 권한
s4 = S(4); T = nxt(4)
d1 = at("저희는 내부 업무단계를"); d2 = at("또한 서버에서는"); d3 = at("즉, 화면 디자인만")
pm = META["pc-project"]; ps = 1100 / pm["w"]
scene(s4, d1 + .3,
    browser("pc-project", 120, 150, 1100, s4 + .2, d1 + .3, url="kpj-kcorp.vercel.app/ax/projects — 담당자 화면",
            kb=(s4 + 1, d1, 1.0, 0, 0, 1.05, -20, -130), focus=[("stages", s4 + 2.0, d1 + .3)]),
    phone("ph-project", 1440, 150, 320, s4 + 1.2, d1 + .3),
    tag("내", "담당자 — 업무 11단계", s4 + .6, d1 + .3, "left:120px;top:92px").replace('class="n">내', 'class="n" style="font-size:16px">내'),
    tag("고", "고객 — 진행 4단계", s4 + 1.6, d1 + .3, "left:1440px;top:92px").replace('class="n">고', 'class="n" style="font-size:16px">고'),
)
GROUPS = [(["문의", "상담", "계약", "자료요청"], "자료 요청"), (["자료접수", "검토"], "자료 검토 중"), (["진행", "결과작성", "대표미팅"], "진행 중"), (["완료", "사후관리"], "완료")]
parts = [txt("eyebrow abs", "State Mapping", d1, d2 + .3, "left:120px;top:150px"),
         txt("h3 abs", "같은 데이터 · 다른 출력 — 내부 **11단계** → 고객 **4단계**", d1 + .1, d2 + .3, "left:120px;top:196px"),
         box("small abs", "src/lib/stages.ts · stageToCustomerStep()", d1 + .4, d2 + .3, "left:120px;top:262px;font-family:'NGC-L','NGC-K',monospace")]
y = 320; k = 0; tmap = at("진행단계로", d1)
paths = []
for gi, (items, cust) in enumerate(GROUPS):
    gy0 = y
    for it in items:
        parts.append(box("chip", esc(it), d1 + .3 + k * .12, d2 + .3, f"left:{140 + (k % 1) * 0}px;top:{y}px;font-size:21px;padding:6px 18px;width:200px;text-align:center", "left"))
        y += 46; k += 1
    gy1 = y - 46; cy = (gy0 + gy1) / 2 + 20
    parts.append(box("node on", f'<div class="t" style="font-size:28px">{esc(cust)}</div>', tmap + gi * .3, d2 + .3, f"left:900px;top:{cy - 34:.0f}px;width:320px;height:68px", "right"))
    for yy in range(gy0, gy1 + 1, 46): paths.append((f"M345 {yy + 20} C 600 {yy + 20}, 650 {cy}, 895 {cy}", tmap + gi * .3 - .3, tmap + gi * .3 + .5, "soft"))
    y += 18
parts.append(wire(paths))
parts.append(code("src/lib/stages.ts", "상태 변환 규칙", src("src/lib/stages.ts", [(42, 58)]), 1300, 300, 500, d1 + .6, d2 + .3, fs=16, a="right"))
scene(d1, d2 + .3, *parts)
e1, e2 = at("기업별 접근권한"), at("중복 생성되지 않도록")
scene(d2, d3 + .3,
    txt("eyebrow abs", "Server-side Control", d2, d3 + .3, "left:120px;top:150px"),
    txt("h3 abs", "서버에서 — 기업별 **접근권한** 분리 · 자동업무 **중복 방지**", d2 + .1, d3 + .3, "left:120px;top:196px"),
    code("supabase/setup.sql", "기업별 접근 범위 함수 (RLS)", src("supabase/setup.sql", [(653, 666)], maxc=78), 120, 280, 860, e1 - .4, d3 + .3,
         hls=[(663, e1 + .3, d3 + .3)], fs=18),
    code("supabase/setup.sql", "같은 근거의 업무는 한 번만", src("supabase/setup.sql", [(361, 361), (1644, 1645), (1673, 1674)], maxc=76), 1020, 280, 780, e2 - .4, d3 + .3,
         hls=[(361, e2 + .3, d3 + .3), (1673, e2 + 1.0, d3 + .3)], fs=17),
)
# ② 일반 CRM 대비 — 개별 기능의 유무가 아니라 컨설팅 업무에 맞춘 통합 처리구조 (기존 나레이션 구간 그대로)
f1 = at("상태변환 규칙"); f2 = at("실제 프로그램과 데이터베이스에", d3)
CRM = ["고객정보 관리", "일정 관리", "업무(할 일) 관리", "영업 단계 관리"]
KP = [("기업별 복합 업무상태 관리", "내부 11단계 · 자료 · 실행 기록을 기업 단위로", "stages.ts"),
      ("상태변화에 따른 후속행동 생성", "규칙 · 서버 트리거가 다음 업무를 만든다", "setup.sql 트리거"),
      ("내부 담당자와 고객의 역할별 출력", "담당자 업무 / 고객 진행 4단계 · 할 일 — 기업별 권한", "RLS 정책"),
      ("고객 실행결과의 재반영 → 다음 행동", "실행 이력 → 다음 검토과제 · 담당자 확인", "growth.ts · self-run.ts")]
tk = [f1 - .2 + i * .55 for i in range(4)]
crm_rows = "".join(f'<li data-in="{d3 + .9 + i * .18:.2f}" data-out="{T + .3:.2f}" data-a="up">{esc(x)}</li>' for i, x in enumerate(CRM))
kp_rows = "".join(f'<div class="kp" data-in="{tk[i]:.2f}" data-out="{T + .3:.2f}" data-a="left"><span class="n">{i + 1}</span><div class="tx"><b>{esc(t)}</b><span>{esc(d)}</span></div><code>{esc(c)}</code></div>' for i, (t, d, c) in enumerate(KP))
scene(d3, T + .3,
    box("abs", f'<span class="h3" style="color:var(--ink2);font-size:34px">{strike("화면 디자인만 다른 것", at("아니라", d3))}</span>', d3 + .1, T + .3, "left:120px;top:130px", "up"),
    txt("h3 abs", "일반 CRM 과의 차이 — 컨설팅 업무에 특화된 **통합 처리구조**", d3 + .4, T + .3, "left:120px;top:196px;font-size:38px"),
    box("glass abs cmp", f'<div class="small" style="letter-spacing:.12em">일반적인 CRM 기능</div><ul>{crm_rows}</ul><div class="small" style="margin-top:18px;font-size:17px">기능별로 관리 · 제품마다 구성은 다릅니다</div>',
        d3 + .7, T + .3, "left:120px;top:290px;width:520px;height:500px;padding:36px 40px", "card"),
    box("glass hl abs cmp2", f'<div class="small" style="letter-spacing:.12em;color:var(--hi)">KPJK — 하나의 처리 흐름으로 연결</div>{kp_rows}',
        f1 - .5, T + .3, "left:680px;top:290px;width:1120px;height:500px;padding:30px 36px", "card"),
    txt("small abs", "다른 CRM 에 없는 기능이라는 뜻이 아니라, 기업 컨설팅 업무에 맞춰 네 가지를 하나의 처리 흐름으로 묶어 프로그램과 **데이터베이스**에 구현했다는 점이 차이입니다",
        f2, T + .3, "left:120px;right:120px;top:812px;font-size:19px;text-align:center"),
)

# =====================================================================
# 05 핵심 기술 3 — 자기주도 실행으로 확장
s5 = S(5); T = nxt(5)
g1 = at("기존 시스템에는"); g2 = at("최근에는 이 구조를"); g3 = at("고객이 상담을 신청하지"); g4 = at("기존에 출원한")
scene(s5, g1 + .3,
    txt("eyebrow abs", "Self-directed Execution", s5 + .1, g1 + .3, "left:120px;top:250px"),
    box("h2 abs", f'고객을 컨설턴트에게 {strike("의존", at("아닙니다", s5))}하게 만드는 것이 아니라', s5 + .3, g1 + .3, "left:120px;top:300px", "up"),
    txt("h1 abs", "대표자가 상태를 이해하고\n**스스로 선택**하도록", at("중소기업 대표자가"), g1 + .3, "left:120px;top:460px"),
)
SX = [230, 810, 1390]; PYY, PW5 = 168, 300
def slot(i): return SX[i]
scene(g1, g2 + .3,
    phone("ph-growth", slot(0), PYY, PW5, g1 + .1, g2 + .3, focus=[("title", g1 + .8, at("다음 검토과제를") + 2)]),
    phone("ph-programs", slot(1), PYY, PW5, at("정부지원사업 공고를"), g2 + .3, a="card"),
    tag("기존", "기업정보 · 이력으로 다음 검토과제", g1 + .4, g2 + .3, f"left:{slot(0) - 40}px;top:104px").replace('class="n">기존', 'class="n" style="width:auto;padding:0 10px;border-radius:12px;font-size:17px">기존'),
    tag("기존", "기업조건에 맞는 실제 공고 매칭", at("정부지원사업 공고를") + .3, g2 + .3, f"left:{slot(1) - 40}px;top:104px").replace('class="n">기존', 'class="n" style="width:auto;padding:0 10px;border-radius:12px;font-size:17px">기존'),
    box("glass abs", '<div class="small" style="letter-spacing:.12em">이미 구현된 기능</div><div class="h3" style="margin-top:16px;font-size:34px">다음 검토과제 제시</div><div class="h3" style="margin-top:8px;font-size:34px">지원사업 공고 매칭</div><div class="small" style="margin-top:24px;line-height:1.5">매칭은 검토 후보 —<br>자격 · 선정을 판단하지 않음</div>', g1 + 1.0, g2 + .3, f"left:{slot(2) - 20}px;top:250px;width:440px;padding:40px", "card"),
)
h1_, h2_, h3_ = at("무료 학습자료"), at("직접 지원사업을 준비"), at("실행 결과를 기록할")
NEWT = lambda t, tin, tout, x: tag("고도화", t, tin, tout, f"left:{x - 40}px;top:104px", new=True).replace('class="n">고도화', 'class="n" style="width:auto;padding:0 10px;border-radius:12px;font-size:17px">고도화')
# ③ 신규 고도화 기능의 시점 — 최초 신청 당시부터 있었던 것처럼 보이지 않게, 화면마다 같은 표기
DATE_BADGE = lambda tin, tout: box("abs", '<span class="badge-date"><i>●</i>기존 신청기술 기반 추가 고도화 <i>|</i> 2026년 10월</span>', tin, tout, "left:0;right:0;text-align:center;top:30px", "fade")
scene(g2, g3 + .3,
    DATE_BADGE(g2 + .3, g3 + .3),
    phone("ph-learn", slot(0), PYY, PW5, h1_ - .3, g3 + .3, a="card"),
    phone("ph-prog-checks", slot(1), PYY, PW5, h2_ - .3, g3 + .3, focus=[("checks", h2_ + .3, h3_)], a="card"),
    phone("ph-prog-applied", slot(2), PYY, PW5, h3_ - .3, g3 + .3, focus=[("ev", h3_ + .4, g3 + .3)], a="card"),
    NEWT("무료 학습자료", h1_, g3 + .3, slot(0)), NEWT("직접 준비 체크리스트", h2_, g3 + .3, slot(1)), NEWT("실행 결과 기록 (고객 입력)", h3_, g3 + .3, slot(2)),
)
k1, k2 = at("완료한 성장과제는"), at("다음 검토과제로 이어집니다")
scene(g3, g4 + .3,
    DATE_BADGE(g3 - .2, g4 + .3),
    phone("ph-prog-official", slot(0), PYY, PW5, g3 + .1, g4 + .3, focus=[("title", g3 + .5, k1)]),
    phone("ph-prog-next", slot(1), PYY, PW5, at("직접 준비할 수 있고") , g4 + .3, focus=[("next", at("직접 준비할 수 있고") + .4, k1 + .5)], a="card"),
    phone("ph-growth-done", slot(2), PYY, PW5, k1 - .2, g4 + .3, focus=[("follow", k2 - .3, g4 + .3)], a="card"),
    NEWT("상담 없이 공식 사이트에서 직접 신청", g3 + .3, g4 + .3, slot(0)), NEWT("결과 → 다음 할 일 갱신", at("직접 준비할 수 있고") + .3, g4 + .3, slot(1)),
    NEWT("완료 → 다음 검토과제 (특허자본)", k1, g4 + .3, slot(2)),
)
L5 = [("업무 이벤트", "", 300, 400), ("기업별 상태 갱신", "", 720, 400), ("후속행동 생성", "", 1140, 400), ("역할별 출력", "", 1560, 400)]
x1 = at("고객의 자기주도 실행"); parts = [txt("eyebrow abs", "Extension", g4 + .1, T + .3, "left:120px;top:190px"),
                                    txt("h3 abs", "출원한 상태 기반 후속행동 구조를 → 고객의 **자기주도 실행**까지", g4 + .2, T + .3, "left:120px;top:236px")]
for i, (t, s_, cx, cy) in enumerate(L5): parts.append(node(t, s_, cx, cy, 340, 110, g4 + .2 + i * .25, T + .3))
parts.append(txt("small abs", "기존 신청기술 — 핵심 구조 그대로 유지", g4 + .4, T + .3, "left:130px;top:302px;letter-spacing:.04em"))
parts.append(node("고객의 직접 실행", "학습 · 직접 준비 · 신청 · 결과 기록", 1140, 680, 520, 150, x1 - .4, T + .3, cls="new", a="card"))
parts.append(box("abs", '<span class="badge-date"><i>●</i>추가 고도화 <i>|</i> 2026년 10월 · 활용 범위 확장</span>', x1 + .2, T + .3, "left:880px;top:770px", "up"))
parts.append(DATE_BADGE(g4 - .2, T + .3))
parts.append(node("이력 · 다음 과제 반영", "", 520, 680, 420, 110, x1 + .8, T + .3, cls="on", a="card"))
parts.append(wire([(f"M{300+170} 400 L{720-170} 400", g4 + .3, g4 + .8, "soft"), (f"M{720+170} 400 L{1140-170} 400", g4 + .5, g4 + 1.0, "soft"), (f"M{1140+170} 400 L{1560-170} 400", g4 + .7, g4 + 1.2, "soft"),
                   ("M1560 455 C 1560 600, 1460 680, 1400 680", x1 - .6, x1 + .2, ""), ("M880 680 L730 680", x1 + .4, x1 + 1.0, ""), ("M520 625 C 520 520, 300 520, 300 455", x1 + 1.0, x1 + 1.8, "")]))
scene(g4, T + .3, *parts)

# =====================================================================
# 06 기술적 차별성 — 실제 코드
s6 = S(6); T = nxt(6)
q1, q2, q3, q4, q5 = at("판단하는 규칙"), at("다음 행동을 결정하는"), at("중복을 방지하는"), at("또한 고객이 직접 입력한"), at("이러한 실제 구현내용을")
CY, CH_ = 150, 0
scene(s6, q5 + .3,
    txt("h3 abs", "화면 설명이 아니라 — **코드와 데이터 처리**", s6 + .1, q5 + .3, "left:120px;top:96px;font-size:34px"),
    code("src/lib/growth.ts", "기업별 성장과제 판단 규칙", src("src/lib/growth.ts", [(77, 85), (133, 133), (141, 143), (155, 155)], maxc=56), 80, CY, 570, s6 + .3, q5 + .3,
         hls=[(83, q1, q2), (141, q4 - 3, q4), (155, q1 + 1.0, q2)], fs=16, glow=(q1, q2)),
    code("src/lib/self-run.ts", "고객 실행상태 · 다음 행동", src("src/lib/self-run.ts", [(169, 172), (204, 208), (246, 249)], maxc=56), 675, CY, 570, s6 + .6, q5 + .3,
         hls=[(207, q2, q3), (208, q2 + .6, q3), (248, q2 + 1.2, q3), (170, q4, q5 + .3), (172, q4 + .4, q5 + .3)], fs=16, glow=(q2, q3)),
    code("supabase/setup.sql", "중복방지 · 권한 · 자동업무 트리거", src("supabase/setup.sql", [(1566, 1567), (1623, 1629), (1673, 1674)], maxc=56), 1270, CY, 570, s6 + .9, q5 + .3,
         hls=[(1567, q3, q4 + 1), (1626, q4 + .8, q5 + .3), (1629, q4 + 1.2, q5 + .3), (1673, q3 + 1.0, q4)], fs=16, glow=(q3, q4)),
    txt("small abs", "기록마다 결과의 근거를 구분해 표시 — resultBasis()", q4 + .2, q5 + .3, "left:120px;top:720px;letter-spacing:.04em"),
    box("pill abs", "고객 직접 입력", q4 + .4, q5 + .3, "left:120px;top:770px", "up"),
    box("pill abs", "고객 근거 첨부 · 확인 전", q4 + .8, q5 + .3, "left:430px;top:770px", "up"),
    box("pill acc2 abs", "담당자 확인", at("담당자가 근거를 확인한"), q5 + .3, "left:850px;top:770px", "up"),
    txt("small abs", "담당자는 고객이 고른 상태를 바꿀 수 없습니다 — 서버가 막습니다", at("구분해 기록"), q5 + .3, "left:1110px;top:786px"),
)
ROWS = [("업무 이벤트 기록", "supabase/setup.sql · kpjk_after_client_file()\nsrc/lib/store.ts · setSelfStatus()"),
        ("기업별 상태 갱신", "src/lib/stages.ts · stageToCustomerStep()\nself_runs.status"),
        ("후속행동 생성", "src/lib/growth.ts · growthBoard()\nsrc/lib/self-run.ts · nextStep() · followUpOf()"),
        ("역할별 출력 · 접근통제", "supabase/setup.sql · kpjk_can_see_company() · RLS 정책"),
        ("실행결과 재반영 · 중복 방지", "growth.ts · FOLLOW_UP · setup.sql · kpjk_after_self_run()\nself_runs_once_uidx · tasks_rule_key_uidx")]
tb = "".join(f'<tr data-in="{q5 + .3 + i*.35:.2f}" data-out="{T+.3:.2f}" data-a="up"><td style="width:34%">{esc(a)}</td><td class="f">{esc(b)}</td></tr>' for i, (a, b) in enumerate(ROWS))
scene(q5, T + .3,
    txt("eyebrow abs", "Structure ↔ Code", q5 + .1, T + .3, "left:120px;top:140px"),
    txt("h3 abs", "구조 단계 ↔ 실제 구현 위치 (요약) — 상세 대응은 **검증보고서**에", q5 + .2, T + .3, "left:120px;top:186px"),
    box("glass abs", f'<table class="map"><tr><th>구조 단계</th><th>구현 위치 (저장소 파일 · 함수)</th></tr>{tb}</table>', q5 + .3, T + .3, "left:120px;top:270px;width:1680px;padding:30px 30px 14px", "card"),
)

# =====================================================================
# 07 객관적 검증 · 개발 역량
s7 = S(7); T = nxt(7)
v1, v2, v3, v4, v5 = at("개발사의 최신 시험기록"), at("다만 이는"), at("기술기획과 현장"), at("앞으로는 실제 고객"), at("228개")
areas = [("고객자료 제출", "고객자료 제출"), ("검토", "검토"), ("자동업무 생성", "자동업무 생성"), ("접근권한", "접근권한"), ("상태변경", "상태변경"), ("데이터 저장", "데이터 저장")]
parts = [txt("eyebrow abs", "Verification", s7 + .1, v1 + .3, "left:120px;top:200px"), txt("h2 abs", "개발 과정에서 진행한 시험", s7 + .2, v1 + .3, "left:120px;top:250px")]
for i, (lab, ph) in enumerate(areas):
    parts.append(box("chip", f'<span class="ok" style="color:var(--ok)">✓</span> {esc(lab)}', at(ph, s7), v1 + .3, f"left:{120 + (i % 3) * 560}px;top:{420 + (i // 3) * 130}px;font-size:32px;padding:20px 32px", "card"))
scene(s7, v1 + .3, *parts)
dl = [l for l in open(f"{W}/logs/daily.log", encoding="utf-8").read().split("\n") if l.endswith(": OK") or ": OK " in l]
pick = []
for pre in ["1 대시보드에 오늘 할 업무", "8 파일 두 개를 한 번에 제출", "8 유효기간 있는 서류 검토", "12 4일 미확인 → 담당자 확인 연락 업무", "12 대표가 보면 확인 연락 업무 자동 완료",
            "17 TEST03", "17 TEST04 신청 완료", "17 TEST05 선정", "17 TEST06", "17 TEST07 고객 A 는", "17 TEST08 비회원 /learn: 공개", "17 TEST10"]:
    m = next((l for l in dl if l.startswith(pre)), None)
    if not m: raise SystemExit(f"시험 기록에 없음: {pre}")
    pick.append(m.split(": OK")[0])
summary = next(l for l in open(f"{W}/logs/daily.log", encoding="utf-8") if l.startswith("== OK"))
rls_sum = open(f"{W}/logs/rls.log", encoding="utf-8").read().strip().split("\n")[-1]
RLS = ["고객A: 보이는 회사가 A다", "고객A: B사 문의는 안 보인다", "고객A: B사 기업정보를 못 고친다", "고객A: 다른 회사 이름으로는 못 만든다", "고객A: 스스로 대표가 못 된다",
       "고객B: A사 실행 기록이 안 보인다", "고객B: A사 실행 기록을 못 바꾼다", "컨설턴트(내담당): B사 업무 안 보인다", "비회원: 고객 실행 기록을 못 본다"]
rls_src = open(os.path.join(REPO, "supabase/test/010_rls_test.sql"), encoding="utf-8").read()
for r in RLS:
    if f"'{r}'" not in rls_src: raise SystemExit(f"RLS 시험에 없음: {r}")
cut = lambda s, n=44: s if len(s) <= n else s[:n - 1] + "…"
term1 = "".join(f'<div><span class="ok">OK</span>  {esc(cut(l))}</div>' for l in pick)
term2 = "".join(f'<div><span class="ok">✓</span>  {esc(r)}</div>' for r in RLS)
w5 = at("202개")
scene(v1, v2 + .3,
    box("term", f'<div class="hd">업무 흐름 시험 <span class="d">tools/acceptance/daily.mjs · 2026-10-28</span></div><div class="body">{term1}<div class="sum" data-in="{v5:.2f}" data-out="{v2+.3:.2f}" data-a="scale">{esc(summary.strip())}  <span class="acc">(228개 항목)</span></div></div>',
        v1, v2 + .3, "left:100px;top:120px;width:840px", "card"),
    box("term", f'<div class="hd">데이터베이스 권한 시험 <span class="d">supabase/test/010_rls_test.sql</span></div><div class="body">{term2}<div class="sum" data-in="{w5:.2f}" data-out="{v2+.3:.2f}" data-a="scale">{esc(rls_sum)}  <span class="acc">(202개 항목)</span></div></div>',
        w5 - 1.0, v2 + .3, "left:980px;top:120px;width:840px", "card"),
)
scene(v2, v3 + .3,
    txt("h2 abs", "개발 · 시험환경 결과와\n실제 고객 성과는 **구분**합니다", v2 + .1, v3 + .3, "left:120px;top:210px"),
    box("glass abs", '<div class="small">지금 확인한 것</div><div class="h3" style="margin-top:14px">개발 · 시험환경에서<br>기능이 설계대로 작동</div><div class="small" style="margin-top:20px">업무 흐름 시험 · 권한 시험 통과</div>', v2 + 1.0, v3 + .3, "left:120px;top:470px;width:780px;padding:40px", "card"),
    box("glass abs", '<div class="small">아직 말하지 않는 것</div><div class="h3" style="margin-top:14px">실제 고객기업의<br>업무효율 개선 성과</div><div class="small" style="margin-top:20px">도입 전 기준선 확보 후 측정 · 개선율 표시 안 함</div>', at("실제 고객기업의", v2), v3 + .3, "left:1020px;top:470px;width:780px;padding:40px", "card"),
)
MIL = [("2026-09-08", "첫 구축 (데모)"), ("2026-09-11", "매출기회 Closed Loop"), ("2026-09-16", "서버 연결 · 접근권한"), ("2026-09-30", "실서버 파일럿 검증"),
       ("2026-10-01", "지원사업 매칭 (베타)"), ("2026-10-19", "경과 보고 · 고객 확인"), ("2026-10-28", "스스로 준비하기")]
import subprocess
log = subprocess.check_output(["git", "-C", REPO, "log", "--date=short", "--format=%ad"]).decode().split()
for d, _ in MIL:
    if d not in log: raise SystemExit(f"개발 이력에 없는 날짜: {d}")
tl = []
x0, x1_, yy = 200, 1720, 760
for i, (d, t) in enumerate(MIL):
    x = x0 + (x1_ - x0) * i / (len(MIL) - 1)
    tin = v3 + 1.5 + i * .45
    tl.append(f'<div class="tl-dot" style="left:{x:.0f}px;top:{yy}px" data-in="{tin:.2f}" data-out="{v4+.3:.2f}" data-a="scale"></div>')
    tl.append(f'<div class="tl" style="left:{x:.0f}px;top:{yy + 26}px" data-in="{tin:.2f}" data-out="{v4+.3:.2f}" data-a="up"><b>{d[5:].replace("-", ".")}</b><span>{esc(t)}</span></div>')
scene(v3, v4 + .3,
    box("glass hl abs", '<div class="small">KPJK</div><div class="h3" style="margin-top:12px">기술기획 · 현장 업무규칙</div><div class="small" style="margin-top:14px">컨설팅 경험을 기반으로 수립</div>', v3 + .1, v4 + .3, "left:120px;top:180px;width:800px;padding:36px 40px", "card"),
    box("glass abs", '<div class="small">외부 전문개발사</div><div class="h3" style="margin-top:12px">소프트웨어 구현</div><div class="small" style="margin-top:14px">협력 개발</div>', at("소프트웨어 구현은"), v4 + .3, "left:1000px;top:180px;width:800px;padding:36px 40px", "card"),
    txt("small abs", "개발 이력 — git 커밋 기록 (발췌)", v3 + 1.2, v4 + .3, "left:120px;top:640px;letter-spacing:.08em"),
    wire([(f"M{x0} {yy} L{x1_} {yy}", v3 + 1.3, v3 + 4.2, "soft")]), *tl,
)
scene(v4, T + .3,
    txt("eyebrow abs", "Next", v4 + .1, T + .3, "left:120px;top:320px"),
    txt("h2 abs", "실제 고객 사용기록과 개선효과를 축적해\n실효성을 **계속 검증**합니다", v4 + .2, T + .3, "left:120px;top:370px"),
    txt("p abs", "고객 실행 기록은 실제 고객 · 시험 기업을 나눠 집계합니다", v4 + 1.2, T + .3, "left:120px;top:560px"),
)

# =====================================================================
# 08 최종 소명
s8 = S(8); T = DUR
z1, z2, z3 = at("특허출원 자체가"), at("이번에 추가로 제출하는"), at("감사합니다")
scene(s8, z1 + .3,
    txt("h2 abs", "아이디어가 아니라\n실제 **프로그램 · 데이터 처리구조**", s8 + .1, z1 + .3, "left:120px;top:200px"),
    browser("pc-tasks-auto", 120, 400, 720, s8 + .6, z1 + .3, url="kpj-kcorp.vercel.app/ax/tasks", a="card"),
    phone("ph-docs-revision", 960, 150, 300, s8 + 1.0, z1 + .3, a="card"),
    code("supabase/setup.sql", "서버 트리거", src("supabase/setup.sql", [(1028, 1030)], maxc=50), 1320, 420, 500, s8 + 1.4, z1 + .3, fs=15),
)
scene(z1, z2 + .3,
    txt("h2 abs", "특허출원 자체가 기술적 우수성을\n증명하지는 않습니다", z1 + .1, z2 + .3, "left:0;right:0;text-align:center;top:330px"),
    txt("p abs", "그래서 구현 · 작동 · 시험의 근거를 함께 제출합니다", z1 + 1.6, z2 + .3, "left:0;right:0;text-align:center;top:540px"),
)
LST = [("소스코드 대응자료", "소스코드 대응자료"), ("작동 화면", "작동 화면"), ("개발이력", "개발이력"), ("시험기록", "시험기록"), ("기술혁신성 소명서", None), ("기술구현 검증보고서", None)]
items = []
for i, (t, ph) in enumerate(LST):
    tin = at(ph, z2) if ph else at("개발이력", z2) + 1.0 + (i - 4) * .4
    items.append(f'<div class="check" style="margin-bottom:24px" data-in="{tin:.2f}" data-out="{z3+.3:.2f}" data-a="left"><i>✓</i>{esc(t)}</div>')
scene(z2, z3 + .3,
    txt("eyebrow abs", "추가 제출 자료", z2 + .1, z3 + .3, "left:120px;top:200px"),
    txt("h2 abs", "기술의 **실체**와\n개발 가능성을\n검토해 주십시오", z2 + .2, z3 + .3, "left:120px;top:250px"),
    box("glass abs", "".join(items), z2 + .3, z3 + .3, "left:1000px;top:190px;width:800px;padding:44px 50px 22px", "card"),
)
scene(z3 - .2, T,
    box("abs", '<div class="logo">KPJK</div>', z3, T, "left:0;right:0;text-align:center;top:300px", "scale"),
    txt("h2 abs", "감사합니다", z3 + .3, T, "left:0;right:0;text-align:center;top:480px"),
    txt("p abs", "KPJK Consulting AX — 상태 기반 후속행동 기술", z3 + .8, T, "left:0;right:0;text-align:center;top:590px"),
    box("pill acc2 abs", esc(PATENT), z3 + 1.2, T, "left:0;right:0;margin:0 auto;width:max-content;top:670px", "up"),
)

# ---------- 장 표시 ----------
CH_NAMES = {1: ("01", "영상의 목적", NOTE_SCREEN), 2: ("02", "핵심 기술의 정의", ""), 3: ("03", "핵심 기술 1 · 고객 행동 → 업무 자동생성", NOTE_SCREEN),
            4: ("04", "핵심 기술 2 · 상태관리와 권한별 정보", NOTE_SCREEN), 5: ("05", "핵심 기술 3 · 자기주도 실행으로 확장", NOTE_PROG),
            6: ("06", "기술적 차별성 · 코드와 데이터 처리", ""), 7: ("07", "객관적 검증 · 기술개발 역량", ""), 8: ("08", "최종 소명", NOTE_SCREEN)}
CHAPS = []
for i in range(1, 9):
    a = 0.0 if i == 1 else S(i); b = nxt(i) if i < 8 else at("감사합니다") - .2
    n, t, note = CH_NAMES[i]
    CHAPS.append([round(a, 2), round(b, 2), n, t, note])
CHAPS[0][4] = ""   # 첫 표지에는 표기 없이 — 화면 장면(01-2)에서 붙인다
CHAPS.insert(1, [round(t1, 2), round(nxt(1), 2), "01", "영상의 목적", NOTE_SCREEN]); CHAPS[0][1] = round(t1, 2)

FONT = f"file://{W}/fonts/"
tpl = open(os.path.join(HERE, "comp.tpl.html"), encoding="utf-8").read()
out = (tpl.replace("<!--SCENES-->", "\n".join(SCENES)).replace("/*SUBS*/", json.dumps([[s["in"], s["out"], s["text"]] for s in SUBS], ensure_ascii=False))
       .replace("/*CHAPS*/", json.dumps(CHAPS, ensure_ascii=False)).replace("/*DUR*/", str(DUR)).replace("/*FONT*/", FONT))
open(f"{W}/comp.html", "w", encoding="utf-8").write(out)
print("scenes", len(SCENES), "DUR", DUR)
