import "server-only";
import { getUserAndOrg } from "@/server/auth/org";

export type DocumentAccessContext = {
  supabase: Awaited<ReturnType<typeof getUserAndOrg>>["supabase"];
  orgId: string;
  user: NonNullable<Awaited<ReturnType<typeof getUserAndOrg>>["user"]>;
  role: string | null;
};

export async function requireDocumentAccess(): Promise<DocumentAccessContext> {
  const { supabase, orgId, user } = await getUserAndOrg();
  const { data: membership, error } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[documents] membership lookup failed", error);
  }
  if (!membership) {
    throw new Error("Forbidden");
  }
  const role = (membership.role as string | null) ?? null;
  return { supabase, orgId, user, role };
}



