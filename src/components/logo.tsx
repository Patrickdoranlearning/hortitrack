import { Sprout } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Sprout className="h-8 w-8 text-primary" />
      <span className="text-xl font-bold font-headline text-primary">
        Verdant Vista
      </span>
    </div>
  );
}
