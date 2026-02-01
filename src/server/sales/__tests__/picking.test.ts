/**
 * Integration tests for picking service
 * Tests the task generation when pick lists are created and managed
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

jest.mock('@/server/db/supabase', () => ({
  getSupabaseServerApp: jest.fn(() => Promise.resolve(mockSupabase)),
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

// Mock generateInvoice
jest.mock('@/app/sales/actions', () => ({
  generateInvoice: jest.fn(() => Promise.resolve({ error: null })),
}));

// Mock the tasks service to verify it's called correctly
const mockCreateTask = jest.fn();
const mockUpdateTask = jest.fn();
const mockDeleteTaskBySourceRef = jest.fn();
const mockGetTaskBySourceRef = jest.fn();

jest.mock('@/server/tasks/service', () => ({
  createTask: (...args: unknown[]) => mockCreateTask(...args),
  updateTask: (...args: unknown[]) => mockUpdateTask(...args),
  deleteTaskBySourceRef: (...args: unknown[]) => mockDeleteTaskBySourceRef(...args),
  getTaskBySourceRef: (...args: unknown[]) => mockGetTaskBySourceRef(...args),
}));

import {
  createPickList,
  startPickList,
  completePickList,
  assignPickListToTeam,
  deletePickList,
  cancelPickList,
  getPickListById,
  getPickListsForOrg,
} from '../picking';

// ============================================================================
// Test Data Factories
// ============================================================================

const createPickListRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'pick-1',
  org_id: mockOrgId,
  order_id: 'order-1',
  assigned_team_id: null,
  assigned_user_id: null,
  sequence: 1,
  status: 'pending',
  started_at: null,
  completed_at: null,
  started_by: null,
  completed_by: null,
  notes: null,
  created_at: '2024-01-01T00:00:00.000Z',
  orders: {
    order_number: 'ORD-001',
    status: 'confirmed',
    requested_delivery_date: '2024-01-20',
    customer_id: 'cust-1',
    customers: { name: 'Test Customer' },
    customer_addresses: { county: 'Dublin' },
  },
  picking_teams: null,
  ...overrides,
});

const createOrderItemRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'item-1',
  quantity: 50,
  skus: { plant_variety_id: 'var-1', size_id: 'size-1' },
  product_id: 'prod-1',
  ...overrides,
});

describe('picking service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockCreateTask.mockResolvedValue({
      id: 'task-1',
      orgId: mockOrgId,
      sourceModule: 'dispatch',
      sourceRefType: 'pick_list',
      sourceRefId: 'pick-1',
      title: 'Pick Order #ORD-001',
      status: 'pending',
    });

    mockGetTaskBySourceRef.mockResolvedValue({
      id: 'task-1',
      status: 'pending',
    });

    mockUpdateTask.mockResolvedValue({
      id: 'task-1',
      status: 'in_progress',
    });
  });

  // ============================================================================
  // createPickList - CRITICAL: Tests task creation
  // ============================================================================
  describe('createPickList', () => {
    it('should create a pick list and associated task', async () => {
      const mockPickList = createPickListRow({ id: 'new-pick' });
      const mockOrderItems = [
        createOrderItemRow({ id: 'item-1', quantity: 50 }),
        createOrderItemRow({ id: 'item-2', quantity: 30 }),
      ];

      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (table === 'pick_lists' && callCount === 1) {
          // Get max sequence
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        if (table === 'pick_lists' && callCount === 2) {
          // Insert pick list
          return new MockSupabaseQueryBuilder({ data: mockPickList, error: null });
        }
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({
            data: {
              order_number: 'ORD-001',
              requested_delivery_date: '2024-01-20',
              customers: { name: 'Test Customer' },
            },
            error: null,
          });
        }
        if (table === 'order_items') {
          return new MockSupabaseQueryBuilder({ data: mockOrderItems, error: null });
        }
        if (table === 'pick_items') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        if (table === 'pick_list_events') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await createPickList({ orderId: 'order-1' });

      expect(result.pickList).toBeDefined();
      expect(result.error).toBeUndefined();

      // Verify task was created
      expect(mockCreateTask).toHaveBeenCalledWith({
        sourceModule: 'dispatch',
        sourceRefType: 'pick_list',
        sourceRefId: 'new-pick',
        title: 'Pick Order #ORD-001 - Test Customer',
        description: expect.stringContaining('Pick list for order ORD-001'),
        taskType: 'picking',
        assignedTeamId: undefined,
        scheduledDate: '2024-01-20',
        plantQuantity: 80, // 50 + 30
      });
    });

    it('should create a pick list with team assignment', async () => {
      const mockPickList = createPickListRow({
        id: 'new-pick',
        assigned_team_id: 'team-1',
      });

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'pick_lists') {
          return new MockSupabaseQueryBuilder({ data: mockPickList, error: null });
        }
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({
            data: {
              order_number: 'ORD-001',
              requested_delivery_date: '2024-01-20',
              customers: { name: 'Test Customer' },
            },
            error: null,
          });
        }
        if (table === 'order_items') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await createPickList({
        orderId: 'order-1',
        assignedTeamId: 'team-1',
      });

      expect(result.pickList?.assignedTeamId).toBe('team-1');

      // Verify task was created with team assignment
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedTeamId: 'team-1',
        })
      );
    });

    it('should handle database error gracefully', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'pick_lists') {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Database error' },
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await createPickList({ orderId: 'order-1' });

      expect(result.error).toBe('Database error');
      expect(result.pickList).toBeUndefined();
    });
  });

  // ============================================================================
  // startPickList
  // ============================================================================
  describe('startPickList', () => {
    it('should start a pick list and update the task', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await startPickList('pick-1');

      expect(result.error).toBeUndefined();

      // Verify task lookup and update
      expect(mockGetTaskBySourceRef).toHaveBeenCalledWith('dispatch', 'pick_list', 'pick-1');
      expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { status: 'in_progress' });
    });

    it('should handle missing task gracefully', async () => {
      mockGetTaskBySourceRef.mockResolvedValue(null);

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await startPickList('pick-1');

      expect(result.error).toBeUndefined();
      expect(mockUpdateTask).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // completePickList
  // ============================================================================
  describe('completePickList', () => {
    it('should complete a pick list and update the task', async () => {
      // Mock the RPC call for complete_pick_list
      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: { success: true },
        error: null,
      });

      // Mock pick_list_events for logging
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'pick_list_events') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await completePickList('pick-1');

      expect(result.error).toBeUndefined();

      // Verify RPC was called with correct params
      expect(mockSupabase.rpc).toHaveBeenCalledWith('complete_pick_list', {
        p_org_id: mockOrgId,
        p_pick_list_id: 'pick-1',
        p_user_id: mockUser.id,
      });

      // Verify task update
      expect(mockGetTaskBySourceRef).toHaveBeenCalledWith('dispatch', 'pick_list', 'pick-1');
      expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { status: 'completed' });
    });

    it('should reject completion if items are still pending', async () => {
      // Mock the RPC call to return error for pending items
      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: { success: false, error: '2 items still pending' },
        error: null,
      });

      const result = await completePickList('pick-1');

      expect(result.error).toBe('2 items still pending');
      expect(mockUpdateTask).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // assignPickListToTeam
  // ============================================================================
  describe('assignPickListToTeam', () => {
    it('should assign a pick list to a team and update the task', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await assignPickListToTeam('pick-1', 'team-1');

      expect(result.error).toBeUndefined();

      // Verify task update with team assignment
      expect(mockGetTaskBySourceRef).toHaveBeenCalledWith('dispatch', 'pick_list', 'pick-1');
      expect(mockUpdateTask).toHaveBeenCalledWith('task-1', {
        assignedTeamId: 'team-1',
        status: 'assigned',
      });
    });

    it('should unassign a pick list from a team', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await assignPickListToTeam('pick-1', null);

      expect(result.error).toBeUndefined();

      // Verify task update with null team
      expect(mockUpdateTask).toHaveBeenCalledWith('task-1', {
        assignedTeamId: null,
        status: 'pending',
      });
    });
  });

  // ============================================================================
  // deletePickList
  // ============================================================================
  describe('deletePickList', () => {
    it('should delete a pick list and its associated task', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await deletePickList('pick-1');

      expect(result.error).toBeUndefined();

      // Verify task deletion
      expect(mockDeleteTaskBySourceRef).toHaveBeenCalledWith(
        'dispatch',
        'pick_list',
        'pick-1'
      );
    });

    it('should handle task deletion failure gracefully', async () => {
      mockDeleteTaskBySourceRef.mockRejectedValue(new Error('Task not found'));

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      // Should not throw even if task deletion fails
      const result = await deletePickList('pick-1');

      expect(result.error).toBeUndefined();
    });
  });

  // ============================================================================
  // cancelPickList
  // ============================================================================
  describe('cancelPickList', () => {
    it('should cancel a pick list and update the task', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await cancelPickList('pick-1');

      expect(result.error).toBeUndefined();

      // Verify task update
      expect(mockGetTaskBySourceRef).toHaveBeenCalledWith('dispatch', 'pick_list', 'pick-1');
      expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { status: 'cancelled' });
    });
  });

  // ============================================================================
  // getPickListById
  // ============================================================================
  describe('getPickListById', () => {
    it('should return a pick list by ID', async () => {
      const mockPickList = createPickListRow({ id: 'pick-1' });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockPickList, error: null });
      });

      const result = await getPickListById('pick-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('pick-1');
      expect(result?.orderNumber).toBe('ORD-001');
      expect(result?.customerName).toBe('Test Customer');
    });

    it('should return null for non-existent pick list', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Not found' },
        });
      });

      const result = await getPickListById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getPickListsForOrg
  // ============================================================================
  describe('getPickListsForOrg', () => {
    it('should return pick lists for an organization', async () => {
      const mockPickLists = [
        createPickListRow({ id: 'pick-1' }),
        createPickListRow({ id: 'pick-2', orders: { ...createPickListRow().orders, order_number: 'ORD-002' } }),
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockPickLists, error: null });
      });

      const result = await getPickListsForOrg(mockOrgId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('pick-1');
      expect(result[1].id).toBe('pick-2');
    });

    it('should filter by statuses', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getPickListsForOrg(mockOrgId, { statuses: ['pending', 'in_progress'] });

      expect(mockSupabase.from).toHaveBeenCalledWith('pick_lists');
    });

    it('should filter by teamId', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getPickListsForOrg(mockOrgId, { teamId: 'team-1' });

      expect(mockSupabase.from).toHaveBeenCalledWith('pick_lists');
    });

    it('should apply limit', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await getPickListsForOrg(mockOrgId, { limit: 10 });

      expect(mockSupabase.from).toHaveBeenCalledWith('pick_lists');
    });
  });

  // ============================================================================
  // Field mapping
  // ============================================================================
  describe('Field mapping', () => {
    it('should correctly map pick list fields', async () => {
      const fullRow = createPickListRow({
        id: 'pick-full',
        org_id: mockOrgId,
        order_id: 'order-1',
        assigned_team_id: 'team-1',
        assigned_user_id: 'user-1',
        sequence: 5,
        status: 'in_progress',
        started_at: '2024-01-15T10:00:00.000Z',
        completed_at: null,
        started_by: 'user-1',
        completed_by: null,
        notes: 'Test notes',
        created_at: '2024-01-14T00:00:00.000Z',
        orders: {
          order_number: 'ORD-FULL',
          status: 'picking',
          requested_delivery_date: '2024-01-20',
          customer_id: 'cust-1',
          customers: { name: 'Full Customer' },
          customer_addresses: { county: 'Cork' },
        },
        picking_teams: { name: 'Team Alpha' },
      });

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: fullRow, error: null });
      });

      const result = await getPickListById('pick-full');

      expect(result).toMatchObject({
        id: 'pick-full',
        orgId: mockOrgId,
        orderId: 'order-1',
        assignedTeamId: 'team-1',
        assignedUserId: 'user-1',
        sequence: 5,
        status: 'in_progress',
        startedAt: '2024-01-15T10:00:00.000Z',
        completedAt: null,
        startedBy: 'user-1',
        completedBy: null,
        notes: 'Test notes',
        createdAt: '2024-01-14T00:00:00.000Z',
        orderNumber: 'ORD-FULL',
        orderStatus: 'picking',
        customerName: 'Full Customer',
        requestedDeliveryDate: '2024-01-20',
        teamName: 'Team Alpha',
        county: 'Cork',
      });
    });
  });
});

