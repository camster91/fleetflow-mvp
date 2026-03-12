#!/bin/bash
set -e

# FleetFlow Supabase Auth Deployment Script
# This script deploys the Supabase Auth integration to production

SERVER="root@187.77.26.99"
SSH_KEY="$HOME/.ssh/hostinger"
CONTAINER_ID="20dde95a5e74"
REMOTE_TMP="/tmp/fleetflow-supabase-auth"

echo "🚀 Deploying FleetFlow Supabase Auth Integration"
echo "================================================="
echo ""

# Create local temporary directory
echo "📦 Preparing deployment files..."
LOCAL_TMP=$(mktemp -d)
cd "$LOCAL_TMP"

# Create directory structure
mkdir -p context pages/auth pages/api/auth lib middleware

# Copy files
cp "/c/Users/camst/fleetflow-mvp/context/SupabaseAuthContext.tsx" context/
cp "/c/Users/camst/fleetflow-mvp/pages/_app.tsx" pages/
cp "/c/Users/camst/fleetflow-mvp/pages/auth/login.tsx" pages/auth/
cp "/c/Users/camst/fleetflow-mvp/pages/auth/register.tsx" pages/auth/
cp "/c/Users/camst/fleetflow-mvp/pages/auth/forgot-password.tsx" pages/auth/
cp "/c/Users/camst/fleetflow-mvp/pages/auth/callback.tsx" pages/auth/
cp "/c/Users/camst/fleetflow-mvp/middleware.ts" ./
cp "/c/Users/camst/fleetflow-mvp/lib/supabase.ts" lib/

# Copy reset-password directory
mkdir -p "pages/auth/reset-password"
cp "/c/Users/camst/fleetflow-mvp/pages/auth/reset-password/[token].tsx" "pages/auth/reset-password/"

# Copy dashboard update
cp "/c/Users/camst/fleetflow-mvp/pages/dashboard.tsx" pages/

echo "📁 Creating deployment archive..."
tar czf supabase-auth.tar.gz context pages lib middleware.ts

echo "📤 Uploading to server..."
scp -i "$SSH_KEY" supabase-auth.tar.gz "$SERVER:$REMOTE_TMP.tar.gz"

echo "🔧 Deploying to container..."
ssh -i "$SSH_KEY" "$SERVER" << EOF
set -e

echo "Extracting files..."
mkdir -p $REMOTE_TMP
tar xzf $REMOTE_TMP.tar.gz -C $REMOTE_TMP

echo "Creating directories in container..."
docker exec -u 0 $CONTAINER_ID mkdir -p /app/context /app/pages/auth/reset-password /app/lib

echo "Copying new files to container..."
docker cp $REMOTE_TMP/context/SupabaseAuthContext.tsx $CONTAINER_ID:/app/context/
docker cp $REMOTE_TMP/pages/_app.tsx $CONTAINER_ID:/app/pages/
docker cp $REMOTE_TMP/pages/auth/login.tsx $CONTAINER_ID:/app/pages/auth/
docker cp $REMOTE_TMP/pages/auth/register.tsx $CONTAINER_ID:/app/pages/auth/
docker cp $REMOTE_TMP/pages/auth/forgot-password.tsx $CONTAINER_ID:/app/pages/auth/
docker cp $REMOTE_TMP/pages/auth/callback.tsx $CONTAINER_ID:/app/pages/auth/
docker cp "$REMOTE_TMP/pages/auth/reset-password/[token].tsx" $CONTAINER_ID:/app/pages/auth/reset-password/
docker cp $REMOTE_TMP/lib/supabase.ts $CONTAINER_ID:/app/lib/
docker cp $REMOTE_TMP/middleware.ts $CONTAINER_ID:/app/middleware.ts
docker cp $REMOTE_TMP/pages/dashboard.tsx $CONTAINER_ID:/app/pages/

echo "Setting permissions..."
docker exec -u 0 $CONTAINER_ID chown -R nextjs:nodejs /app/context /app/pages /app/lib /app/middleware.ts 2>/dev/null || true

echo "Restarting container..."
docker restart $CONTAINER_ID

echo "✅ Supabase Auth deployed successfully!"
EOF

echo "🧹 Cleaning up..."
rm -rf "$LOCAL_TMP"

echo ""
echo "🎉 Deployment Complete!"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo ""
echo "1. Configure Supabase Auth in your Supabase Dashboard:"
echo "   - Go to: https://supabase.com/dashboard/project/vmvojkmaiuwidrduiotn"
echo "   - Navigate to Authentication → Settings"
echo "   - Set Site URL to: https://fleet.ashbi.ca"
echo "   - Add redirect URL: https://fleet.ashbi.ca/auth/callback"
echo ""
echo "2. Configure Email Templates (optional):"
echo "   - Go to Authentication → Email Templates"
echo "   - Customize confirmation and reset password emails"
echo ""
echo "3. Update Environment Variables in Coolify:"
echo "   Remove these (no longer needed):"
echo "   - NEXTAUTH_URL"
echo "   - NEXTAUTH_SECRET"
echo ""
echo "   Keep these (already set):"
echo "   - NEXT_PUBLIC_SUPABASE_URL"
echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "   - SUPABASE_SERVICE_ROLE_KEY"
echo ""
echo "4. Test the login:"
echo "   - Visit: https://fleet.ashbi.ca/auth/login"
echo "   - Create a new account to test registration"
echo "   - Check your email for verification"
echo ""
echo "5. To migrate existing users:"
echo "   - Run: node scripts/migrate-users-to-supabase.js"
echo "   - Or have users reset their passwords"
echo ""
echo "📚 Supabase Auth Documentation:"
echo "   https://supabase.com/docs/guides/auth"
echo ""
