# 🚀 Simple Production Setup for Single User

## For: Just one person using FleetFlow Pro

### ✅ What's Already Working:
- Application deployed at: https://fleet.ashbi.ca
- Docker container running
- Health check passes
- Code is up-to-date with real-world data

### 🔧 What's Missing:
- **NEXTAUTH_SECRET** environment variable (required for authentication)
- **NEXTAUTH_URL** environment variable (should be https://fleet.ashbi.ca)
- **Database seeded** with user accounts

## ⚡ Quick Fix (5 minutes):

### Step 1: Add These Environment Variables in Coolify:

1. Go to **Coolify Dashboard** → **Applications** → **fleetflow-pro**
2. Click **"Environment Variables"**
3. **Add these exact variables**:

```env
# REQUIRED FOR AUTHENTICATION
NEXTAUTH_URL=https://fleet.ashbi.ca
NEXTAUTH_SECRET=Rh6rLBvT20Ut6HYUjMTuHOdONFN21baBceOwzW+Yk6I=

# DATABASE (SQLite - perfect for single user)
DATABASE_URL="file:./prod.db"

# APPLICATION SETTINGS
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_NAME=FleetFlow Pro
NEXT_PUBLIC_APP_VERSION=1.0.0
```

4. Click **"Save"** - Coolify will automatically redeploy

### Step 2: Seed the Database (After Redeploy):

1. Wait for deployment to finish (2-3 minutes)
2. Go to **Application** → **Terminal**
3. Run these commands:

```bash
# Generate database tables
npx prisma db push

# Create user accounts and seed data
npm run seed
```

**Expected output:**
```
✅ Database schema pushed successfully
✅ Created 12 users, 6 vehicles, 6 clients, 6 deliveries
```

### Step 3: Test Login:

1. Visit: https://fleet.ashbi.ca
2. Login with:
   - **Admin**: `admin@fleetflow.com` / `demo123`
   - **Fleet Manager**: `manager@josephsdelivery.com` / `demo123`
   - **Driver**: `driver.mrodriguez@josephsdelivery.com` / `demo123`

## 🎯 Why This Works for Single User:

1. **SQLite Database**: No need for PostgreSQL setup
2. **Simple Authentication**: Just needs the secret key
3. **All Data In-App**: Real fleet data already in code
4. **No External Dependencies**: Works completely self-contained

## 🔧 If Something Goes Wrong:

### Problem: "Database connection failed"
**Solution:** In Coolify terminal, run:
```bash
npx prisma db push --force
npm run seed
```

### Problem: "Authentication failed" / Login loop
**Solution:**
1. Clear browser cookies for fleet.ashbi.ca
2. Verify NEXTAUTH_SECRET matches exactly
3. Make sure NEXTAUTH_URL has no trailing slash

### Problem: "npm run seed" doesn't create data
**Solution:** Seed manually via API:
1. Login first (if possible) or use curl:
```bash
curl -X POST https://fleet.ashbi.ca/api/seed
```

## 📊 What You Get After Setup:

### ✅ Fully Functional Fleet Management:
- **6 Real Vehicles** with maintenance schedules
- **6 Active Deliveries** with detailed instructions  
- **6 Business Clients** with location details
- **12 User Accounts** for all roles
- **All buttons work** - no demo messages

### ✅ Real Features That Work:
- Google Maps navigation opens actual maps
- Driver calling opens phone dialer
- SOP upload shows file picker
- Route planning opens Google Maps with multi-stop
- Settings panel interactive
- Support shows real contact info

## 🚀 For Immediate Use:

1. **Login** as `admin@fleetflow.com` / `demo123`
2. **Explore** the dashboard with real data
3. **Test** any feature - they all work
4. **Start using** immediately for your fleet

## 📞 Need Help?

### Check These First:
1. **Coolify Logs**: Application → Logs tab
2. **Build Logs**: Application → Builds → Latest
3. **Terminal Output**: From the seed commands

### Quick Health Check:
```bash
# From Coolify terminal
curl -f http://localhost:3000/ && echo "✅ App running"
ls -la prod.db && echo "✅ Database exists"
```

---

**Time Estimate:** 5-10 minutes total  
**Complexity:** Very simple (3 environment variables)  
**Result:** Fully working fleet management system

Once these environment variables are set, your FleetFlow Pro will be 100% functional for immediate use!