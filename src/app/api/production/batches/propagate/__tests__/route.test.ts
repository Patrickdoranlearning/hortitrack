/**
 * Unit tests for propagate API route
 */

import { POST } from '../route';
import { createMockSupabaseClient, createMockUser } from '@/lib/__tests__/test-utils';
import { NextResponse } from 'next/server';

const mockSupabase = createMockSupabaseClient();
const mockUser = createMockUser();
const mockOrgId = 'test-org-id';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

jest.mock('@/server/auth/org', () => ({
  getUserAndOrg: jest.fn(() => Promise.resolve({
    user: mockUser,
    orgId: mockOrgId,
    supabase: mockSupabase,
  })),
}));

jest.mock('@/server/numbering/batches', () => ({
  nextBatchNumber: jest.fn(() => Promise.resolve('B2401001')),
}));

jest.mock('@/server/suppliers/getInternalSupplierId', () => ({
  ensureInternalSupplierId: jest.fn(() => Promise.resolve('internal-s1')),
}));

jest.mock('@/server/batches/service', () => ({
  resolveProductionStatus: jest.fn(() => Promise.resolve({ id: 's1', system_code: 'Growing' })),
}));

describe('Propagate API Route', () => {
  const createRequest = (body: any) => {
    return new Request('http://localhost/api/production/batches/propagate', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a batch successfully', async () => {
    const payload = {
      plant_variety_id: '00000000-0000-0000-0000-000000000001',
      size_id: '00000000-0000-0000-0000-000000000002',
      location_id: '00000000-0000-0000-0000-000000000003',
      containers: 10,
      planted_at: '2024-01-20',
    };

    mockSupabase.from = jest.fn((table) => {
      if (table === 'plant_sizes') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { cell_multiple: 10 }, error: null }),
        };
      }
      if (table === 'batches') {
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { id: 'b1', batch_number: 'B2401001' }, error: null }),
        };
      }
      if (table === 'batch_events' || table === 'batch_passports') {
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'organizations') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { producer_code: 'PROD1', country_code: 'IE' }, error: null }),
        };
      }
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    }) as any;

    const response = await POST(createRequest(payload) as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.batch.id).toBe('b1');
  });

  it('should return 400 for invalid payload', async () => {
    const payload = {
      plant_variety_id: 'invalid-uuid',
    };

    const response = await POST(createRequest(payload) as any);
    expect(response.status).toBe(400);
  });

  it('should return 500 on database error', async () => {
    const payload = {
      plant_variety_id: '00000000-0000-0000-0000-000000000001',
      size_id: '00000000-0000-0000-0000-000000000002',
      location_id: '00000000-0000-0000-0000-000000000003',
      containers: 10,
    };

    mockSupabase.from = jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    })) as any;

    const response = await POST(createRequest(payload) as any);
    expect(response.status).toBe(500);
  });
});
