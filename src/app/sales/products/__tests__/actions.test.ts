/**
 * Unit tests for product actions
 * Tests: CRUD for products, SKUs, pricing, batches, aliases, mapping rules
 */

import {
  createMockSupabaseClient,
  createMockUser,
  MockSupabaseQueryBuilder,
  factories,
} from '@/lib/__tests__/test-utils';

// Mock dependencies BEFORE importing module under test
const mockSupabase = createMockSupabaseClient();
const mockUser = createMockUser();
const mockOrgId = 'test-org-id';

// Valid UUIDs for testing
const testUUIDs = {
  productId: '123e4567-e89b-12d3-a456-426614174001',
  skuId: '123e4567-e89b-12d3-a456-426614174002',
  batchId: '123e4567-e89b-12d3-a456-426614174003',
  productBatchId: '123e4567-e89b-12d3-a456-426614174004',
  priceListId: '123e4567-e89b-12d3-a456-426614174005',
  priceId: '123e4567-e89b-12d3-a456-426614174006',
  aliasId: '123e4567-e89b-12d3-a456-426614174007',
  customerId: '123e4567-e89b-12d3-a456-426614174008',
  varietyId: '123e4567-e89b-12d3-a456-426614174009',
  sizeId: '123e4567-e89b-12d3-a456-426614174010',
  ruleId: '123e4567-e89b-12d3-a456-426614174011',
};

