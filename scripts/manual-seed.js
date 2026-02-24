const sqlite3 = require('sqlite3').verbose()
const bcrypt = require('bcryptjs')
const path = require('path')

// Path to SQLite database
const dbPath = path.join(__dirname, '..', 'dev.db')
const db = new sqlite3.Database(dbPath)

async function hashPassword(password) {
  return await bcrypt.hash(password, 12)
}

async function seed() {
  console.log('Starting manual seed of database...')
  console.log('Database path:', dbPath)

  // First, check if users table exists and has data
  db.get("SELECT COUNT(*) as count FROM User", async (err, row) => {
    if (err) {
      console.error('Error checking users:', err.message)
      // Table might not exist or schema is different
      console.log('Assuming fresh database, creating admin user...')
      await createAdminUser()
      return
    }

    if (row.count > 0) {
      console.log(`Database already has ${row.count} users, skipping seed`)
      db.close()
      return
    }

    await createAdminUser()
  })
}

async function createAdminUser() {
  try {
    const hashedPassword = await hashPassword('demo123')
    const userId = `user_${Date.now()}`
    
    db.run(`
      INSERT INTO User (id, email, name, password, role, company, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      userId,
      'admin@fleetflow.com',
      'System Administrator',
      hashedPassword,
      'admin',
      'FleetFlow Inc.'
    ], function(err) {
      if (err) {
        console.error('Error creating admin user:', err.message)
        // Try with different column names or create table
        checkAndFixSchema()
        return
      }
      
      console.log('✅ Created admin user: admin@fleetflow.com / demo123')
      console.log('User ID:', this.lastID)
      
      // Create additional demo users
      createDemoUsers()
    })
  } catch (error) {
    console.error('Error:', error)
  }
}

async function createDemoUsers() {
  const demoUsers = [
    {
      email: 'manager@josephsdelivery.com',
      name: 'Joseph Chen',
      password: 'demo123',
      role: 'fleet_manager',
      company: 'Joseph\'s Food Truck Delivery',
    },
    {
      email: 'dispatch@josephsdelivery.com',
      name: 'Sarah Johnson',
      password: 'demo123',
      role: 'dispatch',
      company: 'Joseph\'s Food Truck Delivery',
    },
    {
      email: 'driver.mrodriguez@josephsdelivery.com',
      name: 'Michael Rodriguez',
      password: 'demo123',
      role: 'driver',
      company: 'Joseph\'s Food Truck Delivery',
    },
    {
      email: 'driver.sjohnson@josephsdelivery.com',
      name: 'Sarah Johnson (Driver)',
      password: 'demo123',
      role: 'driver',
      company: 'Joseph\'s Food Truck Delivery',
    },
    {
      email: 'driver.jwilson@josephsdelivery.com',
      name: 'James Wilson',
      password: 'demo123',
      role: 'driver',
      company: 'Joseph\'s Food Truck Delivery',
    },
  ]

  for (const user of demoUsers) {
    try {
      const hashedPassword = await hashPassword(user.password)
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      db.run(`
        INSERT INTO User (id, email, name, password, role, company, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [
        userId,
        user.email,
        user.name,
        hashedPassword,
        user.role,
        user.company
      ], function(err) {
        if (err) {
          console.error(`Error creating user ${user.email}:`, err.message)
        } else {
          console.log(`✅ Created user: ${user.email} (${user.role})`)
        }
      })
    } catch (error) {
      console.error(`Error with user ${user.email}:`, error)
    }
  }
  
  // Close database after a short delay
  setTimeout(() => {
    db.close()
    console.log('Database seeding completed!')
    console.log('You can now login with:')
    console.log('- admin@fleetflow.com / demo123 (Admin)')
    console.log('- manager@fleetflow.com / demo123 (Fleet Manager)')
    console.log('- dispatch@fleetflow.com / demo123 (Dispatch)')
    console.log('- driver@fleetflow.com / demo123 (Driver)')
  }, 1000)
}

function checkAndFixSchema() {
  console.log('Checking database schema...')
  
  // Check if User table exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='User'", (err, row) => {
    if (err || !row) {
      console.error('User table does not exist. Database may not be initialized.')
      console.log('Run: npx prisma migrate deploy or npx prisma db push first')
      db.close()
      return
    }
    
    // Check columns
    db.all("PRAGMA table_info(User)", (err, columns) => {
      if (err) {
        console.error('Error checking table schema:', err.message)
        db.close()
        return
      }
      
      console.log('User table columns:', columns.map(c => c.name).join(', '))
      db.close()
    })
  })
}

// Run seed
seed()