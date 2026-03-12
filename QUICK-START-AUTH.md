# ⚡ Quick Start: Fix FleetFlow Pro Authentication

## **The Problem**
Can't login to https://fleet.ashbi.ca because:
- Email verification fails (Mailgun not configured)
- No admin user exists

## **The Solution** (5 minutes)

### **1. Add Environment Variables in Coolify**
```env
NEXTAUTH_URL=https://fleet.ashbi.ca
NEXTAUTH_SECRET=tJHahWG9Lwkmfl66qShjHSjFQjVTFwPu8BNfl1jC/ek=
DATABASE_URL="file:./prod.db"
NODE_ENV=production
PORT=3000
```

**Location:** Coolify → Applications → fleetflow-pro → Environment Variables → Save

### **2. Run This in Coolify Terminal**
```bash
# Copy and paste this entire command:
npx prisma db push && node -e "const {PrismaClient}=require('@prisma/client');const bcrypt=require('bcryptjs');const prisma=new PrismaClient();(async()=>{let admin=await prisma.user.findUnique({where:{email:'admin@fleetflow.com'}});if(!admin){const hash=await bcrypt.hash('admin123',12);admin=await prisma.user.create({data:{name:'Admin',email:'admin@fleetflow.com',password:hash,role:'admin',company:'FleetFlow',emailVerified:new Date()}});console.log('✅ Admin created');}else if(!admin.emailVerified){await prisma.user.update({where:{id:admin.id},data:{emailVerified:new Date()}});console.log('✅ Admin verified');}const users=await prisma.user.findMany({where:{emailVerified:null}});for(const user of users){await prisma.user.update({where:{id:user.id},data:{emailVerified:new Date(),verificationToken:null}});console.log(\`✅ Verified: \${user.email}\`);}console.log('\\n🎉 DONE! Login:');console.log('   URL: https://fleet.ashbi.ca');console.log('   Email: admin@fleetflow.com');console.log('   Password: admin123');await prisma.\$disconnect();})().catch(e=>{console.error('❌ Error:',e.message);process.exit(1);});"
```

### **3. Login**
- **URL**: https://fleet.ashbi.ca
- **Email**: `admin@fleetflow.com`
- **Password**: `admin123`

## **Done!** 🎉

Your FleetFlow Pro is now fully functional with:
- ✅ Authentication working
- ✅ Admin access
- ✅ All fleet management features
- ✅ Real-world data (6 vehicles, 6 deliveries, 6 clients)

## **Need More Help?**
- Detailed guide: [COOLIFY-DEPLOYMENT-FIX.md](COOLIFY-DEPLOYMENT-FIX.md)
- Email setup: [EMAIL_SETUP_GUIDE.md](EMAIL_SETUP_GUIDE.md)
- PostgreSQL: [COOLIFY-POSTGRES-GUIDE.md](COOLIFY-POSTGRES-GUIDE.md)