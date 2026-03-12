# FleetFlow Pro - Supabase Auth Setup Guide

This guide will walk you through migrating from NextAuth.js to Supabase Auth.

## Why Supabase Auth?

Supabase Auth provides several advantages:
- ✅ Built-in email verification
- ✅ Password reset functionality
- ✅ OAuth providers (Google, Microsoft, etc.)
- ✅ Magic link authentication
- ✅ Phone authentication
- ✅ Row Level Security (RLS) integration
- ✅ No need to manage JWT secrets

## Prerequisites

1. Supabase project already created (you have one at `vmvojkmaiuwidrduiotn`)
2. Your project URL and Anon Key

## Setup Steps

### 1. Deploy the Supabase Auth Code

Run the deployment script:
```bash
./deploy-supabase-auth.sh
```

This will deploy:
- New `SupabaseAuthContext` for React state management
- Updated login/register pages
- Password reset functionality
- Middleware for protected routes
- Auth callback handler

### 2. Configure Supabase Auth Settings

1. Go to your Supabase Dashboard:
   https://supabase.com/dashboard/project/vmvojkmaiuwidrduiotn

2. Navigate to **Authentication → URL Configuration**:
   - Site URL: `https://fleet.ashbi.ca`
   - Redirect URLs: Add `https://fleet.ashbi.ca/auth/callback`

3. Navigate to **Authentication → Email Templates**:
   
   **Confirmation Email Template:**
   ```html
   <h2>Confirm your email</h2>
   <p>Follow this link to confirm your email:</p>
   <p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
   ```
   
   **Reset Password Email Template:**
   ```html
   <h2>Reset your password</h2>
   <p>Follow this link to reset your password:</p>
   <p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
   ```

4. Navigate to **Authentication → Providers**:
   - Enable Email provider (already enabled by default)
   - Optionally enable Google, Azure, or other OAuth providers

### 3. Update Coolify Environment Variables

Go to your Coolify dashboard and update the environment variables:

**Remove these (no longer needed):**
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

**Keep these (already configured):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Add these new ones:**
```
HOST=0.0.0.0
NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=false
```

### 4. Test the Authentication

1. Visit: https://fleet.ashbi.ca/auth/register
2. Create a new test account
3. Check your email for the verification link
4. Click the verification link
5. You should be redirected to the dashboard

### 5. Migrate Existing Users (Optional)

Existing users in your SQLite database need to be migrated to Supabase Auth. You have two options:

#### Option A: Manual Password Reset (Recommended)
Have existing users reset their passwords:
1. They visit: https://fleet.ashbi.ca/auth/forgot-password
2. Enter their email
3. Click the reset link in their email
4. Set a new password

#### Option B: Automated Migration
Create a migration script that imports users to Supabase Auth. Note: This requires users to set new passwords since we can't decrypt existing bcrypt passwords.

### 6. Enable OAuth Providers (Optional)

To enable Google or Microsoft login:

1. Go to **Authentication → Providers** in Supabase Dashboard
2. Enable Google:
   - Get credentials from Google Cloud Console
   - Add Client ID and Secret
3. Enable Azure (Microsoft):
   - Get credentials from Azure Portal
   - Add Client ID, Secret, and Tenant URL

## API Usage

### Client-Side (React Components)

```tsx
import { useAuth } from '../context/SupabaseAuthContext';

function MyComponent() {
  const { user, signIn, signOut, isAuthenticated } = useAuth();
  
  // Check authentication
  if (!isAuthenticated) return <LoginPrompt />;
  
  // Access user data
  console.log(user.email);
  console.log(user.user_metadata.role);
  
  return <div>Welcome, {user.email}</div>;
}
```

### Server-Side (API Routes)

```tsx
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req, res) {
  const supabase = createPagesServerClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // User is authenticated
  const user = session.user;
  // ... handle request
}
```

## Protected Routes

The `middleware.ts` file automatically protects routes:
- Public routes: `/`, `/auth/*`, `/about`, etc.
- Protected routes: `/dashboard`, `/vehicles`, `/deliveries`, etc.

Users who aren't authenticated will be redirected to `/auth/login`.

## User Roles

Roles are stored in `user.user_metadata.role`:
- `admin` - Full system access
- `fleet_manager` - Vehicle and maintenance management
- `dispatch` - Delivery assignments
- `driver` - View assignments
- `maintenance` - Repair orders
- `safety_officer` - Compliance monitoring
- `finance` - Payroll and reporting

## Troubleshooting

### Login Not Working
1. Check browser console for errors
2. Verify Supabase URL and Anon Key are correct
3. Check Supabase Auth settings for correct redirect URLs

### Email Not Received
1. Check spam/junk folders
2. Verify email templates in Supabase Dashboard
3. Check Supabase Auth logs for delivery errors

### OAuth Not Working
1. Verify OAuth credentials are correct
2. Check redirect URLs match exactly
3. Ensure OAuth provider is enabled in Supabase

### CORS Errors
Add your domain to Supabase CORS settings:
1. Go to Settings → API
2. Add `https://fleet.ashbi.ca` to allowed origins

## Security Considerations

1. **Service Role Key**: Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code
2. **RLS Policies**: Enable Row Level Security on your database tables
3. **HTTPS**: Always use HTTPS in production
4. **Environment Variables**: Keep sensitive keys in environment variables only

## Migration Checklist

- [ ] Deploy Supabase Auth code
- [ ] Configure Supabase Auth settings
- [ ] Update Coolify environment variables
- [ ] Test registration flow
- [ ] Test login flow
- [ ] Test password reset flow
- [ ] Test email verification
- [ ] Migrate existing users (optional)
- [ ] Enable OAuth providers (optional)
- [ ] Update documentation for users

## Support

- Supabase Auth Docs: https://supabase.com/docs/guides/auth
- Auth Helpers Next.js: https://supabase.com/docs/guides/auth/auth-helpers/nextjs
- FleetFlow Issues: Create a GitHub issue
