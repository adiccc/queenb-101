"use client";
import { createContext, useContext } from "react";
import type { MascotAnswers } from "../mascot/questions";
import { isImageReference, type Snapshot } from "./snapshot";

export class GroupMedia {
  private images = new Map<string, Blob | string>();
  answers: MascotAnswers | undefined;
  constructor(readonly groupId: string) {}
  getImage = async (id: string): Promise<Blob | undefined> => {
    const value = this.images.get(id);
    if (value === undefined) return undefined;
    if (value instanceof Blob) return value;
    const response = await fetch(value);
    if (!response.ok) throw new Error("טעינת התמונה נכשלה.");
    return response.blob();
  };
  putImage = async (id: string, blob: Blob | string) => { this.images.set(id, blob); };
  deleteImage = async (id: string) => { this.images.delete(id); };
  clear = () => { this.images.clear(); this.answers = undefined; };
  reference = async (id: string): Promise<string | undefined> => {
    const value = this.images.get(id);
    if (!value || typeof value === "string") return value;
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(value);
    });
  };
  prepare = async (snapshot: Snapshot, send: (url: string, init: RequestInit) => Promise<Response>): Promise<Snapshot> => {
    const images: Record<string, string> = {};
    for (const [id, value] of Object.entries(snapshot.images)) {
      const cached = this.images.get(id);
      if (isImageReference(value, this.groupId)) { images[id] = value; continue; }
      // Reuse only immutable values already uploaded for this exact input.
      const blob = await (await fetch(value)).blob();
      const response = await send(`/api/groups/${this.groupId}/images`, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url || !isImageReference(result.url, this.groupId)) throw new Error(result.error || "שמירת התמונה נכשלה.");
      images[id] = result.url;
      if (this.images.get(id) === cached) this.images.set(id, result.url);
    }
    return { ...snapshot, version: 2, images };
  };
}
export const GroupMediaContext = createContext<GroupMedia | null>(null);
export function useGroupMedia() {
  const media = useContext(GroupMediaContext);
  if (!media) throw new Error("Missing group media");
  return media;
}
