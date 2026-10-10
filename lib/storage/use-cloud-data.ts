"use client";
import { useEffect, useRef, useState } from "react";
import { isSnapshot, MAX_SNAPSHOT_BYTES, type Snapshot } from "./snapshot";

// Writes are serialized, and every write uses the version loaded from R2.
export function useCloudData<T>(options: {
  initial: T;
  groupId: string;
  empty: () => Promise<T>;
  authorize: (force?: boolean) => Promise<boolean>;
  restore: (snapshot: Snapshot) => Promise<T>;
  snapshot: (data: T) => Promise<Snapshot>;
}) {
  const [data, setView] = useState(options.initial);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("טוענות מהענן...");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const state = useRef({ data: options.initial, etag: "", revision: 0, saved: 0, saving: false, loaded: false, conflict: false });
  const initialOptions = useRef(options);
  const mounted = useRef(true);
  const endpoint = `/api/groups/${options.groupId}/data`;

  async function save() {
    const s = state.current;
    if (!mounted.current || !s.loaded || s.saving || s.conflict || s.saved === s.revision) return;
    s.saving = true;
    setError("");
    setStatus("שומרות בענן...");
    try {
      while (mounted.current && s.saved !== s.revision) {
        const revision = s.revision;
        const snapshot = await initialOptions.current.snapshot(s.data);
        const body = JSON.stringify(snapshot);
        if (new Blob([body]).size > MAX_SNAPSHOT_BYTES) throw new Error("המידע גדול מדי לשמירה (מעל 20MB). יש להקטין את כמות התמונות לפני המשך שמירה.");
        if (!mounted.current) return;
        const init = { method: "PUT", headers: { "Content-Type": "application/json", ...(s.etag ? { "If-Match": s.etag } : { "If-None-Match": "*" }) }, body };
        let response = await fetch(endpoint, init);
        if (response.status === 401 && await initialOptions.current.authorize(true) && mounted.current) response = await fetch(endpoint, init);
        if (!mounted.current) return;
        if (!response.ok) {
          if (response.status === 409) { s.conflict = true; setConflict(true); }
          const result = await response.json() as { error?: string };
          throw new Error(result.error || "השמירה בענן נכשלה.");
        }
        const etag = response.headers.get("ETag");
        if (!etag) throw new Error("לא התקבל אישור גרסה מהענן. רענני לפני המשך עריכה.");
        s.etag = etag;
        s.saved = revision;
      }
      setStatus("נשמר בענן ✓");
    } catch (err) {
      setError(err instanceof Error ? err.message : "אין חיבור לענן. השינויים עדיין לא נשמרו.");
      setStatus("יש שינויים שלא נשמרו בענן");
    } finally { s.saving = false; }
  }

  useEffect(() => {
    let active = true;
    mounted.current = true;
    const s = state.current;
    async function load() {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) throw new Error("לא הצלחנו לטעון את המידע מהענן. בדקי את החיבור ונסי שוב.");
        const value = await response.json();
        if (!active) return;
        const empty = !!value && typeof value === "object" && "empty" in value && value.empty === true;
        const loaded = empty
          ? await initialOptions.current.empty()
          : isSnapshot(value) ? await initialOptions.current.restore(value) : (() => { throw new Error("קובץ המידע בענן אינו תקין."); })();
        if (!active) return;
        s.etag = response.headers.get("ETag") || "";
        if (!empty && !s.etag) throw new Error("לא התקבלה גרסת המידע מהענן.");
        s.data = loaded;
        s.loaded = true;
        setView(loaded);
        setReady(true);
        setStatus("המידע מעודכן מהענן ✓");
        // An empty group is read-only defaults until its first authorized change.
      } catch (err) { if (active) setError(err instanceof Error ? err.message : "טעינת המידע נכשלה."); }
    }
    void load();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (s.saved !== s.revision) { event.preventDefault(); event.returnValue = ""; }
    };
    const online = () => { if (s.loaded) void save(); else location.reload(); };
    addEventListener("beforeunload", beforeUnload);
    addEventListener("online", online);
    return () => { active = false; mounted.current = false; removeEventListener("beforeunload", beforeUnload); removeEventListener("online", online); };
    // The storage adapters are fixed for this mounted app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(value: T) {
    if (!mounted.current) return;
    const s = state.current;
    s.data = value;
    s.revision++;
    setView(value);
    void save();
  }
  function mediaChanged() { update(state.current.data); }
  return { data, ready, status, error, conflict, update, mediaChanged, retry: save };
}
