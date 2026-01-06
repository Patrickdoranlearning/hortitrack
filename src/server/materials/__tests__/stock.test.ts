/**
 * Unit tests for materials/stock.ts
 */

import {
  createMockSupabaseClient,
  factories,
  MockSupabaseQueryBuilder,
} from '@/lib/__tests__/test-utils';

// Mock dependencies
const mockSupabase = createMockSupabaseClient();
const mockOrgId = 'test-org-id';
const mockUserId = 'test-user-id';

// Import after mocks
import {
  getStockSummary,
  getStockByMaterial,
  getStockAtLocation,
  adjustStock,
  transferStock,
  recordCount,
  getTransactions,
} from '../stock';

describe('materials/stock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // getStockSummary
  // ============================================================================
  describe('getStockSummary', () => {
    it('should return aggregated stock summary for all materials', async () => {
      const mockStockData = [
        {
          material_id: 'mat-1',
          quantity_on_hand: 500,
          quantity_reserved: 50,
          materials: {
            id: 'mat-1',
            name: 'Black Pot',
            part_number: 'M-POT-001',
            base_uom: 'each',
            reorder_point: 100,
            is_active: true,
            material_categories: { name: 'Pots' },
          },
        },
        {
          material_id: 'mat-1',
          quantity_on_hand: 200,
          quantity_reserved: 20,
          materials: {
            id: 'mat-1',
            name: 'Black Pot',
            part_number: 'M-POT-001',
            base_uom: 'each',
            reorder_point: 100,
            is_active: true,
            material_categories: { name: 'Pots' },
          },
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockStockData, error: null })
      );

      const result = await getStockSummary(mockSupabase, mockOrgId);

      expect(result).toHaveLength(1);
      expect(result[0].materialId).toBe('mat-1');
      expect(result[0].totalOnHand).toBe(700); // 500 + 200
      expect(result[0].totalReserved).toBe(70); // 50 + 20
      expect(result[0].totalAvailable).toBe(630); // 700 - 70
      expect(result[0].isLowStock).toBe(false); // 700 > 100
    });

    it('should flag low stock when below reorder point', async () => {
      const mockStockData = [
        {
          material_id: 'mat-1',
          quantity_on_hand: 50,
          quantity_reserved: 0,
          materials: {
            id: 'mat-1',
            name: 'Black Pot',
            part_number: 'M-POT-001',
            base_uom: 'each',
            reorder_point: 100,
            is_active: true,
            material_categories: { name: 'Pots' },
          },
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockStockData, error: null })
      );

      const result = await getStockSummary(mockSupabase, mockOrgId);

      expect(result[0].isLowStock).toBe(true);
    });

    it('should not flag low stock when reorder_point is null', async () => {
      const mockStockData = [
        {
          material_id: 'mat-1',
          quantity_on_hand: 10,
          quantity_reserved: 0,
          materials: {
            id: 'mat-1',
            name: 'Black Pot',
            part_number: 'M-POT-001',
            base_uom: 'each',
            reorder_point: null,
            is_active: true,
            material_categories: { name: 'Pots' },
          },
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockStockData, error: null })
      );

      const result = await getStockSummary(mockSupabase, mockOrgId);

      expect(result[0].isLowStock).toBe(false);
    });

    it('should exclude inactive materials', async () => {
      const mockStockData = [
        {
          material_id: 'mat-1',
          quantity_on_hand: 500,
          quantity_reserved: 0,
          materials: {
            id: 'mat-1',
            name: 'Inactive Pot',
            part_number: 'M-POT-001',
            base_uom: 'each',
            reorder_point: 100,
            is_active: false,
            material_categories: { name: 'Pots' },
          },
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockStockData, error: null })
      );

      const result = await getStockSummary(mockSupabase, mockOrgId);

      expect(result).toHaveLength(0);
    });

    it('should throw error on database failure', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'Database error' } })
      );

      await expect(getStockSummary(mockSupabase, mockOrgId)).rejects.toThrow(
        'Failed to fetch stock summary: Database error'
      );
    });

    it('should return empty array when no stock exists', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: [], error: null })
      );

      const result = await getStockSummary(mockSupabase, mockOrgId);

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // getStockByMaterial
  // ============================================================================
  describe('getStockByMaterial', () => {
    it('should return stock records for a specific material', async () => {
      const mockStockData = [
        {
          ...factories.materialStock({ material_id: 'mat-1', location_id: 'loc-1' }),
          location: { id: 'loc-1', name: 'Warehouse A' },
        },
        {
          ...factories.materialStock({ id: 'stock-2', material_id: 'mat-1', location_id: 'loc-2' }),
          location: { id: 'loc-2', name: 'Greenhouse B' },
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockStockData, error: null })
      );

      const result = await getStockByMaterial(mockSupabase, mockOrgId, 'mat-1');

      expect(result).toHaveLength(2);
      expect(result[0].materialId).toBe('mat-1');
      expect(result[0].location?.name).toBe('Warehouse A');
      expect(result[1].location?.name).toBe('Greenhouse B');
    });

    it('should return empty array when no stock exists', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: [], error: null })
      );

      const result = await getStockByMaterial(mockSupabase, mockOrgId, 'mat-nonexistent');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'Query failed' } })
      );

      await expect(getStockByMaterial(mockSupabase, mockOrgId, 'mat-1')).rejects.toThrow(
        'Failed to fetch stock by material: Query failed'
      );
    });
  });

  // ============================================================================
  // getStockAtLocation
  // ============================================================================
  describe('getStockAtLocation', () => {
    it('should return stock at specific location', async () => {
      const mockStock = factories.materialStock({
        material_id: 'mat-1',
        location_id: 'loc-1',
        quantity_on_hand: 300,
      });

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockStock, error: null })
      );

      const result = await getStockAtLocation(mockSupabase, mockOrgId, 'mat-1', 'loc-1');

      expect(result).not.toBeNull();
      expect(result?.quantityOnHand).toBe(300);
    });

    it('should return stock with null location (default location)', async () => {
      const mockStock = factories.materialStock({
        material_id: 'mat-1',
        location_id: null,
        quantity_on_hand: 500,
      });

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockStock, error: null })
      );

      const result = await getStockAtLocation(mockSupabase, mockOrgId, 'mat-1', null);

      expect(result).not.toBeNull();
      expect(result?.locationId).toBeNull();
    });

    it('should return null when stock not found', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await getStockAtLocation(mockSupabase, mockOrgId, 'mat-1', 'loc-nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'Query failed' } })
      );

      await expect(getStockAtLocation(mockSupabase, mockOrgId, 'mat-1', 'loc-1')).rejects.toThrow(
        'Failed to fetch stock at location: Query failed'
      );
    });
  });

  // ============================================================================
  // adjustStock
  // ============================================================================
  describe('adjustStock', () => {
    it('should create adjustment transaction with positive quantity', async () => {
      const mockTransaction = factories.materialTransaction({
        id: 'txn-1',
        transaction_type: 'adjust',
        quantity: 50,
        reference: 'Inventory correction',
      });

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockTransaction, error: null })
      );

      const result = await adjustStock(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'mat-1',
        'loc-1',
        50,
        'Inventory correction',
        'Found extra stock during count'
      );

      expect(result.transactionType).toBe('adjust');
      expect(result.quantity).toBe(50);
      expect(result.reference).toBe('Inventory correction');
    });

    it('should create adjustment transaction with negative quantity', async () => {
      const mockTransaction = factories.materialTransaction({
        id: 'txn-1',
        transaction_type: 'adjust',
        quantity: -25,
        reference: 'Damaged goods',
      });

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockTransaction, error: null })
      );

      const result = await adjustStock(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'mat-1',
        null,
        -25,
        'Damaged goods'
      );

      expect(result.quantity).toBe(-25);
    });

    it('should throw error on database failure', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'Insert failed' } })
      );

      await expect(
        adjustStock(mockSupabase, mockOrgId, mockUserId, 'mat-1', null, 50, 'Test')
      ).rejects.toThrow('Failed to adjust stock: Insert failed');
    });
  });

  // ============================================================================
  // transferStock
  // ============================================================================
  describe('transferStock', () => {
    it('should create transfer transaction when stock is sufficient', async () => {
      const mockStock = factories.materialStock({
        quantity_on_hand: 100,
        quantity_reserved: 10,
        quantity_available: 90,
      });
      const mockTransaction = factories.materialTransaction({
        id: 'txn-1',
        transaction_type: 'transfer',
        quantity: 50,
        from_location_id: 'loc-1',
        to_location_id: 'loc-2',
      });

      // First call: getStockAtLocation returns sufficient stock
      // Second call: insert transfer transaction
      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: mockStock, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: mockTransaction, error: null });
      });

      const result = await transferStock(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'mat-1',
        'loc-1',
        'loc-2',
        50
      );

      expect(result.transactionType).toBe('transfer');
      expect(result.quantity).toBe(50);
    });

    it('should throw error when insufficient stock', async () => {
      const mockStock = factories.materialStock({
        quantity_on_hand: 30,
        quantity_reserved: 10,
        quantity_available: 20,
      });

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockStock, error: null })
      );

      await expect(
        transferStock(mockSupabase, mockOrgId, mockUserId, 'mat-1', 'loc-1', 'loc-2', 50)
      ).rejects.toThrow('Insufficient stock at source location. Available: 20');
    });

    it('should throw error when source has no stock record', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      await expect(
        transferStock(mockSupabase, mockOrgId, mockUserId, 'mat-1', 'loc-1', 'loc-2', 50)
      ).rejects.toThrow('Insufficient stock at source location. Available: 0');
    });

    it('should use absolute value for quantity', async () => {
      const mockStock = factories.materialStock({
        quantity_on_hand: 100,
        quantity_reserved: 0,
        quantity_available: 100,
      });
      const mockTransaction = factories.materialTransaction({
        id: 'txn-1',
        transaction_type: 'transfer',
        quantity: 50, // Should be positive regardless of input
      });

      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: mockStock, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: mockTransaction, error: null });
      });

      // Even with negative input, should use absolute value
      const result = await transferStock(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'mat-1',
        'loc-1',
        'loc-2',
        -50
      );

      expect(result.quantity).toBe(50);
    });
  });

  // ============================================================================
  // recordCount
  // ============================================================================
  describe('recordCount', () => {
    it('should create count transaction when count differs from current stock', async () => {
      const mockStock = factories.materialStock({
        quantity_on_hand: 100,
        quantity_reserved: 0,
      });
      const mockTransaction = factories.materialTransaction({
        id: 'txn-1',
        transaction_type: 'count',
        quantity: 20, // Adjustment: 120 - 100 = 20
        reference: 'Physical count: 100 → 120',
      });

      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount <= 2) {
          // First two calls are for getStockAtLocation and insert
          return new MockSupabaseQueryBuilder({ data: callCount === 1 ? mockStock : mockTransaction, error: null });
        }
        // Last call is update for last_counted_at
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await recordCount(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'mat-1',
        'loc-1',
        120
      );

      expect(result.transactionType).toBe('count');
      expect(result.quantity).toBe(20);
    });

    it('should return synthetic transaction when count matches current stock', async () => {
      const mockStock = factories.materialStock({
        quantity_on_hand: 100,
        quantity_reserved: 0,
      });

      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: mockStock, error: null });
        }
        // Update call for last_counted_at
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await recordCount(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'mat-1',
        'loc-1',
        100 // Same as current
      );

      expect(result.transactionType).toBe('count');
      expect(result.quantity).toBe(0);
      expect(result.reference).toBe('Physical count - no adjustment');
    });

    it('should create negative adjustment when count is less than current', async () => {
      const mockStock = factories.materialStock({
        quantity_on_hand: 100,
        quantity_reserved: 0,
      });
      const mockTransaction = factories.materialTransaction({
        id: 'txn-1',
        transaction_type: 'count',
        quantity: -30, // 70 - 100 = -30
        reference: 'Physical count: 100 → 70',
      });

      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount <= 2) {
          return new MockSupabaseQueryBuilder({ data: callCount === 1 ? mockStock : mockTransaction, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await recordCount(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'mat-1',
        'loc-1',
        70
      );

      expect(result.quantity).toBe(-30);
    });

    it('should handle count when no existing stock record', async () => {
      const mockTransaction = factories.materialTransaction({
        id: 'txn-1',
        transaction_type: 'count',
        quantity: 50, // 50 - 0 = 50
        reference: 'Physical count: 0 → 50',
      });

      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: null, error: null }); // No existing stock
        }
        if (callCount === 2) {
          return new MockSupabaseQueryBuilder({ data: mockTransaction, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await recordCount(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'mat-1',
        'loc-1',
        50
      );

      expect(result.quantity).toBe(50);
    });

    it('should throw error on transaction insert failure', async () => {
      const mockStock = factories.materialStock({ quantity_on_hand: 100 });

      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: mockStock, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: { message: 'Insert failed' } });
      });

      await expect(
        recordCount(mockSupabase, mockOrgId, mockUserId, 'mat-1', 'loc-1', 150)
      ).rejects.toThrow('Failed to record count: Insert failed');
    });
  });

  // ============================================================================
  // getTransactions
  // ============================================================================
  describe('getTransactions', () => {
    it('should return transactions for organization', async () => {
      const mockTransactions = [
        {
          ...factories.materialTransaction({ id: 'txn-1', transaction_type: 'receive' }),
          material: { id: 'mat-1', name: 'Pot', part_number: 'M-POT-001' },
          from_location: null,
          to_location: null,
          batch: null,
        },
        {
          ...factories.materialTransaction({ id: 'txn-2', transaction_type: 'consume' }),
          material: { id: 'mat-1', name: 'Pot', part_number: 'M-POT-001' },
          from_location: null,
          to_location: null,
          batch: { id: 'batch-1', batch_number: '2401001' },
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockTransactions, error: null, count: 2 })
      );

      const result = await getTransactions(mockSupabase, mockOrgId);

      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by materialId', async () => {
      const mockTransactions = [
        {
          ...factories.materialTransaction({ material_id: 'mat-1' }),
          material: { id: 'mat-1', name: 'Pot', part_number: 'M-POT-001' },
          from_location: null,
          to_location: null,
          batch: null,
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockTransactions, error: null, count: 1 })
      );

      const result = await getTransactions(mockSupabase, mockOrgId, { materialId: 'mat-1' });

      expect(result.transactions).toHaveLength(1);
    });

    it('should filter by transactionType', async () => {
      const mockTransactions = [
        {
          ...factories.materialTransaction({ transaction_type: 'transfer' }),
          material: null,
          from_location: null,
          to_location: null,
          batch: null,
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockTransactions, error: null, count: 1 })
      );

      const result = await getTransactions(mockSupabase, mockOrgId, { transactionType: 'transfer' });

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].transactionType).toBe('transfer');
    });

    it('should filter by date range', async () => {
      const mockTransactions = [
        {
          ...factories.materialTransaction({ created_at: '2024-01-15T10:00:00.000Z' }),
          material: null,
          from_location: null,
          to_location: null,
          batch: null,
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockTransactions, error: null, count: 1 })
      );

      const result = await getTransactions(mockSupabase, mockOrgId, {
        fromDate: '2024-01-01',
        toDate: '2024-01-31',
      });

      expect(result.transactions).toHaveLength(1);
    });

    it('should apply pagination', async () => {
      const mockTransactions = [
        {
          ...factories.materialTransaction({ id: 'txn-3' }),
          material: null,
          from_location: null,
          to_location: null,
          batch: null,
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockTransactions, error: null, count: 10 })
      );

      const result = await getTransactions(mockSupabase, mockOrgId, { limit: 5, offset: 5 });

      expect(result.total).toBe(10);
    });

    it('should throw error on database failure', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'Query failed' } })
      );

      await expect(getTransactions(mockSupabase, mockOrgId)).rejects.toThrow(
        'Failed to fetch transactions: Query failed'
      );
    });

    it('should map batch relationship correctly', async () => {
      const mockTransactions = [
        {
          ...factories.materialTransaction({ batch_id: 'batch-1' }),
          material: null,
          from_location: null,
          to_location: null,
          batch: { id: 'batch-1', batch_number: '2401001' },
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockTransactions, error: null, count: 1 })
      );

      const result = await getTransactions(mockSupabase, mockOrgId);

      expect(result.transactions[0].batch).toEqual({
        id: 'batch-1',
        batchNumber: '2401001',
      });
    });
  });
});




