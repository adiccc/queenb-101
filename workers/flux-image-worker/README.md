# QueenB FLUX image Worker

`POST /generate` invokes `@cf/black-forest-labs/flux-2-klein-4b` for the authenticated QueenB site server. Direct unauthenticated calls are rejected **before** the AI model is invoked.

## Secrets and deployment

Set `IMAGE_WORKER_SECRET` to the same independently generated random value on both this Worker and the site Worker. It must never be included in frontend code. Local testing can use an ignored `.dev.vars` in this directory.

```bash
npx wrangler secret put IMAGE_WORKER_SECRET --config workers/flux-image-worker/wrangler.jsonc
npx wrangler deploy --config workers/flux-image-worker/wrangler.jsonc
```

The site backend sends `Authorization: Bearer <secret>`. The browser sends requests only to the site's `/api/avatar?groupId=…` and `/api/mascot?groupId=…`, authenticated by an HttpOnly session cookie. Deploy both ends together: the old public Worker remains unprotected until this updated Worker is deployed. Missing configuration fails closed with HTTP 503; a missing or incorrect bearer secret returns 401.

Use the existing account plan and limits; this change does not alter billing or enable a paid plan. The local test suite stubs the AI model and does not incur AI requests.
