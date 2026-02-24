# 🐘 Coolify PostgreSQL Setup Guide for FleetFlow Pro

## Prerequisites
- Coolify instance running (self-hosted or cloud)
- Access to Coolify dashboard with admin privileges
- FleetFlow Pro application already deployed on Coolify

## Step 1: Create PostgreSQL Database

### 1.1 Navigate to PostgreSQL Resources
1. Login to your Coolify dashboard
2. Click on **"Resources"** in the left sidebar
3. Select **"PostgreSQL"** from the resource list

### 1.2 Create New Database
1. Click **"Create New PostgreSQL Database"** button
2. Fill in the configuration:

| Setting | Value | Notes |
|---------|-------|-------|
| **Database Name** | `fleetflow_pro` | Keep this exact name |
| **Username** | `fleetflow_user` | Default or choose your own |
| **Password** | Generate secure password | **SAVE THIS PASSWORD** |
| **Version** | PostgreSQL 15+ | Recommended: 15 or 16 |
| **Network** | `internal` | For internal service communication |

3. Click **"Create Database"**

### 1.3 Save Connection Details
Coolify will display connection details. **Save these somewhere secure**:

```
Host: postgres.internal.coolify (or your specific host)
Port: 5432
Database: fleetflow_pro
Username: fleetflow_user
Password: [your-generated-password]
```

## Step 2: Update FleetFlow Pro Application

### 2.1 Navigate to Application
1. Go back to Coolify dashboard
2. Click on **"Applications"** in left sidebar
3. Find and click on your **"fleetflow-pro"** application

### 2.2 Update Environment Variables
1. Click on **"Environment Variables"** tab
2. Remove any existing `DATABASE_URL` variable
3. Add these new variables:

```env
# Required for authentication
NEXTAUTH_URL=https://fleet.ashbi.ca
NEXTAUTH_SECRET=your-generated-secret-here
NODE_ENV=production
PORT=3000

# PostgreSQL Database Connection
DATABASE_URL=postgresql://fleetflow_user:YOUR_PASSWORD@postgres.internal.coolify:5432/fleetflow_pro?schema=public
```

**Important Notes:**
- Replace `YOUR_PASSWORD` with the actual password from Step 1.3
- Replace `postgres.internal.coolify` with your actual host if different
- For `NEXTAUTH_SECRET`, generate a secure random string:
  ```bash
  openssl rand -base64 32
  ```
  Or use: `fallback-secret-$(date +%s)-$RANDOM`

### 2.3 Save and Redeploy
1. Click **"Save"** to update environment variables
2. Coolify will automatically redeploy the application with new variables

## Step 3: Database Migration

### 3.1 Access Application Terminal
1. In your FleetFlow Pro application page
2. Click on **"Terminal"** tab
3. Wait for connection to establish

### 3.2 Run Migration Commands
Execute these commands in order:

```bash
# 1. Generate Prisma client
npx prisma generate

# 2. Push database schema
npx prisma db push

# 3. Seed database with real-world data
npm run seed
```

**Expected Output:**
```
✅ Prisma Client Generated
✅ Database schema pushed successfully
✅ Created 12 users, 6 vehicles, 6 clients, 6 deliveries
```

### 3.3 Alternative: Seed via API
If `npm run seed` doesn't work, seed via API after deployment:
1. Wait for application to be fully deployed
2. Visit: `https://fleet.ashbi.ca/auth/login`
3. Login with: `admin@fleetflow.com` / `demo123`
4. Open browser dev tools → Console
5. Run: `fetch('/api/seed', { method: 'POST' })`

## Step 4: Verification

