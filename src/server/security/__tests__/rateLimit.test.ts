jest.mock('server-only', () => ({}), { virtual: true });

const store = new Map<string, any>();

jest.mock('@/server/db/admin', () => ({
  adminDb: {
    collection: () => ({
      doc: (key: string) => ({ key }),
    }),
    runTransaction: async (fn: any) => {
      return fn({
        get: async (ref: any) => {
          const data = store.get(ref.key);
          return { exists: data !== undefined, data: () => data };
        },
        set: (ref: any, data: any) => {
          store.set(ref.key, { ...(store.get(ref.key) || {}), ...data });
        },
      });
    },
  },
  __store: store,
}));

import { checkRateLimit } from '../rateLimit';
import { __store as dbStore } from '@/server/db/admin';

describe('checkRateLimit', () => {
  const windowMs = 200;
  const max = 2;

  beforeEach(() => {
    dbStore.clear();
  });

  it('allows up to max within window', async () => {
    const r1 = await checkRateLimit({ key: 't:1', windowMs, max });
    const r2 = await checkRateLimit({ key: 't:1', windowMs, max });
    const r3 = await checkRateLimit({ key: 't:1', windowMs, max });
    expect([r1.allowed, r2.allowed, r3.allowed]).toEqual([true, true, false]);
  });

  it('resets in next window', async () => {
    await checkRateLimit({ key: 't:2', windowMs, max });
    await checkRateLimit({ key: 't:2', windowMs, max });
    await new Promise((r) => setTimeout(r, windowMs + 20));
    const r = await checkRateLimit({ key: 't:2', windowMs, max });
    expect(r.allowed).toBe(true);
  });
});
