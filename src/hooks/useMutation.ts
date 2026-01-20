'use client';

import { useState, useCallback, useTransition } from 'react';
import { emitMutation, type MutationPayload } from '@/lib/events/mutation-events';

// =============================================================================
// Types
// =============================================================================

export type MutationResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  _mutated?: MutationPayload;
};

export type UseMutationOptions<T> = {
  onSuccess?: (data: T | undefined) => void;
  onError?: (error: string) => void;
  onSettled?: () => void;
};

export type UseMutationReturn<TInput, TOutput> = {
  mutate: (input: TInput) => Promise<MutationResult<TOutput>>;
  mutateAsync: (input: TInput) => Promise<MutationResult<TOutput>>;
  isLoading: boolean;
  isPending: boolean;
  error: string | null;
  reset: () => void;
};

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for executing server actions with automatic SWR cache invalidation
 *
 * @example
 * const { mutate, isLoading, error } = useMutation(upsertCustomerAction, {
 *   onSuccess: () => toast.success('Customer saved'),
 *   onError: (err) => toast.error(err),
 * });
 *
 * // In form submit:
 * await mutate({ name: 'John', email: 'john@example.com' });
 */
export function useMutation<TInput, TOutput>(
  action: (input: TInput) => Promise<MutationResult<TOutput>>,
  options?: UseMutationOptions<TOutput>
): UseMutationReturn<TInput, TOutput> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = useCallback(() => {
    setError(null);
  }, []);

  const executeMutation = useCallback(
    async (input: TInput): Promise<MutationResult<TOutput>> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await action(input);

        if (result.success) {
          // Emit mutation event for SWR cache invalidation
          if (result._mutated) {
            emitMutation(result._mutated);
          }
          options?.onSuccess?.(result.data);
        } else {
          const errorMsg = result.error || 'An error occurred';
          setError(errorMsg);
          options?.onError?.(errorMsg);
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(errorMsg);
        options?.onError?.(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
        options?.onSettled?.();
      }
    },
    [action, options]
  );

  const mutate = useCallback(
    (input: TInput): Promise<MutationResult<TOutput>> => {
      return new Promise((resolve) => {
        startTransition(async () => {
          const result = await executeMutation(input);
          resolve(result);
        });
      });
    },
    [executeMutation]
  );

  return {
    mutate,
    mutateAsync: executeMutation,
    isLoading: isLoading || isPending,
    isPending,
    error,
    reset,
  };
}

// =============================================================================
// Convenience Wrapper for Simple Cases
// =============================================================================

/**
 * Execute a server action and emit mutation event in one call
 * Use this for simple cases where you don't need the full useMutation hook
 *
 * @example
 * const result = await executeWithMutation(deleteCustomerAction, customerId);
 * if (result.success) {
 *   toast.success('Deleted');
 * }
 */
export async function executeWithMutation<TInput, TOutput>(
  action: (input: TInput) => Promise<MutationResult<TOutput>>,
  input: TInput
): Promise<MutationResult<TOutput>> {
  try {
    const result = await action(input);

    if (result.success && result._mutated) {
      emitMutation(result._mutated);
    }

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
    return { success: false, error: errorMsg };
  }
}
