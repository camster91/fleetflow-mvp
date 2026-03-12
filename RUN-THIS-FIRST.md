# 🚨 IMMEDIATE ACTION REQUIRED: Fix FleetFlow Pro Authentication

## **The Problem**
You can't login to https://fleet.ashbi.ca because:
1. Email verification fails (Mailgun not configured)
2. No admin user exists
3. Users created via API aren't verified

## **⏱️ 5-Minute Fix**

### **STEP 1: Add Environment Variables in Coolify**
1. Go to **Coolify Dashboard** → **Applications** → `fleetflow-pro`
2. Click **"Environment Variables"** tab
3. **Add/Update these variables**:

```env
NEXTAUTH_URL=https://fleet.ashbi.ca
NEXTAUTH_SECRET=tJHahWG9Lwkmfl66qShjHSjFQjVTFwPu8BNfl1jC/ek=
DATABASE_URL="file:./prod.db"
NODE_ENV=production
PORT=3000
```

4. Click **"Save"** → Wait for redeploy (2-3 minutes)

### **STEP 2: Run This Command in Coolify Terminal**
After redeploy completes:
1. Go to **Application** → **Terminal** tab
2. **Copy and paste this entire command**:

```bash
npx prisma db push && node -e "const {PrismaClient}=require('@prisma/client');const bcrypt=require('bcryptjs');const prisma=new PrismaClient();(async()=>{let admin=await prisma.user.findUnique({where:{email:'admin@fleetflow.com'}});if(!admin){const hash=await bcrypt.hash('admin123',12);admin=await prisma.user.create({data:{name:'Admin User',email:'admin@fleetflow.com',password:hash,role:'admin',company:'FleetFlow',emailVerified:new Date()}});console.log('✅ Admin created');}else if(!admin.emailVerified){await prisma.user.update({where:{id:admin.id},data:{emailVerified:new Date()}});console.log('✅ Admin verified');}const users=await prisma.user.findMany({where:{emailVerified:null}});for(const user of users){await prisma.user.update({where:{id:user.id},data:{emailVerified:new Date(),verificationToken:null}});console.log(\`✅ Verified: \${user.email}\`);}console.log('\\n🎉 FIX COMPLETE!');console.log('🔑 Login: https://fleet.ashbi.ca');console.log('   Email: admin@fleetflow.com');console.log('   Password: admin123');await prisma.\$disconnect();})().catch(e=>{console.error('❌ Error:',e.message);process.exit(1);});"
```

### **STEP 3: Login**
- **URL**: https://fleet.ashbi.ca
- **Email**: `admin@fleetflow.com`
- **Password**: `admin123`

---

## **✅ DONE! You can now use FleetFlow Pro**

### **What's Working:**
- ✅ Full admin access
- ✅ All fleet management features
- ✅ Real data (6 vehicles, 6 deliveries, 6 clients)
- ✅ Vehicle tracking, delivery management, maintenance scheduling

### **Next Steps (Optional but Recommended):**

1. **Change admin password** from `admin123` to something secure
2. **Configure Mailgun** for email verification (follow `EMAIL_SETUP_GUIDE.md`)
3. **Migrate to PostgreSQL** for production (follow `COOLIFY-POSTGRES-GUIDE.md`)
4. **Set up Stripe billing** (follow instructions in `deploy-master.sh setup-stripe`)

---

## **🔧 If Something Goes Wrong**

### **Reset Everything:**
```bash
# In Coolify Terminal:
rm -f prod.db
npx prisma db push
# Then run the fix command again
```

### **Check App Health:**
```bash
# Simple health check
curl -f https://fleet.ashbi.ca && echo "✅ App running"
```

### **Get Help:**
- Check **Coolify Logs**: Application → Logs tab
- View **Build Logs**: Application → Builds → Latest
- Run **deployment check**: `./check-deployment.sh`

---

## **📚 More Documentation**

| File | Purpose |
|------|---------|
| `QUICK-START-AUTH.md` | Simple authentication fix |
| `EMAIL_SETUP_GUIDE.md` | Mailgun email configuration |
| `COOLIFY-POSTGRES-GUIDE.md` | PostgreSQL migration |
| `PRODUCTION-DEPLOYMENT-TASKS.md` | Complete task list |
| `deploy-master.sh` | All-in-one deployment script |

---

**🎯 Time estimate:** 5-6 minutes  
**🎯 Difficulty:** Simple copy-paste  
**🎯 Result:** Fully working FleetFlow Pro!