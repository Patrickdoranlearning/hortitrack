// src/ui/layout/ModulePageHeader.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  actionsSlot?: React.ReactNode;
  className?: string;
};

/**
 * ModulePageHeader Template
 * 
 * A header component for the top of a module page.
 * Displays a large title, an optional description, and an actions slot (e.g., for buttons).
 */
export function ModulePageHeader({ title, description, actionsSlot, className }: Props) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="font-headline text-3xl sm:text-4xl truncate">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actionsSlot && (
        <div className="flex w-full sm:w-auto flex-col sm:flex-row items-start sm:items-center gap-2">
          {actionsSlot}
        </div>
      )}
    </div>
  );
}
