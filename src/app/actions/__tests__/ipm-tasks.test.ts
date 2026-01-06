/**
 * Unit tests for ipm-tasks.ts server actions
 */

import {
  createMockSupabaseClient,
  createMockUser,
  factories,
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

// Mock ipm-stock for completeTasks
jest.mock('../ipm-stock', () => ({
  recordUsage: jest.fn(() => Promise.resolve({ success: true })),
}));

import {
  generateTasksForBatch,
  generateTasksForSpotTreatment,
  getGroupedTasks,
  getTasks,
  completeTasks,
  skipTask,
  markOverdueTasks,
  bulkGenerateTasks,
} from '../ipm-tasks';

describe('ipm-tasks actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // generateTasksForBatch
  // ============================================================================
  describe('generateTasksForBatch', () => {
    it('should generate tasks for a batch based on family assignments', async () => {
      const mockBatch = {
        id: 'batch-1',
        batch_number: '2401001',
        location_id: 'loc-1',
        plant_variety: {
          id: 'var-1',
          name: 'Red Petunia',
          family: 'Bedding',
        },
      };

      const mockAssignments = [
        {
          id: 'assign-1',
          program_id: 'prog-1',
          ipm_programs: {
            id: 'prog-1',
            name: 'Bedding Program',
            schedule_type: 'week_based',
            ipm_program_steps: [
              {
                id: 'step-1',
                product_id: 'p1',
                week_number: 1,
                rate: 5,
                rate_unit: 'ml/L',
                method: 'Foliar Spray',
                ipm_products: { id: 'p1', name: 'Neem Oil' },
              },
              {
                id: 'step-2',
                product_id: 'p2',
                week_number: 1, // Same week - tank mix
                rate: 3,
                rate_unit: 'ml/L',
                method: 'Foliar Spray',
                ipm_products: { id: 'p2', name: 'Pyrethrin' },
              },
            ],
          },
        },
      ];

      let tableCallCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: mockBatch, error: null });
        }
        if (table === 'ipm_assignments') {
          return new MockSupabaseQueryBuilder({ data: mockAssignments, error: null });
        }
        if (table === 'ipm_tasks') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await generateTasksForBatch('batch-1', '2024-01-01');

      expect(result.success).toBe(true);
      expect(result.data?.tasksCreated).toBe(2); // Two products in tank mix
    });

    it('should return 0 tasks when batch has no family', async () => {
      const mockBatch = {
        id: 'batch-1',
        batch_number: '2401001',
        location_id: 'loc-1',
        plant_variety: {
          id: 'var-1',
          name: 'Custom Plant',
          family: null,
        },
      };

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: mockBatch, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await generateTasksForBatch('batch-1', '2024-01-01');

      expect(result.success).toBe(true);
      expect(result.data?.tasksCreated).toBe(0);
    });

    it('should return 0 tasks when no programs assigned to family', async () => {
      const mockBatch = {
        id: 'batch-1',
        batch_number: '2401001',
        location_id: 'loc-1',
        plant_variety: {
          id: 'var-1',
          name: 'Red Petunia',
          family: 'Bedding',
        },
      };

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: mockBatch, error: null });
        }
        if (table === 'ipm_assignments') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await generateTasksForBatch('batch-1', '2024-01-01');

      expect(result.success).toBe(true);
      expect(result.data?.tasksCreated).toBe(0);
    });

    it('should handle batch not found', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Not found', code: 'PGRST116' },
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await generateTasksForBatch('nonexistent', '2024-01-01');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ============================================================================
  // generateTasksForSpotTreatment
  // ============================================================================
  describe('generateTasksForSpotTreatment', () => {
    it('should generate tasks for a spot treatment', async () => {
      const mockTreatment = {
        id: 'spot-1',
        org_id: mockOrgId,
        product_id: 'p1',
        target_type: 'location',
        target_location_id: 'loc-1',
        target_batch_id: null,
        first_application_date: '2024-01-15',
        applications_total: 3,
        application_interval_days: 7,
        rate: 5,
        rate_unit: 'ml/L',
        method: 'Foliar Spray',
        reason: 'Aphid outbreak',
        ipm_products: { id: 'p1', name: 'Neem Oil' },
      };

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'ipm_spot_treatments') {
          return new MockSupabaseQueryBuilder({ data: mockTreatment, error: null });
        }
        if (table === 'ipm_tasks') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await generateTasksForSpotTreatment('spot-1');

      expect(result.success).toBe(true);
      expect(result.data?.tasksCreated).toBe(3);
    });

    it('should handle spot treatment not found', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        });
      });

      const result = await generateTasksForSpotTreatment('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ============================================================================
  // getGroupedTasks
  // ============================================================================
  describe('getGroupedTasks', () => {
    it('should return tasks grouped by product and week', async () => {
      const mockTasks = [
        {
          ...factories.ipmTask({ id: 't1', product_id: 'p1', calendar_week: 3 }),
          batches: { id: 'b1', batch_number: '2401001', plant_varieties: { name: 'Petunia' } },
          nursery_locations: { id: 'loc-1', name: 'GH A' },
          ipm_products: { id: 'p1', name: 'Neem Oil' },
        },
        {
          ...factories.ipmTask({ id: 't2', product_id: 'p1', calendar_week: 3 }),
          batches: { id: 'b2', batch_number: '2401002', plant_varieties: { name: 'Petunia' } },
          nursery_locations: { id: 'loc-1', name: 'GH A' },
          ipm_products: { id: 'p1', name: 'Neem Oil' },
        },
        {
          ...factories.ipmTask({ id: 't3', product_id: 'p2', calendar_week: 3 }),
          batches: { id: 'b3', batch_number: '2401003', plant_varieties: { name: 'Marigold' } },
          nursery_locations: { id: 'loc-2', name: 'GH B' },
          ipm_products: { id: 'p2', name: 'Pyrethrin' },
        },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTasks, error: null });
      });

      const result = await getGroupedTasks({ status: 'pending' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2); // Two groups: p1/week3 and p2/week3
      
      const neemOilGroup = result.data!.find(g => g.productName === 'Neem Oil');
      expect(neemOilGroup?.totalBatches).toBe(2);
      expect(neemOilGroup?.locations).toHaveLength(1);
    });

    it('should group tank mixes together', async () => {
      const tankMixGroupId = 'tank-mix-1';
      const mockTasks = [
        {
          ...factories.ipmTask({
            id: 't1',
            product_id: 'p1',
            product_name: 'Neem Oil',
            is_tank_mix: true,
            tank_mix_group_id: tankMixGroupId,
            calendar_week: 3,
          }),
          batches: { id: 'b1', batch_number: '2401001', plant_varieties: { name: 'Petunia' } },
          nursery_locations: { id: 'loc-1', name: 'GH A' },
          ipm_products: { id: 'p1', name: 'Neem Oil' },
        },
        {
          ...factories.ipmTask({
            id: 't2',
            product_id: 'p2',
            product_name: 'Pyrethrin',
            is_tank_mix: true,
            tank_mix_group_id: tankMixGroupId,
            calendar_week: 3,
          }),
          batches: { id: 'b1', batch_number: '2401001', plant_varieties: { name: 'Petunia' } },
          nursery_locations: { id: 'loc-1', name: 'GH A' },
          ipm_products: { id: 'p2', name: 'Pyrethrin' },
        },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTasks, error: null });
      });

      const result = await getGroupedTasks();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1); // One tank mix group
      expect(result.data![0].isTankMix).toBe(true);
      expect(result.data![0].tankMixProducts).toContain('Neem Oil');
      expect(result.data![0].tankMixProducts).toContain('Pyrethrin');
    });

    it('should filter by date range', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await getGroupedTasks({
        fromDate: '2024-01-01',
        toDate: '2024-01-31',
      });

      expect(result.success).toBe(true);
    });

    it('should filter by product ID', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await getGroupedTasks({ productId: 'p1' });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // getTasks
  // ============================================================================
  describe('getTasks', () => {
    it('should return tasks with all filters', async () => {
      const mockTasks = [
        {
          ...factories.ipmTask({ id: 't1' }),
          batches: { id: 'b1', batch_number: '2401001', plant_varieties: { name: 'Petunia' } },
          nursery_locations: { id: 'loc-1', name: 'GH A' },
          ipm_products: { id: 'p1', name: 'Neem Oil' },
        },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTasks, error: null });
      });

      const result = await getTasks({
        status: 'pending',
        fromDate: '2024-01-01',
        toDate: '2024-01-31',
        batchId: 'b1',
        locationId: 'loc-1',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  // ============================================================================
  // completeTasks
  // ============================================================================
  describe('completeTasks', () => {
    it('should complete tasks and create health logs', async () => {
      const mockTasks = [
        {
          id: 't1',
          batch_id: 'b1',
          location_id: 'loc-1',
          product_id: 'p1',
          product_name: 'Neem Oil',
          rate: 5,
          rate_unit: 'ml/L',
          method: 'Foliar Spray',
        },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'ipm_tasks') {
          return new MockSupabaseQueryBuilder({ data: mockTasks, error: null });
        }
        if (table === 'plant_health_logs') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await completeTasks(['t1'], {
        notes: 'Applied in good conditions',
        weatherConditions: 'Sunny, 20°C',
      });

      expect(result.success).toBe(true);
    });

    it('should record stock usage when bottle provided', async () => {
      const mockTasks = [
        {
          id: 't1',
          batch_id: 'b1',
          location_id: 'loc-1',
          product_id: 'p1',
          product_name: 'Neem Oil',
        },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTasks, error: null });
      });

      const { recordUsage } = require('../ipm-stock');

      const result = await completeTasks(['t1'], {
        bottleId: 'bottle-1',
        quantityUsedMl: 50,
      });

      expect(result.success).toBe(true);
      expect(recordUsage).toHaveBeenCalledWith({
        bottleId: 'bottle-1',
        quantityMl: 50,
        notes: 'IPM Task completion',
      });
    });

    it('should complete multiple tasks at once', async () => {
      const mockTasks = [
        { id: 't1', batch_id: 'b1', location_id: 'loc-1', product_id: 'p1', product_name: 'Neem Oil' },
        { id: 't2', batch_id: 'b2', location_id: 'loc-1', product_id: 'p1', product_name: 'Neem Oil' },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockTasks, error: null });
      });

      const result = await completeTasks(['t1', 't2']);

      expect(result.success).toBe(true);
    });

    it('should handle database error', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'ipm_tasks') {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Update failed' },
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await completeTasks(['t1']);

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // skipTask
  // ============================================================================
  describe('skipTask', () => {
    it('should skip a task with reason', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await skipTask('t1', 'Batch was shipped');

      expect(result.success).toBe(true);
    });

    it('should handle database error', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Update failed' },
        });
      });

      const result = await skipTask('t1', 'Reason');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Update failed');
    });
  });

  // ============================================================================
  // markOverdueTasks
  // ============================================================================
  describe('markOverdueTasks', () => {
    it('should mark pending tasks as overdue', async () => {
      const mockUpdated = [{ id: 't1' }, { id: 't2' }];

      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockUpdated, error: null });
      });

      const result = await markOverdueTasks();

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(2);
    });

    it('should handle no overdue tasks', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await markOverdueTasks();

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(0);
    });
  });

  // ============================================================================
  // bulkGenerateTasks
  // ============================================================================
  describe('bulkGenerateTasks', () => {
    it('should generate tasks for all batches with matching programs', async () => {
      const mockAssignments = [
        {
          id: 'assign-1',
          target_type: 'family',
          target_family: 'Bedding',
          program_id: 'prog-1',
          ipm_programs: {
            id: 'prog-1',
            name: 'Bedding Program',
            ipm_program_steps: [
              {
                id: 'step-1',
                product_id: 'p1',
                week_number: 1,
                ipm_products: { id: 'p1', name: 'Neem Oil' },
              },
            ],
          },
        },
      ];

      const mockBatches = [
        {
          id: 'b1',
          batch_number: '2401001',
          planted_at: '2024-01-01',
          location_id: 'loc-1',
          plant_variety: { id: 'var-1', name: 'Petunia', family: 'Bedding' },
        },
        {
          id: 'b2',
          batch_number: '2401002',
          planted_at: '2024-01-08',
          location_id: 'loc-1',
          plant_variety: { id: 'var-2', name: 'Marigold', family: 'Bedding' },
        },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'ipm_assignments') {
          return new MockSupabaseQueryBuilder({ data: mockAssignments, error: null });
        }
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
        }
        if (table === 'ipm_tasks') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await bulkGenerateTasks();

      expect(result.success).toBe(true);
      expect(result.data?.batchesProcessed).toBeGreaterThanOrEqual(0);
    });

    it('should clear existing pending tasks when requested', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'ipm_tasks') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        if (table === 'ipm_assignments') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await bulkGenerateTasks({ clearExisting: true });

      expect(result.success).toBe(true);
    });

    it('should return 0 when no assignments exist', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'ipm_assignments') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await bulkGenerateTasks();

      expect(result.success).toBe(true);
      expect(result.data?.batchesProcessed).toBe(0);
      expect(result.data?.tasksCreated).toBe(0);
    });
  });
});




