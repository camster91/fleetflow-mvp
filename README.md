# FleetFlow Pro - Fleet Management MVP

A modern fleet management dashboard for food truck delivery services and similar operations. This MVP demonstrates the core features outlined in the audio transcription and development plan.

## 🚀 Quick Start

```bash
# Clone and setup
git clone <repository-url>
cd fleetflow-mvp
npm install

# Run development server
npm run dev

# Or deploy with Docker
./deploy.sh run  # Linux/macOS
.\deploy.ps1 run # Windows

# The app will be available at http://localhost:3000
```

## 🚀 Simple Production Setup (Single User)

**⚠️ CRITICAL: Authentication needs 3 environment variables**
The application is deployed at https://fleet.ashbi.ca but needs NEXTAUTH_SECRET to work.

### Quick 5-Minute Setup for Single User:
1. **Add these environment variables** in Coolify (Applications → fleetflow-pro → Environment Variables):
```env
NEXTAUTH_URL=https://fleet.ashbi.ca
NEXTAUTH_SECRET=Rh6rLBvT20Ut6HYUjMTuHOdONFN21baBceOwzW+Yk6I=
DATABASE_URL="file:./prod.db"
```

2. **After redeploy**, run in Coolify terminal:
```bash
npx prisma db push
npm run seed
```

3. **Login** with:
   - Admin: `admin@fleetflow.com` / `demo123`
   - Fleet Manager: `manager@josephsdelivery.com` / `demo123`
   - Driver: `driver.mrodriguez@josephsdelivery.com` / `demo123`

### Complete Instructions: [SIMPLE-PRODUCTION-SETUP.md](SIMPLE-PRODUCTION-SETUP.md)

**Why this works for single user:**
- SQLite database (no PostgreSQL setup needed)
- All fleet data pre-loaded in application
- Simple authentication with generated secret
- Everything self-contained in Docker container

### Ready-to-Use Credentials:
- **Admin**: `admin@fleetflow.com` / `demo123`
- **Fleet Manager**: `manager@josephsdelivery.com` / `demo123`
- **Dispatch**: `dispatch@josephsdelivery.com` / `demo123`
- **Driver**: `driver.mrodriguez@josephsdelivery.com` / `demo123`

For complete step-by-step instructions, see:
- [PRODUCTION-SETUP-GUIDE.md](PRODUCTION-SETUP-GUIDE.md) - Complete setup
- [COOLIFY-POSTGRES-GUIDE.md](COOLIFY-POSTGRES-GUIDE.md) - Coolify-specific steps
- [POSTGRES-SETUP.md](POSTGRES-SETUP.md) - Database configuration

## 📱 Live Demo

Once deployed, you can:
1. **View dashboard** with real-time vehicle status
2. **Filter vehicles** by status (active, inactive, delayed)
3. **Send announcements** to drivers via modal
4. **View vehicle details** with maintenance history
5. **Track deliveries** with progress indicators
6. **Manage SOPs** with multimedia support
7. **Plan routes** with Google Maps integration demo
8. **Switch between tabs** for different management views

## Features

- **Vehicle Tracking**: Real-time status, location, and driver information
- **Delivery Management**: Track active deliveries, customer information, and status
- **Maintenance Scheduling**: Preventive maintenance tracking with priority levels
- **SOP Library**: Organized procedures with multimedia support (videos, images, PDFs)
- **Google Maps Integration**: Step-by-step navigation with delivery-specific instructions
- **Driver Communication**: Announcement system and messaging
- **Performance Analytics**: Basic reporting and metrics dashboard

## Recent Updates (Full Production Transformation)

### 🔐 Enterprise-Grade Authentication System (NEW)
- **Email Verification**: Required email verification before account activation
- **Two-Factor Authentication (2FA)**: TOTP-based 2FA with authenticator apps
- **Social Login**: Google OAuth and Microsoft Azure AD integration
- **Password Reset**: Secure token-based password reset flow
- **Account Security**: Brute force protection, account lockout, login history
- **Rate Limiting**: Configurable rate limits on all auth endpoints
- **Session Management**: Session expiry warnings and device tracking

### 🚀 From Demo to Production-Ready System
- **Real-World Data Integration**: 6 vehicles, 6 clients, 6 active deliveries with detailed operational data
- **Professional Authentication**: Role-based access with real company accounts (@josephsdelivery.com)
- **PostgreSQL Support**: Production database schema with full relationships and indexes
- **All Demo Messages Eliminated**: Every button now has real functionality
- **Google Maps Integration**: Actual navigation and route planning
- **Driver Communication**: Real phone dialing with confirmation
- **Complete Documentation**: Production setup guides, Coolify instructions, troubleshooting

### 🔧 Technical Improvements
- **Enhanced Data Models**: Additional fields for real fleet operations
- **Database Seed Scripts**: Populate with realistic data automatically
- **Environment Configuration**: Production-ready environment variables
- **Build Optimization**: Clean production builds with no TypeScript errors
- **Mobile-First Design**: Fully responsive for field operations

### 📊 Real Data Now Includes:
- **Joseph's Food Truck Delivery** fleet operations
- **Real driver accounts**: Michael Rodriguez, Sarah Johnson, James Wilson, etc.
- **Vehicle details**: License plates, fuel levels, service schedules
- **Client requirements**: Parking instructions, access codes, delivery preferences

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Deployment**: Docker, Coolify
- **Architecture**: Standalone Next.js with output standalone mode

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Deployment

