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

## Recent Updates

- **Integrated Modals**: Added functional Announcement Modal and Vehicle Detail Modal
- **Mobile Responsiveness**: Enhanced touch targets and mobile menu
- **Tab Navigation**: Placeholder content for Vehicles, Deliveries, SOPs, Maintenance, and Reports tabs
- **Fixed Viewport Warning**: Moved viewport meta tag to proper location
- **Improved Head Metadata**: Added proper title and meta tags for SEO
- **TypeScript Support**: Full type safety with no build errors

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

## MVP Limitations

This is a demonstration MVP with the following limitations:

1. **Mock Data**: All data is static/mocked
2. **No Backend**: No database or API integration
3. **No Authentication**: Simple demo without user auth
4. **Basic Features**: Core UI demonstration only

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