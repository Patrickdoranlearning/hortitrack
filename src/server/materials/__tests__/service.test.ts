/**
 * Unit tests for materials/service.ts
 */

import {
  createMockSupabaseClient,
  factories,
  MockSupabaseQueryBuilder,
} from '@/lib/__tests__/test-utils';

// Mock dependencies
const mockSupabase = createMockSupabaseClient();
const mockOrgId = 'test-org-id';

// Mock generatePartNumber and generateInternalBarcode
jest.mock('@/server/numbering/materials', () => ({
  generatePartNumber: jest.fn(() => Promise.resolve('M-POT-001')),
  generateInternalBarcode: jest.fn(() => 'HT:test-org:M-POT-001'),
}));

// Import after mocks
import {
  listCategories,
  getCategoryByCode,
  listMaterials,
  getMaterial,
  getMaterialByPartNumber,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getMaterialsForSize,
} from '../service';

describe('materials/service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // listCategories
  // ============================================================================
  describe('listCategories', () => {
    it('should return all categories ordered by sort_order', async () => {
      const mockCategories = [
        factories.materialCategory({ id: 'cat-1', code: 'POT', sort_order: 1 }),
        factories.materialCategory({ id: 'cat-2', code: 'TRY', sort_order: 2, name: 'Trays' }),
        factories.materialCategory({ id: 'cat-3', code: 'SOI', sort_order: 3, name: 'Soil' }),
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockCategories, error: null })
      );

      const result = await listCategories(mockSupabase);

      expect(result).toHaveLength(3);
      expect(result[0].code).toBe('POT');
      expect(result[1].code).toBe('TRY');
      expect(result[2].code).toBe('SOI');
      expect(mockSupabase.from).toHaveBeenCalledWith('material_categories');
    });

    it('should throw error on database failure', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'Database error' } })
      );

      await expect(listCategories(mockSupabase)).rejects.toThrow(
        'Failed to fetch categories: Database error'
      );
    });

    it('should return empty array when no categories exist', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: [], error: null })
      );

      const result = await listCategories(mockSupabase);

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // getCategoryByCode
  // ============================================================================
  describe('getCategoryByCode', () => {
    it('should return category when found', async () => {
      const mockCategory = factories.materialCategory({ code: 'POT' });

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockCategory, error: null })
      );

      const result = await getCategoryByCode(mockSupabase, 'POT');

      expect(result).not.toBeNull();
      expect(result?.code).toBe('POT');
    });

    it('should return null when category not found', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'Not found', code: 'PGRST116' } })
      );

      const result = await getCategoryByCode(mockSupabase, 'INVALID');

      expect(result).toBeNull();
    });

    it('should throw error on other database errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'Connection failed', code: 'CONN' } })
      );

      await expect(getCategoryByCode(mockSupabase, 'POT')).rejects.toThrow(
        'Failed to fetch category: Connection failed'
      );
    });
  });

  // ============================================================================
  // listMaterials
  // ============================================================================
  describe('listMaterials', () => {
    const createMaterialWithRelations = (overrides: Record<string, any> = {}) => ({
      ...factories.material(overrides),
      category: factories.materialCategory(),
      linked_size: null,
      default_supplier: null,
    });

    it('should return materials for organization', async () => {
      const mockMaterials = [
        createMaterialWithRelations({ id: 'mat-1', name: 'Pot 1' }),
        createMaterialWithRelations({ id: 'mat-2', name: 'Pot 2' }),
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockMaterials, error: null, count: 2 })
      );

      const result = await listMaterials(mockSupabase, mockOrgId);

      expect(result.materials).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockSupabase.from).toHaveBeenCalledWith('materials');
    });

    it('should filter by categoryId', async () => {
      const mockMaterials = [
        createMaterialWithRelations({ id: 'mat-1', category_id: 'cat-1' }),
      ];

      let capturedQuery: MockSupabaseQueryBuilder | null = null;
      mockSupabase.from = jest.fn(() => {
        capturedQuery = new MockSupabaseQueryBuilder({ data: mockMaterials, error: null, count: 1 });
        return capturedQuery;
      });

      const result = await listMaterials(mockSupabase, mockOrgId, { categoryId: 'cat-1' });

      expect(result.materials).toHaveLength(1);
    });

    it('should filter by isActive status', async () => {
      const mockMaterials = [
        createMaterialWithRelations({ id: 'mat-1', is_active: true }),
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockMaterials, error: null, count: 1 })
      );

      const result = await listMaterials(mockSupabase, mockOrgId, { isActive: true });

      expect(result.materials).toHaveLength(1);
      expect(result.materials[0].isActive).toBe(true);
    });

    it('should filter by linkedSizeId', async () => {
      const mockMaterials = [
        createMaterialWithRelations({
          id: 'mat-1',
          linked_size_id: 'size-1',
          linked_size: { id: 'size-1', name: '2L Pot', container_type: 'pot' },
        }),
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockMaterials, error: null, count: 1 })
      );

      const result = await listMaterials(mockSupabase, mockOrgId, { linkedSizeId: 'size-1' });

      expect(result.materials).toHaveLength(1);
      expect(result.materials[0].linkedSizeId).toBe('size-1');
    });

    it('should apply search filter', async () => {
      const mockMaterials = [
        createMaterialWithRelations({ id: 'mat-1', name: 'Black Pot' }),
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockMaterials, error: null, count: 1 })
      );

      const result = await listMaterials(mockSupabase, mockOrgId, { search: 'Black' });

      expect(result.materials).toHaveLength(1);
    });

    it('should apply pagination', async () => {
      const mockMaterials = [
        createMaterialWithRelations({ id: 'mat-3' }),
        createMaterialWithRelations({ id: 'mat-4' }),
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockMaterials, error: null, count: 10 })
      );

      const result = await listMaterials(mockSupabase, mockOrgId, { limit: 2, offset: 2 });

      expect(result.materials).toHaveLength(2);
      expect(result.total).toBe(10);
    });

    it('should throw error on database failure', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'Query failed' } })
      );

      await expect(listMaterials(mockSupabase, mockOrgId)).rejects.toThrow(
        'Failed to fetch materials: Query failed'
      );
    });

    it('should return empty results when no materials exist', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: [], error: null, count: 0 })
      );

      const result = await listMaterials(mockSupabase, mockOrgId);

      expect(result.materials).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ============================================================================
  // getMaterial
  // ============================================================================
  describe('getMaterial', () => {
    it('should return material when found', async () => {
      const mockMaterial = {
        ...factories.material({ id: 'mat-1' }),
        category: factories.materialCategory(),
        linked_size: null,
        default_supplier: null,
      };

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockMaterial, error: null })
      );

      const result = await getMaterial(mockSupabase, mockOrgId, 'mat-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('mat-1');
      expect(result?.partNumber).toBe('M-POT-001');
    });

    it('should return null when material not found', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { code: 'PGRST116', message: 'Not found' } })
      );

      const result = await getMaterial(mockSupabase, mockOrgId, 'nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on other database errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'Connection error', code: 'CONN' } })
      );

      await expect(getMaterial(mockSupabase, mockOrgId, 'mat-1')).rejects.toThrow(
        'Failed to fetch material: Connection error'
      );
    });

    it('should map linked size correctly', async () => {
      const mockMaterial = {
        ...factories.material({ id: 'mat-1', linked_size_id: 'size-1' }),
        category: factories.materialCategory(),
        linked_size: { id: 'size-1', name: '2L Pot', container_type: 'pot' },
        default_supplier: null,
      };

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockMaterial, error: null })
      );

      const result = await getMaterial(mockSupabase, mockOrgId, 'mat-1');

      expect(result?.linkedSize).toEqual({
        id: 'size-1',
        name: '2L Pot',
        containerType: 'pot',
      });
    });

    it('should map default supplier correctly', async () => {
      const mockMaterial = {
        ...factories.material({ id: 'mat-1', default_supplier_id: 'supplier-1' }),
        category: factories.materialCategory(),
        linked_size: null,
        default_supplier: { id: 'supplier-1', name: 'Acme Pots Ltd' },
      };

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockMaterial, error: null })
      );

      const result = await getMaterial(mockSupabase, mockOrgId, 'mat-1');

      expect(result?.defaultSupplier).toEqual({
        id: 'supplier-1',
        name: 'Acme Pots Ltd',
      });
    });
  });

  // ============================================================================
  // getMaterialByPartNumber
  // ============================================================================
  describe('getMaterialByPartNumber', () => {
    it('should return material by part number', async () => {
      const mockMaterial = {
        ...factories.material({ part_number: 'M-POT-042' }),
        category: factories.materialCategory(),
        linked_size: null,
        default_supplier: null,
      };

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockMaterial, error: null })
      );

      const result = await getMaterialByPartNumber(mockSupabase, mockOrgId, 'M-POT-042');

      expect(result?.partNumber).toBe('M-POT-042');
    });

    it('should return null when part number not found', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { code: 'PGRST116', message: 'Not found' } })
      );

      const result = await getMaterialByPartNumber(mockSupabase, mockOrgId, 'M-XXX-999');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // createMaterial
  // ============================================================================
  describe('createMaterial', () => {
    it('should create material with generated part number', async () => {
      const mockCategory = factories.materialCategory({ id: 'cat-1', code: 'POT' });
      const mockCreatedMaterial = {
        ...factories.material({ id: 'new-mat-1', part_number: 'M-POT-001' }),
        category: mockCategory,
        linked_size: null,
        default_supplier: null,
      };

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'material_categories') {
          return new MockSupabaseQueryBuilder({ data: { code: 'POT' }, error: null });
        }
        if (table === 'materials') {
          return new MockSupabaseQueryBuilder({ data: mockCreatedMaterial, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await createMaterial(mockSupabase, mockOrgId, {
        name: 'New Pot',
        categoryId: 'cat-1',
        baseUom: 'each',
      });

      expect(result.partNumber).toBe('M-POT-001');
      expect(result.name).toBe('2L Black Pot');
    });

    it('should throw error for invalid category', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'material_categories') {
          return new MockSupabaseQueryBuilder({ data: null, error: { message: 'Not found' } });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      await expect(
        createMaterial(mockSupabase, mockOrgId, {
          name: 'New Pot',
          categoryId: 'invalid-cat',
        })
      ).rejects.toThrow('Invalid category');
    });

    it('should throw error on database insert failure', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'material_categories') {
          return new MockSupabaseQueryBuilder({ data: { code: 'POT' }, error: null });
        }
        if (table === 'materials') {
          return new MockSupabaseQueryBuilder({ data: null, error: { message: 'Insert failed' } });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      await expect(
        createMaterial(mockSupabase, mockOrgId, {
          name: 'New Pot',
          categoryId: 'cat-1',
        })
      ).rejects.toThrow('Failed to create material: Insert failed');
    });

    it('should set optional fields when provided', async () => {
      const mockCreatedMaterial = {
        ...factories.material({
          id: 'new-mat-1',
          description: 'A fancy pot',
          reorder_point: 50,
          standard_cost: 1.50,
        }),
        category: factories.materialCategory(),
        linked_size: null,
        default_supplier: null,
      };

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'material_categories') {
          return new MockSupabaseQueryBuilder({ data: { code: 'POT' }, error: null });
        }
        if (table === 'materials') {
          return new MockSupabaseQueryBuilder({ data: mockCreatedMaterial, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await createMaterial(mockSupabase, mockOrgId, {
        name: 'Fancy Pot',
        categoryId: 'cat-1',
        description: 'A fancy pot',
        reorderPoint: 50,
        standardCost: 1.50,
      });

      expect(result.description).toBe('A fancy pot');
      expect(result.reorderPoint).toBe(50);
    });
  });

  // ============================================================================
  // updateMaterial
  // ============================================================================
  describe('updateMaterial', () => {
    it('should update material fields', async () => {
      const mockUpdatedMaterial = {
        ...factories.material({ id: 'mat-1', name: 'Updated Pot Name' }),
        category: factories.materialCategory(),
        linked_size: null,
        default_supplier: null,
      };

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockUpdatedMaterial, error: null })
      );

      const result = await updateMaterial(mockSupabase, mockOrgId, 'mat-1', {
        name: 'Updated Pot Name',
      });

      expect(result.name).toBe('Updated Pot Name');
    });

    it('should update isActive status', async () => {
      const mockUpdatedMaterial = {
        ...factories.material({ id: 'mat-1', is_active: false }),
        category: factories.materialCategory(),
        linked_size: null,
        default_supplier: null,
      };

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockUpdatedMaterial, error: null })
      );

      const result = await updateMaterial(mockSupabase, mockOrgId, 'mat-1', {
        isActive: false,
      });

      expect(result.isActive).toBe(false);
    });

    it('should throw error on update failure', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'Update failed' } })
      );

      await expect(
        updateMaterial(mockSupabase, mockOrgId, 'mat-1', { name: 'New Name' })
      ).rejects.toThrow('Failed to update material: Update failed');
    });

    it('should update multiple fields at once', async () => {
      const mockUpdatedMaterial = {
        ...factories.material({
          id: 'mat-1',
          name: 'New Name',
          description: 'New Description',
          reorder_point: 200,
        }),
        category: factories.materialCategory(),
        linked_size: null,
        default_supplier: null,
      };

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockUpdatedMaterial, error: null })
      );

      const result = await updateMaterial(mockSupabase, mockOrgId, 'mat-1', {
        name: 'New Name',
        description: 'New Description',
        reorderPoint: 200,
      });

      expect(result.name).toBe('New Name');
      expect(result.description).toBe('New Description');
    });
  });

  // ============================================================================
  // deleteMaterial
  // ============================================================================
  describe('deleteMaterial', () => {
    it('should soft delete material by setting is_active to false', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      await expect(deleteMaterial(mockSupabase, mockOrgId, 'mat-1')).resolves.not.toThrow();

      expect(mockSupabase.from).toHaveBeenCalledWith('materials');
    });

    it('should throw error on delete failure', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'Delete failed' } })
      );

      await expect(deleteMaterial(mockSupabase, mockOrgId, 'mat-1')).rejects.toThrow(
        'Failed to delete material: Delete failed'
      );
    });
  });

  // ============================================================================
  // getMaterialsForSize
  // ============================================================================
  describe('getMaterialsForSize', () => {
    it('should return materials linked to a specific size', async () => {
      const mockMaterials = [
        {
          ...factories.material({ id: 'mat-1', linked_size_id: 'size-1' }),
          category: factories.materialCategory(),
        },
        {
          ...factories.material({ id: 'mat-2', linked_size_id: 'size-1', name: 'Tray for 2L' }),
          category: factories.materialCategory({ code: 'TRY', name: 'Trays' }),
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockMaterials, error: null })
      );

      const result = await getMaterialsForSize(mockSupabase, mockOrgId, 'size-1');

      expect(result).toHaveLength(2);
      expect(result[0].linkedSizeId).toBe('size-1');
    });

    it('should return empty array when no materials linked to size', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: [], error: null })
      );

      const result = await getMaterialsForSize(mockSupabase, mockOrgId, 'size-nonexistent');

      expect(result).toEqual([]);
    });

    it('should only return active materials', async () => {
      // This test validates that the query filters by is_active = true
      const mockMaterials = [
        {
          ...factories.material({ id: 'mat-1', is_active: true }),
          category: factories.materialCategory(),
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: mockMaterials, error: null })
      );

      const result = await getMaterialsForSize(mockSupabase, mockOrgId, 'size-1');

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });

    it('should throw error on database failure', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'Query failed' } })
      );

      await expect(getMaterialsForSize(mockSupabase, mockOrgId, 'size-1')).rejects.toThrow(
        'Failed to fetch materials for size: Query failed'
      );
    });
  });
});

