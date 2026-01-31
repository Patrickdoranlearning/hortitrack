"use client";

import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function WorkerTaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;

  return (
    <div className="px-4 py-4">
      {/* Back Navigation */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="min-h-[44px] -ml-2">
          <Link href="/worker">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tasks
          </Link>
        </Button>
      </div>

      {/* Placeholder Content */}
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <ClipboardList className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Task Details</h2>
        <p className="text-muted-foreground text-sm max-w-xs mb-4">
          Task execution interface coming in Phase 2.
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          Task ID: {taskId}
        </p>
      </div>
    </div>
  );
}
