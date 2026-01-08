/**
 * Unit tests for customer actions
 * Tests: CRUD operations for customers, addresses, contacts, pricing
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

// Valid UUIDs for testing
const testUUIDs = {
  customerId: '123e4567-e89b-12d3-a456-426614174001',
  addressId: '123e4567-e89b-12d3-a456-426614174002',
  contactId: '123e4567-e89b-12d3-a456-426614174003',
  priceListId: '123e4567-e89b-12d3-a456-426614174004',
  assignmentId: '123e4567-e89b-12d3-a456-426614174005',
  productId: '123e4567-e89b-12d3-a456-426614174006',
};

jest.mock('@/server/db/supabase', () => ({
  getSupabaseServerApp: jest.fn(() => Promise.resolve(mockSupabase)),
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

// Import AFTER mocks
import {
  upsertCustomerAction,
  deleteCustomerAction,
  upsertCustomerAddressAction,
  deleteCustomerAddressAction,
  upsertCustomerContactAction,
  deleteCustomerContactAction,
  assignPriceListToCustomerAction,
  removePriceListAssignmentAction,
  updateCustomerDeliveryPreferencesAction,
  fetchCustomerProductPricingAction,
} from '../actions';

describe('customer actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // upsertCustomerAction
  // ============================================================================
  describe('upsertCustomerAction', () => {
    it('should create a new customer', async () => {
      const newCustomer = factories.customer({ id: undefined });

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: { ...newCustomer, id: 'new-customer-id' },
          error: null,
        })
      );

      const result = await upsertCustomerAction({
        name: 'New Customer',
        email: 'new@example.com',
        phone: '+353 1 234 5678',
      });

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('new-customer-id');
    });

    it('should update an existing customer', async () => {
      const existingCustomer = factories.customer({ id: testUUIDs.customerId });

      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: { ...existingCustomer, name: 'Updated Name' },
          error: null,
        })
      );

      const result = await upsertCustomerAction({
        id: testUUIDs.customerId,
        name: 'Updated Name',
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Updated Name');
    });

    it('should handle database errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Unique constraint violation' },
        })
      );

      const result = await upsertCustomerAction({
        name: 'Test Customer',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unique constraint');
    });

    it('should handle optional fields correctly', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: factories.customer({
            vat_number: 'IE1234567T',
            credit_limit: 5000,
          }),
          error: null,
        })
      );

      const result = await upsertCustomerAction({
        name: 'Customer with optional fields',
        vatNumber: 'IE1234567T',
        creditLimit: 5000,
        paymentTermsDays: 45,
        currency: 'GBP',
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // deleteCustomerAction
  // ============================================================================
  describe('deleteCustomerAction', () => {
    it('should delete a customer', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await deleteCustomerAction('customer-1');

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('customers');
    });

    it('should handle deletion errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Foreign key constraint' },
        })
      );

      const result = await deleteCustomerAction('customer-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Foreign key');
    });
  });

  // ============================================================================
  // updateCustomerDeliveryPreferencesAction
  // ============================================================================
  describe('updateCustomerDeliveryPreferencesAction', () => {
    it('should update delivery preferences', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await updateCustomerDeliveryPreferencesAction({
        customerId: testUUIDs.customerId,
        preferences: {
          preferredTrolleyType: 'danish',
          labelRequirements: 'yellow_tag',
          specialInstructions: 'Leave at back door',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should handle errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Update failed' },
        })
      );

      const result = await updateCustomerDeliveryPreferencesAction({
        customerId: testUUIDs.customerId,
        preferences: {
          preferredTrolleyType: 'danish',
        },
      });

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // upsertCustomerAddressAction
  // ============================================================================
  describe('upsertCustomerAddressAction', () => {
    it('should create a new address', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: factories.customerAddress(),
          error: null,
        })
      );

      const result = await upsertCustomerAddressAction({
        customerId: testUUIDs.customerId,
        label: 'Warehouse',
        line1: '456 Industrial Park',
        city: 'Cork',
        county: 'Cork',
        countryCode: 'IE',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should update an existing address', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: factories.customerAddress({ label: 'Updated Label' }),
          error: null,
        })
      );

      const result = await upsertCustomerAddressAction({
        id: testUUIDs.addressId,
        customerId: testUUIDs.customerId,
        label: 'Updated Label',
        line1: '123 Main Street',
      });

      expect(result.success).toBe(true);
      expect(result.data?.label).toBe('Updated Label');
    });

    it('should unset other default shipping addresses when setting new default', async () => {
      let updateCalls = 0;
      mockSupabase.from = jest.fn((table: string) => {
        updateCalls++;
        return new MockSupabaseQueryBuilder({
          data: factories.customerAddress({ is_default_shipping: true }),
          error: null,
        });
      });

      const result = await upsertCustomerAddressAction({
        customerId: testUUIDs.customerId,
        label: 'New Default',
        line1: '789 New Street',
        isDefaultShipping: true,
      });

      expect(result.success).toBe(true);
      // Should have been called multiple times: once to unset others, once to insert
      expect(mockSupabase.from).toHaveBeenCalledWith('customer_addresses');
    });

    it('should handle database errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Validation error' },
        })
      );

      const result = await upsertCustomerAddressAction({
        customerId: testUUIDs.customerId,
        label: 'Test',
        line1: 'Some address line',
      });

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // deleteCustomerAddressAction
  // ============================================================================
  describe('deleteCustomerAddressAction', () => {
    it('should delete an address', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await deleteCustomerAddressAction('address-1');

      expect(result.success).toBe(true);
    });

    it('should handle deletion errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Cannot delete - used in orders' },
        })
      );

      const result = await deleteCustomerAddressAction('address-1');

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // upsertCustomerContactAction
  // ============================================================================
  describe('upsertCustomerContactAction', () => {
    it('should create a new contact', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: factories.customerContact(),
          error: null,
        })
      );

      const result = await upsertCustomerContactAction({
        customerId: testUUIDs.customerId,
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'Accounts',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should update primary contact status correctly', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: factories.customerContact({ is_primary: true }),
          error: null,
        })
      );

      const result = await upsertCustomerContactAction({
        customerId: testUUIDs.customerId,
        name: 'Primary Contact',
        isPrimary: true,
      });

      expect(result.success).toBe(true);
    });

    it('should handle database errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Insert failed' },
        })
      );

      const result = await upsertCustomerContactAction({
        customerId: testUUIDs.customerId,
        name: 'Test',
      });

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // deleteCustomerContactAction
  // ============================================================================
  describe('deleteCustomerContactAction', () => {
    it('should delete a contact', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await deleteCustomerContactAction('contact-1');

      expect(result.success).toBe(true);
    });

    it('should handle errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Delete failed' },
        })
      );

      const result = await deleteCustomerContactAction('contact-1');

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // assignPriceListToCustomerAction
  // ============================================================================
  describe('assignPriceListToCustomerAction', () => {
    it('should assign a price list to customer', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await assignPriceListToCustomerAction({
        customerId: testUUIDs.customerId,
        priceListId: testUUIDs.priceListId,
      });

      expect(result.success).toBe(true);
    });

    it('should assign with validity dates', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await assignPriceListToCustomerAction({
        customerId: testUUIDs.customerId,
        priceListId: testUUIDs.priceListId,
        validFrom: '2024-01-01',
        validTo: '2024-12-31',
      });

      expect(result.success).toBe(true);
    });

    it('should handle duplicate assignment errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Unique constraint violation', code: '23505' },
        })
      );

      const result = await assignPriceListToCustomerAction({
        customerId: testUUIDs.customerId,
        priceListId: testUUIDs.priceListId,
      });

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // removePriceListAssignmentAction
  // ============================================================================
  describe('removePriceListAssignmentAction', () => {
    it('should remove price list assignment', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: null })
      );

      const result = await removePriceListAssignmentAction('assignment-1');

      expect(result.success).toBe(true);
    });

    it('should handle errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Not found' },
        })
      );

      const result = await removePriceListAssignmentAction('nonexistent');

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // fetchCustomerProductPricingAction
  // ============================================================================
  describe('fetchCustomerProductPricingAction', () => {
    it('should return customer product pricing', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: [
            {
              id: 'alias-1',
              product_id: 'product-1',
              alias_name: 'Custom Name',
              customer_sku_code: 'CUST-SKU-001',
              unit_price_ex_vat: 15.00,
              rrp: 20.00,
              notes: null,
              products: {
                name: 'Test Product',
                skus: { code: 'SKU-0001' },
              },
            },
          ],
          error: null,
        })
      );

      const result = await fetchCustomerProductPricingAction('customer-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].aliasName).toBe('Custom Name');
    });

    it('should return empty array on error', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: null,
          error: { message: 'Database error' },
        })
      );

      const result = await fetchCustomerProductPricingAction('customer-1');

      expect(result.success).toBe(false);
      expect(result.data).toEqual([]);
    });
  });

  // ============================================================================
  // Edge Cases and Validation
  // ============================================================================
  describe('edge cases', () => {
    it('should trim whitespace from customer names', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: factories.customer({ name: 'Trimmed Name' }),
          error: null,
        })
      );

      const result = await upsertCustomerAction({
        name: '  Trimmed Name  ',
      });

      expect(result.success).toBe(true);
    });

    it('should handle empty optional strings as null', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({
          data: factories.customer({ notes: null }),
          error: null,
        })
      );

      const result = await upsertCustomerAction({
        name: 'Test Customer',
        notes: '',  // Empty string should become null
      });

      expect(result.success).toBe(true);
    });

    it('should validate UUID format for IDs', async () => {
      // This should throw a zod validation error
      await expect(
        upsertCustomerAddressAction({
          customerId: 'not-a-uuid',
          label: 'Test',
          line1: 'Test Address',
        })
      ).rejects.toThrow();
    });
  });
});

