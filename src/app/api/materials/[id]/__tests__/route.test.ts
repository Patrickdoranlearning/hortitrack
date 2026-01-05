/**
 * Unit tests for /api/materials/[id] route
 */

import {
  createMockSupabaseClient,
  createMockUser,
  factories,
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
  getMaterial: jest.fn(),
  updateMaterial: jest.fn(),
  deleteMaterial: jest.fn(),
}));

// Import after mocks
import { GET, PUT, DELETE } from '../route';
import { getMaterial, updateMaterial, deleteMaterial } from '@/server/materials/service';
import { getUserAndOrg } from '@/server/auth/org';

const mockGetMaterial = getMaterial as jest.Mock;
const mockUpdateMaterial = updateMaterial as jest.Mock;
const mockDeleteMaterial = deleteMaterial as jest.Mock;
const mockGetUserAndOrg = getUserAndOrg as jest.Mock;

describe('/api/materials/[id]', () => {
  const materialId = '550e8400-e29b-41d4-a716-446655440000';

  const createContext = (id: string) => ({
    params: Promise.resolve({ id }),
  });

  const createRequest = (method: string, body?: any) => {
    return new Request(`http://localhost/api/materials/${materialId}`, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const mockMaterial = {
    id: materialId,
    orgId: mockOrgId,
    partNumber: 'M-POT-001',
    name: 'Black Pot',
    categoryId: 'cat-1',
    baseUom: 'each',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserAndOrg.mockResolvedValue({
      user: mockUser,
      orgId: mockOrgId,
      supabase: mockSupabase,
    });
  });

  // ============================================================================
  // GET /api/materials/[id]
  // ============================================================================
  describe('GET', () => {
    it('should return material by ID', async () => {
      mockGetMaterial.mockResolvedValue(mockMaterial);

      const response = await GET(createRequest('GET'), createContext(materialId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.material.id).toBe(materialId);
      expect(data.material.partNumber).toBe('M-POT-001');
    });

    it('should return 404 when material not found', async () => {
      mockGetMaterial.mockResolvedValue(null);

      const response = await GET(createRequest('GET'), createContext('nonexistent'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Material not found');
    });

    it('should return 401 for unauthorized access', async () => {
      mockGetUserAndOrg.mockRejectedValue(new Error('Unauthorized'));

      const response = await GET(createRequest('GET'), createContext(materialId));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 500 for service errors', async () => {
      mockGetMaterial.mockRejectedValue(new Error('Database error'));

      const response = await GET(createRequest('GET'), createContext(materialId));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });
  });

  // ============================================================================
  // PUT /api/materials/[id]
  // ============================================================================
  describe('PUT', () => {
    it('should update material successfully', async () => {
      const updatedMaterial = { ...mockMaterial, name: 'Updated Pot' };
      mockGetMaterial.mockResolvedValue(mockMaterial);
      mockUpdateMaterial.mockResolvedValue(updatedMaterial);

      const response = await PUT(
        createRequest('PUT', { name: 'Updated Pot' }),
        createContext(materialId)
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.material.name).toBe('Updated Pot');
      expect(mockUpdateMaterial).toHaveBeenCalledWith(
        mockSupabase,
        mockOrgId,
        materialId,
        { name: 'Updated Pot' }
      );
    });

    it('should return 404 when material not found', async () => {
      mockGetMaterial.mockResolvedValue(null);

      const response = await PUT(
        createRequest('PUT', { name: 'Test' }),
        createContext('nonexistent')
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Material not found');
      expect(mockUpdateMaterial).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid request body', async () => {
      mockGetMaterial.mockResolvedValue(mockMaterial);

      const response = await PUT(
        createRequest('PUT', { baseUom: 'invalid' }),
        createContext(materialId)
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request body');
    });

    it('should update isActive status', async () => {
      const updatedMaterial = { ...mockMaterial, isActive: false };
      mockGetMaterial.mockResolvedValue(mockMaterial);
      mockUpdateMaterial.mockResolvedValue(updatedMaterial);

      const response = await PUT(
        createRequest('PUT', { isActive: false }),
        createContext(materialId)
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.material.isActive).toBe(false);
    });

    it('should allow partial updates', async () => {
      mockGetMaterial.mockResolvedValue(mockMaterial);
      mockUpdateMaterial.mockResolvedValue({
        ...mockMaterial,
        description: 'New description',
      });

      const response = await PUT(
        createRequest('PUT', { description: 'New description' }),
        createContext(materialId)
      );

      expect(response.status).toBe(200);
      expect(mockUpdateMaterial).toHaveBeenCalledWith(
        mockSupabase,
        mockOrgId,
        materialId,
        { description: 'New description' }
      );
    });

    it('should return 401 for unauthorized access', async () => {
      mockGetUserAndOrg.mockRejectedValue(new Error('Unauthorized'));

      const response = await PUT(
        createRequest('PUT', { name: 'Test' }),
        createContext(materialId)
      );
      const data = await response.json();

      expect(response.status).toBe(401);
    });

    it('should return 500 for service errors', async () => {
      mockGetMaterial.mockResolvedValue(mockMaterial);
      mockUpdateMaterial.mockRejectedValue(new Error('Update failed'));

      const response = await PUT(
        createRequest('PUT', { name: 'Test' }),
        createContext(materialId)
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Update failed');
    });
  });

  // ============================================================================
  // DELETE /api/materials/[id]
  // ============================================================================
  describe('DELETE', () => {
    it('should soft delete material successfully', async () => {
      mockGetMaterial.mockResolvedValue(mockMaterial);
      mockDeleteMaterial.mockResolvedValue(undefined);

      const response = await DELETE(createRequest('DELETE'), createContext(materialId));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDeleteMaterial).toHaveBeenCalledWith(mockSupabase, mockOrgId, materialId);
    });

    it('should return 404 when material not found', async () => {
      mockGetMaterial.mockResolvedValue(null);

      const response = await DELETE(createRequest('DELETE'), createContext('nonexistent'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Material not found');
      expect(mockDeleteMaterial).not.toHaveBeenCalled();
    });

    it('should return 401 for unauthorized access', async () => {
      mockGetUserAndOrg.mockRejectedValue(new Error('Unauthorized'));

      const response = await DELETE(createRequest('DELETE'), createContext(materialId));
      const data = await response.json();

      expect(response.status).toBe(401);
    });

    it('should return 500 for service errors', async () => {
      mockGetMaterial.mockResolvedValue(mockMaterial);
      mockDeleteMaterial.mockRejectedValue(new Error('Delete failed'));

      const response = await DELETE(createRequest('DELETE'), createContext(materialId));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Delete failed');
    });
  });
});


