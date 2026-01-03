/**
 * Jest setup file - runs before all tests
 */

// Mock next/cache
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

// Mock next/headers
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
  headers: jest.fn(() => new Map()),
}));

// Mock server-only (it throws if imported in client context)
jest.mock('server-only', () => ({}));

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Suppress console.error and console.log in tests unless explicitly needed
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;

beforeAll(() => {
  console.error = jest.fn();
  console.log = jest.fn();
  console.info = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
  console.info = originalConsoleInfo;
});

