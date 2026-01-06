/**
 * Unit tests for saleable.ts production service
 * Tests fetching saleable batches, locations, varieties, and status options
 */

import {
  createMockSupabaseClient,
  MockSupabaseQueryBuilder,
} from '@/lib/__tests__/test-utils';

// Mock the dependencies
const mockSupabase = createMockSupabaseClient();

jest.mock('@/server/db/supabase', () => ({
  getSupabaseAdmin: jest.fn(() => mockSupabase),
}));

const mockGetStatusCodesByBehavior = jest.fn();
const mockListAttributeOptions = jest.fn();

jest.mock('@/server/attributeOptions/service', () => ({
  getStatusCodesByBehavior: (...args: unknown[]) => mockGetStatusCodesByBehavior(...args),
  listAttributeOptions: (...args: unknown[]) => mockListAttributeOptions(...args),
}));

import {
  fetchSaleableBatches,
  fetchLocations,
  fetchVarieties,
  fetchProductionStatusOptions,
  SALEABLE_STATUSES,
} from '../saleable';

// ============================================================================
// Test Data Factories
// ============================================================================

const createBatchRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'batch-1',
  batch_number: '2401001',
  status: 'Ready',
  status_id: 'status-1',
  quantity: 100,
  planted_at: '2024-01-01',
  updated_at: '2024-01-15T10:00:00.000Z',
  grower_photo_url: 'https://example.com/grower.jpg',
  sales_photo_url: 'https://example.com/sales.jpg',
  plant_variety_id: 'variety-1',
  size_id: 'size-1',
  location_id: 'location-1',
  ...overrides,
});

const createVarietyRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'variety-1',
  name: 'Red Petunia',
  ...overrides,
});

const createSizeRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'size-1',
  name: '9cm',
  ...overrides,
});

const createLocationRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'location-1',
  name: 'Greenhouse A',
  ...overrides,
});

const mockOrgId = 'test-org-id';

