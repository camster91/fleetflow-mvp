#!/usr/bin/env node

/**
 * FleetFlow Pro Smoke Test
 * Basic verification that the application is working
 */

const https = require('https');

const APP_URL = 'https://fleet.ashbi.ca';
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('🚀 FleetFlow Pro Smoke Test');
  console.log('===========================');
  console.log(`App: ${APP_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);
  
  for (const { name, fn } of tests) {
    process.stdout.write(`🧪 ${name}... `);
    try {
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (error) {
      console.log('❌ FAIL');
      console.log(`   ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`   Total: ${tests.length}`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All smoke tests passed! Application is working.');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. Investigate issues.`);
    process.exit(1);
  }
}

// Test 1: Application loads
test('Application loads', async () => {
  const response = await fetchUrl(APP_URL);
  if (response.statusCode !== 200) {
    throw new Error(`HTTP ${response.statusCode}`);
  }
});

// Test 2: Dashboard accessible
test('Dashboard accessible', async () => {
  const response = await fetchUrl(`${APP_URL}/dashboard`);
  if (![200, 302, 307].includes(response.statusCode)) {
    throw new Error(`HTTP ${response.statusCode}`);
  }
});

// Test 3: Login page works
test('Login page works', async () => {
  const response = await fetchUrl(`${APP_URL}/auth/login`);
  if (![200, 302, 307].includes(response.statusCode)) {
    throw new Error(`HTTP ${response.statusCode}`);
  }
});

// Test 4: Registration page works
test('Registration page works', async () => {
  const response = await fetchUrl(`${APP_URL}/auth/register`);
  if (![200, 302, 307].includes(response.statusCode)) {
    throw new Error(`HTTP ${response.statusCode}`);
  }
});

// Test 5: API endpoints respond
test('API endpoints respond', async () => {
  const response = await fetchUrl(`${APP_URL}/api/auth/session`);
  if (response.statusCode === 404 || response.statusCode === 500) {
    throw new Error(`API returned HTTP ${response.statusCode}`);
  }
});

// Utility function
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data
        });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.end();
  });
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});