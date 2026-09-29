import { createAvatarProvider } from "../../../lib/ai";
import { buildMascotPrompt } from "../../../lib/mascot/prompt";
import { mascotQuestions, type MascotAnswers } from "../../../lib/mascot/questions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { answers?: MascotAnswers };
    const answers = body.answers || {};
    if (mascotQuestions.some(question => !answers[question.key])) return Response.json({ error: "חסרות כמה החלטות בדרך לקמע" }, { status: 400 });
    const provider = createAvatarProvider();
    const result = await provider.generateMascot(buildMascotPrompt(answers));
    return Response.json({ image: `data:${result.mimeType};base64,${result.data}` });
  } catch (error) {
    console.error("Mascot generation failed", error);
    return Response.json({ error: "הקסם נתקע לרגע. בדקו שהחיבור ל־Cloudflare פעיל ונסו שוב." }, { status: 500 });
  }
}
