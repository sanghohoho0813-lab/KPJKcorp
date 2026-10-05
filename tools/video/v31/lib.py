# V3.1 장면 도우미 — 가이드 14-2 + 실제 기기 비율 휴대폰 · 실제 스크롤 · PC 부분 확대 · PC+휴대폰 조합
import json, html, os
HERE = os.path.dirname(os.path.abspath(__file__))
META = json.load(open(f"{HERE}/cap/meta.json"))
NOTE = "화면 속 기업·인물은 예시 데이터입니다"
C = dict(teal="var(--teal)", blue="var(--blue)", amber="var(--amber)", green="var(--green)",
         rose="var(--rose)", violet="var(--violet)", copper="var(--copper)")
PW, PH = 390, 879          # 휴대폰 캡처 화면 (css px)
CAP = "../cap"

class Ctx:
    def __init__(self, d, voice_len):
        self.SUBS = json.load(open(f"{d}/subs.json"))
        self.S = [s["in"] for s in self.SUBS]
        self.PLAIN = [s["text"].replace("**", "").replace("\n", " ") for s in self.SUBS]
        self.DUR = round(voice_len + 0.6 + 2.6, 2)
        self.scenes = []
        self.d = d
    def si(self, prefix):
        for i, p in enumerate(self.PLAIN):
            if p.startswith(prefix): return i
        raise SystemExit(f"자막에 없음: {prefix}")
    def at(self, prefix):
        """대본 문구의 첫 글자 시각 — 자막 안 중간 문구도 찾는다"""
        A = json.load(open(f"{self.d}/align.json"))
        import re
        sc = A["script"]; q = re.sub(r"[^0-9A-Za-z가-힣]", "", prefix); i = sc.find(q)
        if i < 0: raise SystemExit(f"대본에 없음: {prefix}")
        return A["t0"][i]
    def s(self, prefix): return self.S[self.si(prefix)]
    def scene(self, tin, tout, body, light=False):
        bg = '<div class="lbg"></div>' if light else ""
        self.scenes.append(f'<div class="scene{" light" if light else ""}" data-in="{tin:.2f}" data-out="{tout:.2f}">{bg}\n{body}\n</div>')
    def bounds(self, starts, X=.25):
        self.B = [0.0] + [self.s(p) for p in starts] + [self.DUR]
        return self.B
    def T(self, i, X=.25):
        B = self.B
        return B[i], (B[i + 1] + X if i + 1 < len(B) - 1 else self.DUR)
    def write(self):
        subs_js = json.dumps([[s["in"], s["out"], s["text"]] for s in self.SUBS], ensure_ascii=False)
        tpl = open(f"{HERE}/comp.tpl.html").read()
        out = tpl.replace("<!--SCENES-->", "\n".join(self.scenes)).replace("/*SUBS*/", subs_js).replace("/*DUR*/", str(self.DUR))
        open(f"{self.d}/comp.html", "w").write(out)
        print("scenes", len(self.scenes), "DUR", self.DUR)

def f2(x): return f"{x:.2f}"
def esc(t): return html.escape(t).replace("\n", "<br>")
def em(t): return "".join(f'<span class="acc">{p}</span>' if i % 2 else p for i, p in enumerate(esc(t).split("**")))
def el(cls, txt, tin, tout, style="", a="up", extra=""):
    return f'<div class="{cls}" style="{style}" data-in="{tin:.2f}" data-out="{tout:.2f}" data-a="{a}" {extra}>{em(txt)}</div>'
def raw(cls, inner, tin, tout, style="", a="up", extra=""):
    return f'<div class="{cls}" style="{style}" data-in="{tin:.2f}" data-out="{tout:.2f}" data-a="{a}" {extra}>{inner}</div>'
def eyebrow(t, tin, tout, top=250): return el("eyebrow abs", t, tin, tout, f"left:72px;right:120px;top:{top}px", "fade")
def note(tin, tout, top=1262, left=72, text=NOTE):
    return f'<div class="note" style="top:{top}px;left:{left}px" data-in="{tin:.2f}" data-out="{tout:.2f}" data-a="fade">{esc(text)}</div>'
def dimattr(dim): return f'data-dim="{dim:.2f}"' if dim else ""
def numtag(n, txt, tin, tout, style, c="copper", dim=None):
    return (f'<div class="numtag abs" style="{style};--c:{C[c]}" data-in="{tin:.2f}" data-out="{tout:.2f}" data-a="left" {dimattr(dim)}>'
            f'<span class="num">{n}</span><span>{em(txt)}</span></div>')
