
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    "**/__tests__/**/*.ts?(x)",
    "**/?(*.)+(spec|test).ts?(x)",
    "src/server/scan/parse.test.ts"
  ],
  // Transform Next.js server-only imports
  transformIgnorePatterns: [
    '/node_modules/(?!(server-only)/)',
  ],
  // Setup files for base tests
  setupFilesAfterEnv: ['<rootDir>/src/lib/__tests__/setup.ts'],
  // Exclude component tests from root (they run in projects)
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/src/components/',
  ],
  // Projects for component testing (jsdom environment)
  projects: [
    // Default project for server-side tests
    {
      displayName: 'server',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/app/actions/**/*.test.ts',
        '<rootDir>/src/app/api/**/*.test.ts',
        '<rootDir>/src/app/sales/**/*.test.ts',
        '<rootDir>/src/app/b2b/**/*.test.ts',
        '<rootDir>/src/server/**/*.test.ts',
        '<rootDir>/src/lib/**/*.test.ts',
      ],
      testPathIgnorePatterns: [
        '/node_modules/',
        'test-utils.ts',
        'setup.ts',
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      transformIgnorePatterns: [
        '/node_modules/(?!(server-only)/)',
      ],
      setupFilesAfterEnv: ['<rootDir>/src/lib/__tests__/setup.ts'],
    },
    // Component tests (jsdom)
    {
      displayName: 'components',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/src/components/**/*.test.tsx',
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        // Mock lucide-react icons
        '^lucide-react$': '<rootDir>/src/lib/__tests__/__mocks__/lucide-react.ts',
      },
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: {
            jsx: 'react-jsx',
          },
        }],
      },
      transformIgnorePatterns: [
        '/node_modules/(?!(server-only|lucide-react)/)',
      ],
      setupFilesAfterEnv: [
        '@testing-library/jest-dom',
        '<rootDir>/src/lib/__tests__/setup.ts',
      ],
    },
  ],
};
