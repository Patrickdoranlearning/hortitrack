'use client';

import { mutate } from 'swr';
import { SWR_KEYS } from '@/lib/swr/keys';

// =============================================================================
// Types
// =============================================================================

export type MutationResource =
  | 'customers'
  | 'orders'
  | 'invoices'
  | 'products'
  | 'batches'
  | 'locations'
  | 'varieties'
  | 'sizes'
  | 'suppliers'
  | 'materials'
  | 'guide-plans'
  | 'batch-plans'
  | 'trolleys'
  | 'reference-data';

export type MutationAction = 'create' | 'update' | 'delete';

export type MutationPayload = {
  resource: MutationResource;
  action: MutationAction;
  id?: string;
  relatedResources?: MutationResource[];
};

// =============================================================================
// Resource to SWR Key Mapping
// =============================================================================

const RESOURCE_INVALIDATORS: Record<MutationResource, () => void> = {
  customers: () => {
    mutate((key) => typeof key === 'string' && key.includes('/customers'), undefined, { revalidate: true });
    mutate((key) => typeof key === 'string' && key.includes('customers'), undefined, { revalidate: true });
  },
  orders: () => {
    mutate((key) => typeof key === 'string' && key.includes('/orders'), undefined, { revalidate: true });
    mutate((key) => typeof key === 'string' && key.includes('/dispatch'), undefined, { revalidate: true });
    mutate((key) => typeof key === 'string' && key.includes('/picking'), undefined, { revalidate: true });
  },
  invoices: () => {
    mutate((key) => typeof key === 'string' && key.includes('/invoices'), undefined, { revalidate: true });
  },
  products: () => {
    mutate((key) => typeof key === 'string' && key.includes('/products'), undefined, { revalidate: true });
    mutate((key) => typeof key === 'string' && key.includes('products'), undefined, { revalidate: true });
  },
  batches: () => {
    mutate((key) => typeof key === 'string' && key.includes('/batches'), undefined, { revalidate: true });
    mutate((key) => typeof key === 'string' && key.includes('batches'), undefined, { revalidate: true });
    mutate(SWR_KEYS.BATCHES, undefined, { revalidate: true });
    mutate(SWR_KEYS.PLANNED_BATCHES, undefined, { revalidate: true });
  },
  locations: () => {
    mutate((key) => typeof key === 'string' && key.includes('locations'), undefined, { revalidate: true });
    mutate(SWR_KEYS.REFERENCE_DATA, undefined, { revalidate: true });
  },
  varieties: () => {
    mutate((key) => typeof key === 'string' && key.includes('varieties'), undefined, { revalidate: true });
    mutate(SWR_KEYS.REFERENCE_DATA, undefined, { revalidate: true });
  },
  sizes: () => {
    mutate((key) => typeof key === 'string' && key.includes('sizes'), undefined, { revalidate: true });
    mutate(SWR_KEYS.REFERENCE_DATA, undefined, { revalidate: true });
  },
  suppliers: () => {
    mutate((key) => typeof key === 'string' && key.includes('suppliers'), undefined, { revalidate: true });
    mutate(SWR_KEYS.REFERENCE_DATA, undefined, { revalidate: true });
  },
  materials: () => {
    mutate((key) => typeof key === 'string' && key.includes('/materials'), undefined, { revalidate: true });
    mutate(SWR_KEYS.MATERIALS, undefined, { revalidate: true });
    mutate(SWR_KEYS.MATERIAL_STOCK, undefined, { revalidate: true });
  },
  'guide-plans': () => {
    mutate((key) => typeof key === 'string' && key.includes('/guide-plans'), undefined, { revalidate: true });
    mutate(SWR_KEYS.GUIDE_PLANS, undefined, { revalidate: true });
  },
  'batch-plans': () => {
    mutate((key) => typeof key === 'string' && key.includes('/batch-plans'), undefined, { revalidate: true });
    mutate(SWR_KEYS.BATCH_PLANS, undefined, { revalidate: true });
  },
  trolleys: () => {
    mutate((key) => typeof key === 'string' && key.includes('/trolleys'), undefined, { revalidate: true });
    mutate(SWR_KEYS.TROLLEY_BALANCES, undefined, { revalidate: true });
    mutate(SWR_KEYS.TROLLEY_TRANSACTIONS, undefined, { revalidate: true });
  },
  'reference-data': () => {
    mutate(SWR_KEYS.REFERENCE_DATA, undefined, { revalidate: true });
  },
};

// =============================================================================
// Event System
// =============================================================================

const MUTATION_EVENT = 'hortitrack:mutation';

/**
 * Emit a mutation event to trigger SWR cache invalidation
 * Call this after a successful server action
 */
export function emitMutation(payload: MutationPayload): void {
  if (typeof window === 'undefined') return;

  const event = new CustomEvent(MUTATION_EVENT, { detail: payload });
  window.dispatchEvent(event);
}

/**
 * Invalidate SWR caches for a specific resource
 */
export function invalidateResource(resource: MutationResource): void {
  const invalidator = RESOURCE_INVALIDATORS[resource];
  if (invalidator) {
    invalidator();
  }
}

/**
 * Handle a mutation event by invalidating all relevant caches
 */
export function handleMutationEvent(payload: MutationPayload): void {
  // Invalidate primary resource
  invalidateResource(payload.resource);

  // Invalidate related resources
  if (payload.relatedResources) {
    for (const related of payload.relatedResources) {
      invalidateResource(related);
    }
  }
}

/**
 * Subscribe to mutation events
 * Returns an unsubscribe function
 */
export function subscribeMutations(
  callback: (payload: MutationPayload) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<MutationPayload>;
    callback(customEvent.detail);
  };

  window.addEventListener(MUTATION_EVENT, handler);
  return () => window.removeEventListener(MUTATION_EVENT, handler);
}
