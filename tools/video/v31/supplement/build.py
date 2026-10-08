# 벤처 실사 보완 영상 — 대표가 직접 설명하는 개발 주체 · 9월 17일 이후 개선 · 단계적 계획 (V3.1)
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lib import *
X = Ctx(os.path.dirname(os.path.abspath(__file__)), 166.87)
s, at, scene, T = X.s, X.at, X.scene, X.T
X.bounds(["약 8년 동안", "많은 중소기업", "재무, 인력", "저는 이 문제를", "현재 저희 회사에", "외부 개발사에는", "9월 17일 벤처",
          "고객이 휴대폰으로", "고객이 자신의", "또 기업의 업종", "실제 사용을", "제가 만들고 싶은", "중소기업 대표가",
          "먼저 저희 기존", "현재는 작은", "저는 이것이", "9월 17일부터"])
L = 72; Wd = 888

# ── ① 문제 제기 ──
# 1 (어두움) — 상담·정보 전달에서 끝나면 안 된다
a, b = T(0)
scene(a, b, "\n".join([
    deco("ring", 770, 230, 250, "copper", a, b),
    eyebrow("KPJK · 경영컨설팅", a + .1, b, 260),
    el("h2 abs", "경영컨설팅은", a + .2, b, f"left:{L}px;top:320px"),
    strike("상담하고 정보를 전달하는 데서", at("단순히상담하고"), b, at("끝나서는"), f"left:{L}px;top:470px;right:90px"),
    el("h1 abs", "끝나면\n**안 된다**", at("끝나서는"), b, f"left:{L}px;top:640px"),
]))
# 2 (어두움) — 약 8년 · 반복해서 느낀 문제
a, b = T(1)
scene(a, b, "\n".join([
    el("bignum abs acc", "약 8년", a + .2, b, f"left:{L}px;top:380px", "scale"),
    el("h2 abs", "기업 대표님들을\n만나며", at("여러기업대표님들을"), b, f"left:{L}px;top:640px;right:100px"),
    chip("반복해서 느낀 문제", at("반복해서느낀"), b, f"left:{L}px;top:930px", "copper", big=True),
    deco("disc", 780, 980, 220, "teal", a, b),
]))
# 3 (밝음) — 대표님의 세 가지 질문 → 한눈에 알기 어렵다
a, b = T(2)
t_hard = at("한눈에알기는")
scene(a, b, "\n".join([
    el("eyebrow abs", "PROBLEM", a + .1, b, f"left:{L}px;top:250px", "fade"),
    el("h2 abs", "열심히 운영하지만", a + .3, b, f"left:{L}px;top:310px"),
    bubble("지금 어떤 상태인가?", at("지금어떤상태"), b, f"left:{L}px;top:470px", "teal", dim=t_hard),
    bubble("무엇이 부족한가?", at("무엇이부족한지"), b, "left:250px;top:600px", "amber", dim=t_hard),
    bubble("다음 단계엔 무엇을 준비할까?", at("다음단계에서"), b, f"left:{L}px;top:730px", "violet", dim=t_hard),
    row("우리 회사를 한눈에", "알기 **어렵다**", t_hard, b, f"left:{L}px;top:920px;width:{Wd}px", "rose", big=True),
]), light=True)
# 4 (어두움) — 흩어진 정보 → 기다리거나 놓치거나
a, b = T(3)
t_wait, t_miss = at("전문가가알려줄"), at("좋은기회가")
scene(a, b, "\n".join([
    chip("재무", at("재무인력"), b, "left:110px;top:300px;transform:rotate(-4deg)", "teal", big=True, a="scale", dim=t_wait),
    chip("인력", at("인력인증"), b, "left:420px;top:350px", "blue", big=True, a="scale", dim=t_wait),
    chip("인증", at("인증기술"), b, "left:720px;top:290px;transform:rotate(3deg)", "amber", big=True, a="scale", dim=t_wait),
    chip("기술 개발", at("기술개발정부"), b, "left:170px;top:480px", "green", big=True, a="scale", dim=t_wait),
    chip("정부 지원사업", at("정부지원사업"), b, "left:520px;top:520px;transform:rotate(-2deg)", "violet", big=True, a="scale", dim=t_wait),
    el("h2 abs", "여러 곳에 **흩어져** 있다", at("흩어져"), b, f"left:{L}px;top:680px", "up"),
    row("전문가가 알려줄 때까지", "**기다림**", t_wait, b, f"left:{L}px;top:870px;width:{Wd}px", "amber", big=True),
    row("좋은 기회가 있어도", "모르고 **지나감**", t_miss, b, f"left:{L}px;top:1030px;width:{Wd}px", "rose", big=True),
]))

