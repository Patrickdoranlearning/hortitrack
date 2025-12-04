
import type { Metadata, Viewport } from "next";
import { PT_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { cn } from '@/lib/utils';
import { OrgProvider } from "@/lib/org/context";
import { ReferenceDataProvider } from "@/contexts/ReferenceDataContext";
import { OfflineProvider } from "@/offline/OfflineProvider";

const ptSans = PT_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-pt-sans',
  weight: ['400', '700'],
});

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair-display',
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: "HortiTrack",
  description: "Nursery stock production and crop management for Doran Nurseries",
  openGraph: {
    title: "HortiTrack",
    description: "Track batches, locations, and crop data with ease.",
    images: ["/og-image.png"],
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ffffff",
  colorScheme: "light",
};

import { createClient } from "@/lib/supabase/server";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let activeOrgId: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_org_id')
      .eq('id', user.id)
      .single();

    if (profile?.active_org_id) {
      activeOrgId = profile.active_org_id;
    } else {
      const { data: membership } = await supabase
        .from('org_memberships')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      if (membership) {
        activeOrgId = membership.org_id;
      }
    }
  }

  return (
    <html lang="en">
      <body className={cn(ptSans.variable, playfairDisplay.variable, 'font-body', 'antialiased', 'overflow-x-hidden')}>
        <OrgProvider initialOrgId={activeOrgId}>
          <OfflineProvider>
            <ReferenceDataProvider>{children}</ReferenceDataProvider>
          </OfflineProvider>
        </OrgProvider>
        <Toaster />
      </body>
    </html>
  );
}
