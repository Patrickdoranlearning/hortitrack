/**
 * Unit tests for materials/consumption.ts
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
  getConsumptionRules,
  upsertConsumptionRules,
  getMaterialsForSize,
  previewConsumption,
  consumeMaterialsForBatch,
  reverseConsumption,
} from '../consumption';

describe('materials/consumption', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // getConsumptionRules
  // ============================================================================
  describe('getConsumptionRules', () => {
    it('should return consumption rules for a size', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          material_id: 'mat-1',
          size_id: 'size-1',
          quantity_per_unit: 1,
          material: {
            name: 'Black Pot',
            part_number: 'M-POT-001',
            base_uom: 'each',
          },
        },
        {
          id: 'rule-2',
          material_id: 'mat-2',
          size_id: 'size-1',
          quantity_per_unit: 0.5,
          material: {
            name: 'Soil Mix',
            part_number: 'M-SOI-001',
            base_uom: 'litre',
          },
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockRules, error: null })
      );

      const result = await getConsumptionRules(mockSupabase, mockOrgId, 'size-1');

      expect(result).toHaveLength(2);
      expect(result[0].materialName).toBe('Black Pot');
      expect(result[0].quantityPerUnit).toBe(1);
      expect(result[1].materialName).toBe('Soil Mix');
      expect(result[1].quantityPerUnit).toBe(0.5);
    });

    it('should return empty array when no rules exist', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: [], error: null })
      );

      const result = await getConsumptionRules(mockSupabase, mockOrgId, 'size-no-rules');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'Database error' } })
      );

      await expect(getConsumptionRules(mockSupabase, mockOrgId, 'size-1')).rejects.toThrow(
        'Failed to fetch consumption rules: Database error'
      );
    });

    it('should handle missing material data gracefully', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          material_id: 'mat-1',
          size_id: 'size-1',
          quantity_per_unit: 1,
          material: null, // Missing material
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockRules, error: null })
      );

      const result = await getConsumptionRules(mockSupabase, mockOrgId, 'size-1');

      expect(result[0].materialName).toBe('Unknown');
      expect(result[0].materialPartNumber).toBe('');
    });
  });

  // ============================================================================
  // upsertConsumptionRules
  // ============================================================================
  describe('upsertConsumptionRules', () => {
    it('should delete existing rules and insert new ones', async () => {
      let deleteCallCount = 0;
      let insertCalled = false;

      mockSupabase.from = jest.fn((table: string) => {
        const builder = new MockSupabaseQueryBuilder({ data: null, error: null });
        if (table === 'material_consumption_rules') {
          const originalDelete = builder.delete.bind(builder);
          builder.delete = jest.fn(() => {
            deleteCallCount++;
            return originalDelete();
          });
          const originalInsert = builder.insert.bind(builder);
          builder.insert = jest.fn((data: any) => {
            insertCalled = true;
            return originalInsert(data);
          });
        }
        return builder;
      });

      await upsertConsumptionRules(mockSupabase, mockOrgId, [
        { materialId: 'mat-1', sizeId: 'size-1', quantityPerUnit: 1 },
        { materialId: 'mat-2', sizeId: 'size-1', quantityPerUnit: 0.5 },
      ]);

      expect(deleteCallCount).toBe(2);
      expect(insertCalled).toBe(true);
    });

    it('should handle empty rules array', async () => {
      await expect(
        upsertConsumptionRules(mockSupabase, mockOrgId, [])
      ).resolves.not.toThrow();
    });

    it('should throw error on insert failure', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        const builder = new MockSupabaseQueryBuilder({ data: null, error: null });
        if (table === 'material_consumption_rules') {
          builder.insert = jest.fn(() =>
            new MockSupabaseQueryBuilder({ data: null, error: { message: 'Insert failed' } })
          );
        }
        return builder;
      });

      await expect(
        upsertConsumptionRules(mockSupabase, mockOrgId, [
          { materialId: 'mat-1', sizeId: 'size-1', quantityPerUnit: 1 },
        ])
      ).rejects.toThrow('Failed to save consumption rules: Insert failed');
    });
  });

  // ============================================================================
  // getMaterialsForSize
  // ============================================================================
  describe('getMaterialsForSize', () => {
    it('should return materials linked to a size with consumption types', async () => {
      const mockMaterials = [
        {
          id: 'mat-1',
          name: 'Black Pot',
          part_number: 'M-POT-001',
          base_uom: 'each',
          category: {
            code: 'POT',
            consumption_type: 'per_unit',
          },
        },
        {
          id: 'mat-2',
          name: 'Potting Soil',
          part_number: 'M-SOI-001',
          base_uom: 'litre',
          category: {
            code: 'SOI',
            consumption_type: 'proportional',
          },
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockMaterials, error: null })
      );

      const result = await getMaterialsForSize(mockSupabase, mockOrgId, 'size-1');

      expect(result).toHaveLength(2);
      expect(result[0].consumptionType).toBe('per_unit');
      expect(result[1].consumptionType).toBe('proportional');
    });

    it('should return empty array when no materials linked', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: [], error: null })
      );

      const result = await getMaterialsForSize(mockSupabase, mockOrgId, 'size-no-materials');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'Query failed' } })
      );

      await expect(getMaterialsForSize(mockSupabase, mockOrgId, 'size-1')).rejects.toThrow(
        'Failed to fetch linked materials: Query failed'
      );
    });

    it('should handle missing category data', async () => {
      const mockMaterials = [
        {
          id: 'mat-1',
          name: 'Unknown Material',
          part_number: 'M-XXX-001',
          base_uom: 'each',
          category: null,
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockMaterials, error: null })
      );

      const result = await getMaterialsForSize(mockSupabase, mockOrgId, 'size-1');

      expect(result[0].categoryCode).toBe('');
      expect(result[0].consumptionType).toBe('per_unit'); // Default
    });
  });

  // ============================================================================
  // previewConsumption
  // ============================================================================
  describe('previewConsumption', () => {
    it('should preview consumption for per_unit materials', async () => {
      const mockLinkedMaterials = [
        {
          id: 'mat-1',
          name: 'Black Pot',
          part_number: 'M-POT-001',
          base_uom: 'each',
          category: { code: 'POT', consumption_type: 'per_unit' },
        },
      ];

      const mockStock = [
        { material_id: 'mat-1', quantity_on_hand: 500, quantity_reserved: 0 },
      ];

      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (table === 'materials') {
          return new MockSupabaseQueryBuilder({ data: mockLinkedMaterials, error: null });
        }
        if (table === 'material_consumption_rules') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        if (table === 'material_stock') {
          return new MockSupabaseQueryBuilder({ data: mockStock, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await previewConsumption(mockSupabase, mockOrgId, 'size-1', 100);

      expect(result).toHaveLength(1);
      expect(result[0].materialName).toBe('Black Pot');
      expect(result[0].quantityRequired).toBe(100); // 1:1 for per_unit
      expect(result[0].quantityAvailable).toBe(500);
      expect(result[0].isShortage).toBe(false);
    });

    it('should preview consumption for proportional materials with rules', async () => {
      const mockLinkedMaterials = [
        {
          id: 'mat-1',
          name: 'Soil Mix',
          part_number: 'M-SOI-001',
          base_uom: 'litre',
          category: { code: 'SOI', consumption_type: 'proportional' },
        },
      ];

      const mockRules = [
        {
          id: 'rule-1',
          material_id: 'mat-1',
          size_id: 'size-1',
          quantity_per_unit: 2, // 2 litres per plant
          material: { name: 'Soil Mix', part_number: 'M-SOI-001', base_uom: 'litre' },
        },
      ];

      const mockStock = [
        { material_id: 'mat-1', quantity_on_hand: 500, quantity_reserved: 0 },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'materials') {
          return new MockSupabaseQueryBuilder({ data: mockLinkedMaterials, error: null });
        }
        if (table === 'material_consumption_rules') {
          return new MockSupabaseQueryBuilder({ data: mockRules, error: null });
        }
        if (table === 'material_stock') {
          return new MockSupabaseQueryBuilder({ data: mockStock, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await previewConsumption(mockSupabase, mockOrgId, 'size-1', 100);

      expect(result).toHaveLength(1);
      expect(result[0].quantityRequired).toBe(200); // 100 * 2
    });

    it('should preview consumption for fixed materials', async () => {
      const mockLinkedMaterials = [
        {
          id: 'mat-1',
          name: 'Setup Material',
          part_number: 'M-MKT-001',
          base_uom: 'each',
          category: { code: 'MKT', consumption_type: 'fixed' },
        },
      ];

      const mockRules = [
        {
          id: 'rule-1',
          material_id: 'mat-1',
          size_id: 'size-1',
          quantity_per_unit: 5, // Fixed 5 regardless of batch size
          material: { name: 'Setup Material', part_number: 'M-MKT-001', base_uom: 'each' },
        },
      ];

      const mockStock = [
        { material_id: 'mat-1', quantity_on_hand: 100, quantity_reserved: 0 },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'materials') {
          return new MockSupabaseQueryBuilder({ data: mockLinkedMaterials, error: null });
        }
        if (table === 'material_consumption_rules') {
          return new MockSupabaseQueryBuilder({ data: mockRules, error: null });
        }
        if (table === 'material_stock') {
          return new MockSupabaseQueryBuilder({ data: mockStock, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await previewConsumption(mockSupabase, mockOrgId, 'size-1', 1000);

      expect(result).toHaveLength(1);
      expect(result[0].quantityRequired).toBe(5); // Fixed, not 1000
    });

    it('should detect shortages', async () => {
      const mockLinkedMaterials = [
        {
          id: 'mat-1',
          name: 'Black Pot',
          part_number: 'M-POT-001',
          base_uom: 'each',
          category: { code: 'POT', consumption_type: 'per_unit' },
        },
      ];

      const mockStock = [
        { material_id: 'mat-1', quantity_on_hand: 50, quantity_reserved: 10 },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'materials') {
          return new MockSupabaseQueryBuilder({ data: mockLinkedMaterials, error: null });
        }
        if (table === 'material_consumption_rules') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        if (table === 'material_stock') {
          return new MockSupabaseQueryBuilder({ data: mockStock, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await previewConsumption(mockSupabase, mockOrgId, 'size-1', 100);

      expect(result[0].quantityAvailable).toBe(40); // 50 - 10
      expect(result[0].isShortage).toBe(true);
    });

    it('should return empty array when no materials linked', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'materials') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        if (table === 'material_consumption_rules') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await previewConsumption(mockSupabase, mockOrgId, 'size-1', 100);

      expect(result).toEqual([]);
    });

    it('should include rule-based materials not linked to size', async () => {
      const mockLinkedMaterials: any[] = [];

      const mockRules = [
        {
          id: 'rule-1',
          material_id: 'mat-1',
          size_id: 'size-1',
          quantity_per_unit: 1,
          material: { name: 'Label', part_number: 'M-LBL-001', base_uom: 'each' },
        },
      ];

      const mockStock = [
        { material_id: 'mat-1', quantity_on_hand: 1000, quantity_reserved: 0 },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'materials') {
          return new MockSupabaseQueryBuilder({ data: mockLinkedMaterials, error: null });
        }
        if (table === 'material_consumption_rules') {
          return new MockSupabaseQueryBuilder({ data: mockRules, error: null });
        }
        if (table === 'material_stock') {
          return new MockSupabaseQueryBuilder({ data: mockStock, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await previewConsumption(mockSupabase, mockOrgId, 'size-1', 100);

      expect(result).toHaveLength(1);
      expect(result[0].materialName).toBe('Label');
      expect(result[0].quantityRequired).toBe(100);
    });
  });

  // ============================================================================
  // consumeMaterialsForBatch
  // ============================================================================
  describe('consumeMaterialsForBatch', () => {
    it('should create consumption transactions for all materials', async () => {
      const mockLinkedMaterials = [
        {
          id: 'mat-1',
          name: 'Black Pot',
          part_number: 'M-POT-001',
          base_uom: 'each',
          category: { code: 'POT', consumption_type: 'per_unit' },
        },
      ];

      const mockStock = [
        { material_id: 'mat-1', quantity_on_hand: 500, quantity_reserved: 0 },
      ];

      const mockTransaction = factories.materialTransaction({
        id: 'txn-1',
        transaction_type: 'consume',
        quantity: -100,
      });

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'materials') {
          return new MockSupabaseQueryBuilder({ data: mockLinkedMaterials, error: null });
        }
        if (table === 'material_consumption_rules') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        if (table === 'material_stock') {
          return new MockSupabaseQueryBuilder({ data: mockStock, error: null });
        }
        if (table === 'material_transactions') {
          return new MockSupabaseQueryBuilder({ data: mockTransaction, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await consumeMaterialsForBatch(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'batch-1',
        '2401001',
        'size-1',
        100
      );

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(1);
      expect(result.shortages).toHaveLength(0);
    });

    it('should return failure with shortages when allowPartial is false', async () => {
      const mockLinkedMaterials = [
        {
          id: 'mat-1',
          name: 'Black Pot',
          part_number: 'M-POT-001',
          base_uom: 'each',
          category: { code: 'POT', consumption_type: 'per_unit' },
        },
      ];

      const mockStock = [
        { material_id: 'mat-1', quantity_on_hand: 50, quantity_reserved: 0 },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'materials') {
          return new MockSupabaseQueryBuilder({ data: mockLinkedMaterials, error: null });
        }
        if (table === 'material_consumption_rules') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        if (table === 'material_stock') {
          return new MockSupabaseQueryBuilder({ data: mockStock, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await consumeMaterialsForBatch(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'batch-1',
        '2401001',
        'size-1',
        100,
        null,
        false // allowPartial = false
      );

      expect(result.success).toBe(false);
      expect(result.transactions).toHaveLength(0);
      expect(result.shortages).toHaveLength(1);
      expect(result.shortages[0].required).toBe(100);
      expect(result.shortages[0].available).toBe(50);
    });

    it('should consume partial amounts when allowPartial is true', async () => {
      const mockLinkedMaterials = [
        {
          id: 'mat-1',
          name: 'Black Pot',
          part_number: 'M-POT-001',
          base_uom: 'each',
          category: { code: 'POT', consumption_type: 'per_unit' },
        },
      ];

      const mockStock = [
        { material_id: 'mat-1', quantity_on_hand: 50, quantity_reserved: 0 },
      ];

      const mockTransaction = factories.materialTransaction({
        id: 'txn-1',
        transaction_type: 'consume',
        quantity: -50, // Only 50 available
      });

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'materials') {
          return new MockSupabaseQueryBuilder({ data: mockLinkedMaterials, error: null });
        }
        if (table === 'material_consumption_rules') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        if (table === 'material_stock') {
          return new MockSupabaseQueryBuilder({ data: mockStock, error: null });
        }
        if (table === 'material_transactions') {
          return new MockSupabaseQueryBuilder({ data: mockTransaction, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await consumeMaterialsForBatch(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'batch-1',
        '2401001',
        'size-1',
        100,
        null,
        true // allowPartial = true
      );

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(1);
      expect(result.shortages).toHaveLength(1); // Still reports shortage
    });

    it('should return success with empty arrays when no materials linked', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'materials') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        if (table === 'material_consumption_rules') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await consumeMaterialsForBatch(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'batch-1',
        '2401001',
        'size-1',
        100
      );

      expect(result.success).toBe(true);
      expect(result.transactions).toEqual([]);
      expect(result.shortages).toEqual([]);
    });

    it('should skip materials with zero consumption requirement', async () => {
      const mockLinkedMaterials = [
        {
          id: 'mat-1',
          name: 'Setup Material',
          part_number: 'M-MKT-001',
          base_uom: 'each',
          category: { code: 'MKT', consumption_type: 'fixed' },
        },
      ];

      const mockRules = [
        {
          id: 'rule-1',
          material_id: 'mat-1',
          size_id: 'size-1',
          quantity_per_unit: 0, // Zero consumption
          material: { name: 'Setup Material', part_number: 'M-MKT-001', base_uom: 'each' },
        },
      ];

      const mockStock = [
        { material_id: 'mat-1', quantity_on_hand: 100, quantity_reserved: 0 },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'materials') {
          return new MockSupabaseQueryBuilder({ data: mockLinkedMaterials, error: null });
        }
        if (table === 'material_consumption_rules') {
          return new MockSupabaseQueryBuilder({ data: mockRules, error: null });
        }
        if (table === 'material_stock') {
          return new MockSupabaseQueryBuilder({ data: mockStock, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await consumeMaterialsForBatch(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'batch-1',
        '2401001',
        'size-1',
        100
      );

      expect(result.transactions).toHaveLength(0); // Skipped zero consumption
    });
  });

  // ============================================================================
  // reverseConsumption
  // ============================================================================
  describe('reverseConsumption', () => {
    it('should create return transactions for all consumption transactions', async () => {
      const mockConsumptions = [
        factories.materialTransaction({
          id: 'txn-1',
          transaction_type: 'consume',
          quantity: -100,
          material_id: 'mat-1',
          from_location_id: 'loc-1',
          uom: 'each',
        }),
        factories.materialTransaction({
          id: 'txn-2',
          transaction_type: 'consume',
          quantity: -50,
          material_id: 'mat-2',
          from_location_id: 'loc-1',
          uom: 'litre',
        }),
      ];

      const mockReturnTransaction = factories.materialTransaction({
        id: 'return-1',
        transaction_type: 'return',
        quantity: 100,
      });

      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (callCount === 1) {
          // First call: fetch consumptions
          return new MockSupabaseQueryBuilder({ data: mockConsumptions, error: null });
        }
        // Subsequent calls: insert return transactions
        return new MockSupabaseQueryBuilder({ data: mockReturnTransaction, error: null });
      });

      const result = await reverseConsumption(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'batch-1',
        'Batch cancelled'
      );

      expect(result).toHaveLength(2);
      expect(result[0].transactionType).toBe('return');
      expect(result[0].quantity).toBe(100); // Positive (returned)
    });

    it('should return empty array when no consumption history', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: [], error: null })
      );

      const result = await reverseConsumption(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'batch-no-consumption'
      );

      expect(result).toEqual([]);
    });

    it('should throw error on fetch failure', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'Query failed' } })
      );

      await expect(
        reverseConsumption(mockSupabase, mockOrgId, mockUserId, 'batch-1')
      ).rejects.toThrow('Failed to fetch consumption history: Query failed');
    });

    it('should continue processing other transactions if one fails', async () => {
      const mockConsumptions = [
        factories.materialTransaction({
          id: 'txn-1',
          transaction_type: 'consume',
          quantity: -100,
          material_id: 'mat-1',
        }),
        factories.materialTransaction({
          id: 'txn-2',
          transaction_type: 'consume',
          quantity: -50,
          material_id: 'mat-2',
        }),
      ];

      let insertCallCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'material_transactions') {
          const builder = new MockSupabaseQueryBuilder({ data: mockConsumptions, error: null });
          const originalInsert = builder.insert.bind(builder);
          builder.insert = jest.fn(() => {
            insertCallCount++;
            if (insertCallCount === 1) {
              // First insert fails
              return new MockSupabaseQueryBuilder({ data: null, error: { message: 'Insert failed' } });
            }
            // Second insert succeeds
            return new MockSupabaseQueryBuilder({
              data: factories.materialTransaction({ transaction_type: 'return', quantity: 50 }),
              error: null,
            });
          });
          return builder;
        }
        return new MockSupabaseQueryBuilder({ data: mockConsumptions, error: null });
      });

      const result = await reverseConsumption(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'batch-1'
      );

      // Should have 1 successful return (second one)
      expect(result).toHaveLength(1);
    });

    it('should use absolute value for return quantity', async () => {
      const mockConsumptions = [
        factories.materialTransaction({
          id: 'txn-1',
          transaction_type: 'consume',
          quantity: -100, // Negative consumption
          material_id: 'mat-1',
        }),
      ];

      const mockReturnTransaction = factories.materialTransaction({
        id: 'return-1',
        transaction_type: 'return',
        quantity: 100, // Positive return
      });

      let callCount = 0;
      mockSupabase.from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return new MockSupabaseQueryBuilder({ data: mockConsumptions, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: mockReturnTransaction, error: null });
      });

      const result = await reverseConsumption(
        mockSupabase,
        mockOrgId,
        mockUserId,
        'batch-1'
      );

      expect(result[0].quantity).toBe(100); // Positive
    });
  });
});

