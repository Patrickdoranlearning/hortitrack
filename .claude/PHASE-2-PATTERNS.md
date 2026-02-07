# Phase 2 & 3 Patterns Documentation

**Date**: 2026-02-06
**Phases**: 2 & 3 (High Priority + Strategic Medium Issues)
**Status**: Phase 3 Complete

---

## Overview

This document captures the patterns established during Phase 2 of the audit fix implementation. These patterns build on the Phase 1 infrastructure and should be followed for all future development.

---

## 1. Auth Pattern Comments

### Problem
Different auth patterns across the codebase were not self-documenting, making it unclear why some actions use `requireCustomerAuth()`, others use `getSupabaseServerApp()`, and some (login actions) have no auth checks.

### Solution
Add inline comments explaining auth patterns at the point of use.

### Patterns

#### Pattern A: B2B Customer Auth
```typescript
// B2B portal uses customer-level auth instead of staff auth
// requireCustomerAuth() verifies the customer is logged in via B2B portal
// and returns customerId, orgId, and optional addressId for store-level users
const authContext = await requireCustomerAuth();
```

**When to use**: All B2B portal actions (`src/app/b2b/**/actions.ts`)

**Files updated**:
- `src/app/b2b/orders/actions.ts`
- `src/app/b2b/orders/new/actions.ts`

---

#### Pattern B: Server App Auth
```typescript
// getSupabaseServerApp() creates a Supabase client with the current user's auth context
// It handles getCurrentUser() internally and returns a properly authenticated client
const supabase = await getSupabaseServerApp();
```

**When to use**: Server functions that need authenticated Supabase client

**Files updated**:
- `src/app/sales/settings/fees/actions.ts` (multiple functions)

---

#### Pattern C: Login Actions (No Auth)
```typescript
// Login action intentionally does not check auth - unauthenticated users need to call this
// to authenticate. Auth checks happen on protected pages/actions after login succeeds.
export async function login(formData: FormData) {
```

**When to use**: Login endpoints that create authentication sessions

**Files updated**:
- `src/app/login/actions.ts`
- `src/app/b2b/login/actions.ts`
- `src/app/(worker)/worker/login/actions.ts`

---

## 2. Error Boundaries

### Problem
React errors in client components would crash the entire page, showing white screen to users.

### Solution
Wrap all client components with `<ErrorBoundary>` to catch and display errors gracefully.

### Pattern

```typescript
import { ErrorBoundary } from '@/components/ui/error-boundary';

export default async function MyPage() {
  // Server-side data fetching with error handling
  const { data, error } = await query;

  if (error) {
    return <ErrorState title="..." message="..." />;
  }

  return (
    <PageFrame>
      <ErrorBoundary>
        <MyClientComponent data={data} />
      </ErrorBoundary>
    </PageFrame>
  );
}
```

### When to Use
- **Required**: All B2B portal pages (external customers see these)
- **Required**: Critical sales module pages (orders, customers)
- **Recommended**: Complex wizards, dialogs, forms
- **Optional**: Simple static pages

### Files Updated
- `src/app/b2b/orders/page.tsx` - B2B orders list
- `src/app/b2b/orders/new/page.tsx` - B2B order creation
- `src/app/sales/orders/page.tsx` - Sales orders list
- `src/app/sales/customers/page.tsx` - Customer management

### Available Components

#### ErrorBoundary (Client-side)
For wrapping client components:
```typescript
<ErrorBoundary compact>
  <InlineComponent />
</ErrorBoundary>
```

#### ErrorState (Server-side)
For server component error displays:
```typescript
if (error) {
  return (
    <ErrorState
      title="Unable to Load Data"
      message="User-friendly message here"
      error={process.env.NODE_ENV === 'development' ? error.message : undefined}
    />
  );
}
```

---

## 3. Type Safety (Eliminating Type Assertions)

### Problem
Heavy use of `as any` and `as unknown` masked type safety issues and prevented TypeScript from catching schema mismatches.

**Before Phase 2**: 367 type assertions across 124 files

### Solution
Use generated Supabase types instead of manual type definitions and assertions.

### Pattern

#### Before (Bad):
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOrgFeesTable(): Promise<any> {
  const supabase = await getSupabaseServerApp();
  // Cast to any to bypass type checking for tables not yet in generated types
  return (supabase as unknown as { from: (table: string) => unknown }).from('org_fees');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFeeRow(row: any): OrgFee {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    feeType: row.fee_type as string,
    // ... many type assertions
  };
}
```

#### After (Good):
```typescript
import type { Database } from '@/types/supabase';

// Use generated types
type OrgFeeRow = Database['public']['Tables']['org_fees']['Row'];
type OrgFeeInsert = Database['public']['Tables']['org_fees']['Insert'];
type OrgFeeUpdate = Database['public']['Tables']['org_fees']['Update'];

