#!/usr/bin/env node

/**
 * Create admin user directly in SQLite database
 * Uses sqlite3 package if available, otherwise tries Prisma
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Try to use Prisma first
async function createAdminWithPrisma() {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    await prisma.$connect();
    console.log('✅ Connected to database via Prisma');
    
    // Check if admin exists
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@fleetflow.com' }
    });
    
    if (adminUser) {
      console.log('✅ Admin user already exists');
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Role: ${adminUser.role}`);
      console.log(`   Verified: ${adminUser.emailVerified ? 'Yes' : 'No'}`);
      
      // Check password
      const validPassword = await bcrypt.compare('admin123', adminUser.password);
      console.log(`   Password "admin123" valid: ${validPassword ? '✅ YES' : '❌ NO'}`);
      
      if (!validPassword) {
        console.log('🔄 Updating admin password...');
        const newHash = await bcrypt.hash('admin123', 12);
        await prisma.user.update({
          where: { id: adminUser.id },
          data: { password: newHash, emailVerified: new Date() }
        });
        console.log('✅ Admin password updated and verified!');
      } else if (!adminUser.emailVerified) {
        console.log('🔄 Verifying admin email...');
        await prisma.user.update({
          where: { id: adminUser.id },
          data: { emailVerified: new Date() }
        });
        console.log('✅ Admin email verified!');
      }
    } else {
      console.log('👤 Creating admin user...');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      const admin = await prisma.user.create({
        data: {
          name: 'Admin User',
          email: 'admin@fleetflow.com',
          password: hashedPassword,
          role: 'admin',
          company: 'FleetFlow',
          emailVerified: new Date(),
        }
      });
      console.log('✅ Admin user created!');
      console.log(`   Email: ${admin.email}`);
      console.log(`   Password: admin123`);
      console.log(`   Role: ${admin.role}`);
    }
    
    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.error('❌ Prisma error:', error.message);
    return false;
  }
}

// Try direct SQLite
async function createAdminWithSQLite() {
  try {
    // Check if sqlite3 is available
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = '/app/data/fleet.db';
    
    console.log(`📂 Using database: ${dbPath}`);
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('❌ Error opening database:', err.message);
          reject(err);
          return;
        }
        
        console.log('✅ Connected to SQLite database');
        
        // Check if User table exists
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='User'", async (err, row) => {
          if (err) {
            console.error('❌ Error checking tables:', err.message);
            db.close();
            reject(err);
            return;
          }
          
          if (!row) {
            console.log('❌ User table does not exist');
            db.close();
            resolve(false);
            return;
          }
          
          console.log('✅ User table exists');
          
          // Check if admin user exists
          db.get("SELECT * FROM User WHERE email = ?", ['admin@fleetflow.com'], async (err, user) => {
            if (err) {
              console.error('❌ Error checking admin user:', err.message);
              db.close();
              reject(err);
              return;
            }
            
            if (user) {
              console.log('✅ Admin user exists in database');
              console.log(`   ID: ${user.id}`);
              console.log(`   Email: ${user.email}`);
              console.log(`   Role: ${user.role}`);
              
              // Update password if needed
              const hashedPassword = await bcrypt.hash('admin123', 12);
              db.run(
                "UPDATE User SET password = ?, emailVerified = CURRENT_TIMESTAMP WHERE email = ?",
                [hashedPassword, 'admin@fleetflow.com'],
                function(err) {
                  if (err) {
                    console.error('❌ Error updating admin user:', err.message);
                  } else {
                    console.log('✅ Admin password updated to "admin123"');
                    console.log(`   Rows affected: ${this.changes}`);
                  }
                  db.close();
                  resolve(true);
                }
              );
            } else {
              console.log('👤 Creating admin user in SQLite...');
              const hashedPassword = await bcrypt.hash('admin123', 12);
              const userId = `admin_${Date.now()}`;
              
              db.run(
                `INSERT INTO User (id, email, name, password, role, company, emailVerified, createdAt, updatedAt) 
                 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [userId, 'admin@fleetflow.com', 'Admin User', hashedPassword, 'admin', 'FleetFlow'],
                function(err) {
                  if (err) {
                    console.error('❌ Error creating admin user:', err.message);
                  } else {
                    console.log('✅ Admin user created!');
                    console.log(`   Email: admin@fleetflow.com`);
                    console.log(`   Password: admin123`);
                    console.log(`   Role: admin`);
                  }
                  db.close();
                  resolve(true);
                }
              );
            }
          });
        });
      });
    });
  } catch (error) {
    console.error('❌ SQLite error (package not available?):', error.message);
    return false;
  }
}

// Main function
async function main() {
  console.log('🔧 Creating/verifying admin user...\n');
  
  // Try Prisma first
  const prismaSuccess = await createAdminWithPrisma();
  
  if (!prismaSuccess) {
    console.log('\n🔄 Falling back to SQLite...');
    const sqliteSuccess = await createAdminWithSQLite();
    
    if (!sqliteSuccess) {
      console.log('\n❌ Failed to create admin user with both methods');
      console.log('💡 Try:');
      console.log('   1. Check database file exists and is readable');
      console.log('   2. Check database schema matches expected structure');
      console.log('   3. Manually create user via registration page');
      process.exit(1);
    }
  }
  
  console.log('\n🎉 Admin user setup complete!');
  console.log('   Login at: https://fleet.ashbi.ca/auth/login');
  console.log('   Email: admin@fleetflow.com');
  console.log('   Password: admin123');
}

main().catch(console.error);