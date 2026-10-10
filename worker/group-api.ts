import { isGroupId } from "../lib/groups";
import { handleAuth, requirePermission, authJson, type AuthEnv } from "./auth";
import { handleSiteData, type DataBucket } from "./site-data";
export interface GroupEnv extends AuthEnv { QUEENB_DATA?: DataBucket }
export async function handleGroupApi(request: Request, env: GroupEnv, next: () => Promise<Response>): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/auth/session") return handleAuth(request, env);
  // Retired endpoint: old tabs cannot read or overwrite the legacy file.
  if (url.pathname === "/api/site-data") return authJson({ error: "בחרי קבוצה כדי להמשיך." }, 410);
  if (url.pathname.startsWith("/api/groups/")) {
    const match = url.pathname.match(/^\/api\/groups\/([^/]+)\/data$/);
    if (!match || !isGroupId(match[1])) return authJson({ error: "הקבוצה לא קיימת." }, 404);
    if (request.method === "PUT") {
      const denied = await requirePermission(request, env, "data:write");
      if (denied) return denied;
    }
    return handleSiteData(request, env.QUEENB_DATA, match[1]);
  }
  if (url.pathname === "/api/avatar" || url.pathname === "/api/mascot") {
    if (!isGroupId(url.searchParams.get("groupId"))) return authJson({ error: "בחרי קבוצה תקינה." }, 404);
    const denied = await requirePermission(request, env, "images:generate");
    if (denied) return denied;
  }
  return next();
}
