/**
 * Unit tests for B2B impersonation actions
 */

import {
  createMockSupabaseClient,
  createMockUser,
  factories,
  MockSupabaseQueryBuilder,
} from '@/lib/__tests__/test-utils';

// Mock dependencies BEFORE importing module under test
const mockSupabase = createMockSupabaseClient();
const mockStaffUser = createMockUser({ id: 'staff-user-id', email: 'staff@example.com' });
const mockCustomer = factories.customer({ id: 'customer-1', org_id: 'test-org-id' });

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

// Mock B2B auth guard
jest.mock('@/lib/auth/b2b-guard', () => ({
  isInternalStaff: jest.fn(),
}));

// Mock next/navigation redirect
const mockRedirect = jest.fn();
jest.mock('next/navigation', () => ({
  redirect: (path: string) => {
    mockRedirect(path);
    throw new Error(`REDIRECT:${path}`);
  },
}));

// Import AFTER mocks
import { startImpersonation, endImpersonation } from '../actions';
import { isInternalStaff } from '@/lib/auth/b2b-guard';

const mockIsInternalStaff = isInternalStaff as jest.Mock;

describe('startImpersonation', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: user is authenticated
    mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
      data: { user: mockStaffUser },
      error: null,
    });
  });

  const createFormData = (data: Record<string, string>): FormData => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.append(key, value));
    return formData;
  };

  describe('access control', () => {
    it('should return error when user is not internal staff', async () => {
      mockIsInternalStaff.mockResolvedValue(false);

      const formData = createFormData({ customerId: mockCustomer.id });

      const result = await startImpersonation(formData);

      expect(result).toEqual({ error: 'Access denied' });
    });

    it('should return error when user is not authenticated', async () => {
      mockIsInternalStaff.mockResolvedValue(true);
      mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const formData = createFormData({ customerId: mockCustomer.id });

      const result = await startImpersonation(formData);

      expect(result).toEqual({ error: 'Not authenticated' });
    });
  });

  describe('input validation', () => {
    beforeEach(() => {
      mockIsInternalStaff.mockResolvedValue(true);
    });

    it('should return error when customer ID is missing', async () => {
      const formData = createFormData({});

      const result = await startImpersonation(formData);

      expect(result).toEqual({ error: 'Customer ID is required' });
    });
  });

  describe('organization validation', () => {
    beforeEach(() => {
      mockIsInternalStaff.mockResolvedValue(true);
    });

    it('should return error when user has no active organization', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return new MockSupabaseQueryBuilder({
            data: { active_org_id: null },
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const formData = createFormData({ customerId: mockCustomer.id });

      const result = await startImpersonation(formData);

      expect(result).toEqual({ error: 'No organization found' });
    });

    it('should return error when profile not found', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const formData = createFormData({ customerId: mockCustomer.id });

      const result = await startImpersonation(formData);

      expect(result).toEqual({ error: 'No organization found' });
    });
  });

  describe('customer validation', () => {
    beforeEach(() => {
      mockIsInternalStaff.mockResolvedValue(true);
    });

    it('should return error when customer not found', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return new MockSupabaseQueryBuilder({
            data: { active_org_id: 'test-org-id' },
            error: null,
          });
        }
        if (table === 'customers') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const formData = createFormData({ customerId: 'nonexistent-customer' });

      const result = await startImpersonation(formData);

      expect(result).toEqual({ error: 'Customer not found or access denied' });
    });

    it('should return error when customer belongs to different org', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return new MockSupabaseQueryBuilder({
            data: { active_org_id: 'test-org-id' },
            error: null,
          });
        }
        if (table === 'customers') {
          // Query filters by org_id, so if different org, returns null
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const formData = createFormData({ customerId: mockCustomer.id });

      const result = await startImpersonation(formData);

      expect(result).toEqual({ error: 'Customer not found or access denied' });
    });
  });

  describe('successful impersonation', () => {
    beforeEach(() => {
      mockIsInternalStaff.mockResolvedValue(true);

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return new MockSupabaseQueryBuilder({
            data: { active_org_id: 'test-org-id' },
            error: null,
          });
        }
        if (table === 'customers') {
          return new MockSupabaseQueryBuilder({
            data: { id: mockCustomer.id, org_id: 'test-org-id' },
            error: null,
          });
        }
        if (table === 'customer_impersonation_sessions') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });
    });

    it('should end existing impersonation sessions before starting new one', async () => {
      const formData = createFormData({
        customerId: mockCustomer.id,
        notes: 'Testing impersonation',
      });

      await expect(startImpersonation(formData)).rejects.toThrow('REDIRECT:/b2b/dashboard');

      // Verify the from() was called for sessions table (for update and insert)
      expect(mockSupabase.from).toHaveBeenCalledWith('customer_impersonation_sessions');
    });

    it('should create impersonation session and redirect to dashboard', async () => {
      const formData = createFormData({ customerId: mockCustomer.id });

      await expect(startImpersonation(formData)).rejects.toThrow('REDIRECT:/b2b/dashboard');
    });

    it('should include notes when provided', async () => {
      const formData = createFormData({
        customerId: mockCustomer.id,
        notes: 'Helping customer with order',
      });

      await expect(startImpersonation(formData)).rejects.toThrow('REDIRECT:/b2b/dashboard');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mockIsInternalStaff.mockResolvedValue(true);
    });

    it('should return error when session insert fails', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return new MockSupabaseQueryBuilder({
            data: { active_org_id: 'test-org-id' },
            error: null,
          });
        }
        if (table === 'customers') {
          return new MockSupabaseQueryBuilder({
            data: { id: mockCustomer.id, org_id: 'test-org-id' },
            error: null,
          });
        }
        if (table === 'customer_impersonation_sessions') {
          // Update succeeds but insert fails
          const builder = new MockSupabaseQueryBuilder({ data: null, error: null });
          const originalInsert = builder.insert.bind(builder);
          builder.insert = (data: any) => {
            builder.setResult({ data: null, error: { message: 'Insert failed' } });
            return originalInsert(data);
          };
          return builder;
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const formData = createFormData({ customerId: mockCustomer.id });

      const result = await startImpersonation(formData);

      expect(result).toEqual({ error: 'Insert failed' });
    });
  });
});

describe('endImpersonation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return error when user is not authenticated', async () => {
    mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await endImpersonation();

    expect(result).toEqual({ error: 'Not authenticated' });
  });

  it('should end impersonation session and redirect to impersonate page', async () => {
    mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
      data: { user: mockStaffUser },
      error: null,
    });

    mockSupabase.from = jest.fn((table: string) => {
      if (table === 'customer_impersonation_sessions') {
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      }
      return new MockSupabaseQueryBuilder({ data: [], error: null });
    });

    await expect(endImpersonation()).rejects.toThrow('REDIRECT:/b2b/impersonate');
    expect(mockSupabase.from).toHaveBeenCalledWith('customer_impersonation_sessions');
  });
});


