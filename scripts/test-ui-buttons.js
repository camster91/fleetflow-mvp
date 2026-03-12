#!/usr/bin/env node

/**
 * Test UI Buttons and Features
 * Checks that key UI elements exist and are functional
 */

const https = require('https');

const APP_URL = process.env.TEST_URL || 'https://fleet.ashbi.ca';

console.log('🔍 Testing UI Buttons and Features');
console.log('==================================');
console.log(`App URL: ${APP_URL}\n`);

async function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET' }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data,
          url
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.end();
  });
}

function checkElementExists(html, elementName, searchText) {
  const lowerHtml = html.toLowerCase();
  const lowerSearch = searchText.toLowerCase();
  
  // Check for button text
  if (lowerHtml.includes(lowerSearch)) {
    return {
      exists: true,
      message: `Found "${searchText}"`
    };
  }
  
  // Check for common button patterns
  const buttonPatterns = [
    `<button[^>]*>${searchText}</button>`,
    `"${searchText}"`,
    `'${searchText}'`,
    `>${searchText}<`
  ];
  
  for (const pattern of buttonPatterns) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(html)) {
      return {
        exists: true,
        message: `Found "${searchText}" in button/clickable element`
      };
    }
  }
  
  return {
    exists: false,
    message: `"${searchText}" not found`
  };
}

