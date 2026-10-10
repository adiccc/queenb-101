import { groupDataKey, isGroupId } from "../lib/groups";
import { isSnapshot, MAX_SNAPSHOT_BYTES } from "../lib/storage/snapshot";

export interface DataBucket {
  get(key: string): Promise<{ body: ReadableStream; httpEtag: string } | null>;
  put(key: string, value: string, options: { onlyIf: Headers; httpMetadata: { contentType: string } }): Promise<{ httpEtag: string } | null>;
}
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

export async function handleSiteData(request: Request, bucket: DataBucket | undefined, groupId: string): Promise<Response> {
  if (!isGroupId(groupId)) return json({ error: "הקבוצה לא קיימת." }, 404);
  const key = groupDataKey(groupId);
  if (!bucket) return json({ error: "אחסון הענן אינו מחובר. יש לחבר את queenb-site-data ל־QUEENB_DATA." }, 503);
  try {
    if (request.method === "GET") {
      const object = await bucket.get(key);
      if (!object) return json({ empty: true });
      return new Response(object.body, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ETag: object.httpEtag, "X-QueenB-Version": object.httpEtag } });
    }
    if (request.method !== "PUT") return json({ error: "Method not allowed" }, 405);
    const origin = request.headers.get("Origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("Sec-Fetch-Site") === "cross-site") return json({ error: "Forbidden" }, 403);
    if (!request.headers.get("Content-Type")?.startsWith("application/json")) return json({ error: "Expected JSON" }, 415);
    // Cloudflare compression may weaken the HTTP ETag without changing the R2 object.
    // Accept old clients carrying that transport validator; R2 still compares the exact object tag.
    const match = request.headers.get("If-Match")?.replace(/^W\/("[^"\r\n]+")$/, "$1");
    const create = request.headers.get("If-None-Match") === "*";
    if ((!match || match === "*") && !create) return json({ error: "Missing version" }, 428);
    // Bound bytes while reading, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Missing body" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_SNAPSHOT_BYTES) { await reader.cancel(); return json({ error: "קובץ הקבוצה גדול מדי (מעל 20MB)." }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const text = new TextDecoder().decode(bytes);
    let snapshot: unknown;
    try { snapshot = JSON.parse(text); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!isSnapshot(snapshot)) return json({ error: "Invalid group data" }, 400);
    const onlyIf = new Headers(create ? { "If-None-Match": "*" } : { "If-Match": match! });
    const saved = await bucket.put(key, text, { onlyIf, httpMetadata: { contentType: "application/json" } });
    if (!saved) return json({ error: "המידע של הקבוצה השתנה במחשב אחר. השינויים שלך לא נשמרו. טעינה מחדש תציג את המידע העדכני ותבטל את השינויים שלא נשמרו." }, 409);
    return new Response(null, { status: 204, headers: { ETag: saved.httpEtag, "X-QueenB-Version": saved.httpEtag, "Cache-Control": "no-store" } });
  } catch {
    return json({ error: "לא הצלחנו להתחבר לאחסון הענן. נסי שוב." }, 503);
  }
}
