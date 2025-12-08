import { getUserIdAndOrgId } from "@/server/auth/getUser";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { redirect } from "next/navigation";
import { PageFrame } from "@/ui/templates/PageFrame";
import { ModulePageHeader } from "@/ui/layout/ModulePageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileForm } from "@/components/account/ProfileForm";
import { PasswordChangeForm } from "@/components/account/PasswordChangeForm";
import { CompanyProfileForm } from "@/components/account/CompanyProfileForm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

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
    // Business details
    vat_number: string | null;
    company_reg_number: string | null;
    bank_name: string | null;
    bank_iban: string | null;
    bank_bic: string | null;
    default_payment_terms: number | null;
    invoice_prefix: string | null;
    invoice_footer_text: string | null;
  } | null = null;
  
  if (orgId && isAdminOrOwner) {
    // First get the base org data that definitely exists
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();

    if (org) {
      const orgData = org as Record<string, unknown>;
      organization = {
        id: org.id,
        name: org.name,
        country_code: org.country_code ?? null,
        // These columns may not exist until migration is applied
        logo_url: orgData.logo_url as string | null ?? null,
        email: orgData.email as string | null ?? null,
        phone: orgData.phone as string | null ?? null,
        website: orgData.website as string | null ?? null,
        address: orgData.address as string | null ?? null,
        // Business details
        vat_number: orgData.vat_number as string | null ?? null,
        company_reg_number: orgData.company_reg_number as string | null ?? null,
        bank_name: orgData.bank_name as string | null ?? null,
        bank_iban: orgData.bank_iban as string | null ?? null,
        bank_bic: orgData.bank_bic as string | null ?? null,
        default_payment_terms: orgData.default_payment_terms as number | null ?? 30,
        invoice_prefix: orgData.invoice_prefix as string | null ?? "INV",
        invoice_footer_text: orgData.invoice_footer_text as string | null ?? null,
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
                  // Business details
                  vatNumber: organization.vat_number || null,
                  companyRegNumber: organization.company_reg_number || null,
                  bankName: organization.bank_name || null,
                  bankIban: organization.bank_iban || null,
                  bankBic: organization.bank_bic || null,
                  defaultPaymentTerms: organization.default_payment_terms || 30,
                  invoicePrefix: organization.invoice_prefix || "INV",
                  invoiceFooterText: organization.invoice_footer_text || null,
                }}
              />
            </TabsContent>
          )}
        </Tabs>

        {isAdminOrOwner && (
          <div className="pt-4 border-t">
            <Button asChild variant="outline">
              <Link href="/settings/team">
                <Users className="mr-2 h-4 w-4" />
                Manage Team Members
              </Link>
            </Button>
          </div>
        )}
      </div>
    </PageFrame>
  );
}
