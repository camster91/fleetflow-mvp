// Test basic functionality of FleetFlow
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== Testing FleetFlow Basic Functions ===\n');

// Check 1: Database models exist
console.log('1. Checking database models...');
const prismaSchema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
const requiredModels = ['Vehicle', 'Delivery', 'MaintenanceTask', 'Client', 'SOPCategory'];
const missingModels = requiredModels.filter(model => !prismaSchema.includes(`model ${model}`));
if (missingModels.length > 0) {
  console.log(`❌ Missing database models: ${missingModels.join(', ')}`);
} else {
  console.log('✅ All required database models exist');
}

// Check 2: API routes exist
console.log('\n2. Checking API routes...');
const apiDir = path.join(__dirname, '../pages/api');
const requiredApiEndpoints = ['vehicles', 'deliveries', 'maintenance', 'clients'];
const missingEndpoints = [];

requiredApiEndpoints.forEach(endpoint => {
  const endpointPath = path.join(apiDir, endpoint);
  if (!fs.existsSync(endpointPath) && !fs.existsSync(`${endpointPath}.ts`) && !fs.existsSync(`${endpointPath}.js`)) {
    missingEndpoints.push(endpoint);
  }
});

if (missingEndpoints.length > 0) {
  console.log(`❌ Missing API endpoints: ${missingEndpoints.join(', ')}`);
} else {
  console.log('✅ All required API endpoints exist');
}

// Check 3: DataService uses localStorage
console.log('\n3. Checking data storage...');
const dataService = fs.readFileSync(path.join(__dirname, '../services/dataService.ts'), 'utf8');
if (dataService.includes('localStorage')) {
  console.log('⚠️  DataService uses localStorage (not suitable for production)');
} else {
  console.log('✅ DataService does not use localStorage');
}

// Check 4: Basic pages exist
console.log('\n4. Checking page structure...');
const requiredPages = ['dashboard.tsx', 'vehicles/index.tsx', 'deliveries/index.tsx', 'maintenance/index.tsx', 'team/index.tsx'];
const missingPages = [];

requiredPages.forEach(page => {
  const pagePath = path.join(__dirname, '../pages', page);
  if (!fs.existsSync(pagePath)) {
    missingPages.push(page);
  }
});

if (missingPages.length > 0) {
  console.log(`❌ Missing pages: ${missingPages.join(', ')}`);
} else {
  console.log('✅ All required pages exist');
}

// Check 5: Check if components are connected to backend
console.log('\n5. Checking component-backend integration...');
const vehicleFormModal = fs.readFileSync(path.join(__dirname, '../components/VehicleFormModal.tsx'), 'utf8');
if (vehicleFormModal.includes('dataService.addVehicle') || vehicleFormModal.includes('localStorage')) {
  console.log('⚠️  VehicleFormModal uses client-side dataService');
} else if (vehicleFormModal.includes('fetch') || vehicleFormModal.includes('axios')) {
  console.log('✅ VehicleFormModal uses API calls');
} else {
  console.log('❓ Cannot determine how VehicleFormModal saves data');
}

// Summary
console.log('\n=== SUMMARY ===');
console.log('\nCritical Issues:');
console.log('1. Core business data (vehicles, deliveries, etc.) is stored in localStorage');
console.log('2. No database models for core business objects');
console.log('3. No API routes for core business objects');
console.log('4. No persistent storage between sessions');
console.log('5. No multi-user data sharing');

console.log('\nRecommended Actions:');
console.log('1. Add Vehicle, Delivery, MaintenanceTask, Client models to Prisma schema');
console.log('2. Create API routes for each model');
console.log('3. Update dataService.ts to use API calls instead of localStorage');
console.log('4. Add proper error handling and loading states');
console.log('5. Implement real-time updates for team collaboration');