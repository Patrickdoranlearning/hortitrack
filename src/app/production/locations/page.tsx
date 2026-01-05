import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import LocationsClient from './LocationsClient';

export const metadata = {
  title: 'Locations | Production',
  description: 'View and manage nursery locations and their contents',
};

export default function LocationsPage() {
  return (
    <Suspense fallback={<LocationsPageSkeleton />}>
      <LocationsClient />
    </Suspense>
  );
}

function LocationsPageSkeleton() {
  return (
    <div className="min-h-dvh">
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}





