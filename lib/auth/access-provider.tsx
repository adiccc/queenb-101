"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Permission } from "./permissions";

type Access = {
  lock: () => Promise<boolean>;
  ensure: (permission: Permission, force?: boolean) => Promise<boolean>;
  fetch: (url: string, init: RequestInit, permission: Permission) => Promise<Response>;
};
const AccessContext = createContext<Access | null>(null);
export function useAccess() {
  const context = useContext(AccessContext);
  if (!context) throw new Error("Missing access provider");
  return context;
}
export function AccessProvider({ children }: { children: ReactNode }) {
  const granted = useRef<Permission[]>([]);
  const waiting = useRef<{ permission: Permission; resolve: (allowed: boolean) => void }[]>([]);
  const active = useRef(true);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const submission = useRef<AbortController | null>(null);

  const finish = useCallback((allowed: Permission[]) => {
    submission.current?.abort();
    setOpen(false); setCode(""); setError(""); setBusy(false);
    waiting.current.splice(0).forEach(item => item.resolve(allowed.includes(item.permission)));
  }, []);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; submission.current?.abort(); waiting.current.splice(0).forEach(item => item.resolve(false)); };
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    else if (!open && element?.open) element.close();
  }, [open]);

  const ensure = useCallback(async (permission: Permission, force = false) => {
    if (!active.current) return false;
    if (force) granted.current = [];
    if (granted.current.includes(permission)) return true;
    if (!force) {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (response.ok && active.current) granted.current = ((await response.json()) as { permissions?: Permission[] }).permissions ?? [];
        if (granted.current.includes(permission)) return true;
      } catch { /* The login dialog provides a visible, retryable network error. */ }
    }
    if (!active.current) return false;
    return new Promise<boolean>(resolve => {
      waiting.current.push({ permission, resolve });
      setOpen(true);
    });
  }, []);
  async function lock() {
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE" });
      if (!response.ok) return false;
      granted.current = []; finish([]); return true;
    } catch { return false; }
  }
  async function protectedFetch(url: string, init: RequestInit, permission: Permission) {
    if (!await ensure(permission)) throw new Error("הפעולה בוטלה. אפשר לנסות שוב כשתהיי מוכנה.");
    let response = await fetch(url, init);
    if (response.status === 401 && await ensure(permission, true)) response = await fetch(url, init);
    return response;
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const controller = new AbortController(); submission.current = controller;
    try {
      const response = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }), signal: controller.signal });
      const result = await response.json() as { permissions?: Permission[]; error?: string };
      if (controller.signal.aborted || !active.current) return;
      if (!response.ok) { setError(result.error || "לא הצלחנו לאמת את הקוד."); return; }
      granted.current = result.permissions ?? [];
      finish(granted.current);
    } catch { if (!controller.signal.aborted && active.current) setError("אין חיבור כרגע. בדקי את האינטרנט ונסי שוב."); }
    finally { if (!controller.signal.aborted && active.current) setBusy(false); }
  }
  return <AccessContext.Provider value={{ ensure, fetch: protectedFetch, lock }}>
    {children}
    <dialog ref={dialog} className="modal access-modal" aria-labelledby="access-title" onCancel={event => { event.preventDefault(); finish([]); }}>
      <button className="close" type="button" onClick={() => finish([])} aria-label="סגירה">×</button>
      <h2 id="access-title">רגע לפני שממשיכות 👑</h2>
      <p>הזיני את קוד הגישה שקיבלת מהמדריכה.</p>
      <form className="edit-form" onSubmit={submit}>
        <label htmlFor="access-code">קוד גישה<input id="access-code" type="password" autoComplete="current-password" autoFocus required maxLength={128} value={code} onChange={event => setCode(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "access-error" : undefined}/></label>
        {error && <p id="access-error" className="code-error" role="alert">{error}</p>}
        <div className="modal-actions"><button className="primary" disabled={busy || !code}>{busy ? "בודקות את הקוד..." : "אישור"}</button><button type="button" onClick={() => finish([])}>ביטול</button></div>
      </form>
    </dialog>
  </AccessContext.Provider>;
}
