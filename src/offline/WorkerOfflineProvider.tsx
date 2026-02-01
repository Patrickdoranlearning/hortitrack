'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import type { WorkerTask, TaskStats } from '@/lib/types/worker-tasks';
import {
  syncPendingActions,
  getPendingCount,
  hasPendingStart,
  hasPendingComplete,
  type SyncResult,
} from './task-queue';

// =============================================================================
// TYPES
// =============================================================================

export type ConnectionStatus = 'online' | 'offline' | 'syncing';

export interface WorkerOfflineContextValue {
  /** Current connection status */
  status: ConnectionStatus;
  /** Whether the device is currently online */
  isOnline: boolean;
  /** Tasks from cache or server */
  tasks: WorkerTask[];
  /** Task statistics */
  stats: TaskStats;
  /** Whether initial load is in progress */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Timestamp of last successful sync */
  lastSyncedAt: Date | null;
  /** Number of pending offline actions */
  pendingActionCount: number;
  /** Force refresh tasks from server */
  refreshTasks: (date?: string) => Promise<void>;
  /** Sync any pending offline actions */
  syncNow: () => Promise<SyncResult>;
  /** Get task with optimistic state applied */
  getTaskWithOptimisticState: (task: WorkerTask) => WorkerTask;
}

const defaultStats: TaskStats = {
  pending: 0,
  inProgress: 0,
  completedToday: 0,
};

const WorkerOfflineContext = createContext<WorkerOfflineContextValue>({
  status: 'online',
  isOnline: true,
  tasks: [],
  stats: defaultStats,
  loading: true,
  error: null,
  lastSyncedAt: null,
  pendingActionCount: 0,
  refreshTasks: async () => {},
  syncNow: async () => ({ success: true, syncedCount: 0, failedCount: 0, errors: [] }),
  getTaskWithOptimisticState: (task) => task,
});

// =============================================================================
// STORAGE HELPERS
// =============================================================================

const TASK_CACHE_KEY = 'hortitrack-worker-tasks-cache';
const STATS_CACHE_KEY = 'hortitrack-worker-stats-cache';
const LAST_SYNC_KEY = 'hortitrack-worker-last-sync';

interface CachedData<T> {
  data: T;
  cachedAt: string;
  date?: string;
}

function getCachedTasks(): CachedData<WorkerTask[]> | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(TASK_CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function setCachedTasks(tasks: WorkerTask[], date?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cacheData: CachedData<WorkerTask[]> = {
      data: tasks,
      cachedAt: new Date().toISOString(),
      date,
    };
    localStorage.setItem(TASK_CACHE_KEY, JSON.stringify(cacheData));
  } catch {
    // Ignore storage errors
  }
}

function getCachedStats(): CachedData<TaskStats> | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(STATS_CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function setCachedStats(stats: TaskStats): void {
  if (typeof window === 'undefined') return;
  try {
    const cacheData: CachedData<TaskStats> = {
      data: stats,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(cacheData));
  } catch {
    // Ignore storage errors
  }
}

function getLastSyncTime(): Date | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(LAST_SYNC_KEY);
    return stored ? new Date(stored) : null;
  } catch {
    return null;
  }
}

function setLastSyncTime(date: Date): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_SYNC_KEY, date.toISOString());
  } catch {
    // Ignore storage errors
  }
}

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

interface WorkerOfflineProviderProps {
  children: React.ReactNode;
  /** Polling interval for background sync in ms (default: 30000) */
  syncInterval?: number;
}

