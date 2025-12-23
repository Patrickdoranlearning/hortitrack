import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isInternalStaff } from "@/lib/auth/b2b-guard";
import { ImpersonateClient } from "./ImpersonateClient";
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';

export default async function ImpersonatePage() {
  // Verify user is internal staff
  const staffAccess = await isInternalStaff();
  if (!staffAccess) {
    redirect("/b2b/login");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/b2b/login");
  }

  // Get user's org
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.active_org_id) {
    return (
      <PageFrame moduleKey="sales">
        <div className="flex min-h-screen items-center justify-center">
          <p>No organization found</p>
        </div>
      </PageFrame>
    );
  }

  // Fetch all customers in org
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, code, email, store")
    .eq("org_id", profile.active_org_id)
    .order("name");

  // Check for active impersonation session
  const { data: activeSession } = await supabase
    .from("customer_impersonation_sessions")
    .select(`
      id,
      customer_id,
      started_at,
      notes,
      customers (
        id,
        name,
        code
      )
    `)
    .eq("staff_user_id", user.id)
    .is("ended_at", null)
    .single();

  // Automatically end any active session on page load/refresh
  if (activeSession) {
    await supabase
      .from("customer_impersonation_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", activeSession.id)
      .is("ended_at", null);
  }

  return (
    <PageFrame moduleKey="sales">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <ModulePageHeader
          title="Customer impersonation"
          description="Place orders on behalf of customers (sales reps only)"
        />
        <ImpersonateClient
          customers={customers || []}
          activeSession={null}
        />
      </div>
    </PageFrame>
  );
}
