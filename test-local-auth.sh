#!/bin/bash

echo "🔧 Testing local authentication setup"
echo "==================================="

# Clean up any existing test DB
rm -f test-local.db

# Set environment variables
export NEXTAUTH_URL=http://localhost:3000
export NEXTAUTH_SECRET=test-secret-123
export DATABASE_URL="file:./test-local.db"
export NODE_ENV=test

echo ""
echo "1. Generating Prisma client..."
npx prisma generate

echo ""
echo "2. Creating database tables..."
npx prisma db push

echo ""
echo "3. Starting seed test..."
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function testSeed() {
  const prisma = new PrismaClient();
  
  try {
    // Create a test user
    const hashedPassword = await bcrypt.hash('demo123', 12);
    const user = await prisma.user.create({
      data: {
        email: 'test@fleetflow.com',
        name: 'Test User',
        password: hashedPassword,
        role: 'admin',
        company: 'Test Company'
      }
    });
    
    console.log('✅ Created test user:', user.email);
    
    // Count users
    const count = await prisma.user.count();
    console.log('✅ Total users:', count);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testSeed();
"

echo ""
echo "4. Checking database file..."
ls -la test-local.db

echo ""
echo "✅ Local authentication test complete!"
echo "Database created at: test-local.db"
echo "Test user: test@fleetflow.com / demo123"
echo ""
echo "To clean up: rm -f test-local.db"