// src/server/auth/getUser.ts
import "server-only";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";
import { UUID } from "crypto";

export type ServerUser = { uid: string; email?: string; orgId?: string };

export async function getUserIdAndOrgId(): Promise<{ userId: string | null; orgId: string | null }> {
  const supabase = await getSupabaseForRequest();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    // console.error("Error getting Supabase user:", userError?.message);
    return { userId: null, orgId: null };
  }

  // Now, fetch the active_org_id from the public.profiles table
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", user.id as UUID)
    .single();

  if (profileError) {
    console.error("Error fetching user profile for org ID:", profileError.message);
    return { userId: user.id, orgId: null };
  }

  return { userId: user.id, orgId: profile.active_org_id };
}

// Keep getUser and getOptionalUser for compatibility if other parts of the app use them,
// but adapt them to use Supabase auth.
export async function getUser(): Promise<ServerUser> {
  const { userId, orgId } = await getUserIdAndOrgId();
  if (!userId) {
    throw new Error("UNAUTHENTICATED");
  }
  // You might want to fetch more user details here if needed
  return { uid: userId, orgId: orgId ?? undefined }; 
}

export async function getOptionalUser(): Promise<ServerUser | null> {
  const { userId, orgId } = await getUserIdAndOrgId();
  if (!userId) {
    return null;
  }
  return { uid: userId, orgId: orgId ?? undefined };
}