export function WorkerOfflineProvider({
  children,
  syncInterval = 30000,
}: WorkerOfflineProviderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tasks, setTasks] = useState<WorkerTask[]>([]);
  const [stats, setStats] = useState<TaskStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [pendingActionCount, setPendingActionCount] = useState(0);

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Initialize online status and load cached data
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Set initial online status
    setIsOnline(navigator.onLine);
    setLastSyncedAt(getLastSyncTime());

    // Load cached tasks if available
    const cachedTasks = getCachedTasks();
    if (cachedTasks?.data) {
      setTasks(cachedTasks.data);
    }

    const cachedStats = getCachedStats();
    if (cachedStats?.data) {
      setStats(cachedStats.data);
    }

    // Update pending count
    setPendingActionCount(getPendingCount());

    // Set loading to false if we have cached data
    if (cachedTasks?.data) {
      setLoading(false);
    }

    // Online/offline event handlers
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      isMountedRef.current = false;
    };
  }, []);

  // Fetch tasks from server
  const fetchTasks = useCallback(async (date?: string) => {
    const url = date ? `/api/worker/my-tasks?date=${date}` : '/api/worker/my-tasks';

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!isMountedRef.current) return;

      setTasks(data.tasks || []);
      setStats(data.stats || defaultStats);
      setError(null);
      setLastSyncedAt(new Date());

      // Cache the data
      setCachedTasks(data.tasks || [], date);
      setCachedStats(data.stats || defaultStats);
      setLastSyncTime(new Date());

      return data;
    } catch (err) {
      if (!isMountedRef.current) return;

      const message = err instanceof Error ? err.message : 'Failed to fetch tasks';

      // Only set error if we don't have cached data
      if (tasks.length === 0) {
        setError(message);
      }

      throw err;
    }
  }, [tasks.length]);

  // Refresh tasks - public method
  const refreshTasks = useCallback(async (date?: string) => {
    if (!isOnline) {
      // Return cached data when offline
      const cached = getCachedTasks();
      if (cached?.data) {
        setTasks(cached.data);
      }
      return;
    }

    setLoading(true);
    try {
      await fetchTasks(date);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [isOnline, fetchTasks]);

  // Sync pending actions
  const syncNow = useCallback(async (): Promise<SyncResult> => {
    if (!isOnline) {
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errors: [{ actionId: 'all', error: 'Device is offline' }],
      };
    }

    setIsSyncing(true);

    try {
      const result = await syncPendingActions();

      if (isMountedRef.current) {
        setPendingActionCount(getPendingCount());

        // Refresh tasks after sync to get updated state
        if (result.syncedCount > 0) {
          await fetchTasks().catch(() => {
            // Ignore fetch errors during sync refresh
          });
        }
      }

      return result;
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [isOnline, fetchTasks]);

  // Initial fetch and sync on mount
  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      // First, try to sync any pending actions
      if (isOnline && getPendingCount() > 0) {
        await syncNow().catch(() => {});
      }

      // Then fetch fresh data if online
      if (isOnline && !cancelled) {
        try {
          await fetchTasks();
        } catch {
          // Error already handled in fetchTasks
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      } else {
        setLoading(false);
      }
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, [isOnline, fetchTasks, syncNow]);

  // Background sync interval
  useEffect(() => {
    if (!isOnline) {
      // Clear any existing timeout when offline
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      return;
    }

    const scheduleSync = () => {
      syncTimeoutRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;

        // Sync pending actions
        if (getPendingCount() > 0) {
          await syncNow().catch(() => {});
        }

        // Refresh tasks
        await fetchTasks().catch(() => {});

        // Schedule next sync
        if (isMountedRef.current) {
          scheduleSync();
        }
      }, syncInterval);
    };

    scheduleSync();

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, [isOnline, syncInterval, fetchTasks, syncNow]);

  // Listen for pending action count changes
  useEffect(() => {
    const checkPendingCount = () => {
      setPendingActionCount(getPendingCount());
    };

    // Check periodically for changes
    const interval = setInterval(checkPendingCount, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Apply optimistic state to a task based on pending actions
  const getTaskWithOptimisticState = useCallback((task: WorkerTask): WorkerTask => {
    // Check if there's a pending start action
    if (hasPendingStart(task.id)) {
      return {
        ...task,
        status: 'in_progress',
        startedAt: task.startedAt || new Date().toISOString(),
      };
    }

    // Check if there's a pending complete action
    if (hasPendingComplete(task.id)) {
      return {
        ...task,
        status: 'completed',
        completedAt: task.completedAt || new Date().toISOString(),
      };
    }

    return task;
  }, []);

  // Compute status
  const status: ConnectionStatus = useMemo(() => {
    if (!isOnline) return 'offline';
    if (isSyncing) return 'syncing';
    return 'online';
  }, [isOnline, isSyncing]);

  const contextValue = useMemo<WorkerOfflineContextValue>(() => ({
    status,
    isOnline,
    tasks,
    stats,
    loading,
    error,
    lastSyncedAt,
    pendingActionCount,
    refreshTasks,
    syncNow,
    getTaskWithOptimisticState,
  }), [
    status,
    isOnline,
    tasks,
    stats,
    loading,
    error,
    lastSyncedAt,
    pendingActionCount,
    refreshTasks,
    syncNow,
    getTaskWithOptimisticState,
  ]);

  return (
    <WorkerOfflineContext.Provider value={contextValue}>
      {children}
    </WorkerOfflineContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Access the worker offline context
 */
export function useWorkerOffline(): WorkerOfflineContextValue {
  const context = useContext(WorkerOfflineContext);
  if (!context) {
    throw new Error('useWorkerOffline must be used within a WorkerOfflineProvider');
  }
  return context;
}

/**
 * Convenience hook for accessing cached worker tasks
 */
export function useWorkerTasks(date?: string) {
  const { tasks, stats, loading, error, refreshTasks, isOnline, getTaskWithOptimisticState } =
    useWorkerOffline();

  // Apply optimistic state to all tasks
  const tasksWithOptimisticState = useMemo(() => {
    return tasks.map(getTaskWithOptimisticState);
  }, [tasks, getTaskWithOptimisticState]);

  // Refresh on date change
  useEffect(() => {
    refreshTasks(date);
  }, [date, refreshTasks]);

  return {
    tasks: tasksWithOptimisticState,
    stats,
    loading,
    error,
    refresh: () => refreshTasks(date),
    isOnline,
  };
}
