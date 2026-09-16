"use client";

import { useState } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import { useStore } from "@/lib/store";
import { hashPassword } from "@/lib/auth";
import { createServerUser, sendPasswordReset, setServerUserActive, updateServerUser } from "@/lib/server/auth";
import type { Role, User } from "@/lib/types";
import { Confirm, Modal } from "@/components/ui/overlay";
import { Badge, Button, Field, Input, Select } from "@/components/ui/ui";

const ROLE_LABEL: Record<Role, string> = { admin: "대표 · 관리자", consultant: "컨설턴트", client: "기업고객" };

function pwIssue(pw: string) {
  if (pw.length < 8) return "8자 이상이어야 합니다.";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "영문과 숫자를 함께 사용해 주세요.";
  return null;
}

/* ---------------- 계정 생성 · 수정 ---------------- */

export function UserModal(props: { open: boolean; userId?: string | null; presetCompanyId?: string; onClose: () => void; onCreated?: (id: string) => void }) {
  if (!props.open) return null;
  return <UserModalInner key={props.userId ?? `new:${props.presetCompanyId ?? ""}`} {...props} />;
}

function UserModalInner({ open, userId, presetCompanyId, onClose, onCreated }: { open: boolean; userId?: string | null; presetCompanyId?: string; onClose: () => void; onCreated?: (id: string) => void }) {
  const st = useStore();
  const create = useStore((s) => s.createUser);
  const update = useStore((s) => s.updateUser);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const editing = st.users.find((u) => u.id === userId);
  // 서버 모드에서는 비밀번호를 Supabase Auth 가 갖는다. 앱은 해시조차 만들지 않는다.
  const onServer = st.serverMode;

  const [name, setName] = useState(editing?.name ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [role, setRole] = useState<Role>(editing?.role ?? (presetCompanyId ? "client" : "consultant"));
  const [title, setTitle] = useState(editing?.title ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [companyId, setCompanyId] = useState(editing?.companyId ?? presetCompanyId ?? st.companies[0]?.id ?? "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const e: Record<string, string | undefined> = {};
    if (!name.trim()) e.name = "이름은 필수입니다.";
    if (!email.trim()) e.email = "아이디(이메일)는 필수입니다.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "이메일 형식이 아닙니다.";
    else if (st.users.some((u) => u.id !== userId && u.email.toLowerCase() === email.trim().toLowerCase())) e.email = "이미 사용 중인 아이디입니다.";
    if (!title.trim()) e.title = "직책은 필수입니다.";
    if (role === "client" && !companyId) e.companyId = "소속 기업을 선택해 주세요.";
    if (!editing) {
      const issue = pwIssue(pw);
      if (issue) e.pw = issue;
      else if (pw !== pw2) e.pw2 = "비밀번호가 서로 다릅니다.";
    }
    setErr(e);
    if (Object.keys(e).length) { toast("입력값을 확인해 주세요.", "error"); return; }

    setBusy(true);
    try {
      const patch = {
        name: name.trim(), email: email.trim(), title: title.trim(),
        phone: phone.trim() || undefined,
        companyId: role === "client" ? companyId : undefined,
      };

      if (editing) {
        if (onServer) {
          const r = await updateServerUser(editing.id, patch);
          if (!r.ok) { toast(r.reason ?? "저장하지 못했습니다.", "error"); setBusy(false); return; }
        }
        update(editing.id, patch, me);
        toast("계정 정보를 수정했습니다.");
        onClose();
        return;
      }

      if (onServer) {
        // 세션을 저장하지 않는 별도 연결로 가입시킨다 — 대표가 로그아웃되지 않는다.
        const r = await createServerUser({ ...patch, role, password: pw });
        if (!r.ok) { toast(r.reason, "error"); setBusy(false); return; }
        // 서버가 이미 프로필을 넣었다. 화면 목록에만 반영한다.
        useStore.setState({ users: [...st.users, r.user] });
        useStore.getState().logActivity({
          type: "user_created", companyId: r.user.companyId, actorId: me,
          actorRole: st.session?.role ?? "admin",
          text: `계정 생성: ${r.user.name} (${r.user.email}) · ${ROLE_LABEL[r.user.role]}`,
        });
        toast(`${r.user.name} 계정을 만들었습니다. 정한 비밀번호를 본인에게 전달해 주세요.`);
        onClose();
        onCreated?.(r.user.id);
        return;
      }

      const hash = await hashPassword(email.trim(), pw);
      const id = create({ ...patch, role, passwordHash: hash }, me);
      if (!id) { toast("계정을 만들 권한이 없거나 아이디가 중복됩니다.", "error"); setBusy(false); return; }
      toast(`${name.trim()} 계정을 만들었습니다. 첫 로그인 후 비밀번호를 바꾸도록 안내해 주세요.`);
      onClose();
      onCreated?.(id);
    } catch {
      toast("처리 중 문제가 발생했습니다.", "error");
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={<span className="flex items-center gap-2"><UserPlus size={18} /> {editing ? "계정 수정" : "계정 만들기"}</span>}
      footer={<><Button variant="ghost" onClick={onClose}>취소</Button><Button variant="accent" onClick={submit} disabled={busy}>{busy ? "처리 중…" : editing ? "저장" : "만들기"}</Button></>}
    >
      <div className="space-y-3">
        <Field label="역할" hint={editing ? "역할은 만든 뒤 바꿀 수 없습니다. 바꾸려면 계정을 새로 만드세요." : undefined}>
          {editing ? (
            <div className="flex h-11 items-center rounded-[10px] bg-surface-2 px-3.5 text-[0.95rem] font-semibold">{ROLE_LABEL[editing.role]}</div>
          ) : (
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="consultant">컨설턴트</option>
              <option value="admin">대표 · 관리자</option>
              <option value="client">기업고객 (Portal)</option>
            </Select>
          )}
        </Field>
        {(role === "client" || editing?.role === "client") && (
          <Field label="소속 기업 *" hint={err.companyId}>
            <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {st.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="이름 *" hint={err.name}><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label="직책 *" hint={err.title}><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 수석 컨설턴트" /></Field>
        </div>
        <Field label="아이디 (이메일) *" hint={err.email}><Input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="name@kpjk.co.kr" /></Field>
        <Field label="연락처"><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="010-0000-0000" /></Field>
        {!editing && (
          <>
            <Field label="초기 비밀번호 *" hint={err.pw ?? "영문+숫자 8자 이상. 본인에게 전달한 뒤 바꾸도록 안내해 주세요."}>
              <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="비밀번호 확인 *" hint={err.pw2}>
              <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- 비밀번호 재설정 ---------------- */

export function ResetPasswordModal({ open, user, onClose }: { open: boolean; user: User | null; onClose: () => void }) {
  const reset = useStore((s) => s.resetUserPassword);
  const log = useStore((s) => s.logActivity);
  const role = useStore((s) => s.session?.role);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "u_admin";
  // 서버 모드에서는 대표도 남의 비밀번호를 볼 수도, 정할 수도 없다.
  // 본인에게 재설정 링크를 보내는 것이 우리가 할 수 있는 전부이고, 그게 맞다.
  const onServer = useStore((s) => s.serverMode);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const submit = async () => {
    if (onServer) {
      setBusy(true);
      const r = await sendPasswordReset(user.email);
      if (!r.ok) { setErr(r.reason ?? "메일을 보내지 못했습니다."); setBusy(false); return; }
      log({
        type: "password_reset", companyId: user.companyId, actorId: me,
        actorRole: role ?? "admin", text: `비밀번호 재설정 메일 발송: ${user.name} (${user.email})`,
      });
      toast(`${user.email} 으로 재설정 메일을 보냈습니다.`);
      setBusy(false);
      onClose();
      return;
    }
    const issue = pwIssue(pw);
    if (issue) { setErr(issue); return; }
    if (pw !== pw2) { setErr("비밀번호가 서로 다릅니다."); return; }
    setBusy(true);
    try {
      reset(user.id, await hashPassword(user.email, pw), me);
      toast(`${user.name} 계정의 비밀번호를 재설정했습니다.`);
      setPw(""); setPw2(""); setErr(null); setBusy(false);
      onClose();
    } catch {
      setErr("처리 중 문제가 발생했습니다.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={<span className="flex items-center gap-2"><KeyRound size={18} /> 비밀번호 재설정</span>}
      footer={<><Button variant="ghost" onClick={onClose}>취소</Button><Button variant="accent" onClick={submit} disabled={busy}>{busy ? "처리 중…" : onServer ? "재설정 메일 보내기" : "재설정"}</Button></>}
    >
      <div className="mb-3 rounded-xl bg-surface-2 px-4 py-2.5 text-[0.88rem]">
        <b>{user.name}</b> {user.title} · {user.email}
      </div>
      {onServer ? (
        <>
          <p className="mb-3 text-[0.82rem] leading-relaxed text-ink-2">
            본인 이메일로 재설정 링크를 보냅니다. 대표 계정도 남의 비밀번호를 보거나 직접 정할 수 없습니다 —
            비밀번호는 서버가 보관하고, 본인만 바꿉니다. 보낸 사실은 기록에 남습니다.
          </p>
          {err && <p role="alert" className="rounded-lg bg-error-bg px-3 py-2 text-[0.82rem] font-semibold text-error">{err}</p>}
        </>
      ) : (
        <>
          <p className="mb-3 text-[0.82rem] leading-relaxed text-ink-3">
            새 비밀번호를 직접 정해 본인에게 전달합니다. 이 화면에는 기존 비밀번호가 표시되지 않으며,
            재설정 사실만 기록에 남습니다(비밀번호 값은 기록하지 않습니다).
          </p>
          <div className="space-y-3">
            <Field label="새 비밀번호" hint={err ?? "영문+숫자 8자 이상"}><Input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(null); }} autoComplete="new-password" autoFocus /></Field>
            <Field label="새 비밀번호 확인"><Input type="password" value={pw2} onChange={(e) => { setPw2(e.target.value); setErr(null); }} autoComplete="new-password" /></Field>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---------------- 사용자 목록 (설정 화면) ---------------- */

export function UserAdmin() {
  const st = useStore();
  const setActiveLocal = useStore((s) => s.setUserActive);
  const toast = useStore((s) => s.toast);
  const onServer = st.serverMode;
  // 계정 목록(profiles)은 자동 동기화 대상이 아니다 — 로그인 주체라 서버가 직접 관리한다.
  const setActive = async (id: string, active: boolean, by: string) => {
    if (onServer) {
      const r = await setServerUserActive(id, active);
      if (!r.ok) { toast(r.reason ?? "변경하지 못했습니다.", "error"); return; }
    }
    setActiveLocal(id, active, by);
  };
  const me = st.session?.userId ?? "u_admin";
  const [modalFor, setModalFor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pwFor, setPwFor] = useState<User | null>(null);
  const [confirmOff, setConfirmOff] = useState<User | null>(null);

  const activeAdmins = st.users.filter((u) => u.role === "admin" && u.active !== false).length;
  const order: Role[] = ["admin", "consultant", "client"];
  const rows = [...st.users].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.name.localeCompare(b.name));

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2 text-[0.85rem] font-semibold text-ink-2">
          계정 {st.users.length}개 · 사용 중 {st.users.filter((u) => u.active !== false).length}개
          {onServer && <Badge tone="success" dot>서버가 관리</Badge>}
        </span>
        <Button size="sm" variant="accent" icon={<UserPlus size={15} />} onClick={() => setCreating(true)}>계정 만들기</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="tbl tbl-compact">
          <thead><tr><th>이름</th><th>아이디</th><th>역할</th><th>상태</th><th className="text-right">관리</th></tr></thead>
          <tbody>
            {rows.map((u) => {
              const company = st.companies.find((c) => c.id === u.companyId);
              const off = u.active === false;
              const lastAdmin = u.role === "admin" && !off && activeAdmins <= 1;
              return (
                <tr key={u.id} className={off ? "opacity-55" : undefined}>
                  <td>
                    <div className="font-semibold">{u.name} <span className="font-normal text-ink-3">{u.title}</span></div>
                    {company && <div className="text-[0.78rem] text-ink-3">{company.name}</div>}
                  </td>
                  <td className="text-ink-2">{u.email}</td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td>{off ? <span className="font-semibold text-error">중지</span> : <span className="font-semibold text-success">사용</span>}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setModalFor(u.id)}>수정</Button>
                      <Button size="sm" variant="ghost" onClick={() => setPwFor(u)}>비밀번호</Button>
                      {off ? (
                        <Button size="sm" variant="outline" onClick={() => { void setActive(u.id, true, me).then(() => toast(`${u.name} 계정을 다시 사용합니다.`)); }}>재개</Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={u.id === me || lastAdmin}
                          title={u.id === me ? "본인 계정은 중지할 수 없습니다" : lastAdmin ? "마지막 대표 계정은 중지할 수 없습니다" : undefined}
                          onClick={() => setConfirmOff(u)}
                        >
                          중지
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-3">
        계정은 삭제하지 않고 <b className="text-ink-2">사용 중지</b>합니다. 지우면 그 사람이 남긴 상담·검토·승인 기록의 작성자를 알 수 없게 됩니다.
        중지된 계정은 로그인만 막히고 과거 기록은 그대로 남습니다.
      </p>

      <UserModal open={creating} onClose={() => setCreating(false)} />
      <UserModal open={!!modalFor} userId={modalFor} onClose={() => setModalFor(null)} />
      <ResetPasswordModal open={!!pwFor} user={pwFor} onClose={() => setPwFor(null)} />
      <Confirm
        open={!!confirmOff}
        onClose={() => setConfirmOff(null)}
        onConfirm={() => {
          if (!confirmOff) return;
          void setActive(confirmOff.id, false, me);
          toast(`${confirmOff.name} 계정을 사용 중지했습니다.`);
          setConfirmOff(null);
        }}
        title={`${confirmOff?.name ?? ""} 계정을 사용 중지할까요?`}
        desc="로그인만 막힙니다. 이 사람이 남긴 기록과 담당 배정은 그대로 유지되며, 언제든 다시 사용할 수 있습니다."
        confirmText="사용 중지"
        danger
      />
    </>
  );
}
