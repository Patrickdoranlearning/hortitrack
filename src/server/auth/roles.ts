import "server-only";
import { getOptionalUser } from "@/server/auth/getUser";

export async function requireRoles(required: string[] | string) {
  const user = await getOptionalUser();
  if (!user) return { ok: false as const, reason: "unauthenticated" };
  const roles: string[] = (user as any).roles ?? (user as any).customClaims?.roles ?? [];
  const need = Array.isArray(required) ? required : [required];
  const allowed = need.every(r => roles.includes(r));
  return allowed ? { ok: true as const, user, roles } : { ok: false as const, reason: "forbidden" };
}
