/**
 * Unit tests for tasks service
 */

import {
  createMockSupabaseClient,
  createMockUser,
  MockSupabaseQueryBuilder,
} from '@/lib/__tests__/test-utils';

// Mock the dependencies
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

import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  assignTask,
  startTask,
  completeTask,
  cancelTask,
  deleteTask,
  getEmployeeSchedule,
  getAssignableStaff,
  getTaskBySourceRef,
  deleteTaskBySourceRef,
} from '../service';

// ============================================================================
// Test Data Factories
// ============================================================================

const createTaskRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'task-1',
  org_id: mockOrgId,
  source_module: 'production',
  source_ref_type: 'job',
  source_ref_id: 'job-1',
  title: 'Test Task',
  description: 'Test description',
  task_type: 'potting',
  assigned_to: null,
  assigned_to_name: null,
  assigned_to_email: null,
  assigned_team_id: null,
  assigned_team_name: null,
  scheduled_date: '2024-01-15',
  priority: 0,
  status: 'pending',
  plant_quantity: 100,
  started_at: null,
  completed_at: null,
  duration_minutes: null,
  plants_per_hour: null,
  created_at: '2024-01-01T00:00:00.000Z',
  created_by: mockUser.id,
  completed_by: null,
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('tasks service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // getTasks
  // ============================================================================
  describe('getTasks', () => {
    it('should return all tasks for the organization', async () => {
      const mockTasks = [
        createTaskRow({ id: 'task-1' }),
        createTaskRow({ id: 'task-2', title: 'Second Task' }),
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTasks, error: null });
      });

      const result = await getTasks();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('task-1');
      expect(result[1].id).toBe('task-2');
    });

    it('should filter by status', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getTasks({ status: 'pending' });

      expect(mockSupabase.from).toHaveBeenCalledWith('tasks_with_productivity');
    });

    it('should filter by status array', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getTasks({ status: ['pending', 'in_progress'] });

      expect(mockSupabase.from).toHaveBeenCalledWith('tasks_with_productivity');
    });

    it('should filter by assignedTo', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getTasks({ assignedTo: 'user-123' });

      expect(mockSupabase.from).toHaveBeenCalledWith('tasks_with_productivity');
    });

    it('should filter by scheduledDate', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getTasks({ scheduledDate: '2024-01-15' });

      expect(mockSupabase.from).toHaveBeenCalledWith('tasks_with_productivity');
    });

    it('should filter by date range', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getTasks({
        scheduledDateFrom: '2024-01-01',
        scheduledDateTo: '2024-01-31',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('tasks_with_productivity');
    });

    it('should filter by sourceModule', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getTasks({ sourceModule: 'production' });

      expect(mockSupabase.from).toHaveBeenCalledWith('tasks_with_productivity');
    });

    it('should filter by taskType', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getTasks({ taskType: 'potting' });

      expect(mockSupabase.from).toHaveBeenCalledWith('tasks_with_productivity');
    });

    it('should throw on database error', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Database error' },
        });
      });

      await expect(getTasks()).rejects.toThrow('Database error');
    });
  });

  // ============================================================================
  // getTaskById
  // ============================================================================
  describe('getTaskById', () => {
    it('should return a task by ID', async () => {
      const mockTask = createTaskRow({ id: 'task-1' });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTask, error: null });
      });

      const result = await getTaskById('task-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('task-1');
    });

    it('should return null for non-existent task', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        });
      });

      const result = await getTaskById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // createTask
  // ============================================================================
  describe('createTask', () => {
    it('should create a task with minimal input', async () => {
      const mockTask = createTaskRow({ id: 'new-task' });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTask, error: null });
      });

      const result = await createTask({
        sourceModule: 'production',
        title: 'New Task',
      });

      expect(result.id).toBe('new-task');
      expect(result.sourceModule).toBe('production');
    });

    it('should create a task with all fields', async () => {
      const mockTask = createTaskRow({
        id: 'new-task',
        assigned_to: 'user-1',
        assigned_team_id: 'team-1',
        status: 'assigned',
      });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTask, error: null });
      });

      const result = await createTask({
        sourceModule: 'dispatch',
        sourceRefType: 'pick_list',
        sourceRefId: 'pick-1',
        title: 'Pick Order',
        description: 'Pick items for order',
        taskType: 'picking',
        assignedTo: 'user-1',
        assignedTeamId: 'team-1',
        scheduledDate: '2024-01-15',
        priority: 1,
        plantQuantity: 50,
      });

      expect(result.id).toBe('new-task');
    });

    it('should set status to assigned when assignedTo is provided', async () => {
      const mockTask = createTaskRow({
        id: 'new-task',
        assigned_to: 'user-1',
        status: 'assigned',
      });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTask, error: null });
      });

      const result = await createTask({
        sourceModule: 'production',
        title: 'Assigned Task',
        assignedTo: 'user-1',
      });

      expect(result.status).toBe('assigned');
    });

    it('should set status to assigned when assignedTeamId is provided', async () => {
      const mockTask = createTaskRow({
        id: 'new-task',
        assigned_team_id: 'team-1',
        status: 'assigned',
      });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTask, error: null });
      });

      const result = await createTask({
        sourceModule: 'dispatch',
        title: 'Team Task',
        assignedTeamId: 'team-1',
      });

      expect(result.status).toBe('assigned');
    });

    it('should throw on database error', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Insert failed' },
        });
      });

      await expect(
        createTask({
          sourceModule: 'production',
          title: 'Failing Task',
        })
      ).rejects.toThrow('Insert failed');
    });

    it('should throw when insert returns no data', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: null, // No error but also no data
        });
      });

      await expect(
        createTask({
          sourceModule: 'production',
          title: 'Task with no data returned',
        })
      ).rejects.toThrow('Task creation returned no data');
    });
  });

  // ============================================================================
  // updateTask
  // ============================================================================
  describe('updateTask', () => {
    it('should update task fields', async () => {
      const mockTask = createTaskRow({
        id: 'task-1',
        title: 'Updated Title',
        description: 'Updated description',
      });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTask, error: null });
      });

      const result = await updateTask('task-1', {
        title: 'Updated Title',
        description: 'Updated description',
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should update assignedTo and assignedTeamId', async () => {
      const mockTask = createTaskRow({
        id: 'task-1',
        assigned_to: 'user-2',
        assigned_team_id: 'team-2',
      });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTask, error: null });
      });

      const result = await updateTask('task-1', {
        assignedTo: 'user-2',
        assignedTeamId: 'team-2',
      });

      expect(result.assignedTo).toBe('user-2');
      expect(result.assignedTeamId).toBe('team-2');
    });

    it('should update status', async () => {
      const mockTask = createTaskRow({
        id: 'task-1',
        status: 'in_progress',
      });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTask, error: null });
      });

      const result = await updateTask('task-1', {
        status: 'in_progress',
      });

      expect(result.status).toBe('in_progress');
    });

    it('should throw on database error', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Update failed' },
        });
      });

      await expect(
        updateTask('task-1', { title: 'New Title' })
      ).rejects.toThrow('Update failed');
    });

    it('should throw when update returns no data (task not found)', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: null, // No error but also no data - task wasn't found
        });
      });

      await expect(
        updateTask('nonexistent-task', { title: 'New Title' })
      ).rejects.toThrow('Task nonexistent-task not found or update returned no data');
    });
  });

  // ============================================================================
  // assignTask
  // ============================================================================
  describe('assignTask', () => {
    it('should assign a task to an employee', async () => {
      const mockTask = createTaskRow({
        id: 'task-1',
        assigned_to: 'user-1',
        status: 'assigned',
      });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTask, error: null });
      });

      const result = await assignTask('task-1', 'user-1');

      expect(result.assignedTo).toBe('user-1');
      expect(result.status).toBe('assigned');
    });

    it('should assign a task with scheduled date', async () => {
      const mockTask = createTaskRow({
        id: 'task-1',
        assigned_to: 'user-1',
        scheduled_date: '2024-01-20',
        status: 'assigned',
      });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTask, error: null });
      });

      const result = await assignTask('task-1', 'user-1', '2024-01-20');

      expect(result.scheduledDate).toBe('2024-01-20');
    });
  });

  // ============================================================================
  // startTask
  // ============================================================================
  describe('startTask', () => {
    it('should start a task and set started_at', async () => {
      const mockTask = createTaskRow({
        id: 'task-1',
        status: 'in_progress',
        started_at: '2024-01-15T10:00:00.000Z',
      });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTask, error: null });
      });

      const result = await startTask('task-1');

      expect(result.status).toBe('in_progress');
      expect(result.startedAt).toBeTruthy();
    });

    it('should throw on database error', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Start failed' },
        });
      });

      await expect(startTask('task-1')).rejects.toThrow('Start failed');
    });
  });

  // ============================================================================
  // completeTask
  // ============================================================================
  describe('completeTask', () => {
    it('should complete a task', async () => {
      // First call to fetch existing task
      const existingTask = createTaskRow({
        id: 'task-1',
        status: 'in_progress',
        started_at: '2024-01-15T10:00:00.000Z',
        plant_quantity: 100,
      });

      // Second call to update
      const completedTask = createTaskRow({
        id: 'task-1',
        status: 'completed',
        started_at: '2024-01-15T10:00:00.000Z',
        completed_at: '2024-01-15T12:00:00.000Z',
        completed_by: mockUser.id,
        plant_quantity: 100,
      });

      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: existingTask, error: null });
        }
        if (table === 'productivity_logs') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: completedTask, error: null });
      });

      const result = await completeTask('task-1');

      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeTruthy();
    });

    it('should complete a task with actual plant quantity', async () => {
      const existingTask = createTaskRow({
        id: 'task-1',
        status: 'in_progress',
        started_at: '2024-01-15T10:00:00.000Z',
        plant_quantity: 100,
      });

      const completedTask = createTaskRow({
        id: 'task-1',
        status: 'completed',
        plant_quantity: 95,
      });

      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: existingTask, error: null });
        }
        if (table === 'productivity_logs') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: completedTask, error: null });
      });

      const result = await completeTask('task-1', 95);

      expect(result.plantQuantity).toBe(95);
    });

    it('should throw when task not found', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        });
      });

      await expect(completeTask('nonexistent')).rejects.toThrow('Task not found');
    });
  });

  // ============================================================================
  // cancelTask
  // ============================================================================
  describe('cancelTask', () => {
    it('should cancel a task', async () => {
      const mockTask = createTaskRow({
        id: 'task-1',
        status: 'cancelled',
      });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTask, error: null });
      });

      const result = await cancelTask('task-1');

      expect(result.status).toBe('cancelled');
    });
  });

  // ============================================================================
  // deleteTask
  // ============================================================================
  describe('deleteTask', () => {
    it('should delete a task', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      await expect(deleteTask('task-1')).resolves.not.toThrow();
    });

    it('should throw on database error', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Delete failed' },
        });
      });

      await expect(deleteTask('task-1')).rejects.toThrow('Delete failed');
    });
  });

  // ============================================================================
  // getEmployeeSchedule
  // ============================================================================
  describe('getEmployeeSchedule', () => {
    it('should return tasks for an employee', async () => {
      const mockTasks = [
        createTaskRow({ id: 'task-1', assigned_to: 'user-1', status: 'assigned' }),
        createTaskRow({ id: 'task-2', assigned_to: 'user-1', status: 'in_progress' }),
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTasks, error: null });
      });

      const result = await getEmployeeSchedule('user-1');

      expect(result).toHaveLength(2);
    });

    it('should filter by scheduled date', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getEmployeeSchedule('user-1', '2024-01-15');

      expect(mockSupabase.from).toHaveBeenCalledWith('tasks_with_productivity');
    });
  });

  // ============================================================================
  // getTaskBySourceRef
  // ============================================================================
  describe('getTaskBySourceRef', () => {
    it('should return a task by source reference', async () => {
      const mockTask = createTaskRow({
        id: 'task-1',
        source_module: 'dispatch',
        source_ref_type: 'pick_list',
        source_ref_id: 'pick-1',
      });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTask, error: null });
      });

      const result = await getTaskBySourceRef('dispatch', 'pick_list', 'pick-1');

      expect(result).not.toBeNull();
      expect(result?.sourceRefId).toBe('pick-1');
    });

    it('should return null when not found (no data, no error)', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await getTaskBySourceRef('dispatch', 'pick_list', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should return null for PGRST116 (not found) error', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        });
      });

      const result = await getTaskBySourceRef('dispatch', 'pick_list', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should throw on database errors (not PGRST116)', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { code: 'DATABASE_ERROR', message: 'Connection failed' },
        });
      });

      await expect(
        getTaskBySourceRef('dispatch', 'pick_list', 'some-id')
      ).rejects.toThrow('Connection failed');
    });
  });

  // ============================================================================
  // deleteTaskBySourceRef
  // ============================================================================
  describe('deleteTaskBySourceRef', () => {
    it('should delete a task by source reference', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      await expect(
        deleteTaskBySourceRef('dispatch', 'pick_list', 'pick-1')
      ).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // getAssignableStaff
  // ============================================================================
  describe('getAssignableStaff', () => {
    it('should return staff members', async () => {
      const mockMembers = [
        {
          user_id: 'user-1',
          role: 'grower',
          profiles: { display_name: 'John Grower', email: 'john@example.com' },
        },
        {
          user_id: 'user-2',
          role: 'admin',
          profiles: { display_name: 'Jane Admin', email: 'jane@example.com' },
        },
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockMembers, error: null });
      });

      const result = await getAssignableStaff();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('John Grower');
      expect(result[1].name).toBe('Jane Admin');
    });

    it('should filter out members without profiles', async () => {
      const mockMembers = [
        {
          user_id: 'user-1',
          role: 'grower',
          profiles: { display_name: 'John Grower', email: 'john@example.com' },
        },
        {
          user_id: 'user-2',
          role: 'admin',
          profiles: null, // No profile
        },
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockMembers, error: null });
      });

      const result = await getAssignableStaff();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-1');
    });
  });

  // ============================================================================
  // Task Type Mapping
  // ============================================================================
  describe('Task type mapping', () => {
    it('should correctly map all task fields from row to Task type', async () => {
      const fullRow = createTaskRow({
        id: 'task-full',
        org_id: mockOrgId,
        source_module: 'dispatch',
        source_ref_type: 'pick_list',
        source_ref_id: 'pick-123',
        title: 'Full Task',
        description: 'Complete description',
        task_type: 'picking',
        assigned_to: 'user-1',
        assigned_to_name: 'John Doe',
        assigned_to_email: 'john@example.com',
        assigned_team_id: 'team-1',
        assigned_team_name: 'Team Alpha',
        scheduled_date: '2024-01-15',
        priority: 5,
        status: 'in_progress',
        plant_quantity: 250,
        started_at: '2024-01-15T08:00:00.000Z',
        completed_at: null,
        duration_minutes: 60,
        plants_per_hour: 250,
        created_at: '2024-01-10T00:00:00.000Z',
        created_by: 'creator-1',
        completed_by: null,
        updated_at: '2024-01-15T08:00:00.000Z',
      });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: fullRow, error: null });
      });

      const result = await getTaskById('task-full');

      expect(result).toMatchObject({
        id: 'task-full',
        orgId: mockOrgId,
        sourceModule: 'dispatch',
        sourceRefType: 'pick_list',
        sourceRefId: 'pick-123',
        title: 'Full Task',
        description: 'Complete description',
        taskType: 'picking',
        assignedTo: 'user-1',
        assignedToName: 'John Doe',
        assignedToEmail: 'john@example.com',
        assignedTeamId: 'team-1',
        assignedTeamName: 'Team Alpha',
        scheduledDate: '2024-01-15',
        priority: 5,
        status: 'in_progress',
        plantQuantity: 250,
        startedAt: '2024-01-15T08:00:00.000Z',
        completedAt: null,
        durationMinutes: 60,
        plantsPerHour: 250,
        createdAt: '2024-01-10T00:00:00.000Z',
        createdBy: 'creator-1',
        completedBy: null,
        updatedAt: '2024-01-15T08:00:00.000Z',
      });
    });
  });
});

