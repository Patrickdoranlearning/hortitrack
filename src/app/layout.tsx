import type { Metadata, Viewport } from "next";
import {PT_Sans, Playfair_Display} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { cn } from '@/lib/utils';
import OrgBoundary from "@/components/providers/OrgBoundary";
import { resolveActiveOrgId } from "@/server/org/getActiveOrg";

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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const orgId = await resolveActiveOrgId();
  return (
    <html lang="en">
       <body className={cn(ptSans.variable, playfairDisplay.variable, 'font-body', 'antialiased', 'overflow-x-hidden')}>
        <OrgBoundary orgId={orgId}>
          {children}
        </OrgBoundary>
        <Toaster />
      </body>
    </html>
  );
}
