import type { AvatarRequest } from "./types";

export function buildAvatarPrompt({ traits }: AvatarRequest) {
  return `Use input image 0 only as a facial identity reference for ${traits.name}. Preserve the person's recognizable face, facial structure, eyes, eyebrows, nose, smile, skin tone, and hair. Ignore and do not copy the body, pose, clothing, accessories, framing, or background from input image 0. Create a completely new illustrated body and pose from the waist up.

Dress the character in a vivid QueenB pink short-sleeve T-shirt with the official-looking white QueenB wordmark centered clearly on the chest and the simple white curly-brace motif above it, inspired by QueenB mentor shirts. The shirt should be clearly visible and should replace whatever clothing appears in the reference image.

Create a square illustrated character avatar in a consistent QueenB squad art direction: polished contemporary 2D editorial cartoon, clean dark outlines, vivid pink, pale pink, white and touches of purple, confident middle-school girl coder energy, friendly and age-appropriate, expressive face, scrapbook sticker accents, simple graphic background. Character traits: passion ${traits.passion}; response when something does not work: ${traits.power}; visibly include ${traits.item}; contribution to the team: ${traits.vibe}.${traits.customPrompt ? ` She wants to learn ${traits.customPrompt}; reflect that subtly through her pose or accessories when appropriate.` : ""} Keep only the facial identity from the reference photo. Do not sexualize or age-up the subject. Do not add any text except the QueenB logo on the shirt.`;
}
