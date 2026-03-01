# FleetFlow Pricing Model Update

## Overview
Updated FleetFlow from a 3-tier pricing model ($29/$79/$199) to a simplified 2-tier model:

- **Per User**: $50/user/month ($40/user/month with yearly billing - 20% discount)
- **Unlimited**: $200/month flat rate ($160/month with yearly billing - 20% discount)

## Break-Even Point
- With **4 or fewer users**: Per User plan is more cost-effective (4 × $50 = $200)
- With **5 or more users**: Unlimited plan provides better value

## Files Updated

### Configuration
- `config/pricing.ts` - New pricing plans, helper functions, price calculator
- `lib/subscription.ts` - Updated PlanType to PER_USER/UNLIMITED
- `types/index.ts` - Updated PlanType enum
- `prisma/schema.prisma` - Updated default plan type
- `prisma/migrations/*.sql` - Updated default plan in migration

### Pages
- `pages/pricing.tsx` - New 2-tier pricing page with user count calculator
- `pages/billing/index.tsx` - Updated to show correct plan details

### Components
- `components/billing/FeatureGate.tsx` - Updated fallback plan reference

### Hooks
- `hooks/useSubscription.ts` - Updated feature access mapping

### API
- `pages/api/subscription/status.ts` - Updated default plan type
- `pages/api/stripe/webhook.ts` - Uses getPlanTypeFromStripePriceId

### Library
- `lib/trial.ts` - Updated default plan for trial subscriptions

### Scripts
- `scripts/test-webhook.ts` - Updated mock data

## Environment Variables Required

```bash
# Stripe Keys
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Per User Plan Price IDs
STRIPE_PERUSER_MONTHLY_PRICE_ID=price_...
STRIPE_PERUSER_YEARLY_PRICE_ID=price_...

# Unlimited Plan Price IDs
STRIPE_UNLIMITED_MONTHLY_PRICE_ID=price_...
STRIPE_UNLIMITED_YEARLY_PRICE_ID=price_...
```

## Stripe Setup Instructions

1. **Create Products in Stripe Dashboard:**
   - Product: "FleetFlow Per User"
     - Monthly: $50.00 per user
     - Yearly: $480.00 per user ($40/month, 20% discount)
   - Product: "FleetFlow Unlimited"
     - Monthly: $200.00 flat
     - Yearly: $1,920.00 ($160/month, 20% discount)

2. **Get Price IDs:**
   - Navigate to each product in Stripe Dashboard
   - Copy the Price IDs for each pricing option

3. **Set Environment Variables:**
   - Add the Price IDs to your environment variables
   - Update Coolify deployment with new env vars

4. **Test the Integration:**
   - Use test mode first
   - Create test checkout sessions
   - Verify webhook handling

## Migration Notes

- Existing subscriptions with old plan types (STARTER/PROFESSIONAL/ENTERPRISE) will continue to work
- The mapping functions handle legacy plan types:
  - STARTER/PROFESSIONAL → PER_USER
  - ENTERPRISE → UNLIMITED
- New trials will be created with PER_USER plan

## Features by Plan

### Both Plans Include:
- Unlimited vehicles
- Maintenance tracking
- Delivery management
- Team collaboration
- Basic and advanced analytics
- Mobile app access
- Email support

### Unlimited Plan Additional Features:
- Unlimited users (flat rate)
- White-label options
- Dedicated account manager
- SLA guarantee
- API access
- Priority support
- Custom reports
- Advanced security features
