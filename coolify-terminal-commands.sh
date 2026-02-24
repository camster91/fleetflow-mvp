#!/bin/bash

echo "# 🚀 Coolify Terminal Commands for FleetFlow Pro Setup"
echo ""
echo "# After setting environment variables and redeploying, run these:"
echo ""
echo "# 1. Create database tables:"
echo "npx prisma db push"
echo ""
echo "# 2. Seed database with user accounts:"
echo "npm run seed"
echo ""
echo "# 3. Alternative: Seed via API (after login):"
echo "# First login at https://fleet.ashbi.ca, then run:"
echo "# curl -X POST https://fleet.ashbi.ca/api/seed"
echo ""
echo "# 4. Verify database:"
echo "ls -la prod.db"
echo "echo 'Database should be ~100KB+ in size'"
echo ""
echo "# 5. Test authentication (optional):"
echo "# node -e \""
echo "# const { PrismaClient } = require('@prisma/client');
echo "# const prisma = new PrismaClient();
echo "# prisma.user.count().then(count => console.log('User count:', count));
echo "# \""