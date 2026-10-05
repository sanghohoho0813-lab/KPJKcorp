import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lib import *
X = Ctx(os.path.dirname(os.path.abspath(__file__)), 211.86)
s, at, scene, T = X.s, X.at, X.scene, X.T
X.bounds(["첫 번째는", "그 기업과 관련된", "예전에는 카카오톡", "두 번째는", "그러면 고객은", "고객이 자료를 제출하면", "이렇게 하면 자료",
          "세 번째는", "대표님은 대시보드", "이렇게 사용하면", "네 번째는", "관심 있는 과제를", "즉, 고객이 행동", "다섯 번째는", "이 기능의 목적은",
          "이 시스템을 꾸준히", "결국 담당자는", "처음부터 모든 기능", "고객 등록, 자료 요청", "그 과정에서 불편한", "KPJK AX의 목적은", "그만큼 고객 관리와"])
L = 72; Wd = 888
def numhead(n, t, tin, tout, top=250, c="copper"):
    return numtag(f"0{n}", t, tin, tout, f"left:{L}px;top:{top}px", c)

# 1 (어두움) — 기능이 많은 프로그램 X → 운영 시스템
a, b = T(0)
scene(a, b, "\n".join([
    strike("기능이 많은 프로그램", a + .2, b, a + 2.6, f"left:{L}px;top:330px;right:100px"),
    el("h3 abs", "실제 업무를 놓치지 않고\n고객을 더 체계적으로", s("대표님과 담당자가"), b, f"left:{L}px;top:480px;right:100px"),
    el("h1 abs", "**운영 시스템**", s("관리하기 위한"), b, f"left:{L}px;top:680px"),
    chip("사용 방법은 어렵지 않습니다", s("사용 방법은"), b, f"left:{L}px;top:930px", "teal", big=True),
    deco("ring", 780, 1000, 220, "copper", a, b),
]))
# 2 (밝음) — 01 고객 기업 등록 · PC 등록 창
a, b = T(1)
br = Browser(L, 380, Wd, 860); sA = br.sc(720)
scene(a, b, "\n".join([
    numhead(1, "**고객 기업** 등록", a + .2, b),
    br.html(a + .3, b, [("pc-client-new", a + .3, b, pan(a + .5, b, sA, 250, 40, sA, 250, 300))]),
    note(a + .3, b),
]), light=True)
# 3 (어두움) — 기업 하나에 모인다
a, b = T(2)
cx, cy, R = 516, 760, 340
items = [("상담", at("상담자료일정"), "teal"), ("자료", at("자료일정"), "blue"), ("일정", at("일정프로젝트"), "amber"),
         ("프로젝트", at("프로젝트문의"), "green"), ("문의", at("문의내용이"), "violet")]
parts = [hub("기업\n하나", a + .3, b, cx, cy)]
for i, (t, tin, c) in enumerate(items):
    ang = -math.pi / 2 + i * 2 * math.pi / 5
    x, y = cx + R * math.cos(ang), cy + R * 1.05 * math.sin(ang)
    parts.append(svg(line(x, y, cx + 100 * math.cos(ang), cy + 100 * math.sin(ang), tin + .1, tin + .7, 4), a, b))
    parts.append(node(t, tin, b, f"left:{x-110:.0f}px;top:{y-46:.0f}px;width:220px", c, big=True))