# ── ② 방향 ──
# 5 (밝음) — 컨설팅을 더 많이 X → 스스로 이해 · 확인 · 실행
a, b = T(4)
t1, t2, t3, t4 = at("기업대표님스스로"), at("다음에필요한일"), at("직접하나씩"), at("그래서이시스템")
scene(a, b, "\n".join([
    strike("컨설팅을 더 많이 해주는 방식", a + .2, b, at("싶지않았습니다"), f"left:{L}px;top:300px;right:90px"),
    node("대표가 **스스로** 회사를 이해", t1, b, f"left:{L}px;top:470px;width:{Wd}px", "teal", big=True),
    svg(line(516, 590, 516, 640, t2 - .2, t2 + .3, 5) + line(516, 760, 516, 810, t3 - .2, t3 + .3, 5), a, b),
    node("다음에 필요한 일 확인", t2, b, f"left:{L}px;top:650px;width:{Wd}px", "blue", big=True),
    node("직접 하나씩 **실행**", t3, b, f"left:{L}px;top:820px;width:{Wd}px", "copper", hi=True, big=True),
    chip("그래서 이 시스템의 개발을 시작", t4, b, f"left:{L}px;top:1030px", "copper", big=True),
]), light=True)

# ── ③ 개발 주체 (핵심) ──
# 6 (어두움) — 상근 개발자 없음 · 대표가 직접 주도한 4가지
a, b = T(5)
t_lead = at("제가직접주도")
scene(a, b, "\n".join([
    status("별도의 상근 개발자 없음", a + .3, b, f"left:{L}px;top:260px"),
    glass(f"left:{L}px;top:380px;width:{Wd}px;height:720px", at("대신현장에서"), b, cls="hiedge", c="copper",
          inner='<div class="eyebrow" style="position:absolute;left:50px;top:40px">대표 직접 주도</div>'),
    numtag("01", "현장의 **문제** 찾기", at("어떤문제가있는지"), b, "left:120px;top:490px", "teal"),
    numtag("02", "업무 **순서** 정하기", at("업무가어떤순서로"), b, "left:120px;top:620px", "blue"),
    numtag("03", "고객에게 보여줄 **정보** 기획", at("고객에게어떤정보를"), b, "left:120px;top:750px", "amber"),
    numtag("04", "써 보며 문제 **다시 찾기**", at("실제결과물을사용"), b, "left:120px;top:880px", "green"),
    el("h3 abs", "제가 **직접 주도**", t_lead, b, "left:120px;top:1000px", "fade"),
]))
# 7 (어두움, 같은 문법) — 기획 → 외부 개발사가 구현
a, b = T(6)
t_impl = at("구현하는기술개발")
scene(a, b, "\n".join([
    glass(f"left:{L}px;top:300px;width:{Wd}px;height:250px", a + .2, b, cls="hiedge", c="copper",
          inner='<div class="eyebrow" style="position:absolute;left:50px;top:40px">KPJK 대표</div><div class="h2" style="position:absolute;left:50px;top:100px">기획 · <span class="acc">검증</span></div>'),
    svg(line(516, 570, 516, 690, at("그기획을"), at("그기획을") + .7, 6), a, b),
    glass(f"left:{L}px;top:710px;width:{Wd}px;height:250px", at("그기획을") + .5, b, c="violet",
          inner='<div class="eyebrow" style="position:absolute;left:50px;top:40px">외부 개발사</div><div class="h2" style="position:absolute;left:50px;top:100px">소프트웨어 구현</div>'),
    chip("기술 개발 위탁", t_impl, b, f"left:{L}px;top:1010px", "violet", big=True),
]))

