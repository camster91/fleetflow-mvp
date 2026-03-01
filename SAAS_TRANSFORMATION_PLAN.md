# FleetFlow SaaS Transformation Plan

## 🎯 Vision
Transform FleetFlow MVP into a production-ready SaaS platform with marketing website, subscription billing, trial system, and enterprise-grade features.

---

## 📋 Phase 1: Marketing Website

### 1.1 Landing Page (`pages/index.tsx` - Public Marketing Site)
- **Hero Section**: Animated gradient background, headline, subheadline, CTA buttons
- **Social Proof**: Customer logos, testimonials, trust badges
- **Features Grid**: 6 key features with icons and descriptions
- **How It Works**: 3-step process visualization
- **Pricing Teaser**: Highlight popular plan with "View All Plans" CTA
- **Testimonials Carousel**: 3-5 customer quotes with photos
- **FAQ Section**: 8-10 common questions
- **Final CTA**: "Start Your Free Trial" section
- **Footer**: Links, newsletter signup, social icons

### 1.2 Features Page (`pages/features.tsx`)
- **Feature Categories**: Fleet Management, Maintenance, Reports, Integrations
- **Detailed Cards**: Screenshots + descriptions for each feature
- **Comparison Table**: Feature matrix across plans
- **Use Cases**: Industry-specific solutions (Trucking, Delivery, Logistics)

### 1.3 Pricing Page (`pages/pricing.tsx`)
- **3 Pricing Tiers**: Starter, Professional, Enterprise
- **Toggle**: Monthly/Annual billing (20% discount)
- **Feature Lists**: What's included in each tier
- **CTA Buttons**: "Start Free Trial" per tier
- **FAQ**: Billing-related questions
- **Money-back guarantee**: 30-day refund policy

### 1.4 About Page (`pages/about.tsx`)
- **Company Story**: Mission, vision, values
- **Team Section**: Founder photos and bios
- **Stats**: Users, vehicles tracked, countries
- **Contact Form**: Name, email, company, message

### 1.5 Blog Section (`pages/blog/index.tsx`, `pages/blog/[slug].tsx`)
- **Blog List**: Article cards with images, excerpts
- **Blog Post**: Full article with author, date, share buttons
- **Categories**: Fleet Management, Industry News, Tips

---

## 📋 Phase 2: SaaS Infrastructure & Billing

### 2.1 Database Schema Updates (Prisma)
```prisma
model Subscription {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id])
  stripeCustomerId  String   @unique
  stripeSubscriptionId String @unique
  plan              PlanType // STARTER, PROFESSIONAL, ENTERPRISE
  status            SubscriptionStatus // ACTIVE, CANCELLED, PAST_DUE
  trialEndsAt       DateTime?
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model Payment {
  id              String   @id @default(cuid())
  userId          String
  amount          Float
  currency        String   @default("USD")
  status          String
  stripePaymentId String   @unique
  createdAt       DateTime @default(now())
}
```

### 2.2 Stripe Integration
- **Stripe Setup**: Products, Prices, Webhooks
- **Checkout Flow**: Stripe Checkout sessions
- **Customer Portal**: Self-service billing management
- **Webhook Handlers**: subscription.updated, invoice.paid, etc.
- **API Routes**:
  - `POST /api/stripe/checkout-session`
  - `POST /api/stripe/customer-portal`
  - `POST /api/stripe/webhook`

### 2.3 Pricing Tiers

| Plan | Monthly | Annual | Features |
|------|---------|--------|----------|
| **Starter** | $29/mo | $23/mo ($276/yr) | Up to 10 vehicles, Basic reports, Email support |
| **Professional** | $79/mo | $63/mo ($756/yr) | Up to 50 vehicles, Advanced analytics, Priority support, API access |
| **Enterprise** | $199/mo | $159/mo ($1908/yr) | Unlimited vehicles, White-label, Dedicated support, Custom integrations |

### 2.4 Trial System
- **7-Day Free Trial**: Full access to Professional plan
- **Trial Countdown**: Banner showing days remaining
- **Trial Expiration**: Graceful downgrade to read-only
- **No Credit Card Required**: For trial signup

### 2.5 Usage Limits & Enforcement
- Vehicle count limits per plan
- Feature gating based on subscription tier
- API rate limits per tier

---

## 📋 Phase 3: Enhanced Authentication

### 3.1 Sign Up Flow (`pages/auth/register.tsx`)
- **Step 1**: Email, password, company name
- **Step 2**: Select plan (default to trial)
- **Step 3**: Verify email (send grid/mailgun)
- **Welcome Email**: Onboarding sequence starts

### 3.2 Login Enhancements
- **Remember Me**: 30-day session option
- **Social Login**: Google, Microsoft (SSO for Enterprise)
- **2FA**: TOTP with QR code setup
- **Password Reset**: Secure token-based reset flow

### 3.3 Email Verification
- **Verify Email Page**: Token validation
- **Resend Verification**: Rate-limited resend
- **Unverified Restrictions**: Limited access until verified

### 3.4 Password Reset Flow
- **Request Reset**: Email input form
- **Reset Email**: Secure link with 1-hour expiry
- **New Password Form**: Confirm password matching
- **Success**: Redirect to login with success message

