'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type DataPageShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
  backHref?: string;
  heroActions?: React.ReactNode;
};

export function DataPageShell({
  title,
  description,
  children,
  toolbar,
  className,
  backHref = '/settings',
  heroActions,
}: DataPageShellProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl">{title}</h1>
          {description ? (
            <p className="text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {heroActions}
          <Button asChild variant="outline">
            <Link href={backHref}>Back to Data Management</Link>
          </Button>
        </div>
      </div>

      {toolbar}

      {children}
    </div>
  );
}

