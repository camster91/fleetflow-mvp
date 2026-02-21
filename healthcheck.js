#!/usr/bin/env node

/**
 * Health check script for FleetFlow Pro
 * Run this after deployment to verify the application is working
 * 
 * Usage: node healthcheck.js [url]
 * Default URL: http://localhost:3000
 */

const http = require('http');
const https = require('https');

const DEFAULT_URL = 'http://localhost:3000';
const TIMEOUT = 10000; // 10 seconds
const RETRIES = 3;

async function checkHealth(url, retryCount = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error(`Timeout after ${TIMEOUT}ms`));
    }, TIMEOUT);

    const req = client.get(url, (res) => {
      clearTimeout(timeout);
      
      const statusCode = res.statusCode;
      const contentType = res.headers['content-type'] || '';
      
      // Read response body (limited to first 1KB)
      let data = '';
      res.on('data', chunk => {
        if (data.length < 1024) {
          data += chunk.toString();
        }
      });
      
      res.on('end', () => {
        const checks = {
          statusCode: statusCode === 200 || statusCode === 304,
          contentType: contentType.includes('text/html') || contentType.includes('application/json'),
          hasFleetFlow: data.includes('FleetFlow') || data.includes('fleetflow'),
          hasReact: data.includes('__NEXT_DATA__') || data.includes('React'),
        };

        const passed = Object.values(checks).filter(Boolean).length;
        const total = Object.keys(checks).length;

        resolve({
          url,
          statusCode,
          contentType,
          checks,
          passed,
          total,
          dataPreview: data.substring(0, 200) + (data.length > 200 ? '...' : ''),
        });
      });
    });

    req.on('error', (err) => {
      clearTimeout(timeout);
      
      if (retryCount < RETRIES) {
        console.log(`Retry ${retryCount + 1}/${RETRIES} for ${url}`);
        setTimeout(() => {
          checkHealth(url, retryCount + 1)
            .then(resolve)
            .catch(reject);
        }, 1000);
      } else {
        reject(err);
      }
    });
  });
}

async function main() {
  const url = process.argv[2] || DEFAULT_URL;
  
  console.log('🔍 FleetFlow Pro Health Check');
  console.log('=============================\n');
  console.log(`Target: ${url}`);
  console.log(`Timeout: ${TIMEOUT}ms`);
  console.log(`Retries: ${RETRIES}`);
  console.log('');
  
  try {
    const startTime = Date.now();
    const result = await checkHealth(url);
    const responseTime = Date.now() - startTime;

    console.log('📊 Health Check Results:');
    console.log('────────────────────────');
    console.log(`Status Code: ${result.statusCode} ${result.statusCode === 200 ? '✅' : '❌'}`);
    console.log(`Content Type: ${result.contentType} ${result.checks.contentType ? '✅' : '❌'}`);
    console.log(`Contains "FleetFlow": ${result.checks.hasFleetFlow ? '✅' : '⚠️'}`);
    console.log(`React/Next.js detected: ${result.checks.hasReact ? '✅' : '⚠️'}`);
    console.log(`Response Time: ${responseTime}ms`);
    console.log('');
    console.log(`Passed: ${result.passed}/${result.total} checks`);
    console.log('');
    
    if (result.passed >= 2) {
      console.log('🎉 Application is healthy!');
      console.log('');
      console.log('Quick verification:');
      console.log(`  curl -I ${url}`);
      console.log(`  curl ${url} | grep -i "fleetflow" | head -1`);
      console.log('');
      console.log('Next steps:');
      console.log('  1. Test the dashboard at:', url);
      console.log('  2. Check vehicle filtering');
      console.log('  3. Test announcement modal');
      console.log('  4. Verify mobile responsiveness');
      process.exit(0);
    } else {
      console.log('⚠️  Application may have issues.');
      console.log('');
      console.log('Troubleshooting:');
      console.log('  1. Check if the server is running');
      console.log('  2. Verify port configuration');
      console.log('  3. Check application logs');
      console.log('  4. Review deployment configuration');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    console.log('');
    console.log('Troubleshooting steps:');
    console.log('  1. Verify the application is running:');
    console.log(`     docker ps | grep fleetflow`);
    console.log('  2. Check application logs:');
    console.log(`     docker logs <container_name>`);
    console.log('  3. Verify network connectivity:');
    console.log(`     curl -v ${url}`);
    console.log('  4. Review deployment configuration');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkHealth };