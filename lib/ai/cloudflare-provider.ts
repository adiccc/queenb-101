import { buildAvatarPrompt } from "./prompt";
import type { AvatarProvider, AvatarRequest } from "./types";

const DEFAULT_ENDPOINT = "https://queenb-flux-image-generator.queenb-images.workers.dev/generate";

export class CloudflareAvatarProvider implements AvatarProvider {
  constructor(private endpoint = DEFAULT_ENDPOINT, private secret?: string) {}

  async generateAvatar(request: AvatarRequest) {
    return this.generate(buildAvatarPrompt(request), request.image);
  }

  async generateMascot(prompt: string) {
    return this.generate(prompt);
  }

  private async generate(prompt: string, image?: AvatarRequest["image"]) {
    if (!this.secret) throw new Error("IMAGE_WORKER_SECRET is not configured");
    const form = new FormData();
    form.append("prompt", prompt);
    if (image) {
      const bytes = Buffer.from(image.data, "base64");
      form.append("input_image_0", new Blob([bytes], { type: image.mimeType }), "reference-image");
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.secret}` },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Cloudflare Workers AI request failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const mimeType = response.headers.get("content-type") || "image/jpeg";
    const data = Buffer.from(await response.arrayBuffer()).toString("base64");
    return { data, mimeType };
  }
}
