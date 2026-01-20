'use client';

import { useMutationListener } from '@/hooks/useMutationListener';

/**
 * Provider component that enables automatic SWR cache invalidation
 * after server action mutations throughout the app.
 *
 * Add this to your root layout to enable the mutation event system.
 */
export function MutationProvider({ children }: { children: React.ReactNode }) {
  useMutationListener();
  return <>{children}</>;
}
