# QueenB FLUX image Worker

Minimal Cloudflare Worker exposing `POST /generate` with the Workers AI model `@cf/black-forest-labs/flux-2-klein-4b`.

## Free Tier guardrail

Deploy only on a Cloudflare Workers Free account. Do not enable Workers Paid or AI Gateway unified billing. The free allocation is 10,000 Workers AI Neurons per day; when exhausted, requests on the Free plan fail instead of creating paid overage.

## Deploy

From the repository root:

```bash
npx wrangler login
npx wrangler deploy --config workers/flux-image-worker/wrangler.jsonc
```

## Test

```bash
curl -X POST "https://queenb-flux-image-generator.queenb-images.workers.dev/generate" \
  -F "prompt=Turn the person in input image 0 into a friendly illustrated QueenB avatar" \
  -F "input_image_0=@face.jpg" \
  --output flux-test.jpg
```

## React / TypeScript

```ts
const formData = new FormData();
formData.append("prompt", "Turn the person into a friendly illustrated QueenB avatar");
formData.append("input_image_0", selectedImage);

const response = await fetch(
  "https://queenb-flux-image-generator.queenb-images.workers.dev/generate",
  {
    method: "POST",
    body: formData,
  },
);

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.details ?? error.error);
}

const blob = await response.blob();
const imageUrl = URL.createObjectURL(blob);
```
