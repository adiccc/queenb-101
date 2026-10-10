import { authorizeGroupAction } from "../../../lib/auth/server";
import { createAvatarProvider } from "../../../lib/ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await authorizeGroupAction(request, "images:generate");
  if (denied) return denied;
  try {
    const form = await request.formData();
    const photo = form.get("photo");
    const appearance = String(form.get("appearance") || "").trim();
    const hasPhoto = photo instanceof File && photo.size > 0;
    if (!hasPhoto && !appearance) return Response.json({ error: "העלי תמונה או כתבי תיאור של המראה שלך" }, { status: 400 });
    if (appearance.length > 2000) return Response.json({ error: "אפשר לכתוב תיאור עד 2,000 תווים" }, { status: 400 });
    if (hasPhoto && (!photo.type.startsWith("image/") || photo.size > 5 * 1024 * 1024)) return Response.json({ error: "אפשר להעלות תמונה עד 5MB" }, { status: 400 });
    const name = String(form.get("name") || "").trim();
    if (!name) return Response.json({ error: "חסר שם לדמות" }, { status: 400 });
    const image = hasPhoto ? { data: Buffer.from(await photo.arrayBuffer()).toString("base64"), mimeType: photo.type } : undefined;
    const provider = createAvatarProvider();
    const result = await provider.generateAvatar({ image, appearance, traits: { name, passion: String(form.get("passion") || ""), power: String(form.get("power") || ""), item: String(form.get("item") || ""), vibe: String(form.get("vibe") || ""), customPrompt: String(form.get("prompt") || "").trim() } });
    return Response.json({ image: `data:${result.mimeType};base64,${result.data}` });
  } catch (error) {
    console.error("Avatar generation failed", error);
    return Response.json({ error: "הקסם נתקע לרגע. בדקו שהחיבור ל־Cloudflare פעיל ונסו שוב." }, { status: 500 });
  }
}
