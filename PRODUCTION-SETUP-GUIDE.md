# 🚀 FleetFlow Pro - Complete Production Setup Guide

## Current Status
Your FleetFlow Pro application is deployed at: **https://fleet.ashbi.ca**

However, it's currently running with **SQLite database and default authentication settings**. For production use with real fleet operations, you need to:

1. **Set up PostgreSQL database** (for concurrent users and data durability)
2. **Configure secure authentication** (with proper NEXTAUTH_SECRET)
3. **Migrate to production database** (with real-world data already prepared)

## 📋 Step-by-Step Setup Instructions

### Step 1: Create PostgreSQL Database in Coolify

#### 1.1 Access Coolify Dashboard
1. Go to your Coolify instance (e.g., `https://coolify.yourdomain.com`)
2. Login with admin credentials

#### 1.2 Create PostgreSQL Resource
1. Click **"Resources"** in left sidebar
2. Click **"PostgreSQL"**
3. Click **"Create New PostgreSQL Database"**

#### 1.3 Configure Database
Use these exact settings:

| Setting | Value | Notes |
|---------|-------|-------|
| **Database Name** | `fleetflow_pro` | Required name |
| **Username** | `fleetflow_user` | Default username |
| **Password** | `Generate secure password` | **SAVE THIS PASSWORD** |
| **Version** | `PostgreSQL 15` or `16` | Recommended |
| **Network** | `internal` | For service communication |

#### 1.4 Save Connection Details
After creation, Coolify will show connection details. **Save these**:

```
Host: [something like postgres.internal.coolify]
Port: 5432
Database: fleetflow_pro
Username: fleetflow_user
Password: [your-generated-password]
```

### Step 2: Update Environment Variables

#### 2.1 Navigate to FleetFlow Pro Application
1. Go back to Coolify dashboard
2. Click **"Applications"** in left sidebar
3. Find and click on **"fleetflow-pro"** application

#### 2.2 Update Environment Variables
Go to **"Environment Variables"** tab and **ADD THESE EXACT VARIABLES**:

```env
# === AUTHENTICATION (CRITICAL) ===
NEXTAUTH_URL=https://fleet.ashbi.ca
NEXTAUTH_SECRET=k8eLErhObBcKlxVkExTfeZZu4xLCqcdkfM7Os9A/DCo=
NODE_ENV=production
PORT=3000

# === POSTGRESQL DATABASE ===
# REPLACE [HOST] and [PASSWORD] with your actual values from Step 1.4
DATABASE_URL=postgresql://fleetflow_user:[PASSWORD]@[HOST]:5432/fleetflow_pro?schema=public

# === APPLICATION SETTINGS ===
NEXT_PUBLIC_APP_NAME=FleetFlow Pro
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_BUILD_DATE=2026-02-24
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_MAINTENANCE_MODE=false
NEXT_PUBLIC_CSP_REPORT_ONLY=false
```

**Important Notes:**
- The `NEXTAUTH_SECRET` above is **already generated for you** - use it exactly as shown
- Replace `[PASSWORD]` with your actual PostgreSQL password
- Replace `[HOST]` with your actual PostgreSQL host (e.g., `postgres.internal.coolify`)
- **DO NOT** change the `NEXTAUTH_URL` - it must be exactly `https://fleet.ashbi.ca`

#### 2.3 Save and Redeploy
1. Click **"Save"** to update environment variables
2. Coolify will automatically redeploy the application

### Step 3: Database Migration

#### 3.1 Access Application Terminal
After redeployment completes:
1. Go to your FleetFlow Pro application in Coolify
2. Click **"Terminal"** tab
3. Wait for terminal connection to establish

#### 3.2 Run Migration Commands
Execute these commands **in order**:

```bash
# 1. Generate Prisma client
npx prisma generate

# 2. Push database schema to PostgreSQL
npx prisma db push

# 3. Seed database with real-world data
npm run seed
```

**Expected Output:**
- `Prisma Client Generated`
- `Database schema pushed successfully`
- `Created 12 users, 6 vehicles, 6 clients, 6 deliveries, 5 maintenance tasks`

#### 3.3 Verify Database Setup
Test the database connection:
```bash
# Check if tables were created
npx prisma studio
# Or check specific table counts
node -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  Promise.all([
    prisma.user.count(),
    prisma.vehicle.count(),
    prisma.client.count(),
    prisma.delivery.count()
  ]).then(counts => {
    console.log('Users:', counts[0]);
    console.log('Vehicles:', counts[1]);
    console.log('Clients:', counts[2]);
    console.log('Deliveries:', counts[3]);
    prisma.$disconnect();
  });
"
```

### Step 4: Verify Application

#### 4.1 Test Authentication
1. Visit: **https://fleet.ashbi.ca**
2. You should be redirected to login page
3. Test with these credentials:

| Role | Email | Password | Purpose |
|------|-------|----------|---------|
| **System Admin** | `admin@fleetflow.com` | `demo123` | Full system access |
| **Fleet Manager** | `manager@josephsdelivery.com` | `demo123` | Joseph Chen - manages fleet |
| **Dispatch** | `dispatch@josephsdelivery.com` | `demo123` | Sarah Johnson - assigns deliveries |
| **Driver** | `driver.mrodriguez@josephsdelivery.com` | `demo123` | Michael Rodriguez - Ford Transit 250 |
| **Driver** | `driver.sjohnson@josephsdelivery.com` | `demo123` | Sarah Johnson - Mercedes Sprinter |
| **Driver** | `driver.jwilson@josephsdelivery.com` | `demo123` | James Wilson - Ram ProMaster |

#### 4.2 Verify Real-World Data
After login, check:

1. **Dashboard**:
   - Should show 6 vehicles (4 active, 1 inactive, 1 delayed)
   - 2 maintenance tasks due
   - 6 active deliveries

2. **Vehicle Management**:
   - Real vehicles with license plates
   - Driver assignments match real drivers
   - Maintenance due indicators

3. **Delivery Tracking**:
   - Real clients (Downtown Bistro, TechCorp, etc.)
   - Detailed delivery instructions
   - Contact information for each delivery

4. **Client Database**:
   - 6 real clients with business details
   - Location coordinates and photos
   - Delivery preferences and requirements

#### 4.3 Test Key Features
1. **Google Maps Navigation**: Click "Navigate" on any delivery
2. **Driver Communication**: Click "Call Driver" (confirmation dialog)
3. **SOP Management**: Click "Upload SOP" (file picker opens)
4. **Route Planning**: Click "Plan Route" (opens Google Maps with multi-stop)
5. **Client Management**: View client details with location pins

### Step 5: Configure Backups (Recommended)

#### 5.1 Enable Automated Backups
1. Go back to PostgreSQL resource in Coolify
2. Click **"Backups"** tab
3. Enable **"Automated Backups"**
4. Configure:
   - **Frequency**: Daily
   - **Retention**: 30 days
   - **Storage**: Local or connect cloud storage

#### 5.2 Test Backup Restoration
```bash
# Manual backup test
pg_dump "$DATABASE_URL" > manual-backup.sql
echo "Backup created: manual-backup.sql"
```

## 🚨 Troubleshooting

### Issue: Application Won't Start
**Check deployment logs in Coolify:**
1. Application → Logs tab
2. Look for errors mentioning:
   - "Database connection failed"
   - "Invalid NEXTAUTH_SECRET"
   - "Prisma error"

**Common Solutions:**
1. **DATABASE_URL format**: Must be `postgresql://user:password@host:5432/database?schema=public`
2. **Network access**: PostgreSQL must be on `internal` network
3. **Password special characters**: URL-encode if password has special chars

### Issue: Authentication Fails
**Symptoms:**
- Login page errors
- Redirect loops
- "Invalid credentials"

**Solutions:**
1. **Verify NEXTAUTH_SECRET**: Must match exactly what's in environment variables
2. **Clear browser data**: Cookies/cache for fleet.ashbi.ca
3. **Check NEXTAUTH_URL**: Must be `https://fleet.ashbi.ca` (not http, no trailing slash)

### Issue: Database Empty After Migration
**Solutions:**
1. **Check seed output**: `npm run seed` should show created records
2. **Manual seed via API**: Login as admin, then visit `/api/seed`
3. **Reset and retry**:
   ```bash
   npx prisma migrate reset --force
   npx prisma db push
   npm run seed
   ```

## 🔧 Advanced Configuration

### Customizing for Your Fleet
1. **Update Vehicle Data**:
   - Edit `services/real-world-data.ts`
   - Add your actual vehicles and drivers
   - Redeploy application

2. **Add Your Clients**:
   - Use the "Add Client" button in application
   - Or bulk import via database scripts

3. **Configure Notifications**:
   - Email/SMS integration available
   - Webhook support for external systems

### Performance Optimization
1. **Database Indexes**: Already optimized in schema
2. **Caching**: Implement Redis for frequent queries
3. **CDN**: Static assets served via CDN

## 📞 Support Resources

### Immediate Help
1. **Application Logs**: Coolify → FleetFlow Pro → Logs
2. **Database Logs**: Coolify → PostgreSQL → Logs
3. **Deployment Status**: Coolify → Activity feed

### Documentation
- **FleetFlow Pro Docs**: [https://docs.fleetflow.com](https://docs.fleetflow.com)
- **Coolify Docs**: [https://coolify.io/docs](https://coolify.io/docs)
- **PostgreSQL Docs**: [https://www.postgresql.org/docs/](https://www.postgresql.org/docs/)

### Community
- **Coolify Discord**: Community support
- **GitHub Issues**: Bug reports and feature requests
- **Stack Overflow**: Tag with `fleetflow`

## ✅ Completion Checklist

- [ ] PostgreSQL database created in Coolify
- [ ] Environment variables set with correct values
- [ ] Database schema