def check(txt, tin, tout, style, mark="✓", c="copper", dim=None):
    return (f'<div class="check abs" style="{style};--c:{C[c]}" data-in="{tin:.2f}" data-out="{tout:.2f}" data-a="left" {dimattr(dim)}>'
            f'<span class="mark">{mark}</span><span>{em(txt)}</span></div>')
def chip(txt, tin, tout, style, c="copper", big=False, a="up", dim=None):
    return el(f"chip dot abs{' big' if big else ''}", txt, tin, tout, f"{style};--c:{C[c]}", a, dimattr(dim))
def node(txt, tin, tout, style, c="copper", hi=False, big=False):
    return el(f"node abs{' hi' if hi else ''}{' big' if big else ''}", txt, tin, tout, f"{style};--c:{C[c]}", "scale")
def bubble(txt, tin, tout, style, c="copper", dim=None):
    return el("bubble abs", txt, tin, tout, f"{style};--c:{C[c]}", "up", dimattr(dim))
def row(l, r, tin, tout, style, c="copper", dim=None, big=False):
    return raw("row abs" + (" big" if big else ""), f'<span class="rl">{em(l)}</span><span class="rr">{em(r)}</span>', tin, tout, f"{style};--c:{C[c]}", "left", dimattr(dim))
def deco(kind, x, y, size, c, tin, tout):
    # 바깥 상자가 나타나고, 안쪽 도형이 자기 투명도(.35/.16/.14)를 지킨다
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{size}px;height:{size}px" data-in="{tin:.2f}" data-out="{tout:.2f}" data-a="scale">'
            f'<div class="deco {kind}" style="left:0;top:0;width:{size}px;height:{size}px;--c:{C[c]}"></div></div>')
def strike(txt, tin, tout, t_strike, style, cls="h3 dimtxt"):
    return (f'<div class="{cls} abs" style="{style}" data-in="{tin:.2f}" data-out="{tout:.2f}" data-a="up">'
            f'<span style="position:relative;display:inline-block">{em(txt)}<span class="strike" data-strike="{t_strike:.2f}"></span></span></div>')
def status(txt, tin, tout, style):
    return raw("status abs", f"<i></i>{em(txt)}", tin, tout, style, "scale")
def hub(txt, tin, tout, x, y, small=False):
    r = 75 if small else 95
    return el(f"hub abs{' small' if small else ''}", txt, tin, tout, f"left:{x-r}px;top:{y-r}px", "scale")
def line(x1, y1, x2, y2, t0, t1, w=4, col="var(--acc)", dash=""):
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{col}" stroke-width="{w}" stroke-linecap="round" '
            f'data-draw="{t0:.2f},{t1:.2f}"/>')
def path(d, t0, t1, w=4, col="var(--acc)"):
    return f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linecap="round" data-draw="{t0:.2f},{t1:.2f}"/>'
def svg(inner, tin, tout):
    return (f'<svg class="abs" width="1080" height="1920" viewBox="0 0 1080 1920" style="left:0;top:0;overflow:visible" '
            f'data-in="{tin:.2f}" data-out="{tout:.2f}" data-a="fade">{inner}</svg>')
def glass(style, tin, tout, cls="", c=None, dim=None, inner=""):
    bar = '<div class="stagebar"></div>' if c else ""
    cc = f";--c:{C[c]}" if c else ""
    return f'<div class="glass abs {cls}" style="{style}{cc}" data-in="{tin:.2f}" data-out="{tout:.2f}" data-a="card" {dimattr(dim)}>{bar}{inner}</div>'
def orbit(t0, cx, cy, rx, ry, per=4, tin=0, tout=0):
    return f'<div class="orbit abs" data-orbit="{t0:.2f},{cx},{cy},{rx},{ry},{per}" data-in="{tin:.2f}" data-out="{tout:.2f}" data-a="fade"></div>'
def mover(a, b, x0, y0, x1, y1):
    return f'<div class="mover abs" data-move="{a:.2f},{b:.2f},{x0:.0f},{y0:.0f},{x1:.0f},{y1:.0f}" style="opacity:0"></div>'
def focus(x, y, w, h, a, b):
    return f'<div class="focus" style="left:{x:.0f}px;top:{y:.0f}px;width:{w:.0f}px;height:{h:.0f}px;opacity:0" data-focus="{a:.2f},{b:.2f}"></div>'
def devlabel(t, x, y, tin, tout): return el("devlabel abs", t, tin, tout, f"left:{x}px;top:{y}px", "fade")

