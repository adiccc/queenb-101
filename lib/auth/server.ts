import { env } from "cloudflare:workers";
import { isGroupId } from "../groups";
import type { Permission } from "./permissions";
import { authJson, requirePermission } from "../../worker/auth";

// Also check inside route handlers, so alternative framework URL forms cannot
// bypass the outer Worker's API gate.
export async function authorizeGroupAction(request: Request, permission: Permission) {
  if (!isGroupId(new URL(request.url).searchParams.get("groupId"))) return authJson({ error: "בחרי קבוצה תקינה." }, 404);
  return requirePermission(request, env, permission);
}
