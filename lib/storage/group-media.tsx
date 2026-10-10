"use client";
import { createContext, useContext } from "react";
import type { MascotAnswers } from "../mascot/questions";

// One instance per mounted group. No shared globals, localStorage or IndexedDB.
// Old browser data is deliberately left untouched and is never auto-imported.
export class GroupMedia {
  private images = new Map<string, Blob>();
  answers: MascotAnswers | undefined;
  constructor(readonly groupId: string) {}
  getImage = async (id: string) => this.images.get(id);
  putImage = async (id: string, blob: Blob) => { this.images.set(id, blob); };
  deleteImage = async (id: string) => { this.images.delete(id); };
  clear = () => { this.images.clear(); this.answers = undefined; };
}
export const GroupMediaContext = createContext<GroupMedia | null>(null);
export function useGroupMedia() {
  const media = useContext(GroupMediaContext);
  if (!media) throw new Error("Missing group media");
  return media;
}