### 4.1 Test Application
1. Visit `https://fleet.ashbi.ca`
2. You should be redirected to login page
3. Test login credentials:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@fleetflow.com` | `demo123` |
| Fleet Manager | `manager@josephsdelivery.com` | `demo123` |
| Dispatch | `dispatch@josephsdelivery.com` | `demo123` |
| Driver | `driver.mrodriguez@josephsdelivery.com` | `demo123` |

### 4.2 Verify Data Loaded
After login, check:
- ✅ Dashboard shows 6 active vehicles
- ✅ Delivery tab shows 6 deliveries (2 pending, 3 in-transit, 1 delivered)
- ✅ Clients tab shows 6 real clients with location details
- ✅ Maintenance shows 5 scheduled tasks

### 4.3 Test Key Features
1. **Vehicle Tracking**: Click any vehicle → View details
2. **Delivery Management**: Click "Navigate" on a delivery → Opens Google Maps
3. **Client Database**: View client details → See location pins
4. **Driver Communication**: Click "Call Driver" → Confirmation dialog

## Step 5: Configure Backups (Recommended)

### 5.1 Enable Automated Backups
1. Go back to PostgreSQL resource page
2. Click on **"Backups"** tab
3. Enable **"Automated Backups"**
4. Configure:
   - **Frequency**: Daily
   - **Retention**: 30 days
   - **Storage**: Local or cloud storage

### 5.2 Manual Backup (Optional)
```bash
# Connect via terminal and export
pg_dump -h postgres.internal.coolify -U fleetflow_user fleetflow_pro > backup.sql
```

## Troubleshooting

### Issue: Database Connection Failed
**Symptoms:**
- Application fails to start
- Logs show "Database connection failed"
- Authentication errors

**Solutions:**
1. **Verify Connection String**:
   ```bash
   # Test connection from Coolify terminal
   psql "$DATABASE_URL" -c "SELECT 1;"
   ```

2. **Check Network Access**:
   - Ensure PostgreSQL is on `internal` network
   - Application can access PostgreSQL service

3. **Reset Database** (if needed):
   ```bash
   npx prisma migrate reset --force
   npx prisma db push
   npm run seed
   ```

### Issue: Authentication Not Working
**Symptoms:**
- Login page shows errors
- Redirect loops
- "Invalid credentials" even with correct password

**Solutions:**
1. **Verify NEXTAUTH_SECRET**:
   - Must be the same across all instances
   - Regenerate if unsure: `openssl rand -base64 32`

2. **Check NEXTAUTH_URL**:
   - Must exactly match your domain: `https://fleet.ashbi.ca`
   - No trailing slash

3. **Clear Browser Data**:
   - Clear cookies and cache for the domain

### Issue: Data Not Loading
**Symptoms:**
- Empty dashboard
- "No data available" messages
- Tables show 0 entries

**Solutions:**
1. **Check Seed Execution**:
   ```bash
   # In Coolify terminal
   npm run seed
   # Check for errors
   ```

2. **Manual Data Verification**:
   ```bash
   # Check if tables have data
   psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"User\";"
   psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"Vehicle\";"
   ```

## Performance Optimization

### Database Indexes (Already in Schema)
The Prisma schema includes optimal indexes for:
- Vehicle status queries
- Delivery status and timing
- Client search operations
- Maintenance due dates

### Connection Pooling
Prisma automatically manages connection pooling. Monitor in Coolify:
- **Active Connections**: Should be < 90% of max_connections (default 100)
- **Query Performance**: Check for slow queries > 100ms

## Monitoring

### Key Metrics to Watch
1. **Database Size**: Should grow slowly with usage
2. **Active Connections**: Peak during business hours
3. **Query Performance**: Most queries < 50ms
4. **Backup Status**: Daily backups completing successfully

### Coolify Monitoring Tools
1. **Resource Graphs**: CPU, Memory, Disk usage
2. **Log Viewer**: Application and database logs
3. **Alert Rules**: Set up alerts for critical issues

## Support Resources

### Documentation
- [FleetFlow Pro Docs](https://docs.fleetflow.com)
- [Coolify Documentation](https://coolify.io/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

### Community Support
- Coolify Discord community
- GitHub Issues for FleetFlow Pro
- Stack Overflow (tag: fleetflow, coolify)

### Emergency Contacts
1. **Coolify Support**: Via dashboard or Discord
2. **Database Issues**: PostgreSQL logs in Coolify
3. **Application Issues**: Check deployment logs

## Next Steps After Setup

### 1. User Training
- Train drivers on mobile interface
- Train dispatchers on client management
- Train managers on reporting features

### 2. Data Migration (If Needed)
If migrating from existing system:
1. Export existing data to CSV
2. Use Prisma scripts to import
3. Validate data integrity

### 3. Customization
- Add company logo and branding
- Configure custom notification rules
- Set up specific delivery workflows

### 4. Scaling Plan
- Monitor performance for 1 week
- Plan for additional features
- Consider load balancing if user count grows

---

**✅ Setup Complete!** Your FleetFlow Pro is now running on PostgreSQL with production-ready configuration. All real-world data is loaded and the system is ready for daily operations.