# ── ④ 9월 17일 이후 개선 (실제 화면) ──
# 8 (밝음) — 도입 전후 변화를 확인할 기준
a, b = T(7)
br = Browser(L, 560, Wd, 640)
t_base = at("도입전후의")
sb = Wd / 1110
scene(a, b, "\n".join([
    status("9월 17일 신청 이후에도", a + .2, b, f"left:{L}px;top:260px"),
    el("h2 abs", "도입 **전후 변화**를\n확인할 기준", t_base, b, f"left:{L}px;top:350px;right:90px"),
    br.html(t_base + .2, b, [("f-pc-baseline", t_base + .2, b, pan(t_base + .3, b, sb, 320, 90, sb, 320, 300))]),
    note(t_base + .3, b, 1220),
]), light=True)
# 9 (어두움) — 휴대폰 제출 → 내부 업무 (PC + 휴대폰, 데이터 점 이동)
a, b = T(8)
ph = Phone(L, 470, 380)
br = Browser(250, 230, 710, 560)
t_sub, t_task = at("자료를제출하면"), at("내부업무로")
bx, by = ph.scr(304, 839)
scene(a, b, "\n".join([
    br.html(a + .1, b, [
        ("f-pc-tasks", a + .1, t_task + .4, still(a, 1.0, 330, 80)),
        ("f-pc-task-doc", t_task, b, still(t_task, 1.0, 330, 520)),
    ]),
    br.box(338, 632, 690, 118, 1.0, 330, 520, t_task + .5, b),
    ph.html(a + .3, b, [("img", "f-phone-docs", a + .3, t_sub + .3), ("img", "f-phone-upload", t_sub, b)]),
    ph.box(242, 813, 124, 52, t_sub + .4, t_task + .2),
    mover(t_task - .5, t_task + .5, bx, by, 560, 620),
    chip("자동으로 업무 생성", t_task + .6, b, "left:520px;top:860px", "copper", big=True),
    note(a + .3, b, 1262, 480),
]))
# 10 (밝음) — 기업 상태와 다음 성장 과제: 휴대폰 실제 스크롤
a, b = T(9)
ph = Phone(L, 222, 490)
M = META["f-phone-home"]["marks"]
t_st, t_nx = at("기업상태와"), at("다음성장과제를")
y1, y2, y3 = M["우리 회사 한눈에"] - 75, M["성장 체크리스트"] - 75, M["다음으로 검토할 성장과제"] - 75
scene(a, b, "\n".join([
    ph.html(a + .2, b, [("scroll", "f-phone-home", a + .2, b, [(a, 0), (t_st, 0), (t_st + 1.0, y1), (t_nx - .1, y1), (t_nx + .9, y2), (t_nx + 2.6, y2), (t_nx + 3.6, y3)])]),
    el("eyebrow abs", "CLIENT PORTAL", a + .1, b, "left:610px;top:250px", "fade"),
    el("h3 abs", "대표가 직접\n확인하는", a + .3, b, "left:610px;top:300px"),
    check("기업 상태", t_st, b, "left:610px;top:520px", c="teal", dim=t_nx),
    check("다음 **성장 과제**", t_nx, b, "left:610px;top:620px", c="copper"),
    note(a + .3, b, 1180, 610, "화면 속 기업·인물은\n예시 데이터입니다"),
]), light=True)
# 11 (어두움) — 업종·지역·업력 → 지원사업 확인 → 관심 → 담당자 업무
a, b = T(10)
ph = Phone(470, 222, 490)
M = META["f-phone-programs"]["marks"]
t_chk, t_int, t_go = at("검토할만한"), at("관심을보이면"), at("이어지도록고도화")
scene(a, b, "\n".join([
    chip("업종", at("업종지역"), b, f"left:{L}px;top:300px", "teal", big=True),
    chip("지역", at("지역업력"), b, f"left:{L}px;top:410px", "blue", big=True),
    chip("업력", at("업력에따라"), b, f"left:{L}px;top:520px", "amber", big=True),
    svg(line(170, 640, 170, 720, t_chk - .2, t_chk + .4, 5) + line(170, 900, 170, 980, t_int + .2, t_int + .8, 5), a, b),
    el("h3 abs", "검토할 만한\n**지원사업**", t_chk, b, f"left:{L}px;top:740px"),
    node("**담당자 업무**로", t_int + .6, b, f"left:{L}px;top:1000px;width:360px", "copper", hi=True),
    ph.html(a + .2, b, [("scroll", "f-phone-programs", a + .2, t_int + .4, [(a, 0), (t_chk, 0), (t_chk + 1.2, max(0, M["[경기]"] - 160))]),
                        ("img", "f-phone-ask", t_int, b)]),
    note(a + .3, b, 1262, 470),
]))
# 12 (밝음) — 실제 사용을 생각하며 계속 시험
a, b = T(11)
scene(a, b, "\n".join([
    el("eyebrow abs", "실제 사용을 생각하며", a + .1, b, f"left:{L}px;top:260px", "fade"),
    el("h1 abs", "계속 **시험**", at("계속시험"), b, f"left:{L}px;top:320px"),
    check("서버", at("서버권한"), b, f"left:{L}px;top:560px", c="teal"),
    check("권한", at("권한휴대폰"), b, "left:540px;top:560px", c="blue"),
    check("휴대폰 사용", at("휴대폰사용"), b, f"left:{L}px;top:690px", c="amber"),
    check("자료 업로드", at("자료업로드"), b, "left:540px;top:690px", c="green"),
    check("오류 발생 시 **복구**", at("오류발생시"), b, f"left:{L}px;top:820px", c="copper"),
    deco("sq", 780, 980, 200, "teal", a, b),
]), light=True)

