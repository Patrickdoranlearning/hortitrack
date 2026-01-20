'use client';

import { useEffect } from 'react';
import {
  subscribeMutations,
  handleMutationEvent,
  type MutationPayload,
} from '@/lib/events/mutation-events';

/**
 * Hook that listens for mutation events and invalidates SWR caches
 * Use this at the app level (in MutationProvider) for global coverage
 */
export function useMutationListener(): void {
  useEffect(() => {
    const unsubscribe = subscribeMutations((payload: MutationPayload) => {
      handleMutationEvent(payload);
    });

    return unsubscribe;
  }, []);
}