jest.mock('@/server/db/supabase', () => ({
  getSupabaseServerApp: jest.fn(() => Promise.resolve(mockSupabase)),
  supabaseAdmin: mockSupabase,
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

// Import AFTER mocks
import {
  upsertProductAction,
  deleteProductAction,
  addProductBatchAction,
  removeProductBatchAction,
  autoLinkProductBatchesAction,
  upsertProductPriceAction,
  deleteProductPriceAction,
  upsertProductAliasAction,
  deleteProductAliasAction,
  createSkuAction,
  updateSkuConfigAction,
  saveMappingRuleAction,
  deleteMappingRuleAction,
  fetchMappingRulesAction,
  runAutoLinkWithRulesAction,
} from '../actions';

describe('product actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // upsertProductAction
  // ============================================================================
  describe('upsertProductAction', () => {
    it('should create a new product', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: factories.product({ id: testUUIDs.productId }),
          error: null,
        })
      );

      const result = await upsertProductAction({
        name: 'New Product',
        skuId: testUUIDs.skuId,
        description: 'A test product',
      });

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(testUUIDs.productId);
    });

    it('should update an existing product', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: factories.product({ name: 'Updated Product' }),
          error: null,
        })
      );

      const result = await upsertProductAction({
        id: testUUIDs.productId,
        name: 'Updated Product',
        skuId: testUUIDs.skuId,
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Updated Product');
    });

    it('should handle validation errors', async () => {
      // Missing required skuId should throw validation error
      await expect(
        upsertProductAction({
          name: 'Test',
          skuId: 'not-a-uuid', // Invalid UUID
        })
      ).rejects.toThrow();
    });

    it('should handle database errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Database error' },
        })
      );

      const result = await upsertProductAction({
        name: 'Test Product',
        skuId: testUUIDs.skuId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });

  // ============================================================================
  // deleteProductAction
  // ============================================================================
  describe('deleteProductAction', () => {
    it('should delete a product', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await deleteProductAction('product-1');

      expect(result.success).toBe(true);
    });

    it('should handle foreign key constraint errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Foreign key constraint violation' },
        })
      );

      const result = await deleteProductAction('product-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Foreign key');
    });
  });

  // ============================================================================
  // addProductBatchAction
  // ============================================================================
  describe('addProductBatchAction', () => {
    it('should link a batch to a product', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await addProductBatchAction({
        productId: testUUIDs.productId,
        batchId: testUUIDs.batchId,
      });

      expect(result.success).toBe(true);
    });

    it('should handle quantity override', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await addProductBatchAction({
        productId: testUUIDs.productId,
        batchId: testUUIDs.batchId,
        availableQuantityOverride: 50,
      });

      expect(result.success).toBe(true);
    });

    it('should handle duplicate errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Duplicate key' },
        })
      );

      const result = await addProductBatchAction({
        productId: testUUIDs.productId,
        batchId: testUUIDs.batchId,
      });

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // removeProductBatchAction
  // ============================================================================
  describe('removeProductBatchAction', () => {
    it('should remove a batch link', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await removeProductBatchAction('product-batch-1');

      expect(result.success).toBe(true);
    });

    it('should handle errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Not found' },
        })
      );

      const result = await removeProductBatchAction('nonexistent');

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // autoLinkProductBatchesAction
  // ============================================================================
  describe('autoLinkProductBatchesAction', () => {
    it('should auto-link matching batches', async () => {
      const mockProduct = factories.product({
        sku_id: 'sku-1',
        skus: {
          id: 'sku-1',
          plant_variety_id: 'var-1',
          size_id: 'size-1',
        },
      });

      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (table === 'products') {
          return new MockSupabaseQueryBuilder({ data: mockProduct, error: null });
        }
        if (table === 'product_batches' && callCount === 2) {
          // Existing links
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({
            data: [{ id: 'batch-1' }, { id: 'batch-2' }],
            error: null,
          });
        }
        if (table === 'product_batches') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await autoLinkProductBatchesAction('product-1');

      expect(result.success).toBe(true);
      expect(result.linked).toBe(2);
    });

    it('should return error for missing product', async () => {
      const result = await autoLinkProductBatchesAction('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Product is required.');
    });

    it('should return error when SKU has no variety/size', async () => {
      const mockProduct = factories.product({
        skus: {
          id: 'sku-1',
          plant_variety_id: null,
          size_id: null,
        },
      });

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockProduct, error: null })
      );

      const result = await autoLinkProductBatchesAction('product-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('missing a variety or size');
    });

    it('should skip already linked batches', async () => {
      const mockProduct = factories.product({
        skus: {
          id: 'sku-1',
          plant_variety_id: 'var-1',
          size_id: 'size-1',
        },
      });

      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (table === 'products') {
          return new MockSupabaseQueryBuilder({ data: mockProduct, error: null });
        }
        if (table === 'product_batches' && callCount === 2) {
          // Already has these batches linked
          return new MockSupabaseQueryBuilder({
            data: [{ batch_id: 'batch-1' }, { batch_id: 'batch-2' }],
            error: null,
          });
        }
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({
            data: [{ id: 'batch-1' }, { id: 'batch-2' }],
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await autoLinkProductBatchesAction('product-1');

      expect(result.success).toBe(true);
      expect(result.linked).toBe(0);
    });
  });

  // ============================================================================
  // upsertProductPriceAction
  // ============================================================================
  describe('upsertProductPriceAction', () => {
    it('should create a new price', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'product_prices') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await upsertProductPriceAction({
        productId: testUUIDs.productId,
        priceListId: testUUIDs.priceListId,
        unitPriceExVat: 15.00,
      });

      expect(result.success).toBe(true);
    });

    it('should update existing price when found', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (table === 'product_prices' && callCount === 1) {
          // Find existing
          return new MockSupabaseQueryBuilder({
            data: { id: testUUIDs.priceId },
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await upsertProductPriceAction({
        productId: testUUIDs.productId,
        priceListId: testUUIDs.priceListId,
        unitPriceExVat: 20.00,
      });

      expect(result.success).toBe(true);
    });

    it('should handle validity dates', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await upsertProductPriceAction({
        productId: testUUIDs.productId,
        priceListId: testUUIDs.priceListId,
        unitPriceExVat: 15.00,
        validFrom: '2024-01-01',
        validTo: '2024-12-31',
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // deleteProductPriceAction
  // ============================================================================
  describe('deleteProductPriceAction', () => {
    it('should delete a price', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await deleteProductPriceAction('price-1');

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // upsertProductAliasAction
  // ============================================================================
  describe('upsertProductAliasAction', () => {
    it('should create a product alias', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await upsertProductAliasAction({
        productId: testUUIDs.productId,
        aliasName: 'Customer-Specific Name',
        customerSkuCode: 'CUST-SKU-001',
        rrp: 25.00,
      });

      expect(result.success).toBe(true);
    });

    it('should update existing alias', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await upsertProductAliasAction({
        id: testUUIDs.aliasId,
        productId: testUUIDs.productId,
        aliasName: 'Updated Alias',
      });

      expect(result.success).toBe(true);
    });

    it('should handle customer-specific aliases', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await upsertProductAliasAction({
        productId: testUUIDs.productId,
        customerId: testUUIDs.customerId,
        aliasName: 'Customer Specific',
        unitPriceExVat: 12.00,
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // deleteProductAliasAction
  // ============================================================================
  describe('deleteProductAliasAction', () => {
    it('should delete an alias', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await deleteProductAliasAction('alias-1');

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // createSkuAction
  // ============================================================================
  describe('createSkuAction', () => {
    it('should create a new SKU', async () => {
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: 1, error: null })
      );
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: factories.sku({ code: 'SKU-0001' }),
          error: null,
        })
      );

      const result = await createSkuAction({
        displayName: 'Test SKU',
        barcode: '1234567890',
        vatRate: 13.5,
      });

      expect(result.success).toBe(true);
      expect(result.data?.code).toBe('SKU-0001');
    });

    it('should use provided code if given', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'skus') {
          return new MockSupabaseQueryBuilder({
            data: factories.sku({ code: 'CUSTOM-SKU' }),
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await createSkuAction({
        code: 'CUSTOM-SKU',
        displayName: 'Custom SKU',
        barcode: '1234567890',
      });

      expect(result.success).toBe(true);
    });

    it('should handle duplicate code by appending timestamp', async () => {
      let selectCallCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'skus') {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Check for existing - found
            return new MockSupabaseQueryBuilder({
              data: { id: 'existing' },
              error: null,
            });
          }
          // Insert with modified code
          return new MockSupabaseQueryBuilder({
            data: factories.sku({ code: 'DUPE-SKU-ABC123' }),
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await createSkuAction({
        code: 'DUPE-SKU',
        displayName: 'Duplicate SKU',
        barcode: '1234567890',
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // updateSkuConfigAction
  // ============================================================================
  describe('updateSkuConfigAction', () => {
    it('should update SKU variety and size configuration', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await updateSkuConfigAction({
        skuId: testUUIDs.skuId,
        plantVarietyId: testUUIDs.varietyId,
        sizeId: testUUIDs.sizeId,
      });

      expect(result.success).toBe(true);
    });

    it('should allow null values for unconfigured SKUs', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await updateSkuConfigAction({
        skuId: testUUIDs.skuId,
        plantVarietyId: null,
        sizeId: null,
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Mapping Rules
  // ============================================================================
  describe('mapping rules', () => {
    describe('fetchMappingRulesAction', () => {
      it('should fetch all mapping rules', async () => {
        mockSupabase.from = jest.fn(() =>
          new MockSupabaseQueryBuilder({
            data: [
              {
                id: 'rule-1',
                name: 'Test Rule',
                product: { id: 'product-1', name: 'Test Product' },
                size: null,
                location: null,
              },
            ],
            error: null,
          })
        );

        const result = await fetchMappingRulesAction();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
      });
    });

    describe('saveMappingRuleAction', () => {
      it('should create a new mapping rule', async () => {
        mockSupabase.from = jest.fn(() =>
          new MockSupabaseQueryBuilder({ data: null, error: null })
        );

        const result = await saveMappingRuleAction({
          productId: testUUIDs.productId,
          name: 'Fern Rule',
          matchFamily: 'Polypodiaceae',
          priority: 100,
          isActive: true,
        });

        expect(result.success).toBe(true);
      });

      it('should update existing rule', async () => {
        mockSupabase.from = jest.fn(() =>
          new MockSupabaseQueryBuilder({ data: null, error: null })
        );

        const result = await saveMappingRuleAction({
          id: testUUIDs.ruleId,
          productId: testUUIDs.productId,
          name: 'Updated Rule',
          priority: 50,
          isActive: true,
        });

        expect(result.success).toBe(true);
      });

      it('should validate required fields', async () => {
        const result = await saveMappingRuleAction({
          productId: testUUIDs.productId,
          name: '', // Empty name should fail
          priority: 100,
          isActive: true,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Rule name is required');
      });
    });

    describe('deleteMappingRuleAction', () => {
      it('should delete a mapping rule', async () => {
        mockSupabase.from = jest.fn(() =>
          new MockSupabaseQueryBuilder({ data: null, error: null })
        );

        const result = await deleteMappingRuleAction('rule-1');

        expect(result.success).toBe(true);
      });
    });

    describe('runAutoLinkWithRulesAction', () => {
      it('should auto-link batches based on rules', async () => {
        let callCount = 0;
        mockSupabase.from = jest.fn((table: string) => {
          callCount++;
          if (table === 'product_mapping_rules') {
            return new MockSupabaseQueryBuilder({
              data: [
                {
                  id: 'rule-1',
                  product_id: 'product-1',
                  match_family: 'Polypodiaceae',
                  is_active: true,
                },
              ],
              error: null,
            });
          }
          if (table === 'batches') {
            return new MockSupabaseQueryBuilder({
              data: [
                {
                  id: 'batch-1',
                  plant_variety_id: 'var-1',
                  size_id: 'size-1',
                  location_id: 'loc-1',
                  status_id: 'status-1',
                  planted_at: '2024-01-01',
                  quantity: 100,
                  plant_variety: {
                    id: 'var-1',
                    name: 'Test Fern',
                    family: 'Polypodiaceae',
                    genus: 'Nephrolepis',
                    category: 'Fern',
                  },
                },
              ],
              error: null,
            });
          }
          if (table === 'product_batches') {
            if (callCount <= 3) {
              return new MockSupabaseQueryBuilder({ data: [], error: null });
            }
            return new MockSupabaseQueryBuilder({ data: null, error: null });
          }
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        });

        const result = await runAutoLinkWithRulesAction();

        expect(result.success).toBe(true);
        expect(result.linked).toBe(1);
      });

      it('should return 0 when no rules configured', async () => {
        mockSupabase.from = jest.fn(() =>
          new MockSupabaseQueryBuilder({ data: [], error: null })
        );

        const result = await runAutoLinkWithRulesAction();

        expect(result.success).toBe(true);
        expect(result.linked).toBe(0);
        expect(result.message).toBe('No active rules configured');
      });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('edge cases', () => {
    it('should handle null/empty descriptions', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: factories.product({ description: null }),
          error: null,
        })
      );

      const result = await upsertProductAction({
        name: 'Product',
        skuId: testUUIDs.skuId,
        description: '', // Should become null
      });

      expect(result.success).toBe(true);
    });

    it('should handle negative price validation', async () => {
      // Negative price should fail zod validation
      await expect(
        upsertProductPriceAction({
          productId: testUUIDs.productId,
          priceListId: testUUIDs.priceListId,
          unitPriceExVat: -10.00, // Invalid
        })
      ).rejects.toThrow();
    });

    it('should handle concurrent batch linking', async () => {
      // Simulate race condition where batch gets linked during auto-link
      const mockProduct = factories.product({
        skus: {
          id: testUUIDs.skuId,
          plant_variety_id: testUUIDs.varietyId,
          size_id: testUUIDs.sizeId,
        },
      });

      let insertCallCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'products') {
          return new MockSupabaseQueryBuilder({ data: mockProduct, error: null });
        }
        if (table === 'product_batches') {
          insertCallCount++;
          if (insertCallCount === 1) {
            return new MockSupabaseQueryBuilder({ data: [], error: null });
          }
          // Simulate duplicate key error on insert
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Duplicate key violation' },
          });
        }
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({
            data: [{ id: testUUIDs.batchId }],
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await autoLinkProductBatchesAction(testUUIDs.productId);

      expect(result.success).toBe(false);
    });
  });
});

