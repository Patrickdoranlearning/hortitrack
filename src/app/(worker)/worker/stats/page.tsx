"use client";

import { BarChart3 } from "lucide-react";

export default function WorkerStatsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <BarChart3 className="h-16 w-16 text-muted-foreground/50 mb-4" />
      <h2 className="text-lg font-semibold mb-2">Your Stats</h2>
      <p className="text-muted-foreground text-sm max-w-xs">
        Track your productivity and performance metrics. Coming soon.
      </p>
    </div>
  );
}
