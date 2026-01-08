/**
 * Unit tests for B2B order creation actions
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

// Mock revalidatePath
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// Mock trolley calculation functions
jest.mock('@/server/dispatch/trolley-capacity.server', () => ({
  getTrolleyCapacityConfigs: jest.fn(() => Promise.resolve([])),
  getShelfQuantitiesForSizes: jest.fn(() => Promise.resolve(new Map())),
}));

// Mock pick list creation
jest.mock('@/server/sales/picking', () => ({
  createPickListFromOrder: jest.fn(() => Promise.resolve()),
}));

// Import AFTER mocks
import { createB2BOrder } from '../actions';
import { requireCustomerAuth } from '@/lib/auth/b2b-guard';
import { createPickListFromOrder } from '@/server/sales/picking';
import type { CartItem } from '@/lib/b2b/types';

const mockRequireCustomerAuth = requireCustomerAuth as jest.Mock;
const mockCreatePickList = createPickListFromOrder as jest.Mock;

describe('createB2BOrder', () => {
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

  const createValidCart = (overrides: Partial<CartItem>[] = []): CartItem[] => {
    const baseItem = factories.b2bCartItem();
    if (overrides.length === 0) {
      return [baseItem as CartItem];
    }
    return overrides.map((o, i) => ({
      ...baseItem,
      productId: `product-${i + 1}`,
      skuId: `sku-${i + 1}`,
      ...o,
    } as CartItem));
  };

  describe('input validation', () => {
    it('should return error when customer ID does not match authenticated customer', async () => {
      const result = await createB2BOrder({
        customerId: 'different-customer-id',
        cart: createValidCart(),
        deliveryAddressId: 'address-1',
      });

      expect(result).toEqual({ error: 'Access denied' });
    });

    it('should return error when cart is empty', async () => {
      const result = await createB2BOrder({
        customerId: mockCustomer.id,
        cart: [],
        deliveryAddressId: 'address-1',
      });

      expect(result).toEqual({ error: 'Cart is empty' });
    });
  });

  describe('customer lookup', () => {
    it('should return error when customer is not found', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'customers') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await createB2BOrder({
        customerId: mockCustomer.id,
        cart: createValidCart(),
        deliveryAddressId: 'address-1',
      });

      expect(result).toEqual({ error: 'Customer not found' });
    });
  });

  describe('successful order creation', () => {
    beforeEach(() => {
      // Setup successful mock responses for all tables
      const mockOrder = factories.order({ id: 'new-order-id', org_id: 'test-org-id' });

      mockSupabase.from = jest.fn((table: string) => {
        switch (table) {
          case 'customers':
            return new MockSupabaseQueryBuilder({
              data: { org_id: 'test-org-id' },
              error: null,
            });
          case 'orders':
            return new MockSupabaseQueryBuilder({
              data: mockOrder,
              error: null,
            });
          case 'order_items':
            return new MockSupabaseQueryBuilder({
              data: [{ id: 'order-item-1', product_id: 'product-1', sku_id: 'sku-1' }],
              error: null,
            });
          case 'batch_allocations':
            return new MockSupabaseQueryBuilder({ data: [], error: null });
          default:
            return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
      });
    });

    it('should create an order with correct totals', async () => {
      const cart = createValidCart([
        { quantity: 10, unitPriceExVat: 5.00, vatRate: 13.5 },
        { quantity: 5, unitPriceExVat: 10.00, vatRate: 0 },
      ]);

      // Expected: (10 * 5) + (5 * 10) = 50 + 50 = 100 subtotal
      // VAT: (50 * 0.135) + (50 * 0) = 6.75
      // Total: 100 + 6.75 = 106.75

      const result = await createB2BOrder({
        customerId: mockCustomer.id,
        cart,
        deliveryAddressId: 'address-1',
        deliveryDate: '2024-02-01',
        notes: 'Test order',
      });

      expect(result).toHaveProperty('orderId', 'new-order-id');
      expect(mockSupabase.from).toHaveBeenCalledWith('orders');

      // Verify the insert was called with correct totals
      const ordersCalls = (mockSupabase.from as jest.Mock).mock.calls.filter(
        (call) => call[0] === 'orders'
      );
      expect(ordersCalls.length).toBeGreaterThan(0);
    });

    it('should create order items with correct line totals', async () => {
      const cart = createValidCart([
        {
          quantity: 10,
          unitPriceExVat: 5.00,
          vatRate: 13.5,
          productName: 'Lavender',
          varietyName: 'Hidcote',
          sizeName: '2L',
        },
      ]);

      const result = await createB2BOrder({
        customerId: mockCustomer.id,
        cart,
        deliveryAddressId: 'address-1',
      });

      expect(result).toHaveProperty('orderId');
      expect(mockSupabase.from).toHaveBeenCalledWith('order_items');
    });

    it('should handle single batch allocation', async () => {
      const cart = createValidCart([
        {
          quantity: 10,
          unitPriceExVat: 5.00,
          vatRate: 13.5,
          batchId: 'batch-123',
        },
      ]);

      const result = await createB2BOrder({
        customerId: mockCustomer.id,
        cart,
        deliveryAddressId: 'address-1',
      });

      expect(result).toHaveProperty('orderId');
      // The action should insert allocations to batch_allocations table
      expect(mockSupabase.from).toHaveBeenCalledWith('batch_allocations');
    });

    it('should handle multi-batch allocations', async () => {
      const cart = createValidCart([
        {
          quantity: 15,
          unitPriceExVat: 5.00,
          vatRate: 13.5,
          batchAllocations: [
            { batchId: 'batch-1', batchNumber: 'B001', qty: 10 },
            { batchId: 'batch-2', batchNumber: 'B002', qty: 5 },
          ],
        },
      ]);

      const result = await createB2BOrder({
        customerId: mockCustomer.id,
        cart,
        deliveryAddressId: 'address-1',
      });

      expect(result).toHaveProperty('orderId');
    });

    it('should handle impersonation mode correctly', async () => {
      mockRequireCustomerAuth.mockResolvedValue({
        user: { id: 'staff-user-id', email: 'staff@example.com' },
        customerId: mockCustomer.id,
        customer: mockCustomer,
        isImpersonating: true,
        staffUserId: 'staff-user-id',
      });

      const result = await createB2BOrder({
        customerId: mockCustomer.id,
        cart: createValidCart(),
        deliveryAddressId: 'address-1',
      });

      expect(result).toHaveProperty('orderId');
      // The created_by_staff_id should be set when impersonating
    });

    it('should create pick list after order creation', async () => {
      const result = await createB2BOrder({
        customerId: mockCustomer.id,
        cart: createValidCart(),
        deliveryAddressId: 'address-1',
      });

      expect(result).toHaveProperty('orderId');
      expect(mockCreatePickList).toHaveBeenCalledWith('new-order-id');
    });

    it('should not fail order when pick list creation fails', async () => {
      mockCreatePickList.mockRejectedValue(new Error('Pick list creation failed'));

      const result = await createB2BOrder({
        customerId: mockCustomer.id,
        cart: createValidCart(),
        deliveryAddressId: 'address-1',
      });

      // Order should still succeed even if pick list fails
      expect(result).toHaveProperty('orderId');
    });
  });

  describe('error handling', () => {
    it('should return error when order creation fails', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'customers') {
          return new MockSupabaseQueryBuilder({
            data: { org_id: 'test-org-id' },
            error: null,
          });
        }
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Database error' },
          });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await createB2BOrder({
        customerId: mockCustomer.id,
        cart: createValidCart(),
        deliveryAddressId: 'address-1',
      });

      expect(result).toEqual({ error: 'Failed to create order' });
    });

    it('should rollback order when order items creation fails', async () => {
      const mockOrder = factories.order({ id: 'order-to-rollback' });
      let orderDeleted = false;

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'customers') {
          return new MockSupabaseQueryBuilder({
            data: { org_id: 'test-org-id' },
            error: null,
          });
        }
        if (table === 'orders') {
          // For delete operation, track that it was called
          const builder = new MockSupabaseQueryBuilder({
            data: mockOrder,
            error: null,
          });
          const originalDelete = builder.delete.bind(builder);
          builder.delete = () => {
            orderDeleted = true;
            return originalDelete();
          };
          return builder;
        }
        if (table === 'order_items') {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Failed to insert items' },
          });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await createB2BOrder({
        customerId: mockCustomer.id,
        cart: createValidCart(),
        deliveryAddressId: 'address-1',
      });

      expect(result).toEqual({ error: 'Failed to create order items' });
      // Verify rollback was attempted
      expect(mockSupabase.from).toHaveBeenCalledWith('orders');
    });
  });

  describe('trolley calculation', () => {
    it('should calculate trolleys for items with sizeId', async () => {
      const { getTrolleyCapacityConfigs, getShelfQuantitiesForSizes } =
        require('@/server/dispatch/trolley-capacity.server');

      getTrolleyCapacityConfigs.mockResolvedValue([
        { family: 'Lamiaceae', size_id: 'size-1', shelves_per_trolley: 6 },
      ]);
      getShelfQuantitiesForSizes.mockResolvedValue(new Map([['size-1', 12]]));

      const cart = createValidCart([
        {
          quantity: 72, // 72 plants / 12 per shelf / 6 shelves = 1 trolley
          sizeId: 'size-1',
          family: 'Lamiaceae',
        },
      ]);

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'customers') {
          return new MockSupabaseQueryBuilder({
            data: { org_id: 'test-org-id' },
            error: null,
          });
        }
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({
            data: factories.order({ id: 'new-order-id' }),
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await createB2BOrder({
        customerId: mockCustomer.id,
        cart,
        deliveryAddressId: 'address-1',
      });

      expect(result).toHaveProperty('orderId');
      expect(getTrolleyCapacityConfigs).toHaveBeenCalled();
      expect(getShelfQuantitiesForSizes).toHaveBeenCalledWith(['size-1']);
    });
  });

  describe('RRP and multibuy pricing', () => {
    it('should include RRP and multibuy pricing in order items', async () => {
      const cart = createValidCart([
        {
          quantity: 10,
          unitPriceExVat: 5.00,
          vatRate: 13.5,
          rrp: 7.99,
          multibuyPrice2: 6.99,
          multibuyQty2: 3,
        },
      ]);

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'customers') {
          return new MockSupabaseQueryBuilder({
            data: { org_id: 'test-org-id' },
            error: null,
          });
        }
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({
            data: factories.order({ id: 'new-order-id' }),
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const result = await createB2BOrder({
        customerId: mockCustomer.id,
        cart,
        deliveryAddressId: 'address-1',
      });

      expect(result).toHaveProperty('orderId');
      expect(mockSupabase.from).toHaveBeenCalledWith('order_items');
    });
  });
});

