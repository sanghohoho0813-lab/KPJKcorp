import { useEffect, useRef, type ReactNode } from "react";
import { useApp } from "../state";

/** 작은 화면 부품 — KPJK AX 디자인 토큰(색 · 둥글기 · 그림자)을 따른다. 장식보다 정보 전달 */
export function Badge({ tone = "neutral", children, title }: { tone?: "neutral" | "info" | "warning" | "error" | "success" | "accent" | "person" | "rule"; children: ReactNode; title?: string }) {
  return <span className={`badge badge-${tone}`} title={title}>{children}</span>;
}

export function Button({ kind = "secondary", children, onClick, disabled, title, type = "button", small, testId }: { kind?: "primary" | "secondary" | "ghost" | "danger"; children: ReactNode; onClick?: () => void; disabled?: boolean; title?: string; type?: "button" | "submit"; small?: boolean; testId?: string }) {
  return <button type={type} className={`btn btn-${kind}${small ? " btn-sm" : ""}`} onClick={onClick} disabled={disabled} title={title} data-testid={testId}>{children}</button>;
}

export function Card({ title, right, children, className, testId }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return (
    <section className={`card ${className ?? ""}`} data-testid={testId}>
      {(title || right) && <header className="card-head"><h3>{title}</h3>{right && <div className="card-right">{right}</div>}</header>}
      {children}
    </section>
  );
}

export function Note({ tone = "info", children, testId }: { tone?: "info" | "warning" | "error" | "success" | "neutral"; children: ReactNode; testId?: string }) {
  return <div className={`note note-${tone}`} data-testid={testId}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><strong>{title}</strong>{children && <div>{children}</div>}</div>;
}

export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", k);
    ref.current?.focus();
    return () => removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className={`modal${wide ? " modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <header className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="닫기">✕</button></header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** 확인자 이름 — 사람 판단 · 상태 변경마다 남는다 */
export function UserBox() {
  const { user, setUser } = useApp();
  return (
    <label className={`userbox${user.trim() ? "" : " userbox-empty"}`}>
      <span>확인자</span>
      <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="이름을 적어 주세요" data-testid="user-name" maxLength={20} />
    </label>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  return <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast toast-${t.tone}`}>{t.msg}</div>)}</div>;
}

export function Bar({ value, tone = "accent" }: { value: number; tone?: "accent" | "warning" | "error" | "success" }) {
  const w = Math.max(0, Math.min(1, value));
  return <span className="bar"><span className={`bar-fill bar-${tone}`} style={{ width: `${Math.round(w * 100)}%` }} /></span>;
}
