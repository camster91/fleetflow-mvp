// Test the data sync functionality
const fs = require('fs');
const path = require('path');

console.log('Testing data sync setup...\n');

// Check if files exist
const files = [
  'prisma/schema.prisma',
  'pages/api/user-data.ts',
  'services/dataSync.ts',
  'services/dataServiceWithSync.ts'
];

let allExist = true;
files.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, '..', file));
  console.log(`${exists ? '✓' : '✗'} ${file}`);
  if (!exists) allExist = false;
});

console.log('\nChecking for UserData model in schema...');
const schema = fs.readFileSync(path.join(__dirname, '..', 'prisma/schema.prisma'), 'utf8');
if (schema.includes('model UserData')) {
  console.log('✓ UserData model found in schema');
} else {
  console.log('✗ UserData model NOT found in schema');
  allExist = false;
}

console.log('\nChecking API route...');
const apiRoute = fs.readFileSync(path.join(__dirname, '..', 'pages/api/user-data.ts'), 'utf8');
if (apiRoute.includes('GET - Retrieve user data')) {
  console.log('✓ API route looks good');
} else {
  console.log('✗ API route may have issues');
}

console.log('\nChecking imports in dashboard...');
const dashboard = fs.readFileSync(path.join(__dirname, '..', 'pages/dashboard.tsx'), 'utf8');
if (dashboard.includes("from '../services/dataServiceWithSync'")) {
  console.log('✓ Dashboard imports dataServiceWithSync');
} else {
  console.log('✗ Dashboard does not import dataServiceWithSync');
  allExist = false;
}

console.log('\n' + (allExist ? 'All checks passed! Sync system is set up.' : 'Some checks failed.'));

if (allExist) {
  console.log('\nNext steps:');
  console.log('1. Run prisma generate locally: npx prisma generate');
  console.log('2. Run prisma db push locally: npx prisma db push');
  console.log('3. Deploy changes to production');
  console.log('4. Run prisma db push on production database');
}