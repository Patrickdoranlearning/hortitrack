import { getUserIdAndOrgId } from "@/server/auth/getUser";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { redirect } from "next/navigation";
import { PageFrame } from "@/ui/templates/PageFrame";
import { ModulePageHeader } from "@/ui/layout/ModulePageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileForm } from "@/components/account/ProfileForm";
import { PasswordChangeForm } from "@/components/account/PasswordChangeForm";
import { TeamManagement } from "@/components/account/TeamManagement";
import { CompanyProfileForm } from "@/components/account/CompanyProfileForm";

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

  // Get organization data for Company tab
  let organization: {
    id: string;
    name: string;
    country_code: string | null;
    logo_url: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    address: string | null;
  } | null = null;
  
  if (orgId && isAdminOrOwner) {
    // First get the base org data that definitely exists
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();

    if (org) {
      organization = {
        id: org.id,
        name: org.name,
        country_code: org.country_code ?? null,
        // These columns may not exist until migration is applied
        logo_url: (org as Record<string, unknown>).logo_url as string | null ?? null,
        email: (org as Record<string, unknown>).email as string | null ?? null,
        phone: (org as Record<string, unknown>).phone as string | null ?? null,
        website: (org as Record<string, unknown>).website as string | null ?? null,
        address: (org as Record<string, unknown>).address as string | null ?? null,
      };
    }
  }

  // Get company name for header (even if not admin)
  let companyName = "Doran Nurseries";
  if (orgId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();
    
    if (org?.name) {
      companyName = org.name;
    }
  }

  return (
    <PageFrame companyName={companyName} moduleKey="production">
      <div className="space-y-8">
        <ModulePageHeader
          title="Account Settings"
          description="Manage your profile, security, and team settings"
        />

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            {isAdminOrOwner && <TabsTrigger value="company">Company</TabsTrigger>}
            {isAdminOrOwner && <TabsTrigger value="team">Team</TabsTrigger>}
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <ProfileForm
              initialName={profile?.full_name || null}
              email={profile?.email || null}
            />
            <PasswordChangeForm />
          </TabsContent>

          {isAdminOrOwner && organization && (
            <TabsContent value="company">
              <CompanyProfileForm
                orgId={organization.id}
                initialData={{
                  name: organization.name,
                  countryCode: organization.country_code || "IE",
                  logoUrl: organization.logo_url || null,
                  email: organization.email || null,
                  phone: organization.phone || null,
                  website: organization.website || null,
                  address: organization.address || null,
                }}
              />
            </TabsContent>
          )}

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