# ── ⑤ 목표 ──
# 13 (어두움) — 직원 일을 편하게 하는 프로그램만은 아니다
a, b = T(12)
scene(a, b, "\n".join([
    el("h3 abs dimtxt", "제가 만들고 싶은 것은", a + .2, b, f"left:{L}px;top:330px"),
    strike("직원의 일을 조금 편하게 만드는 프로그램", at("KPJK직원의"), b, at("프로그램만은") + .6, f"left:{L}px;top:470px;right:90px"),
    el("h1 abs", "그것**만은**\n아닙니다", at("프로그램만은") + .4, b, f"left:{L}px;top:700px"),
    deco("ring", 770, 1000, 220, "violet", a, b),
]))
# 14 (밝음) — 재무 + 비재무 → 스스로 성장
a, b = T(13)
cx, cy, rx, ry = 540, 640, 320, 250
items = [("재무", at("재무뿐"), "teal"), ("기술", at("기술인증인력"), "blue"), ("인증", at("인증인력시장"), "amber"),
         ("인력", at("인력시장"), "green"), ("시장", at("시장같은"), "violet")]
parts = [hub("우리 회사\n이해", at("자기회사를더깊이"), b, cx, cy)]
for i, (t, tin, c) in enumerate(items):
    ang = -math.pi / 2 + i * 2 * math.pi / 5
    x, y = cx + rx * math.cos(ang), cy + ry * math.sin(ang)
    parts.append(svg(line(cx, cy, x, y, tin, tin + .5, 3, "rgba(164,82,38,.35)"), a, b))
    parts.append(node(t, tin, b, f"left:{x-100:.0f}px;top:{y-44:.0f}px;width:200px", c, hi=(i == 0)))
parts += [
    chip("비재무 요소에도 관심", at("비재무적인"), b, f"left:{L}px;top:270px", "violet", big=True),
    glass(f"left:{L}px;top:960px;width:{Wd}px;height:220px", at("스스로회사를성장"), b, cls="hiedge", c="copper",
          inner='<div class="h3 dimtxt" style="position:absolute;left:50px;top:36px">필요할 땐 전문가와 함께</div><div class="h2" style="position:absolute;left:50px;top:100px"><span class="acc">스스로</span> 성장하는 환경</div>'),
]
scene(a, b, "\n".join(parts), light=True)

# ── ⑥ 계획 · 정직한 현재 ──
# 15 (어두움) — 로드맵 3단계
a, b = T(14)
st = lambda n, t, sub, tin, top, c, dim=None, hi=False: glass(f"left:{L}px;top:{top}px;width:{Wd}px;height:230px", tin, b, cls="hiedge" if hi else "", c=c, dim=dim,
    inner=f'<div class="eyebrow" style="position:absolute;left:50px;top:36px">STEP {n}</div><div class="h3" style="position:absolute;left:50px;top:84px">{em(t)}</div><div class="p" style="position:absolute;left:50px;top:150px;font-size:30px">{esc(sub)}</div>')
