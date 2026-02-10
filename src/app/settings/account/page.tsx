import { getUserAndOrg } from "@/server/auth/org";
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { ProfileForm } from "@/components/account/ProfileForm";
import { PasswordChangeForm } from "@/components/account/PasswordChangeForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function AccountSettingsPage() {
  const { user, supabase } = await getUserAndOrg();

  // Get user profile (email comes from auth, not profiles table)
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <PageFrame moduleKey="production">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ModulePageHeader
            title="My Account"
            description="Manage your personal profile and security settings."
          />
          <Button asChild variant="outline">
            <Link href="/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Settings
            </Link>
          </Button>
        </div>

        <div className="space-y-6">
          <ProfileForm
            initialName={profile?.full_name || null}
            email={user.email || null}
          />
          <PasswordChangeForm />
        </div>
      </div>
    </PageFrame>
  );
}
