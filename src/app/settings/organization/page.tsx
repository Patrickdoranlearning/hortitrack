import { getUserIdAndOrgId } from "@/server/auth/getUser";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { redirect } from "next/navigation";
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { CompanyProfileForm } from "@/components/account/CompanyProfileForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default async function OrganizationSettingsPage() {
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

  // Get organization data
  let organization: {
    id: string;
    name: string;
    country_code: string | null;
    logo_url: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    address: string | null;
    vat_number: string | null;
    company_reg_number: string | null;
    bank_name: string | null;
    bank_iban: string | null;
    bank_bic: string | null;
    default_payment_terms: number | null;
    invoice_prefix: string | null;
    invoice_footer_text: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null = null;

  if (orgId) {
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
        logo_url: orgData.logo_url as string | null ?? null,
        email: orgData.email as string | null ?? null,
        phone: orgData.phone as string | null ?? null,
        website: orgData.website as string | null ?? null,
        address: orgData.address as string | null ?? null,
        vat_number: orgData.vat_number as string | null ?? null,
        company_reg_number: orgData.company_reg_number as string | null ?? null,
        bank_name: orgData.bank_name as string | null ?? null,
        bank_iban: orgData.bank_iban as string | null ?? null,
        bank_bic: orgData.bank_bic as string | null ?? null,
        default_payment_terms: orgData.default_payment_terms as number | null ?? 30,
        invoice_prefix: orgData.invoice_prefix as string | null ?? "INV",
        invoice_footer_text: orgData.invoice_footer_text as string | null ?? null,
        latitude: orgData.latitude as number | null ?? null,
        longitude: orgData.longitude as number | null ?? null,
      };
    }
  }

  if (!organization) {
    return (
      <PageFrame moduleKey="production">
        <div className="space-y-6">
          <ModulePageHeader
            title="Organization Settings"
            description="Configure your nursery's profile and business details."
          />
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No organization found</AlertTitle>
            <AlertDescription>
              Please contact support if you believe this is an error.
            </AlertDescription>
          </Alert>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame moduleKey="production">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ModulePageHeader
            title="Organization Settings"
            description="Configure your nursery's profile, branding, and business details."
          />
          <Button asChild variant="outline">
            <Link href="/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Settings
            </Link>
          </Button>
        </div>

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
            vatNumber: organization.vat_number || null,
            companyRegNumber: organization.company_reg_number || null,
            bankName: organization.bank_name || null,
            bankIban: organization.bank_iban || null,
            bankBic: organization.bank_bic || null,
            defaultPaymentTerms: organization.default_payment_terms || 30,
            invoicePrefix: organization.invoice_prefix || "INV",
            invoiceFooterText: organization.invoice_footer_text || null,
            latitude: organization.latitude || null,
            longitude: organization.longitude || null,
          }}
        />
      </div>
    </PageFrame>
  );
}