parts.append(el("h3 abs", "**한 곳에** 모이기 시작", at("한곳에"), b, f"left:{L}px;top:1180px"))
scene(a, b, "\n".join(parts))
# 4 (밝음) — 따로 찾던 것 → 기업 하나만 열면 (PC 실제 화면 스크롤)
a, b = T(3)
br = Browser(L, 470, Wd, 780); s4 = br.sc(700)
t_open = at("기업하나만")
scene(a, b, "\n".join([
    el("h2 abs", "예전에는\n**따로** 찾아야 했다면", a + .2, t_open, f"left:{L}px;top:300px"),
    chip("카카오톡", a + .3, t_open, "left:110px;top:620px;transform:rotate(-5deg)", "amber", big=True, a="scale"),
    chip("엑셀", at("엑셀메모"), t_open, "left:560px;top:690px;transform:rotate(4deg)", "green", big=True, a="scale"),
    chip("메모", at("메모파일"), t_open, "left:220px;top:820px", "blue", big=True, a="scale"),
    chip("파일", at("파일을"), t_open, "left:640px;top:900px;transform:rotate(-3deg)", "violet", big=True, a="scale"),
    el("h2 abs", "**기업 하나만** 열면", t_open + .35, b, f"left:{L}px;top:300px"),
    br.html(t_open, b, [("pc-client-overview-long", t_open, b, pan(at("현재어떤업무가") , at("현재어떤업무가") + 2.6, s4, 300, 150, s4, 300, 2200))]),
    note(t_open, b),
]), light=True)
# 5 (밝음) — 02 자료 요청 · PC
a, b = T(4)
br = Browser(L, 380, Wd, 860); s5 = br.sc(600)
t_req = at("내부AX에서")
scene(a, b, "\n".join([
    numhead(2, "**자료 요청**", a + .2, b, c="blue"),
    br.html(a + .3, b, [("pc-client-work", a + .3, t_req + .3, still(a, 1.27, 290, 520)),
                        ("pc-docreq", t_req, b, pan(t_req, b, s5, 430, 130, s5, 430, 250))]),
    br.box(470, 360, 500, 60, s5, 430, 250, t_req + 1.6, b) if False else "",
    note(a + .3, b),
]), light=True)
# 6 (어두움) — 고객 포털에서 확인 · 휴대폰으로 올리기
a, b = T(5)
ph = Phone(470, 222, 490)
t_up = at("휴대폰으로바로")
scene(a, b, "\n".join([
    el("eyebrow abs", "CLIENT PORTAL", a + .1, b, f"left:{L}px;top:260px", "fade"),
    el("h2 abs", "고객은\n**휴대폰**에서", a + .3, b, f"left:{L}px;top:310px"),
    check("필요한 자료 확인", at("자신에게필요한"), b, f"left:{L}px;top:620px", c="teal", dim=t_up),
    check("사진 · 파일 올리기", t_up, b, f"left:{L}px;top:740px", c="copper"),
    ph.html(a + .2, b, [("scroll", "phone-docs-before", a + .2, t_up + .5, [(a, 0), (at("자신에게필요한"), 0), (at("자신에게필요한") + 1.4, 760)]),
                        ("img", "phone-upload", t_up, b)]),
    ph.box(18, 960 - 760, 354, 180, at("자신에게필요한") + 1.5, t_up),
    note(a + .3, b, 1262, L),
]))
# 7 (어두움) — PC + 휴대폰: 제출 → 검토 업무 자동 → 검토 → 고객 화면
a, b = T(6)
ph = Phone(L, 470, 380)
br = Browser(250, 230, 710, 620)
t_task, t_auto, t_proc, t_back = at("담당자에게검토업무"), at("자동으로생성"), at("담당자가검토를"), at("그결과가다시")
bx, by = ph.scr(302, 823)
scene(a, b, "\n".join([
    br.html(a + .1, b, [
        ("pc-tasks", a + .1, t_task + .4, still(a, 1.2, 300, 60)),
        ("pc-tasks-new", t_task, t_proc + .4, still(t_task, 1.2, 300, 380)),
        ("pc-review", t_proc, t_proc + 2.4, still(t_proc, 1.2, 560, 380)),
        ("pc-review-done", t_proc + 2.1, b, still(t_proc, 1.0, 259, 418)),
    ]),
    br.box(310, 470, 560, 85, 1.2, 300, 380, t_auto, t_proc),
    br.box(911, 775, 126, 53, 1.2, 560, 380, t_proc + .6, t_proc + 2.2),
    ph.html(a + .3, b, [("img", "phone-upload", a + .3, t_back + 1.2), ("img", "phone-docs-done-2", t_back + 1, b)]),
    ph.box(241, 800, 122, 46, a + .4, a + 2.2),
    mover(a + 1.6, t_task + .8, bx, by, 520, 420),
    mover(t_back + .1, t_back + 1.3, 700, 790, 230, 860),
    ph.box(20, 515, 350, 245, at("바로반영"), b),
    note(a + .3, b, 1262, 480),
]))
# 8 (밝음) — 반복 연락 ↓
a, b = T(7)
t_red = at("반복연락을")
scene(a, b, "\n".join([
    bubble("자료 보내셨나요?", a + .4, b, f"left:{L}px;top:330px", "teal", dim=t_red),
    bubble("어디까지 확인됐나요?", s("어디까지 확인"), b, "left:240px;top:470px", "amber", dim=t_red),
    strike("반복 연락", t_red, b, t_red + .6, f"left:{L}px;top:690px", cls="h2"),
    el("h1 abs acc", "줄인다", t_red + 1.0, b, f"left:{L}px;top:800px", "scale"),
]), light=True)
# 9 (밝음) — 03 진행 상황 관리 · PC 진행 업무
a, b = T(8)
br = Browser(L, 360, Wd, 560)
scene(a, b, "\n".join([
    numhead(3, "**진행 상황** 관리", a + .2, b, c="amber"),
    br.html(a + .3, b, [("pc-client-work", a + .3, b, pan(a + .5, b, 1.27, 290, 470, 1.27, 290, 640))]),
    check("현재 단계", at("현재단계가"), b, f"left:{L}px;top:980px", c="teal"),
    check("다음 할 일", at("다음에해야할일이"), b, "left:400px;top:980px", c="blue"),
    check("일정", at("일정이언제"), b, "left:740px;top:980px", c="amber"),
    note(a + .3, b, 1262, L),
]), light=True)
# 10 (어두움) — 대표: 대시보드 / 담당자: 업무함
a, b = T(9)
br = Browser(L, 360, Wd, 820)
t_staff = at("담당자는본인이")
scene(a, b, "\n".join([
    chip("대표 · 대시보드", a + .2, b, f"left:{L}px;top:250px", "copper", big=True, dim=t_staff),
    chip("담당자 · 업무함", t_staff, b, "left:500px;top:250px", "teal", big=True),
    br.html(a + .3, b, [("pc-dashboard-long", a + .3, t_staff + .4, pan(a + 1.0, at("고객과업무를"), 1.27, 300, 90, 1.27, 300, 470)),
                        ("pc-tasks", t_staff, b, pan(t_staff, b, 1.27, 300, 60, 1.27, 300, 200))]),
    note(a + .3, b),
]))
# 11 (밝음) — 기억 의존 ↓ · 빠뜨림 ↓
a, b = T(10)
card = lambda top, t1, t2, tin, c: glass(f"left:{L}px;top:{top}px;width:{Wd}px;height:250px", tin, b, c=c,
    inner=f'<div class="h3" style="position:absolute;left:50px;top:40px">{esc(t1)}</div><div class="h1 acc" style="position:absolute;left:50px;top:110px">{esc(t2)}</div>')
