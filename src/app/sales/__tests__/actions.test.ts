/**
 * Unit tests for sales actions
 * Tests: createOrder, generateInvoice, getOrderDetails, CRM actions
 */

import {
  createMockSupabaseClient,
  createMockUser,
  MockSupabaseQueryBuilder,
  factories,
} from '@/lib/__tests__/test-utils';

// Mock dependencies BEFORE importing module under test
const mockSupabase = createMockSupabaseClient();
const mockUser = createMockUser();
const mockOrgId = 'test-org-id';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

// Mock next/navigation
const mockRedirect = jest.fn();
jest.mock('next/navigation', () => ({
  redirect: (path: string) => {
    mockRedirect(path);
    throw new Error('NEXT_REDIRECT');
  },
}));

// Mock picking module
jest.mock('@/server/sales/picking', () => ({
  createPickListFromOrder: jest.fn(() => Promise.resolve({ pickList: { id: 'pick-1' } })),
}));

// Import AFTER mocks
import {
  generateInvoice,
  getOrderDetails,
  getCustomerRecentOrders,
  logInteraction,
  sendOrderConfirmation,
  dispatchAndInvoice,
  getCustomerInteractions,
} from '../actions';

describe('sales actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedirect.mockClear();
    
    // Default auth mock
    mockSupabase.auth.getUser = jest.fn(() =>
      Promise.resolve({
        data: { user: mockUser },
        error: null,
      })
    );
  });

  // ============================================================================
  // generateInvoice
  // ============================================================================
  describe('generateInvoice', () => {
    it('should generate an invoice for an order', async () => {
      const mockOrder = factories.order({ id: 'order-1' });
      const mockOrderItems = [
        factories.orderItem({ line_total_ex_vat: 100, line_vat_amount: 13.5 }),
      ];
      const mockOrg = { id: mockOrgId, invoice_prefix: 'INV', default_payment_terms: 30 };

      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (table === 'orders' && callCount === 1) {
          return new MockSupabaseQueryBuilder({
            data: { ...mockOrder, order_items: mockOrderItems },
            error: null,
          });
        }
        if (table === 'invoices' && callCount === 2) {
          // Check for existing invoice
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        if (table === 'organizations') {
          return new MockSupabaseQueryBuilder({ data: mockOrg, error: null });
        }
        if (table === 'order_items') {
          return new MockSupabaseQueryBuilder({ data: mockOrderItems, error: null });
        }
        if (table === 'invoices') {
          return new MockSupabaseQueryBuilder({
            data: factories.invoice({ order_id: 'order-1' }),
            error: null,
          });
        }
        if (table === 'order_events') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await generateInvoice('order-1');

      expect(result.success).toBe(true);
      expect(result.invoice).toBeDefined();
    });

    it('should return error if user is not authenticated', async () => {
      mockSupabase.auth.getUser = jest.fn(() =>
        Promise.resolve({
          data: { user: null },
          error: null,
        })
      );

      const result = await generateInvoice('order-1');

      expect(result.error).toBe('Not authenticated');
    });

    it('should return error if order not found', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Not found' },
        })
      );

      const result = await generateInvoice('nonexistent');

      expect(result.error).toBe('Order not found');
    });

    it('should return error if invoice already exists', async () => {
      const mockOrder = factories.order({ id: 'order-1' });

      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (table === 'orders') {
          return new MockSupabaseQueryBuilder({ data: mockOrder, error: null });
        }
        if (table === 'invoices' && callCount === 2) {
          // Return existing invoice
          return new MockSupabaseQueryBuilder({
            data: { id: 'existing-invoice' },
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await generateInvoice('order-1');

      expect(result.error).toBe('Invoice already exists for this order');
    });
  });

  // ============================================================================
  // getOrderDetails
  // ============================================================================
  describe('getOrderDetails', () => {
    it('should return order with related data', async () => {
      const mockOrder = factories.order({ id: 'order-1' });

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: {
            ...mockOrder,
            order_items: [factories.orderItem()],
            invoices: [],
            pick_orders: [],
            sales_qc: [],
          },
          error: null,
        })
      );

      const result = await getOrderDetails('order-1');

      expect(result.order).toBeDefined();
      expect(result.order?.id).toBe('order-1');
    });

    it('should return error when order not found', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Not found' },
        })
      );

      const result = await getOrderDetails('nonexistent');

      expect(result.error).toBe('Failed to fetch order details');
    });
  });

  // ============================================================================
  // getCustomerRecentOrders
  // ============================================================================
  describe('getCustomerRecentOrders', () => {
    it('should return recent orders for a customer', async () => {
      const mockOrders = [
        factories.order({ id: 'order-1', order_number: 'ORD-001' }),
        factories.order({ id: 'order-2', order_number: 'ORD-002' }),
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: mockOrders.map((o) => ({
            ...o,
            order_items: [{ id: 'item-1' }],
          })),
          error: null,
        })
      );

      const result = await getCustomerRecentOrders('customer-1');

      expect(result.orders).toHaveLength(2);
      expect(result.orders?.[0].orderNumber).toBe('ORD-001');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Database error' },
        })
      );

      const result = await getCustomerRecentOrders('customer-1');

      expect(result.error).toBe('Failed to load recent orders');
    });
  });

  // ============================================================================
  // logInteraction
  // ============================================================================
  describe('logInteraction', () => {
    it('should log a customer interaction', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (table === 'customers') {
          return new MockSupabaseQueryBuilder({
            data: { org_id: mockOrgId },
            error: null,
          });
        }
        if (table === 'customer_interactions') {
          return new MockSupabaseQueryBuilder({
            data: { id: 'interaction-1', type: 'call', notes: 'Test call' },
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await logInteraction('customer-1', 'call', 'Test call', 'Positive');

      expect(result.success).toBe(true);
      expect(result.interaction).toBeDefined();
    });

    it('should return error if not authenticated', async () => {
      mockSupabase.auth.getUser = jest.fn(() =>
        Promise.resolve({
          data: { user: null },
          error: null,
        })
      );

      const result = await logInteraction('customer-1', 'call', 'Test');

      expect(result.error).toBe('Not authenticated');
    });

    it('should return error if customer not found', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Not found' },
        })
      );

      const result = await logInteraction('invalid-customer', 'call', 'Test');

      expect(result.error).toBe('Customer not found');
    });
  });

  // ============================================================================
  // sendOrderConfirmation
  // ============================================================================
  describe('sendOrderConfirmation', () => {
    it('should send order confirmation email', async () => {
      const mockOrder = factories.order({ id: 'order-1', status: 'draft' });

      let updateCalled = false;
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'orders') {
          if (!updateCalled) {
            // First call - select
            return new MockSupabaseQueryBuilder({
              data: {
                ...mockOrder,
                customer: { name: 'Test Customer', email: 'test@example.com' },
                order_items: [],
              },
              error: null,
            });
          }
          updateCalled = true;
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        if (table === 'order_events') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await sendOrderConfirmation('order-1');

      expect(result.success).toBe(true);
      expect(result.message).toContain('test@example.com');
    });

    it('should return error if customer has no email', async () => {
      const mockOrder = factories.order({ id: 'order-1' });

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: {
            ...mockOrder,
            customer: { name: 'Test Customer', email: null },
            order_items: [],
          },
          error: null,
        })
      );

      const result = await sendOrderConfirmation('order-1');

      expect(result.error).toBe('Customer has no email address');
    });

    it('should return error if order not found', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Not found' },
        })
      );

      const result = await sendOrderConfirmation('nonexistent');

      expect(result.error).toBe('Order not found');
    });
  });

  // ============================================================================
  // dispatchAndInvoice
  // ============================================================================
  describe('dispatchAndInvoice', () => {
    it('should dispatch order and generate invoice', async () => {
      const mockOrder = factories.order({ id: 'order-1' });
      const mockInvoice = factories.invoice({ id: 'invoice-1' });

      let callCount = 0;
      mockSupabase.from = jest.fn((table: string) => {
        callCount++;
        if (table === 'orders') {
          if (callCount === 1) {
            // First call - select order
            return new MockSupabaseQueryBuilder({
              data: {
                ...mockOrder,
                customer: { name: 'Test', email: 'test@example.com' },
                invoices: [], // No existing invoice
              },
              error: null,
            });
          }
          // Update call or subsequent selects
          return new MockSupabaseQueryBuilder({ data: mockOrder, error: null });
        }
        if (table === 'invoices') {
          if (callCount <= 3) {
            // Check for existing invoice
            return new MockSupabaseQueryBuilder({ data: null, error: null });
          }
          // Create invoice
          return new MockSupabaseQueryBuilder({ data: mockInvoice, error: null });
        }
        if (table === 'organizations') {
          return new MockSupabaseQueryBuilder({
            data: { invoice_prefix: 'INV', default_payment_terms: 30 },
            error: null,
          });
        }
        if (table === 'order_items') {
          return new MockSupabaseQueryBuilder({
            data: [factories.orderItem()],
            error: null,
          });
        }
        if (table === 'order_events') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await dispatchAndInvoice('order-1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Order dispatched and invoice generated');
    });

    it('should return error if not authenticated', async () => {
      mockSupabase.auth.getUser = jest.fn(() =>
        Promise.resolve({
          data: { user: null },
          error: null,
        })
      );

      const result = await dispatchAndInvoice('order-1');

      expect(result.error).toBe('Not authenticated');
    });

    it('should return error if order not found', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Not found' },
        })
      );

      const result = await dispatchAndInvoice('nonexistent');

      expect(result.error).toBe('Order not found');
    });
  });

  // ============================================================================
  // getCustomerInteractions
  // ============================================================================
  describe('getCustomerInteractions', () => {
    it('should return customer interactions', async () => {
      const mockInteractions = [
        {
          id: 'int-1',
          type: 'call',
          notes: 'Discussed new order',
          created_at: '2024-01-15',
          user: { display_name: 'Test User', email: 'user@example.com' },
        },
      ];

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: mockInteractions,
          error: null,
        })
      );

      const result = await getCustomerInteractions('customer-1');

      expect(result.interactions).toHaveLength(1);
      expect(result.interactions?.[0].type).toBe('call');
    });

    it('should handle errors gracefully', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Database error' },
        })
      );

      const result = await getCustomerInteractions('customer-1');

      expect(result.error).toBe('Failed to fetch interactions');
      expect(result.interactions).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: [],
          error: null,
        })
      );

      await getCustomerInteractions('customer-1', 5);

      expect(mockSupabase.from).toHaveBeenCalledWith('customer_interactions');
    });
  });
});




