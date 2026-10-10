import { permissions, type Permission } from "../lib/auth/permissions";

export interface AuthEnv {
  QUEENB_ACCESS_CODE?: string;
  QUEENB_SESSION_SECRET?: string;
  AUTH_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
const COOKIE = "queenb_session";
export const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();
export const authJson = (data: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
export function sameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  return (!origin || origin === new URL(request.url).origin) && request.headers.get("Sec-Fetch-Site") !== "cross-site";
}
function configured(env: AuthEnv) { return !!env.QUEENB_ACCESS_CODE && (env.QUEENB_SESSION_SECRET?.length ?? 0) >= 32; }
function encode(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
function decode(value: string) { return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0)); }
async function key(env: AuthEnv) {
  // Rotating either secret also invalidates previously issued sessions.
  return crypto.subtle.importKey("raw", encoder.encode(JSON.stringify([env.QUEENB_SESSION_SECRET, env.QUEENB_ACCESS_CODE])), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function equalCodes(a: string, b: string) {
  const [x, y] = await Promise.all([a, b].map(value => crypto.subtle.digest("SHA-256", encoder.encode(value))));
  const left = new Uint8Array(x), right = new Uint8Array(y);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}
export async function sessionPermissions(request: Request, env: AuthEnv): Promise<Permission[]> {
  if (!configured(env)) return [];
  try {
    const token = request.headers.get("Cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!token || token.length > 2048) return [];
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra !== undefined || !await crypto.subtle.verify("HMAC", await key(env), decode(signature), encoder.encode(payload))) return [];
    const claims = JSON.parse(new TextDecoder().decode(decode(payload)));
    const now = Math.floor(Date.now() / 1000);
    if (claims.v !== 1 || !Number.isInteger(claims.exp) || claims.exp <= now || claims.exp > now + SESSION_SECONDS || !Array.isArray(claims.permissions)) return [];
    return permissions.filter(permission => claims.permissions.includes(permission));
  } catch { return []; }
}
export async function requirePermission(request: Request, env: AuthEnv, permission: Permission): Promise<Response | null> {
  if (!sameOrigin(request)) return authJson({ error: "הבקשה נחסמה. חזרי לאתר ונסי שוב." }, 403);
  if (!configured(env)) return authJson({ error: "קוד הגישה עדיין לא הוגדר בשרת. פני למדריכה." }, 503);
  if (!(await sessionPermissions(request, env)).includes(permission)) return authJson({ error: "נדרש קוד גישה כדי להמשיך." }, 401);
  return null;
}
export async function handleAuth(request: Request, env: AuthEnv): Promise<Response> {
  if (request.method === "GET") return authJson({ permissions: await sessionPermissions(request, env) });
  if (!sameOrigin(request)) return authJson({ error: "הבקשה נחסמה." }, 403);
  const cookieFlags = `Path=/; HttpOnly; SameSite=Strict${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
  if (request.method === "DELETE") return authJson({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=; ${cookieFlags}; Max-Age=0` });
  if (request.method !== "POST") return authJson({ error: "Method not allowed" }, 405);
  if (!configured(env) || !env.AUTH_RATE_LIMITER) return authJson({ error: "קוד הגישה או הגנת הכניסה עדיין לא הוגדרו בשרת. פני למדריכה." }, 503);
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) return authJson({ error: "Expected JSON" }, 415);
  // Applied before comparing codes; shared school connections get a modest allowance.
  const { success } = await env.AUTH_RATE_LIMITER.limit({ key: `queenb-login:${request.headers.get("CF-Connecting-IP") || "local"}` });
  if (!success) return authJson({ error: "היו כמה ניסיונות רצופים. חכי דקה ונסי שוב." }, 429, { "Retry-After": "60" });
  const reader = request.body?.getReader();
  if (!reader) return authJson({ error: "הזיני קוד גישה." }, 400);
  let text = "", bytes = 0;
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 1024) { await reader.cancel(); return authJson({ error: "הקוד ארוך מדי." }, 413); }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  let code: unknown;
  try { code = JSON.parse(text).code; } catch { return authJson({ error: "הזיני קוד גישה." }, 400); }
  if (typeof code !== "string" || !await equalCodes(code, env.QUEENB_ACCESS_CODE!)) return authJson({ error: "הקוד לא מתאים. נסי שוב או שאלי את המדריכה 💜" }, 401);
  const payload = encode(encoder.encode(JSON.stringify({ v: 1, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS, permissions })));
  const signature = encode(new Uint8Array(await crypto.subtle.sign("HMAC", await key(env), encoder.encode(payload))));
  // No Max-Age: browser-session cookie, with an additional server-enforced expiry.
  return authJson({ permissions }, 200, { "Set-Cookie": `${COOKIE}=${payload}.${signature}; ${cookieFlags}` });
}
