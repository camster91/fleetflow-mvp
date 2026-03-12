#!/bin/bash
set -e

# Configuration - same as deploy-fixes.sh
SERVER="root@187.77.26.99"
SSH_KEY="$HOME/.ssh/hostinger"
CONTAINER_ID="20dde95a5e74"
REMOTE_TMP="/tmp/fleetflow-auth-fix"

echo "🚀 Starting FleetFlow Authentication Fix Deployment"
echo "=================================================="

echo "Creating local temporary directory..."
LOCAL_TMP=$(mktemp -d)
cd "$LOCAL_TMP"

echo "📦 Copying authentication files..."
# Copy all authentication files
mkdir -p lib pages/auth pages/api/auth types
cp "/c/Users/camst/fleetflow-mvp/lib/auth.ts" lib/
cp "/c/Users/camst/fleetflow-mvp/pages/auth/login.tsx" pages/auth/
cp "/c/Users/camst/fleetflow-mvp/pages/api/auth/[...nextauth].ts" "pages/api/auth/[...nextauth].ts"
cp "/c/Users/camst/fleetflow-mvp/types/next-auth.d.ts" types/

# Also copy the updated login API file (optional)
cp "/c/Users/camst/fleetflow-mvp/pages/api/auth/login.ts" pages/api/auth/

echo "📁 Creating archive..."
tar czf auth-fix.tar.gz lib pages types

echo "📤 Uploading to server..."
scp -i "$SSH_KEY" auth-fix.tar.gz "$SERVER:$REMOTE_TMP.tar.gz"

echo "🔧 Applying fixes inside container..."
ssh -i "$SSH_KEY" "$SERVER" << EOF
set -e
echo "Extracting files..."
mkdir -p $REMOTE_TMP
tar xzf $REMOTE_TMP.tar.gz -C $REMOTE_TMP

echo "Copying files to container..."
docker cp $REMOTE_TMP/lib/auth.ts $CONTAINER_ID:/app/lib/auth.ts
docker cp $REMOTE_TMP/pages/auth/login.tsx $CONTAINER_ID:/app/pages/auth/login.tsx
docker cp "$REMOTE_TMP/pages/api/auth/[...nextauth].ts" $CONTAINER_ID:/app/pages/api/auth/[...nextauth].ts
docker cp $REMOTE_TMP/types/next-auth.d.ts $CONTAINER_ID:/app/types/next-auth.d.ts
docker cp $REMOTE_TMP/pages/api/auth/login.ts $CONTAINER_ID:/app/pages/api/auth/login.ts

echo "Restarting container..."
docker restart $CONTAINER_ID

echo "✅ Authentication fixes applied and container restarted."
echo ""
echo "⚠️  IMPORTANT: Add these environment variables to Coolify:"
echo "   NEXTAUTH_URL=https://fleet.ashbi.ca"
echo "   NEXTAUTH_SECRET=bxtmgQH5jEKCBHMq58Gtcm/hDTJZlaLIfZv7ad6vm4Q="
echo ""
echo "📝 After adding variables, wait 2-3 minutes for app to restart."
EOF

echo "🧹 Cleaning up..."
rm -rf "$LOCAL_TMP"

echo ""
echo "🎉 Authentication deployment complete!"
echo "👉 Next steps:"
echo "   1. Go to Coolify Dashboard → fleetflow-pro → Environment Variables"
echo "   2. Add NEXTAUTH_URL and NEXTAUTH_SECRET"
echo "   3. Wait for auto-redeploy (2-3 minutes)"
echo "   4. Test login at https://fleet.ashbi.ca/auth/login"
echo "   5. Create test user with: node create-test-user.js"