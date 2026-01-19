/**
 * Unit tests for /api/production/batches/check-in-multi route
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

// Mock numbering service
jest.mock('@/server/numbering/batches', () => ({
  nextBatchNumber: jest.fn(() => Promise.resolve('B2401001')),
}));

// Import after mocks
import { POST } from '../route';
import { getUserAndOrg } from '@/server/auth/org';
import { nextBatchNumber } from '@/server/numbering/batches';

const mockGetUserAndOrg = getUserAndOrg as jest.Mock;
const mockNextBatchNumber = nextBatchNumber as jest.Mock;

describe('/api/production/batches/check-in-multi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserAndOrg.mockResolvedValue({
      user: mockUser,
      orgId: mockOrgId,
      supabase: mockSupabase,
    });
  });

  const createRequest = (body: any) => {
    return new Request('http://localhost/api/production/batches/check-in-multi', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const validPayload = {
    supplier_id: '550e8400-e29b-41d4-a716-446655440000',
    delivery_date: '2024-01-20',
    supplier_reference: 'DEL-123',
    overall_quality: 5,
    global_notes: 'Good condition',
    photo_count: 0,
    batches: [
      {
        plant_variety_id: '550e8400-e29b-41d4-a716-446655440001',
        size_id: '550e8400-e29b-41d4-a716-446655440002',
        location_id: '550e8400-e29b-41d4-a716-446655440003',
        quantity: 100,
        quality_rating: 5,
        notes: 'Batch 1 notes',
      },
    ],
  };

  it('should create new batches successfully', async () => {
    // Setup mocks
    mockSupabase.from = jest.fn((table: string) => {
      if (table === 'attribute_options') {
        return new MockSupabaseQueryBuilder({ data: { id: 'status-1' }, error: null });
      }
      if (table === 'plant_sizes') {
        return new MockSupabaseQueryBuilder({
          data: [{ id: '550e8400-e29b-41d4-a716-446655440002', container_type: 'pot', cell_multiple: 1 }],
          error: null,
        });
      }
      if (table === 'batches') {
        return new MockSupabaseQueryBuilder({ data: factories.batch({ id: 'new-batch-1' }), error: null });
      }
      if (table === 'batch_events') {
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      }
      return new MockSupabaseQueryBuilder({ data: null, error: null });
    });

    const response = await POST(createRequest(validPayload));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.created).toBe(1);
    expect(data.batches).toHaveLength(1);
    expect(mockNextBatchNumber).toHaveBeenCalled();
  });

  it('should update existing incoming batches successfully', async () => {
    const incomingBatchId = '550e8400-e29b-41d4-a716-446655440004';
    const payloadWithIncoming = {
      ...validPayload,
      batches: [
        {
          ...validPayload.batches[0],
          incoming_batch_id: incomingBatchId,
        },
      ],
    };

    const mockIncomingBatch = factories.batch({
      id: incomingBatchId,
      status: 'Incoming',
      log_history: [],
    });

    mockSupabase.from = jest.fn((table: string) => {
      if (table === 'attribute_options') {
        return new MockSupabaseQueryBuilder({ data: { id: 'status-1' }, error: null });
      }
      if (table === 'plant_sizes') {
        return new MockSupabaseQueryBuilder({
          data: [{ id: '550e8400-e29b-41d4-a716-446655440002', container_type: 'pot', cell_multiple: 1 }],
          error: null,
        });
      }
      if (table === 'batches') {
        const builder = new MockSupabaseQueryBuilder();
        builder.select = jest.fn().mockReturnThis();
        builder.eq = jest.fn().mockReturnThis();
        builder.single = jest.fn()
          .mockResolvedValueOnce({ data: mockIncomingBatch, error: null }) // select check
          .mockResolvedValueOnce({ data: { ...mockIncomingBatch, status: 'Growing' }, error: null }); // update result
        
        // Ensure update returns the same builder
        builder.update = jest.fn().mockReturnThis();
        
        return builder;
      }
      return new MockSupabaseQueryBuilder({ data: null, error: null });
    });

    const response = await POST(createRequest(payloadWithIncoming));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.created).toBe(1);
    expect(data.batches[0].status).toBe('Growing');
  });

  it('should return 400 for invalid payload (Zod validation)', async () => {
    const invalidPayload = { ...validPayload, supplier_id: 'not-a-uuid' };
    const response = await POST(createRequest(invalidPayload));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid payload');
  });

  it('should handle partial failures', async () => {
    const multiBatchPayload = {
      ...validPayload,
      batches: [
        { ...validPayload.batches[0], quantity: 100 },
        { ...validPayload.batches[0], quantity: 200 },
      ],
    };

    mockSupabase.from = jest.fn((table: string) => {
      if (table === 'attribute_options') {
        return new MockSupabaseQueryBuilder({ data: { id: 'status-1' }, error: null });
      }
      if (table === 'plant_sizes') {
        return new MockSupabaseQueryBuilder({
          data: [{ id: '550e8400-e29b-41d4-a716-446655440002', container_type: 'pot', cell_multiple: 1 }],
          error: null,
        });
      }
      if (table === 'batches') {
        // Success for first, failure for second
        const builder = new MockSupabaseQueryBuilder();
        builder.select = jest.fn().mockReturnThis();
        builder.single = jest.fn()
          .mockResolvedValueOnce({ data: { id: 'batch-1' }, error: null })
          .mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } });
        builder.insert = jest.fn().mockReturnThis();
        return builder;
      }
      return new MockSupabaseQueryBuilder({ data: null, error: null });
    });

    const response = await POST(createRequest(multiBatchPayload));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.created).toBe(1);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0]).toContain('Insert failed');
  });

  it('should return 400 if all batches fail', async () => {
    mockSupabase.from = jest.fn((table: string) => {
      if (table === 'attribute_options') {
        return new MockSupabaseQueryBuilder({ data: { id: 'status-1' }, error: null });
      }
      if (table === 'plant_sizes') {
        return new MockSupabaseQueryBuilder({
          data: [{ id: '550e8400-e29b-41d4-a716-446655440002', container_type: 'pot', cell_multiple: 1 }],
          error: null,
        });
      }
      if (table === 'batches') {
        return new MockSupabaseQueryBuilder({ data: null, error: { message: 'Database error' } });
      }
      return new MockSupabaseQueryBuilder({ data: null, error: null });
    });

    const response = await POST(createRequest(validPayload));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('All batches failed');
  });
});