t2s, t3s = at("그다음검증된"), at("다른경영컨설팅")
scene(a, b, "\n".join([
    st(1, "기존 고객에 **실제 적용**", "데이터 축적 · 검증", a + .2, 280, "teal", dim=t2s),
    st(2, "업무 구조 **표준화**", "검증된 흐름을 표준으로", t2s, 570, "amber", dim=t3s),
    st(3, "**구독 방식** 서비스로 확장", "다른 경영 컨설팅 회사", t3s, 860, "copper", hi=True),
]))
# 16 (밝음) — 현재는 작은 회사 · 한 번에 크게 X → 단계적으로
a, b = T(15)
t_step = at("단계적으로")
scene(a, b, "\n".join([
    status("현재 · 작은 회사 · 내부 기술 인력 부족", a + .2, b, f"left:{L}px;top:260px"),
    strike("한 번에 크게", at("한번에크게"), b, at("말씀드리기보다"), f"left:{L}px;top:380px"),
    numtag("01", "실제 고객 적용", at("실제고객적용"), b, f"left:{L}px;top:520px", "teal"),
    numtag("02", "검증", at("실제고객적용") + 1.0, b, "left:540px;top:520px", "blue"),
    numtag("03", "데이터 축적", at("데이터축적기술"), b, f"left:{L}px;top:650px", "amber"),
    numtag("04", "기술 인력 확보", at("기술인력확보"), b, "left:540px;top:650px", "green"),
    el("h1 abs", "**단계적으로**", t_step, b, f"left:{L}px;top:840px"),
]), light=True)

# ── ⑦ 결론 ──
# 17 (어두움) — 경험 → 기술과 데이터 → 스스로 성장
a, b = T(16)
t_td, t_grow, t_new = at("기술과데이터로"), at("중소기업이더스스로"), at("새로운방식")
scene(a, b, "\n".join([
    glass(f"left:{L}px;top:270px;width:{Wd}px;height:220px", a + .3, b, c="teal",
          inner='<div class="eyebrow" style="position:absolute;left:50px;top:36px">지금까지</div><div class="h2" style="position:absolute;left:50px;top:92px">경영 컨설팅의 경험</div>'),
    svg(line(516, 505, 516, 600, t_td - .3, t_td + .3, 6), a, b),
    glass(f"left:{L}px;top:615px;width:{Wd}px;height:220px", t_td, b, cls="hiedge", c="copper",
          inner='<div class="eyebrow" style="position:absolute;left:50px;top:36px">앞으로</div><div class="h2" style="position:absolute;left:50px;top:92px"><span class="acc">기술과 데이터</span>로</div>'),
    el("h2 abs", "중소기업이 **스스로 성장**", t_grow, b, f"left:{L}px;top:890px"),
    chip("새로운 방식", t_new, b, f"left:{L}px;top:1020px", "copper", big=True),
]))
# 18 (밝음, 마지막) — 9월 17일 ~ 10월 7일 기록 · 첨부 · 로고
a, b = T(17)
t_s, t_e = at("9월17일부터"), at("10월7일까지")
t_att = at("함께첨부드린")
scene(a, b, "\n".join([
    svg(line(150, 380, 930, 380, t_s + .2, t_e + .6, 6), a, b),
    raw("abs", "", t_s, b, "left:130px;top:360px;width:40px;height:40px;border-radius:50%;background:var(--teal)", "scale"),
    raw("abs", "", t_e, b, "left:910px;top:360px;width:40px;height:40px;border-radius:50%;background:var(--copper)", "scale"),
    el("h3 abs", "9월 17일", t_s, b, f"left:{L}px;top:270px", "up"),
    el("h3 abs", "10월 7일", t_e, b, "left:790px;top:270px", "up"),
    check("고민한 문제", at("어떤문제를고민"), b, f"left:{L}px;top:470px", c="teal"),
    check("개발 요청 · **검증**", at("어떤방향으로"), b, f"left:{L}px;top:580px", c="blue"),
    glass(f"left:{L}px;top:720px;width:{Wd}px;height:230px", t_att, b, cls="hiedge", c="copper",
          inner='<div class="eyebrow" style="position:absolute;left:50px;top:40px">함께 첨부</div><div class="h2" style="position:absolute;left:50px;top:100px">기술 개발 <span class="acc">코드 · 연구 기록</span></div>'),
    raw("logo abs", "KPJK", at("읽어봐주시면") + .2, b, f"left:{L}px;top:1030px;font-size:38px;letter-spacing:.02em", "scale"),
    el("h3 abs", "감사합니다", at("읽어봐주시면") + .4, b, "left:236px;top:1068px", "fade"),
]), light=True)
X.write()