async function runTests() {
  const tests = [];
  
  // Test 1: Dashboard page
  console.log('📋 Testing Dashboard Page...');
  try {
    const dashboard = await fetchPage(`${APP_URL}/dashboard`);
    
    if (dashboard.statusCode === 200) {
      const buttonChecks = [
        'Add Vehicle',
        'Schedule Delivery', 
        'Create Maintenance',
        'Send Announcement',
        'Refresh',
        'Search',
        'Overview',
        'Vehicles',
        'Deliveries',
        'Maintenance',
        'SOP Library',
        'Clients',
        'Reports'
      ];
      
      for (const buttonText of buttonChecks) {
        const result = checkElementExists(dashboard.body, `Button: ${buttonText}`, buttonText);
        tests.push({
          name: `Button: ${buttonText}`,
          success: result.exists,
          message: result.message
        });
        
        const icon = result.exists ? '✅' : '❌';
        console.log(`   ${icon} ${buttonText}: ${result.message}`);
      }
      
      // Check for stats cards
      const statChecks = [
        'Total Vehicles',
        'Active Deliveries', 
        'Maintenance Due',
        'Pending SOPs'
      ];
      
      console.log('\n📊 Checking Stats Cards...');
      for (const statText of statChecks) {
        const result = checkElementExists(dashboard.body, `Stat: ${statText}`, statText);
        tests.push({
          name: `Stat Card: ${statText}`,
          success: result.exists,
          message: result.message
        });
        
        const icon = result.exists ? '✅' : '❌';
        console.log(`   ${icon} ${statText}: ${result.message}`);
      }
    } else {
      console.log(`   ❌ Dashboard returned HTTP ${dashboard.statusCode}`);
      tests.push({
        name: 'Dashboard Load',
        success: false,
        message: `HTTP ${dashboard.statusCode}`
      });
    }
  } catch (error) {
    console.log(`   ❌ Error fetching dashboard: ${error.message}`);
    tests.push({
      name: 'Dashboard Load',
      success: false,
      message: error.message
    });
  }
  
  // Test 2: Login page
  console.log('\n🔐 Testing Login Page...');
  try {
    const login = await fetchPage(`${APP_URL}/auth/login`);
    
    if (login.statusCode === 200) {
      const loginChecks = [
        'Email',
        'Password',
        'Login',
        'Create Account',
        'Forgot Password'
      ];
      
      for (const elementText of loginChecks) {
        const result = checkElementExists(login.body, `Login: ${elementText}`, elementText);
        tests.push({
          name: `Login Page: ${elementText}`,
          success: result.exists,
          message: result.message
        });
        
        const icon = result.exists ? '✅' : '❌';
        console.log(`   ${icon} ${elementText}: ${result.message}`);
      }
    } else {
      console.log(`   ❌ Login page returned HTTP ${login.statusCode}`);
      tests.push({
        name: 'Login Page Load',
        success: false,
        message: `HTTP ${login.statusCode}`
      });
    }
  } catch (error) {
    console.log(`   ❌ Error fetching login page: ${error.message}`);
  }
  
  // Test 3: Registration page
  console.log('\n📝 Testing Registration Page...');
  try {
    const register = await fetchPage(`${APP_URL}/auth/register`);
    
    if (register.statusCode === 200) {
      const registerChecks = [
        'Name',
        'Email',
        'Password',
        'Confirm Password',
        'Create Account',
        'Already have an account'
      ];
      
      for (const elementText of registerChecks) {
        const result = checkElementExists(register.body, `Register: ${elementText}`, elementText);
        tests.push({
          name: `Register Page: ${elementText}`,
          success: result.exists,
          message: result.message
        });
        
        const icon = result.exists ? '✅' : '❌';
        console.log(`   ${icon} ${elementText}: ${result.message}`);
      }
    } else {
      console.log(`   ❌ Registration page returned HTTP ${register.statusCode}`);
    }
  } catch (error) {
    console.log(`   ❌ Error fetching registration page: ${error.message}`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 UI ELEMENTS TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = tests.filter(t => t.success).length;
  const failed = tests.filter(t => !t.success).length;
  const total = tests.length;
  
  console.log(`Total Elements Checked: ${total}`);
  console.log(`✅ Found: ${passed}`);
  console.log(`❌ Missing: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / total) * 100)}%\n`);
  
  if (failed > 0) {
    console.log('📋 MISSING ELEMENTS:');
    console.log('='.repeat(60));
    tests
      .filter(t => !t.success)
      .forEach((test, index) => {
        console.log(`${index + 1}. ${test.name}`);
        console.log(`   ${test.message}`);
      });
  }
  
  // Feature status
  console.log('\n🎯 FEATURE STATUS:');
  console.log('='.repeat(60));
  
  const featureCategories = [
    {
      name: 'Dashboard Core',
      elements: tests.filter(t => 
        t.name.includes('Button:') && 
        ['Add Vehicle', 'Schedule Delivery', 'Refresh', 'Search'].some(b => t.name.includes(b))
      )
    },
    {
      name: 'Navigation Tabs',
      elements: tests.filter(t => 
        t.name.includes('Button:') && 
        ['Overview', 'Vehicles', 'Deliveries', 'Maintenance', 'SOP Library', 'Clients', 'Reports'].some(b => t.name.includes(b))
      )
    },
    {
      name: 'Authentication',
      elements: tests.filter(t => t.name.includes('Login Page:') || t.name.includes('Register Page:'))
    },
    {
      name: 'Stats Display',
      elements: tests.filter(t => t.name.includes('Stat Card:'))
    }
  ];
  
  for (const category of featureCategories) {
    const categoryPassed = category.elements.filter(e => e.success).length;
    const categoryTotal = category.elements.length;
    
    if (categoryTotal > 0) {
      const percentage = Math.round((categoryPassed / categoryTotal) * 100);
      const status = percentage >= 80 ? '✅' : percentage >= 50 ? '⚠️' : '❌';
      console.log(`${status} ${category.name}: ${categoryPassed}/${categoryTotal} (${percentage}%)`);
    }
  }
  
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('='.repeat(60));
  
  if (passed / total >= 0.8) {
    console.log('✅ Most UI elements are present. Proceed with manual functional testing.');
  } else {
    console.log('🔧 Some UI elements are missing. Check:');
    console.log('   • Component rendering logic');
    console.log('   • Authentication state management');
    console.log('   • Data loading conditions');
  }
  
  console.log('\n🎯 NEXT STEPS FOR MANUAL TESTING:');
  console.log('='.repeat(60));
  console.log('1. Click each button to verify functionality');
  console.log('2. Test form submissions with valid/invalid data');
  console.log('3. Verify modals open and close correctly');
  console.log('4. Test tab navigation between sections');
  console.log('5. Check responsive behavior on different devices');
  console.log('6. Verify notifications appear for user actions');
  console.log('7. Test data persistence (add, edit, delete items)');
  console.log('8. Validate search and filter functionality');
  
  // Save results
  const report = {
    appUrl: APP_URL,
    timestamp: new Date().toISOString(),
    summary: {
      total,
      passed,
      failed,
      successRate: Math.round((passed / total) * 100)
    },
    tests,
    recommendations: passed / total >= 0.8 ? 
      'UI elements mostly present. Proceed with manual functional testing.' :
      'Some UI elements missing. Investigate rendering issues.'
  };
  
  const fs = require('fs');
  const reportFile = `ui-elements-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 Detailed report saved to: ${reportFile}`);
  
  process.exit(failed > total * 0.3 ? 1 : 0); // Fail if more than 30% missing
}

runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});