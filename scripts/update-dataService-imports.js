const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'components/ClientDetailModal.tsx',
  'components/ClientFormModal.tsx',
  'components/DeliveryFormModal.tsx',
  'components/MaintenanceTaskFormModal.tsx',
  'components/role-dashboards/DispatchDashboard.tsx',
  'components/SOPCategoryFormModal.tsx',
  'components/VehicleFormModal.tsx',
  'components/VendingMachineDetailModal.tsx',
  'components/VendingMachineFormModal.tsx',
  'pages/deliveries/index.tsx',
  'pages/maintenance/index.tsx',
  'pages/vehicles/index.tsx',
  '__tests__/pages/dashboard.test.tsx',
  '__tests__/services/dataService.test.ts'
];

filesToUpdate.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Replace imports
  content = content.replace(
    /import \* as dataService from ['"]\.\.\/services\/dataService['"]/g,
    'import * as dataService from \'../services/dataServiceWithSync\''
  );
  
  content = content.replace(
    /import \* as dataService from ['"]\.\.\/\.\.\/services\/dataService['"]/g,
    'import * as dataService from \'../../services/dataServiceWithSync\''
  );
  
  content = content.replace(
    /import \* as dataService from ['"]\.\.\/\.\.\/\.\.\/services\/dataService['"]/g,
    'import * as dataService from \'../../../services/dataServiceWithSync\''
  );
  
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Updated: ${filePath}`);
});

console.log('\nAll imports updated!');
console.log('\nNote: Test files may need additional updates to mock the new sync functionality.');