---

## 📋 Phase 4: Enhanced Dashboard & Features

### 4.1 Onboarding Flow
- **Welcome Modal**: First-time user guidance
- **Setup Checklist**: 
  - [ ] Add first vehicle
  - [ ] Invite team members
  - [ ] Set up maintenance schedule
  - [ ] Connect integrations
- **Progress Bar**: % complete indicator
- **Skip Option**: "I'll do this later"

### 4.2 Team Management
- **Invite Members**: Email invitations
- **Role Management**: Admin, Manager, Driver, Viewer
- **Permission System**: Feature-level permissions
- **Activity Log**: Team member actions

### 4.3 Enhanced Settings
- **Profile Settings**: Avatar, name, email, password
- **Company Settings**: Logo, branding, timezone
- **Billing Settings**: Plan details, invoices, payment methods
- **Notification Preferences**: Email, push, in-app
- **Integrations**: Connect third-party services
- **API Keys**: Generate/manage API access

### 4.4 Notifications Center
- **In-app Notifications**: Bell icon with badge
- **Notification Types**: 
  - Maintenance due
  - Vehicle alerts
  - Team invites
  - Billing notifications
  - System updates
- **Mark as Read**: Individual and bulk actions
- **Preferences**: Control what to receive

### 4.5 Advanced Analytics
- **Dashboard Widgets**:
  - Fleet utilization %
  - Fuel cost trends
  - Maintenance cost breakdown
  - Driver performance scores
- **Custom Reports**: Date range, filters, export
- **Scheduled Reports**: Email daily/weekly/monthly

---

## 📋 Phase 5: Technical Infrastructure

### 5.1 Environment Configuration
```env
# Stripe
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (SendGrid/Mailgun)
SENDGRID_API_KEY=SG...
EMAIL_FROM=noreply@fleetflow.io

# App
NEXT_PUBLIC_APP_URL=https://fleet.ashbi.ca
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
TRIAL_DAYS=7
```

### 5.2 Middleware & Protection
- **Subscription Middleware**: Check active subscription
- **Trial Middleware**: Check trial status
- **Feature Gates**: Middleware for feature-specific routes
- **Rate Limiting**: API endpoint protection

### 5.3 API Enhancements
- **RESTful API**: Full CRUD for all resources
- **API Documentation**: Swagger/OpenAPI
- **API Versioning**: v1, v2 paths
- **Rate Limits**: Per-plan limits

### 5.4 Security Enhancements
- **CSRF Protection**: Double-submit cookies
- **SQL Injection Prevention**: Prisma ORM (already good)
- **XSS Protection**: Content Security Policy
- **Security Headers**: HSTS, X-Frame-Options, etc.

---

## 📋 Phase 6: Marketing Assets

### 6.1 Landing Page Images
- Hero illustration/3D mockup
- Feature screenshots (6)
- Team photos (if real, or stock)
- Customer testimonial photos

### 6.2 Video Content
- **Explainer Video**: 60-90 seconds
- **Product Demo**: Screen recording walkthrough
- **Tutorial Videos**: Feature-specific guides

### 6.3 Documentation
- **Help Center**: `/help` with searchable articles
- **API Docs**: Technical documentation
- **Changelog**: Product updates
- **Status Page**: System status

---

## 🎨 Design System Updates

### Color Palette (Keep Existing)
- Primary: #1E3A5F (Navy)
- Secondary: #3B82F6 (Blue)
- Accent: #10B981 (Green/Success)

### Typography
- Headings: Inter Bold/SemiBold
- Body: Inter Regular
- Keep existing font stack

### Components Needed
- Pricing Card component
- Feature Card component
- Testimonial Card component
- Trial Banner component
- Plan Badge component
- Usage Meter component

---

## 🚀 Deployment & Launch

### Pre-Launch Checklist
- [ ] Stripe account configured
- [ ] Email service connected
- [ ] All environment variables set
- [ ] SSL certificate valid
- [ ] Privacy policy & ToS pages
- [ ] GDPR compliance (cookie banner)

### Launch Phases
1. **Beta Launch**: Limited to 50 users, collect feedback
2. **Public Launch**: Open signups, marketing push
3. **Enterprise Launch**: Sales-led outreach

---

## 📊 Success Metrics

| Metric | Target |
|--------|--------|
| Signup Conversion | >5% |
| Trial to Paid | >20% |
| Churn Rate | <5% monthly |
| NPS Score | >50 |
| Support Response | <4 hours |

---

## 👥 Parallel Agent Tasks

### Agent 1: Marketing Website Developer
**Scope**: Landing, Features, Pricing, About, Blog pages
**Output**: Complete marketing site with responsive design

### Agent 2: SaaS Infrastructure Developer
**Scope**: Stripe integration, billing, subscriptions, trial system
**Output**: Working payment flow and subscription management

### Agent 3: Auth & Security Developer
**Scope**: Enhanced auth, 2FA, email verification, password reset
**Output**: Production-ready authentication system

### Agent 4: App Features Developer
**Scope**: Onboarding, team management, notifications, analytics
**Output**: Enhanced dashboard with all SaaS features

---

**Ready to spawn agents!** 🚀