FleetFlow Pro is ready for deployment with multiple options. The application includes a production-ready Dockerfile and deployment scripts.

### Quick Start (Docker)

```bash
# Build and run locally (Windows)
.\deploy.ps1 run

# Build and run locally (Linux/macOS)
./deploy.sh run

# The app will be available at http://localhost:3000
```

### Deployment Options

#### 1. **Coolify Deployment** (Recommended for self-hosting)

Coolify is an open-source Heroku/Netlify alternative for self-hosting.

```bash
# Generate Coolify configuration
./deploy.sh deploy-coolify  # or .\deploy.ps1 deploy-coolify

# Then follow these steps:
# 1. Push repository to GitHub
# 2. In Coolify dashboard: Add New Application → Import from GitHub
# 3. Select repository and branch
# 4. Build Pack: Dockerfile
# 5. Port: 3000
# 6. Add environment variables from .env.example
# 7. Deploy
```

#### 2. **Docker Manual Deployment**

```bash
# Build image
docker build -t fleetflow-pro .

# Run container
docker run -d --name fleetflow-pro -p 3000:3000 --restart unless-stopped fleetflow-pro

# Check logs
docker logs -f fleetflow-pro
```

#### 3. **Vercel Deployment** (Serverless)

```bash
# Generate Vercel configuration
./deploy.sh deploy-vercel  # or .\deploy.ps1 deploy-vercel

# Install Vercel CLI and deploy
npm i -g vercel
vercel
vercel --prod  # for production
```

#### 4. **Traditional Server Deployment**

```bash
# Build the application
npm run build

# Start production server
npm start

# Using PM2 for process management (recommended)
npm install -g pm2
pm2 start npm --name "fleetflow-pro" -- start
pm2 save
pm2 startup
```

### Deployment Scripts

The project includes two deployment scripts:

- **`deploy.ps1`** - PowerShell script for Windows
- **`deploy.sh`** - Bash script for Linux/macOS

Available commands:
```bash
./deploy.sh build           # Build Docker image
./deploy.sh run             # Build and run locally
./deploy.sh stop            # Stop running container
./deploy.sh clean           # Remove containers and images
./deploy.sh deploy-coolify  # Generate Coolify config
./deploy.sh deploy-vercel   # Generate Vercel config
```

### Environment Variables

Copy `.env.example` to `.env.production` and configure:

```bash
cp .env.example .env.production
# Edit .env.production with your settings
```

### Health Checks

The Dockerfile includes a health check that verifies the application is running:
- Endpoint: `/`
- Interval: 30 seconds
- Timeout: 3 seconds
- Retries: 3

### Scaling

For production traffic:
1. **Horizontal Scaling**: Run multiple containers behind a load balancer
2. **Database**: Add PostgreSQL with TimescaleDB extension
3. **Caching**: Implement Redis for session storage
4. **CDN**: Use Cloudflare or similar for static assets

## Environment Variables

No environment variables required for MVP. For production:

- `NODE_ENV`: production
- `PORT`: 3000
- `HOSTNAME`: 0.0.0.0

## Project Structure

```
fleetflow-mvp/
├── pages/              # Next.js pages
│   ├── _app.tsx       # App wrapper
│   ├── _document.tsx  # HTML document
│   └── index.tsx      # Main dashboard
├── components/         # React components
├── public/            # Static assets
├── styles/            # Global styles
├── Dockerfile         # Docker configuration
└── package.json       # Dependencies
```

## 🎯 Production-Ready Features

This is now a fully functional fleet management system with:

1. **Real-World Data**: 6 vehicles, 6 clients, 6 deliveries with detailed instructions
2. **PostgreSQL Database**: Production-ready database with full CRUD operations
3. **Authentication**: Role-based access control (admin, fleet_manager, dispatch, driver, etc.)
4. **Complete Functionality**:
   - Real Google Maps navigation and route planning
   - Driver communication with phone dialing
   - SOP management with file uploads
   - Maintenance scheduling with cost tracking
   - Client database with location intelligence
   - Mobile-responsive design for field use

### Data Already Included:
- **Vehicles**: Ford Transit 250, Mercedes Sprinter 3500, Ram ProMaster 1500, etc.
- **Clients**: Downtown Bistro, TechCorp Headquarters, Grand Hotel & Suites, etc.
- **Deliveries**: Scheduled deliveries with contact persons, access codes, special requirements
- **Users**: Real driver accounts matching vehicle assignments

## Next Steps for Production

1. **Backend API**: Node.js/Express or Python FastAPI
2. **Database**: PostgreSQL with TimescaleDB for time-series data
3. **Real-time**: WebSocket connections for live tracking
4. **Mobile App**: React Native for driver interface
5. **Third-party Integrations**: Google Maps API, GPS device APIs
6. **Authentication**: JWT-based auth for drivers/managers
7. **File Storage**: S3/Cloud Storage for multimedia SOPs

## License

Proprietary - Built for Joseph's Food Truck Delivery Service

## Contact

For more information about the full FleetFlow Pro development plan, refer to the comprehensive documentation.