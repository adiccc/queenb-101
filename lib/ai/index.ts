import { CloudflareAvatarProvider } from "./cloudflare-provider";
import type { AvatarProvider } from "./types";

export function createAvatarProvider(): AvatarProvider {
  return new CloudflareAvatarProvider(process.env.CLOUDFLARE_IMAGE_ENDPOINT);
}
