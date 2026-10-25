import type { DataBucket } from "./site-data";

const IMAGE_LIMIT = 5 * 1024 * 1024;
const imageJson = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function handleGroupImage(request: Request, bucket: DataBucket | undefined, groupId: string, filename?: string) {
  if (!bucket) return imageJson({ error: "אחסון הענן אינו מחובר." }, 503);
  try {
    if (request.method === "GET" && filename) {
      const image = await bucket.get(`groups/${groupId}/images/${filename}`);
      if (!image) return imageJson({ error: "התמונה לא נמצאה." }, 404);
      return new Response(image.body, { headers: { "Content-Type": `image/${filename.split('.').pop()}`, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
    }
    if (request.method !== "POST" || filename) return imageJson({ error: "Method not allowed" }, 405);
    const mime = request.headers.get("Content-Type") || "";
    if (!/^image\/(png|jpeg|webp|gif)$/.test(mime)) return imageJson({ error: "פורמט התמונה אינו נתמך." }, 415);
    const reader = request.body?.getReader();
    if (!reader) return imageJson({ error: "חסרה תמונה." }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > IMAGE_LIMIT) { await reader.cancel(); return imageJson({ error: "התמונה גדולה מ־5MB." }, 413); }
      chunks.push(value);
    }
    if (!size) return imageJson({ error: "חסרה תמונה." }, 400);
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
    const name = `${hash}.${mime.slice(6)}`;
    // Immutable, content-addressed uploads make retries safe and avoid duplicate objects.
    await bucket.put(`groups/${groupId}/images/${name}`, bytes, { onlyIf: new Headers({ "If-None-Match": "*" }), httpMetadata: { contentType: mime } });
    return imageJson({ url: `/api/groups/${groupId}/images/${name}` });
  } catch { return imageJson({ error: "העלאת התמונה נכשלה. אפשר לנסות שוב בלי ליצור אותה מחדש." }, 503); }
}
