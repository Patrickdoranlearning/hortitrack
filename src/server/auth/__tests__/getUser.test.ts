jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@/server/db/env', () => ({
  SUPABASE_URL: 'http://example',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
}), { virtual: true });

const mockSupabase = {
  auth: { getUser: jest.fn() },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock('@/server/db/supabaseServer', () => ({
  getSupabaseForRequest: jest.fn(() => mockSupabase),
}));

import { getUser } from '../getUser';

afterEach(() => {
  jest.clearAllMocks();
});

describe('getUser', () => {
  it('throws if no user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getUser()).rejects.toThrow('UNAUTHENTICATED');
  });

  it('returns uid and orgId', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockSupabase.single.mockResolvedValue({ data: { active_org_id: 'org1' }, error: null });
    await expect(getUser()).resolves.toEqual({ uid: 'u1', orgId: 'org1' });
  });
});
