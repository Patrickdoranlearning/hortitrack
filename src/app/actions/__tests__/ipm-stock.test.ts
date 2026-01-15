/**
 * Unit tests for ipm-stock.ts server actions
 */

import {
  createMockSupabaseClient,
  createMockUser,
  factories,
  MockSupabaseQueryBuilder,
} from '@/lib/__tests__/test-utils';

// Mock the dependencies
const mockSupabase = createMockSupabaseClient() as any;
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
  listBottles,
  getBottleByCode,
  createBottles,
  disposeBottle,
  recordUsage,
  adjustBottleLevel,
  getMovementsForBottle,
  getStockSummary,
  getProductStockSummary,
  getLowStockProducts,
  getAvailableBottles,
} from '../ipm-stock';

describe('ipm-stock actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Bottle CRUD
  // ============================================================================
  describe('Bottle CRUD', () => {
    describe('listBottles', () => {
      it('should return list of bottles', async () => {
        const mockBottles = [
          {
            ...factories.ipmBottle({ id: 'b1', status: 'sealed' }),
            ipm_products: { id: 'p1', name: 'Neem Oil' },
          },
          {
            ...factories.ipmBottle({ id: 'b2', status: 'open' }),
            ipm_products: { id: 'p1', name: 'Neem Oil' },
          },
        ];

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockBottles, error: null });
        });

        const result: any = await listBottles();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data![0].product?.name).toBe('Neem Oil');
      });

      it('should filter by product ID', async () => {
        const mockBottles = [
          {
            ...factories.ipmBottle({ id: 'b1', product_id: 'p1' }),
            ipm_products: { id: 'p1', name: 'Neem Oil' },
          },
        ];

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockBottles, error: null });
        });

        const result: any = await listBottles({ productId: 'p1' });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
      });

      it('should filter by status', async () => {
        const mockBottles = [
          {
            ...factories.ipmBottle({ id: 'b1', status: 'open' }),
            ipm_products: { id: 'p1', name: 'Neem Oil' },
          },
        ];

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockBottles, error: null });
        });

        const result: any = await listBottles({ status: 'open' });

        expect(result.success).toBe(true);
      });

      it('should handle database error', async () => {
        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Query failed' },
          });
        });

        const result: any = await listBottles();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Query failed');
      });
    });

    describe('getBottleByCode', () => {
      it('should return bottle by code', async () => {
        const mockBottle = {
          ...factories.ipmBottle({ bottle_code: 'BTL-001' }),
          ipm_products: { id: 'p1', name: 'Neem Oil' },
        };

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockBottle, error: null });
        });

        const result: any = await getBottleByCode('BTL-001');

        expect(result.success).toBe(true);
        expect(result.data?.bottleCode).toBe('BTL-001');
      });

      it('should return error when bottle not found', async () => {
        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Not found', code: 'PGRST116' },
          });
        });

        const result: any = await getBottleByCode('NONEXISTENT');

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('createBottles', () => {
      it('should create single bottle', async () => {
        const mockBottle = {
          ...factories.ipmBottle({ id: 'new-bottle', bottle_code: 'BTL-002' }),
          ipm_products: { id: 'p1', name: 'Neem Oil' },
        };

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: [mockBottle], error: null });
        });

        mockSupabase.rpc = jest.fn(() =>
          Promise.resolve({ data: 'BTL-002', error: null })
        );

        const result: any = await createBottles({
          productId: 'p1',
          volumeMl: 1000,
          batchNumber: 'BATCH-001',
        });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
      });

      it('should create multiple bottles', async () => {
        const mockBottles = [
          {
            ...factories.ipmBottle({ id: 'b1', bottle_code: 'BTL-001' }),
            ipm_products: { id: 'p1', name: 'Neem Oil' },
          },
          {
            ...factories.ipmBottle({ id: 'b2', bottle_code: 'BTL-002' }),
            ipm_products: { id: 'p1', name: 'Neem Oil' },
          },
          {
            ...factories.ipmBottle({ id: 'b3', bottle_code: 'BTL-003' }),
            ipm_products: { id: 'p1', name: 'Neem Oil' },
          },
        ];

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockBottles, error: null });
        });

        let codeCounter = 1;
        mockSupabase.rpc = jest.fn(() =>
          Promise.resolve({ data: `BTL-00${codeCounter++}`, error: null })
        );

        const result: any = await createBottles(
          {
            productId: 'p1',
            volumeMl: 1000,
          },
          3
        );

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(3);
      });

      it('should handle code generation failure', async () => {
        mockSupabase.rpc = jest.fn(() =>
          Promise.resolve({ data: null, error: { message: 'RPC failed' } })
        );

        const result: any = await createBottles({
          productId: 'p1',
          volumeMl: 1000,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('bottle code');
      });
    });

    describe('disposeBottle', () => {
      it('should dispose a bottle and record movement', async () => {
        const mockBottle = factories.ipmBottle({
          id: 'b1',
          remaining_ml: 200,
        });

        let callCount = 0;
        mockSupabase.from = jest.fn((table: string) => {
          if (table === 'ipm_product_bottles') {
            callCount++;
            if (callCount === 1) {
              return new MockSupabaseQueryBuilder({ data: mockBottle, error: null });
            }
            return new MockSupabaseQueryBuilder({ data: null, error: null });
          }
          if (table === 'ipm_stock_movements') {
            return new MockSupabaseQueryBuilder({ data: null, error: null });
          }
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        });

        const result: any = await disposeBottle('b1', 'Expired');

        expect(result.success).toBe(true);
      });

      it('should handle bottle not found', async () => {
        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Not found', code: 'PGRST116' },
          });
        });

        const result: any = await disposeBottle('nonexistent');

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });
  });

  // ============================================================================
  // Stock Movements
  // ============================================================================
  describe('Stock Movements', () => {
    describe('recordUsage', () => {
      it('should record usage from sealed bottle (auto-opens)', async () => {
        const mockBottle = factories.ipmBottle({
          id: 'b1',
          status: 'sealed',
          remaining_ml: 1000,
        });

        const mockMovement = {
          id: 'mov1',
          bottle_id: 'b1',
          product_id: 'p1',
          movement_type: 'usage',
          quantity_ml: -50,
          remaining_after_ml: 950,
          ipm_product_bottles: mockBottle,
          nursery_locations: { id: 'loc-1', name: 'GH A' },
        };

        let bottleCallCount = 0;
        mockSupabase.from = jest.fn((table: string) => {
          if (table === 'ipm_product_bottles') {
            bottleCallCount++;
            return new MockSupabaseQueryBuilder({ data: mockBottle, error: null });
          }
          if (table === 'ipm_stock_movements') {
            return new MockSupabaseQueryBuilder({ data: mockMovement, error: null });
          }
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        });

        const result: any = await recordUsage({
          bottleId: 'b1',
          quantityMl: 50,
          locationId: 'loc-1',
        });

        expect(result.success).toBe(true);
        expect(result.data?.quantityMl).toBe(-50);
      });

      it('should record usage from open bottle', async () => {
        const mockBottle = factories.ipmBottle({
          id: 'b1',
          status: 'open',
          remaining_ml: 800,
        });

        const mockMovement = {
          id: 'mov1',
          bottle_id: 'b1',
          product_id: 'p1',
          movement_type: 'usage',
          quantity_ml: -100,
          remaining_after_ml: 700,
          ipm_product_bottles: mockBottle,
          nursery_locations: null,
        };

        mockSupabase.from = jest.fn((table: string) => {
          if (table === 'ipm_product_bottles') {
            return new MockSupabaseQueryBuilder({ data: mockBottle, error: null });
          }
          if (table === 'ipm_stock_movements') {
            return new MockSupabaseQueryBuilder({ data: mockMovement, error: null });
          }
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        });

        const result: any = await recordUsage({
          bottleId: 'b1',
          quantityMl: 100,
        });

        expect(result.success).toBe(true);
        expect(result.data?.remainingAfterMl).toBe(700);
      });

      it('should handle bottle not found', async () => {
        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Not found', code: 'PGRST116' },
          });
        });

        const result: any = await recordUsage({
          bottleId: 'nonexistent',
          quantityMl: 50,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('adjustBottleLevel', () => {
      it('should adjust bottle level and record movement', async () => {
        const mockBottle = factories.ipmBottle({
          id: 'b1',
          remaining_ml: 500,
        });

        mockSupabase.from = jest.fn((table: string) => {
          if (table === 'ipm_product_bottles') {
            return new MockSupabaseQueryBuilder({ data: mockBottle, error: null });
          }
          if (table === 'ipm_stock_movements') {
            return new MockSupabaseQueryBuilder({ data: null, error: null });
          }
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        });

        const result: any = await adjustBottleLevel('b1', 450, 'Spillage');

        expect(result.success).toBe(true);
      });

      it('should handle increase adjustment', async () => {
        const mockBottle = factories.ipmBottle({
          id: 'b1',
          remaining_ml: 500,
        });

        mockSupabase.from = jest.fn((table: string) => {
          if (table === 'ipm_product_bottles') {
            return new MockSupabaseQueryBuilder({ data: mockBottle, error: null });
          }
          if (table === 'ipm_stock_movements') {
            return new MockSupabaseQueryBuilder({ data: null, error: null });
          }
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        });

        const result: any = await adjustBottleLevel('b1', 600, 'Measurement correction');

        expect(result.success).toBe(true);
      });
    });

    describe('getMovementsForBottle', () => {
      it('should return movements for a bottle', async () => {
        const mockMovements = [
          {
            id: 'mov1',
            bottle_id: 'b1',
            product_id: 'p1',
            movement_type: 'open',
            quantity_ml: 0,
            remaining_after_ml: 1000,
            recorded_at: '2024-01-01T10:00:00Z',
            ipm_product_bottles: factories.ipmBottle(),
            nursery_locations: null,
          },
          {
            id: 'mov2',
            bottle_id: 'b1',
            product_id: 'p1',
            movement_type: 'usage',
            quantity_ml: -50,
            remaining_after_ml: 950,
            recorded_at: '2024-01-01T11:00:00Z',
            ipm_product_bottles: factories.ipmBottle(),
            nursery_locations: { id: 'loc-1', name: 'GH A' },
          },
        ];

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockMovements, error: null });
        });

        const result: any = await getMovementsForBottle('b1');

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data![1].movementType).toBe('usage');
      });
    });
  });

  // ============================================================================
  // Stock Summary
  // ============================================================================
  describe('Stock Summary', () => {
    describe('getStockSummary', () => {
      it('should return stock summary for all products', async () => {
        const mockSummary = [
          {
            product_id: 'p1',
            product_name: 'Neem Oil',
            target_stock_bottles: 5,
            low_stock_threshold: 2,
            default_bottle_volume_ml: 1000,
            bottles_in_stock: 3,
            bottles_sealed: 2,
            bottles_open: 1,
            total_remaining_ml: 2500,
            is_low_stock: false,
            usage_last_30_days_ml: 500,
          },
        ];

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockSummary, error: null });
        });

        const result: any = await getStockSummary();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].bottlesInStock).toBe(3);
      });
    });

    describe('getProductStockSummary', () => {
      it('should return stock summary for specific product', async () => {
        const mockSummary = {
          product_id: 'p1',
          product_name: 'Neem Oil',
          bottles_in_stock: 3,
          is_low_stock: false,
        };

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockSummary, error: null });
        });

        const result: any = await getProductStockSummary('p1');

        expect(result.success).toBe(true);
        expect(result.data?.productId).toBe('p1');
      });

      it('should return default summary when not found', async () => {
        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Not found', code: 'PGRST116' },
          });
        });

        const result: any = await getProductStockSummary('nonexistent');

        expect(result.success).toBe(true);
        expect(result.data?.bottlesInStock).toBe(0);
        expect(result.data?.isLowStock).toBe(true);
      });
    });

    describe('getLowStockProducts', () => {
      it('should return products with low stock', async () => {
        const mockSummary = [
          {
            product_id: 'p2',
            product_name: 'Pyrethrin',
            bottles_in_stock: 1,
            is_low_stock: true,
          },
        ];

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockSummary, error: null });
        });

        const result: any = await getLowStockProducts();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].isLowStock).toBe(true);
      });
    });
  });

  // ============================================================================
  // Available Bottles
  // ============================================================================
  describe('getAvailableBottles', () => {
    it('should return available bottles for a product', async () => {
      const mockBottles = [
        {
          ...factories.ipmBottle({ id: 'b1', status: 'open', remaining_ml: 300 }),
          ipm_products: { id: 'p1', name: 'Neem Oil' },
        },
        {
          ...factories.ipmBottle({ id: 'b2', status: 'sealed', remaining_ml: 1000 }),
          ipm_products: { id: 'p1', name: 'Neem Oil' },
        },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBottles, error: null });
      });

      const result: any = await getAvailableBottles('p1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      // Open bottles should come first
      expect(result.data![0].status).toBe('open');
    });

    it('should exclude empty and disposed bottles', async () => {
      const mockBottles = [
        {
          ...factories.ipmBottle({ id: 'b1', status: 'open', remaining_ml: 500 }),
          ipm_products: { id: 'p1', name: 'Neem Oil' },
        },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockBottles, error: null });
      });

      const result: any = await getAvailableBottles('p1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });
});




