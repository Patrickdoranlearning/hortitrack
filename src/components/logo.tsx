import { Sprout } from "lucide-react";
import { cn } from "@/lib/utils";

type LogoProps = {
  companyName?: string
  className?: string
}

export function Logo({ companyName = "Doran Nurseries", className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Sprout className="h-8 w-8 text-primary" />
      <div>
        <span className="block text-xl font-bold font-headline text-primary leading-tight">
          HortiTrack
        </span>
        <span className="block text-sm text-muted-foreground leading-tight truncate max-w-[220px]">
          {companyName}
        </span>
      </div>
    </div>
  );
}
