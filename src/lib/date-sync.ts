/**
 * Client-side date synchronization utility
 *
 * Prevents hydration mismatches when pre-filling date inputs by ensuring
 * date values are only computed on the client after hydration completes.
 *
 * Problem: When server-side rendering a page at 11:59 PM and the client
 * hydrates at 12:01 AM, `new Date()` produces different values causing
 * React hydration warnings.
 *
 * Solution: Use a stable placeholder during SSR/initial render, then
 * synchronize to the actual client date after hydration.
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";

/**
 * Format a Date object as YYYY-MM-DD string (ISO date format)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Get today's date as YYYY-MM-DD string
 */
export function getTodayISO(): string {
  return formatDateISO(new Date());
}

/**
 * Add days to a date string and return as YYYY-MM-DD
 */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return formatDateISO(date);
}

// External store for tracking hydration state
let isHydrated = false;
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): boolean {
  return isHydrated;
}

function getServerSnapshot(): boolean {
  return false;
}

// Mark as hydrated after first client render
if (typeof window !== "undefined") {
  // Use requestIdleCallback or setTimeout to mark hydration complete
  // after React has finished its initial reconciliation
  const markHydrated = () => {
    if (!isHydrated) {
      isHydrated = true;
      listeners.forEach((listener) => listener());
    }
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(markHydrated);
  } else {
    setTimeout(markHydrated, 0);
  }
}

/**
 * Hook to check if hydration is complete
 *
 * Returns false during SSR and initial render, true after hydration.
 * Use this to conditionally render date-dependent content.
 *
 * @example
 * const isHydrated = useIsHydrated();
 * const displayDate = isHydrated ? getTodayISO() : '';
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Hook for getting today's date with hydration safety
 *
 * Returns an empty string during SSR, then updates to today's date
 * after hydration. This prevents hydration mismatches in date inputs.
 *
 * @param fallback - Optional fallback value to use during SSR (default: "")
 * @returns Today's date as YYYY-MM-DD after hydration, fallback during SSR
 *
 * @example
 * const today = useTodayDate();
 * <input type="date" defaultValue={today} />
 */
export function useTodayDate(fallback: string = ""): string {
  const [date, setDate] = useState(fallback);

  useEffect(() => {
    setDate(getTodayISO());
  }, []);

  return date;
}

/**
 * Hook for syncing a date value that may need client-side initialization
 *
 * If initialValue is provided, uses that. Otherwise, uses today's date
 * after hydration. Useful for form fields that should default to today
 * but can also accept a pre-existing value.
 *
 * @param initialValue - Optional initial date value (YYYY-MM-DD format)
 * @returns The synchronized date value
 *
 * @example
 * const plantedAt = useSyncedDate(batch?.planted_at);
 * // Returns batch.planted_at if provided, otherwise today's date after hydration
 */
export function useSyncedDate(initialValue?: string | null): string {
  const [date, setDate] = useState(initialValue ?? "");

  useEffect(() => {
    if (!initialValue) {
      setDate(getTodayISO());
    }
  }, [initialValue]);

  return date;
}

/**
 * Hook for form default values with date synchronization
 *
 * Returns a function that provides form default values, ensuring date
 * fields are properly synchronized after hydration.
 *
 * @param dateFields - Array of field names that should default to today
 * @param otherDefaults - Other default values for the form
 * @returns Object with defaults and a reset function
 *
 * @example
 * const { defaults, getResetValues } = useFormDateDefaults(
 *   ['planted_at', 'started_at'],
 *   { quantity: 1, notes: '' }
 * );
 *
 * const form = useForm({ defaultValues: defaults });
 *
 * // When resetting the form:
 * form.reset(getResetValues());
 */
export function useFormDateDefaults<T extends Record<string, unknown>>(
  dateFields: string[],
  otherDefaults: T
): {
  defaults: T;
  getResetValues: () => T;
} {
  const isHydrated = useIsHydrated();

  const getDateDefaults = useCallback(() => {
    const today = getTodayISO();
    const dateDefaults: Record<string, string> = {};
    for (const field of dateFields) {
      dateDefaults[field] = today;
    }
    return dateDefaults;
  }, [dateFields]);

  const defaults = {
    ...otherDefaults,
    ...(isHydrated ? getDateDefaults() : {}),
  } as T;

  const getResetValues = useCallback(() => {
    return {
      ...otherDefaults,
      ...getDateDefaults(),
    } as T;
  }, [otherDefaults, getDateDefaults]);

  return { defaults, getResetValues };
}

/**
 * Hook for managing date state in forms with hydration safety
 *
 * Provides a date value and setter that handles hydration correctly.
 * The initial value is empty during SSR, then populated with either
 * the provided value or today's date after hydration.
 *
 * @param initialValue - Optional initial date (from props/API)
 * @param defaultToToday - Whether to default to today if no initial value
 * @returns Tuple of [dateValue, setDateValue]
 *
 * @example
 * const [date, setDate] = useDateState(order?.delivery_date, true);
 * <input type="date" value={date} onChange={e => setDate(e.target.value)} />
 */
export function useDateState(
  initialValue?: string | null,
  defaultToToday: boolean = true
): [string, React.Dispatch<React.SetStateAction<string>>] {
  const [date, setDate] = useState("");

  useEffect(() => {
    if (initialValue) {
      setDate(initialValue);
    } else if (defaultToToday) {
      setDate(getTodayISO());
    }
  }, [initialValue, defaultToToday]);

  return [date, setDate];
}

/**
 * Get a stable date string for SSR that can be overridden on client
 *
 * For cases where you need to pass a date to a component that expects
 * a value immediately (like react-hook-form defaultValues), this returns
 * an empty string during SSR to prevent hydration issues.
 *
 * The component should then use useTodayDate() or useEffect to set
 * the actual value after hydration.
 *
 * @example
 * // In a Server Component or during SSR
 * const defaultDate = getSSRSafeDate(existingDate);
 *
 * // In the form
 * const form = useForm({
 *   defaultValues: {
 *     date: defaultDate || '', // Empty during SSR
 *   }
 * });
 *
 * // Update after hydration
 * const today = useTodayDate();
 * useEffect(() => {
 *   if (!existingDate && today) {
 *     form.setValue('date', today);
 *   }
 * }, [today, existingDate]);
 */
export function getSSRSafeDate(existingValue?: string | null): string {
  return existingValue ?? "";
}
