/**
 * Unit tests for sales actions
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

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

// Import after mocks
import { createOrder } from '../actions';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

describe('sales actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default auth mock
    mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  describe('createOrder', () => {
    const validOrderInput = {
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      lines: [
        {
          productId: 'prod-1',
          plantVariety: 'Lavender',
          size: '2L',
          qty: 10,
          unitPrice: 5.00,
        },
      ],
      deliveryDate: '2024-02-01',
      autoPrint: true,
    };

    it('should successfully create an order via RPC', async () => {
      // Mock data fetching
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return new MockSupabaseQueryBuilder({ data: { active_org_id: mockOrgId }, error: null });
        }
        if (table === 'customers') {
          return new MockSupabaseQueryBuilder({ data: factories.customer({ id: 'cust-1', org_id: mockOrgId }), error: null });
        }
        if (table === 'products') {
          const prod = factories.product({ 
            id: 'prod-1', 
            org_id: mockOrgId,
            skus: {
              id: 'sku-1',
              plant_varieties: { name: 'Lavender' },
              plant_sizes: { name: '2L' }
            }
          });
          return new MockSupabaseQueryBuilder({ data: [prod], error: null });
        }
        if (table === 'price_list_customers') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        if (table === 'price_lists') {
          return new MockSupabaseQueryBuilder({ data: { id: 'plist-1' }, error: null });
        }
        if (table === 'product_prices') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        if (table === 'customer_addresses') {
          return new MockSupabaseQueryBuilder({ data: factories.customerAddress({ id: 'addr-1' }), error: null });
        }
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        if (table === 'order_events') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      mockSupabase.rpc = jest.fn((fn: string) => {
        if (fn === 'create_order_with_allocations') {
          return Promise.resolve({ data: { order_id: 'new-order-1' }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      await createOrder(validOrderInput as any);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_order_with_allocations', expect.anything());
      expect(revalidatePath).toHaveBeenCalledWith('/sales/orders');
      expect(redirect).toHaveBeenCalledWith('/sales/orders');
    });

    it('should return error for invalid input', async () => {
      const invalidInput = { ...validOrderInput, customerId: 'not-a-uuid' };
      const result = await createOrder(invalidInput as any);

      expect(result).toHaveProperty('error', 'Invalid form data');
    });

    it('should return error when customer not found', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return new MockSupabaseQueryBuilder({ data: { active_org_id: mockOrgId }, error: null });
        }
        if (table === 'customers') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await createOrder(validOrderInput as any);

      expect(result).toHaveProperty('error', 'Customer not found');
    });

    it('should return error when authenticated user is missing', async () => {
      mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await createOrder(validOrderInput as any);

      expect(result).toHaveProperty('error', 'Unauthenticated');
    });
  });
});
