import { getUserIdAndOrgId } from "@/server/auth/getUser";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { redirect } from "next/navigation";
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { TeamManagement } from "@/components/account/TeamManagement";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default async function TeamPage() {
  const { userId, orgId } = await getUserIdAndOrgId();

  if (!userId) {
    redirect("/login");
  }

  const supabase = await getSupabaseServerApp();

  // Check if user is admin or owner
  let isAdminOrOwner = false;
  if (orgId) {
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .single();

    isAdminOrOwner = membership?.role === "admin" || membership?.role === "owner";
  }

  if (!isAdminOrOwner) {
    redirect("/settings");
  }

  return (
    <PageFrame moduleKey="production">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ModulePageHeader
            title="Team Management"
            description="Invite team members and manage their roles and permissions."
          />
          <Button asChild variant="outline">
            <Link href="/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Settings
            </Link>
          </Button>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Role Guide</AlertTitle>
          <AlertDescription className="mt-2">
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li><strong>Owner</strong> - Full access to all features including billing and team management</li>
              <li><strong>Admin</strong> - Can manage team members, settings, and all operational features</li>
              <li><strong>Grower</strong> - Nursery operatives: can pick orders, update batch status, and use mobile features</li>
              <li><strong>Sales</strong> - Can create orders, manage customers, and view production data</li>
              <li><strong>Viewer</strong> - Read-only access to view data and reports</li>
            </ul>
          </AlertDescription>
        </Alert>

        <TeamManagement />
      </div>
    </PageFrame>
  );
}







