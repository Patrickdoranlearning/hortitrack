
import type {Metadata} from 'next';
import {PT_Sans, Playfair_Display} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { cn } from '@/lib/utils';

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
  title: 'HortiTrack',
  description: 'Nursery stock production and crop management for Doran Nurseries',
  themeColor: '#6AB04A',
  openGraph: {
    title: 'HortiTrack',
    description: 'Track batches, locations, and crop data with ease.',
    images: ['/og-image.png'],
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  other: {
    'color-scheme': 'light dark',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
       <body className={cn(ptSans.variable, playfairDisplay.variable, 'font-body', 'antialiased')}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
