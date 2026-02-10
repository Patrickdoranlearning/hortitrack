import useSWR from "swr";
import { SWR_KEYS, onTrolleyMovement } from "@/lib/swr/keys";
import { logError } from "@/lib/log";

// ================================================
// TYPES
// ================================================

export type TrolleyBalance = {
  customerId: string;
  customerName: string;
  trolleysOut: number;
  shelvesOut: number;
  lastDeliveryDate: string | null;
  lastReturnDate: string | null;
  daysOutstanding: number | null;
};

export type TrolleyMovement = {
  id: string;
  date: string;
  type: "delivered" | "returned" | "not_returned" | "adjustment";
  customerId: string;
  customerName: string;
  trolleys: number;
  shelves: number;
  deliveryRunId: string | null;
  deliveryRunNumber: string | null;
  driverName: string | null;
  notes: string | null;
};

export type TrolleyReconciliation = {
  orderId: string;
  orderNumber: string;
  estimated: number | null;
  actual: number | null;
  variance: number | null;
  variancePercent: number | null;
};

// ================================================
// FETCHERS
// ================================================

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  return response.json();
};

// ================================================
// HOOKS
// ================================================

/**
 * Fetch trolley balance for a specific customer
 */
export function useTrolleyBalance(customerId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<{ balance: TrolleyBalance }>(
    customerId ? SWR_KEYS.trolleyBalance(customerId) : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  return {
    balance: data?.balance ?? null,
    isLoading,
    error,
    mutate,
    refresh: () => mutate(),
  };
}

/**
 * Fetch all customers with outstanding trolley balances
 */
export function useAllTrolleyBalances() {
  const { data, error, isLoading, mutate } = useSWR<{
    balances: TrolleyBalance[];
  }>(SWR_KEYS.TROLLEY_BALANCES, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });

  return {
    balances: data?.balances ?? [],
    isLoading,
    error,
    mutate,
    refresh: () => mutate(),
  };
}

/**
 * Fetch trolley movement history for a customer
 */
export function useTrolleyHistory(customerId: string | undefined, limit = 50) {
  const url = customerId
    ? `${SWR_KEYS.trolleyHistory(customerId)}&limit=${limit}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<{
    transactions: TrolleyMovement[];
  }>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });

  return {
    movements: data?.transactions ?? [],
    isLoading,
    error,
    mutate,
    refresh: () => mutate(),
  };
}

/**
 * Fetch trolley reconciliation data for an order
 */
export function useTrolleyReconciliation(orderId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<{
    reconciliation: TrolleyReconciliation;
  }>(orderId ? SWR_KEYS.trolleyReconciliation(orderId) : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });

  return {
    reconciliation: data?.reconciliation ?? null,
    isLoading,
    error,
    mutate,
    refresh: () => mutate(),
  };
}

// ================================================
// MUTATION HELPERS
// ================================================

export type RecordMovementInput = {
  type: "delivered" | "returned" | "not_returned" | "adjustment";
  customerId: string;
  trolleys: number;
  shelves?: number;
  notes?: string;
  deliveryRunId?: string;
};

/**
 * Record a new trolley movement
 */
export async function recordTrolleyMovement(
  input: RecordMovementInput
): Promise<{
  success: boolean;
  error?: string;
  updatedBalance?: TrolleyBalance;
}> {
  try {
    const response = await fetch(SWR_KEYS.TROLLEY_TRANSACTIONS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error || "Failed to record movement" };
    }

    const data = await response.json();

    // Invalidate caches to refresh all trolley-related data
    onTrolleyMovement();

    return {
      success: true,
      updatedBalance: data.updatedBalance
        ? {
            customerId: input.customerId,
            customerName: "",
            trolleysOut: data.updatedBalance.trolleysOut,
            shelvesOut: data.updatedBalance.shelvesOut,
            lastDeliveryDate: data.updatedBalance.lastDeliveryDate,
            lastReturnDate: data.updatedBalance.lastReturnDate,
            daysOutstanding: null,
          }
        : undefined,
    };
  } catch (error) {
    logError("Error recording trolley movement", { error });
    return { success: false, error: "Network error" };
  }
}

// ================================================
// UTILITY FUNCTIONS
// ================================================

/**
 * Check if a customer has overdue trolleys (>14 days outstanding)
 */
export function isOverdue(balance: TrolleyBalance | null): boolean {
  if (!balance || balance.trolleysOut === 0) return false;
  return (balance.daysOutstanding ?? 0) > 14;
}

/**
 * Format days outstanding for display
 */
export function formatDaysOutstanding(days: number | null): string {
  if (days === null) return "N/A";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

/**
 * Get variance status for reconciliation
 */
export function getVarianceStatus(
  reconciliation: TrolleyReconciliation | null
): "match" | "over" | "under" | "unknown" {
  if (!reconciliation) return "unknown";
  if (reconciliation.variance === null) return "unknown";
  if (reconciliation.variance === 0) return "match";
  if (reconciliation.variance > 0) return "over";
  return "under";
}
