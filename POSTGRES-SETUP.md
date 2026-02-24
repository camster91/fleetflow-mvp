# 🐘 PostgreSQL Database Setup for FleetFlow Pro

## Why PostgreSQL for Production?

SQLite is great for development, but for production use with FleetFlow Pro, you need:
- **Concurrent connections** - Multiple users accessing data simultaneously
- **Data durability** - ACID compliance and crash recovery
- **Scalability** - Handle growing fleet data over time
- **Backup & Recovery** - Built-in backup solutions
- **Security** - Row-level security and proper authentication

## Setting Up PostgreSQL in Coolify

### Step 1: Create PostgreSQL Database in Coolify

1. In Coolify dashboard, go to **Resources** → **PostgreSQL**
2. Click **"Create New PostgreSQL Database"**
3. Configure:
   - **Database Name**: `fleetflow_pro`
   - **Username**: `fleetflow_user` (or your preferred name)
   - **Password**: Generate secure password (save this!)
   - **Version**: PostgreSQL 15+ (recommended)

4. Note the connection details:
   - **Host**: (provided by Coolify)
   - **Port**: 5432 (usually)
   - **Database Name**: `fleetflow_pro`
   - **Username**: `fleetflow_user`
   - **Password**: (your generated password)

### Step 2: Update Environment Variables

In your FleetFlow Pro application settings in Coolify, update these variables:

```env
# Replace SQLite with PostgreSQL
DATABASE_URL="postgresql://fleetflow_user:YOUR_PASSWORD@HOST:5432/fleetflow_pro?schema=public"

# Keep other variables
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secure-secret-here
```

### Step 3: Update Prisma Schema

The current Prisma schema is configured for SQLite. Update `prisma/schema.prisma`:

```prisma
// Change from:
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// To:
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Step 4: Deploy Database Schema

1. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

2. **Push Schema to Database**:
   ```bash
   npx prisma db push
   ```

3. **Create Initial Migration** (optional but recommended):
   ```bash
   npx prisma migrate dev --name init
   ```

### Step 5: Seed the Database

After deployment, seed the database with real-world data:

```bash
# Via Coolify terminal
npm run seed

# Or via API (after logging in as admin)
curl -X POST https://your-domain.com/api/seed
```

## Database Schema Overview

### Core Tables
1. **Users** - Authentication and role management
2. **Vehicles** - Fleet vehicles with detailed attributes
3. **Drivers** - Driver profiles and assignments
4. **Clients** - Customer database with location intelligence
5. **Deliveries** - Active and historical deliveries
6. **MaintenanceTasks** - Vehicle maintenance scheduling
7. **SOPCategories** - Standard Operating Procedures
8. **Announcements** - System-wide communications

## Data Migration from SQLite

If you have existing SQLite data you want to migrate:

1. **Export SQLite data**:
   ```bash
   sqlite3 dev.db .dump > backup.sql
   ```

2. **Transform for PostgreSQL**:
   - Remove SQLite-specific syntax
   - Adjust data types (INTEGER → SERIAL, etc.)
   - Update timestamp formats

3. **Import to PostgreSQL**:
   ```bash
   psql -h HOST -U fleetflow_user -d fleetflow_pro -f transformed_backup.sql
   ```

## Backup Strategy

### Automated Backups with Coolify
Coolify provides automated backups. Configure:
- **Frequency**: Daily
- **Retention**: 30 days
- **Storage**: Cloud storage (S3 compatible)

### Manual Backup Commands
```bash
# Export database
pg_dump -h HOST -U fleetflow_user fleetflow_pro > fleetflow_backup_$(date +%Y%m%d).sql

# Compress backup
gzip fleetflow_backup_$(date +%Y%m%d).sql
```

## Performance Optimization

### Recommended Indexes
```sql
-- For frequent queries
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_maintenance_due ON maintenance_tasks(due_date) WHERE completed = false;
CREATE INDEX idx_clients_name ON clients(name);
```

### Connection Pooling
Configure Prisma connection pool in `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  relationMode = "prisma"
}
```

## Monitoring & Maintenance

### Key Metrics to Monitor
- **Active connections** (should be < 90% of max_connections)
- **Query performance** (slow queries > 100ms)
- **Disk usage** (should have 20% free space)
- **Replication lag** (if using replication)

### Regular Maintenance Tasks
1. **Weekly**: `VACUUM ANALYZE` (autovacuum usually handles this)
2. **Monthly**: Check for unused indexes
3. **Quarterly**: Review query performance
4. **Annually**: Major version upgrade planning

## Troubleshooting

### Common Issues

#### 1. Connection Errors
```bash
# Test connection
psql -h HOST -U fleetflow_user -d fleetflow_pro -c "SELECT 1;"

# Check environment variables
echo $DATABASE_URL
```

#### 2. Authentication Failures
- Verify username/password in Coolify
- Check IP whitelist if using network restrictions
- Confirm SSL/TLS settings match

#### 3. Schema Migration Failures
```bash
# Reset and retry
npx prisma migrate reset --force
npx prisma db push
```

#### 4. Performance Issues
```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

## Security Considerations

1. **Network Security**:
   - Restrict database access to application servers only
   - Use SSL/TLS for all connections
   - Regular security updates

2. **Access Control**:
   - Use least-privilege principle for database users
   - Regular audit of user permissions
   - Secure credential storage

3. **Data Protection**:
   - Encrypt sensitive data at rest
   - Regular security scanning
   - Compliance with data protection regulations

## Support

For database issues:
1. Check Coolify database logs
2. Review application error logs
3. Consult PostgreSQL documentation
4. Contact Coolify support for infrastructure issues

## Next Steps After Setup

1. **Test thoroughly** with real-world scenarios
2. **Monitor performance** for first 48 hours
3. **Set up alerts** for critical issues
4. **Document** any custom configurations
5. **Train team** on backup/restore procedures