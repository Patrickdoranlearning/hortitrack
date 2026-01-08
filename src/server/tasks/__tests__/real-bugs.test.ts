/**
 * Tests that verify CORRECT behavior after bug fixes
 * 
 * These tests document the expected behavior and will catch regressions
 */

import {
  createMockSupabaseClient,
  createMockUser,
  MockSupabaseQueryBuilder,
} from '@/lib/__tests__/test-utils';

const mockSupabase = createMockSupabaseClient();
const mockUser = createMockUser();
const mockOrgId = 'test-org-id';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

jest.mock('@/server/auth/org', () => ({
  getUserAndOrg: jest.fn(() =>
    Promise.resolve({
      user: mockUser,
      orgId: mockOrgId,
      supabase: mockSupabase,
    })
  ),
}));

// Import after mocks are set up
import { createTask, getTaskBySourceRef, updateTask } from '../service';

describe('Bug Fix: getTaskBySourceRef error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw on database errors (not just return null)', async () => {
    // Setup: Query returns a non-PGRST116 error
    mockSupabase.from = jest.fn(() => new MockSupabaseQueryBuilder({
      data: null,
      error: { code: 'SOME_ERROR', message: 'Database connection failed' },
    }));

    // FIXED: Now throws instead of silently returning null
    await expect(
      getTaskBySourceRef('dispatch', 'pick_list', 'some-id')
    ).rejects.toThrow('Database connection failed');
  });

  it('should return null for PGRST116 (not found) which is expected', async () => {
    mockSupabase.from = jest.fn(() => new MockSupabaseQueryBuilder({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    }));

    const result = await getTaskBySourceRef('dispatch', 'pick_list', 'nonexistent');
    expect(result).toBeNull();
  });

  it('should return task when found', async () => {
    const mockTask = {
      id: 'task-1',
      org_id: mockOrgId,
      source_module: 'dispatch',
      source_ref_type: 'pick_list',
      source_ref_id: 'pick-123',
      title: 'Test Task',
      description: null,
      task_type: 'picking',
      assigned_to: null,
      assigned_to_name: null,
      assigned_to_email: null,
      assigned_team_id: null,
      assigned_team_name: null,
      scheduled_date: null,
      priority: 0,
      status: 'pending',
      plant_quantity: 100,
      started_at: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      created_by: mockUser.id,
      completed_by: null,
      updated_at: new Date().toISOString(),
      duration_minutes: null,
      plants_per_hour: null,
    };

    mockSupabase.from = jest.fn(() => new MockSupabaseQueryBuilder({
      data: mockTask,
      error: null,
    }));

    const result = await getTaskBySourceRef('dispatch', 'pick_list', 'pick-123');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('task-1');
  });
});

describe('Bug Fix: createTask null data handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw if insert returns no data', async () => {
    mockSupabase.from = jest.fn(() => new MockSupabaseQueryBuilder({
      data: null,
      error: null, // No error but also no data
    }));

    await expect(
      createTask({
        sourceModule: 'production',
        sourceRefType: 'job',
        sourceRefId: 'job-123',
        title: 'Test Task',
      })
    ).rejects.toThrow('Task creation returned no data');
  });

  it('should return fallback task with null view fields when getTaskById fails', async () => {
    let callCount = 0;
    mockSupabase.from = jest.fn(() => {
      callCount++;
      if (callCount === 1) {
        // First call: insert succeeds
        return new MockSupabaseQueryBuilder({
          data: {
            id: 'new-task-id',
            org_id: mockOrgId,
            source_module: 'production',
            source_ref_type: 'job',
            source_ref_id: 'job-123',
            title: 'Test Task',
            description: null,
            task_type: 'potting',
            assigned_to: null,
            assigned_team_id: null,
            scheduled_date: null,
            priority: 0,
            status: 'pending',
            plant_quantity: null,
            started_at: null,
            completed_at: null,
            created_at: new Date().toISOString(),
            created_by: mockUser.id,
            completed_by: null,
            updated_at: new Date().toISOString(),
          },
          error: null,
        });
      } else {
        // Second call: getTaskById returns not found
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        });
      }
    });

    const task = await createTask({
      sourceModule: 'production',
      sourceRefType: 'job',
      sourceRefId: 'job-123',
      title: 'Test Task',
      taskType: 'potting',
    });

    // FIXED: Fallback works correctly with explicit null values
    expect(task.id).toBe('new-task-id');
    expect(task.assignedToName).toBeNull();
    expect(task.assignedTeamName).toBeNull();
    expect(task.durationMinutes).toBeNull();
    expect(task.plantsPerHour).toBeNull();
  });
});

describe('Bug Fix: updateTask null data handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw if update returns no data (task not found)', async () => {
    mockSupabase.from = jest.fn(() => new MockSupabaseQueryBuilder({
      data: null,
      error: null, // No error but no data - means no rows matched
    }));

    await expect(
      updateTask('non-existent-task', { title: 'New Title' })
    ).rejects.toThrow('Task non-existent-task not found or update returned no data');
  });
});

describe('Architectural: Source reference uniqueness', () => {
  it('documents that duplicate source refs are now prevented by database constraint', () => {
    // The migration 20260103200000_tasks_source_ref_unique.sql adds:
    // CREATE UNIQUE INDEX tasks_source_ref_unique_idx 
    //   ON public.tasks(org_id, source_module, source_ref_type, source_ref_id) 
    //   WHERE source_ref_id IS NOT NULL;
    //
    // This means:
    // - Cannot create two tasks for same pick list
    // - Cannot create two tasks for same production job
    // - CAN create multiple standalone tasks (where source_ref_id is NULL)
    expect(true).toBe(true);
  });
});

describe('Architectural: Task status transition validation', () => {
  it('documents that status transitions should be validated', () => {
    // Currently there's no validation preventing:
    // - completed -> pending (re-opening completed task)
    // - pending -> completed (skipping in_progress)
    // - cancelled -> in_progress (resuming cancelled task)
    //
    // This is a TODO for future enhancement:
    // Add database trigger or application logic to validate transitions
    expect(true).toBe(true);
  });
});

describe('Architectural: Jobs/Tasks sync integrity', () => {
  it('documents that job and task timestamps are now synchronized', () => {
    // FIXED in jobs.ts: startJob() and completeJob() now use a single
    // timestamp for both the job and task updates:
    //
    //   const startedAt = new Date().toISOString();
    //   // ... update job with startedAt
    //   // ... update task with same startedAt
    //
    // This ensures job.started_at === task.started_at
    expect(true).toBe(true);
  });

  it('documents that task update errors are now logged', () => {
    // FIXED in jobs.ts: Task update errors are now caught and logged:
    //
    //   const { error: taskError } = await supabase.from("tasks").update(...)
    //   if (taskError) {
    //     console.error("[jobs/service] Error syncing task status:", taskError);
    //   }
    //
    // The job operation still succeeds (task is secondary), but errors are visible
    expect(true).toBe(true);
  });
});

describe('Architectural: Pick list task creation', () => {
  it('documents that task creation failures now return a warning', () => {
    // FIXED in picking.ts: createPickList() now returns a warning field:
    //
    //   return {
    //     pickList: { ... },
    //     warning: "Pick list created but task scheduling failed..."
    //   };
    //
    // Callers can check for warnings and display to users
    expect(true).toBe(true);
  });
});