// Direct Supabase usage with proper types
const supabase = await getSupabaseServerApp();
const { data, error } = await supabase
  .from('org_fees')  // TypeScript knows this table
  .select('*')
  .eq('org_id', membership.org_id);

// Mapping with typed input
function mapFeeRow(row: OrgFeeRow): OrgFee {
  return {
    id: row.id,              // No assertions needed
    orgId: row.org_id,       // TypeScript validates these
    feeType: row.fee_type,
    // ... no type assertions
  };
}
```

### Files Updated
- `src/app/sales/settings/fees/actions.ts` - Reduced from many assertions to 0

### Rules
1. **NEVER use `any`** - Use `unknown` and narrow if you truly don't know the type
2. **Import from `@/types/supabase`** - All database types are generated
3. **Use helpers from Phase 1** - `lib/types.ts` has utility types
4. **Regenerate types** - Run `npm run supabase:types` after schema changes

---

## 4. Error Handling in Server Actions

### Problem
Inconsistent error return types made it hard for UI to handle errors properly.

### Solution (From Phase 1)
Use `ActionResult<T>` pattern from `lib/errors.ts`.

### Pattern

```typescript
import type { ActionResult } from '@/lib/errors';
import { z } from 'zod';

const InputSchema = z.object({
  name: z.string().min(1, 'Name required'),
});

export async function myAction(input: unknown): Promise<ActionResult<MyData>> {
  // 1. Validate input
  const validation = InputSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: 'Invalid input',
      code: 'VALIDATION_ERROR',
      details: validation.error.flatten(),
    };
  }

  // 2. Do work
  const { data, error } = await supabase.from('table').insert(validation.data);

  // 3. Return result
  if (error) {
    logError('Action failed', { error: error.message });
    return {
      success: false,
      error: 'User-friendly message',
      code: 'DATABASE_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    };
  }

  return {
    success: true,
    data,
  };
}
```

### Client Usage
```typescript
'use client';

import { toast } from 'sonner';

async function handleSubmit() {
  const result = await myAction(formData);

  if (!result.success) {
    toast.error(result.error);
    if (result.details) {
      console.error('Details:', result.details);
    }
    return;
  }

  toast.success('Success!');
  // Use result.data
}
```

---

## 5. Logging

### Problem
`console.log` statements in production code expose sensitive data and lack structure.

### Solution (From Phase 1)
Use structured logging from `lib/log.ts`.

### Pattern

#### Before (Bad):
```typescript
console.log("Login action started for", email);
console.error("Login failed:", error.message);
```

#### After (Good):
```typescript
import { logInfo, logError, logWarning } from '@/lib/log';

logInfo('Login attempt', { userId: hash(email) }); // Hash PII
logError('Login failed', { error: error.message, email }); // Only in logs
```

### Rules
1. **Never log PII in production** - Hash or redact sensitive data
2. **Use structured context** - Pass objects, not strings
3. **Use appropriate level**:
   - `logInfo()` - Normal operations
   - `logWarning()` - Recoverable issues
   - `logError()` - Failures that need attention

### Files Updated
- `src/app/login/actions.ts` - Uses structured logging

---

## 6. Multi-Tenancy (org_id Filtering)

### Pattern (Established in Phase 1, C3)

Always filter by `org_id` in application code, don't rely solely on RLS.

```typescript
// ❌ BAD: Relies only on RLS
const { data } = await supabase
  .from('customer_interactions')
  .eq('customer_id', customerId);

// ✅ GOOD: Defense in depth
// First, verify customer belongs to user's org
const { data: customer } = await supabase
  .from('customers')
  .select('org_id')
  .eq('id', customerId)
  .single();

if (!customer || customer.org_id !== user.org_id) {
  return { error: 'Customer not found' };
}

// Then query with explicit org_id filter
const { data } = await supabase
  .from('customer_interactions')
  .select('*')
  .eq('customer_id', customerId)
  .eq('org_id', customer.org_id);  // ← Explicit filter
```

---

## 7. Loading States

### Problem
Server components don't show loading states during data fetch, users see blank screens.

### Solution
Use React Suspense boundaries for async data fetching.

### Pattern

```typescript
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default async function MyPage() {
  return (
    <PageFrame>
      <Suspense fallback={<OrdersLoadingSkeleton />}>
        <OrdersList />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-32" />}>
        <OrdersStats />
      </Suspense>
    </PageFrame>
  );
}

