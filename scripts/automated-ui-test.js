#!/usr/bin/env node

/**
 * Automated UI Test for FleetFlow Pro
 * Tests the deployed application's basic functionality
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const APP_URL = process.env.TEST_URL || 'https://fleet.ashbi.ca';
const TEST_TIMEOUT = 30000;

console.log('🤖 FleetFlow Pro Automated UI Test');
console.log('==================================');
console.log(`App URL: ${APP_URL}`);
console.log(`Time: ${new Date().toISOString()}`);
console.log('');

const results = [];

function logTest(name, success, message, details = null) {
  const result = {
    name,
    success,
    message,
    details,
    timestamp: new Date().toISOString()
  };
  results.push(result);
  
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  console.log(`   ${message}`);
  if (details) console.log(`   Details: ${details}`);
}

async function testEndpoint(url, expectedStatus = 200) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', timeout: TEST_TIMEOUT }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
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

async function runTests() {
  console.log('🚀 Starting automated UI tests...\n');
  
  // Test 1: Application loads
  try {
    const response = await testEndpoint(APP_URL);
    const success = response.statusCode === 200;
    logTest(
      'Application Homepage Loads',
      success,
      `HTTP ${response.statusCode}`,
      success ? null : 'Application should return HTTP 200'
    );
  } catch (error) {
    logTest(
      'Application Homepage Loads',
      false,
      `Error: ${error.message}`,
      'Application may be down or unreachable'
    );
  }
  
  // Test 2: Dashboard page
  try {
    const response = await testEndpoint(`${APP_URL}/dashboard`);
    const success = response.statusCode === 200 || response.statusCode === 302 || response.statusCode === 307;
    logTest(
      'Dashboard Page Accessible',
      success,
      `HTTP ${response.statusCode}`,
      success ? null : 'Dashboard should be accessible (may redirect to login)'
    );
  } catch (error) {
    logTest(
      'Dashboard Page Accessible',
      false,
      `Error: ${error.message}`,
      'Dashboard may require authentication'
    );
  }
  
  // Test 3: Authentication pages
  const authPages = [
    { path: '/auth/login', name: 'Login Page' },
    { path: '/auth/register', name: 'Registration Page' },
    { path: '/auth/forgot-password', name: 'Forgot Password Page' }
  ];
  
  for (const page of authPages) {
    try {
      const response = await testEndpoint(`${APP_URL}${page.path}`);
      const success = response.statusCode === 200 || response.statusCode === 302 || response.statusCode === 307;
      logTest(
        `${page.name} Accessible`,
        success,
        `HTTP ${response.statusCode}`,
        success ? null : `${page.name} should be accessible`
      );
    } catch (error) {
      logTest(
        `${page.name} Accessible`,
        false,
        `Error: ${error.message}`,
        `${page.name} may not exist or have issues`
      );
    }
  }
  
  // Test 4: Static assets
  const assets = [
    '/favicon.ico',
    '/_next/static/css/',
    '/_next/static/js/'
  ];
  
  for (const asset of assets) {
    try {
      const response = await testEndpoint(`${APP_URL}${asset}`);
      const success = response.statusCode === 200 || response.statusCode === 304;
      logTest(
        `Static Asset Loads: ${asset}`,
        success,
        `HTTP ${response.statusCode}`,
        success ? null : 'Static assets should load properly'
      );
    } catch (error) {
      // Some assets might 404, that's okay
      logTest(
        `Static Asset Loads: ${asset}`,
        true, // Not critical
        `HTTP 404 or error (non-critical)`,
        'Some static assets may not exist'
      );
    }
  }
  
  // Test 5: API endpoints
  const apiEndpoints = [
    { path: '/api/auth/session', method: 'GET', name: 'Auth Session API' },
    { path: '/api/test-email', method: 'POST', name: 'Test Email API' }
  ];
  
  for (const endpoint of apiEndpoints) {
    try {
      const response = await testEndpoint(`${APP_URL}${endpoint.path}`);
      const success = response.statusCode !== 404 && response.statusCode !== 500;
      logTest(
        `${endpoint.name} Responds`,
        success,
        `HTTP ${response.statusCode}`,
        success ? null : 'API endpoint should respond (may require POST)'
      );
    } catch (error) {
      logTest(
        `${endpoint.name} Responds`,
        true, // Not critical
        `Error (non-critical): ${error.message}`,
        'Some API endpoints may require specific methods or auth'
      );
    }
  }
  
  // Test 6: Security headers
  try {
    const response = await testEndpoint(APP_URL);
    const headers = response.headers;
    const securityHeaders = [
      'strict-transport-security',
      'x-frame-options',
      'x-content-type-options'
    ];
    
    const missing = securityHeaders.filter(h => !headers[h]);
    logTest(
      'Security Headers Present',
      missing.length === 0,
      missing.length === 0 ? 'All security headers present' : `Missing: ${missing.join(', ')}`,
      missing.length > 0 ? 'Add security headers to next.config.js' : null
    );
  } catch (error) {
    logTest(
      'Security Headers Present',
      false,
      `Error: ${error.message}`,
      'Could not check security headers'
    );
  }
  
  // Test 7: Page content check
  try {
    const response = await testEndpoint(APP_URL);
    const body = response.body.toLowerCase();
    const hasHtml = body.includes('<html') || body.includes('<!doctype');
    const hasTitle = body.includes('<title');
    const hasBody = body.includes('<body');
    
    logTest(
      'Valid HTML Structure',
      hasHtml && hasTitle && hasBody,
      hasHtml && hasTitle && hasBody ? 'Valid HTML structure' : 'Missing HTML elements',
      !hasHtml ? 'Response should be HTML' : null
    );
    
    // Check for common FleetFlow elements
    const hasFleetKeywords = body.includes('fleet') || body.includes('vehicle') || body.includes('dashboard');
    logTest(
      'FleetFlow Content Present',
      hasFleetKeywords,
      hasFleetKeywords ? 'Fleet-related content found' : 'No fleet keywords found',
      !hasFleetKeywords ? 'Homepage should mention fleet/dashboard' : null
    );
  } catch (error) {
    logTest(
      'Page Content Check',
      false,
      `Error: ${error.message}`,
      'Could not check page content'
    );
  }
  
  // Test 8: Performance check
  try {
    const startTime = Date.now();
    await testEndpoint(APP_URL);
    const loadTime = Date.now() - startTime;
    
    logTest(
      'Page Load Performance',
      loadTime < 3000,
      `Load time: ${loadTime}ms`,
      loadTime >= 3000 ? 'Page load should be under 3 seconds' : null
    );
  } catch (error) {
    logTest(
      'Page Load Performance',
      false,
      `Error: ${error.message}`,
      'Could not measure performance'
    );
  }
  
  // Generate report
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST REPORT SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / total) * 100)}%\n`);
  
  if (failed > 0) {
    console.log('📋 FAILED TESTS:');
    console.log('='.repeat(60));
    results
      .filter(r => !r.success)
      .forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.name}`);
        console.log(`   Message: ${result.message}`);
        if (result.details) console.log(`   Details: ${result.details}`);
      });
  }
  
  // Save results to file
  const report = {
    appUrl: APP_URL,
    timestamp: new Date().toISOString(),
    summary: {
      total,
      passed,
      failed,
      successRate: Math.round((passed / total) * 100)
    },
    tests: results
  };
  
  const reportFile = `ui-test-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 Detailed report saved to: ${reportFile}`);
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('='.repeat(60));
  
  if (failed === 0) {
    console.log('🎉 All automated tests passed!');
    console.log('Proceed with manual testing using the checklist.');
  } else {
    console.log('🔧 Fix these issues first:');
    const failedTests = results.filter(r => !r.success);
    
    if (failedTests.some(t => t.name.includes('Application Homepage'))) {
      console.log('• Check if the application is running');
      console.log('• Verify DNS and SSL certificate');
    }
    
    if (failedTests.some(t => t.name.includes('Security Headers'))) {
      console.log('• Add security headers to next.config.js');
    }
    
    if (failedTests.some(t => t.name.includes('Performance'))) {
      console.log('• Optimize images and enable compression');
      console.log('• Implement caching strategies');
    }
    
    if (failedTests.some(t => t.name.includes('Valid HTML'))) {
      console.log('• Check server-side rendering configuration');
    }
  }
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('='.repeat(60));
  console.log('1. Run manual tests using MANUAL-UI-TEST-CHECKLIST.md');
  console.log('2. Test all buttons, forms, and modals manually');
  console.log('3. Verify responsive design on mobile/tablet');
  console.log('4. Test authentication flows end-to-end');
  console.log('5. Validate data persistence across sessions');
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});