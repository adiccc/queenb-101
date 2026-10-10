// Secrets are configured in Cloudflare or ignored .dev.vars, never in client code.
declare namespace Cloudflare {
  interface Env {
    QUEENB_ACCESS_CODE?: string;
    QUEENB_SESSION_SECRET?: string;
    IMAGE_WORKER_SECRET?: string;
    CLOUDFLARE_IMAGE_ENDPOINT?: string;
    DB?: D1Database;
  }
}
