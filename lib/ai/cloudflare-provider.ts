import { buildAvatarPrompt } from "./prompt";
import type { AvatarProvider, AvatarRequest } from "./types";

const DEFAULT_ENDPOINT = "https://queenb-flux-image-generator.queenb-images.workers.dev/generate";
const SECONDARY_ENDPOINT = "https://queenb-flux-image-generator.queenb-avatars.workers.dev/generate";

function alternateEndpoint(endpoint: string) {
  if (endpoint === DEFAULT_ENDPOINT) return SECONDARY_ENDPOINT;
  if (endpoint === SECONDARY_ENDPOINT) return DEFAULT_ENDPOINT;
  return undefined;
}

// The image Worker wraps AI errors in a 500 response with a details field.
// Match the quota message, not HTTP 429 or generic AI error code 4006:
// those can also mean rate limiting or temporarily unavailable capacity.
function isFreeAllocationExhausted(detail: string) {
  try {
    const body = JSON.parse(detail);
    return typeof body.details === "string" &&
      /\bused up your daily free allocation\b/i.test(body.details);
  } catch {
    return false;
  }
}

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

    const send = (endpoint: string) => fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.secret}` },
      body: form,
    });

    let response = await send(this.endpoint);
    if (!response.ok) {
      const detail = await response.text();
      const fallback = alternateEndpoint(this.endpoint);
      if (!fallback || !isFreeAllocationExhausted(detail)) {
        throw new Error(`Cloudflare Workers AI request failed (${response.status}): ${detail.slice(0, 300)}`);
      }
      console.warn("Image AI daily allocation exhausted; trying the alternate image Worker once");
      response = await send(fallback);
    }

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Cloudflare Workers AI request failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const mimeType = response.headers.get("content-type") || "image/jpeg";
    const data = Buffer.from(await response.arrayBuffer()).toString("base64");
    return { data, mimeType };
  }
}
