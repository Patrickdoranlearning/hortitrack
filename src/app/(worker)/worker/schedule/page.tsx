"use client";

import { Calendar } from "lucide-react";

export default function WorkerSchedulePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <Calendar className="h-16 w-16 text-muted-foreground/50 mb-4" />
      <h2 className="text-lg font-semibold mb-2">Schedule</h2>
      <p className="text-muted-foreground text-sm max-w-xs">
        View your upcoming tasks and schedule. Coming soon.
      </p>
    </div>
  );
}
