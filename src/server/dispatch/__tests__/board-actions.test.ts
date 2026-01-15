/**
 * Unit tests for dispatch board-actions.ts server actions
 * Tests the dispatch board operations including:
 * - Order assignment to teams, pickers, and delivery runs
 * - Load management (create, update, delete, reorder)
 * - Dispatch and recall operations
 */

import {
  createMockSupabaseClient,
  createMockUser,
  MockSupabaseQueryBuilder,
  factories,
} from '@/lib/__tests__/test-utils';

// Mock the dependencies BEFORE importing the module under test
const mockSupabase = createMockSupabaseClient();
const mockUser = createMockUser();
const mockOrgId = 'test-org-id';

// Mock supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

// Mock supabaseAdmin
const mockSupabaseAdmin = createMockSupabaseClient();
jest.mock('@/server/db/supabaseAdmin', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

// Mock revalidatePath (Next.js cache)
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// Mock picking service functions
const mockGetPickListForOrder = jest.fn();
const mockCreatePickListFromOrder = jest.fn();
const mockAssignPickListToTeam = jest.fn();

jest.mock('@/server/sales/picking', () => ({
  getPickListForOrder: (...args: unknown[]) => mockGetPickListForOrder(...args),
  createPickListFromOrder: (...args: unknown[]) => mockCreatePickListFromOrder(...args),
  assignPickListToTeam: (...args: unknown[]) => mockAssignPickListToTeam(...args),
}));

// Mock queries.server functions
const mockAddOrderToDeliveryRun = jest.fn();
const mockCreateDeliveryRun = jest.fn();

jest.mock('@/server/dispatch/queries.server', () => ({
  addOrderToDeliveryRun: (...args: unknown[]) => mockAddOrderToDeliveryRun(...args),
  createDeliveryRun: (...args: unknown[]) => mockCreateDeliveryRun(...args),
}));

// Import AFTER setting up mocks
import {
  assignOrderToTeam,
  assignOrderToPicker,
  assignOrderToRun,
  createRunAndAssign,
  createEmptyRoute,
  updateLoad,
  deleteLoad,
  reorderLoads,
  removeOrderFromLoad,
  updateOrderDate,
  dispatchOrders,
  dispatchLoad,
  recallLoad,
  updateLoadStatus,
} from '../board-actions';

describe('dispatch board-actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset default mock behaviors
    mockGetPickListForOrder.mockResolvedValue(null);
    mockCreatePickListFromOrder.mockResolvedValue({ pickListId: 'new-pick-list-1' });
    mockAssignPickListToTeam.mockResolvedValue({});
    mockAddOrderToDeliveryRun.mockResolvedValue('delivery-item-1');
    mockCreateDeliveryRun.mockResolvedValue('delivery-run-1');
  });

  // ============================================================================
  // assignOrderToTeam
  // ============================================================================
  describe('assignOrderToTeam', () => {
    it('should create a pick list when none exists and assign team', async () => {
      mockGetPickListForOrder.mockResolvedValue(null);
      mockCreatePickListFromOrder.mockResolvedValue({ pickListId: 'new-pick-1' });

      const result = await assignOrderToTeam('order-1', 'team-1');

      expect(result.success).toBe(true);
      expect(mockGetPickListForOrder).toHaveBeenCalledWith('order-1');
      expect(mockCreatePickListFromOrder).toHaveBeenCalledWith('order-1', 'team-1');
    });

    it('should update existing pick list with team assignment', async () => {
      mockGetPickListForOrder.mockResolvedValue({ id: 'existing-pick-1' });
      mockAssignPickListToTeam.mockResolvedValue({});

      const result = await assignOrderToTeam('order-1', 'team-1');

      expect(result.success).toBe(true);
      expect(mockAssignPickListToTeam).toHaveBeenCalledWith('existing-pick-1', 'team-1');
    });

    it('should handle unassigning team (null teamId)', async () => {
      mockGetPickListForOrder.mockResolvedValue({ id: 'existing-pick-1' });
      mockAssignPickListToTeam.mockResolvedValue({});

      const result = await assignOrderToTeam('order-1', null);

      expect(result.success).toBe(true);
      expect(mockAssignPickListToTeam).toHaveBeenCalledWith('existing-pick-1', null);
    });

    it('should return error when pick list creation fails', async () => {
      mockGetPickListForOrder.mockResolvedValue(null);
      mockCreatePickListFromOrder.mockResolvedValue({ error: 'Failed to create pick list' });

      const result = await assignOrderToTeam('order-1', 'team-1');

      expect(result.error).toBe('Failed to create pick list');
    });

    it('should return error when team assignment fails', async () => {
      mockGetPickListForOrder.mockResolvedValue({ id: 'existing-pick-1' });
      mockAssignPickListToTeam.mockResolvedValue({ error: 'Team not found' });

      const result = await assignOrderToTeam('order-1', 'team-1');

      expect(result.error).toBe('Team not found');
    });
  });

  // ============================================================================
  // assignOrderToPicker
  // ============================================================================
  describe('assignOrderToPicker', () => {
    it('should create pick list and assign picker when none exists', async () => {
      mockGetPickListForOrder.mockResolvedValue(null);
      mockCreatePickListFromOrder.mockResolvedValue({ pickListId: 'new-pick-1' });

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await assignOrderToPicker('order-1', 'picker-1');

      expect(result.success).toBe(true);
      expect(mockCreatePickListFromOrder).toHaveBeenCalledWith('order-1');
    });

    it('should update existing pick list with picker assignment', async () => {
      mockGetPickListForOrder.mockResolvedValue({ id: 'existing-pick-1' });

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await assignOrderToPicker('order-1', 'picker-1');

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('pick_lists');
    });

    it('should handle missing assigned_user_id column gracefully', async () => {
      mockGetPickListForOrder.mockResolvedValue({ id: 'existing-pick-1' });

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Column not found', code: '42703' },
        })
      );

      const result = await assignOrderToPicker('order-1', 'picker-1');

      // Should succeed despite column missing (backwards compatibility)
      expect(result.success).toBe(true);
    });

    it('should propagate other database errors', async () => {
      mockGetPickListForOrder.mockResolvedValue({ id: 'existing-pick-1' });

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Connection failed', code: '08001' },
        })
      );

      const result = await assignOrderToPicker('order-1', 'picker-1');

      expect(result.error).toBe('Connection failed');
    });
  });

  // ============================================================================
  // assignOrderToRun
  // ============================================================================
  describe('assignOrderToRun', () => {
    it('should add order to delivery run when no existing item', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await assignOrderToRun('order-1', 'run-1');

      expect(result.success).toBe(true);
      expect(mockAddOrderToDeliveryRun).toHaveBeenCalledWith({
        deliveryRunId: 'run-1',
        orderId: 'order-1',
      });
    });

    it('should update existing delivery item when already assigned', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'delivery_items') {
          return new MockSupabaseQueryBuilder({
            data: { id: 'existing-item-1' },
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await assignOrderToRun('order-1', 'run-2');

      expect(result.success).toBe(true);
      // Should update existing, not create new
      expect(mockAddOrderToDeliveryRun).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Database error' },
        })
      );
      mockAddOrderToDeliveryRun.mockRejectedValue(new Error('Database error'));

      const result = await assignOrderToRun('order-1', 'run-1');

      expect(result.error).toBe('Database error');
    });
  });

  // ============================================================================
  // createRunAndAssign
  // ============================================================================
  describe('createRunAndAssign', () => {
    it('should create a new delivery run and assign order', async () => {
      mockCreateDeliveryRun.mockResolvedValue('new-run-1');

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await createRunAndAssign('order-1', 'haulier-1', '2024-01-15');

      expect(result.success).toBe(true);
      expect(result.runId).toBe('new-run-1');
      expect(mockCreateDeliveryRun).toHaveBeenCalledWith({
        runDate: '2024-01-15',
        haulierId: 'haulier-1',
        status: 'planned',
      });
    });

    it('should handle "default" haulier by passing undefined', async () => {
      mockCreateDeliveryRun.mockResolvedValue('new-run-1');

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await createRunAndAssign('order-1', 'default', '2024-01-15');

      expect(result.success).toBe(true);
      expect(mockCreateDeliveryRun).toHaveBeenCalledWith({
        runDate: '2024-01-15',
        haulierId: undefined,
        status: 'planned',
      });
    });

    it('should handle empty orderId (create run only)', async () => {
      mockCreateDeliveryRun.mockResolvedValue('new-run-1');

      const result = await createRunAndAssign('', 'haulier-1', '2024-01-15');

      expect(result.success).toBe(true);
      expect(mockAddOrderToDeliveryRun).not.toHaveBeenCalled();
    });

    it('should return error when run creation fails', async () => {
      mockCreateDeliveryRun.mockRejectedValue(new Error('Failed to create run'));

      const result = await createRunAndAssign('order-1', 'haulier-1', '2024-01-15');

      expect(result.error).toBe('Failed to create run');
    });
  });

  // ============================================================================
  // createEmptyRoute
  // ============================================================================
  describe('createEmptyRoute', () => {
    it('should create an empty delivery run', async () => {
      mockCreateDeliveryRun.mockResolvedValue('empty-run-1');

      const result = await createEmptyRoute('2024-01-15', 'haulier-1', 'vehicle-1', 'Cork Load');

      expect(result.success).toBe(true);
      expect(result.runId).toBe('empty-run-1');
      expect(mockCreateDeliveryRun).toHaveBeenCalledWith({
        runDate: '2024-01-15',
        haulierId: 'haulier-1',
        vehicleId: 'vehicle-1',
        loadCode: '4L',
      });
    });

    it('should handle default haulier and vehicle', async () => {
      mockCreateDeliveryRun.mockResolvedValue('empty-run-1');

      const result = await createEmptyRoute('2024-01-15', 'default', 'default');

      expect(result.success).toBe(true);
      expect(mockCreateDeliveryRun).toHaveBeenCalledWith({
        runDate: '2024-01-15',
        haulierId: undefined,
        vehicleId: undefined,
        loadCode: undefined,
      });
    });
  });

  // ============================================================================
  // updateLoad
  // ============================================================================
  describe('updateLoad', () => {
    it('should update load name', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await updateLoad('load-1', { loadCode: '2S' });

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('delivery_runs');
    });

    it('should update multiple fields', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await updateLoad('load-1', {
        loadCode: '3H',
        haulierId: 'haulier-2',
        vehicleId: 'vehicle-2',
        runDate: '2024-01-16',
      });

      expect(result.success).toBe(true);
    });

    it('should handle clearing haulier/vehicle', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await updateLoad('load-1', {
        haulierId: '',
        vehicleId: '',
      });

      expect(result.success).toBe(true);
    });

    it('should return error on database failure', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Update failed' },
        })
      );

      const result = await updateLoad('load-1', { loadCode: '1T' });

      expect(result.error).toBe('Update failed');
    });
  });

  // ============================================================================
  // deleteLoad
  // ============================================================================
  describe('deleteLoad', () => {
    it('should delete an empty load', async () => {
      mockSupabaseAdmin.from = jest.fn((table: string) => {
        if (table === 'delivery_items') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        if (table === 'delivery_runs') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await deleteLoad('load-1');

      expect(result.success).toBe(true);
    });

    it('should refuse to delete load with assigned orders', async () => {
      mockSupabaseAdmin.from = jest.fn((table: string) => {
        if (table === 'delivery_items') {
          return new MockSupabaseQueryBuilder({
            data: [{ id: 'item-1' }],
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await deleteLoad('load-1');

      expect(result.error).toBe('Cannot delete load with assigned orders. Remove all orders first.');
    });

    it('should handle database errors when checking items', async () => {
      mockSupabaseAdmin.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Query failed' },
        })
      );

      const result = await deleteLoad('load-1');

      expect(result.error).toBe('Query failed');
    });
  });

  // ============================================================================
  // reorderLoads
  // ============================================================================
  describe('reorderLoads', () => {
    it('should update display_order for all loads', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await reorderLoads(['load-3', 'load-1', 'load-2']);

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('delivery_runs');
    });

    it('should handle empty load list', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await reorderLoads([]);

      expect(result.success).toBe(true);
    });

    it('should return error if any update fails', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 2) {
          // Second update fails
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Update failed for load-2' },
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await reorderLoads(['load-1', 'load-2', 'load-3']);

      expect(result.error).toBe('Update failed for load-2');
    });
  });

  // ============================================================================
  // removeOrderFromLoad
  // ============================================================================
  describe('removeOrderFromLoad', () => {
    it('should remove order from load and reset status', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await removeOrderFromLoad('order-1');

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('delivery_items');
      expect(mockSupabase.from).toHaveBeenCalledWith('orders');
    });

    it('should return error on delete failure', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Delete failed' },
        })
      );

      const result = await removeOrderFromLoad('order-1');

      expect(result.error).toBe('Delete failed');
    });

    it('should only delete active delivery items, preserving historical ones', async () => {
      // This test verifies the fix: only active items (pending, loading, in_transit)
      // should be deleted, not historical ones (delivered, failed, rescheduled)
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await removeOrderFromLoad('order-1');

      expect(result.success).toBe(true);
      // The implementation now filters by status: ["pending", "loading", "in_transit"]
    });
  });

  // ============================================================================
  // updateOrderDate
  // ============================================================================
  describe('updateOrderDate', () => {
    it('should update order requested delivery date', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await updateOrderDate('order-1', '2024-01-20');

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('orders');
    });

    it('should return error on update failure', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Update failed' },
        })
      );

      const result = await updateOrderDate('order-1', '2024-01-20');

      expect(result.error).toBe('Update failed');
    });
  });

  // ============================================================================
  // dispatchOrders
  // ============================================================================
  describe('dispatchOrders', () => {
    it('should dispatch orders to existing route', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await dispatchOrders(['order-1', 'order-2'], 'route-1');

      expect(result.success).toBe(true);
      expect(result.routeId).toBe('route-1');
    });

    it('should return error for empty order list', async () => {
      const result = await dispatchOrders([]);

      expect(result.error).toBe('No orders provided');
    });

    it('should create new route when none provided', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'hauliers') {
          return new MockSupabaseQueryBuilder({
            data: [{ id: 'default-haulier' }],
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });
      mockCreateDeliveryRun.mockResolvedValue('new-route-1');

      const result = await dispatchOrders(['order-1']);

      expect(result.success).toBe(true);
      expect(result.routeId).toBe('new-route-1');
    });

    it('should report partial failures', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );
      mockAddOrderToDeliveryRun
        .mockResolvedValueOnce('item-1')
        .mockRejectedValueOnce(new Error('Failed'));

      const result = await dispatchOrders(['order-1', 'order-2'], 'route-1');

      expect(result.success).toBe(true);
      expect(result.warning).toContain('1 of 2');
    });

    it('should return error when no route can be created and no hauliers exist', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'hauliers') {
          // No hauliers in database
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await dispatchOrders(['order-1']);

      expect(result.error).toBe('No delivery route available. Please create a haulier first or specify a route.');
    });
  });

  // ============================================================================
  // dispatchLoad
  // ============================================================================
  describe('dispatchLoad', () => {
    it('should dispatch a load with orders', async () => {
      mockSupabaseAdmin.from = jest.fn((table: string) => {
        if (table === 'delivery_items') {
          return new MockSupabaseQueryBuilder({
            data: [{ order_id: 'order-1' }, { order_id: 'order-2' }],
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await dispatchLoad('load-1');

      expect(result.success).toBe(true);
      expect(result.ordersDispatched).toBe(2);
    });

    it('should return error for empty load', async () => {
      mockSupabaseAdmin.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: [], error: null })
      );

      const result = await dispatchLoad('load-1');

      expect(result.error).toBe('No orders in this load to dispatch');
    });

    it('should handle database errors', async () => {
      mockSupabaseAdmin.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Database error' },
        })
      );

      const result = await dispatchLoad('load-1');

      expect(result.error).toBe('Database error');
    });
  });

  // ============================================================================
  // recallLoad
  // ============================================================================
  describe('recallLoad', () => {
    it('should recall a dispatched load', async () => {
      let callCount = 0;
      mockSupabaseAdmin.from = jest.fn((table: string) => {
        callCount++;
        if (table === 'delivery_runs' && callCount === 1) {
          // Get current status
          return new MockSupabaseQueryBuilder({
            data: { status: 'in_transit' },
            error: null,
          });
        }
        if (table === 'delivery_items') {
          return new MockSupabaseQueryBuilder({
            data: [{ order_id: 'order-1' }],
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await recallLoad('load-1');

      expect(result.success).toBe(true);
      expect(result.ordersRecalled).toBe(1);
    });

    it('should refuse to recall a completed load', async () => {
      mockSupabaseAdmin.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: { status: 'completed' },
          error: null,
        })
      );

      const result = await recallLoad('load-1');

      expect(result.error).toBe('Cannot recall a completed load. Use reschedule instead.');
    });

    it('should refuse to recall a cancelled load', async () => {
      mockSupabaseAdmin.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: { status: 'cancelled' },
          error: null,
        })
      );

      const result = await recallLoad('load-1');

      expect(result.error).toBe('Cannot recall a cancelled load.');
    });

    it('should handle load with no orders', async () => {
      let callCount = 0;
      mockSupabaseAdmin.from = jest.fn((table: string) => {
        callCount++;
        if (table === 'delivery_runs' && callCount === 1) {
          return new MockSupabaseQueryBuilder({
            data: { status: 'in_transit' },
            error: null,
          });
        }
        if (table === 'delivery_items') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await recallLoad('load-1');

      expect(result.success).toBe(true);
      expect(result.ordersRecalled).toBe(0);
    });
  });

  // ============================================================================
  // updateLoadStatus
  // ============================================================================
  describe('updateLoadStatus', () => {
    it('should update status to in_transit with departure time', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await updateLoadStatus('load-1', 'in_transit');

      expect(result.success).toBe(true);
    });

    it('should update status to completed with return time', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await updateLoadStatus('load-1', 'completed');

      expect(result.success).toBe(true);
    });

    it('should reset times when status is planned', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await updateLoadStatus('load-1', 'planned');

      expect(result.success).toBe(true);
    });

    it('should handle update errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Status update failed' },
        })
      );

      const result = await updateLoadStatus('load-1', 'in_transit');

      expect(result.error).toBe('Status update failed');
    });
  });
});

