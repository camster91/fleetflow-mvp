# FleetFlow SaaS Billing Infrastructure

This document describes the complete subscription billing, trial system, and payment infrastructure implemented using Stripe.

## Overview

The billing infrastructure includes:

- **Subscription Management**: Three-tier pricing (Starter, Professional, Enterprise)
- **Trial System**: 7-day free trial for new users
- **Stripe Integration**: Checkout sessions, customer portal, and webhooks
- **Feature Gates**: Plan-based feature access control
- **Invoice Management**: Payment history and PDF downloads

## Architecture

### Database Schema

```
User
├── Subscription (1:1)
│   ├── stripeCustomerId
│   ├── stripeSubscriptionId
│   ├── plan (STARTER/PROFESSIONAL/ENTERPRISE)
│   └── status (TRIAL/ACTIVE/CANCELLED/PAST_DUE/UNPAID)
└── Invoice[] (1:N)
```

### Pricing Tiers

| Plan | Monthly | Yearly | Vehicles | Users |
|------|---------|--------|----------|-------|
| Starter | $29 | $23 | 10 | 3 |
| Professional | $79 | $63 | 50 | 10 |
| Enterprise | $199 | $159 | Unlimited | Unlimited |

## Setup Instructions

### 1. Environment Variables

Add the following to your `.env.local`:

```env
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Price IDs (create these in Stripe Dashboard)
STRIPE_STARTER_MONTHLY_PRICE_ID=price_...
STRIPE_STARTER_YEARLY_PRICE_ID=price_...
STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID=price_...
STRIPE_PROFESSIONAL_YEARLY_PRICE_ID=price_...
STRIPE_ENTERPRISE_MONTHLY_PRICE_ID=price_...
STRIPE_ENTERPRISE_YEARLY_PRICE_ID=price_...

# Trial Configuration
TRIAL_DAYS=7
```

### 2. Stripe Setup

1. **Create a Stripe Account**: https://stripe.com
2. **Create Products and Prices**:
   - Go to Products → Add Product
   - Create three products: Starter, Professional, Enterprise
   - For each product, create monthly and yearly prices
   - Copy the price IDs to your environment variables

3. **Configure Webhooks**:
   - Go to Developers → Webhooks
   - Add endpoint: `https://yourdomain.com/api/stripe/webhook`
   - Select events:
     - `checkout.session.completed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 3. Local Development

1. **Install Stripe CLI**:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Windows
   scoop install stripe
   ```

2. **Login to Stripe**:
   ```bash
   stripe login
   ```

3. **Forward Webhooks Locally**:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. **Copy the webhook secret** output by the CLI to your `.env.local`

5. **Test Webhooks**:
   ```bash
   stripe trigger checkout.session.completed
   ```

## API Routes

### Checkout
- `POST /api/stripe/checkout-session` - Create checkout session
- `POST /api/stripe/customer-portal` - Access customer portal
- `POST /api/stripe/webhook` - Handle Stripe webhooks

### Subscription Management
- `GET /api/subscription/status` - Get current subscription status
- `POST /api/subscription/trial-start` - Start free trial
- `GET /api/subscription/invoices` - List invoices
- `POST /api/subscription/cancel` - Cancel subscription

## Pages

- `/pricing` - Public pricing page with checkout
- `/billing` - Subscription management dashboard
- `/billing/invoices` - Payment history

## Feature Gates

Use the `FeatureGate` component to conditionally show features:

```tsx
import { FeatureGate } from '@/components/billing/FeatureGate';

<FeatureGate 
  feature="advanced_analytics" 
  userPlan={subscription.plan.type}
>
  <AdvancedAnalytics />
</FeatureGate>
```

Or use the hook:

```tsx
import { useSubscription } from '@/hooks/useSubscription';

const { isFeatureEnabled, canAddVehicle } = useSubscription();

if (isFeatureEnabled('api_access')) {
  // Show API features
}

if (canAddVehicle(currentVehicleCount)) {
  // Allow adding vehicle
}
```

## Webhook Events

The system handles the following Stripe events:

1. **checkout.session.completed**: Activates subscription after payment
2. **invoice.paid**: Records payment and updates subscription status
3. **invoice.payment_failed**: Sets subscription to past_due
4. **customer.subscription.updated**: Syncs plan/period changes
5. **customer.subscription.deleted**: Cancels subscription

## Trial System

- New users can start a 7-day free trial (configurable via `TRIAL_DAYS`)
- During trial, users have full access to Starter features
- Trial banner shows days remaining with visual urgency indicators
- After trial expires, subscription status changes to `UNPAID`

## Security Considerations

1. **Webhook Verification**: All webhooks are verified using `STRIPE_WEBHOOK_SECRET`
2. **API Route Protection**: All billing APIs require authentication
3. **Customer Portal**: Users can only access their own customer portal
4. **No Client-Side Secrets**: Stripe secret key is never exposed to client

## Testing

### Test Cards

Use these Stripe test card numbers:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

### Test Webhook Script

```bash
npx ts-node scripts/test-webhook.ts
```

## Troubleshooting

### Webhook Errors

If webhooks aren't working:
1. Check `STRIPE_WEBHOOK_SECRET` is set correctly
2. Ensure webhook endpoint URL is correct
3. Verify webhook events are selected in Stripe Dashboard
4. Check server logs for signature verification errors

### Database Errors

If you see migration errors:
```bash
npx prisma migrate reset
npx prisma migrate dev --name add_subscriptions
```

### Subscription Not Updating

1. Check Stripe Dashboard for webhook delivery attempts
2. Verify webhook signature is being verified
3. Check database connection and permissions
4. Review server logs for errors

## Support

For billing issues:
- Stripe Dashboard: https://dashboard.stripe.com
- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com
