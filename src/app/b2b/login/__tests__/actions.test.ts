/**
 * Unit tests for B2B login actions
 */

import {
  createMockSupabaseClient,
  createMockUser,
  factories,
  MockSupabaseQueryBuilder,
} from '@/lib/__tests__/test-utils';

// Mock dependencies BEFORE importing module under test
const mockSupabase = createMockSupabaseClient();
const mockUser = createMockUser({ id: 'customer-user-id', email: 'customer@example.com' });

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
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
import { loginCustomer, logoutCustomer } from '../actions';

describe('loginCustomer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createFormData = (data: Record<string, string>): FormData => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.append(key, value));
    return formData;
  };

  describe('input validation', () => {
    it('should return error when email is missing', async () => {
      const formData = createFormData({ password: 'password123' });

      const result = await loginCustomer(formData);

      expect(result).toEqual({ error: 'Email and password are required' });
    });

    it('should return error when password is missing', async () => {
      const formData = createFormData({ email: 'customer@example.com' });

      const result = await loginCustomer(formData);

      expect(result).toEqual({ error: 'Email and password are required' });
    });

    it('should return error when both email and password are missing', async () => {
      const formData = createFormData({});

      const result = await loginCustomer(formData);

      expect(result).toEqual({ error: 'Email and password are required' });
    });
  });

  describe('authentication', () => {
    it('should return error when auth fails', async () => {
      mockSupabase.auth.signInWithPassword = jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      });

      const formData = createFormData({
        email: 'customer@example.com',
        password: 'wrongpassword',
      });

      const result = await loginCustomer(formData);

      expect(result).toEqual({ error: 'Invalid login credentials' });
    });

    it('should return error when user is null after successful auth', async () => {
      mockSupabase.auth.signInWithPassword = jest.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const formData = createFormData({
        email: 'customer@example.com',
        password: 'password123',
      });

      const result = await loginCustomer(formData);

      expect(result).toEqual({ error: 'Login failed' });
    });
  });

  describe('profile validation', () => {
    beforeEach(() => {
      mockSupabase.auth.signInWithPassword = jest.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should sign out and return error when profile not found', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      mockSupabase.auth.signOut = jest.fn().mockResolvedValue({});

      const formData = createFormData({
        email: 'customer@example.com',
        password: 'password123',
      });

      const result = await loginCustomer(formData);

      expect(result).toEqual({ error: 'Access denied. No profile found.' });
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should sign out and return error when portal_role is not customer or internal', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return new MockSupabaseQueryBuilder({
            data: { portal_role: 'viewer', customer_id: null },
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      mockSupabase.auth.signOut = jest.fn().mockResolvedValue({});

      const formData = createFormData({
        email: 'customer@example.com',
        password: 'password123',
      });

      const result = await loginCustomer(formData);

      expect(result).toEqual({ error: 'Access denied. This login is for customers only.' });
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should sign out and return error when customer user has no customer_id', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return new MockSupabaseQueryBuilder({
            data: { portal_role: 'customer', customer_id: null },
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      mockSupabase.auth.signOut = jest.fn().mockResolvedValue({});

      const formData = createFormData({
        email: 'customer@example.com',
        password: 'password123',
      });

      const result = await loginCustomer(formData);

      expect(result).toEqual({ error: 'Access denied. Customer account not linked.' });
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('successful login redirects', () => {
    beforeEach(() => {
      mockSupabase.auth.signInWithPassword = jest.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should redirect internal staff to impersonation page', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return new MockSupabaseQueryBuilder({
            data: { portal_role: 'internal', customer_id: null },
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const formData = createFormData({
        email: 'staff@example.com',
        password: 'password123',
      });

      await expect(loginCustomer(formData)).rejects.toThrow('REDIRECT:/b2b/impersonate');
    });

    it('should redirect customer user to dashboard', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return new MockSupabaseQueryBuilder({
            data: { portal_role: 'customer', customer_id: 'customer-1' },
            error: null,
          });
        }
        return new MockSupabaseQueryBuilder({ data: [], error: null });
      });

      const formData = createFormData({
        email: 'customer@example.com',
        password: 'password123',
      });

      await expect(loginCustomer(formData)).rejects.toThrow('REDIRECT:/b2b/dashboard');
    });
  });
});

describe('logoutCustomer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.signOut = jest.fn().mockResolvedValue({});
  });

  it('should sign out and redirect to login page', async () => {
    await expect(logoutCustomer()).rejects.toThrow('REDIRECT:/b2b/login');
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });
});

