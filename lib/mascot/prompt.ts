import type { MascotAnswers } from "./questions";

export const QUEENB_MASCOT_CONTEXT = `The mascot should embody confidence, curiosity, courage to try without knowing the outcome, creativity, love of technology and building things, friendship, teamwork, and a supportive community of girls. It should express the QueenB idea of being brave rather than perfect. Technology and programming should feel playful, creative, empowering, and accessible. The character is for middle-school girls: youthful rather than childish, never corporate, overly educational, or stereotypically feminine.`;

export function buildMascotPrompt(answers: MascotAnswers) {
  return `Create a unique group mascot for a group of teenage girls learning programming at QueenB.

The mascot is a ${answers.creature} with a ${answers.vibe} personality and a ${answers.bodyShape} silhouette. Her special strength is ${answers.power}. She carries ${answers.item}, lives in ${answers.world}, and her signature feature is ${answers.feature}. She enters by ${answers.movement}, with ${answers.expression}. The idea behind her motto is: ${answers.motto}.

Her leading color direction is ${answers.colorMood}, interpreted strictly through the existing QueenB palette. Show visually that she uses technology by ${answers.techDetail}. Her response when something does not work is: ${answers.artTexture}; express that through a small visual storytelling detail. Show ${answers.energyEffect} around her as a subtle energy effect, and integrate ${answers.teamSymbol} as a simple visual symbol of teamwork without using written text.

${QUEENB_MASCOT_CONTEXT}

Create a friendly, expressive mascot character in a bold, playful, contemporary illustration style. Give her tech-inspired details, an expressive face, strong personality, a memorable silhouette, and a cool, slightly quirky presence. Use the existing QueenB palette as inspiration: vivid pink, pale pink, white, black, and selective purple accents, while avoiding excessive pink clichés, princess imagery, generic corporate characters, and stereotypical “girl in tech” imagery.

Centered full character, clean composition, simple or minimal background, suitable as a group mascot, sticker, or avatar. No written text, letters, logos, or typography inside the image.`;
}
