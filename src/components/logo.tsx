import { Sprout } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Sprout className="h-8 w-8 text-primary" />
      <div>
        <span className="block text-xl font-bold font-headline text-primary leading-tight">
          HortiTrack
        </span>
        <span className="block text-sm text-muted-foreground leading-tight">
            Doran Nurseries
        </span>
      </div>
    </div>
  );
}
