# 🚀 Quick Start: PostgreSQL Setup for FleetFlow Pro

## ⚡ 5-Minute Setup Checklist

### ✅ Step 1: Create PostgreSQL Database in Coolify
1. **Go to Coolify** → Resources → PostgreSQL
2. **Click** "Create New PostgreSQL Database"
3. **Configure**:
   - Database Name: `fleetflow_pro`
   - Username: `fleetflow_user`
   - Password: `[GENERATE & SAVE]`
   - Version: PostgreSQL 15+
   - Network: `internal`
4. **Save** connection details:
   - Host: `[e.g., postgres.internal.coolify]`
   - Port: `5432`
   - Password: `[your password]`

### ✅ Step 2: Update Environment Variables
1. **Go to Coolify** → Applications → fleetflow-pro
2. **Click** "Environment Variables"
3. **Add/Update** these exact variables:

```env
# AUTHENTICATION (CRITICAL)
NEXTAUTH_URL=https://fleet.ashbi.ca
NEXTAUTH_SECRET=k8eLErhObBcKlxVkExTfeZZu4xLCqcdkfM7Os9A/DCo=
NODE_ENV=production
PORT=3000

# DATABASE (REPLACE [HOST] and [PASSWORD])
DATABASE_URL=postgresql://fleetflow_user:[PASSWORD]@[HOST]:5432/fleetflow_pro?schema=public

# APPLICATION SETTINGS
NEXT_PUBLIC_APP_NAME=FleetFlow Pro
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_BUILD_DATE=2026-02-24
```

4. **Save** → Coolify will auto-redeploy

### ✅ Step 3: Database Migration (After Redeploy)
1. **Wait** for deployment to complete (2-3 minutes)
2. **Go to** Application → Terminal
3. **Run** these commands:

```bash
# 1. Generate Prisma client
npx prisma generate

# 2. Create database tables
npx prisma db push

# 3. Seed with real-world data
npm run seed
```

**Expected Output:**
- `✔ Generated Prisma Client`
- `✔ Database schema pushed successfully`
- `✔ Created 12 users, 6 vehicles, 6 clients, 6 deliveries`

### ✅ Step 4: Test Your Deployment
1. **Visit**: https://fleet.ashbi.ca
2. **Login** with:
   - Admin: `admin@fleetflow.com` / `demo123`
   - Fleet Manager: `manager@josephsdelivery.com` / `demo123`
   - Driver: `driver.mrodriguez@josephsdelivery.com` / `demo123`
3. **Verify**:
   - ✅ Dashboard shows 6 vehicles
   - ✅ Deliveries tab has 6 active deliveries
   - ✅ Clients database is populated
   - ✅ All buttons have real functionality

## 🔧 Troubleshooting Quick Fixes

### ❌ "Database connection failed"
```bash
# Test connection from Coolify terminal
psql "postgresql://fleetflow_user:[PASSWORD]@[HOST]:5432/fleetflow_pro" -c "SELECT 1;"
```
**Fix:** Verify DATABASE_URL format and password

### ❌ "Authentication failed" / Login loop
**Fix:** 
1. Clear browser cookies for fleet.ashbi.ca
2. Verify NEXTAUTH_SECRET matches exactly
3. Check NEXTAUTH_URL has no trailing slash

### ❌ "npm run seed" creates only users
**Fix:** Manually seed via API after login:
1. Login as `admin@fleetflow.com` / `demo123`
2. Open browser DevTools → Console
3. Run: `fetch('/api/seed', { method: 'POST' })`

### ❌ Application won't start
**Check:** Coolify → Application → Logs
**Common issues:**
- DATABASE_URL syntax error
- Missing NEXTAUTH_SECRET
- PostgreSQL not accessible from application network

## 📊 Verification Checklist

### After Setup, Confirm:
- [ ] https://fleet.ashbi.ca loads login page
- [ ] Can login with admin credentials
- [ ] Dashboard shows real vehicle data
- [ ] Google Maps navigation works
- [ ] Driver calling shows confirmation dialog
- [ ] SOP upload opens file picker
- [ ] All tabs load without errors

### Data Verification:
- [ ] 6 vehicles with license plates
- [ ] 6 clients with business details  
- [ ] 6 deliveries with contact information
- [ ] 12 user accounts (admin, managers, drivers)

## 📞 Need Help?

### Immediate Support:
1. **Coolify Logs**: Application → Logs tab
2. **Database Logs**: PostgreSQL resource → Logs
3. **Build Logs**: Application → Builds → Latest

### Documentation:
- **Complete Guide**: [PRODUCTION-SETUP-GUIDE.md](PRODUCTION-SETUP-GUIDE.md)
- **Coolify Specific**: [COOLIFY-POSTGRES-GUIDE.md](COOLIFY-POSTGRES-GUIDE.md)
- **Database Details**: [POSTGRES-SETUP.md](POSTGRES-SETUP.md)

### Quick Tests:
```bash
# From Coolify terminal
curl -f http://localhost:3000/ || echo "App not running"
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.$connect().then(() => console.log('✅ DB connected')).catch(e => console.error('❌ DB error:', e.message))"
```

## 🎉 Success! Your FleetFlow Pro is Production Ready

Once PostgreSQL is configured, your system will have:
- **Real-time data persistence** across user sessions
- **Concurrent user support** for your entire team
- **Secure authentication** with role-based access
- **Production-grade database** with backup capability
- **Real fleet operations data** ready for immediate use

**Next Steps After Setup:**
1. Train your team with demo credentials
2. Add your actual vehicles and clients
3. Configure automated backups in Coolify
4. Monitor performance for first week

---

**Need assistance?** The setup is fully documented and tested. Follow the guides above for step-by-step instructions.