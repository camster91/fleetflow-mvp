# FleetFlow MVP

**A modern SaaS platform for fleet management, dispatch operations, and logistics tracking.**

FleetFlow MVP is a production-ready fleet management system designed to streamline logistics operations. Built with Next.js 15 and featuring real-time dashboards, intelligent dispatching, and comprehensive analytics, it provides fleet managers with the tools needed for efficient operations.

## Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - Latest React with server components
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Data visualization and charts
- **Lucide React** - Modern icon library

### Backend & Database
- **Prisma** - Type-safe ORM for PostgreSQL
- **PostgreSQL** - Primary database
- **NextAuth.js** - Authentication with Prisma adapter

### Services & Integrations
- **Stripe** - Payment processing and subscription billing
- **SendGrid/Mailgun** - Email delivery services
- **QRCode** - QR code generation for driver/vehicle identification

### Security
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT token management
- **Speakeasy** - Two-factor authentication (TOTP)
- **rate-limiter-flexible** - API rate limiting protection
- **Helmet** - HTTP security headers

### Testing
- **Jest** - Unit testing framework
- **Playwright** - End-to-end testing
- **Testing Library** - React component testing

## Key Features

### Fleet Management
- Vehicle tracking and status management
- Driver assignment and coordination
- Real-time fleet overview dashboard
- Vehicle maintenance scheduling

### Dispatch System
- Intelligent job dispatching
- Route optimization tools
- Driver availability tracking
- Job status monitoring

### Analytics Dashboard
- Fleet performance metrics
- Revenue and operational reports
- Visual data charts
- Custom reporting capabilities

### Authentication & Security
- Secure user authentication with NextAuth
- Two-factor authentication (2FA) support
- Role-based access control
- API rate limiting protection

### Billing & Subscriptions
- Stripe-powered payment processing
- Subscription tier management
- Invoice generation
- Payment history tracking

## Installation

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Stripe account (for payments)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/camster91/fleetflow-mvp.git
   cd fleetflow-mvp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Required environment variables:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/fleetflow"
   NEXTAUTH_SECRET="your-secret-key-here"
   NEXTAUTH_URL="http://localhost:3000"
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."
   SENDGRID_API_KEY="SG..."
   ```

4. **Initialize the database**
   ```bash
   npx prisma generate
   npx prisma db push
   npm run db:seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

Visit `http://localhost:3000` to access the application.

## Usage

### Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report
npm run test:e2e     # Run Playwright e2e tests
```

### Database Management

```bash
npm run db:push      # Push schema changes to database
npm run db:seed      # Seed database with sample data
npm run db:studio    # Open Prisma Studio GUI
```

### API Endpoints

RESTful API routes available at `/api/`:
- `GET/POST /api/fleet` - Fleet operations
- `GET/PUT/DELETE /api/fleet/:id` - Single fleet item
- `GET/POST /api/dispatch` - Dispatch operations
- `GET/POST /api/drivers` - Driver management
- `GET/POST /api/analytics` - Reporting data

## Project Structure

```
fleetflow-mvp/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Protected dashboard routes
│   ├── api/               # API route handlers
│   └── layout.tsx         # Root layout
├── components/            # Reusable UI components
├── lib/                   # Utility functions
├── prisma/                # Database schema and seeds
│   ├── schema.prisma      # Prisma schema definition
│   └── seed.ts           # Database seeding script
├── public/                # Static assets
└── scripts/               # Utility scripts
```

## Deployment

### Docker

```bash
docker build -t fleetflow-mvp .
docker run -p 3000:3000 --env-file .env.production fleetflow-mvp
```

### Coolify / Self-Hosted

See `DEPLOYMENT-CHECKLIST.md` and `COOLIFY-POSTGRES-GUIDE.md` for detailed deployment instructions.

## Roadmap

- [ ] Integrate GlowOS text-to-speech for automated dispatch calls
- [ ] Implement comprehensive driver mobile app view
- [ ] Finalize multi-tenant architecture for SaaS release
- [ ] Add real-time GPS tracking integration
- [ ] Implement route optimization algorithms

## License

Private - This project is proprietary and confidential.

## Author

Developed by Cameron Ashley / Nexus AI.
