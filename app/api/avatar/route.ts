import { createAvatarProvider } from "../../../lib/ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const photo = form.get("photo");
    if (!(photo instanceof File) || photo.size === 0) return Response.json({ error: "חסרה תמונת פנים" }, { status: 400 });
    if (!photo.type.startsWith("image/") || photo.size > 5 * 1024 * 1024) return Response.json({ error: "אפשר להעלות תמונה עד 5MB" }, { status: 400 });
    const name = String(form.get("name") || "").trim();
    if (!name) return Response.json({ error: "חסר שם לדמות" }, { status: 400 });
    const data = Buffer.from(await photo.arrayBuffer()).toString("base64");
    const provider = createAvatarProvider();
    const result = await provider.generateAvatar({ image: { data, mimeType: photo.type }, traits: { name, passion: String(form.get("passion") || ""), power: String(form.get("power") || ""), item: String(form.get("item") || ""), vibe: String(form.get("vibe") || ""), customPrompt: String(form.get("prompt") || "").trim() } });
    return Response.json({ image: `data:${result.mimeType};base64,${result.data}` });
  } catch (error) {
    console.error("Avatar generation failed", error);
    return Response.json({ error: "הקסם נתקע לרגע. בדקו שהחיבור ל־Cloudflare פעיל ונסו שוב." }, { status: 500 });
  }
}
