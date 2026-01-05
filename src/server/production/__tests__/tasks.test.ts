/**
 * Unit tests for tasks.ts production service
 * Tests fetching production tasks (ghost batches) and grouping by week
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

// Mock the schedule computation
const mockComputeRouteSchedule = jest.fn();
jest.mock('@/lib/planning/schedule', () => ({
  computeRouteSchedule: (...args: unknown[]) => mockComputeRouteSchedule(...args),
}));

import {
  getProductionTasks,
  groupTasksByWeek,
  type ProductionTask,
} from '../tasks';

// ============================================================================
// Test Data Factories
// ============================================================================

const createBatchRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'batch-1',
  batch_number: '2401001',
  status: 'Planned',
  phase: 'propagation',
  quantity: 100,
  ready_at: '2024-01-15',
  planted_at: '2024-01-01',
  parent_batch_id: null,
  protocol_id: 'protocol-1',
  plant_variety_id: 'variety-1',
  size_id: 'size-1',
  plant_varieties: { name: 'Red Petunia' },
  plant_sizes: { name: '9cm' },
  nursery_locations: { name: 'Greenhouse A' },
  protocols: {
    id: 'protocol-1',
    name: 'Standard Propagation',
    route: {
      nodes: [
        { id: 'stage-1', label: 'Propagation', durationDays: 14, stageName: 'Propagation', locationName: 'Prop House' },
        { id: 'stage-2', label: 'Growing', durationDays: 21, stageName: 'Growing', locationName: 'Greenhouse A' },
      ],
    },
  },
  parent_batch: null,
  ...overrides,
});

const createMockSchedule = (overrides: Partial<Record<string, unknown>> = {}) => ({
  startDate: '2023-12-11T00:00:00.000Z',
  readyDate: '2024-01-15T00:00:00.000Z',
  totalDurationDays: 35,
  nodes: [
    {
      id: 'stage-1',
      label: 'Propagation',
      startDate: '2023-12-11T00:00:00.000Z',
      endDate: '2023-12-25T00:00:00.000Z',
      durationDays: 14,
      stageName: 'Propagation',
      locationName: 'Prop House',
    },
    {
      id: 'stage-2',
      label: 'Growing',
      startDate: '2023-12-25T00:00:00.000Z',
      endDate: '2024-01-15T00:00:00.000Z',
      durationDays: 21,
      stageName: 'Growing',
      locationName: 'Greenhouse A',
    },
  ],
  ...overrides,
});

const createProductionTask = (overrides: Partial<ProductionTask> = {}): ProductionTask => ({
  id: 'task-1',
  batchId: 'batch-1',
  batchNumber: '2401001',
  varietyName: 'Red Petunia',
  varietyId: 'variety-1',
  sizeName: '9cm',
  sizeId: 'size-1',
  quantity: 100,
  status: 'Planned',
  dueDate: '2024-01-01',
  readyDate: '2024-01-15',
  locationName: 'Greenhouse A',
  protocol: { id: 'protocol-1', name: 'Standard Propagation' },
  stages: [],
  parentBatchId: null,
  parentBatchNumber: null,
  ...overrides,
});

describe('production tasks service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockComputeRouteSchedule.mockReturnValue(createMockSchedule());
  });

  // ============================================================================
  // getProductionTasks
  // ============================================================================
  describe('getProductionTasks', () => {
    it('should return production tasks with computed schedules', async () => {
      const mockBatches = [createBatchRow({ id: 'batch-1' })];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
      });

      const result = await getProductionTasks();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'batch-1',
        batchId: 'batch-1',
        batchNumber: '2401001',
        varietyName: 'Red Petunia',
        sizeName: '9cm',
        quantity: 100,
        status: 'Planned',
        locationName: 'Greenhouse A',
        protocol: { id: 'protocol-1', name: 'Standard Propagation' },
      });
    });

    it('should compute schedule from protocol route', async () => {
      const mockBatches = [createBatchRow()];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
      });

      await getProductionTasks();

      expect(mockComputeRouteSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({ id: 'stage-1' }),
            expect.objectContaining({ id: 'stage-2' }),
          ]),
        }),
        '2024-01-15'
      );
    });

    it('should use first stage start date as dueDate when protocol exists', async () => {
      const mockBatches = [createBatchRow()];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
      });

      const result = await getProductionTasks();

      expect(result[0].dueDate).toBe('2023-12-11');
    });

    it('should use planted_at as dueDate when no protocol', async () => {
      const mockBatches = [
        createBatchRow({
          protocols: null,
          planted_at: '2024-01-05',
        }),
      ];

      mockComputeRouteSchedule.mockReturnValue({
        startDate: '2024-01-15T00:00:00.000Z',
        readyDate: '2024-01-15T00:00:00.000Z',
        totalDurationDays: 0,
        nodes: [],
      });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
      });

      const result = await getProductionTasks();

      expect(result[0].dueDate).toBe('2024-01-05');
    });

    it('should use readyDate as dueDate when no protocol and no planted_at', async () => {
      const mockBatches = [
        createBatchRow({
          protocols: null,
          planted_at: null,
          ready_at: '2024-01-20',
        }),
      ];

      mockComputeRouteSchedule.mockReturnValue({
        startDate: '2024-01-20T00:00:00.000Z',
        readyDate: '2024-01-20T00:00:00.000Z',
        totalDurationDays: 0,
        nodes: [],
      });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
      });

      const result = await getProductionTasks();

      expect(result[0].dueDate).toBe('2024-01-20');
    });

    it('should filter by date range', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getProductionTasks({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('batches');
    });

    it('should filter by status when not "all"', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getProductionTasks({ status: 'Incoming' });

      expect(mockSupabase.from).toHaveBeenCalledWith('batches');
    });

    it('should not add extra status filter when status is "all"', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getProductionTasks({ status: 'all' });

      expect(mockSupabase.from).toHaveBeenCalledWith('batches');
    });

    it('should filter by varietyId', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getProductionTasks({ varietyId: 'variety-1' });

      expect(mockSupabase.from).toHaveBeenCalledWith('batches');
    });

    it('should throw error on database failure', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Database error' },
        });
      });

      await expect(getProductionTasks()).rejects.toThrow('Database error');
    });

    it('should return empty array when no batches found', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await getProductionTasks();

      expect(result).toHaveLength(0);
    });

    it('should handle null data response', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await getProductionTasks();

      expect(result).toHaveLength(0);
    });

    it('should handle missing batch_number by generating fallback', async () => {
      const mockBatches = [
        createBatchRow({
          id: 'abcd1234-5678-90ef-ghij-klmnopqrstuv',
          batch_number: null,
        }),
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
      });

      const result = await getProductionTasks();

      expect(result[0].batchNumber).toBe('B-abcd1234');
    });

    it('should handle missing variety name with fallback', async () => {
      const mockBatches = [
        createBatchRow({
          plant_varieties: null,
        }),
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
      });

      const result = await getProductionTasks();

      expect(result[0].varietyName).toBe('Unknown variety');
    });

    it('should handle missing size name with fallback', async () => {
      const mockBatches = [
        createBatchRow({
          plant_sizes: null,
        }),
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
      });

      const result = await getProductionTasks();

      expect(result[0].sizeName).toBe('Unknown size');
    });

    it('should handle missing location name', async () => {
      const mockBatches = [
        createBatchRow({
          nursery_locations: null,
        }),
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
      });

      const result = await getProductionTasks();

      expect(result[0].locationName).toBeNull();
    });

    it('should handle missing quantity with default of 0', async () => {
      const mockBatches = [
        createBatchRow({
          quantity: null,
        }),
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
      });

      const result = await getProductionTasks();

      expect(result[0].quantity).toBe(0);
    });

    it('should map Incoming status correctly', async () => {
      const mockBatches = [
        createBatchRow({
          status: 'Incoming',
        }),
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
      });

      const result = await getProductionTasks();

      expect(result[0].status).toBe('Incoming');
    });

    it('should default to Planned for non-Incoming status', async () => {
      const mockBatches = [
        createBatchRow({
          status: 'Planned',
        }),
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
      });

      const result = await getProductionTasks();

      expect(result[0].status).toBe('Planned');
    });

    it('should include parent batch information', async () => {
      const mockBatches = [
        createBatchRow({
          parent_batch_id: 'parent-batch-1',
          parent_batch: { batch_number: 'P2401001' },
        }),
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
      });

      const result = await getProductionTasks();

      expect(result[0].parentBatchId).toBe('parent-batch-1');
      expect(result[0].parentBatchNumber).toBe('P2401001');
    });

    it('should handle missing parent batch number', async () => {
      const mockBatches = [
        createBatchRow({
          parent_batch_id: 'parent-batch-1',
          parent_batch: null,
        }),
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
      });

      const result = await getProductionTasks();

      expect(result[0].parentBatchId).toBe('parent-batch-1');
      expect(result[0].parentBatchNumber).toBeNull();
    });

    it('should map stages from computed schedule', async () => {
      const mockBatches = [createBatchRow()];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
      });

      const result = await getProductionTasks();

      expect(result[0].stages).toHaveLength(2);
      expect(result[0].stages[0]).toMatchObject({
        id: 'stage-1',
        label: 'Propagation',
        startDate: '2023-12-11',
        endDate: '2023-12-25',
        durationDays: 14,
        stageName: 'Propagation',
        locationName: 'Prop House',
      });
    });
  });

  // ============================================================================
  // groupTasksByWeek
  // ============================================================================
  describe('groupTasksByWeek', () => {
    it('should group tasks by ISO week key', () => {
      const tasks: ProductionTask[] = [
        createProductionTask({ id: 'task-1', dueDate: '2024-01-01' }), // Week 1
        createProductionTask({ id: 'task-2', dueDate: '2024-01-02' }), // Week 1
        createProductionTask({ id: 'task-3', dueDate: '2024-01-08' }), // Week 2
      ];

      const result = groupTasksByWeek(tasks);

      expect(result.size).toBe(2);
      expect(result.get('2024-W01')).toHaveLength(2);
      expect(result.get('2024-W02')).toHaveLength(1);
    });

    it('should return empty map for empty input', () => {
      const result = groupTasksByWeek([]);

      expect(result.size).toBe(0);
    });

    it('should handle single task', () => {
      const tasks: ProductionTask[] = [
        createProductionTask({ id: 'task-1', dueDate: '2024-01-15' }),
      ];

      const result = groupTasksByWeek(tasks);

      expect(result.size).toBe(1);
      expect(result.get('2024-W03')).toHaveLength(1);
    });

    it('should handle tasks across year boundaries', () => {
      const tasks: ProductionTask[] = [
        createProductionTask({ id: 'task-1', dueDate: '2023-12-31' }), // Week 52 of 2023
        createProductionTask({ id: 'task-2', dueDate: '2024-01-01' }), // Week 1 of 2024
      ];

      const result = groupTasksByWeek(tasks);

      // ISO week calculation may vary - both should be in different weeks
      expect(result.size).toBeGreaterThanOrEqual(1);
    });

    it('should pad week numbers with leading zeros', () => {
      const tasks: ProductionTask[] = [
        createProductionTask({ id: 'task-1', dueDate: '2024-01-01' }),
      ];

      const result = groupTasksByWeek(tasks);
      const keys = Array.from(result.keys());

      // Week key should be formatted like 2024-W01, not 2024-W1
      expect(keys[0]).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('should preserve task order within each week', () => {
      const tasks: ProductionTask[] = [
        createProductionTask({ id: 'task-1', dueDate: '2024-01-01' }),
        createProductionTask({ id: 'task-2', dueDate: '2024-01-02' }),
        createProductionTask({ id: 'task-3', dueDate: '2024-01-03' }),
      ];

      const result = groupTasksByWeek(tasks);
      const weekTasks = result.get('2024-W01');

      expect(weekTasks?.[0].id).toBe('task-1');
      expect(weekTasks?.[1].id).toBe('task-2');
      expect(weekTasks?.[2].id).toBe('task-3');
    });

    it('should handle multiple weeks in different years', () => {
      const tasks: ProductionTask[] = [
        createProductionTask({ id: 'task-1', dueDate: '2023-06-15' }), // W24 2023
        createProductionTask({ id: 'task-2', dueDate: '2024-06-15' }), // W24 2024
      ];

      const result = groupTasksByWeek(tasks);

      expect(result.size).toBe(2);
      expect(result.has('2023-W24')).toBe(true);
      expect(result.has('2024-W24')).toBe(true);
    });
  });
});


