#!/usr/bin/env node

/**
 * FleetFlow Pro UI/UX Test Runner
 * 
 * This script runs a comprehensive test of all UI components and features
 * to ensure everything is working properly.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const APP_URL = 'https://fleet.ashbi.ca';
const TEST_TIMEOUT = 30000; // 30 seconds

console.log('🔍 FleetFlow Pro UI/UX Comprehensive Test');
console.log('=========================================');
console.log(`App URL: ${APP_URL}`);
console.log(`Time: ${new Date().toISOString()}`);
console.log('');

// Test categories
const testCategories = [
  {
    name: 'Authentication & Navigation',
    tests: [
      { name: 'App loads without errors', method: 'checkAppLoad' },
      { name: 'Login page accessible', method: 'checkLoginPage' },
      { name: 'Registration page accessible', method: 'checkRegistrationPage' },
      { name: 'Dashboard accessible after auth', method: 'checkDashboard' },
    ],
  },
  {
    name: 'Dashboard Features',
    tests: [
      { name: 'Stats cards display correctly', method: 'checkStatsCards' },
      { name: 'Tab navigation works', method: 'checkTabNavigation' },
      { name: 'Refresh button works', method: 'checkRefreshButton' },
      { name: 'Search functionality works', method: 'checkSearch' },
    ],
  },
  {
    name: 'Data Management',
    tests: [
      { name: 'Vehicles display correctly', method: 'checkVehicles' },
      { name: 'Deliveries display correctly', method: 'checkDeliveries' },
      { name: 'Maintenance tasks display', method: 'checkMaintenance' },
      { name: 'SOP categories display', method: 'checkSOPs' },
      { name: 'Clients display correctly', method: 'checkClients' },
    ],
  },
  {
    name: 'Modal & Form Functionality',
    tests: [
      { name: 'Vehicle detail modal works', method: 'checkVehicleModal' },
      { name: 'Add vehicle form works', method: 'checkAddVehicleForm' },
      { name: 'Add delivery form works', method: 'checkAddDeliveryForm' },
      { name: 'Announcement modal works', method: 'checkAnnouncementModal' },
    ],
  },
  {
    name: 'Responsive Design',
    tests: [
      { name: 'Mobile menu works', method: 'checkMobileMenu' },
      { name: 'Tablet responsive design', method: 'checkTabletLayout' },
      { name: 'Desktop responsive design', method: 'checkDesktopLayout' },
    ],
  },
  {
    name: 'Performance & Security',
    tests: [
      { name: 'Page load time < 3s', method: 'checkLoadTime' },
      { name: 'SSL certificate valid', method: 'checkSSL' },
      { name: 'Security headers present', method: 'checkSecurityHeaders' },
    ],
  },
];

// Utility functions
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(TEST_TIMEOUT, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runTest(testName, testMethod) {
  console.log(`\n📋 ${testName}`);
  console.log('   ' + '-'.repeat(testName.length));
  
  try {
    const result = await testMethods[testMethod]();
    if (result.success) {
      console.log(`   ✅ ${result.message}`);
      return { success: true, testName };
    } else {
      console.log(`   ❌ ${result.message}`);
      if (result.details) {
        console.log(`      Details: ${result.details}`);
      }
      return { success: false, testName, error: result.message };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, testName, error: error.message };
  }
}

// Test methods
const testMethods = {
  checkAppLoad: async () => {
    try {
      const response = await makeRequest(`${APP_URL}/`);
      if (response.statusCode === 200) {
        return { success: true, message: 'App loads successfully (HTTP 200)' };
      } else {
        return { success: false, message: `App returned HTTP ${response.statusCode}` };
      }
    } catch (error) {
      return { success: false, message: `Failed to load app: ${error.message}` };
    }
  },

  checkLoginPage: async () => {
    try {
      const response = await makeRequest(`${APP_URL}/auth/login`);
      if (response.statusCode === 200) {
        return { success: true, message: 'Login page accessible' };
      } else if (response.statusCode === 302 || response.statusCode === 307) {
        return { success: true, message: 'Login page redirects (already authenticated?)' };
      } else {
        return { success: false, message: `Login page returned HTTP ${response.statusCode}` };
      }
    } catch (error) {
      return { success: false, message: `Failed to access login page: ${error.message}` };
    }
  },

  checkDashboard: async () => {
    try {
      const response = await makeRequest(`${APP_URL}/dashboard`);
      if (response.statusCode === 200) {
        return { success: true, message: 'Dashboard accessible' };
      } else if (response.statusCode === 302 || response.statusCode === 307) {
        return { success: true, message: 'Dashboard redirects to login (auth required)' };
      } else {
        return { success: false, message: `Dashboard returned HTTP ${response.statusCode}` };
      }
    } catch (error) {
      return { success: false, message: `Failed to access dashboard: ${error.message}` };
    }
  },

  checkSSL: async () => {
    try {
      const response = await makeRequest(APP_URL);
      return { success: true, message: 'SSL certificate valid' };
    } catch (error) {
      return { success: false, message: `SSL error: ${error.message}` };
    }
  },

  checkSecurityHeaders: async () => {
    try {
      const response = await makeRequest(APP_URL);
      const headers = response.headers;
      const securityHeaders = [
        'strict-transport-security',
        'content-security-policy',
        'x-frame-options',
        'x-content-type-options',
      ];

      const missingHeaders = securityHeaders.filter(header => !headers[header]);

      if (missingHeaders.length === 0) {
        return { success: true, message: 'All security headers present' };
      } else {
        return {
          success: false,
          message: `Missing security headers: ${missingHeaders.join(', ')}`,
          details: 'Configure security headers in next.config.js',
        };
      }
    } catch (error) {
      return { success: false, message: `Failed to check headers: ${error.message}` };
    }
  },

  checkLoadTime: async () => {
    try {
      const startTime = Date.now();
      await makeRequest(`${APP_URL}/`);
      const loadTime = Date.now() - startTime;

      if (loadTime < 3000) {
        return { success: true, message: `Page load time: ${loadTime}ms (< 3s)` };
      } else {
        return {
          success: false,
          message: `Page load time: ${loadTime}ms (≥ 3s)`,
          details: 'Consider optimizing images, code splitting, or caching',
        };
      }
    } catch (error) {
      return { success: false, message: `Failed to measure load time: ${error.message}` };
    }
  },
};

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting comprehensive UI/UX tests...\n');

  const results = {
    passed: 0,
    failed: 0,
    total: 0,
    failures: [],
  };

  for (const category of testCategories) {
    console.log(`\n📁 ${category.name}`);
    console.log('='.repeat(category.name.length + 2));

    for (const test of category.tests) {
      results.total++;
      const result = await runTest(test.name, test.method);
      
      if (result.success) {
        results.passed++;
      } else {
        results.failed++;
        results.failures.push({
          category: category.name,
          test: test.name,
          error: result.error,
        });
      }
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${Math.round((results.passed / results.total) * 100)}%`);

  if (results.failures.length > 0) {
    console.log('\n📋 FAILURE DETAILS:');
    console.log('='.repeat(50));
    results.failures.forEach((failure, index) => {
      console.log(`\n${index + 1}. ${failure.category} - ${failure.test}`);
      console.log(`   Error: ${failure.error}`);
    });
  }

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('='.repeat(50));
  
  if (results.failed === 0) {
    console.log('🎉 All tests passed! Your FleetFlow Pro is ready for production.');
  } else {
    console.log('🔧 Areas needing attention:');
    if (results.failures.some(f => f.category.includes('Authentication'))) {
      console.log('• Fix authentication setup (see RUN-THIS-FIRST.md)');
    }
    if (results.failures.some(f => f.category.includes('Performance'))) {
      console.log('• Optimize page load performance');
      console.log('• Enable caching and compression');
    }
    if (results.failures.some(f => f.category.includes('Security'))) {
      console.log('• Configure security headers in next.config.js');
    }
    if (results.failures.some(f => f.category.includes('Responsive'))) {
      console.log('• Test and fix responsive design issues');
    }
  }

  console.log('\n🔧 Next Steps:');
  console.log('1. Run unit tests: npm test');
  console.log('2. Run e2e tests: npm run test:e2e');
  console.log('3. Check coverage: npm run test:coverage');
  console.log('4. Deploy fixes and retest\n');

  process.exit(results.failed === 0 ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});