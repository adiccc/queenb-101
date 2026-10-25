"use client";
import { useEffect, useRef, useState } from "react";
import { isSnapshot, MAX_SNAPSHOT_BYTES, type Snapshot } from "./snapshot";
import { mergeSnapshots } from "./merge";
import { groupDraft } from "./drafts";

export function useCloudData<T>(options: {
  initial: T;
  groupId: string;
  empty: () => Promise<T>;
  authorize: (force?: boolean) => Promise<boolean>;
  restore: (snapshot: Snapshot) => Promise<T>;
  snapshot: (data: T) => Promise<Snapshot>;
  prepare: (snapshot: Snapshot) => Promise<Snapshot>;
}) {
  const [data, setView] = useState(options.initial);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("טוענות מהענן...");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const state = useRef({ data: options.initial, etag: "", revision: 0, saved: 0, loaded: false, conflict: false, base: null as Snapshot | null });
  const flight = useRef<Promise<boolean> | null>(null);
  const initialOptions = useRef(options);
  const mounted = useRef(true);
  const endpoint = `/api/groups/${options.groupId}/data`;
  const version = (response: Response) => response.headers.get("X-QueenB-Version") || response.headers.get("ETag") || "";

  function save(): Promise<boolean> {
    if (flight.current) return flight.current;
    const s = state.current;
    if (!mounted.current || !s.loaded || s.conflict) return Promise.resolve(false);
    if (s.saved === s.revision) return Promise.resolve(true);
    const task = persist(); flight.current = task;
    void task.finally(() => { if (flight.current === task) flight.current = null; });
    return task;
  }
  async function persist(): Promise<boolean> {
    const s = state.current; const adapter = initialOptions.current;
    setError(""); setStatus("שומרות בענן...");
    let draftWarning = "";
    try {
      let attempts = 0;
      while (mounted.current && s.saved !== s.revision) {
        const revision = s.revision;
        const local = await adapter.snapshot(s.data);
        if (!s.base) throw new Error("חסרה גרסת בסיס לשמירה.");
        try { await groupDraft(options.groupId, "put", { base: s.base, local, etag: s.etag }); }
        catch { draftWarning = " לא הצלחנו לשמור טיוטה במכשיר; השאירי את העמוד פתוח עד לשמירה בענן."; }
        const snapshot = await adapter.prepare(local);
        // Persist canonical image references before PUT so a lost response can be retried idempotently.
        try { await groupDraft(options.groupId, "put", { base: s.base, local: snapshot, etag: s.etag }); } catch { /* The pre-upload draft is retained where available. */ }
        const body = JSON.stringify(snapshot);
        if (new Blob([body]).size > MAX_SNAPSHOT_BYTES) throw new Error("המידע גדול מדי לשמירה (מעל 20MB).");
        if (!mounted.current) return false;
        const init = { method: "PUT", headers: { "Content-Type": "application/json", ...(s.etag ? { "If-Match": s.etag } : { "If-None-Match": "*" }) }, body };
        let response = await fetch(endpoint, init);
        if (response.status === 401 && await adapter.authorize(true) && mounted.current) response = await fetch(endpoint, init);
        if (!mounted.current) return false;
        if (response.status === 409) {
          if (++attempts > 8) throw new Error("הקבוצה מתעדכנת כרגע בכמה מחשבים. נסי לשמור שוב בעוד רגע.");
          const latest = await fetch(endpoint, { cache: "no-store" });
          if (!latest.ok) throw new Error("טעינת עדכוני הקבוצה נכשלה. נסי לשמור שוב.");
          const remote: unknown = await latest.json();
          if (!isSnapshot(remote) || !version(latest)) throw new Error("לא התקבל מידע תקין מהענן.");
          // Re-snapshot if edits arrived during the request. Never merge a stale local view.
          const currentRevision = s.revision;
          const current = await adapter.snapshot(s.data);
          if (currentRevision !== s.revision) continue;
          let merged: Snapshot;
          try { merged = mergeSnapshots(s.base, current, remote); }
          catch (err) { s.conflict = true; setConflict(true); throw err; }
          const restored = await adapter.restore(merged);
          if (currentRevision !== s.revision) continue;
          s.data = restored; s.base = remote; s.etag = version(latest); setView(restored);
          continue;
        }
        if (!response.ok) {
          const result = await response.json() as { error?: string };
          throw new Error(result.error || "השמירה בענן נכשלה.");
        }
        if (!version(response)) throw new Error("לא התקבל אישור גרסה מהענן. נסי לשמור שוב.");
        s.etag = version(response); s.base = snapshot; s.saved = revision;
      }
      if (!mounted.current) return false;
      // Remove the recovery copy only after the server acknowledged every pending edit.
      try { await groupDraft(options.groupId, "delete"); } catch { /* Idempotent merge makes a leftover draft safe. */ }
      if (s.saved !== s.revision) return persist();
      setStatus("נשמר בענן ✓"); return true;
    } catch (err) {
      setError((err instanceof Error ? err.message : "אין חיבור לענן. השינויים עדיין לא נשמרו.") + draftWarning);
      setStatus("יש שינויים שלא נשמרו בענן"); return false;
    }
  }

  useEffect(() => {
    let active = true; mounted.current = true;
    const s = state.current, adapter = initialOptions.current;
    async function load() {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) throw new Error("לא הצלחנו לטעון את המידע מהענן. בדקי את החיבור ונסי שוב.");
        const value = await response.json();
        if (!active) return;
        const empty = !!value && typeof value === "object" && "empty" in value && value.empty === true;
        let loaded = empty ? await adapter.empty() : isSnapshot(value) ? await adapter.restore(value) : (() => { throw new Error("קובץ המידע בענן אינו תקין."); })();
        const remote = empty ? await adapter.snapshot(loaded) : value as Snapshot;
        if (!empty && !version(response)) throw new Error("לא התקבלה גרסת המידע מהענן.");
        s.etag = version(response); s.base = remote;
        let recovered = false;
        try {
          const draft = await groupDraft(options.groupId, "get");
          if (draft && isSnapshot(draft.base) && isSnapshot(draft.local)) {
            try {
              loaded = await adapter.restore(mergeSnapshots(draft.base, draft.local, remote));
            } catch {
              // Keep the draft in IndexedDB; never replace either side of a genuine conflict.
              loaded = await adapter.restore(draft.local); s.base = draft.base; s.etag = draft.etag;
              s.conflict = true; setConflict(true);
              setError("שוחזרה טיוטה מהמכשיר, אך אותו פריט השתנה גם בענן. הטיוטה נשמרת במכשיר; נדרש פתרון ההתנגשות לפני שמירה.");
            }
            s.revision++; recovered = true;
          }
        } catch { /* Cloud data is still usable when browser storage is unavailable. */ }
        if (!active) return;
        s.data = loaded; s.loaded = true; setView(loaded); setReady(true);
        setStatus(recovered ? "שוחזרו שינויים מהמכשיר — לחצי לשמירה בענן" : "המידע מעודכן מהענן ✓");
        if (recovered && !s.conflict) setError("נמצאה טיוטה שלא אושרה בענן. אפשר לנסות לשמור אותה שוב.");
      } catch (err) { if (active) setError(err instanceof Error ? err.message : "טעינת המידע נכשלה."); }
    }
    void load();
    const beforeUnload = (event: BeforeUnloadEvent) => { if (s.saved !== s.revision) { event.preventDefault(); event.returnValue = ""; } };
    const online = () => { if (s.loaded) void save(); else location.reload(); };
    addEventListener("beforeunload", beforeUnload); addEventListener("online", online);
    return () => { active = false; mounted.current = false; removeEventListener("beforeunload", beforeUnload); removeEventListener("online", online); };
    // Adapters are fixed for this mounted group.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(value: T): Promise<boolean> {
    if (!mounted.current) return Promise.resolve(false);
    const s = state.current; s.data = value; s.revision++; setView(value);
    return save();
  }
  function mediaChanged() { return update(state.current.data); }
  async function exportDraft() {
    const local = await initialOptions.current.snapshot(state.current.data);
    const url = URL.createObjectURL(new Blob([JSON.stringify(local)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `queenb-${options.groupId}-draft.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function discardDraft() {
    if (!confirm("לטעון את הנתונים מהענן ולוותר על השינויים המקומיים? מומלץ להוריד גיבוי קודם.")) return;
    try { await groupDraft(options.groupId, "delete"); state.current.saved = state.current.revision; location.reload(); }
    catch { setError("מחיקת הטיוטה נכשלה. הטיוטה נשארה במכשיר."); }
  }
  return { data, ready, status, error, conflict, update, mediaChanged, retry: save, exportDraft, discardDraft };
}
