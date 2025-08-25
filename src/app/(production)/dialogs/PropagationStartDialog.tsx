"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, Plus } from "lucide-react";
import { PropagationStartDialog } from "@/components/dialogs/PropagationStartDialog";
import { BatchCheckInDialog } from "@/components/dialogs/BatchCheckInDialog";

export function NewBatchButton() {
  const [mode, setMode] = React.useState<"prop"|"checkin"|null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
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
    </>
  );
}