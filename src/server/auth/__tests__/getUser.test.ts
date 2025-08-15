ts
// getUser.test.ts
import { getUser } from '../getUser';
import type { DecodedIdToken } from 'firebase-admin/auth';

// ESM-friendly explicit mock
jest.mock('next/headers', () => ({
  headers: jest.fn(),
  cookies: jest.fn(),
}));

jest.mock('@/server/db/admin', () => ({
  adminAuth: {
    verifyIdToken: jest.fn(),
  },
}));

import { headers, cookies } from 'next/headers';
import { adminAuth } from '@/server/db/admin';

const mockHeaders = headers as jest.MockedFunction<typeof headers>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockVerifyIdToken = adminAuth.verifyIdToken as jest.MockedFunction<typeof adminAuth.verifyIdToken>;

afterEach(() => {
  jest.clearAllMocks();
});

describe('getUser', () => {
  it('throws Unauthorized if no token provided', async () => {
    mockHeaders.mockReturnValue({ get: jest.fn().mockReturnValue(null) } as any);
    mockCookies.mockReturnValue({ get: jest.fn().mockReturnValue(null) } as any);

    await expect(getUser()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws Unauthorized if token invalid', async () => {
    mockHeaders.mockReturnValue({ get: jest.fn().mockReturnValue('Bearer invalid_token') } as any);
    mockCookies.mockReturnValue({ get: jest.fn().mockReturnValue(null) } as any);
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

    await expect(getUser()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mockVerifyIdToken).toHaveBeenCalledWith('invalid_token', true);
  });

  it('returns decoded token for valid Bearer token', async () => {
    const decoded = { uid: 'u1', email: 'a@b.com' } as DecodedIdToken;
    mockHeaders.mockReturnValue({ get: jest.fn().mockReturnValue('Bearer valid_token') } as any);
    mockCookies.mockReturnValue({ get: jest.fn().mockReturnValue(null) } as any);
    mockVerifyIdToken.mockResolvedValue(decoded);

    await expect(getUser()).resolves.toEqual(decoded);
    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid_token', true);
  });

  it('returns decoded token for __session cookie', async () => {
    const decoded = { uid: 'u1', email: 'a@b.com' } as DecodedIdToken;
    mockHeaders.mockReturnValue({ get: jest.fn().mockReturnValue(null) } as any);
    mockCookies.mockReturnValue({ get: jest.fn().mockReturnValue({ value: 'valid_session_token' }) } as any);
    mockVerifyIdToken.mockResolvedValue(decoded);

    await expect(getUser()).resolves.toEqual(decoded);
    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid_session_token', true);
  });
});