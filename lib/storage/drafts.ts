import type { Snapshot } from "./snapshot";
export type GroupDraft = { base: Snapshot; local: Snapshot; etag: string };
// IndexedDB holds generated images without localStorage's small string quota.
export async function groupDraft(groupId: string, operation: "get" | "put" | "delete", value?: GroupDraft): Promise<GroupDraft | undefined> {
  let owner = sessionStorage.getItem("queenb-draft-owner");
  if (!owner) { owner = crypto.randomUUID(); sessionStorage.setItem("queenb-draft-owner", owner); }
  const key = `${groupId}:${owner}`;
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open("queenb-cloud-drafts", 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore("groups");
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const transaction = db.transaction("groups", operation === "get" ? "readonly" : "readwrite");
      const store = transaction.objectStore("groups");
      const request = operation === "get" ? store.get(key) : operation === "put" ? store.put(value, key) : store.delete(key);
      transaction.oncomplete = () => { db.close(); resolve(operation === "get" ? request.result : undefined); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Draft storage failed")); };
    };
  });
}
