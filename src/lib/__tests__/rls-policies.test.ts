/**
 * RLS (Row Level Security) Multi-Tenancy Test Suite
 *
 * IMPORTANT: These tests require a real Supabase instance with RLS policies enabled.
 * They cannot use mocked Supabase clients as they test actual database-level security.
 *
 * Setup Requirements:
 * 1. Supabase project with all migrations applied
 * 2. Test environment variables set in .env.test.local:
 *    - NEXT_PUBLIC_SUPABASE_URL
 *    - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *    - SUPABASE_SERVICE_ROLE_KEY (for test data setup)
 *
 * Test Strategy:
 * - Create two test organizations (Org A and Org B)
 * - Create test users belonging to each org
 * - Verify users can only access their org's data
 * - Verify cross-org data access is blocked by RLS
 *
 * Run with: npm test -- rls-policies.test.ts
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

// Simple nanoid replacement for testing
const nanoid = () => randomBytes(12).toString('base64url');

// =============================================================================
// Test Configuration
// =============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';

// Skip tests if not running against real Supabase
const SKIP_RLS_TESTS = SUPABASE_URL === 'https://test.supabase.co' ||
                        SUPABASE_URL === 'https://placeholder.supabase.co';

// =============================================================================
// Test Data Factory
// =============================================================================

interface TestOrg {
  id: string;
  name: string;
  userId: string;
  userEmail: string;
  userPassword: string;
}

let adminClient: SupabaseClient;
let orgA: TestOrg;
let orgB: TestOrg;

// =============================================================================
// Setup & Teardown
// =============================================================================

beforeAll(async () => {
  if (SKIP_RLS_TESTS) {
    console.log('⚠️  Skipping RLS tests - no real Supabase instance configured');
    return;
  }

  // Create admin client for test data setup
  adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Create test organizations and users
  try {
    orgA = await createTestOrgWithUser('Test Org A');
    orgB = await createTestOrgWithUser('Test Org B');
  } catch (error) {
    console.error('Failed to create test organizations:', error);
    throw error;
  }
}, 30000); // 30 second timeout for setup

afterAll(async () => {
  if (SKIP_RLS_TESTS) return;

  // Cleanup: Delete test orgs and users
  try {
    await cleanupTestOrg(orgA);
    await cleanupTestOrg(orgB);
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
});

// =============================================================================
// Helper Functions
// =============================================================================

async function createTestOrgWithUser(orgName: string): Promise<TestOrg> {
  const orgId = nanoid();
  const userEmail = `test-rls-${nanoid()}@test.hortitrack.local`;
  const userPassword = nanoid(20);

  // 1. Create organization
  const { error: orgError } = await adminClient
    .from('organizations')
    .insert({
      id: orgId,
      name: orgName,
      created_at: new Date().toISOString(),
    });

  if (orgError) {
    throw new Error(`Failed to create org: ${orgError.message}`);
  }

  // 2. Create user via auth
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: userEmail,
    password: userPassword,
    email_confirm: true,
    user_metadata: {
      full_name: `Test User ${orgName}`,
    },
  });

  if (authError || !authData.user) {
    throw new Error(`Failed to create user: ${authError?.message}`);
  }

  const userId = authData.user.id;

  // 3. Create profile
  const { error: profileError } = await adminClient
    .from('profiles')
    .insert({
      id: userId,
      display_name: `Test User ${orgName}`,
      email: userEmail,
      active_org_id: orgId,
      created_at: new Date().toISOString(),
    });

  if (profileError) {
    throw new Error(`Failed to create profile: ${profileError.message}`);
  }

  // 4. Create org membership
  const { error: membershipError } = await adminClient
    .from('org_memberships')
    .insert({
      org_id: orgId,
      user_id: userId,
      role: 'admin',
      created_at: new Date().toISOString(),
    });

  if (membershipError) {
    throw new Error(`Failed to create membership: ${membershipError.message}`);
  }

  return {
    id: orgId,
    name: orgName,
    userId,
    userEmail,
    userPassword,
  };
}

async function cleanupTestOrg(org: TestOrg) {
  if (!org) return;

  // Delete user (cascades to profiles and memberships)
  await adminClient.auth.admin.deleteUser(org.userId);

  // Delete org (cascades to org-owned data)
  await adminClient
    .from('organizations')
    .delete()
    .eq('id', org.id);
}

async function createAuthenticatedClient(org: TestOrg): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { error } = await client.auth.signInWithPassword({
    email: org.userEmail,
    password: org.userPassword,
  });

  if (error) {
    throw new Error(`Failed to authenticate: ${error.message}`);
  }

  return client;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('RLS Multi-Tenancy Security', () => {
  // Skip all tests if not configured for real Supabase
  if (SKIP_RLS_TESTS) {
    test('RLS tests skipped - configure real Supabase to run', () => {
      expect(true).toBe(true);
    });
    return;
  }

  describe('Customers Table', () => {
    let customerAId: string;
    let customerBId: string;

    beforeEach(async () => {
      // Create test customers in each org using admin client
      const { data: customerA } = await adminClient
        .from('customers')
        .insert({
          org_id: orgA.id,
          name: 'Customer A',
          code: `CUST-A-${nanoid(4)}`,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      const { data: customerB } = await adminClient
        .from('customers')
        .insert({
          org_id: orgB.id,
          name: 'Customer B',
          code: `CUST-B-${nanoid(4)}`,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      customerAId = customerA!.id;
      customerBId = customerB!.id;
    });

    test('User from Org A cannot see Org B customers', async () => {
      const clientA = await createAuthenticatedClient(orgA);

      const { data, error } = await clientA
        .from('customers')
        .select('*')
        .eq('id', customerBId);

      expect(error).toBeNull();
      expect(data).toHaveLength(0); // RLS blocks access
    });

    test('User from Org A can see their own customers', async () => {
      const clientA = await createAuthenticatedClient(orgA);

      const { data, error } = await clientA
        .from('customers')
        .select('*')
        .eq('id', customerAId);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].org_id).toBe(orgA.id);
    });

    test('User from Org B cannot update Org A customer', async () => {
      const clientB = await createAuthenticatedClient(orgB);

      const { data, error } = await clientB
        .from('customers')
        .update({ name: 'Hacked Name' })
        .eq('id', customerAId)
        .select();

      // RLS should either return empty array or an error
      expect(data?.length || 0).toBe(0);
    });

    test('User from Org A cannot delete Org B customer', async () => {
      const clientA = await createAuthenticatedClient(orgA);

      const { data, error } = await clientA
        .from('customers')
        .delete()
        .eq('id', customerBId)
        .select();

      // RLS should block this
      expect(data?.length || 0).toBe(0);
    });
  });

  describe('Orders Table', () => {
    let orderAId: string;
    let orderBId: string;
    let customerAId: string;
    let customerBId: string;

    beforeEach(async () => {
      // Create customers first
      const { data: customerA } = await adminClient
        .from('customers')
        .insert({
          org_id: orgA.id,
          name: 'Customer A',
          code: `CUST-A-${nanoid(4)}`,
        })
        .select('id')
        .single();

      const { data: customerB } = await adminClient
        .from('customers')
        .insert({
          org_id: orgB.id,
          name: 'Customer B',
          code: `CUST-B-${nanoid(4)}`,
        })
        .select('id')
        .single();

      customerAId = customerA!.id;
      customerBId = customerB!.id;

      // Create orders
      const { data: orderA } = await adminClient
        .from('orders')
        .insert({
          org_id: orgA.id,
          customer_id: customerAId,
          order_number: `ORD-A-${nanoid(4)}`,
          status: 'draft',
          currency: 'EUR',
        })
        .select('id')
        .single();

      const { data: orderB } = await adminClient
        .from('orders')
        .insert({
          org_id: orgB.id,
          customer_id: customerBId,
          order_number: `ORD-B-${nanoid(4)}`,
          status: 'draft',
          currency: 'EUR',
        })
        .select('id')
        .single();

      orderAId = orderA!.id;
      orderBId = orderB!.id;
    });

    test('User from Org A cannot see Org B orders', async () => {
      const clientA = await createAuthenticatedClient(orgA);

      const { data } = await clientA
        .from('orders')
        .select('*')
        .eq('id', orderBId);

      expect(data).toHaveLength(0);
    });

    test('User from Org B cannot see Org A orders', async () => {
      const clientB = await createAuthenticatedClient(orgB);

      const { data } = await clientB
        .from('orders')
        .select('*')
        .eq('id', orderAId);

      expect(data).toHaveLength(0);
    });
  });

  describe('Products Table', () => {
    let productAId: string;
    let productBId: string;

    beforeEach(async () => {
      // Create SKUs first (products need SKUs)
      const { data: skuA } = await adminClient
        .from('skus')
        .insert({
          org_id: orgA.id,
          code: `SKU-A-${nanoid(4)}`,
          display_name: 'SKU A',
        })
        .select('id')
        .single();

      const { data: skuB } = await adminClient
        .from('skus')
        .insert({
          org_id: orgB.id,
          code: `SKU-B-${nanoid(4)}`,
          display_name: 'SKU B',
        })
        .select('id')
        .single();

      // Create products
      const { data: productA } = await adminClient
        .from('products')
        .insert({
          org_id: orgA.id,
          name: 'Product A',
          sku_id: skuA!.id,
        })
        .select('id')
        .single();

      const { data: productB } = await adminClient
        .from('products')
        .insert({
          org_id: orgB.id,
          name: 'Product B',
          sku_id: skuB!.id,
        })
        .select('id')
        .single();

      productAId = productA!.id;
      productBId = productB!.id;
    });

    test('User from Org A cannot see Org B products', async () => {
      const clientA = await createAuthenticatedClient(orgA);

      const { data } = await clientA
        .from('products')
        .select('*')
        .eq('id', productBId);

      expect(data).toHaveLength(0);
    });

    test('User from Org A can see their own products', async () => {
      const clientA = await createAuthenticatedClient(orgA);

      const { data } = await clientA
        .from('products')
        .select('*')
        .eq('id', productAId);

      expect(data).toHaveLength(1);
      expect(data![0].org_id).toBe(orgA.id);
    });
  });

  describe('Batches Table', () => {
    let batchAId: string;
    let batchBId: string;

    beforeEach(async () => {
      const { data: batchA } = await adminClient
        .from('batches')
        .insert({
          org_id: orgA.id,
          batch_number: `BATCH-A-${nanoid(4)}`,
          status: 'Active',
        })
        .select('id')
        .single();

      const { data: batchB } = await adminClient
        .from('batches')
        .insert({
          org_id: orgB.id,
          batch_number: `BATCH-B-${nanoid(4)}`,
          status: 'Active',
        })
        .select('id')
        .single();

      batchAId = batchA!.id;
      batchBId = batchB!.id;
    });

    test('User from Org A cannot see Org B batches', async () => {
      const clientA = await createAuthenticatedClient(orgA);

      const { data } = await clientA
        .from('batches')
        .select('*')
        .eq('id', batchBId);

      expect(data).toHaveLength(0);
    });
  });

  describe('Customer Interactions Table (derives org from parent)', () => {
    let customerAId: string;
    let customerBId: string;
    let interactionAId: string;
    let interactionBId: string;

    beforeEach(async () => {
      // Create customers
      const { data: customerA } = await adminClient
        .from('customers')
        .insert({
          org_id: orgA.id,
          name: 'Customer A',
          code: `CUST-A-${nanoid(4)}`,
        })
        .select('id')
        .single();

      const { data: customerB } = await adminClient
        .from('customers')
        .insert({
          org_id: orgB.id,
          name: 'Customer B',
          code: `CUST-B-${nanoid(4)}`,
        })
        .select('id')
        .single();

      customerAId = customerA!.id;
      customerBId = customerB!.id;

      // Create interactions
      const { data: interactionA } = await adminClient
        .from('customer_interactions')
        .insert({
          customer_id: customerAId,
          interaction_type: 'note',
          subject: 'Test Note A',
          user_id: orgA.userId,
        })
        .select('id')
        .single();

      const { data: interactionB } = await adminClient
        .from('customer_interactions')
        .insert({
          customer_id: customerBId,
          interaction_type: 'note',
          subject: 'Test Note B',
          user_id: orgB.userId,
        })
        .select('id')
        .single();

      interactionAId = interactionA!.id;
      interactionBId = interactionB!.id;
    });

    test('User from Org A cannot see Org B customer interactions', async () => {
      const clientA = await createAuthenticatedClient(orgA);

      // This test validates issue C3 from audit report - org_id filtering
      const { data } = await clientA
        .from('customer_interactions')
        .select('*')
        .eq('id', interactionBId);

      expect(data).toHaveLength(0);
    });

    test('User from Org B cannot see Org A customer interactions', async () => {
      const clientB = await createAuthenticatedClient(orgB);

      const { data } = await clientB
        .from('customer_interactions')
        .select('*')
        .eq('id', interactionAId);

      expect(data).toHaveLength(0);
    });
  });

  describe('Unauthenticated Access', () => {
    test('Unauthenticated user cannot access customers', async () => {
      const unauthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      const { data, error } = await unauthClient
        .from('customers')
        .select('*')
        .limit(1);

      // Should either return empty or error due to RLS
      expect(data?.length || 0).toBe(0);
    });

    test('Unauthenticated user cannot access orders', async () => {
      const unauthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      const { data } = await unauthClient
        .from('orders')
        .select('*')
        .limit(1);

      expect(data).toHaveLength(0);
    });
  });

  describe('Session Expiration', () => {
    test('Client with cleared session cannot access data', async () => {
      const clientA = await createAuthenticatedClient(orgA);

      // Sign out to clear session
      await clientA.auth.signOut();

      const { data } = await clientA
        .from('customers')
        .select('*')
        .limit(1);

      expect(data).toHaveLength(0);
    });
  });

  describe('Cross-Org Data Manipulation', () => {
    let customerAId: string;
    let customerBId: string;

    beforeEach(async () => {
      const { data: customerA } = await adminClient
        .from('customers')
        .insert({
          org_id: orgA.id,
          name: 'Customer A',
          code: `CUST-A-${nanoid(4)}`,
        })
        .select('id')
        .single();

      const { data: customerB } = await adminClient
        .from('customers')
        .insert({
          org_id: orgB.id,
          name: 'Customer B',
          code: `CUST-B-${nanoid(4)}`,
        })
        .select('id')
        .single();

      customerAId = customerA!.id;
      customerBId = customerB!.id;
    });

    test('User from Org A cannot insert data with Org B org_id', async () => {
      const clientA = await createAuthenticatedClient(orgA);

      const { data, error } = await clientA
        .from('customers')
        .insert({
          org_id: orgB.id, // Trying to insert with different org_id
          name: 'Malicious Customer',
          code: `HACK-${nanoid(4)}`,
        })
        .select();

      // RLS WITH CHECK should block this
      expect(data).toBeNull();
      expect(error).toBeTruthy();
    });

    test('User from Org B cannot update Org A customer to belong to Org B', async () => {
      const clientB = await createAuthenticatedClient(orgB);

      const { data, error } = await clientB
        .from('customers')
        .update({ org_id: orgB.id })
        .eq('id', customerAId)
        .select();

      // RLS should block this
      expect(data?.length || 0).toBe(0);
    });
  });
});
