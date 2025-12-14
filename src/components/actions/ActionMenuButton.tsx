"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Batch } from "@/lib/types";
import type { ActionMode } from "@/components/actions/types";

type Props = {
  batch: Batch;
  onSelect: (mode: ActionMode, batch: Batch) => void;
  disabled?: boolean;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  label?: string;
  hideLabelOnMobile?: boolean;
};

export function ActionMenuButton({
  batch,
  onSelect,
  disabled,
  variant = "outline",
  size,
  className,
  label = "Log Action",
  hideLabelOnMobile = false,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled} className={className}>
          <ClipboardList className="mr-2 h-4 w-4" />
          <span className={cn(hideLabelOnMobile && "hidden sm:inline")}>{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onSelect("MOVE", batch)}>Move batch</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect("DUMP", batch)}>Log dump</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

