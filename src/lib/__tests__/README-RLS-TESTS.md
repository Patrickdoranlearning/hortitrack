# RLS (Row Level Security) Test Suite

## Overview

The RLS test suite (`rls-policies.test.ts`) validates multi-tenant security isolation at the database level. These tests ensure that users from one organization cannot access data belonging to another organization.

## Why These Tests Matter

RLS policies are the **last line of defense** for multi-tenant security. Even if application code has bugs (missing `org_id` filters, etc.), RLS policies at the PostgreSQL level prevent cross-tenant data leakage.

This test suite validates that:
- ✅ Users can only see their organization's data
- ✅ Users cannot read other organizations' data
- ✅ Users cannot modify other organizations' data
- ✅ Users cannot insert data with another organization's org_id
- ✅ Unauthenticated users cannot access any data
- ✅ Expired sessions cannot access data

## Test Coverage

### Critical Tables Tested
1. **customers** - Direct org_id filtering
2. **orders** - Direct org_id filtering
3. **products** - Direct org_id filtering
4. **batches** - Direct org_id filtering
5. **customer_interactions** - Derives org_id from parent customer table

### Test Scenarios
- ✅ Read isolation (SELECT queries blocked)
- ✅ Write isolation (INSERT/UPDATE blocked)
- ✅ Delete isolation (DELETE blocked)
- ✅ Unauthenticated access blocked
- ✅ Session expiration handled
- ✅ Cross-org data manipulation blocked

## Running the Tests

### Prerequisites

**⚠️ IMPORTANT**: These tests require a **real Supabase instance**. They cannot use mocked Supabase clients because they test actual database-level RLS policies.

### Option 1: Local Supabase (Recommended for Development)

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Start local Supabase:
```bash
supabase start
```

3. Create `.env.test.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-start>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-from-supabase-start>
```

4. Run tests:
```bash
npm test -- rls-policies.test.ts
```

### Option 2: Staging Supabase Project

1. Create a dedicated staging/test Supabase project (do not use production!)

2. Apply all migrations:
```bash
supabase db push
```

3. Create `.env.test.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-test-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

4. Run tests:
```bash
npm test -- rls-policies.test.ts
```

### Option 3: CI/CD Integration

In your CI pipeline (GitHub Actions, etc.):

```yaml
# .github/workflows/test-rls.yml
- name: Start Supabase
  run: supabase start

- name: Run RLS Tests
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SERVICE_ROLE_KEY }}
  run: npm test -- rls-policies.test.ts
```

## Test Data Management

### Automatic Cleanup

The test suite automatically:
1. Creates test organizations and users before tests
2. Creates test data (customers, orders, etc.) for each test
3. Cleans up all test data after tests complete

### Manual Cleanup

If tests fail midway and leave test data, you can clean up manually:

```sql
-- Find test users
SELECT * FROM auth.users WHERE email LIKE '%@test.hortitrack.local';

-- Delete test orgs (cascades to most data)
DELETE FROM organizations WHERE name LIKE 'Test Org%';

-- Delete test users
-- Use Supabase Dashboard > Authentication > Users > Delete
```

## Interpreting Test Results

### ✅ All Tests Pass
Great! Your RLS policies are working correctly and preventing cross-tenant access.

### ❌ Test Failure: "User from Org A can see Org B data"
**Critical Security Issue**: RLS policy is missing or incorrect for this table.

**Action**:
1. Check if RLS is enabled on the table:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'your_table';
   ```
2. Check if policy exists:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'your_table';
   ```
3. Review policy logic in migrations

### ❌ Test Failure: "Cannot create test data"
**Setup Issue**: Service role key may be incorrect or migrations not applied.

**Action**:
1. Verify service role key in `.env.test.local`
2. Run migrations: `supabase db push`
3. Check Supabase logs for errors

### ⚠️ Tests Skipped
Tests are skipped if no real Supabase URL is configured. This is expected in unit test runs.

**To enable**:
- Set up local Supabase or configure test environment variables

## Adding New Table Tests

When adding a new table that needs RLS testing:

1. Add a new `describe` block in `rls-policies.test.ts`:
```typescript
describe('New Table Name', () => {
  let recordAId: string;
  let recordBId: string;

  beforeEach(async () => {
    // Create test data in Org A
    const { data: recordA } = await adminClient
      .from('new_table')
      .insert({ org_id: orgA.id, /* ... */ })
      .select('id')
      .single();

    // Create test data in Org B
    const { data: recordB } = await adminClient
      .from('new_table')
      .insert({ org_id: orgB.id, /* ... */ })
      .select('id')
      .single();

    recordAId = recordA!.id;
    recordBId = recordB!.id;
  });

  test('User from Org A cannot see Org B records', async () => {
    const clientA = await createAuthenticatedClient(orgA);
    const { data } = await clientA
      .from('new_table')
      .select('*')
      .eq('id', recordBId);

    expect(data).toHaveLength(0);
  });
});
```

2. Run tests to verify RLS works:
```bash
npm test -- rls-policies.test.ts
```

## Best Practices

### DO ✅
- Run RLS tests before every production deployment
- Test both read and write operations
- Test derived org_id scenarios (child tables)
- Include unauthenticated access tests
- Use staging/test Supabase, never production

### DON'T ❌
- Run RLS tests against production database
- Skip RLS tests in CI/CD
- Mock Supabase client for RLS tests (defeats the purpose)
- Forget to cleanup test data
- Hardcode credentials in test files

## Troubleshooting

### "Cannot connect to Supabase"
- Check `NEXT_PUBLIC_SUPABASE_URL` is correct
- Verify Supabase instance is running
- Check network/firewall settings

### "Permission denied for table"
- Service role key may be incorrect
- Check `SUPABASE_SERVICE_ROLE_KEY` in `.env.test.local`

### "Tests timeout"
- Increase timeout in `beforeAll` (default 30s)
- Check Supabase instance performance
- Verify migrations applied correctly

### "Data not cleaned up"
- Check `afterAll` hook ran (may be skipped on test failure)
- Manually clean up using SQL queries above
- Consider using test database that can be wiped

## Related Documentation

- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [HortiTrack Security Hardening Migration](../../../supabase/migrations/20251210210000_security_hardening.sql)
- [Phase 2 Patterns Documentation](../../../.claude/PHASE-2-PATTERNS.md#6-multi-tenancy-org_id-filtering)

## Questions?

If tests fail unexpectedly or you need to add new table coverage, consult:
1. This README
2. `.claude/DB-UI-AUDIT-REPORT.md` (Issue C3, H6)
3. `.claude/PHASE-2-PATTERNS.md` (Multi-Tenancy section)
