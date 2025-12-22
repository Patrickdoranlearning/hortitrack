"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sprout } from "lucide-react";
import { cn } from "@/lib/utils";

export function TransplantMenuButton({ className }: { className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={cn("w-full sm:w-auto", className)}>
          <Sprout className="mr-2 h-4 w-4" />
          Transplant
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href="/production/batches/new/bulk-transplant">Bulk transplant</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/production/batches/new/multi-transplant">Multi-parent transplant</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}




