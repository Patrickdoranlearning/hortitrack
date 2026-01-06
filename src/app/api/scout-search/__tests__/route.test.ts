/**
 * Unit tests for scout-search API route
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

import { GET } from '../route';

describe('scout-search API route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (query: string) => {
    return new Request(`http://localhost:3000/api/scout-search?q=${encodeURIComponent(query)}`);
  };

  // ============================================================================
  // Basic Functionality
  // ============================================================================
  describe('Basic Functionality', () => {
    it('should return empty results for short queries', async () => {
      const request = createMockRequest('a');

      const response = await GET(request);
      const data = await response.json();

      expect(data.locations).toEqual([]);
      expect(data.batches).toEqual([]);
    });

    it('should return empty results for empty query', async () => {
      const request = createMockRequest('');

      const response = await GET(request);
      const data = await response.json();

      expect(data.locations).toEqual([]);
      expect(data.batches).toEqual([]);
    });

    it('should search locations and batches for valid queries', async () => {
      const mockLocations = [
        { id: 'loc-1', name: 'Greenhouse A', type: 'greenhouse', nursery_site: 'Main' },
        { id: 'loc-2', name: 'Greenhouse B', type: 'greenhouse', nursery_site: 'Main' },
      ];

      const mockBatches = [
        {
          id: 'batch-1',
          batch_number: '2401001',
          variety_name: 'Red Petunia',
          variety_family: 'Bedding',
          location_id: 'loc-1',
          location_name: 'Greenhouse A',
        },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'nursery_locations') {
          return new MockSupabaseQueryBuilder({ data: mockLocations, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: mockBatches, error: null })
      );

      const request = createMockRequest('green');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.locations).toHaveLength(2);
      expect(data.batches).toHaveLength(1);
    });
  });

  // ============================================================================
  // Location Search
  // ============================================================================
  describe('Location Search', () => {
    it('should map location data correctly', async () => {
      const mockLocations = [
        {
          id: 'loc-1',
          name: 'Greenhouse A',
          type: 'greenhouse',
          nursery_site: 'Main Site',
        },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'nursery_locations') {
          return new MockSupabaseQueryBuilder({ data: mockLocations, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: [], error: null })
      );

      const request = createMockRequest('greenhouse');

      const response = await GET(request);
      const data = await response.json();

      expect(data.locations[0]).toEqual({
        id: 'loc-1',
        name: 'Greenhouse A',
        description: 'greenhouse',
      });
    });

    it('should use nursery_site as description fallback', async () => {
      const mockLocations = [
        {
          id: 'loc-1',
          name: 'Bay 1',
          type: null,
          nursery_site: 'North Site',
        },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'nursery_locations') {
          return new MockSupabaseQueryBuilder({ data: mockLocations, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: [], error: null })
      );

      const request = createMockRequest('bay');

      const response = await GET(request);
      const data = await response.json();

      expect(data.locations[0].description).toBe('North Site');
    });
  });

  // ============================================================================
  // Batch Search (via RPC)
  // ============================================================================
  describe('Batch Search', () => {
    it('should call RPC function with correct parameters', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: [], error: null })
      );

      const request = createMockRequest('petunia');

      await GET(request);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_batches_for_scout', {
        p_org_id: mockOrgId,
        p_search: 'petunia',
        p_limit: 8,
      });
    });

    it('should map batch data correctly', async () => {
      const mockBatches = [
        {
          id: 'batch-1',
          batch_number: '2401001',
          variety_name: 'Red Petunia',
          variety_family: 'Bedding',
          location_id: 'loc-1',
          location_name: 'Greenhouse A',
        },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: mockBatches, error: null })
      );

      const request = createMockRequest('petunia');

      const response = await GET(request);
      const data = await response.json();

      expect(data.batches[0]).toEqual({
        id: 'batch-1',
        batchNumber: '2401001',
        variety: 'Red Petunia',
        family: 'Bedding',
        locationId: 'loc-1',
        locationName: 'Greenhouse A',
      });
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================
  describe('Error Handling', () => {
    it('should return 500 status and error on database failure', async () => {
      const { getUserAndOrg } = require('@/server/auth/org');
      getUserAndOrg.mockRejectedValueOnce(new Error('Database connection failed'));

      const request = createMockRequest('test');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database connection failed');
      expect(data.locations).toEqual([]);
      expect(data.batches).toEqual([]);
    });

    it('should handle null data gracefully', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: null, error: null })
      );

      const request = createMockRequest('test');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.locations).toEqual([]);
      expect(data.batches).toEqual([]);
    });
  });

  // ============================================================================
  // Query Processing
  // ============================================================================
  describe('Query Processing', () => {
    it('should trim whitespace from query', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: [], error: null })
      );

      const request = createMockRequest('  test  ');

      await GET(request);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_batches_for_scout', {
        p_org_id: mockOrgId,
        p_search: 'test',
        p_limit: 8,
      });
    });

    it('should handle special characters in query', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: [], error: null })
      );

      const request = createMockRequest('test%20query');

      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // Concurrent Search
  // ============================================================================
  describe('Concurrent Search', () => {
    it('should run location and batch searches in parallel', async () => {
      const locationPromise = new Promise((resolve) => {
        setTimeout(() => resolve({ data: [], error: null }), 50);
      });

      const batchPromise = new Promise((resolve) => {
        setTimeout(() => resolve({ data: [], error: null }), 50);
      });

      mockSupabase.from = jest.fn((table: string) => ({
        select: () => ({
          eq: () => ({
            ilike: () => ({
              limit: () => locationPromise,
            }),
          }),
        }),
      }));

      mockSupabase.rpc = jest.fn(() => batchPromise);

      const startTime = Date.now();
      const request = createMockRequest('test');

      await GET(request);

      const duration = Date.now() - startTime;

      // If parallel, should take ~50ms. If sequential, ~100ms.
      // Allow some buffer for test overhead
      expect(duration).toBeLessThan(100);
    });
  });
});




