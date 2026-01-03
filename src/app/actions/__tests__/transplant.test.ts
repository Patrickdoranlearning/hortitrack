/**
 * Unit tests for transplant.ts server actions
 * Tests the transplantBatchAction function using PostgreSQL RPC
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

jest.mock('@/server/auth/org', () => ({
  getUserAndOrg: jest.fn(() =>
    Promise.resolve({
      user: mockUser,
      orgId: mockOrgId,
      supabase: mockSupabase,
    })
  ),
}));

// Mock revalidatePath (Next.js cache function)
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// Import AFTER mocks
import { transplantBatchAction } from '../transplant';
import { revalidatePath } from 'next/cache';

// ============================================================================
// Test Data Factories
// ============================================================================

const createValidInput = (overrides: Record<string, unknown> = {}) => ({
  parent_batch_id: '11111111-1111-1111-1111-111111111111',
  size_id: '22222222-2222-2222-2222-222222222222',
  location_id: '33333333-3333-3333-3333-333333333333',
  containers: 10,
  planted_at: '2024-01-15',
  notes: 'Test transplant',
  archive_parent_if_empty: true,
  ...overrides,
});

const createMockRpcResponse = (overrides: Record<string, unknown> = {}) => ({
  request_id: 'request-123',
  child_batch: {
    id: 'child-batch-id',
    batch_number: '2401001',
    quantity: 720,
    phase: 'Growing',
  },
  parent_new_quantity: 280,
  ...overrides,
});

describe('transplant actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.rpc = jest.fn(() =>
      Promise.resolve({
        data: createMockRpcResponse(),
        error: null,
      })
    );
  });

  // ============================================================================
  // transplantBatchAction
  // ============================================================================
  describe('transplantBatchAction', () => {
    it('should transplant a batch successfully', async () => {
      const input = createValidInput();

      const result = await transplantBatchAction(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatchObject({
          requestId: 'request-123',
          childBatch: {
            id: 'child-batch-id',
            batchNumber: '2401001',
            quantity: 720,
            phase: 'Growing',
          },
          parentNewQuantity: 280,
        });
      }
    });

    it('should call RPC with correct parameters', async () => {
      const input = createValidInput({
        containers: 5,
        planted_at: '2024-02-01',
        notes: 'Special notes',
        archive_parent_if_empty: false,
      });

      await transplantBatchAction(input);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('perform_transplant', {
        p_org_id: mockOrgId,
        p_parent_batch_id: '11111111-1111-1111-1111-111111111111',
        p_size_id: '22222222-2222-2222-2222-222222222222',
        p_location_id: '33333333-3333-3333-3333-333333333333',
        p_containers: 5,
        p_user_id: mockUser.id,
        p_planted_at: '2024-02-01',
        p_notes: 'Special notes',
        p_archive_parent_if_empty: false,
        p_units: null,
      });
    });

    it('should use units when provided (takes precedence over containers)', async () => {
      const input = createValidInput({
        containers: 10,
        units: 500,
      });

      await transplantBatchAction(input);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'perform_transplant',
        expect.objectContaining({
          p_containers: 10,
          p_units: 500,
        })
      );
    });

    it('should default containers to 1 when not provided', async () => {
      const input = createValidInput();
      delete (input as Record<string, unknown>).containers;

      await transplantBatchAction(input);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'perform_transplant',
        expect.objectContaining({
          p_containers: 1,
        })
      );
    });

    it('should handle null optional fields', async () => {
      const input = createValidInput({
        planted_at: undefined,
        notes: undefined,
      });

      await transplantBatchAction(input);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'perform_transplant',
        expect.objectContaining({
          p_planted_at: null,
          p_notes: null,
        })
      );
    });

    it('should revalidate paths on success', async () => {
      await transplantBatchAction(createValidInput());

      expect(revalidatePath).toHaveBeenCalledWith('/production/batches');
      expect(revalidatePath).toHaveBeenCalledWith('/production');
    });

    // Error handling
    it('should return friendly error for insufficient quantity', async () => {
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({
          data: null,
          error: { message: 'Insufficient quantity in source batch' },
        })
      );

      const result = await transplantBatchAction(createValidInput());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Not enough plants in the source batch');
      }
    });

    it('should return friendly error for batch not found', async () => {
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({
          data: null,
          error: { message: 'Batch not found' },
        })
      );

      const result = await transplantBatchAction(createValidInput());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Batch not found or you don't have access");
      }
    });

    it('should return generic error message for other RPC errors', async () => {
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({
          data: null,
          error: { message: 'Database connection failed' },
        })
      );

      const result = await transplantBatchAction(createValidInput());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Database connection failed');
      }
    });

    it('should return validation error for invalid input', async () => {
      const invalidInput = {
        parent_batch_id: 'not-a-uuid', // Invalid UUID
        size_id: '22222222-2222-2222-2222-222222222222',
        location_id: '33333333-3333-3333-3333-333333333333',
        containers: 10,
      };

      const result = await transplantBatchAction(invalidInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid input data');
      }
    });

    it('should return validation error for missing required fields', async () => {
      const invalidInput = {
        parent_batch_id: '11111111-1111-1111-1111-111111111111',
        // Missing size_id and location_id
      };

      const result = await transplantBatchAction(invalidInput as any);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid input data');
      }
    });

    it('should handle non-Error exceptions', async () => {
      mockSupabase.rpc = jest.fn(() => {
        throw 'String error';
      });

      const result = await transplantBatchAction(createValidInput());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('An unexpected error occurred');
      }
    });

    it('should transform snake_case response to camelCase', async () => {
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({
          data: {
            request_id: 'req-456',
            child_batch: {
              id: 'batch-xyz',
              batch_number: 'B2401099',
              quantity: 1000,
              phase: 'Potted',
            },
            parent_new_quantity: 0,
          },
          error: null,
        })
      );

      const result = await transplantBatchAction(createValidInput());

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requestId).toBe('req-456');
        expect(result.data.childBatch.batchNumber).toBe('B2401099');
        expect(result.data.parentNewQuantity).toBe(0);
      }
    });

    // Edge cases
    it('should handle zero containers with units provided', async () => {
      const input = createValidInput({
        containers: 0,
        units: 100,
      });

      await transplantBatchAction(input);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'perform_transplant',
        expect.objectContaining({
          p_containers: 0,
          p_units: 100,
        })
      );
    });

    it('should handle very large quantities', async () => {
      const input = createValidInput({
        containers: 10000,
        units: 1000000,
      });

      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({
          data: createMockRpcResponse({
            child_batch: {
              id: 'large-batch',
              batch_number: 'B2401999',
              quantity: 1000000,
              phase: 'Growing',
            },
          }),
          error: null,
        })
      );

      const result = await transplantBatchAction(input);

      expect(result.success).toBe(true);
    });

    it('should handle parent batch being fully depleted', async () => {
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({
          data: createMockRpcResponse({
            parent_new_quantity: 0,
          }),
          error: null,
        })
      );

      const result = await transplantBatchAction(createValidInput());

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parentNewQuantity).toBe(0);
      }
    });

    it('should not revalidate paths on error', async () => {
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({
          data: null,
          error: { message: 'RPC failed' },
        })
      );

      await transplantBatchAction(createValidInput());

      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('should pass archive_parent_if_empty correctly', async () => {
      const inputWithArchive = createValidInput({ archive_parent_if_empty: true });
      await transplantBatchAction(inputWithArchive);
      
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'perform_transplant',
        expect.objectContaining({
          p_archive_parent_if_empty: true,
        })
      );

      jest.clearAllMocks();

      const inputWithoutArchive = createValidInput({ archive_parent_if_empty: false });
      await transplantBatchAction(inputWithoutArchive);
      
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'perform_transplant',
        expect.objectContaining({
          p_archive_parent_if_empty: false,
        })
      );
    });
  });
});

