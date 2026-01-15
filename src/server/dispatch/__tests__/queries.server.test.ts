/**
 * Unit tests for dispatch queries.server.ts
 * Tests the dispatch query functions including:
 * - Delivery run CRUD operations
 * - Order packing management
 * - Trolley management
 * - Dispatch board data aggregation
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

// Mock getUserAndOrg
jest.mock('@/server/auth/org', () => ({
  getUserAndOrg: jest.fn(() =>
    Promise.resolve({
      user: mockUser,
      orgId: mockOrgId,
      supabase: mockSupabase,
    })
  ),
}));

// Mock generateId
jest.mock('@/server/utils/ids', () => ({
  generateId: jest.fn(() => 'generated-id-1'),
}));

// Mock listAttributeOptions
jest.mock('@/server/attributeOptions/service', () => ({
  listAttributeOptions: jest.fn(() => Promise.resolve({ options: [] })),
}));

// Import AFTER setting up mocks
import {
  listDeliveryRuns,
  getActiveDeliveryRuns,
  getDeliveryRunWithItems,
  createDeliveryRun,
  updateDeliveryRun,
  addOrderToDeliveryRun,
  updateDeliveryItem,
  getOrdersReadyForDispatch,
  getOrCreateOrderPacking,
  updateOrderPacking,
  listTrolleys,
  getCustomerTrolleyBalances,
  createTrolley,
  recordTrolleyTransaction,
  createOrderStatusUpdate,
  getOrderStatusUpdates,
  getGrowerMembers,
  getHauliers,
  getHauliersWithVehicles,
  getDispatchBoardData,
} from '../queries.server';

describe('dispatch queries.server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // listDeliveryRuns
  // ============================================================================
  describe('listDeliveryRuns', () => {
    it('should list all delivery runs for org', async () => {
      const mockRuns = [
        factories.deliveryRun({ id: 'run-1' }),
        factories.deliveryRun({ id: 'run-2', run_number: 'DR-20240115-002' }),
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockRuns, error: null })
      );

      const result = await listDeliveryRuns();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('run-1');
      expect(result[1].id).toBe('run-2');
    });

    it('should filter by status', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: [], error: null })
      );

      await listDeliveryRuns({ status: 'planned' });

      expect(mockSupabase.from).toHaveBeenCalledWith('delivery_runs');
    });

    it('should filter by run date', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: [], error: null })
      );

      await listDeliveryRuns({ runDate: '2024-01-15' });

      expect(mockSupabase.from).toHaveBeenCalledWith('delivery_runs');
    });

    it('should apply limit', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: [], error: null })
      );

      await listDeliveryRuns({ limit: 50 });

      expect(mockSupabase.from).toHaveBeenCalledWith('delivery_runs');
    });

    it('should handle database errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Query failed' },
        })
      );

      await expect(listDeliveryRuns()).rejects.toMatchObject({
        message: 'Query failed',
      });
    });
  });

  // ============================================================================
  // getActiveDeliveryRuns
  // ============================================================================
  describe('getActiveDeliveryRuns', () => {
    it('should return active runs with aggregated data', async () => {
      const mockRunsData = [
        {
          ...factories.deliveryRun({ id: 'run-1', status: 'planned' }),
          hauliers: factories.haulier(),
          haulier_vehicles: factories.haulierVehicle(),
          delivery_items: [
            { id: 'item-1', order_id: 'order-1', orders: { trolleys_estimated: 3 } },
            { id: 'item-2', order_id: 'order-2', orders: { trolleys_estimated: 2 } },
          ],
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockRunsData, error: null })
      );

      const result = await getActiveDeliveryRuns();

      expect(result).toHaveLength(1);
      expect(result[0].totalTrolleysAssigned).toBe(5);
      expect(result[0].totalDeliveries).toBe(2);
    });

    it('should return empty array on error', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Query failed' },
        })
      );

      const result = await getActiveDeliveryRuns();

      expect(result).toEqual([]);
    });

    it('should calculate fill percentage', async () => {
      const mockRunsData = [
        {
          ...factories.deliveryRun({ id: 'run-1' }),
          hauliers: { ...factories.haulier(), trolley_capacity: 10 },
          haulier_vehicles: null,
          delivery_items: [
            { id: 'item-1', order_id: 'order-1', orders: { trolleys_estimated: 5 } },
          ],
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockRunsData, error: null })
      );

      const result = await getActiveDeliveryRuns();

      expect(result[0].fillPercentage).toBe(50);
    });

    it('should use vehicle capacity over haulier capacity', async () => {
      const mockRunsData = [
        {
          ...factories.deliveryRun({ id: 'run-1' }),
          hauliers: { ...factories.haulier(), trolley_capacity: 20 },
          haulier_vehicles: { ...factories.haulierVehicle(), trolley_capacity: 8 },
          delivery_items: [
            { id: 'item-1', order_id: 'order-1', orders: { trolleys_estimated: 4 } },
          ],
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockRunsData, error: null })
      );

      const result = await getActiveDeliveryRuns();

      expect(result[0].vehicleCapacity).toBe(8);
      expect(result[0].fillPercentage).toBe(50);
    });
  });

  // ============================================================================
  // getDeliveryRunWithItems
  // ============================================================================
  describe('getDeliveryRunWithItems', () => {
    it('should return delivery run with items', async () => {
      const mockRun = factories.deliveryRun({ id: 'run-1' });
      const mockItems = [
        {
          ...factories.deliveryItem({ id: 'item-1', sequence_number: 1 }),
          orders: {
            order_number: 'ORD-001',
            customer_id: 'cust-1',
            total_inc_vat: 100,
            requested_delivery_date: '2024-01-15',
            customers: { name: 'Customer A' },
            customer_addresses: {
              line1: '123 Main St',
              city: 'Dublin',
              county: 'Dublin',
              eircode: 'D01 ABC1',
            },
          },
        },
      ];

      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: mockRun, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: mockItems, error: null });
      });

      const result = await getDeliveryRunWithItems('run-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('run-1');
      expect(result?.items).toHaveLength(1);
      expect(result?.items[0].order.customerName).toBe('Customer A');
    });

    it('should return null for non-existent run', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Not found' },
        })
      );

      const result = await getDeliveryRunWithItems('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // createDeliveryRun
  // ============================================================================
  describe('createDeliveryRun', () => {
    it('should create a delivery run with generated run number', async () => {
      let insertedData: any = null;
      mockSupabase.from = jest.fn((table: string) => {
        const builder = new MockSupabaseQueryBuilder({ data: null, error: null });
        if (table === 'delivery_runs') {
          builder.insert = (data: any) => {
            insertedData = data;
            return new MockSupabaseQueryBuilder({ data: { id: 'new-run-1' }, error: null });
          };
        }
        return builder;
      });

      const result = await createDeliveryRun({
        runDate: '2024-01-15',
        haulierId: 'haulier-1',
        loadCode: '4L',
      });

      expect(result).toBe('new-run-1');
    });

    it('should increment sequence number for existing runs on same date', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          // Existing runs query
          return new MockSupabaseQueryBuilder({
            data: [{ run_number: 'DR-20240115-003' }],
            error: null,
          });
        }
        // Insert query
        return new MockSupabaseQueryBuilder({ data: { id: 'new-run-1' }, error: null });
      });

      await createDeliveryRun({ runDate: '2024-01-15' });

      expect(mockSupabase.from).toHaveBeenCalledWith('delivery_runs');
    });

    it('should add orders when orderIds provided', async () => {
      let insertCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'delivery_runs') {
          return new MockSupabaseQueryBuilder({ data: { id: 'new-run-1' }, error: null });
        }
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({ data: { trolleys_estimated: 3 }, error: null });
        }
        if (table === 'order_packing') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        if (table === 'delivery_items') {
          insertCount++;
          return new MockSupabaseQueryBuilder({ data: { id: `item-${insertCount}` }, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      await createDeliveryRun({
        runDate: '2024-01-15',
        orderIds: ['order-1', 'order-2'],
      });

      // Should have inserted 2 delivery items
      expect(insertCount).toBe(2);
    });
  });

  // ============================================================================
  // updateDeliveryRun
  // ============================================================================
  describe('updateDeliveryRun', () => {
    it('should update delivery run fields', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );
      mockSupabase.auth = {
        getUser: jest.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
      } as any;

      await updateDeliveryRun('run-1', {
        driverName: 'New Driver',
        status: 'loading',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('delivery_runs');
    });

    it('should update order status when run goes in_transit', async () => {
      const mockItems = [{ order_id: 'order-1' }, { order_id: 'order-2' }];

      let updateCalls = 0;
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'delivery_runs') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        if (table === 'delivery_items') {
          return new MockSupabaseQueryBuilder({ data: mockItems, error: null });
        }
        if (table === 'orders') {
          updateCalls++;
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });
      mockSupabase.auth = {
        getUser: jest.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
      } as any;

      await updateDeliveryRun('run-1', { status: 'in_transit' });

      expect(updateCalls).toBe(1); // Orders should be updated to dispatched
    });
  });

  // ============================================================================
  // addOrderToDeliveryRun
  // ============================================================================
  describe('addOrderToDeliveryRun', () => {
    it('should add order to delivery run with trolley calculation', async () => {
      let deliveryItemsCallCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({ data: { trolleys_estimated: 3 }, error: null });
        }
        if (table === 'order_packing') {
          return new MockSupabaseQueryBuilder({ data: { trolleys_used: 4 }, error: null });
        }
        if (table === 'delivery_items') {
          deliveryItemsCallCount++;
          if (deliveryItemsCallCount === 1) {
            // First call: sequence lookup
            return new MockSupabaseQueryBuilder({ data: [], error: null });
          }
          // Second call: insert - return with the inserted id
          return new MockSupabaseQueryBuilder({ data: { id: 'new-item-1' }, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: { id: 'new-item-1' }, error: null });
      });

      const result = await addOrderToDeliveryRun({
        deliveryRunId: 'run-1',
        orderId: 'order-1',
      });

      expect(result).toBe('new-item-1');
    });

    it('should use packing trolleys_used over order estimate', async () => {
      let insertedTrolleys: number | undefined;
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({ data: { trolleys_estimated: 2 }, error: null });
        }
        if (table === 'order_packing') {
          return new MockSupabaseQueryBuilder({ data: { trolleys_used: 5 }, error: null });
        }
        if (table === 'delivery_items') {
          const builder = new MockSupabaseQueryBuilder({ data: [], error: null });
          const originalInsert = builder.insert;
          builder.insert = (data: any) => {
            insertedTrolleys = data.trolleys_delivered;
            return new MockSupabaseQueryBuilder({ data: { id: 'item-1' }, error: null });
          };
          return builder;
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      await addOrderToDeliveryRun({
        deliveryRunId: 'run-1',
        orderId: 'order-1',
      });

      expect(insertedTrolleys).toBe(5);
    });

    it('should auto-assign sequence number', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({ data: { trolleys_estimated: 2 }, error: null });
        }
        if (table === 'order_packing') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        if (table === 'delivery_items') {
          // Return existing items for sequence calculation
          return new MockSupabaseQueryBuilder({
            data: [{ sequence_number: 3 }],
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: { id: 'item-1' }, error: null });
      });

      await addOrderToDeliveryRun({
        deliveryRunId: 'run-1',
        orderId: 'order-1',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('delivery_items');
    });

    it('should respect explicit 0 trolleysDelivered value', async () => {
      // This test verifies the fix: explicit 0 should not fall back to other values
      let insertedTrolleys: number | undefined;
      let deliveryItemsCallCount = 0;
      
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'orders') {
          // Order has trolleys_estimated = 5
          return new MockSupabaseQueryBuilder({ data: { trolleys_estimated: 5 }, error: null });
        }
        if (table === 'order_packing') {
          // Packing has trolleys_used = 3
          return new MockSupabaseQueryBuilder({ data: { trolleys_used: 3 }, error: null });
        }
        if (table === 'delivery_items') {
          deliveryItemsCallCount++;
          if (deliveryItemsCallCount === 1) {
            return new MockSupabaseQueryBuilder({ data: [], error: null });
          }
          const builder = new MockSupabaseQueryBuilder({ data: { id: 'item-1' }, error: null });
          const originalInsert = builder.insert.bind(builder);
          builder.insert = (data: any) => {
            insertedTrolleys = data.trolleys_delivered;
            return new MockSupabaseQueryBuilder({ data: { id: 'item-1' }, error: null });
          };
          return builder;
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      // Explicitly pass 0 trolleys - should NOT fall back to packing (3) or order (5)
      await addOrderToDeliveryRun({
        deliveryRunId: 'run-1',
        orderId: 'order-1',
        trolleysDelivered: 0,  // Explicit 0
      });

      expect(insertedTrolleys).toBe(0);
    });
  });

  // ============================================================================
  // updateDeliveryItem
  // ============================================================================
  describe('updateDeliveryItem', () => {
    it('should update delivery item fields', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );
      mockSupabase.auth = {
        getUser: jest.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
      } as any;

      await updateDeliveryItem('item-1', {
        status: 'delivered',
        recipientName: 'John Doe',
        trolleysReturned: 2,
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('delivery_items');
    });

    it('should update order status when item is delivered', async () => {
      let orderUpdated = false;
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'delivery_items') {
          const builder = new MockSupabaseQueryBuilder({ data: null, error: null });
          // For get order_id query
          return new MockSupabaseQueryBuilder({ data: { order_id: 'order-1' }, error: null });
        }
        if (table === 'orders') {
          orderUpdated = true;
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });
      mockSupabase.auth = {
        getUser: jest.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
      } as any;

      await updateDeliveryItem('item-1', { status: 'delivered' });

      expect(orderUpdated).toBe(true);
    });
  });

  // ============================================================================
  // getOrdersReadyForDispatch
  // ============================================================================
  describe('getOrdersReadyForDispatch', () => {
    it('should return orders from view', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          org_id: mockOrgId,
          order_number: 'ORD-001',
          customer_id: 'cust-1',
          customer_name: 'Customer A',
          requested_delivery_date: '2024-01-15',
          total_inc_vat: 100,
          packing_status: 'completed',
          trolleys_used: 3,
          delivery_status: 'pending',
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockOrders, error: null })
      );

      const result = await getOrdersReadyForDispatch();

      expect(result).toHaveLength(1);
      expect(result[0].orderNumber).toBe('ORD-001');
      expect(result[0].customerName).toBe('Customer A');
    });
  });

  // ============================================================================
  // getOrCreateOrderPacking
  // ============================================================================
  describe('getOrCreateOrderPacking', () => {
    it('should return existing packing record', async () => {
      const existingPacking = factories.orderPacking({ id: 'packing-1', status: 'in_progress' });

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: existingPacking, error: null })
      );

      const result = await getOrCreateOrderPacking('order-1');

      expect(result.id).toBe('packing-1');
      expect(result.status).toBe('in_progress');
    });

    it('should create new packing record when none exists', async () => {
      let createCalled = false;
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'order_packing') {
          const builder = new MockSupabaseQueryBuilder({ data: null, error: null });
          builder.insert = () => {
            createCalled = true;
            return new MockSupabaseQueryBuilder({
              data: factories.orderPacking({ id: 'new-packing-1' }),
              error: null,
            });
          };
          return builder;
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await getOrCreateOrderPacking('order-1');

      expect(createCalled).toBe(true);
      expect(result.id).toBe('new-packing-1');
    });
  });

  // ============================================================================
  // updateOrderPacking
  // ============================================================================
  describe('updateOrderPacking', () => {
    it('should update packing status and timestamps', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );
      mockSupabase.auth = {
        getUser: jest.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
      } as any;

      await updateOrderPacking('order-1', {
        status: 'completed',
        trolleysUsed: 4,
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('order_packing');
    });

    it('should set packing_started_at when status is in_progress', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );
      mockSupabase.auth = {
        getUser: jest.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
      } as any;

      await updateOrderPacking('order-1', { status: 'in_progress' });

      expect(mockSupabase.from).toHaveBeenCalledWith('order_packing');
    });

    it('should update order status when packing is completed', async () => {
      let orderStatusUpdated = false;
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'orders') {
          orderStatusUpdated = true;
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });
      mockSupabase.auth = {
        getUser: jest.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
      } as any;

      await updateOrderPacking('order-1', { status: 'completed' });

      expect(orderStatusUpdated).toBe(true);
    });

    it('should set verified_by when status is verified', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );
      mockSupabase.auth = {
        getUser: jest.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
      } as any;

      await updateOrderPacking('order-1', { status: 'verified' });

      expect(mockSupabase.from).toHaveBeenCalledWith('order_packing');
    });
  });

  // ============================================================================
  // listTrolleys
  // ============================================================================
  describe('listTrolleys', () => {
    it('should list all trolleys', async () => {
      const mockTrolleys = [
        {
          ...factories.trolley({ id: 'trolley-1' }),
          customers: { name: 'Customer A' },
          delivery_runs: { run_number: 'DR-001' },
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockTrolleys, error: null })
      );

      const result = await listTrolleys();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('trolley-1');
    });

    it('should filter by status', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: [], error: null })
      );

      await listTrolleys({ status: 'available' });

      expect(mockSupabase.from).toHaveBeenCalledWith('trolleys');
    });
  });

  // ============================================================================
  // getCustomerTrolleyBalances
  // ============================================================================
  describe('getCustomerTrolleyBalances', () => {
    it('should return customer trolley balances from view', async () => {
      const mockBalances = [
        {
          customer_id: 'cust-1',
          customer_name: 'Customer A',
          org_id: mockOrgId,
          trolleys_outstanding: 5,
          last_delivery_date: '2024-01-10',
          last_return_date: '2024-01-05',
          days_outstanding: 10,
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockBalances, error: null })
      );

      const result = await getCustomerTrolleyBalances();

      expect(result).toHaveLength(1);
      expect(result[0].trolleysOutstanding).toBe(5);
    });
  });

  // ============================================================================
  // createTrolley
  // ============================================================================
  describe('createTrolley', () => {
    it('should create a new trolley', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: { id: 'new-trolley-1' }, error: null })
      );

      const result = await createTrolley({
        trolleyNumber: 'T001',
        trolleyType: 'danish',
        status: 'available',
      });

      expect(result).toBe('new-trolley-1');
    });
  });

  // ============================================================================
  // recordTrolleyTransaction
  // ============================================================================
  describe('recordTrolleyTransaction', () => {
    it('should record a transaction and update trolley status', async () => {
      let trolleyUpdated = false;
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'trolley_transactions') {
          return new MockSupabaseQueryBuilder({ data: { id: 'txn-1' }, error: null });
        }
        if (table === 'trolleys') {
          trolleyUpdated = true;
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await recordTrolleyTransaction({
        trolleyId: 'trolley-1',
        transactionType: 'loaded',
        quantity: 1,
        deliveryRunId: 'run-1',
      });

      expect(result).toBe('txn-1');
      expect(trolleyUpdated).toBe(true);
    });

    it('should set customer_id on delivered transaction', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: { id: 'txn-1' }, error: null })
      );

      await recordTrolleyTransaction({
        trolleyId: 'trolley-1',
        transactionType: 'delivered',
        quantity: 1,
        customerId: 'cust-1',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('trolleys');
    });
  });

  // ============================================================================
  // createOrderStatusUpdate
  // ============================================================================
  describe('createOrderStatusUpdate', () => {
    it('should create a status update', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: { id: 'update-1' }, error: null })
      );

      const result = await createOrderStatusUpdate({
        orderId: 'order-1',
        statusType: 'out_for_delivery',
        title: 'Out for Delivery',
        message: 'Your order is on its way',
        visibleToCustomer: true,
      });

      expect(result).toBe('update-1');
    });
  });

  // ============================================================================
  // getOrderStatusUpdates
  // ============================================================================
  describe('getOrderStatusUpdates', () => {
    it('should return status updates for an order', async () => {
      const mockUpdates = [
        {
          id: 'update-1',
          org_id: mockOrgId,
          order_id: 'order-1',
          status_type: 'out_for_delivery',
          title: 'Out for Delivery',
          message: 'On the way',
          visible_to_customer: true,
          created_at: '2024-01-15T10:00:00.000Z',
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockUpdates, error: null })
      );

      const result = await getOrderStatusUpdates('order-1');

      expect(result).toHaveLength(1);
      expect(result[0].statusType).toBe('out_for_delivery');
    });
  });

  // ============================================================================
  // getGrowerMembers
  // ============================================================================
  describe('getGrowerMembers', () => {
    it('should return org members who can be pickers', async () => {
      const mockMembers = [
        {
          user_id: 'user-1',
          role: 'grower',
          profiles: { id: 'user-1', full_name: 'Jane Picker', email: 'jane@example.com' },
        },
        {
          user_id: 'user-2',
          role: 'admin',
          profiles: { id: 'user-2', full_name: 'Admin User', email: 'admin@example.com' },
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockMembers, error: null })
      );

      const result = await getGrowerMembers(mockOrgId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Jane Picker');
    });

    it('should fallback to role name when profiles join fails', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Join failed' },
        })
      );

      const result = await getGrowerMembers(mockOrgId);

      // Fallback query should be attempted
      expect(result).toBeDefined();
    });

    it('should return empty array on complete failure', async () => {
      mockSupabase.from = jest.fn(() => {
        throw new Error('Connection failed');
      });

      const result = await getGrowerMembers(mockOrgId);

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // getHauliers
  // ============================================================================
  describe('getHauliers', () => {
    it('should return active hauliers', async () => {
      const mockHauliers = [
        factories.haulier({ id: 'haulier-1', name: 'Fast Delivery' }),
        factories.haulier({ id: 'haulier-2', name: 'Quick Transport' }),
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockHauliers, error: null })
      );

      const result = await getHauliers();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Fast Delivery');
    });

    it('should return empty array if table does not exist', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Table not found', code: '42P01' },
        })
      );

      const result = await getHauliers();

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // getHauliersWithVehicles
  // ============================================================================
  describe('getHauliersWithVehicles', () => {
    it('should return hauliers with their vehicles', async () => {
      const mockData = [
        {
          ...factories.haulier({ id: 'haulier-1', name: 'Fast Delivery' }),
          haulier_vehicles: [
            factories.haulierVehicle({ id: 'vehicle-1', name: 'Van 1' }),
            factories.haulierVehicle({ id: 'vehicle-2', name: 'Van 2' }),
          ],
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockData, error: null })
      );

      const result = await getHauliersWithVehicles();

      expect(result).toHaveLength(1);
      expect(result[0].vehicles).toHaveLength(2);
      expect(result[0].vehicles[0].name).toBe('Van 1');
    });

    it('should filter out inactive vehicles', async () => {
      const mockData = [
        {
          ...factories.haulier({ id: 'haulier-1' }),
          haulier_vehicles: [
            factories.haulierVehicle({ id: 'vehicle-1', name: 'Active Van', is_active: true }),
            factories.haulierVehicle({ id: 'vehicle-2', name: 'Inactive Van', is_active: false }),
          ],
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockData, error: null })
      );

      const result = await getHauliersWithVehicles();

      expect(result[0].vehicles).toHaveLength(1);
      expect(result[0].vehicles[0].name).toBe('Active Van');
    });
  });

  // ============================================================================
  // getDispatchBoardData
  // ============================================================================
  describe('getDispatchBoardData', () => {
    it('should return aggregated dispatch board data', async () => {
      const mockOrdersData = [
        {
          id: 'order-1',
          order_number: 'ORD-001',
          customer_id: 'cust-1',
          status: 'confirmed',
          requested_delivery_date: '2024-01-15',
          trolleys_estimated: 3,
          total_inc_vat: 100,
          customers: { name: 'Customer A' },
          customer_addresses: { line1: '123 Main St', city: 'Dublin', county: 'Dublin', eircode: 'D01 ABC1' },
          pick_lists: [{ id: 'pick-1', assigned_team_id: null, assigned_user_id: 'user-1', status: 'pending' }],
          order_packing: [{ status: 'not_started' }],
          delivery_items: [],
        },
      ];

      // Mock the parallel queries
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'hauliers') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        if (table === 'org_memberships') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        if (table === 'delivery_runs') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({ data: mockOrdersData, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await getDispatchBoardData();

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].orderNumber).toBe('ORD-001');
      expect(result.orders[0].customerName).toBe('Customer A');
    });

    it('should compute dispatch stages correctly', async () => {
      const mockOrdersData = [
        // To pick - no picker assigned
        {
          id: 'order-1',
          order_number: 'ORD-001',
          customer_id: 'cust-1',
          status: 'confirmed',
          requested_delivery_date: '2024-01-15',
          trolleys_estimated: 3,
          total_inc_vat: 100,
          customers: { name: 'Customer A' },
          customer_addresses: {},
          pick_lists: [],
          order_packing: [],
          delivery_items: [],
        },
        // Picking - picker assigned
        {
          id: 'order-2',
          order_number: 'ORD-002',
          customer_id: 'cust-1',
          status: 'picking',
          requested_delivery_date: '2024-01-15',
          trolleys_estimated: 2,
          total_inc_vat: 80,
          customers: { name: 'Customer B' },
          customer_addresses: {},
          pick_lists: [{ id: 'pick-2', assigned_user_id: 'user-1', status: 'in_progress' }],
          order_packing: [],
          delivery_items: [],
        },
        // Ready to load - picking completed
        {
          id: 'order-3',
          order_number: 'ORD-003',
          customer_id: 'cust-1',
          status: 'packed',
          requested_delivery_date: '2024-01-15',
          trolleys_estimated: 4,
          total_inc_vat: 120,
          customers: { name: 'Customer C' },
          customer_addresses: {},
          pick_lists: [{ id: 'pick-3', status: 'completed' }],
          order_packing: [{ status: 'completed' }],
          delivery_items: [],
        },
        // On route - assigned to delivery run
        {
          id: 'order-4',
          order_number: 'ORD-004',
          customer_id: 'cust-1',
          status: 'dispatched',
          requested_delivery_date: '2024-01-15',
          trolleys_estimated: 1,
          total_inc_vat: 50,
          customers: { name: 'Customer D' },
          customer_addresses: {},
          pick_lists: [{ id: 'pick-4', status: 'completed' }],
          order_packing: [{ status: 'verified' }],
          delivery_items: [{ id: 'item-4', delivery_run_id: 'run-1', status: 'in_transit', delivery_runs: { run_number: 'DR-001' } }],
        },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({ data: mockOrdersData, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await getDispatchBoardData();

      expect(result.orders[0].stage).toBe('to_pick');
      expect(result.orders[1].stage).toBe('picking');
      expect(result.orders[2].stage).toBe('ready_to_load');
      expect(result.orders[3].stage).toBe('on_route');
    });
  });
});

