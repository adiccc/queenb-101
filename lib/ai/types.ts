export type AvatarRequest = {
  image?: { data: string; mimeType: string };
  appearance?: string;
  traits: { name: string; passion: string; power: string; item: string; vibe: string; customPrompt?: string };
};

export interface AvatarProvider {
  generateAvatar(request: AvatarRequest): Promise<{ data: string; mimeType: string }>;
  generateMascot(prompt: string): Promise<{ data: string; mimeType: string }>;
}
