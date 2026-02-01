'use client';

/**
 * Offline Action Queue for Worker App
 *
 * Stores task actions (start, complete) when offline and syncs
 * them when the connection is restored.
 */

// =============================================================================
// TYPES
// =============================================================================

export type PendingActionType = 'start_task' | 'complete_task';

export interface StartTaskPayload {
  /** Optional notes when starting */
  notes?: string;
}

export interface CompleteTaskPayload {
  /** Actual plant count when completing */
  plantCount?: number;
  /** Completion notes */
  notes?: string;
}

export type PendingActionPayload = StartTaskPayload | CompleteTaskPayload;

export interface PendingAction {
  id: string;
  type: PendingActionType;
  taskId: string;
  payload: PendingActionPayload;
  createdAt: string;
  retryCount: number;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: Array<{ actionId: string; error: string }>;
}

// =============================================================================
// STORAGE
// =============================================================================

const STORAGE_KEY = 'hortitrack-worker-action-queue';
const MAX_RETRIES = 3;
const QUEUE_CLEANUP_DAYS = 7;

/**
 * Check if localStorage is available (handles SSR and private browsing)
 */
function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a unique ID for actions
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// =============================================================================
// QUEUE OPERATIONS
// =============================================================================

/**
 * Get all pending actions from the queue
 */
export function getPendingActions(): PendingAction[] {
  if (!isStorageAvailable()) return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const actions = JSON.parse(stored) as PendingAction[];

    // Filter out actions older than cleanup period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - QUEUE_CLEANUP_DAYS);
    const cutoffTime = cutoffDate.getTime();

    return actions.filter(action => {
      const actionTime = new Date(action.createdAt).getTime();
      return actionTime > cutoffTime;
    });
  } catch {
    return [];
  }
}

/**
 * Save the action queue to storage
 */
function saveActions(actions: PendingAction[]): void {
  if (!isStorageAvailable()) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  } catch (error) {
    // Storage quota exceeded or other error - log but don't throw
    console.warn('[task-queue] Failed to save actions:', error);
  }
}

/**
 * Queue a new action to be synced later
 */
export function queueAction(
  action: Omit<PendingAction, 'id' | 'createdAt' | 'retryCount'>
): PendingAction {
  const newAction: PendingAction = {
    ...action,
    id: generateId(),
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  const actions = getPendingActions();

  // Check for duplicate - don't queue same action for same task
  const existingIndex = actions.findIndex(
    a => a.taskId === action.taskId && a.type === action.type
  );

  if (existingIndex >= 0) {
    // Replace existing action with newer one
    actions[existingIndex] = newAction;
  } else {
    actions.push(newAction);
  }

  saveActions(actions);

  return newAction;
}

/**
 * Remove a single action from the queue
 */
export function removeAction(id: string): void {
  const actions = getPendingActions();
  const filtered = actions.filter(a => a.id !== id);
  saveActions(filtered);
}

/**
 * Clear all actions from the queue
 */
export function clearQueue(): void {
  if (!isStorageAvailable()) return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get the count of pending actions
 */
export function getPendingCount(): number {
  return getPendingActions().length;
}

/**
 * Increment retry count for an action
 */
function incrementRetryCount(id: string): boolean {
  const actions = getPendingActions();
  const action = actions.find(a => a.id === id);

  if (!action) return false;

  action.retryCount += 1;

  if (action.retryCount >= MAX_RETRIES) {
    // Remove action after max retries
    saveActions(actions.filter(a => a.id !== id));
    return false;
  }

  saveActions(actions);
  return true;
}

// =============================================================================
// SYNC OPERATIONS
// =============================================================================

/**
 * Execute a single action against the server
 */
async function executeAction(action: PendingAction): Promise<{ success: boolean; error?: string }> {
  try {
    let endpoint: string;
    let body: Record<string, unknown> | undefined;

    switch (action.type) {
      case 'start_task':
        endpoint = `/api/tasks/${action.taskId}/start`;
        body = (action.payload as StartTaskPayload).notes
          ? { notes: (action.payload as StartTaskPayload).notes }
          : undefined;
        break;
      case 'complete_task': {
        endpoint = `/api/tasks/${action.taskId}/complete`;
        const completePayload = action.payload as CompleteTaskPayload;
        body = {};
        if (completePayload.plantCount !== undefined) {
          body.actualPlantQuantity = completePayload.plantCount;
        }
        if (completePayload.notes) {
          body.notes = completePayload.notes;
        }
        if (Object.keys(body).length === 0) {
          body = undefined;
        }
        break;
      }
      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const errorMsg = data.error || `HTTP ${response.status}`;

      // Don't retry on 4xx errors (client errors like 404, 403)
      if (response.status >= 400 && response.status < 500) {
        return { success: false, error: `${errorMsg} (not retryable)` };
      }

      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Network error';
    return { success: false, error: errorMsg };
  }
}

/**
 * Sync all pending actions with the server
 * Returns a summary of the sync operation
 */
export async function syncPendingActions(): Promise<SyncResult> {
  const actions = getPendingActions();

  if (actions.length === 0) {
    return {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  const result: SyncResult = {
    success: true,
    syncedCount: 0,
    failedCount: 0,
    errors: [],
  };

  // Process actions sequentially to maintain order
  for (const action of actions) {
    const { success, error } = await executeAction(action);

    if (success) {
      removeAction(action.id);
      result.syncedCount += 1;
    } else {
      // Check if we should retry
      const shouldKeep = incrementRetryCount(action.id);

      if (!shouldKeep) {
        // Action exceeded max retries, count as failed
        result.failedCount += 1;
        result.errors.push({
          actionId: action.id,
          error: `${error} (max retries exceeded)`,
        });
      } else {
        // Action will be retried next sync
        result.failedCount += 1;
        result.errors.push({
          actionId: action.id,
          error: error || 'Unknown error',
        });
      }

      result.success = false;
    }
  }

  return result;
}

// =============================================================================
// OPTIMISTIC STATE HELPERS
// =============================================================================

/**
 * Check if a task has a pending start action
 */
export function hasPendingStart(taskId: string): boolean {
  const actions = getPendingActions();
  return actions.some(a => a.taskId === taskId && a.type === 'start_task');
}

/**
 * Check if a task has a pending complete action
 */
export function hasPendingComplete(taskId: string): boolean {
  const actions = getPendingActions();
  return actions.some(a => a.taskId === taskId && a.type === 'complete_task');
}

/**
 * Get the pending action for a task if one exists
 */
export function getPendingActionForTask(taskId: string): PendingAction | undefined {
  const actions = getPendingActions();
  // Return the most recent action for this task
  return [...actions]
    .reverse()
    .find(a => a.taskId === taskId);
}
