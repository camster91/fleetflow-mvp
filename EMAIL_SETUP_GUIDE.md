# FleetFlow Email Auth Setup Guide

## 🚀 Current Status
- Code deployed with Mailgun support
- Test endpoint available at `/api/test-email`
- Need to configure environment variables in Coolify

---

## Step 1: Get Mailgun API Key

1. Go to https://app.mailgun.com/app/dashboard
2. Navigate to **Settings** → **API Keys**
3. Copy your **Private API Key** (starts with `key-`)

---

## Step 2: Configure Environment Variables in Coolify

1. Go to https://coolify.ashbi.ca/project/6
2. Click on **FleetFlow** service
3. Go to **Environment Variables** tab
4. Add these variables:

```bash
# Mailgun Configuration
MAILGUN_API_KEY=key-your-private-api-key-here
MAILGUN_DOMAIN=fleetflow.ashbi.ca
MAILGUN_BASE_URL=https://api.mailgun.net/v3
FROM_EMAIL=FleetFlow <notifications@fleetflow.ashbi.ca>
ADMIN_EMAILS=your-email@example.com
```

5. Click **Save** and **Redeploy**

---

## Step 3: Verify Domain in Mailgun (if not done)

If `fleetflow.ashbi.ca` isn't verified in Mailgun:

1. In Mailgun, go to **Sending** → **Domains**
2. Add domain: `fleetflow.ashbi.ca`
3. Add DNS records to your domain registrar (Cloudflare/GoDaddy):
   - MX records
   - TXT records for SPF/DKIM
4. Wait for verification (can take a few minutes to 24 hours)

**Alternative:** Use Mailgun sandbox domain for testing:
- Use sandbox domain like `sandbox123.mailgun.org`
- No DNS setup required
- Limited to authorized recipients only

---

## Step 4: Test Email Configuration

### Method 1: Using the Test Endpoint

```bash
curl -X POST https://fleet.ashbi.ca/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com"}'
```

Expected response if configured:
```json
{
  "success": true,
  "message": "Test email sent successfully",
  "details": {
    "to": "your-email@example.com",
    "from": "FleetFlow <notifications@fleetflow.ashbi.ca>",
    "timestamp": "2026-02-28T..."
  }
}
```

If not configured:
```json
{
  "error": "Email service not configured",
  "details": {
    "mailgunApiKey": "Not set",
    "mailgunDomain": "Not set"
  }
}
```

### Method 2: Test Full Registration Flow

1. Go to https://fleet.ashbi.ca/auth/register
2. Create a new account with your email
3. Check your inbox for verification email
4. Click the verification link
5. Login with your credentials

---

## Step 5: Troubleshooting

### Emails Not Sending

1. **Check Coolify logs:**
   - Go to Coolify → FleetFlow → Logs
   - Look for email-related errors

2. **Verify env vars are set:**
   ```bash
   # Should return the domain, not undefined
   curl https://fleet.ashbi.ca/api/test-email -X POST -d '{"email":"test@test.com"}'
   ```

3. **Check Mailgun logs:**
   - https://app.mailgun.com/app/logs
   - Look for delivery errors

### Common Issues

| Issue | Solution |
|-------|----------|
| "Email service not configured" | Add MAILGUN_API_KEY to Coolify env vars |
| "Domain not found" | Verify domain in Mailgun or use sandbox |
| "Unauthorized" | Check API key is correct (use Private key, not Public) |
| Emails in spam | Verify domain DNS records (SPF, DKIM, DMARC) |
| 401 Forbidden | API key may be incorrect or account suspended |

---

## Email Flow Summary

```
User Registration
      ↓
POST /api/auth/register
      ↓
Create user with verificationToken
      ↓
Send verification email via Mailgun
      ↓
User clicks /auth/verify-email/{token}
      ↓
Email verified → Welcome email sent
      ↓
User can login
```

---

## Testing Checklist

- [ ] Environment variables added to Coolify
- [ ] Application redeployed
- [ ] Test email endpoint returns success
- [ ] Registration sends verification email
- [ ] Verification link activates account
- [ ] Login works after verification
- [ ] Forgot password sends reset email
- [ ] Password reset works

---

## Security Notes

1. **Never commit API keys to git**
2. **Use Coolify's encrypted env vars**
3. **Rotate API keys periodically**
4. **Monitor Mailgun logs for abuse**

---

## Need Help?

- Mailgun Docs: https://documentation.mailgun.com/
- Coolify Docs: https://coolify.io/docs/
- Test endpoint: https://fleet.ashbi.ca/api/test-email
