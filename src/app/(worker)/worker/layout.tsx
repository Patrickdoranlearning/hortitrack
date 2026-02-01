"use client";

import { WorkerNav } from "@/components/worker/WorkerNav";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { OfflineIndicator } from "@/components/worker/OfflineIndicator";
import { WorkerOfflineProvider } from "@/offline/WorkerOfflineProvider";
import { WorkerErrorBoundary } from "@/components/worker/WorkerErrorBoundary";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

/**
 * Worker App Layout
 *
 * Wraps the worker pages with:
 * - Auth protection (redirects to /worker/login if not authenticated)
 * - WorkerOfflineProvider for task caching and offline support
 * - OfflineIndicator banner
 * - Branded header with HortiTrack logo and more menu
 * - Bottom navigation
 * - PWA meta tags injected via useEffect
 */
export default function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  // Skip auth check for login page
  const isLoginPage = pathname === "/worker/login";

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.replace("/worker/login");
    }
  }, [user, loading, isLoginPage, router]);

  // Inject PWA meta tags dynamically for the worker app
  useEffect(() => {
    // Only add worker-specific manifest if not already present
    const existingManifest = document.querySelector('link[rel="manifest"][href*="worker"]');
    if (!existingManifest) {
      // Create and append worker manifest link
      const manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      manifestLink.href = "/worker-manifest.json";
      manifestLink.id = "worker-manifest";
      document.head.appendChild(manifestLink);
    }

    // Set theme color for worker app
    let themeColor = document.querySelector('meta[name="theme-color"]');
    const originalThemeColor = themeColor?.getAttribute("content");
    if (themeColor) {
      themeColor.setAttribute("content", "#16a34a");
    } else {
      themeColor = document.createElement("meta");
      themeColor.setAttribute("name", "theme-color");
      themeColor.setAttribute("content", "#16a34a");
      document.head.appendChild(themeColor);
    }

    // Cleanup on unmount
    return () => {
      const workerManifest = document.getElementById("worker-manifest");
      if (workerManifest) {
        workerManifest.remove();
      }
      // Restore original theme color if it existed
      if (originalThemeColor) {
        const tc = document.querySelector('meta[name="theme-color"]');
        if (tc) tc.setAttribute("content", originalThemeColor);
      }
    };
  }, []);

  // Login page: render without nav/header wrapper
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Loading state: show centered spinner
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  // Not authenticated: render nothing (redirect in progress)
  if (!user) {
    return null;
  }

  // Authenticated: render full layout
  return (
    <WorkerErrorBoundary>
      <WorkerOfflineProvider syncInterval={30000}>
        <div className="flex flex-col min-h-screen bg-background">
          {/* Offline Banner - shows when offline or pending actions */}
          <OfflineIndicator showBanner />

          {/* Branded Header with logo and more menu */}
          <WorkerHeader />

          {/* Main Content - scrollable area with safe padding */}
          <main className="flex-1 overflow-auto pb-[calc(4rem+env(safe-area-inset-bottom))]">
            {children}
          </main>

          {/* Bottom Navigation */}
          <WorkerNav />
        </div>
      </WorkerOfflineProvider>
    </WorkerErrorBoundary>
  );
}
