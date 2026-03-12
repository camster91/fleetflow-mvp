#!/bin/bash
set -e

# FleetFlow Production Login Fix Script
# This script fixes the login issues on the production server

SERVER="root@187.77.26.99"
SSH_KEY="$HOME/.ssh/hostinger"
CONTAINER_ID="20dde95a5e74"

echo "🚀 FleetFlow Production Login Fix"
echo "=================================="
echo ""

# Step 1: Verify database has admin user
echo "1️⃣ Checking database for admin user..."
ssh -i "$SSH_KEY" "$SERVER" << 'REMOTESSH'
# Check if admin user exists
sqlite3 /var/lib/docker/volumes/*/data/fleet.db "SELECT email, role, emailVerified FROM User WHERE email='admin@fleetflow.com';" 2>/dev/null || \
sqlite3 /app/data/fleet.db "SELECT email, role, emailVerified FROM User WHERE email='admin@fleetflow.com';" 2>/dev/null || \
docker exec 20dde95a5e74 sh -c "cat /app/data/fleet.db" > /tmp/fleet_check.db 2>/dev/null && sqlite3 /tmp/fleet_check.db "SELECT email, role, emailVerified FROM User WHERE email='admin@fleetflow.com';" 2>/dev/null || echo "DB_CHECK_FAILED"
REMOTESSH

echo ""
echo "2️⃣ Creating admin user if needed..."

# Copy and run the create-admin script
scp -i "$SSH_KEY" "$(dirname "$0")/create-admin.js" "$SERVER:/tmp/create-admin.js"

ssh -i "$SSH_KEY" "$SERVER" << 'REMOTESSH'
docker cp /tmp/create-admin.js 20dde95a5e74:/tmp/create-admin.js
docker exec 20dde95a5e74 node /tmp/create-admin.js || echo "Admin script failed - may need to check manually"
REMOTESSH

echo ""
echo "3️⃣ Environment Variable Check:"
echo "   The following variables need to be fixed in Coolify:"
echo ""
echo "   ❌ CURRENT (BROKEN):"
echo "      HOST=0.0.0.0NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=false"
echo ""
echo "   ✅ SHOULD BE SEPARATE:"
echo "      HOST=0.0.0.0"
echo "      NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=false"
echo ""

echo "🔧 CRITICAL: You must fix the environment variables in Coolify:"
echo ""
echo "   1. Go to https://your-coolify-dashboard.com"
echo "   2. Navigate to: Projects → github-projects → fleetflow-mvp"
echo "   3. Click on 'Environment Variables'"
echo "   4. Find and DELETE this broken variable:"
echo "      HOST=0.0.0.0NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=false"
echo ""
echo "   5. Add these SEPARATE variables:"
echo "      HOST=0.0.0.0"
echo "      NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=false"
echo "      NEXTAUTH_URL=https://fleet.ashbi.ca"
echo "      NEXTAUTH_SECRET=bxtmgQH5jEKCBHMq58Gtcm/hDTJZlaLIfZv7ad6vm4Q="
echo "      DATABASE_URL=file:/app/data/fleet.db"
echo ""
echo "   6. Click 'Save' and wait for redeployment (2-3 minutes)"
echo ""

echo "4️⃣ Testing login after fix..."
echo "   URL: https://fleet.ashbi.ca/auth/login"
echo "   Email: admin@fleetflow.com"
echo "   Password: admin123"
echo ""

echo "⚠️  IMPORTANT NOTES:"
echo "   - The login page uses NextAuth.js with credentials provider"
echo "   - The app uses JWT sessions stored in cookies"
echo "   - Make sure cookies are not blocked in your browser"
echo "   - Try clearing browser cookies for fleet.ashbi.ca if login fails"
echo ""

echo "✅ Fix script complete!"
echo ""
echo "📋 NEXT STEPS:"
echo "   1. Fix environment variables in Coolify (CRITICAL)"
echo "   2. Wait for redeployment"
echo "   3. Clear browser cookies for fleet.ashbi.ca"
echo "   4. Try logging in with admin@fleetflow.com / admin123"
echo "   5. If still failing, check Coolify deployment logs"
echo ""