scene(a, b, "\n".join([
    card(360, "사람이 기억해서 관리하는 업무", "↓ 줄어듭니다", at("사람이기억해서"), "teal"),
    card(680, "빠뜨리는 업무", "↓ 줄일 수 있습니다", at("빠뜨리는업무"), "copper"),
]), light=True)
# 12 (밝음) — 04 고객 포털 · 휴대폰 스크롤
a, b = T(11)
ph = Phone(L, 222, 490)
t1, t2, t3, t4 = at("자기회사의현재"), at("지금해야할일진행"), at("진행중인성장과제"), at("다음으로검토할")
scene(a, b, "\n".join([
    ph.html(a + .2, b, [("scroll", "phone-portal-home", a + .2, b, [(a, 0), (t1 + .2, 0), (t1 + 1.4, 990), (t2 - .1, 990), (t2 + 1.0, 3310), (t3 - .1, 3310), (t3 + 1.0, 4420), (t4 - .1, 4420), (t4 + 1.0, 5390)])]),
    numtag("04", "**고객 포털**", a + .2, b, "left:600px;top:250px", "violet"),
    el("h3 abs dimtxt", "서류만 올리는\n화면이 아닙니다", s("고객 포털은 단순히"), b, "left:610px;top:400px"),
    check("현재 상태", t1, b, "left:610px;top:600px", c="teal", dim=t2),
    check("지금 할 일", t2, b, "left:610px;top:700px", c="blue", dim=t3),
    check("성장 과제", t3, b, "left:610px;top:800px", c="amber", dim=t4),
    check("다음 검토", t4, b, "left:610px;top:900px", c="green"),
    note(a + .3, b, 1180, 610, "화면 속 기업·인물은\n예시 데이터입니다"),
]), light=True)
# 13 (어두움) — 상담 요청 → 내부 업무 (PC + 휴대폰)
a, b = T(12)
ph = Phone(L, 470, 380)
br = Browser(250, 230, 710, 620)
t_req, t_int = at("상담을요청하면"), at("내부업무로")
bx, by = ph.scr(315, 846)
scene(a, b, "\n".join([
    br.html(a + .1, b, [("pc-tasks", a + .1, t_int + .4, still(a, 1.2, 300, 60)), ("pc-tasks-new", t_int, b, still(t_int, 1.2, 300, 60))]),
    br.box(310, 150, 560, 70, 1.2, 300, 60, t_int + .3, b),
    ph.html(a + .3, b, [("img", "phone-services-card", a + .3, t_req + .4), ("img", "phone-request", t_req, t_req + 1.6), ("img", "phone-request-done", t_req + 1.3, b)]),
    ph.box(60, 412, 115, 40, a + .6, t_req),
    mover(t_req + 1.4, t_int + .2, bx, by, 560, 310),
    note(a + .3, b, 1262, 480),
]))
# 14 (어두움) — 고객 행동 → 내부 업무 → 담당자 처리 → 고객에게 결과 (순환)
a, b = T(13)
cx, cy, rx, ry = 516, 760, 300, 360
nodes = [("고객 행동", at("고객이행동하면"), "teal"), ("내부 업무", at("그행동이내부"), "blue"), ("담당자 처리", at("담당자가처리하면"), "amber"), ("고객에게 결과", at("다시고객에게"), "green")]
parts = [svg(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="rgba(232,184,154,.28)" stroke-width="2"/>', a + .2, b), orbit(a, cx, cy, rx, ry, 4, a + .2, b)]
for i, (t, tin, c) in enumerate(nodes):
    ang = -math.pi / 2 + i * math.pi / 2
    x, y = cx + rx * math.cos(ang), cy + ry * math.sin(ang)
    parts.append(node(t, tin, b, f"left:{x-140:.0f}px;top:{y-50:.0f}px;width:280px", c, big=True))
parts.append(hub("구조", at("돌아가는구조"), b, cx, cy))
scene(a, b, "\n".join(parts))
# 15 (밝음) — 05 정부 지원 사업 · 휴대폰
a, b = T(14)
ph = Phone(470, 222, 490)
t_int2 = at("관심을표시")
scene(a, b, "\n".join([
    numtag("05", "**지원 사업**", a + .2, b, f"left:{L}px;top:250px", "green"),
    chip("업종", at("업종"), b, f"left:{L}px;top:400px", "teal", big=True),
    chip("지역", at("지역"), b, f"left:{L}px;top:500px", "blue", big=True),
    chip("업력", at("업력같은"), b, f"left:{L}px;top:600px", "amber", big=True),
    el("h3 abs", "검토할 만한\n공고", at("검토할만한"), b, f"left:{L}px;top:730px"),
    chip("관심 → 담당자 상담", t_int2, b, f"left:{L}px;top:900px", "copper"),
    ph.html(a + .2, b, [("scroll", "phone-programs", a + .2, b, [(a, 0), (at("검토할만한"), 0), (at("검토할만한") + 1.4, 72)])]),
    ph.box(18, 520, 354, 220, at("검토할만한") + 1.5, t_int2),
    ph.box(18, 700 - 72 + 10, 200, 40, t_int2 + .3, b),
    note(a + .3, b, 1262, L),
]), light=True)
# 16 (어두움) — 무조건 추천 X → 한 번 더 발견
a, b = T(15)
scene(a, b, "\n".join([
    strike("무조건 지원 사업 추천", at("무조건지원"), b, at("추천하는것이아니라") + .5, f"left:{L}px;top:360px"),
    el("h3 abs", "고객이 놓칠 수 있는 기회를", at("고객이놓칠"), b, f"left:{L}px;top:540px"),
    el("h1 abs", "**한 번 더**\n발견", at("한번더발견"), b, f"left:{L}px;top:640px"),
    deco("disc", 780, 980, 240, "green", a, b),
]))
# 17 (밝음) — 기대할 수 있는 변화 1~3
a, b = T(16)
scene(a, b, "\n".join([
    el("eyebrow abs", "꾸준히 사용하면", a + .2, b, f"left:{L}px;top:250px", "fade"),
    numtag(1, "찾고 확인하는 **시간 ↓**", at("업무를찾고"), b, f"left:{L}px;top:340px;width:{Wd}px", "teal", dim=at("그다음은자료")),
    numtag(2, "누락 같은 **실수 ↓**", at("그다음은자료"), b, f"left:{L}px;top:500px;width:{Wd}px", "blue", dim=at("그리고고객입장")),
    chip("자료 누락", at("자료누락후속"), b, "left:150px;top:630px", "blue", dim=at("그리고고객입장")),
    chip("후속 연락 누락", at("후속연락누락"), b, "left:370px;top:630px", "blue", dim=at("그리고고객입장")),
    chip("일정 누락", at("일정누락"), b, "left:680px;top:630px", "blue", dim=at("그리고고객입장")),
    numtag(3, "고객은 **물어보지 않아도** 됩니다", at("그리고고객입장"), b, f"left:{L}px;top:780px;width:{Wd}px", "copper"),
    chip("전화 · 카카오톡 문의", at("전화나카카오톡"), b, "left:150px;top:910px", "copper"),
]), light=True)
# 18 (어두움) — 반복 확인 → 매출과 직접 연결되는 업무
a, b = T(17)
scene(a, b, "\n".join([
    strike("반복 확인 업무", a + .2, b, a + 2.0, f"left:{L}px;top:280px"),
    chip("고객 상담", at("고객상담문제"), b, f"left:{L}px;top:430px", "teal", big=True),
    chip("문제 해결", at("문제해결추가"), b, "left:370px;top:430px", "blue", big=True),
    chip("추가 제안", at("추가제안"), b, f"left:{L}px;top:540px", "amber", big=True),
    chip("새로운 계약", at("새로운계약"), b, "left:370px;top:540px", "green", big=True),
    svg(line(516, 660, 516, 760, at("매출과직접"), at("매출과직접") + .6, 5), a, b),
    glass(f"left:{L}px;top:790px;width:{Wd}px;height:250px", at("매출과직접"), b, cls="hiedge", c="copper",
          inner='<div class="h2" style="position:absolute;left:60px;top:40px"><span class="acc">매출과 직접</span> 연결되는</div><div class="h3 dimtxt" style="position:absolute;left:60px;top:145px">업무에 더 많은 시간</div>'),
]))
# 19 (밝음) — 완벽하게 X → 한두 개 실제 고객 기업부터
a, b = T(18)
scene(a, b, "\n".join([
    strike("모든 기능을 완벽하게", a + .2, b, at("사용할필요는") + .4, f"left:{L}px;top:360px"),
    el("h2 abs", "한두 개\n**실제 고객 기업**부터", at("우선한두개"), b, f"left:{L}px;top:540px"),
    deco("sq", 780, 960, 220, "teal", a, b),
]), light=True)
# 20 (어두움) — 이 한 사이클 (6단계 순환)
a, b = T(19)
cx, cy, rx, ry = 516, 740, 310, 400
six = [("고객 등록", at("고객등록자료"), "teal"), ("자료 요청", at("자료요청고객"), "blue"), ("고객 제출", at("고객제출"), "amber"),
       ("내부 검토", at("내부검토"), "green"), ("상태 변경", at("상태변경"), "violet"), ("고객 화면 반영", at("고객화면반영"), "rose")]
parts = [svg(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="rgba(232,184,154,.28)" stroke-width="2"/>', a + .2, b), orbit(a, cx, cy, rx, ry, 4, a + .2, b)]
for i, (t, tin, c) in enumerate(six):
    ang = -math.pi / 2 + i * 2 * math.pi / 6
    x, y = cx + rx * math.cos(ang), cy + ry * math.sin(ang)
    parts.append(node(t, tin, b, f"left:{x-125:.0f}px;top:{y-46:.0f}px;width:250px", c))
parts.append(hub("이 한\n사이클", at("이한사이클"), b, cx, cy))
scene(a, b, "\n".join(parts))
# 21 (밝음) — 현장 피드백 → 계속 고도화
a, b = T(20)
scene(a, b, "\n".join([
    row("불편한 점", "", a + .3, b, f"left:{L}px;top:340px;width:{Wd}px", "amber", big=True),
    row("실제 업무 순서와 다른 부분", "", at("실제업무순서와"), b, f"left:{L}px;top:500px;width:{Wd}px", "rose", big=True),
    svg(line(516, 640, 516, 760, at("나오면그내용"), at("나오면그내용") + .6, 5), a, b),
    el("h1 abs", "**계속 고도화**", at("계속고도화"), b, f"left:{L}px;top:800px", "scale"),
]), light=True)
# 22 (어두움) — 목적: 프로그램 사용 X → 더 적은 반복 업무 · 더 많은 고객
a, b = T(21)
scene(a, b, "\n".join([
    strike("프로그램을 사용하는 것 자체", at("프로그램을사용하는"), b, at("자체가아닙니다"), f"left:{L}px;top:330px;right:80px"),
    row("반복 업무", "더 **적게**", at("대표님과직원이"), b, f"left:{L}px;top:520px;width:{Wd}px", "teal", big=True),
    row("고객 관리", "더 많이 · **안정적으로**", at("더많은고객을"), b, f"left:{L}px;top:690px;width:{Wd}px", "blue", big=True),
]))
# 23 (밝음, 마지막) — 매출 성장 + 로고
a, b = T(22)
scene(a, b, "\n".join([
    el("h3 abs", "고객 관리와", a + .2, b, f"left:{L}px;top:330px"),
    el("h1 abs", "**매출 성장**에\n집중하는 구조", at("매출성장"), b, f"left:{L}px;top:420px"),
    deco("disc", 760, 560, 240, "copper", a, b),
    raw("logo abs", "KPJK", at("구조를만드는") + .4, b, f"left:{L}px;top:900px;font-size:38px;letter-spacing:.02em", "scale"),
    el("h3 abs", "KPJK AX", at("구조를만드는") + .6, b, "left:236px;top:938px", "fade"),
]), light=True)
X.write()