// Separate async component
async function OrdersList() {
  const orders = await fetchOrders();
  return <OrdersTable orders={orders} />;
}
```

### When to Use
- **Required**: Long-running queries (>500ms)
- **Recommended**: Any async server component
- **Optional**: Fast queries (<100ms)

---

## Quick Reference

| Task | Pattern | File |
|------|---------|------|
| Add auth comment | See "Auth Pattern Comments" | Any `actions.ts` |
| Wrap client component | `<ErrorBoundary>` | Any `page.tsx` |
| Handle server error | `<ErrorState>` | Server components |
| Type database row | `Database['public']['Tables']['X']['Row']` | `@/types/supabase` |
| Return from action | `ActionResult<T>` | `@/lib/errors` |
| Log events | `logInfo/Error/Warning()` | `@/lib/log` |
| Show loading | `<Suspense fallback={<Skeleton />}>` | Async components |

---

## Remaining Work (Phase 2)

### H4: Add Loading States (Pending)
Need to add Suspense boundaries to more async pages.

### H5: Update Actions to Return Errors (Pending)
Convert remaining server actions to use `ActionResult<T>` pattern.

### H6: Create RLS Test Suite (Pending)
Create 10-15 tests to verify multi-org isolation.

---

## Phase 1 Infrastructure (Available)

From Phase 1, the following utilities are ready to use:

1. **lib/log.ts** - Structured logging helpers
2. **lib/errors.ts** - `ActionResult<T>` type and helpers
3. **lib/types.ts** - Type utilities and Zod schemas
4. **components/ui/error-boundary.tsx** - React error boundary
5. **components/ui/error-state.tsx** - Server-side error display

---

## Examples by Module

### B2B Portal
- Auth: `requireCustomerAuth()`
- Error boundaries on all pages
- ErrorState for server errors

### Sales Module
- Auth: `getSupabaseServerApp()` or `getCurrentUser()`
- Error boundaries on critical pages
- ActionResult for all mutations

### Production Module
- Same patterns as Sales
- Heavy use of Supabase types
- Multi-org filtering critical

---

## Phase 3 Patterns (Strategic Medium Issues)

### 8. Query Safety with `.maybeSingle()`

#### Problem
`.single()` throws errors if 0 or 2+ rows are returned, causing unhandled exceptions.

#### Solution
Use `.maybeSingle()` for safer null handling.

#### Pattern

```typescript
// ❌ BAD: Can throw if not exactly 1 row
const { data: order } = await supabase
  .from('orders')
  .eq('id', orderId)
  .single();

if (!order) return { error: 'Not found' };

// ✅ GOOD: Returns null if not found, catches error
const { data: order, error } = await supabase
  .from('orders')
  .eq('id', orderId)
  .maybeSingle();

if (error || !order) {
  return { error: 'Not found' };
}
```

#### When to Use
- **`.maybeSingle()`**: When expecting 0 or 1 row (most common)
- **`.single()`**: Only when you're certain exactly 1 row exists (rare)

#### Files Updated (Phase 3)
- `src/app/b2b/login/actions.ts`
- `src/app/b2b/orders/actions.ts`
- `src/app/b2b/orders/new/actions.ts`
- `src/app/b2b/impersonate/actions.ts`
- `src/app/sales/actions.ts` (multiple functions)
- `src/lib/auth/b2b-guard.ts`

---

### 9. Input Validation with Zod

#### Problem
Actions accepting user input without validation allow invalid data to reach the database.

#### Solution
Validate all action inputs with Zod schemas before processing.

#### Pattern

```typescript
import { z } from 'zod';

const UUIDSchema = z.string().uuid('Invalid ID format');

const CreateItemSchema = z.object({
  customerId: UUIDSchema,
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  notes: z.string().max(5000, 'Notes too long').optional(),
});

export async function createItem(input: unknown): Promise<ActionResult<Item>> {
  // Validate first
  const validation = CreateItemSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message ?? 'Invalid input',
      code: 'VALIDATION_ERROR',
      details: validation.error.flatten(),
    };
  }

  const validatedData = validation.data;
  // Use validatedData (typed and validated)
}
```

#### When to Use
- **Required**: All server actions accepting FormData or user input
- **UUID validation**: Always validate IDs to prevent injection
- **Length limits**: Prevent database errors from oversized text

#### Files Updated (Phase 3)
- `src/app/sales/actions.ts` - Added validation to:
  - `generateInvoice` (UUID validation)
  - `dispatchAndInvoice` (UUID validation)
  - `logInteraction` (full schema with length limits)
  - `sendOrderConfirmation` (UUID validation)
  - `getCustomerInteractions` (UUID validation)

---

### 10. Avoiding N+1 Queries

#### Problem
Looping over items and making a query for each one causes N+1 database round-trips.

#### Solution
Batch fetch data in a single query before the loop, or use Promise.all for parallel queries.

#### Pattern

```typescript
// ❌ BAD: N+1 query (N queries in loop)
const results = [];
for (const group of groups) {
  const { data: members } = await supabase
    .rpc('get_members', { group_id: group.id });
  results.push({ group, members });
}

