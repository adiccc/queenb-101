const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body, status) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (url.pathname !== "/generate") {
      return jsonResponse({ error: "Not found" }, 404);
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Use POST /generate" }, 405);
    }

    // Only the authenticated site server may invoke the paid image model.
    if (!env.IMAGE_WORKER_SECRET) return jsonResponse({ error: "Image service is not configured" }, 503);
    const supplied = request.headers.get("Authorization") || "";
    const encoder = new TextEncoder();
    const [a, b] = await Promise.all([supplied, `Bearer ${env.IMAGE_WORKER_SECRET}`].map(value => crypto.subtle.digest("SHA-256", encoder.encode(value))));
    const left = new Uint8Array(a), right = new Uint8Array(b);
    let difference = 0;
    for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
    if (difference !== 0) return jsonResponse({ error: "Unauthorized" }, 401);

    let form;
    try {
      form = await request.formData();
    } catch {
      return jsonResponse({ error: "Request body must be multipart/form-data" }, 400);
    }

    const promptValue = form.get("prompt");
    const prompt = typeof promptValue === "string" ? promptValue.trim() : "";
    if (!prompt) {
      return jsonResponse({ error: "prompt is required and cannot be empty" }, 400);
    }

    const inputImage = form.get("input_image_0");
    if (inputImage instanceof File) {
      if (!inputImage.type.startsWith("image/")) {
        return jsonResponse({ error: "input_image_0 must be an image" }, 400);
      }
      if (inputImage.size > 5 * 1024 * 1024) {
        return jsonResponse({ error: "input_image_0 must be smaller than 5MB" }, 400);
      }
    }

    try {
      const modelForm = new FormData();
      modelForm.append("prompt", prompt);
      modelForm.append("width", "1024");
      modelForm.append("height", "1024");
      if (inputImage instanceof File) modelForm.append("input_image_0", inputImage);

      const formResponse = new Response(modelForm);
      const result = await env.AI.run(MODEL, {
        multipart: {
          body: formResponse.body,
          contentType: formResponse.headers.get("content-type"),
        },
      });
      if (!result?.image) {
        throw new Error("The model returned no image data");
      }

      const binary = atob(result.image);
      const image = Uint8Array.from(binary, (character) => character.charCodeAt(0));

      return new Response(image, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "image/jpeg",
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      console.error("Image generation failed", error);
      return jsonResponse(
        {
          error: "Image generation failed",
          details: error instanceof Error ? error.message : "Unknown Workers AI error",
        },
        500,
      );
    }
  },
};
