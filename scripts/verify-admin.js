#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  console.log('Connected to database');
  
  const users = await prisma.user.findMany();
  console.log('Total users:', users.length);
  
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@fleetflow.com' }
  });
  
  console.log('Admin exists:', !!admin);
  if (admin) {
    console.log('Admin email:', admin.email);
    console.log('Admin role:', admin.role);
    console.log('Admin verified:', !!admin.emailVerified);
    console.log('Admin created:', admin.createdAt);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);