describe('saleable service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStatusCodesByBehavior.mockResolvedValue(['Ready', 'Looking Good']);
    mockListAttributeOptions.mockResolvedValue({
      options: [
        { id: 'status-1', systemCode: 'Ready', displayLabel: 'Ready', behavior: 'available', color: '#00ff00' },
        { id: 'status-2', systemCode: 'Growing', displayLabel: 'Growing', behavior: 'growing', color: '#ffff00' },
      ],
    });
  });

  // ============================================================================
  // fetchSaleableBatches
  // ============================================================================
  describe('fetchSaleableBatches', () => {
    it('should return saleable batches with joined data', async () => {
      const mockBatches = [createBatchRow({ id: 'batch-1' }), createBatchRow({ id: 'batch-2' })];
      const mockVarieties = [createVarietyRow()];
      const mockSizes = [createSizeRow()];
      const mockLocations = [createLocationRow()];

      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
        }
        if (table === 'plant_varieties') {
          return new MockSupabaseQueryBuilder({ data: mockVarieties, error: null });
        }
        if (table === 'plant_sizes') {
          return new MockSupabaseQueryBuilder({ data: mockSizes, error: null });
        }
        if (table === 'nursery_locations') {
          return new MockSupabaseQueryBuilder({ data: mockLocations, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await fetchSaleableBatches(mockOrgId);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'batch-1',
        batchNumber: '2401001',
        status: 'Ready',
        statusId: 'status-1',
        behavior: 'available',
        quantity: 100,
        plantVariety: 'Red Petunia',
        plantVarietyId: 'variety-1',
        size: '9cm',
        sizeId: 'size-1',
        location: 'Greenhouse A',
        locationId: 'location-1',
      });
    });

    it('should return empty array when no batches found', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await fetchSaleableBatches(mockOrgId);

      expect(result).toHaveLength(0);
    });

    it('should return empty array on database error', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Database error' },
        });
      });

      const result = await fetchSaleableBatches(mockOrgId);

      expect(result).toHaveLength(0);
    });

    it('should filter by provided statuses', async () => {
      const mockBatches = [createBatchRow({ status: 'Custom Status' })];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await fetchSaleableBatches(mockOrgId, {
        statuses: ['Custom Status'],
      });

      expect(result).toHaveLength(1);
      expect(mockSupabase.from).toHaveBeenCalledWith('batches');
    });

    it('should expand Ready to include Ready for Sale for legacy support', async () => {
      const mockBatches = [
        createBatchRow({ id: 'batch-1', status: 'Ready' }),
        createBatchRow({ id: 'batch-2', status: 'Ready for Sale' }),
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await fetchSaleableBatches(mockOrgId, {
        statuses: ['Ready'],
      });

      // Both Ready and Ready for Sale batches should be returned
      expect(result).toHaveLength(2);
    });

    it('should fetch all batches when showAll is true', async () => {
      const mockBatches = [
        createBatchRow({ id: 'batch-1', status: 'Growing' }),
        createBatchRow({ id: 'batch-2', status: 'Ready' }),
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await fetchSaleableBatches(mockOrgId, { showAll: true });

      expect(result).toHaveLength(2);
    });

    it('should fallback to SALEABLE_STATUSES when status lookup fails', async () => {
      mockGetStatusCodesByBehavior.mockRejectedValue(new Error('Status lookup failed'));

      const mockBatches = [createBatchRow()];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await fetchSaleableBatches(mockOrgId);

      // Should still return results using fallback statuses
      expect(result).toHaveLength(1);
    });

    it('should fallback to SALEABLE_STATUSES when status lookup returns empty', async () => {
      mockGetStatusCodesByBehavior.mockResolvedValue([]);

      const mockBatches = [createBatchRow()];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await fetchSaleableBatches(mockOrgId);

      expect(result).toHaveLength(1);
    });

    it('should handle missing variety, size, and location gracefully', async () => {
      const mockBatches = [
        createBatchRow({
          id: 'batch-1',
          plant_variety_id: null,
          size_id: null,
          location_id: null,
        }),
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await fetchSaleableBatches(mockOrgId);

      expect(result).toHaveLength(1);
      expect(result[0].plantVariety).toBeNull();
      expect(result[0].size).toBeNull();
      expect(result[0].location).toBeNull();
    });

    it('should handle null batch_number', async () => {
      const mockBatches = [createBatchRow({ batch_number: null })];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await fetchSaleableBatches(mockOrgId);

      expect(result[0].batchNumber).toBe('');
    });

    it('should continue even if related data lookups fail', async () => {
      const mockBatches = [createBatchRow()];

      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
        }
        // All related lookups fail
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Lookup failed' },
        });
      });

      const result = await fetchSaleableBatches(mockOrgId);

      // Should still return batch data, just without joined names
      expect(result).toHaveLength(1);
      expect(result[0].plantVariety).toBeNull();
      expect(result[0].size).toBeNull();
      expect(result[0].location).toBeNull();
    });

    it('should map behavior from status_id correctly', async () => {
      const mockBatches = [
        createBatchRow({ status_id: 'status-1' }),
        createBatchRow({ id: 'batch-2', status_id: 'status-2' }),
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await fetchSaleableBatches(mockOrgId);

      expect(result[0].behavior).toBe('available');
      expect(result[1].behavior).toBe('growing');
    });

    it('should return null behavior for unknown status_id', async () => {
      const mockBatches = [createBatchRow({ status_id: 'unknown-status' })];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await fetchSaleableBatches(mockOrgId);

      expect(result[0].behavior).toBeNull();
    });

    it('should return null behavior when status_id is null', async () => {
      const mockBatches = [createBatchRow({ status_id: null })];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: mockBatches, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await fetchSaleableBatches(mockOrgId);

      expect(result[0].behavior).toBeNull();
    });
  });

  // ============================================================================
  // fetchLocations
  // ============================================================================
  describe('fetchLocations', () => {
    it('should return all locations for the organization', async () => {
      const mockLocations = [
        createLocationRow({ id: 'loc-1', name: 'Greenhouse A' }),
        createLocationRow({ id: 'loc-2', name: 'Greenhouse B' }),
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockLocations, error: null });
      });

      const result = await fetchLocations(mockOrgId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Greenhouse A');
      expect(mockSupabase.from).toHaveBeenCalledWith('nursery_locations');
    });

    it('should return empty array on error', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Database error' },
        });
      });

      const result = await fetchLocations(mockOrgId);

      expect(result).toHaveLength(0);
    });

    it('should return empty array when no locations exist', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await fetchLocations(mockOrgId);

      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // fetchVarieties
  // ============================================================================
  describe('fetchVarieties', () => {
    it('should return all varieties for the organization', async () => {
      const mockVarieties = [
        createVarietyRow({ id: 'var-1', name: 'Red Petunia' }),
        createVarietyRow({ id: 'var-2', name: 'White Petunia' }),
      ];

      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: mockVarieties, error: null });
      });

      const result = await fetchVarieties(mockOrgId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Red Petunia');
      expect(mockSupabase.from).toHaveBeenCalledWith('plant_varieties');
    });

    it('should return empty array on error', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Database error' },
        });
      });

      const result = await fetchVarieties(mockOrgId);

      expect(result).toHaveLength(0);
    });

    it('should return empty array when no varieties exist', async () => {
      mockSupabase.from = jest.fn((_table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await fetchVarieties(mockOrgId);

      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // fetchProductionStatusOptions
  // ============================================================================
  describe('fetchProductionStatusOptions', () => {
    it('should return production status options with behaviors', async () => {
      const result = await fetchProductionStatusOptions(mockOrgId);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'status-1',
        systemCode: 'Ready',
        displayLabel: 'Ready',
        behavior: 'available',
        color: '#00ff00',
      });
      expect(result[1]).toMatchObject({
        id: 'status-2',
        systemCode: 'Growing',
        displayLabel: 'Growing',
        behavior: 'growing',
        color: '#ffff00',
      });
    });

    it('should handle options with missing optional fields', async () => {
      mockListAttributeOptions.mockResolvedValue({
        options: [
          { id: null, systemCode: 'Test', displayLabel: 'Test', behavior: null, color: null },
        ],
      });

      const result = await fetchProductionStatusOptions(mockOrgId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '',
        systemCode: 'Test',
        displayLabel: 'Test',
        behavior: null,
        color: null,
      });
    });

    it('should return empty array when no options exist', async () => {
      mockListAttributeOptions.mockResolvedValue({ options: [] });

      const result = await fetchProductionStatusOptions(mockOrgId);

      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // SALEABLE_STATUSES constant
  // ============================================================================
  describe('SALEABLE_STATUSES', () => {
    it('should contain expected default statuses', () => {
      expect(SALEABLE_STATUSES).toContain('Ready');
      expect(SALEABLE_STATUSES).toContain('Looking Good');
      expect(SALEABLE_STATUSES).toHaveLength(2);
    });
  });
});




