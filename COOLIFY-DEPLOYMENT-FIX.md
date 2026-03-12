# 🚀 FleetFlow Pro Coolify Deployment - Complete Fix Guide

## **Current Status Analysis**

### ✅ **What's Working**
- Application deployed at: `https://fleet.ashbi.ca`
- Docker container running with health checks
- Website accessible (200 OK)
- Registration API functional
- GitHub repo synced: `https://github.com/camster91/fleetflow-mvp`

### ⚠️ **What Needs Fixing**
1. **Authentication**: Email verification blocks login (Mailgun not configured)
2. **Admin User**: No default admin account exists
3. **Database**: May need initialization

## **🎯 5-Minute Complete Fix**

### **Step 1: Check/Add Environment Variables (1 minute)**

**In Coolify Dashboard:**
1. Applications → `fleetflow-pro` → Environment Variables
2. **Ensure these variables exist:**

```env
# REQUIRED
NEXTAUTH_URL=https://fleet.ashbi.ca
NEXTAUTH_SECRET=any-random-string-here-min-32-chars
DATABASE_URL="file:./prod.db"
NODE_ENV=production
PORT=3000

# OPTIONAL (disable email verification)
EMAIL_VERIFICATION_REQUIRED=false
```

**If NEXTAUTH_SECRET is missing**, use:
```bash
# Generate a secure secret
openssl rand -base64 32
# Output: tJHahWG9Lwkmfl66qShjHSjFQjVTFwPu8BNfl1jC/ek=
```

3. **Save** → Coolify auto-redeploys (2-3 minutes)

### **Step 2: Run One-Command Fix (2 minutes)**

**In Coolify Terminal** (Applications → `fleetflow-pro` → Terminal):

```bash
# Paste this entire block:
npx prisma db push && node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function fix() {
  // Create/verify admin
  let admin = await prisma.user.findUnique({ 
    where: { email: 'admin@fleetflow.com' } 
  });
  
  if (!admin) {
    const hashedPassword = await bcrypt.hash('admin123', 12);
    admin = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@fleetflow.com',
        password: hashedPassword,
        role: 'admin',
        company: 'FleetFlow',
        emailVerified: new Date(),
      },
    });
    console.log('✅ Admin created');
  } else if (!admin.emailVerified) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { emailVerified: new Date() }
    });
    console.log('✅ Admin verified');
  }
  
  // Verify all users
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
  
  console.log('\\n🎉 FIX COMPLETE!');
  console.log('🔑 Login: https://fleet.ashbi.ca');
  console.log('   Email: admin@fleetflow.com');
  console.log('   Password: admin123');
  
  await prisma.\$disconnect();
}

fix().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
"
```

### **Step 3: Test Login (1 minute)**

1. **Open**: https://fleet.ashbi.ca
2. **Login with**:
   - **Email**: `admin@fleetflow.com`
   - **Password**: `admin123`
3. **Verify dashboard loads** with 6 vehicles, 6 deliveries

## **🔧 Alternative: If Above Doesn't Work**

### **Reset Everything** (Fresh start):

```bash
# In Coolify Terminal:
rm -f prod.db
npx prisma db push

# Then run the fix script above again
```

### **Create Specific User**:

```bash
# Create user via API
curl -X POST https://fleet.ashbi.ca/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Your Name","email":"your@email.com","password":"YourPass123!","company":"Your Company"}'
```

Then verify via the fix script.

## **📊 Expected Results**

After successful fix:

1. **✅ Authentication works** - No more "verify email" errors
2. **✅ Dashboard loads** - Real fleet data displayed
3. **✅ All features work**:
   - Vehicle tracking
   - Delivery management  
   - Client database
   - Maintenance scheduling
   - SOP library
   - Reports

## **🚀 Production-Ready Next Steps**

### **1. Email Setup** (Recommended)
```env
# Add to Coolify environment
MAILGUN_API_KEY=your-key-here
MAILGUN_DOMAIN=fleetflow.ashbi.ca
FROM_EMAIL=FleetFlow <notifications@fleetflow.ashbi.ca>
```

### **2. PostgreSQL Migration** (For scaling)
Follow: `COOLIFY-POSTGRES-GUIDE.md`

### **3. Stripe Billing** (For SaaS)
Add Stripe API keys for payment processing.

### **4. Custom Domain** (Optional)
Point your domain to Coolify server.

## **📞 Troubleshooting Guide**

| Symptom | Solution |
|---------|----------|
| **"Invalid credentials"** | User not verified → Run fix script |
| **"Database connection failed"** | Run `npx prisma db push` |
| **Empty dashboard** | Normal - data is in application code |
| **Login redirect loop** | Clear browser cookies |
| **App won't start** | Check NEXTAUTH_SECRET is set |
| **Build failures** | Check Coolify build logs |

## **✅ Verification Checklist**

- [ ] Environment variables set in Coolify
- [ ] Fix script executed successfully
- [ ] Can login at https://fleet.ashbi.ca
- [ ] Dashboard shows fleet data
- [ ] All menu items work
- [ ] No "verify email" errors

## **⏱️ Time Estimates**

| Task | Time |
|------|------|
| Add env variables | 1 minute |
| Wait for redeploy | 2-3 minutes |
| Run fix script | 1 minute |
| Test login | 1 minute |
| **Total** | **5-6 minutes** |

## **🎉 Success Message**

Once complete, you'll have:
- ✅ Fully working FleetFlow Pro
- ✅ Admin access
- ✅ All features functional
- ✅ Ready for daily use
- ✅ No external dependencies (except authentication)

**FleetFlow Pro is now production-ready for single-user or small team use!**