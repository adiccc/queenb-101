export const MAX_SNAPSHOT_BYTES = 20 * 1024 * 1024;
export type Snapshot = {
  version: 1;
  data: { milestones: unknown[]; goals: unknown[]; questions: unknown[]; characters: { avatarId?: string }[]; settings: Record<string, string> };
  images: Record<string, string>;
  mascotAnswers?: Record<string, string>;
};
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown) => record(value) && Object.values(value).every(item => typeof item === "string");
export function isSnapshot(value: unknown): value is Snapshot {
  if (!record(value) || value.version !== 1 || !record(value.data) || !record(value.images)) return false;
  const d = value.data;
  for (const [key, fields] of Object.entries({ milestones: ["id", "title", "text", "emoji"], goals: ["id", "title", "text", "status"], questions: ["id", "question", "correct"], characters: ["id", "name", "fallback", "passion", "power", "item", "vibe"] })) {
    if (!Array.isArray(d[key]) || !d[key].every(item => record(item) && fields.every(field => typeof item[field] === "string"))) return false;
  }
  if (!(d.questions as Record<string, unknown>[]).every(q => Array.isArray(q.answers) && q.answers.every(a => typeof a === "string"))) return false;
  if (!(d.characters as Record<string, unknown>[]).every(c => c.avatarId === undefined || typeof c.avatarId === "string")) return false;
  if (!(d.characters as { avatarId?: string }[]).every(c => !c.avatarId || Object.hasOwn(value.images as object, c.avatarId))) return false;
  if (!strings(d.settings) || typeof (d.settings as Record<string, unknown>).journeySubtitle !== "string") return false;
  if (value.mascotAnswers !== undefined && !strings(value.mascotAnswers)) return false;
  return Object.values(value.images).every(image => typeof image === "string" && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(image));
}
