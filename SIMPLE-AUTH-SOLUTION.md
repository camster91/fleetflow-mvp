# 🎯 Simple Auth Solution for FleetFlow Pro

## **Current Status**
✅ Application deployed at: https://fleet.ashbi.ca  
✅ App is running (HTTP 200)  
✅ Registration API works  
❌ Authentication may fail due to email verification  
❌ No admin user exists by default  

## **Root Cause**
1. **Email verification required** - Users must verify email before login
2. **Mailgun not configured** - Email service can't send verification emails
3. **No default admin user** - Need to create one manually

## **🔄 Quick Fix (5 minutes)**

### **Option A: Using Coolify Terminal (Recommended)**

1. **Open Coolify Terminal**
   - Go to Coolify Dashboard → Applications → fleetflow-pro
   - Click "Terminal" tab

2. **Run these commands:**

```bash
# 1. Create database tables (if not exists)
npx prisma db push

# 2. Create verified admin user
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function fixAuth() {
  // Check if admin exists
  let admin = await prisma.user.findUnique({
    where: { email: 'admin@fleetflow.com' }
  });
  
  if (!admin) {
    // Create admin
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
    console.log('✅ Admin user created');
  } else if (!admin.emailVerified) {
    // Verify existing admin
    await prisma.user.update({
      where: { id: admin.id },
      data: { emailVerified: new Date() }
    });
    console.log('✅ Admin user verified');
  } else {
    console.log('✅ Admin user already exists and verified');
  }
  
  // Verify ALL existing users (bypass email verification)
  const unverifiedUsers = await prisma.user.findMany({
    where: { emailVerified: null }
  });
  
  for (const user of unverifiedUsers) {
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        emailVerified: new Date(),
        verificationToken: null
      }
    });
    console.log(\`✅ Verified: \${user.email}\`);
  }
  
  console.log('\\n🎉 Auth fix complete!');
  console.log('Login with:');
  console.log('  Email: admin@fleetflow.com');
  console.log('  Password: admin123');
  
  await prisma.\$disconnect();
}

fixAuth().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
"
```

3. **Test Login**
   - Visit: https://fleet.ashbi.ca
   - Login with: `admin@fleetflow.com` / `admin123`

### **Option B: Using API Only**

If you can't access Coolify terminal:

1. **Create user via API** (if not already done):
```bash
curl -X POST https://fleet.ashbi.ca/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@fleetflow.com","password":"admin123","company":"FleetFlow"}'
```

2. **You'll get a user ID in response**. Note it down.

3. **Verify the user manually** (requires database access - skip if using Option A):
   - This requires running the database commands in Option A

### **Option C: One-Time Script**

1. **Add this script to your project** (if you can push to GitHub):

Create `scripts/quick-fix.js`:
```javascript
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function quickFix() {
  // ... same code as Option A above
}
quickFix();
```

2. **Run in Coolify terminal**:
```bash
node scripts/quick-fix.js
```

## **🎯 Login Credentials**

After running the fix:

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| **Admin** | `admin@fleetflow.com` | `admin123` | Full access |
| **Existing Users** | Your registered email | Your password | Use if you already registered |

## **🔧 Troubleshooting**

### **"Invalid credentials" error**
The user exists but isn't verified. Run the fix script to verify all users.

### **"User not found" error**
The user doesn't exist. Create with:
```bash
curl -X POST https://fleet.ashbi.ca/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Your Name","email":"your@email.com","password":"yourpassword","company":"Your Co"}'
```

Then run the fix script to verify.

### **Database errors**
```bash
# Reset database (⚠️ deletes all data!)
rm -f prod.db
npx prisma db push
# Then run the fix script again
```

### **NEXTAUTH_SECRET warning**
If you see errors about NEXTAUTH_SECRET:

1. **Add to Coolify environment variables**:
   ```
   NEXTAUTH_SECRET=any-random-string-here-32-chars
   NEXTAUTH_URL=https://fleet.ashbi.ca
   ```

2. **Redeploy application**

## **📊 What Gets Fixed**

1. ✅ **Admin user created** with full privileges
2. ✅ **All users verified** (bypasses email requirement)
3. ✅ **Database initialized** if not already
4. ✅ **Ready for immediate use**

## **🚀 Next Steps**

1. **Use the application** - All fleet management features work
2. **Configure email** - Set up Mailgun for proper email verification
3. **Add team members** - Invite other users via the dashboard
4. **Set up billing** - Add Stripe keys for subscription management

## **✅ Verification**

To confirm everything works:

1. **Login**: https://fleet.ashbi.ca → Should redirect to dashboard
2. **Check dashboard**: Should show 6 vehicles, 6 deliveries
3. **Test features**: Click any vehicle → View details, maps, etc.

## **📞 Need Help?**

1. **Check logs**: Coolify → Application → Logs
2. **Verify deployment**: `curl -f https://fleet.ashbi.ca && echo "✅ App running"`
3. **Test API**: `curl https://fleet.ashbi.ca/api/auth/session` → Should return `{}` or session data

---

**⏱️ Time estimate**: 5 minutes  
**Difficulty**: Easy (copy-paste commands)  
**Result**: Fully working authentication system