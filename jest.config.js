/** @type {import('jest').Config} */
const config = {
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  // API route tests run in Node (no DOM needed); component/page tests use jsdom
  projects: [
    {
      displayName: 'api',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/pages/api/**/*.test.ts', '<rootDir>/__tests__/api/**/*.test.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      },
      transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
      },
      modulePathIgnorePatterns: ['<rootDir>/.next/'],
      testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
    },
    {
      displayName: 'ui',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/__tests__/components/**/*.test.{ts,tsx}',
        '<rootDir>/__tests__/pages/**/*.test.{ts,tsx}',
        '<rootDir>/__tests__/services/**/*.test.ts',
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^@/components/(.*)$': '<rootDir>/components/$1',
        '^@/pages/(.*)$': '<rootDir>/pages/$1',
        '^@/services/(.*)$': '<rootDir>/services/$1',
        '^@/lib/(.*)$': '<rootDir>/lib/$1',
        '^@/context/(.*)$': '<rootDir>/context/$1',
        '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
        '^@/types/(.*)$': '<rootDir>/types/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      },
      transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
          presets: [['next/babel', { 'preset-react': { runtime: 'automatic' } }]],
        }],
      },
      modulePathIgnorePatterns: ['<rootDir>/.next/'],
      testPathIgnorePatterns: [
        '<rootDir>/node_modules/',
        '<rootDir>/.next/',
        '<rootDir>/__tests__/pages/api/',
      ],
    },
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/lib/**/*.test.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      },
      transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
      },
      modulePathIgnorePatterns: ['<rootDir>/.next/'],
      testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
    },
  ],
  // Legacy flat config kept for coverage collection
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/pages/(.*)$': '<rootDir>/pages/$1',
    '^@/services/(.*)$': '<rootDir>/services/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/context/(.*)$': '<rootDir>/context/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['next/babel', {
          'preset-react': {
            runtime: 'automatic',
          },
        }],
      ],
    }],
  },
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    'pages/**/*.{js,jsx,ts,tsx}',
    'services/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

module.exports = config;
