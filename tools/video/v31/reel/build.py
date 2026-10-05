import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lib import *
X = Ctx(os.path.dirname(os.path.abspath(__file__)), 234.26)
s, at, scene, T = X.s, X.at, X.scene, X.T
X.bounds(["처음부터 IT회사를", "첫 번째 문제는", "고객 수가 적을 때는", "그래서 저희는 단순히", "상담, 계약, 자료 제출", "두 번째 문제는",
          "그래서 고객 포털을", "고객이 자료를 제출하면", "즉, 고객 행동", "이렇게 하면 단순히", "그리고 그만큼 직원들은", "세 번째 문제는",
          "기업 대표가", "기업의 업종, 지역", "중요한 것은 특정", "현장의 문제 정의와", "6월부터 문제를", "앞으로도 한 번에", "그 과정에서 공통",
          "장기적으로는", "저희가 만들고 있는", "회사는 더 많은", "현재는 그 첫 번째"])
L = 72; Wd = 888

# 1 문제 · 후킹 (어두움) — 큰 숫자
a, b = T(0)
scene(a, b, "\n".join([
    deco("ring", 760, 240, 260, "copper", a, b),
    eyebrow("KPJK · 경영컨설팅", a + .1, b, 300),
    el("bignum abs acc", "약 8년", a + .2, b, f"left:{L}px;top:420px", "scale"),
    el("h2 abs", "기업과 법인의\n**경영컨설팅** 현장", a + .5, b, f"left:{L}px;top:680px;right:120px"),
    chip("현장에서 일해온 회사", s("현장에서 일해온"), b, f"left:{L}px;top:960px", "teal", big=True),
]))
# 2 (어두움) — 취소선 → 현장의 반복 문제
a, b = T(1)
scene(a, b, "\n".join([
    strike("IT회사를 만들려고 시작", a + .2, b, a + 1.6, f"left:{L}px;top:380px;right:100px"),
    el("h2 abs", "현장에서\n**반복되는 문제**에서\n시작했습니다", s("오히려 현장에서"), b, f"left:{L}px;top:560px;right:100px"),
    chip("고객 관리", s("오히려 현장에서") + .6, b, f"left:{L}px;top:1000px", "blue"),
    chip("프로젝트 진행", s("프로젝트를 진행"), b, f"left:330px;top:1000px", "amber"),
    chip("같은 문제 반복", s("반복해서 같은"), b, f"left:{L}px;top:1110px", "copper"),
]))
# 3 문제 01 (밝음) — 흩어진 칩
a, b = T(2)
scene(a, b, "\n".join([
    deco("disc", 800, 1000, 240, "teal", a, b),
    el("eyebrow abs", "PROBLEM 01", a + .1, b, f"left:{L}px;top:250px", "fade"),
    el("h1 abs", "정보가\n**흩어진다**", a + .3, b, f"left:{L}px;top:310px"),
    chip("카카오톡 · 상담 내용", at("카카오톡"), b, "left:110px;top:640px;transform:rotate(-4deg)", "amber", big=True, a="scale"),
    chip("엑셀 · 파일 · 자료", at("자료는엑셀"), b, "left:470px;top:760px", "green", big=True, a="scale"),
    chip("캘린더 · 일정", at("일정은캘린더"), b, "left:150px;top:890px", "blue", big=True, a="scale"),
    chip("담당자의 기억 · 다음 할 일", at("담당자의기억"), b, "left:330px;top:1030px", "copper", big=True, a="scale"),
]), light=True)
# 4 (어두움) — 늘어날수록: 확인 시간 ↑ · 누락 ↑
a, b = T(3)
dots = []
for i in range(24):
    cx, cy = 72 + (i % 8) * 110, 520 + (i // 8) * 90
    tin = a + .3 if i < 4 else at("고객과프로젝트가늘어나면") + (i - 4) * .06
    dots.append(f'<div class="abs" style="left:{cx}px;top:{cy}px;width:66px;height:66px;border-radius:18px;background:var(--{["teal","blue","amber","green","violet"][i%5]});opacity:0" data-in="{tin:.2f}" data-out="{b:.2f}" data-a="scale"></div>')
scene(a, b, "\n".join([
    el("h2 abs", "고객과 프로젝트가\n늘어나면", a + .2, b, f"left:{L}px;top:300px;right:100px"),
    *dots,
    row("현재 상태 확인", "시간 **↑**", at("현재상태를확인하는"), b, f"left:{L}px;top:860px;width:{Wd}px", "amber", big=True),
    row("자료 누락 · 후속 연락", "놓칠 가능성 **↑**", at("자료누락이나후속"), b, f"left:{L}px;top:1020px;width:{Wd}px", "rose", big=True),
]))
# 5 (밝음) — CRM 취소선 → 흐름 자체
a, b = T(4)
scene(a, b, "\n".join([
    strike("고객 명단만 관리하는 CRM", a + .3, b, at("CRM이아니라"), f"left:{L}px;top:380px;right:100px"),
    el("h2 abs", "업무의 **흐름 자체**를\n하나의 구조로", at("업무의흐름자체"), b, f"left:{L}px;top:560px;right:100px"),
    deco("sq", 760, 900, 220, "copper", a, b),
    svg(path("M120 900 C 320 820, 520 980, 860 880", at("업무의흐름") + .3, at("업무의흐름") + 1.8, 6), a, b),
]), light=True)
# 6 (밝음) — 업무 → 현재 상태 → 다음 할 일 + PC 실제 화면
a, b = T(5)
br = Browser(L, 470, Wd, 780)
s1 = br.sc(700)
scene(a, b, "\n".join([
    chip("상담 · 계약 · 자료", a + .2, b, f"left:{L}px;top:270px", "teal"),
    el("h3 abs dimtxt", "→", at("그것을기업의"), b, "left:380px;top:270px", "fade"),
    chip("현재 상태", at("현재상태로"), b, "left:440px;top:270px", "blue"),
    el("h3 abs dimtxt", "→", at("다음에해야할일"), b, "left:665px;top:270px", "fade"),
    chip("다음 할 일", at("다음에해야할일"), b, "left:720px;top:270px", "copper"),
    br.html(a + .3, b, [
        ("pc-client-overview", a + .3, at("다음에해야할일") + .5, pan(a + .5, at("현재상태로") + 1.2, s1, 300, 150, s1, 300, 400)),
        ("pc-tasks", at("다음에해야할일"), b, pan(at("다음에해야할일"), b, 1.27, 300, 60, 1.35, 300, 80)),
    ]),
    br.box(310, 560, 1120 / 1.6, 140, s1, 300, 400, at("현재상태로") + 1.3, at("다음에해야할일")),
    note(a + .3, b),
]), light=True)
# 7 문제 02 (어두움) — 고객의 반복 질문
a, b = T(6)
scene(a, b, "\n".join([
    el("eyebrow abs", "PROBLEM 02", a + .1, b, f"left:{L}px;top:250px", "fade"),
    el("h2 abs", "**고객도** 같은 불편", a + .3, b, f"left:{L}px;top:310px"),
    bubble("지금 어디까지 진행됐나요?", s("지금 어디까지"), b, f"left:{L}px;top:480px", "teal", dim=s("이런 질문이")),
    bubble("제가 뭘 더 보내야 하나요?", s("제가 뭘 더"), b, "left:200px;top:610px", "amber", dim=s("이런 질문이")),
    bubble("다음 일정은 언제인가요?", s("다음 일정은"), b, f"left:{L}px;top:740px", "violet", dim=s("이런 질문이")),
    row("고객", "계속 **불편**", s("이런 질문이") + .4, b, f"left:{L}px;top:920px;width:{Wd}px", "rose"),
    row("담당자", "같은 설명 **반복**", s("담당자도 같은"), b, f"left:{L}px;top:1050px;width:{Wd}px", "copper"),
]))
# 8 (밝음) — 고객 포털: 휴대폰 실제 스크롤
a, b = T(7)
ph = Phone(L, 222, 490)
t_now = at("지금해야할일을")
scene(a, b, "\n".join([
    ph.html(a + .2, b, [("scroll", "phone-portal-home", a + .2, at("자료도바로") + .5, [(a, 0), (at("현재진행상황과"), 0), (t_now - .2, 3300)]),
                        ("img", "phone-upload", at("자료도바로"), b)]),
    ph.box(18, 290, 354, 520, at("현재진행상황과") + .2, t_now - .4),
    el("eyebrow abs", "CLIENT PORTAL", a + .1, b, "left:610px;top:250px", "fade"),
    el("h2 abs", "고객 포털", a + .3, b, "left:610px;top:300px"),
    check("진행 상황", at("현재진행상황과"), b, "left:610px;top:520px", c="teal", dim=t_now),
    check("필요한 자료", at("필요한자료"), b, "left:610px;top:620px", c="blue", dim=t_now),
    check("다음 일정", at("다음일정"), b, "left:610px;top:720px", c="amber", dim=t_now),
    check("지금 할 일", t_now, b, "left:610px;top:820px", c="green", dim=at("자료도바로")),
    check("**바로 제출**", at("자료도바로"), b, "left:610px;top:960px", c="copper"),
    note(a + .3, b, 1180, 610, "화면 속 기업·인물은\n예시 데이터입니다"),
]), light=True)
# 9 (어두움) — PC + 휴대폰: 제출 → 검토 업무 → 처리 → 고객 화면
a, b = T(8)
ph = Phone(L, 470, 380)
br = Browser(250, 230, 710, 620)
t_task, t_auto, t_proc, t_back, t_rt = at("KPJK내부시스템"), at("자동으로"), at("담당자가처리하면"), at("그결과가다시"), at("실시간으로")
bx, by = ph.scr(302, 823)
scene(a, b, "\n".join([
    br.html(a + .1, b, [
        ("pc-tasks", a + .1, t_task + .4, still(a, 1.2, 300, 60)),
        ("pc-tasks-new", t_task, t_proc + .4, still(t_task, 1.2, 300, 380)),
        ("pc-review", t_proc, t_proc + 1.6, still(t_proc, 1.2, 560, 380)),
        ("pc-review-done", t_proc + 1.3, b, still(t_proc, 1.0, 259, 418)),
    ]),
    br.box(310, 470, 560, 85, 1.2, 300, 380, t_auto, t_proc),
    br.box(911, 775, 126, 53, 1.2, 560, 380, t_proc + .3, t_proc + 1.4),
    ph.html(a + .3, b, [("img", "phone-upload", a + .3, t_back + 1.2), ("img", "phone-docs-done-2", t_back + 1, b)]),
    ph.box(241, 800, 122, 46, a + .4, s("고객이 자료를") + 1.4),
    mover(s("고객이 자료를") + 1.0, t_task + .3, bx, by, 520, 420),
    mover(t_back + .1, t_back + 1.3, 700, 790, 230, 860),
    ph.box(20, 515, 350, 245, t_rt, b),
    note(a + .3, b, 1262, 480),
]))
# 10 (어두움) — 순환 구조
a, b = T(9)
cx, cy, rx, ry = 516, 760, 300, 380
import math
nodes = [("고객 행동", at("고객행동"), "teal"), ("내부 업무 생성", at("내부업무생성"), "blue"), ("담당자 처리", at("담당자처리"), "amber"),
         ("상태 변경", at("상태변경"), "green"), ("고객 화면 반영", at("고객화면반영"), "violet")]
parts = [svg(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="rgba(232,184,154,.28)" stroke-width="2"/>', a + .2, b),
         orbit(a, cx, cy, rx, ry, 4, a + .2, b)]
for i, (t, tin, c) in enumerate(nodes):
    ang = -math.pi / 2 + i * 2 * math.pi / 5
    x, y = cx + rx * math.cos(ang), cy + ry * math.sin(ang)
    parts.append(node(t, tin, b, f"left:{x-130:.0f}px;top:{y-48:.0f}px;width:260px", c))
parts.append(hub("순환\n구조", at("순환구조"), b, cx, cy))
scene(a, b, "\n".join(parts))
# 11 (밝음) — 편리한 프로그램 X → 시간 ↓ · 누락 ↓
a, b = T(10)
scene(a, b, "\n".join([
    strike("편리한 프로그램 하나", at("편리한프로그램"), b, at("만드는것이아니라") + .2, f"left:{L}px;top:330px;right:100px"),
    glass(f"left:{L}px;top:520px;width:{Wd}px;height:250px", at("사람이반복해서"), b, c="teal",
          inner=f'<div class="h3" style="position:absolute;left:50px;top:40px">반복 확인 · 전달</div><div class="h1 acc" style="position:absolute;left:50px;top:110px">시간 ↓</div>'),
    glass(f"left:{L}px;top:820px;width:{Wd}px;height:250px", at("자료누락이나후속업무"), b, c="copper",
          inner=f'<div class="h3" style="position:absolute;left:50px;top:40px">자료 누락 · 후속 업무</div><div class="h1 acc" style="position:absolute;left:50px;top:110px">놓칠 가능성 ↓</div>'),
]), light=True)
# 12 (어두움) — 단순 확인 → 상담·문제 해결 → 계약과 매출
a, b = T(11)
scene(a, b, "\n".join([
    el("h3 abs dimtxt", "단순 확인 업무보다", a + .2, b, f"left:{L}px;top:300px"),
    node("고객 상담", at("고객상담이나"), b, f"left:{L}px;top:450px;width:420px", "teal", big=True),
    node("문제 해결", at("문제해결"), b, "left:540px;top:450px;width:420px", "blue", big=True),
    svg(line(516, 600, 516, 720, at("새로운계약과매출"), at("새로운계약과매출") + .6, 5), a, b),
    glass(f"left:{L}px;top:760px;width:{Wd}px;height:260px", at("새로운계약과매출"), b, cls="hiedge", c="copper",
          inner='<div class="h2" style="position:absolute;left:60px;top:40px">새로운 <span class="acc">계약과 매출</span></div><div class="h3 dimtxt" style="position:absolute;left:60px;top:150px">에 더 집중</div>'),
]))
# 13 문제 03 (어두움)
a, b = T(12)
scene(a, b, "\n".join([
    el("eyebrow abs", "PROBLEM 03", a + .1, b, f"left:{L}px;top:250px", "fade"),
    el("h2 abs", "컨설팅이\n**한 번의 상담**으로\n끝나는 경우", a + .3, b, f"left:{L}px;top:310px;right:100px"),
    strike("단순 진행 조회 화면", s("그래서 현재의 고객"), b, s("그래서 현재의 고객") + 1.8, f"left:{L}px;top:760px"),
    chip("그 이상으로", s("그래서 현재의 고객") + 2.2, b, f"left:{L}px;top:880px", "copper", big=True),
    deco("ring", 780, 1040, 220, "violet", a, b),
]))
# 14 (밝음) — 기업 성장 관리 플랫폼: 휴대폰 스크롤
a, b = T(13)
ph = Phone(L, 222, 490)
t1, t2, t3, t4, t5 = at("자기회사의현재"), at("지금해야할일진행"), at("진행중인성장과제"), at("다음에검토할과제"), at("기업성장관리플랫폼")
scene(a, b, "\n".join([
    ph.html(a + .2, b, [("scroll", "phone-portal-home", a + .2, b, [(a, 0), (t1 + .2, 0), (t1 + 1.4, 990), (t2 - .1, 990), (t2 + 1.0, 3310), (t3 - .1, 3310), (t3 + 1.0, 4420), (t4 - .1, 4420), (t4 + 1.0, 5390)])]),
    el("h3 abs", "대표가 직접 보는", a + .2, b, "left:610px;top:250px"),
    check("현재 상태", t1, b, "left:610px;top:420px", c="teal", dim=t2),
    check("지금 할 일", t2, b, "left:610px;top:520px", c="blue", dim=t3),
    check("성장 과제", t3, b, "left:610px;top:620px", c="amber", dim=t4),
    check("다음 검토", t4, b, "left:610px;top:720px", c="green", dim=t5),
    el("h3 abs", "**기업 성장 관리**\n플랫폼으로", t5, b, "left:610px;top:880px"),
    note(a + .3, b, 1180, 610, "화면 속 기업·인물은\n예시 데이터입니다"),
]), light=True)
# 15 (어두움) — 지원사업 공고 선별: 휴대폰
a, b = T(14)
ph = Phone(470, 222, 490)
tsel = at("선별해서")
scene(a, b, "\n".join([
    chip("업종", at("업종"), b, f"left:{L}px;top:300px", "teal", big=True),
    chip("지역", at("지역"), b, f"left:{L}px;top:410px", "blue", big=True),
    chip("업력", at("업력등의"), b, f"left:{L}px;top:520px", "amber", big=True),
    svg(line(170, 640, 170, 760, at("기업마당의"), at("기업마당의") + .6, 5), a, b),
    el("h3 abs", "검토할 만한\n공고를 **선별**", at("기업마당의") + .4, b, f"left:{L}px;top:790px"),
    chip("그중 하나의 기능", at("그중하나"), b, f"left:{L}px;top:1000px", "copper"),
    ph.html(a + .2, b, [("scroll", "phone-programs", a + .2, b, [(a, 0), (tsel, 0), (tsel + 1.4, 72)])]),
    ph.box(18, 520, 354, 220, tsel + 1.5, b),
    note(a + .3, b, 1262, L),
]))
# 16 (밝음) — 자동 판단 X → 상태 이해 → 다음 행동
a, b = T(15)
scene(a, b, "\n".join([
    strike("특정 자금을 자동으로 판단", a + .2, b, at("자동으로판단하는것이아니라") + 1.0, f"left:{L}px;top:340px;right:100px"),
    node("자기 상태를 이해", at("기업이자기상태"), b, f"left:{L}px;top:560px;width:{Wd}px", "teal", big=True),
    svg(line(516, 700, 516, 800, at("다음행동"), at("다음행동") + .6, 5), a, b),
    node("**다음 행동**을 선택", at("다음행동"), b, f"left:{L}px;top:820px;width:{Wd}px", "copper", hi=True, big=True),
]), light=True)
# 17 (어두움) — KPJK 주도 / 외부 전문 개발사
a, b = T(16)
t_dev = at("외부전문개발사")
scene(a, b, "\n".join([
    glass(f"left:{L}px;top:260px;width:{Wd}px;height:520px", a + .2, b, cls="hiedge", c="copper",
          inner='<div class="eyebrow" style="position:absolute;left:50px;top:40px">KPJK 주도</div>'),
    chip("현장의 문제 정의", a + .5, b, "left:122px;top:370px", "teal", big=True),
    chip("업무 규칙", at("업무규칙"), b, "left:122px;top:470px", "blue", big=True),
    chip("제품의 방향", at("제품의방향"), b, "left:122px;top:570px", "amber", big=True),
    chip("실제 사용 검증", at("실제사용검증"), b, "left:122px;top:670px", "green", big=True),
    glass(f"left:{L}px;top:830px;width:{Wd}px;height:250px", t_dev, b, c="violet",
          inner='<div class="eyebrow" style="position:absolute;left:50px;top:40px">협력</div><div class="h3" style="position:absolute;left:50px;top:100px">외부 전문 개발사 · 소프트웨어 구현</div>'),
]))
# 18 (밝음) — 6월부터 · 특허 출원
a, b = T(17)
scene(a, b, "\n".join([
    el("eyebrow abs", "6월부터", a + .1, b, f"left:{L}px;top:260px", "fade"),
    svg(line(101, 400, 101, 880, a + .3, at("이핵심구조"), 4, "var(--ink3)"), a, b),
    check("문제 정리", a + .3, b, f"left:{L}px;top:360px", c="teal"),
    check("업무 흐름 구조화", at("업무흐름을구조화"), b, f"left:{L}px;top:520px", c="blue"),
    check("시스템으로 구현", at("시스템으로구현"), b, f"left:{L}px;top:680px", c="amber"),
    check("핵심 구조 **특허 출원 완료**", at("특허출원"), b, f"left:{L}px;top:840px", c="copper"),
    status("출원번호 10-2026-0177079", at("특허출원") + .5, b, f"left:150px;top:960px"),
]), light=True)
# 19 (어두움) — 한 번에 큰 플랫폼 X → 먼저 기존 고객에게
a, b = T(18)
scene(a, b, "\n".join([
    strike("한 번에 큰 플랫폼", a + .2, b, at("방식으로접근하지"), f"left:{L}px;top:340px"),
    el("h2 abs", "먼저 기존 고객에게\n**실제로 적용**", at("먼저기존고객"), b, f"left:{L}px;top:540px;right:100px"),
    chip("사용 데이터 축적", at("사용데이터"), b, f"left:{L}px;top:830px", "teal", big=True),
    deco("disc", 780, 980, 240, "teal", a, b),
]))
# 20 (밝음) — 로드맵 3단계
a, b = T(19)
st = lambda n, t, sub, tin, top, c, dim=None, hi=False: glass(f"left:{L}px;top:{top}px;width:{Wd}px;height:230px", tin, b, cls="hiedge" if hi else "", c=c, dim=dim,
    inner=f'<div class="eyebrow" style="position:absolute;left:50px;top:36px">STEP {n}</div><div class="h3" style="position:absolute;left:50px;top:84px">{em(t)}</div><div class="p" style="position:absolute;left:50px;top:150px;font-size:30px">{esc(sub)}</div>')
scene(a, b, "\n".join([
    st(1, "실제 적용 · 사용 데이터", "기존 고객", a + .2, 280, "teal", dim=a + 1.0),
    st(2, "공통 업무 규칙 **표준화**", "고객 관리 흐름", a + .6, 570, "amber", dim=s("그 다음에는")),
    st(3, "**구독형 서비스**로 확장", "다른 경영 컨설팅 · 전문 서비스 회사", s("그 다음에는"), 860, "copper", hi=True),
]), light=True)
# 21 (어두움) — 데이터로 분석 → AI 판단 보조
a, b = T(20)
scene(a, b, "\n".join([
    el("eyebrow abs", "장기적으로", a + .1, b, f"left:{L}px;top:250px", "fade"),
    row("어떤 단계에서", "업무가 지연되는지", at("어떤단계에서"), b, f"left:{L}px;top:340px;width:{Wd}px", "teal", dim=at("어떤고객이")),
    row("어떤 고객이", "어떤 도움이 필요한지", at("어떤고객이"), b, f"left:{L}px;top:470px;width:{Wd}px", "blue", dim=at("어떤다음행동")),
    row("어떤 다음 행동이", "효과적이었는지", at("어떤다음행동"), b, f"left:{L}px;top:600px;width:{Wd}px", "amber", dim=at("AI가담당자")),
    svg(line(516, 730, 516, 830, at("더정교하게"), at("더정교하게") + .6, 5), a, b),
    glass(f"left:{L}px;top:860px;width:{Wd}px;height:230px", at("AI가담당자"), b, cls="hiedge", c="copper",
          inner='<div class="h3 dimtxt" style="position:absolute;left:60px;top:40px">AI가 담당자의</div><div class="h2" style="position:absolute;left:60px;top:110px"><span class="acc">판단을 보조</span></div>'),
]))
# 22 (밝음) — 단순 고객 관리 프로그램 X → 데이터·업무 규칙
a, b = T(21)
scene(a, b, "\n".join([
    strike("단순한 고객 관리 프로그램", at("단순한고객관리"), b, at("프로그램이아닙니다"), f"left:{L}px;top:330px;right:100px"),
    row("반복되는 문제", "→ **데이터 · 업무 규칙**", at("현장에서반복되는"), b, f"left:{L}px;top:500px;width:{Wd}px", "teal", big=True),
    row("고객 행동", "↔ 내부 업무 **연결**", at("고객의행동과"), b, f"left:{L}px;top:690px;width:{Wd}px", "blue", big=True),
    row("사람의 반복 업무", "**↓**", at("사람이하던"), b, f"left:{L}px;top:880px;width:{Wd}px", "copper", big=True),
]), light=True)
# 23 (어두움) — 성장과 매출에 집중
a, b = T(22)
scene(a, b, "\n".join([
    el("h3 abs", "더 많은 고객을\n안정적으로 관리하면서", a + .2, b, f"left:{L}px;top:330px"),
    el("h1 abs", "**성장과 매출**에\n더 집중", at("성장과매출"), b, f"left:{L}px;top:600px"),
    deco("ring", 760, 980, 240, "copper", a, b),
]))
# 24 (밝음, 마지막) — 현재 단계 + 로고
a, b = T(23)
scene(a, b, "\n".join([
    status("첫 번째 실사용 시스템 구현", a + .3, b, f"left:{L}px;top:330px"),
    check("실제 고객 적용과 검증", at("앞으로실제고객"), b, f"left:{L}px;top:480px", c="teal"),
    el("h1 abs", "**단계적으로**\n확장", at("단계적으로"), b, f"left:{L}px;top:620px"),
    deco("disc", 760, 560, 240, "copper", a, b),
    raw("logo abs", "KPJK", at("확장해나갈") + .4, b, f"left:{L}px;top:960px;font-size:38px;letter-spacing:.02em", "scale"),
    el("h3 abs", "KPJK AX", at("확장해나갈") + .6, b, "left:236px;top:998px", "fade"),
]), light=True)
X.write()
