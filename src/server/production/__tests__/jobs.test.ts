/**
 * Integration tests for production jobs service
 * Tests the task generation when jobs are assigned
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

// Mock the tasks service to verify it's called correctly
const mockCreateTask = jest.fn();
jest.mock('@/server/tasks/service', () => ({
  createTask: (...args: unknown[]) => mockCreateTask(...args),
}));

import {
  getProductionJobs,
  getJobById,
  createJob,
  assignJob,
  startJob,
  completeJob,
  deleteJob,
  getJobBatches,
  addBatchesToJob,
  removeBatchFromJob,
} from '../jobs';

// ============================================================================
// Test Data Factories
// ============================================================================

const createJobRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'job-1',
  org_id: mockOrgId,
  name: 'Test Potting Job',
  description: 'Test description',
  machine: 'Potting Machine A',
  location: 'Greenhouse 1',
  process_type: 'potting',
  scheduled_week: 3,
  scheduled_year: 2024,
  scheduled_date: '2024-01-15',
  assigned_to: null,
  assigned_to_name: null,
  assigned_to_email: null,
  task_id: null,
  status: 'unassigned',
  wizard_template: 'potting',
  wizard_progress: {},
  started_at: null,
  completed_at: null,
  completed_by: null,
  created_at: '2024-01-01T00:00:00.000Z',
  created_by: mockUser.id,
  updated_at: '2024-01-01T00:00:00.000Z',
  batch_count: 5,
  total_plants: 500,
  duration_minutes: null,
  ...overrides,
});

const createBatchRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  job_id: 'job-1',
  batch_id: 'batch-1',
  sort_order: 0,
  added_at: '2024-01-01T00:00:00.000Z',
  batches: {
    batch_number: '2401001',
    quantity: 100,
    status: 'Planned',
    ready_at: '2024-01-15',
    plant_varieties: { name: 'Red Petunia' },
    plant_sizes: { name: '9cm' },
  },
  ...overrides,
});

describe('production jobs service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateTask.mockResolvedValue({
      id: 'task-1',
      orgId: mockOrgId,
      sourceModule: 'production',
      sourceRefType: 'job',
      sourceRefId: 'job-1',
      title: 'Test Potting Job',
      status: 'assigned',
    });
  });

  // ============================================================================
  // getProductionJobs
  // ============================================================================
  describe('getProductionJobs', () => {
    it('should return all jobs for the organization', async () => {
      const mockJobs = [
        createJobRow({ id: 'job-1' }),
        createJobRow({ id: 'job-2', name: 'Second Job' }),
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockJobs, error: null });
      });

      const result = await getProductionJobs();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('job-1');
      expect(result[1].id).toBe('job-2');
    });

    it('should filter by status', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getProductionJobs({ status: 'assigned' });

      expect(mockSupabase.from).toHaveBeenCalledWith('production_jobs_summary');
    });

    it('should filter by status array', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getProductionJobs({ status: ['unassigned', 'assigned'] });

      expect(mockSupabase.from).toHaveBeenCalledWith('production_jobs_summary');
    });

    it('should filter by assignedTo', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getProductionJobs({ assignedTo: 'user-1' });

      expect(mockSupabase.from).toHaveBeenCalledWith('production_jobs_summary');
    });

    it('should filter by scheduledWeek and scheduledYear', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getProductionJobs({ scheduledWeek: 3, scheduledYear: 2024 });

      expect(mockSupabase.from).toHaveBeenCalledWith('production_jobs_summary');
    });

    it('should filter by processType', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getProductionJobs({ processType: 'potting' });

      expect(mockSupabase.from).toHaveBeenCalledWith('production_jobs_summary');
    });
  });

  // ============================================================================
  // getJobById
  // ============================================================================
  describe('getJobById', () => {
    it('should return a job by ID', async () => {
      const mockJob = createJobRow({ id: 'job-1' });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockJob, error: null });
      });

      const result = await getJobById('job-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('job-1');
      expect(result?.name).toBe('Test Potting Job');
    });

    it('should return null for non-existent job', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        });
      });

      const result = await getJobById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // createJob
  // ============================================================================
  describe('createJob', () => {
    it('should create a job with batches', async () => {
      const mockJob = createJobRow({ id: 'new-job' });

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'production_jobs') {
          return new MockSupabaseQueryBuilder({ data: mockJob, error: null });
        }
        if (table === 'production_job_batches') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({
            data: [{ quantity: 100 }, { quantity: 150 }],
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await createJob({
        name: 'New Job',
        description: 'Description',
        processType: 'potting',
        batchIds: ['batch-1', 'batch-2'],
      });

      expect(result.id).toBe('new-job');
    });

    it('should create a job without batches', async () => {
      const mockJob = createJobRow({ id: 'new-job', batch_count: 0, total_plants: 0 });

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'production_jobs') {
          return new MockSupabaseQueryBuilder({ data: mockJob, error: null });
        }
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await createJob({
        name: 'Empty Job',
        batchIds: [],
      });

      expect(result.id).toBe('new-job');
      expect(result.batchCount).toBe(0);
    });
  });

  // ============================================================================
  // assignJob - CRITICAL: This tests task integration
  // ============================================================================
  describe('assignJob', () => {
    it('should assign a job and create a task', async () => {
      const mockJob = createJobRow({
        id: 'job-1',
        total_plants: 500,
      });

      const updatedJob = createJobRow({
        id: 'job-1',
        assigned_to: 'user-1',
        task_id: 'task-1',
        status: 'assigned',
      });

      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        // First call: getJobById
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: mockJob, error: null });
        }
        // Second call: update job
        if (table === 'production_jobs') {
          return new MockSupabaseQueryBuilder({ data: updatedJob, error: null });
        }
        // Third call: getJobById for return
        return new MockSupabaseQueryBuilder({ data: updatedJob, error: null });
      });

      const result = await assignJob('job-1', 'user-1', '2024-01-15');

      // Verify createTask was called with correct parameters
      expect(mockCreateTask).toHaveBeenCalledWith({
        sourceModule: 'production',
        sourceRefType: 'job',
        sourceRefId: 'job-1',
        title: 'Test Potting Job',
        description: 'Test description',
        taskType: 'potting',
        assignedTo: 'user-1',
        scheduledDate: '2024-01-15',
        plantQuantity: 500,
      });

      expect(result.job.assignedTo).toBe('user-1');
      expect(result.job.status).toBe('assigned');
      expect(result.task.id).toBe('task-1');
    });

    it('should use job scheduled date if no date provided', async () => {
      const mockJob = createJobRow({
        id: 'job-1',
        scheduled_date: '2024-01-20',
        total_plants: 500,
      });

      const updatedJob = createJobRow({
        id: 'job-1',
        assigned_to: 'user-1',
        task_id: 'task-1',
        status: 'assigned',
        scheduled_date: '2024-01-20',
      });

      let callCount = 0;
      mockSupabase.from = jest.fn((_table: string) => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: mockJob, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: updatedJob, error: null });
      });

      await assignJob('job-1', 'user-1');

      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledDate: '2024-01-20',
        })
      );
    });

    it('should throw if job not found', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        });
      });

      await expect(assignJob('nonexistent', 'user-1')).rejects.toThrow('Job not found');
    });
  });

  // ============================================================================
  // startJob
  // ============================================================================
  describe('startJob', () => {
    it('should start a job and update its associated task', async () => {
      const mockJob = createJobRow({
        id: 'job-1',
        task_id: 'task-1',
        status: 'assigned',
      });

      const startedJob = createJobRow({
        id: 'job-1',
        task_id: 'task-1',
        status: 'in_progress',
        started_at: '2024-01-15T10:00:00.000Z',
      });

      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: mockJob, error: null });
        }
        if (table === 'tasks') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: startedJob, error: null });
      });

      const result = await startJob('job-1');

      expect(result.status).toBe('in_progress');
      expect(result.startedAt).toBeTruthy();
    });
  });

  // ============================================================================
  // completeJob
  // ============================================================================
  describe('completeJob', () => {
    it('should complete a job, update task, and log productivity', async () => {
      const mockJob = createJobRow({
        id: 'job-1',
        task_id: 'task-1',
        status: 'in_progress',
        started_at: '2024-01-15T10:00:00.000Z',
        assigned_to: 'user-1',
        total_plants: 500,
      });

      const completedJob = createJobRow({
        id: 'job-1',
        task_id: 'task-1',
        status: 'completed',
        started_at: '2024-01-15T10:00:00.000Z',
        completed_at: '2024-01-15T12:00:00.000Z',
        completed_by: mockUser.id,
      });

      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: mockJob, error: null });
        }
        if (table === 'tasks') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        if (table === 'productivity_logs') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        if (table === 'production_job_batches') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: completedJob, error: null });
      });

      const result = await completeJob('job-1');

      expect(result.status).toBe('completed');
    });

    it('should complete a job with wizard data', async () => {
      const mockJob = createJobRow({
        id: 'job-1',
        task_id: 'task-1',
        status: 'in_progress',
        started_at: '2024-01-15T10:00:00.000Z',
      });

      const completedJob = createJobRow({
        id: 'job-1',
        status: 'completed',
        wizard_progress: { step1: true, step2: true },
      });

      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: mockJob, error: null });
        }
        if (table === 'production_job_batches') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        return new MockSupabaseQueryBuilder({ data: completedJob, error: null });
      });

      const result = await completeJob('job-1', { step1: true, step2: true });

      expect(result.status).toBe('completed');
    });
  });

  // ============================================================================
  // deleteJob
  // ============================================================================
  describe('deleteJob', () => {
    it('should delete a job and its associated task', async () => {
      const mockJob = createJobRow({
        id: 'job-1',
        task_id: 'task-1',
      });

      let callCount = 0;
      mockSupabase.from = jest.fn((_table: string) => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: mockJob, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      await expect(deleteJob('job-1')).resolves.not.toThrow();
    });

    it('should delete a job without a task', async () => {
      const mockJob = createJobRow({
        id: 'job-1',
        task_id: null,
      });

      let callCount = 0;
      mockSupabase.from = jest.fn((_table: string) => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: mockJob, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      await expect(deleteJob('job-1')).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // getJobBatches
  // ============================================================================
  describe('getJobBatches', () => {
    it('should return batches for a job', async () => {
      const mockJob = { id: 'job-1' };
      const mockBatches = [
        createBatchRow({ batch_id: 'batch-1', sort_order: 0 }),
        createBatchRow({ batch_id: 'batch-2', sort_order: 1 }),
      ];

      let callCount = 0;
      mockSupabase.from = jest.fn((_table: string) => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: mockJob, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
      });

      const result = await getJobBatches('job-1');

      expect(result).toHaveLength(2);
      expect(result[0].batchId).toBe('batch-1');
      expect(result[1].batchId).toBe('batch-2');
    });
  });

  // ============================================================================
  // addBatchesToJob
  // ============================================================================
  describe('addBatchesToJob', () => {
    it('should add batches to a job', async () => {
      const mockJob = { id: 'job-1' };
      const existingBatches = [{ sort_order: 1 }];

      let callCount = 0;
      mockSupabase.from = jest.fn((_table: string) => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: mockJob, error: null });
        }
        if (callCount === 2) {
          return new MockSupabaseQueryBuilder({ data: existingBatches, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      await expect(
        addBatchesToJob('job-1', ['batch-3', 'batch-4'])
      ).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // removeBatchFromJob
  // ============================================================================
  describe('removeBatchFromJob', () => {
    it('should remove a batch from a job', async () => {
      const mockJob = { id: 'job-1' };

      let callCount = 0;
      mockSupabase.from = jest.fn((_table: string) => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: mockJob, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      await expect(removeBatchFromJob('job-1', 'batch-1')).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // Field mapping
  // ============================================================================
  describe('Field mapping', () => {
    it('should correctly map all job fields', async () => {
      const fullRow = createJobRow({
        id: 'job-full',
        org_id: mockOrgId,
        name: 'Full Job',
        description: 'Complete description',
        machine: 'Machine X',
        location: 'Location Y',
        process_type: 'transplant',
        scheduled_week: 5,
        scheduled_year: 2024,
        scheduled_date: '2024-01-29',
        assigned_to: 'user-1',
        assigned_to_name: 'John Doe',
        assigned_to_email: 'john@example.com',
        task_id: 'task-1',
        status: 'in_progress',
        wizard_template: 'transplant',
        wizard_progress: { step1: true },
        started_at: '2024-01-29T08:00:00.000Z',
        completed_at: null,
        completed_by: null,
        batch_count: 10,
        total_plants: 1000,
        duration_minutes: 60,
      });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: fullRow, error: null });
      });

      const result = await getJobById('job-full');

      expect(result).toMatchObject({
        id: 'job-full',
        orgId: mockOrgId,
        name: 'Full Job',
        description: 'Complete description',
        machine: 'Machine X',
        location: 'Location Y',
        processType: 'transplant',
        scheduledWeek: 5,
        scheduledYear: 2024,
        scheduledDate: '2024-01-29',
        assignedTo: 'user-1',
        assignedToName: 'John Doe',
        assignedToEmail: 'john@example.com',
        taskId: 'task-1',
        status: 'in_progress',
        wizardTemplate: 'transplant',
        wizardProgress: { step1: true },
        startedAt: '2024-01-29T08:00:00.000Z',
        completedAt: null,
        completedBy: null,
        batchCount: 10,
        totalPlants: 1000,
        durationMinutes: 60,
      });
    });
  });
});

