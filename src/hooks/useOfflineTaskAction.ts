'use client';

import { useState, useCallback } from 'react';
import { useWorkerOffline } from '@/offline/WorkerOfflineProvider';
import { queueAction, type PendingActionType } from '@/offline/task-queue';
import { vibrateSuccess, vibrateError, vibrateTap } from '@/lib/haptics';

// =============================================================================
// TYPES
// =============================================================================

interface UseOfflineTaskActionOptions {
  /** Whether to use haptic feedback */
  haptics?: boolean;
  /** Callback on successful action */
  onSuccess?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

interface TaskActionResult {
  success: boolean;
  error?: string;
  isQueued?: boolean;
}

interface UseOfflineTaskActionReturn {
  /** Start a task with offline fallback */
  startTask: (taskId: string, notes?: string) => Promise<TaskActionResult>;
  /** Complete a task with offline fallback */
  completeTask: (taskId: string, plantCount?: number, notes?: string) => Promise<TaskActionResult>;
  /** Whether an action is currently in progress */
  loading: boolean;
  /** Current error message if any */
  error: string | null;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for performing task actions with offline support.
 * Actions are queued when offline and synced when connection is restored.
 */
export function useOfflineTaskAction(
  options: UseOfflineTaskActionOptions = {}
): UseOfflineTaskActionReturn {
  const { haptics = true, onSuccess, onError } = options;
  const { isOnline, refreshTasks } = useWorkerOffline();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Execute an action online or queue for offline sync
   */
  const executeAction = useCallback(async (
    taskId: string,
    actionType: PendingActionType,
    payload: Record<string, unknown>
  ): Promise<TaskActionResult> => {
    setLoading(true);
    setError(null);

    if (haptics) {
      vibrateTap();
    }

    try {
      if (!isOnline) {
        // Queue action for later sync
        queueAction({
          type: actionType,
          taskId,
          payload,
        });

        if (haptics) {
          vibrateSuccess();
        }

        onSuccess?.();

        return {
          success: true,
          isQueued: true,
        };
      }

      // Build the request based on action type
      let endpoint: string;
      let body: Record<string, unknown> | undefined;

      switch (actionType) {
        case 'start_task':
          endpoint = `/api/tasks/${taskId}/start`;
          body = payload.notes ? { notes: payload.notes } : undefined;
          break;
        case 'complete_task':
          endpoint = `/api/tasks/${taskId}/complete`;
          body = {};
          if (payload.plantCount !== undefined) {
            body.actualPlantQuantity = payload.plantCount;
          }
          if (payload.notes) {
            body.notes = payload.notes;
          }
          if (Object.keys(body).length === 0) {
            body = undefined;
          }
          break;
        default:
          throw new Error(`Unknown action type: ${actionType}`);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const errorMsg = data.error || `HTTP ${response.status}`;
        throw new Error(errorMsg);
      }

      // Refresh tasks to get updated state
      await refreshTasks();

      if (haptics) {
        vibrateSuccess();
      }

      onSuccess?.();

      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Action failed';
      setError(errorMsg);

      if (haptics) {
        vibrateError();
      }

      onError?.(errorMsg);

      // If we failed due to network error, queue for offline
      if (!isOnline || errorMsg.toLowerCase().includes('network') || errorMsg.toLowerCase().includes('fetch')) {
        queueAction({
          type: actionType,
          taskId,
          payload,
        });

        return {
          success: true,
          isQueued: true,
        };
      }

      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      setLoading(false);
    }
  }, [isOnline, haptics, refreshTasks, onSuccess, onError]);

  /**
   * Start a task
   */
  const startTask = useCallback(async (
    taskId: string,
    notes?: string
  ): Promise<TaskActionResult> => {
    return executeAction(taskId, 'start_task', { notes });
  }, [executeAction]);

  /**
   * Complete a task
   */
  const completeTask = useCallback(async (
    taskId: string,
    plantCount?: number,
    notes?: string
  ): Promise<TaskActionResult> => {
    return executeAction(taskId, 'complete_task', { plantCount, notes });
  }, [executeAction]);

  return {
    startTask,
    completeTask,
    loading,
    error,
  };
}