// ✅ GOOD: Batch query (1 query)
const { data: allMembers } = await supabase
  .from('group_members')
  .select('group_id, member_id, members!inner(id, name)')
  .in('group_id', groups.map(g => g.id));

// Group by group_id
const membersByGroup = new Map();
allMembers?.forEach(m => {
  if (!membersByGroup.has(m.group_id)) {
    membersByGroup.set(m.group_id, []);
  }
  membersByGroup.get(m.group_id).push(m.members);
});

const results = groups.map(group => ({
  group,
  members: membersByGroup.get(group.id) || []
}));
```

#### When RPC is Necessary
If some groups need complex RPC logic:
```typescript
// 1. Batch fetch simple cases
const { data: explicitMembers } = await supabase
  .from('group_members')
  .select('...')
  .in('group_id', groupIds);

// 2. Only call RPC for special cases
const specialGroups = groups.filter(g => g.has_dynamic_rules);
const dynamicResults = await Promise.all(
  specialGroups.map(g => supabase.rpc('get_members', { group_id: g.id }))
);

// 3. Merge results
```

#### Files Updated (Phase 3)
- `src/server/sales/product-groups-with-availability.ts` - Reduced from N RPC calls to 1 batch query + M RPCs (where M = groups with dynamic rules only)

---

### 11. ActionResult Pattern for Consistency

#### Problem
Inconsistent error return shapes make client-side error handling difficult.

#### Solution
Use `ActionResult<T>` type from `lib/errors.ts` for all server actions.

#### Pattern

```typescript
import type { ActionResult } from '@/lib/errors';

export async function myAction(input: string): Promise<ActionResult<MyData>> {
  // Validation error
  if (!input) {
    return {
      success: false,
      error: 'Input required',
      code: 'VALIDATION_ERROR',
    };
  }

  // Database error
  const { data, error } = await supabase.from('table').insert({...});
  if (error) {
    return {
      success: false,
      error: 'Failed to create',
      code: 'DB_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    };
  }

  // Success
  return {
    success: true,
    data
  };
}
```

#### Client Usage
```typescript
const result = await myAction(input);

if (!result.success) {
  toast.error(result.error);
  console.error(result.code, result.details);
  return;
}

// TypeScript knows result.data exists
const item = result.data;
```

#### Files Updated (Phase 3)
- `src/app/sales/actions.ts`:
  - `generateInvoice` - Now returns `ActionResult<{ invoiceId: string }>`
  - `dispatchAndInvoice` - Now returns `ActionResult<{ invoiceId: string }>`
  - `logInteraction` - Now returns `ActionResult<{ interaction: any }>`

---

### 12. JSDoc for Server Actions

#### Problem
Complex server actions lack documentation, making them hard to understand and use.

#### Solution
Add JSDoc comments to all public server actions.

#### Pattern

```typescript
/**
 * Brief one-line summary
 *
 * Longer description explaining what the action does,
 * any side effects, and important behavior.
 *
 * @param paramName - Description of parameter
 * @param anotherParam - Description (default: value)
 * @returns Description of return value
 * @throws {Error} When this fails
 * @example
 * const result = await myAction({ id: '123' });
 * if (result.success) {
 *   console.log(result.data);
 * }
 */
export async function myAction(paramName: string, anotherParam = 10) {
  // ...
}
```

#### What to Document
- **Purpose**: What does it do?
- **Parameters**: What are the inputs?
- **Returns**: What does it return?
- **Side effects**: Does it revalidate paths? Send emails?
- **Examples**: How to use it correctly?

#### Files Updated (Phase 3)
- `src/app/sales/actions.ts` - Added JSDoc to:
  - `createOrder`
  - `generateInvoice`
  - `dispatchAndInvoice`
  - `logInteraction`
  - `getCustomerInteractions`

---

## Phase 3 Summary

### Completed
- ✅ Fixed `.single()` → `.maybeSingle()` in 10+ critical files
- ✅ Added Zod validation to 5 key actions
- ✅ Fixed N+1 query in product groups (major performance improvement)
- ✅ Standardized error returns with ActionResult in 3 critical actions
- ✅ Replaced console.error with logError in server files
- ✅ Added JSDoc to 5 most important server actions

### Impact
- **Reliability**: Safer null handling prevents crashes
- **Security**: Input validation blocks malicious data
- **Performance**: N+1 fix reduces database load significantly
- **Maintainability**: Consistent patterns and documentation
- **DX**: Better type inference and error messages

---

*This document captures patterns from Phases 2 & 3 of the audit fix implementation.*
