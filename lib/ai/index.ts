import { env } from "cloudflare:workers";
import { CloudflareAvatarProvider } from "./cloudflare-provider";
import type { AvatarProvider } from "./types";

export function createAvatarProvider(): AvatarProvider {
  return new CloudflareAvatarProvider(env.CLOUDFLARE_IMAGE_ENDPOINT, env.IMAGE_WORKER_SECRET);
}
