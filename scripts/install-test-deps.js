#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📦 Installing testing dependencies for FleetFlow Pro...');

const devDependencies = [
  'jest',
  '@testing-library/jest-dom',
  '@testing-library/react',
  '@testing-library/user-event',
  '@types/jest',
  'jest-environment-jsdom',
  'babel-jest',
  'identity-obj-proxy',
  '@playwright/test',
  'playwright',
];

try {
  console.log('Installing dev dependencies...');
  execSync(`npm install --save-dev ${devDependencies.join(' ')}`, { stdio: 'inherit' });
  
  console.log('✅ Testing dependencies installed successfully!');
  console.log('\nAvailable test commands:');
  console.log('  npm test          # Run all tests');
  console.log('  npm run test:watch  # Watch mode');
  console.log('  npm run test:coverage # With coverage');
  console.log('  npm run test:ui    # HTML coverage report');
  console.log('  npm run test:e2e   # End-to-end tests (Playwright)');
  
  // Create test directories
  const testDirs = [
    '__tests__',
    '__tests__/components',
    '__tests__/pages',
    '__tests__/services',
    '__tests__/lib',
    'e2e',
  ];
  
  testDirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
  
} catch (error) {
  console.error('❌ Failed to install testing dependencies:', error.message);
  process.exit(1);
}