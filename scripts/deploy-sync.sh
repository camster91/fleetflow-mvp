#!/bin/bash
set -e

# Configuration
SERVER="root@187.77.26.99"
SSH_KEY="$HOME/.ssh/hostinger"
CONTAINER_ID="401d41ad0530"  # Update if different
REMOTE_TMP="/tmp/fleetflow-sync-$(date +%s)"

echo "=== Deploying Data Sync System ==="
echo

# Create local temporary directory
echo "Creating local temporary directory..."
LOCAL_TMP=$(mktemp -d)
cd "$LOCAL_TMP"

# Copy all necessary files
echo "Copying files to temporary directory..."
mkdir -p prisma pages/api services components pages __tests__/pages __tests__/services scripts

# Prisma schema
cp "/c/Users/camst/fleetflow-mvp/prisma/schema.prisma" prisma/

# API routes
cp "/c/Users/camst/fleetflow-mvp/pages/api/user-data.ts" pages/api/

# Services
cp "/c/Users/camst/fleetflow-mvp/services/dataSync.ts" services/
cp "/c/Users/camst/fleetflow-mvp/services/dataServiceWithSync.ts" services/

# Components with updated imports (all that were updated)
cp "/c/Users/camst/fleetflow-mvp/components/ClientDetailModal.tsx" components/
cp "/c/Users/camst/fleetflow-mvp/components/ClientFormModal.tsx" components/
cp "/c/Users/camst/fleetflow-mvp/components/DeliveryFormModal.tsx" components/
cp "/c/Users/camst/fleetflow-mvp/components/MaintenanceTaskFormModal.tsx" components/
cp "/c/Users/camst/fleetflow-mvp/components/role-dashboards/DispatchDashboard.tsx" components/role-dashboards/
cp "/c/Users/camst/fleetflow-mvp/components/SOPCategoryFormModal.tsx" components/
cp "/c/Users/camst/fleetflow-mvp/components/VehicleFormModal.tsx" components/
cp "/c/Users/camst/fleetflow-mvp/components/VendingMachineDetailModal.tsx" components/
cp "/c/Users/camst/fleetflow-mvp/components/VendingMachineFormModal.tsx" components/

# Pages with updated imports
cp "/c/Users/camst/fleetflow-mvp/pages/dashboard.tsx" pages/
cp "/c/Users/camst/fleetflow-mvp/pages/deliveries/index.tsx" pages/deliveries/
cp "/c/Users/camst/fleetflow-mvp/pages/maintenance/index.tsx" pages/maintenance/
cp "/c/Users/camst/fleetflow-mvp/pages/vehicles/index.tsx" pages/vehicles/

# Test files (optional)
cp "/c/Users/camst/fleetflow-mvp/__tests__/pages/dashboard.test.tsx" __tests__/pages/
cp "/c/Users/camst/fleetflow-mvp/__tests__/services/dataService.test.ts" __tests__/services/

# Scripts
cp "/c/Users/camst/fleetflow-mvp/scripts/update-dataService-imports.js" scripts/

# Create tar
echo "Creating archive..."
tar czf sync-update.tar.gz prisma pages services components __tests__ scripts

echo "Copying files to server..."
scp -i "$SSH_KEY" sync-update.tar.gz "$SERVER:$REMOTE_TMP.tar.gz"

echo "Applying updates inside container..."
ssh -i "$SSH_KEY" "$SERVER" << EOF
set -e
echo "Extracting files..."
mkdir -p $REMOTE_TMP
tar xzf $REMOTE_TMP.tar.gz -C $REMOTE_TMP

echo "Copying files to container..."
# Prisma schema
docker cp $REMOTE_TMP/prisma/schema.prisma $CONTAINER_ID:/app/prisma/schema.prisma

# API routes
docker cp $REMOTE_TMP/pages/api/user-data.ts $CONTAINER_ID:/app/pages/api/user-data.ts

# Services
docker cp $REMOTE_TMP/services/dataSync.ts $CONTAINER_ID:/app/services/dataSync.ts
docker cp $REMOTE_TMP/services/dataServiceWithSync.ts $CONTAINER_ID:/app/services/dataServiceWithSync.ts

# Components (only those that were updated)
for component in ClientDetailModal ClientFormModal DeliveryFormModal MaintenanceTaskFormModal SOPCategoryFormModal VehicleFormModal VendingMachineDetailModal VendingMachineFormModal; do
  docker cp $REMOTE_TMP/components/\${component}.tsx $CONTAINER_ID:/app/components/\${component}.tsx
done
docker cp $REMOTE_TMP/components/role-dashboards/DispatchDashboard.tsx $CONTAINER_ID:/app/components/role-dashboards/DispatchDashboard.tsx

# Pages
docker cp $REMOTE_TMP/pages/dashboard.tsx $CONTAINER_ID:/app/pages/dashboard.tsx
docker cp $REMOTE_TMP/pages/deliveries/index.tsx $CONTAINER_ID:/app/pages/deliveries/index.tsx
docker cp $REMOTE_TMP/pages/maintenance/index.tsx $CONTAINER_ID:/app/pages/maintenance/index.tsx
docker cp $REMOTE_TMP/pages/vehicles/index.tsx $CONTAINER_ID:/app/pages/vehicles/index.tsx

echo "Updating Prisma client and database..."
# Generate Prisma client
docker exec $CONTAINER_ID npx prisma generate

# Push schema changes to database
docker exec $CONTAINER_ID npx prisma db push --skip-generate

echo "Restarting container..."
docker restart $CONTAINER_ID

echo "Waiting for container to restart..."
sleep 5

echo "Verifying container status..."
docker ps --filter "id=$CONTAINER_ID"

echo "Cleaning up..."
rm -rf $REMOTE_TMP $REMOTE_TMP.tar.gz
EOF

echo "Cleaning up local temp directory..."
rm -rf "$LOCAL_TMP"

echo
echo "=== Deployment Complete ==="
echo "Data sync system has been deployed to production."
echo "Users' data will now persist across sessions via the database."
echo "Check the application at https://fleet.ashbi.ca"