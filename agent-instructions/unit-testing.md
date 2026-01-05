# Unit Testing Instructions for AI Agents

## Overview
Use this guide when creating unit tests for any module in the Hortitrack codebase.

---

## Testing Philosophy (CRITICAL)

### 1. Tests Define Expected Behavior
- Tests are a specification of how code SHOULD work
- If a test fails, investigate whether the **TEST** or the **IMPLEMENTATION** is wrong
- Don't assume the implementation is correct just because it exists

### 2. Avoid Hindsight Bias
- **WRONG**: Changing test expectations to match buggy implementation
- **RIGHT**: Fixing the implementation when tests reveal bugs
- Ask: "What would a user reasonably expect this to do?"

### 3. Security First
- Tests should verify sensitive data isn't leaked (error messages, stack traces)
- Generic error messages for 500 responses (don't expose internals)
- Validate that auth checks are in place

### 4. Edge Cases Matter
- Empty inputs, null values, undefined
- Boundary conditions (0, negative numbers, max values)
- Malformed data, missing required fields

---

## How to Use This Guide

When requesting unit tests, use this template:

```
I want to create unit tests for the **[MODULE_NAME]** module.

## Module Scope
- Server Actions: `src/app/actions/[files].ts`
- Components: `src/components/[module]/`
- API Routes: `src/app/api/[routes]/`

## Special Considerations
[Any module-specific details, integrations, or edge cases]

## Reference
Follow the patterns in `agent-instructions/unit-testing.md`
```

---

## Environment Setup Checklist

Before writing tests, verify:

- [ ] Dependencies installed:
  ```bash
  npm install --save-dev jest ts-jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom @testing-library/user-event
  ```

- [ ] `jest.config.js` configured with:
  - `ts-jest` preset
  - Separate projects for `node` (actions) and `jsdom` (components)
  - Module path aliases (`@/` → `src/`)
  - Setup files for mocking Next.js internals

- [ ] Shared test utilities exist at `src/lib/__tests__/test-utils.ts`

---

## Test File Structure

### Server Actions (`src/app/actions/__tests__/[name].test.ts`)

```typescript
/**
 * Unit tests for [name].ts server actions
 */

import {
  createMockSupabaseClient,
  createMockUser,
  factories,
  MockSupabaseQueryBuilder,
} from '@/lib/__tests__/test-utils';

// Mock dependencies BEFORE importing module under test
const mockSupabase = createMockSupabaseClient();
const mockUser = createMockUser();
const mockOrgId = 'test-org-id';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
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
import { functionToTest } from '../[name]';

describe('[name] actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('functionToTest', () => {
    it('should succeed with valid input', async () => {
      // Arrange
      mockSupabase.from = jest.fn(() => 
        new MockSupabaseQueryBuilder({ data: [...], error: null })
      );

      // Act
      const result = await functionToTest({ ... });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(...);
    });

    it('should handle database errors', async () => {
      mockSupabase.from = jest.fn(() =>
        new MockSupabaseQueryBuilder({ data: null, error: { message: 'DB error' } })
      );

      const result = await functionToTest({ ... });

      expect(result.success).toBe(false);
      expect(result.error).toContain('DB error');
    });

    it('should validate required fields', async () => {
      const result = await functionToTest({ /* missing required field */ });

      expect(result.success).toBe(false);
    });
  });
});
```

### Components (`src/components/[module]/__tests__/[Name].test.tsx`)

```typescript
/**
 * Unit tests for [Name] component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock server actions
jest.mock('@/app/actions/[module]', () => ({
  someAction: jest.fn(),
}));

// Mock toast notifications
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

import { ComponentName } from '../ComponentName';
import { someAction } from '@/app/actions/[module]';

const mockSomeAction = someAction as jest.Mock;

describe('ComponentName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSomeAction.mockResolvedValue({ success: true });
  });

  it('should render initial state', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    render(<ComponentName />);
    
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));
    
    await waitFor(() => {
      expect(mockSomeAction).toHaveBeenCalledWith(expect.objectContaining({
        // expected arguments
      }));
    });
  });

  it('should display error on failure', async () => {
    mockSomeAction.mockResolvedValue({ success: false, error: 'Failed' });
    
    render(<ComponentName />);
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
```

### API Routes (`src/app/api/[route]/__tests__/route.test.ts`)

```typescript
/**
 * Unit tests for [route] API
 */

import { createMockSupabaseClient, createMockUser } from '@/lib/__tests__/test-utils';

const mockSupabase = createMockSupabaseClient();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

jest.mock('@/server/auth/org', () => ({
  getUserAndOrg: jest.fn(() => Promise.resolve({
    user: createMockUser(),
    orgId: 'test-org-id',
    supabase: mockSupabase,
  })),
}));

import { GET, POST } from '../route';

describe('API Route', () => {
  const createRequest = (method: string, body?: any, query?: string) => {
    const url = `http://localhost/api/route${query ? `?${query}` : ''}`;
    return new Request(url, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  it('should return 200 with valid request', async () => {
    mockSupabase.from = jest.fn(() => ({ /* mock chain */ }));

    const response = await GET(createRequest('GET', null, 'param=value'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('expectedField');
  });

  it('should return 400 for invalid input', async () => {
    const response = await POST(createRequest('POST', { invalid: 'data' }));
    
    expect(response.status).toBe(400);
  });

  it('should return 500 on database error', async () => {
    mockSupabase.from = jest.fn(() => {
      throw new Error('Connection failed');
    });

    const response = await GET(createRequest('GET'));
    
    expect(response.status).toBe(500);
  });
});
```

---

## Test Data Factories

Add reusable factories to `src/lib/__tests__/test-utils.ts`:

```typescript
export const factories = {
  // Add factories for each entity type
  entityName: (overrides: Record<string, any> = {}) => ({
    id: 'entity-1',
    org_id: 'test-org-id',
    name: 'Test Entity',
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),
};
```

---

## Common Patterns

### Testing Pagination
```typescript
it('should handle pagination', async () => {
  const page1 = await listItems({ page: 1, limit: 10 });
  expect(page1.data).toHaveLength(10);
  expect(page1.hasMore).toBe(true);
});
```

### Testing Filters
```typescript
it('should filter by status', async () => {
  const result = await listItems({ status: 'active' });
  expect(result.data.every(item => item.status === 'active')).toBe(true);
});
```

### Testing Transactions/Rollbacks
```typescript
it('should rollback on partial failure', async () => {
  // Mock first operation success, second failure
  mockSupabase.from = jest.fn()
    .mockReturnValueOnce(/* success */)
    .mockReturnValueOnce(/* failure */);

  const result = await createWithRelated({ ... });

  expect(result.success).toBe(false);
  // Verify rollback was called
});
```

---

## Verification Checklist

After writing tests:

- [ ] All new tests pass
- [ ] No tests were modified just to match buggy implementation
- [ ] Implementation bugs found were FIXED, not papered over
- [ ] Full test suite still passes (no regressions)
- [ ] Edge cases and error paths are covered
- [ ] Security-sensitive operations are tested

---

## Reference Implementations

See these existing tests for patterns:

- **Server Actions**: `src/app/actions/__tests__/plant-health.test.ts`
- **Components**: `src/components/plant-health/scout/__tests__/ScoutWizard.test.tsx`
- **API Routes**: `src/app/api/scout-search/__tests__/route.test.ts`
- **Test Utilities**: `src/lib/__tests__/test-utils.ts`


