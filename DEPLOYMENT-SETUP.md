# 🚀 FleetFlow Pro - Production Deployment Setup

## Critical Environment Variables

For authentication to work in production, you **MUST** set these environment variables in your deployment platform (Coolify, Vercel, Railway, etc.):

### 1. **NextAuth.js Configuration (REQUIRED)**
```
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secure-nextauth-secret-key-here
```

**How to generate NEXTAUTH_SECRET:**
```bash
# Generate a secure secret (32+ characters)
openssl rand -base64 32
```

### 2. **Database Configuration**
```
# For SQLite (development/testing):
DATABASE_URL="file:./prod.db"

# For PostgreSQL (production):
# DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
```

### 3. **Application Settings**
```
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_NAME=FleetFlow Pro
NEXT_PUBLIC_APP_VERSION=1.0.0
```

## 🛠️ Coolify Deployment Checklist

### Step 1: Environment Variables
1. Go to your Coolify application dashboard
2. Click "Environment Variables"
3. Add ALL variables from `.env.production`
4. **CRITICAL**: Set `NEXTAUTH_SECRET` to a secure random string
5. Set `NEXTAUTH_URL` to your actual domain (e.g., `https://fleet.ashbi.ca`)

### Step 2: Database Initialization
The application uses SQLite by default. To initialize the database:

1. **Option A: Use the seed API** (requires authentication):
   ```bash
   # First login as admin, then:
   curl -X POST https://your-domain.com/api/seed
   ```

2. **Option B: Manual seed via Coolify terminal**:
   - Open Coolify application terminal
   - Run: `npm run seed`
   - This creates demo users with credentials `email@fleetflow.com / demo123`

### Step 3: Verify Authentication
1. Visit `https://your-domain.com/auth/login`
2. Try demo login buttons
3. You should be redirected to dashboard after login

## 🔧 Troubleshooting

### Issue: "404 Not Found" on API routes
- Check if middleware is blocking routes
- Verify `NEXTAUTH_SECRET` is set correctly
- Check application logs for authentication errors

### Issue: Authentication redirect loop
- Ensure `NEXTAUTH_URL` matches your actual domain exactly
- Verify `NEXTAUTH_SECRET` is the same across all instances (if load balanced)

### Issue: Database not persisting
- Check file permissions for SQLite database
- For Docker deployments, ensure volume is mounted correctly
- Consider switching to PostgreSQL for production

### Issue: Demo messages still appearing
- The application shows brief toast notifications for features that would be fully functional in production
- These are intentional to demonstrate what would happen
- To remove them, implement the actual features

## 📊 Feature Status

### ✅ Fully Functional
- Vehicle management (CRUD)
- Delivery tracking (CRUD)  
- Maintenance scheduling (CRUD)
- SOP library (CRUD)
- Role-based dashboards
- Real-time notifications
- Mobile-responsive design

### 🔧 Demo/Placeholder Features
- Google Maps integration (demo navigation)
- Route planning (stub)
- SOP upload (stub)
- Driver calling (stub)
- Settings panel (stub)
- Support/Help (stub)

### 🚧 Coming Soon
- Client database with location photos/pins
- Real Google Maps API integration
- Email/SMS notifications
- Advanced reporting
- Multi-company support

## 🚨 Emergency Access

If authentication breaks and you can't login:

1. **Disable middleware temporarily**:
   - Comment out the middleware in `middleware.ts`
   - Redeploy
   - Access the site, seed database, then re-enable middleware

2. **Direct database access**:
   - Connect to SQLite database
   - Manually create a user with hashed password

## 📞 Support

For deployment issues:
1. Check application logs in Coolify
2. Review this document
3. Check GitHub Issues for known problems
4. Contact development team