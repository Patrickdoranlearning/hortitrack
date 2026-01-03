/**
 * Unit tests for /api/materials route
 */

import {
  createMockSupabaseClient,
  createMockUser,
  factories,
  MockSupabaseQueryBuilder,
} from '@/lib/__tests__/test-utils';

// Mock dependencies
const mockSupabase = createMockSupabaseClient();
const mockUser = createMockUser();
const mockOrgId = 'test-org-id';

jest.mock('@/server/auth/org', () => ({
  getUserAndOrg: jest.fn(() =>
    Promise.resolve({
      user: mockUser,
      orgId: mockOrgId,
      supabase: mockSupabase,
    })
  ),
}));

// Mock the service functions
jest.mock('@/server/materials/service', () => ({
  listMaterials: jest.fn(),
  createMaterial: jest.fn(),
}));

// Mock generatePartNumber and generateInternalBarcode for createMaterial
jest.mock('@/server/numbering/materials', () => ({
  generatePartNumber: jest.fn(() => Promise.resolve('M-POT-001')),
  generateInternalBarcode: jest.fn(() => 'HT:test-org:M-POT-001'),
}));

// Import after mocks
import { GET, POST } from '../route';
import { listMaterials, createMaterial } from '@/server/materials/service';
import { getUserAndOrg } from '@/server/auth/org';

const mockListMaterials = listMaterials as jest.Mock;
const mockCreateMaterial = createMaterial as jest.Mock;
const mockGetUserAndOrg = getUserAndOrg as jest.Mock;

describe('/api/materials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserAndOrg.mockResolvedValue({
      user: mockUser,
      orgId: mockOrgId,
      supabase: mockSupabase,
    });
  });

  const createRequest = (method: string, body?: any, query?: string) => {
    const url = `http://localhost/api/materials${query ? `?${query}` : ''}`;
    return new Request(url, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  // ============================================================================
  // GET /api/materials
  // ============================================================================
  describe('GET', () => {
    it('should return materials list with default pagination', async () => {
      const mockMaterials = [
        {
          id: 'mat-1',
          partNumber: 'M-POT-001',
          name: 'Black Pot',
          categoryId: 'cat-1',
          baseUom: 'each',
          isActive: true,
        },
      ];

      mockListMaterials.mockResolvedValue({
        materials: mockMaterials,
        total: 1,
      });

      const response = await GET(createRequest('GET'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.materials).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(data.limit).toBe(100);
      expect(data.offset).toBe(0);
    });

    it('should pass query filters to service', async () => {
      mockListMaterials.mockResolvedValue({ materials: [], total: 0 });
      const validCategoryId = '550e8400-e29b-41d4-a716-446655440000';

      await GET(createRequest('GET', null, `categoryId=${validCategoryId}&isActive=true&search=pot`));

      expect(mockListMaterials).toHaveBeenCalledWith(
        mockSupabase,
        mockOrgId,
        expect.objectContaining({
          categoryId: validCategoryId,
          isActive: true,
          search: 'pot',
        })
      );
    });

    it('should handle pagination parameters', async () => {
      mockListMaterials.mockResolvedValue({ materials: [], total: 50 });

      const response = await GET(createRequest('GET', null, 'limit=10&offset=20'));
      const data = await response.json();

      expect(mockListMaterials).toHaveBeenCalledWith(
        mockSupabase,
        mockOrgId,
        expect.objectContaining({
          limit: 10,
          offset: 20,
        })
      );
      expect(data.limit).toBe(10);
      expect(data.offset).toBe(20);
    });

    it('should handle isActive=false filter', async () => {
      mockListMaterials.mockResolvedValue({ materials: [], total: 0 });

      await GET(createRequest('GET', null, 'isActive=false'));

      expect(mockListMaterials).toHaveBeenCalledWith(
        mockSupabase,
        mockOrgId,
        expect.objectContaining({
          isActive: false,
        })
      );
    });

    it('should return 400 for invalid query parameters', async () => {
      const response = await GET(createRequest('GET', null, 'limit=invalid'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid query parameters');
    });

    it('should return 401 for unauthorized access', async () => {
      mockGetUserAndOrg.mockRejectedValue(new Error('Unauthorized'));

      const response = await GET(createRequest('GET'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 500 for service errors', async () => {
      mockListMaterials.mockRejectedValue(new Error('Database connection failed'));

      const response = await GET(createRequest('GET'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database connection failed');
    });
  });

  // ============================================================================
  // POST /api/materials
  // ============================================================================
  describe('POST', () => {
    const validMaterialData = {
      name: 'New Pot',
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
      baseUom: 'each',
    };

    it('should create material successfully', async () => {
      const createdMaterial = {
        id: 'new-mat-1',
        partNumber: 'M-POT-001',
        name: 'New Pot',
        categoryId: '550e8400-e29b-41d4-a716-446655440000',
        baseUom: 'each',
        isActive: true,
      };

      mockCreateMaterial.mockResolvedValue(createdMaterial);

      const response = await POST(createRequest('POST', validMaterialData));
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.material.partNumber).toBe('M-POT-001');
      expect(mockCreateMaterial).toHaveBeenCalledWith(
        mockSupabase,
        mockOrgId,
        validMaterialData
      );
    });

    it('should return 400 for missing required fields', async () => {
      const response = await POST(createRequest('POST', { name: 'Test' }));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request body');
    });

    it('should return 400 for invalid category ID format', async () => {
      const response = await POST(
        createRequest('POST', {
          name: 'Test',
          categoryId: 'invalid-uuid',
        })
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request body');
    });

    it('should return 400 for invalid UOM', async () => {
      const response = await POST(
        createRequest('POST', {
          name: 'Test',
          categoryId: '550e8400-e29b-41d4-a716-446655440000',
          baseUom: 'invalid',
        })
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request body');
    });

    it('should accept all valid UOM values', async () => {
      const validUoms = ['each', 'litre', 'kg', 'ml', 'g'];

      for (const uom of validUoms) {
        mockCreateMaterial.mockResolvedValue({
          id: 'mat-1',
          name: 'Test',
          baseUom: uom,
        });

        const response = await POST(
          createRequest('POST', {
            name: 'Test',
            categoryId: '550e8400-e29b-41d4-a716-446655440000',
            baseUom: uom,
          })
        );

        expect(response.status).toBe(201);
      }
    });

    it('should return 401 for unauthorized access', async () => {
      mockGetUserAndOrg.mockRejectedValue(new Error('Unauthorized'));

      const response = await POST(createRequest('POST', validMaterialData));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 500 for service errors', async () => {
      mockCreateMaterial.mockRejectedValue(new Error('Failed to create material'));

      const response = await POST(createRequest('POST', validMaterialData));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create material');
    });

    it('should accept optional fields', async () => {
      const fullMaterialData = {
        ...validMaterialData,
        description: 'A nice pot',
        linkedSizeId: '550e8400-e29b-41d4-a716-446655440001',
        defaultSupplierId: '550e8400-e29b-41d4-a716-446655440002',
        reorderPoint: 100,
        reorderQuantity: 500,
        targetStock: 1000,
        standardCost: 0.25,
        barcode: '1234567890',
      };

      mockCreateMaterial.mockResolvedValue({
        id: 'mat-1',
        ...fullMaterialData,
        partNumber: 'M-POT-001',
      });

      const response = await POST(createRequest('POST', fullMaterialData));
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(mockCreateMaterial).toHaveBeenCalledWith(
        mockSupabase,
        mockOrgId,
        fullMaterialData
      );
    });
  });
});

