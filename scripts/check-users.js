#!/usr/bin/env node

/**
 * Check users in the SQLite database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.argv[2] || './data/fleet.db';

console.log('Checking database at:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// List all tables
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('Error getting tables:', err.message);
    db.close();
    return;
  }
  
  console.log('\nTables in database:');
  tables.forEach(table => console.log('  -', table.name));
  
  // Check if User table exists
  const userTable = tables.find(t => t.name.toLowerCase() === 'user');
  if (!userTable) {
    console.log('\nNo User table found!');
    db.close();
    return;
  }
  
  console.log('\nChecking User table structure...');
  db.all(`PRAGMA table_info(User)`, (err, columns) => {
    if (err) {
      console.error('Error getting table info:', err.message);
      db.close();
      return;
    }
    
    console.log('Columns in User table:');
    columns.forEach(col => {
      console.log(`  - ${col.name} (${col.type})${col.pk ? ' PRIMARY KEY' : ''}${col.notnull ? ' NOT NULL' : ''}`);
    });
    
    // Get all users
    console.log('\nUsers in database:');
    db.all(`SELECT id, email, name, role, emailVerified, password FROM User ORDER BY createdAt DESC`, async (err, users) => {
      if (err) {
        console.error('Error getting users:', err.message);
        db.close();
        return;
      }
      
      console.log(`Found ${users.length} user(s):\n`);
      
      for (const user of users) {
        console.log(`ID: ${user.id}`);
        console.log(`Email: ${user.email}`);
        console.log(`Name: ${user.name || 'N/A'}`);
        console.log(`Role: ${user.role}`);
        console.log(`Email Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
        
        if (user.password) {
          console.log(`Password hash: ${user.password.substring(0, 20)}...`);
          console.log(`Hash length: ${user.password.length}`);
          
          // Test if password "admin123" matches the hash
          if (user.email === 'admin@fleetflow.com') {
            try {
              const match = await bcrypt.compare('admin123', user.password);
              console.log(`Password "admin123" matches hash: ${match ? 'YES' : 'NO'}`);
              
              if (!match) {
                // Try without bcrypt (plain text?)
                console.log(`Password is plain text? ${user.password === 'admin123' ? 'YES' : 'NO'}`);
              }
            } catch (err) {
              console.log('Error comparing password:', err.message);
            }
          }
        } else {
          console.log('Password: NULL or empty');
        }
        
        console.log('---\n');
      }
      
      // Check for Account table (NextAuth)
      const accountTable = tables.find(t => t.name.toLowerCase() === 'account');
      if (accountTable) {
        console.log('\nChecking Account table (NextAuth)...');
        db.all(`SELECT * FROM Account LIMIT 5`, (err, accounts) => {
          if (err) {
            console.error('Error getting accounts:', err.message);
          } else {
            console.log(`Found ${accounts.length} account(s) in Account table`);
            accounts.forEach(acc => {
              console.log(`  - User ID: ${acc.userId}, Type: ${acc.type}, Provider: ${acc.provider}`);
            });
          }
          
          db.close();
        });
      } else {
        console.log('\nNo Account table found (NextAuth not using Account table or using different setup)');
        db.close();
      }
    });
  });
});