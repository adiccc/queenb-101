import type { Snapshot } from "./snapshot";

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const identified = (v: unknown[]): v is (Record<string, unknown> & { id: string })[] => v.every(x => object(x) && typeof x.id === "string") && new Set(v.map(x => (x as { id: string }).id)).size === v.length;

// Three-way merge: independent additions/edits survive, conflicting changes never silently win.
function mergeValue(base: unknown, local: unknown, remote: unknown): unknown {
  if (equal(local, remote) || equal(base, remote)) return local;
  if (equal(base, local)) return remote;
  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote) && identified(base) && identified(local) && identified(remote)) {
    const b = new Map(base.map(x => [x.id, x])), l = new Map(local.map(x => [x.id, x])), r = new Map(remote.map(x => [x.id, x]));
    return [...new Set([...r.keys(), ...l.keys()])].map(id => mergeValue(b.get(id), l.get(id), r.get(id))).filter(x => x !== undefined);
  }
  if (object(local) && object(remote) && (base === undefined || object(base))) {
    const result: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(base || {}), ...Object.keys(local), ...Object.keys(remote)])) {
      const value = mergeValue(base?.[key], local[key], remote[key]);
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  throw new Error("אותו פריט השתנה במחשב אחר. השינויים שלך נשמרו כטיוטה בדפדפן; אין לרענן לפני גיבוי או פתרון ההתנגשות.");
}

export function mergeSnapshots(base: Snapshot, local: Snapshot, remote: Snapshot): Snapshot {
  return {
    version: 2,
    data: mergeValue(base.data, local.data, remote.data) as Snapshot["data"],
    images: mergeValue(base.images, local.images, remote.images) as Snapshot["images"],
    ...(local.mascotAnswers || remote.mascotAnswers ? { mascotAnswers: mergeValue(base.mascotAnswers, local.mascotAnswers, remote.mascotAnswers) as Snapshot["mascotAnswers"] } : {}),
  };
}
