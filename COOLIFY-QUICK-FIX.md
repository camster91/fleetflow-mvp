# 🚀 Coolify Quick Fix for FleetFlow Pro Authentication

## **Problem**
FleetFlow Pro is deployed but authentication doesn't work because:
- ❌ `NEXTAUTH_SECRET` environment variable is missing
- ❌ Database may not be initialized
- ❌ No admin user exists

## **Solution (5-10 minutes)**

### **Step 1: Add Environment Variables to Coolify**

1. Go to **Coolify Dashboard** → **Applications** → **fleetflow-pro**
2. Click **"Environment Variables"** tab
3. **Add these variables**:

```env
# REQUIRED FOR AUTHENTICATION
NEXTAUTH_URL=https://fleet.ashbi.ca
NEXTAUTH_SECRET=tJHahWG9Lwkmfl66qShjHSjFQjVTFwPu8BNfl1jC/ek=

# DATABASE (SQLite - perfect for single user)
DATABASE_URL="file:./prod.db"

# APPLICATION SETTINGS
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_NAME=FleetFlow Pro

# DISABLE EMAIL VERIFICATION (for now)
# Remove these after Mailgun is configured
EMAIL_VERIFICATION_REQUIRED=false
```

4. Click **"Save"** - Coolify will automatically redeploy (2-3 minutes)

### **Step 2: Run the Fix Script**

1. Wait for deployment to finish
2. Go to **Application** → **Terminal**
3. Run these commands:

```bash
# Make the fix script executable
chmod +x scripts/fix-auth.js

# Run the fix
node scripts/fix-auth.js
```

**Expected output:**
```
🔧 FleetFlow Pro Auth Fix
=========================

✅ Database file exists
✅ Database has X user(s)

👥 Checking for admin user...
✅ Admin user exists
✅ Admin user verified

📋 All Users:
1. admin@fleetflow.com (admin)
   Name: Admin User
   Verified: Yes

🎉 Setup Complete!
================
You can now login at: https://fleet.ashbi.ca
Admin credentials:
  Email: admin@fleetflow.com
  Password: admin123
```

### **Step 3: Test Login**

1. Visit: https://fleet.ashbi.ca
2. Login with:
   - **Email**: `admin@fleetflow.com`
   - **Password**: `admin123`

3. You should see the FleetFlow Pro dashboard with real data

## **Alternative: Manual Setup**

If the script doesn't work, run these commands manually in Coolify terminal:

```bash
# 1. Create database tables
npx prisma db push

# 2. Create admin user
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function setup() {
  const hashedPassword = await bcrypt.hash('admin123', 12);
  await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@fleetflow.com',
      password: hashedPassword,
      role: 'admin',
      company: 'FleetFlow',
      emailVerified: new Date(),
    },
  });
  console.log('✅ Admin user created');
  console.log('   Email: admin@fleetflow.com');
  console.log('   Password: admin123');
  await prisma.\$disconnect();
}

setup().catch(console.error);
"

# 3. Verify any existing users (if you already created some)
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyAll() {
  const users = await prisma.user.findMany({
    where: { emailVerified: null }
  });
  
  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        emailVerified: new Date(),
        verificationToken: null
      }
    });
    console.log(\`✅ Verified: \${user.email}\`);
  }
  
  await prisma.\$disconnect();
}

verifyAll().catch(console.error);
"
```

## **Troubleshooting**

### **Issue: "Database connection failed"**
```bash
# Delete and recreate database
rm -f prod.db
npx prisma db push
node scripts/fix-auth.js
```

### **Issue: "Cannot find module '@prisma/client'"**
```bash
# Install dependencies
npm ci
npx prisma generate
```

### **Issue: Login works but shows empty dashboard**
This is normal - the dashboard shows real fleet data from the application code, not the database. All features work.

### **Issue: "Invalid credentials" even with correct password**
```bash
# Reset password for admin user
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function resetPassword() {
  const hashedPassword = await bcrypt.hash('admin123', 12);
  await prisma.user.update({
    where: { email: 'admin@fleetflow.com' },
    data: { password: hashedPassword }
  });
  console.log('✅ Password reset to: admin123');
  await prisma.\$disconnect();
}

resetPassword().catch(console.error);
"
```

## **Next Steps After Fix**

### **1. Configure Email (Optional but recommended)**
Follow [EMAIL_SETUP_GUIDE.md](EMAIL_SETUP_GUIDE.md) to set up Mailgun for:
- Email verification
- Password reset
- Notifications

### **2. Set Up PostgreSQL (For production)**
Follow [COOLIFY-POSTGRES-GUIDE.md](COOLIFY-POSTGRES-GUIDE.md) for:
- Better performance
- Data persistence
- Backups

### **3. Configure Stripe Billing**
Add Stripe API keys to enable:
- Subscription management
- Payment processing
- Invoicing

## **Quick Reference**

| Item | Value |
|------|-------|
| **App URL** | https://fleet.ashbi.ca |
| **Admin Email** | admin@fleetflow.com |
| **Admin Password** | admin123 |
| **Database** | SQLite (prod.db) |
| **Auth Secret** | tJHahWG9Lwkmfl66qShjHSjFQjVTFwPu8BNfl1jC/ek= |

## **Need Help?**

1. **Check Coolify Logs**: Application → Logs tab
2. **View Build Logs**: Application → Builds → Latest
3. **Run Health Check**: `curl -f http://localhost:3000/ && echo "✅ App running"`
4. **Verify Database**: `ls -la prod.db && echo "✅ Database exists"`

---

**✅ Once these steps are complete, FleetFlow Pro will be fully functional with authentication working!**