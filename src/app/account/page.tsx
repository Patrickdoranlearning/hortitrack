import { getUserIdAndOrgId } from "@/server/auth/getUser";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { redirect } from "next/navigation";
import { PageFrame } from "@/ui/templates/PageFrame";
import { ModulePageHeader } from "@/ui/layout/ModulePageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileForm } from "@/components/account/ProfileForm";
import { PasswordChangeForm } from "@/components/account/PasswordChangeForm";
import { TeamManagement } from "@/components/account/TeamManagement";

export default async function AccountPage() {
  const { userId, orgId } = await getUserIdAndOrgId();

  if (!userId) {
    redirect("/login");
  }

  const supabase = await getSupabaseServerApp();

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .single();

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

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="production">
      <div className="space-y-8">
        <ModulePageHeader
          title="Account Settings"
          description="Manage your profile, security, and team settings"
        />

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            {isAdminOrOwner && <TabsTrigger value="team">Team</TabsTrigger>}
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <ProfileForm
              initialName={profile?.full_name || null}
              email={profile?.email || null}
            />
            <PasswordChangeForm />
          </TabsContent>

          {isAdminOrOwner && (
            <TabsContent value="team">
              <TeamManagement />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </PageFrame>
  );
}
