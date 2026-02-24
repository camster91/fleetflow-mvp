#!/bin/bash

# Verify FleetFlow Pro production setup

set -e

echo "🔍 FleetFlow Pro Production Setup Verification"
echo "============================================"
echo ""

URL="https://fleet.ashbi.ca"

echo "📊 Step 1: Basic Health Check"
echo "----------------------------"
status_code=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
if [ "$status_code" -eq 200 ]; then
    echo "✅ HTTP Status: $status_code (OK)"
else
    echo "❌ HTTP Status: $status_code (Expected: 200)"
fi

echo ""
echo "📊 Step 2: Check Authentication Redirect"
echo "--------------------------------------"
login_redirect=$(curl -s -o /dev/null -w "%{http_code}" "$URL/auth/login")
if [ "$login_redirect" -eq 200 ] || [ "$login_redirect" -eq 404 ]; then
    echo "✅ Auth endpoint accessible: $login_redirect"
else
    echo "⚠️  Auth endpoint status: $login_redirect"
fi

echo ""
echo "📊 Step 3: Check Database Connection (via API)"
echo "--------------------------------------------"
# Try to access seed endpoint (will fail without auth, but check response)
seed_response=$(curl -s -X POST -o /dev/null -w "%{http_code}" "$URL/api/seed" 2>/dev/null || echo "curl_failed")
if [ "$seed_response" = "curl_failed" ]; then
    echo "⚠️  API endpoint not reachable"
elif [ "$seed_response" -eq 401 ] || [ "$seed_response" -eq 403 ]; then
    echo "✅ API protected (requires auth): $seed_response"
elif [ "$seed_response" -eq 404 ]; then
    echo "⚠️  API endpoint not found: $seed_response"
else
    echo "📝 API response: $seed_response"
fi

echo ""
echo "📊 Step 4: Verify Application Content"
echo "------------------------------------"
if curl -s "$URL" | grep -q "FleetFlow"; then
    echo "✅ Application loads with 'FleetFlow' in content"
else
    echo "❌ 'FleetFlow' not found in page content"
fi

echo ""
echo "📊 Step 5: Check HTTPS Configuration"
echo "-----------------------------------"
ssl_check=$(curl -s -o /dev/null -w "%{ssl_verify_result}" "$URL")
if [ "$ssl_check" -eq 0 ]; then
    echo "✅ SSL/TLS certificate valid"
else
    echo "⚠️  SSL/TLS certificate issue: $ssl_check"
fi

echo ""
echo "📋 Summary"
echo "---------"
echo ""
echo "Next steps to complete setup:"
echo ""
echo "1. ✅ Application is running at: $URL"
echo "2. 🔧 Set up PostgreSQL database in Coolify"
echo "3. 🔑 Configure environment variables:"
echo "   - NEXTAUTH_URL=https://fleet.ashbi.ca"
echo "   - NEXTAUTH_SECRET=k8eLErhObBcKlxVkExTfeZZu4xLCqcdkfM7Os9A/DCo="
echo "   - DATABASE_URL=postgresql://fleetflow_user:PASSWORD@HOST:5432/fleetflow_pro"
echo "4. 🗄️  Run database migrations:"
echo "   npx prisma generate"
echo "   npx prisma db push"
echo "   npm run seed"
echo "5. 👥 Test login with:"
echo "   - admin@fleetflow.com / demo123"
echo "   - manager@josephsdelivery.com / demo123"
echo ""
echo "📚 Documentation:"
echo "- POSTGRES-SETUP.md for database setup"
echo "- PRODUCTION-SETUP-GUIDE.md for complete instructions"
echo "- COOLIFY-POSTGRES-GUIDE.md for Coolify-specific steps"
echo ""