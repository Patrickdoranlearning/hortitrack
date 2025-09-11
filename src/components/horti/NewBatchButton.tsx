
"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import { PropagationStartDialog } from "@/components/dialogs/PropagationStartDialog";
import { BatchCheckInDialog } from "@/components/dialogs/BatchCheckInDialog";
import { cn } from "@/lib/utils";

export function NewBatchButton({ className }: { className?: string }) {
  const [mode, setMode] = React.useState<"prop" | "checkin" | null>(null);
  return (
    <div className={cn("w-full sm:w-auto", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            New Batch
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setMode("prop")}>Propagation</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMode("checkin")}>Check-In</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PropagationStartDialog open={mode === "prop"} onOpenChange={(o) => !o && setMode(null)} />
      <BatchCheckInDialog open={mode === "checkin"} onOpenChange={(o) => !o && setMode(null)} />
    </div>
  );
}
