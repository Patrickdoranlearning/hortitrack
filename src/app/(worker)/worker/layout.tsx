"use client";

import { WorkerNav } from "@/components/worker/WorkerNav";
import { useCompanyName } from "@/lib/org/context";

export default function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const companyName = useCompanyName();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header - clean, minimal */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-inset-top">
        <div className="flex h-14 items-center px-4">
          <h1 className="text-lg font-semibold truncate">
            {companyName || "HortiTrack Worker"}
          </h1>
        </div>
      </header>

      {/* Main Content - scrollable area with safe padding */}
      <main className="flex-1 overflow-auto pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* Bottom Navigation */}
      <WorkerNav />
    </div>
  );
}