# ── 휴대폰 (9:19.7 실제 기기 비율) ──
class Phone:
    """layers: ('img', 이름, 시작, 끝) — 정지 화면 / ('scroll', 이름, 시작, 끝, [(시각, scrollY css), …]) — 실제 스크롤"""
    def __init__(self, x, y, w):
        self.x, self.y, self.w = x, y, w
        self.sw = w - 28
        self.k = self.sw / PW
        self.sh = round(PH * self.k)
        self.h = self.sh + 28
    def scr(self, cx, cy):          # 화면 css 좌표 → 장면 좌표
        return self.x + 14 + cx * self.k, self.y + 14 + cy * self.k
    def box(self, cx, cy, cw, ch, a, b, pad=6):
        X, Y = self.scr(cx, cy)
        return focus(X - pad, Y - pad, cw * self.k + 2 * pad, ch * self.k + 2 * pad, a, b)
    def html(self, tin, tout, layers, a="card"):
        k, sw, sh = self.k, self.sw, self.sh
        inner = []
        for L in layers:
            kind, name, la, lb = L[:4]
            if kind == "img":
                inner.append(f'<img src="{CAP}/{name}.png" style="width:{sw}px" data-in="{la:.2f}" data-out="{lb:.2f}" data-a="fade">')
            else:
                m = META[name]; hdr = next(f for f in m["fixed"] if f["tag"] == "HEADER"); nav = next(f for f in m["fixed"] if f["tag"] == "NAV")
                pth = ",".join(f"{t:.2f}:{y*k:.1f}" for t, y in L[4])
                fr = f"{CAP}/{name}-frame.png"
                inner.append(
                    f'<div class="abs" style="left:0;top:0;width:{sw}px;height:{sh}px;background:#f7f5f1;overflow:hidden" data-in="{la:.2f}" data-out="{lb:.2f}" data-a="fade">'
                    f'<img src="{CAP}/{name}-long.png" style="width:{sw}px" data-path="{pth}">'
                    f'<div class="bar" style="top:0;height:{hdr["h"]*k:.1f}px;background-image:url({fr});background-size:{sw}px auto;background-position:0 0"></div>'
                    f'<div class="bar" style="bottom:0;height:{nav["h"]*k:.1f}px;background-image:url({fr});background-size:{sw}px auto;background-position:0 100%"></div>'
                    f'</div>')
        return (f'<div class="phone abs" style="left:{self.x}px;top:{self.y}px;width:{self.w}px;height:{self.h}px" data-in="{tin:.2f}" data-out="{tout:.2f}" data-a="{a}">'
                f'<div class="screen">{"".join(inner)}</div></div>')

# ── 브라우저 (PC 화면 1440 css 폭, 필요한 부분만 크게) ──
class Browser:
    """layers: (이름, 시작, 끝, [(t0, t1, 배율0, sx0, sy0, 배율1, sx1, sy1)]) — 원본 css 좌표 (sx, sy) 를 view 왼쪽 위로"""
    def __init__(self, x, y, w, h):
        self.x, self.y, self.w, self.h = x, y, w, h
    def sc(self, rw): return self.w / rw
    def pt(self, cx, cy, s, sx, sy):   # 원본 css 좌표 → 장면 좌표 (그 순간의 확대 상태 기준)
        return self.x + (cx - sx) * s, self.y + 38 + (cy - sy) * s
    def box(self, cx, cy, cw, ch, s, sx, sy, a, b, pad=8):
        X, Y = self.pt(cx, cy, s, sx, sy)
        return focus(X - pad, Y - pad, cw * s + 2 * pad, ch * s + 2 * pad, a, b)
    def html(self, tin, tout, layers, a="card"):
        inner = []
        for name, la, lb, kb in layers:
            t0, t1, s0, x0, y0, s1, x1, y1 = kb
            k = f"{t0:.2f},{t1:.2f},{s0:.4f},{-x0*s0:.1f},{-y0*s0:.1f},{s1:.4f},{-x1*s1:.1f},{-y1*s1:.1f}"
            inner.append(f'<img src="{CAP}/{name}.png" class="kb shot" style="width:1440px" data-in="{la:.2f}" data-out="{lb:.2f}" data-a="fade" data-kb="{k}">')
        return (f'<div class="browser abs" style="left:{self.x}px;top:{self.y}px;width:{self.w}px;height:{self.h}px" data-in="{tin:.2f}" data-out="{tout:.2f}" data-a="{a}">'
                f'<div class="bar"><i></i><i></i><i></i><span>BUSINESS AX</span></div><div class="view" style="height:{self.h-38}px;background:#f5f6f8">{"".join(inner)}</div></div>')
def still(t0, s, sx, sy): return (t0, t0 + 1, s, sx, sy, s, sx, sy)
def pan(t0, t1, s0, sx0, sy0, s1, sx1, sy1): return (t0, t1, s0, sx0, sy0, s1, sx1, sy1)
