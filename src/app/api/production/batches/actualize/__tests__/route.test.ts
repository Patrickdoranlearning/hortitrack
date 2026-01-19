/**
 * Unit tests for /api/production/batches/actualize route
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

// Mock material consumption service
jest.mock('@/server/materials/consumption', () => ({
  consumeMaterialsForBatch: jest.fn(() =>
    Promise.resolve({
      success: true,
      transactions: [{ id: 'tx-1' }],
      shortages: [],
    })
  ),
}));

// Import after mocks
import { POST } from '../route';
import { getUserAndOrg } from '@/server/auth/org';
import { consumeMaterialsForBatch } from '@/server/materials/consumption';

const mockGetUserAndOrg = getUserAndOrg as jest.Mock;
const mockConsumeMaterials = consumeMaterialsForBatch as jest.Mock;

describe('/api/production/batches/actualize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserAndOrg.mockResolvedValue({
      user: mockUser,
      orgId: mockOrgId,
      supabase: mockSupabase,
    });
  });

  const createRequest = (body: any) => {
    return new Request('http://localhost/api/production/batches/actualize', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const validPayload = {
    batches: [
      {
        batch_id: '550e8400-e29b-41d4-a716-446655440001',
        actual_quantity: 100,
        actual_date: '2024-01-20',
        actual_location_id: '550e8400-e29b-41d4-a716-446655440003',
        size_id: '550e8400-e29b-41d4-a716-446655440002',
      },
    ],
    consume_materials: true,
  };

  it('should actualize planned batches successfully', async () => {
    const mockBatch = factories.batch({
      id: '550e8400-e29b-41d4-a716-446655440001',
      status: 'Planned',
      quantity: 100,
    });

    mockSupabase.from = jest.fn((table: string) => {
      if (table === 'attribute_options') {
        return new MockSupabaseQueryBuilder({ data: { id: 'status-1' }, error: null });
      }
      if (table === 'batches') {
        const builder = new MockSupabaseQueryBuilder();
        builder.select = jest.fn().mockReturnThis();
        builder.in = jest.fn().mockReturnThis();
        builder.eq = jest.fn().mockReturnThis();
        builder.update = jest.fn().mockReturnThis();
        builder.single = jest.fn()
          .mockResolvedValueOnce({ data: [mockBatch], error: null }) // initial fetch
          .mockResolvedValueOnce({ data: { ...mockBatch, status: 'Growing' }, error: null }) // update result
          .mockResolvedValueOnce({ data: { ...mockBatch, status: 'Growing' }, error: null }); // parent fetch if applicable
        
        // Mock the thenable behavior for the fetchAll call
        builder.then = jest.fn().mockImplementation((callback) => {
          return Promise.resolve(callback({ data: [mockBatch], error: null }));
        });
        
        return builder;
      }
      return new MockSupabaseQueryBuilder({ data: null, error: null });
    });

    const response = await POST(createRequest(validPayload));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.actualized).toBe(1);
    expect(data.batches[0].status).toBe('Growing');
    expect(mockConsumeMaterials).toHaveBeenCalled();
  });

  it('should return 400 for invalid payload', async () => {
    const invalidPayload = { batches: [] };
    const response = await POST(createRequest(invalidPayload));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid payload');
  });

  it('should return error if batch is not in Planned status', async () => {
    const mockBatch = factories.batch({
      id: '550e8400-e29b-41d4-a716-446655440001',
      status: 'Active', // Not Planned
      batch_number: 'B001',
    });

    mockSupabase.from = jest.fn((table: string) => {
      if (table === 'attribute_options') {
        return new MockSupabaseQueryBuilder({ data: { id: 'status-1' }, error: null });
      }
      if (table === 'batches') {
        return new MockSupabaseQueryBuilder({ data: [mockBatch], error: null });
      }
      return new MockSupabaseQueryBuilder({ data: null, error: null });
    });

    const response = await POST(createRequest(validPayload));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('All batches failed to actualize');
    expect(data.errors[0]).toContain('not in Planned/Incoming status');
  });

  it('should update parent batch quantity for transplants', async () => {
    const parentId = '550e8400-e29b-41d4-a716-446655440005';
    const mockBatch = factories.batch({
      id: '550e8400-e29b-41d4-a716-446655440001',
      status: 'Planned',
      parent_batch_id: parentId,
      quantity: 100,
    });

    const mockParentBatch = factories.batch({
      id: parentId,
      quantity: 500,
      reserved_quantity: 100,
    });

    mockSupabase.from = jest.fn((table: string) => {
      if (table === 'attribute_options') {
        return new MockSupabaseQueryBuilder({ data: { id: 'status-1' }, error: null });
      }
      if (table === 'batches') {
        const builder = new MockSupabaseQueryBuilder({ data: [mockBatch], error: null });
        builder.select = jest.fn().mockReturnThis();
        builder.single = jest.fn()
          .mockResolvedValueOnce({ data: [mockBatch], error: null }) // initial fetch
          .mockResolvedValueOnce({ data: { ...mockBatch, status: 'Growing' }, error: null }) // update result
          .mockResolvedValueOnce({ data: mockParentBatch, error: null }); // parent fetch
        return builder;
      }
      return new MockSupabaseQueryBuilder({ data: null, error: null });
    });

    const response = await POST(createRequest(validPayload));
    expect(response.status).toBe(200);

    // Verify parent batch was updated
    const batchesCalls = (mockSupabase.from as jest.Mock).mock.calls.filter(c => c[0] === 'batches');
    // First call is list, second is update child, third is get parent, fourth is update parent
    expect(batchesCalls.length).toBeGreaterThanOrEqual(4);
  });
});
