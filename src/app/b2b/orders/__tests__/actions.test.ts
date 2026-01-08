/**
 * Unit tests for B2B order history actions (reorderFromPastOrder)
 */

import {
  createMockSupabaseClient,
  createMockUser,
  factories,
  MockSupabaseQueryBuilder,
} from '@/lib/__tests__/test-utils';

// Mock dependencies BEFORE importing module under test
const mockSupabase = createMockSupabaseClient();
const mockUser = createMockUser({ id: 'customer-user-id' });
const mockCustomer = factories.customer({ id: 'customer-1', org_id: 'test-org-id' });

// Mock B2B auth guard
jest.mock('@/lib/auth/b2b-guard', () => ({
  requireCustomerAuth: jest.fn(),
}));

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

// Import AFTER mocks
import { reorderFromPastOrder } from '../actions';
import { requireCustomerAuth } from '@/lib/auth/b2b-guard';

const mockRequireCustomerAuth = requireCustomerAuth as jest.Mock;

describe('reorderFromPastOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default auth mock - successful customer auth
    mockRequireCustomerAuth.mockResolvedValue({
      user: { id: mockUser.id, email: mockUser.email },
      customerId: mockCustomer.id,
      customer: mockCustomer,
      isImpersonating: false,
    });
  });

  describe('access control', () => {
    it('should return error when order does not belong to customer', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'orders') {
          // Return null - order not found or belongs to different customer
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await reorderFromPastOrder('order-from-other-customer');

      expect(result).toEqual({ error: 'Order not found or access denied' });
    });

    it('should return error when order belongs to different customer', async () => {
      // The query filters by customer_id, so if it doesn't match, data is null
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await reorderFromPastOrder('some-order-id');

      expect(result).toEqual({ error: 'Order not found or access denied' });
    });
  });

  describe('successful reorder', () => {
    const mockOrderItems = [
      {
        product_id: 'product-1',
        sku_id: 'sku-1',
        description: 'Lavender Hidcote - 2L',
        quantity: 10,
        unit_price_ex_vat: 5.00,
        vat_rate: 13.5,
        rrp: 7.99,
        multibuy_price_2: 6.99,
        multibuy_qty_2: 3,
      },
      {
        product_id: 'product-2',
        sku_id: 'sku-2',
        description: 'Rosemary - 2L',
        quantity: 5,
        unit_price_ex_vat: 4.50,
        vat_rate: 13.5,
        rrp: null,
        multibuy_price_2: null,
        multibuy_qty_2: null,
      },
    ];

    beforeEach(() => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({
            data: { id: 'order-1', customer_id: mockCustomer.id },
            error: null,
          });
        }
        if (table === 'order_items') {
          return new MockSupabaseQueryBuilder({
            data: mockOrderItems,
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });
    });

    it('should return cart items from past order', async () => {
      const result = await reorderFromPastOrder('order-1');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('items');
      expect(result.items).toHaveLength(2);
    });

    it('should include all relevant item fields', async () => {
      const result = await reorderFromPastOrder('order-1');

      expect(result.success).toBe(true);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          product_id: 'product-1',
          sku_id: 'sku-1',
          description: 'Lavender Hidcote - 2L',
          quantity: 10,
          unit_price_ex_vat: 5.00,
          vat_rate: 13.5,
          rrp: 7.99,
          multibuy_price_2: 6.99,
          multibuy_qty_2: 3,
        })
      );
    });

    it('should preserve RRP and multibuy pricing from original order', async () => {
      const result = await reorderFromPastOrder('order-1');

      expect(result.success).toBe(true);
      // First item has pricing
      expect(result.items[0].rrp).toBe(7.99);
      expect(result.items[0].multibuy_price_2).toBe(6.99);
      expect(result.items[0].multibuy_qty_2).toBe(3);
      // Second item has no pricing (null)
      expect(result.items[1].rrp).toBeNull();
      expect(result.items[1].multibuy_price_2).toBeNull();
      expect(result.items[1].multibuy_qty_2).toBeNull();
    });
  });

  describe('empty orders', () => {
    it('should return error when order has no items', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({
            data: { id: 'order-1', customer_id: mockCustomer.id },
            error: null,
          });
        }
        if (table === 'order_items') {
          return new MockSupabaseQueryBuilder({
            data: [],
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await reorderFromPastOrder('order-1');

      expect(result).toEqual({ error: 'No items found in order' });
    });

    it('should return error when order items query returns null', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({
            data: { id: 'order-1', customer_id: mockCustomer.id },
            error: null,
          });
        }
        if (table === 'order_items') {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await reorderFromPastOrder('order-1');

      expect(result).toEqual({ error: 'No items found in order' });
    });
  });

  describe('impersonation mode', () => {
    it('should work correctly when staff is impersonating customer', async () => {
      mockRequireCustomerAuth.mockResolvedValue({
        user: { id: 'staff-user-id', email: 'staff@example.com' },
        customerId: mockCustomer.id,
        customer: mockCustomer,
        isImpersonating: true,
        staffUserId: 'staff-user-id',
      });

      const mockOrderItems = [
        {
          product_id: 'product-1',
          sku_id: 'sku-1',
          description: 'Lavender - 2L',
          quantity: 10,
          unit_price_ex_vat: 5.00,
          vat_rate: 13.5,
          rrp: null,
          multibuy_price_2: null,
          multibuy_qty_2: null,
        },
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({
            data: { id: 'order-1', customer_id: mockCustomer.id },
            error: null,
          });
        }
        if (table === 'order_items') {
          return new MockSupabaseQueryBuilder({
            data: mockOrderItems,
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await reorderFromPastOrder('order-1');

      expect(result).toHaveProperty('success', true);
      expect(result.items).toHaveLength(1);
    });
  });
});




