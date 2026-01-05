/**
 * Unit tests for production.ts server actions
 * Tests the createPropagationBatchAction function
 */

import {
  createMockSupabaseClient,
  createMockUser,
} from '@/lib/__tests__/test-utils';

// Mock the dependencies BEFORE importing module under test
const mockSupabase = createMockSupabaseClient();
const mockUser = createMockUser();
const mockOrgId = 'test-org-id';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

const mockGetUserIdAndOrgId = jest.fn();
jest.mock('@/server/auth/getUser', () => ({
  getUserIdAndOrgId: () => mockGetUserIdAndOrgId(),
}));

const mockCreatePropagationBatch = jest.fn();
jest.mock('@/server/batches/service', () => ({
  createPropagationBatch: (...args: unknown[]) => mockCreatePropagationBatch(...args),
}));

// Import AFTER mocks
import { createPropagationBatchAction } from '../production';

// ============================================================================
// Test Data Factories
// ============================================================================

const createValidInput = (overrides: Record<string, unknown> = {}) => ({
  varietyId: 'variety-1-uuid',
  variety: 'Red Petunia',
  family: 'Solanaceae',
  category: 'Annuals',
  sizeId: 'size-1-uuid',
  sizeMultiple: 72,
  fullTrays: 10,
  partialCells: 0,
  locationId: 'location-1-uuid',
  plantingDate: '2024-01-15',
  ...overrides,
});

const createMockBatch = (overrides: Record<string, unknown> = {}) => ({
  id: 'batch-1',
  batch_number: '2401001',
  org_id: mockOrgId,
  plant_variety_id: 'variety-1-uuid',
  size_id: 'size-1-uuid',
  location_id: 'location-1-uuid',
  quantity: 720,
  status: 'Growing',
  created_at: '2024-01-15T00:00:00.000Z',
  created_by: mockUser.id,
  ...overrides,
});

describe('production actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserIdAndOrgId.mockResolvedValue({
      userId: mockUser.id,
      orgId: mockOrgId,
    });
    mockCreatePropagationBatch.mockResolvedValue(createMockBatch());
  });

  // ============================================================================
  // createPropagationBatchAction
  // ============================================================================
  describe('createPropagationBatchAction', () => {
    it('should create a propagation batch successfully', async () => {
      const input = createValidInput();

      const result = await createPropagationBatchAction(input);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: 'batch-1',
        batch_number: '2401001',
      });
    });

    it('should call createPropagationBatch with correct parameters', async () => {
      const input = createValidInput({
        varietyId: 'variety-uuid',
        variety: 'Test Variety',
      });

      await createPropagationBatchAction(input);

      expect(mockCreatePropagationBatch).toHaveBeenCalledWith({
        input: expect.objectContaining({
          varietyId: 'variety-uuid',
          variety: 'Test Variety',
          plant_variety_id: 'variety-uuid',
          sizeId: 'size-1-uuid',
          locationId: 'location-1-uuid',
          fullTrays: 10,
        }),
        userId: mockUser.id,
      });
    });

    it('should use variety as fallback for varietyId if varietyId is undefined', async () => {
      const input = createValidInput({
        varietyId: undefined,
        variety: 'variety-from-variety-field',
      });

      await createPropagationBatchAction(input);

      expect(mockCreatePropagationBatch).toHaveBeenCalledWith({
        input: expect.objectContaining({
          varietyId: 'variety-from-variety-field',
          plant_variety_id: 'variety-from-variety-field',
        }),
        userId: mockUser.id,
      });
    });

    it('should return unauthorized error when userId is null', async () => {
      mockGetUserIdAndOrgId.mockResolvedValue({
        userId: null,
        orgId: null,
      });

      const result = await createPropagationBatchAction(createValidInput());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
      expect(mockCreatePropagationBatch).not.toHaveBeenCalled();
    });

    it('should return error when createPropagationBatch throws', async () => {
      mockCreatePropagationBatch.mockRejectedValue(new Error('Database error: constraint violation'));

      const result = await createPropagationBatchAction(createValidInput());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error: constraint violation');
    });

    it('should handle generic errors', async () => {
      mockCreatePropagationBatch.mockRejectedValue(new Error('Unexpected error'));

      const result = await createPropagationBatchAction(createValidInput());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });

    it('should pass all input fields to createPropagationBatch', async () => {
      const input = createValidInput({
        varietyId: 'variety-uuid',
        family: 'Test Family',
        category: 'Test Category',
        sizeMultiple: 84,
        fullTrays: 5,
        partialCells: 12,
      });

      await createPropagationBatchAction(input);

      expect(mockCreatePropagationBatch).toHaveBeenCalledWith({
        input: expect.objectContaining({
          family: 'Test Family',
          category: 'Test Category',
          sizeMultiple: 84,
          fullTrays: 5,
          partialCells: 12,
        }),
        userId: mockUser.id,
      });
    });

    it('should handle zero fullTrays', async () => {
      const input = createValidInput({
        fullTrays: 0,
        partialCells: 50,
      });

      await createPropagationBatchAction(input);

      expect(mockCreatePropagationBatch).toHaveBeenCalledWith({
        input: expect.objectContaining({
          fullTrays: 0,
          partialCells: 50,
        }),
        userId: mockUser.id,
      });
    });

    it('should handle null family and category', async () => {
      const input = createValidInput({
        family: null,
        category: null,
      });

      await createPropagationBatchAction(input);

      expect(mockCreatePropagationBatch).toHaveBeenCalledWith({
        input: expect.objectContaining({
          family: null,
          category: null,
        }),
        userId: mockUser.id,
      });
    });

    it('should preserve planting date', async () => {
      const input = createValidInput({
        plantingDate: '2024-06-15',
      });

      await createPropagationBatchAction(input);

      expect(mockCreatePropagationBatch).toHaveBeenCalledWith({
        input: expect.objectContaining({
          plantingDate: '2024-06-15',
        }),
        userId: mockUser.id,
      });
    });

    it('should return the created batch data on success', async () => {
      const mockBatch = createMockBatch({
        id: 'new-batch-id',
        batch_number: '2401999',
        quantity: 1440,
      });
      mockCreatePropagationBatch.mockResolvedValue(mockBatch);

      const result = await createPropagationBatchAction(createValidInput());

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockBatch);
      }
    });

    // Edge cases
    it('should handle very large tray counts', async () => {
      const input = createValidInput({
        fullTrays: 10000,
        partialCells: 0,
      });

      const result = await createPropagationBatchAction(input);

      expect(result.success).toBe(true);
    });

    it('should handle getUserIdAndOrgId throwing an error', async () => {
      mockGetUserIdAndOrgId.mockRejectedValue(new Error('Auth service unavailable'));

      const result = await createPropagationBatchAction(createValidInput());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Auth service unavailable');
    });
  });
});


