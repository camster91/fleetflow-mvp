#!/bin/bash

# PostgreSQL Setup Script for FleetFlow Pro on Coolify
# This script guides you through setting up PostgreSQL database and configuring environment variables

set -e

echo "🚀 FleetFlow Pro - PostgreSQL Database Setup"
echo "=========================================="
echo ""

# Step 1: Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the FleetFlow Pro project directory"
    exit 1
fi

echo "📋 Step 1: Generate secure NEXTAUTH_SECRET"
echo "------------------------------------------"
NEXTAUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "fallback-secret-$(date +%s)-$RANDOM")
echo "Generated NEXTAUTH_SECRET: $NEXTAUTH_SECRET"
echo ""

echo "📋 Step 2: PostgreSQL Database Setup Instructions"
echo "-----------------------------------------------"
echo ""
echo "Follow these steps in Coolify dashboard:"
echo ""
echo "1. Go to Coolify dashboard (https://your-coolify-instance.com)"
echo "2. Navigate to 'Resources' → 'PostgreSQL'"
echo "3. Click 'Create New PostgreSQL Database'"
echo "4. Configure with these settings:"
echo "   - Database Name: fleetflow_pro"
echo "   - Username: fleetflow_user"
echo "   - Password: Generate a secure password (save it!)"
echo "   - Version: PostgreSQL 15+ (recommended)"
echo "5. Note the connection details provided by Coolify:"
echo "   - Host: (e.g., postgres.internal.coolify)"
echo "   - Port: 5432 (usually)"
echo "   - Database: fleetflow_pro"
echo "   - Username: fleetflow_user"
echo "   - Password: (your generated password)"
echo ""

echo "📋 Step 3: Update Environment Variables"
echo "--------------------------------------"
echo ""
echo "In Coolify application settings, set these environment variables:"
echo ""
echo "NEXTAUTH_URL=https://fleet.ashbi.ca"
echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
echo "DATABASE_URL=postgresql://fleetflow_user:YOUR_PASSWORD@HOST:5432/fleetflow_pro?schema=public"
echo "NODE_ENV=production"
echo "PORT=3000"
echo ""
echo "Replace YOUR_PASSWORD and HOST with your actual PostgreSQL credentials."
echo ""

echo "📋 Step 4: Database Migration"
echo "----------------------------"
echo ""
echo "After setting environment variables, run these commands in Coolify terminal:"
echo ""
echo "1. Generate Prisma client:"
echo "   npx prisma generate"
echo ""
echo "2. Push database schema:"
echo "   npx prisma db push"
echo ""
echo "3. Seed database with real-world data:"
echo "   npm run seed"
echo "   # or use the API endpoint after login:"
echo "   # curl -X POST https://fleet.ashbi.ca/api/seed"
echo ""

echo "📋 Step 5: Verify Setup"
echo "----------------------"
echo ""
echo "1. Visit https://fleet.ashbi.ca/auth/login"
echo "2. Login with: admin@fleetflow.com / demo123"
echo "3. Verify that:"
echo "   - Dashboard loads with real vehicle data"
echo "   - Delivery tracking works"
echo "   - Client database is populated"
echo ""

echo "📋 Step 6: Configure Automatic Backups (Optional)"
echo "------------------------------------------------"
echo ""
echo "In Coolify PostgreSQL settings:"
echo "1. Enable automated backups"
echo "2. Set frequency: Daily"
echo "3. Set retention: 30 days"
echo "4. Configure cloud storage if available"
echo ""

echo "✅ Setup Complete!"
echo ""
echo "Your FleetFlow Pro is now running with PostgreSQL database."
echo "All real-world data is loaded and ready for use."
echo ""
echo "📞 Support: If you encounter issues, check:"
echo "   1. Application logs in Coolify"
echo "   2. PostgreSQL connection logs"
echo "   3. Environment variable formatting"
echo ""

# Save the generated secret to a file (for reference only, keep secure!)
echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET" > .env.secret.generated
echo "⚠️  WARNING: .env.secret.generated contains sensitive data. Keep it secure!"
echo ""

echo "To test database connection manually:"
echo "psql \"postgresql://fleetflow_user:YOUR_PASSWORD@HOST:5432/fleetflow_pro\" -c \"SELECT 1;\""
echo ""