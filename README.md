# FleetFlow Pro - Fleet Management MVP

A modern fleet management dashboard for food truck delivery services and similar operations. This MVP demonstrates the core features outlined in the audio transcription and development plan.

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

### Coolify Deployment

1. **Create new application** in Coolify dashboard
2. **Connect GitHub repository** (or use manual deployment)
3. **Configure build settings**:
   - Build Pack: `Dockerfile`
   - Port: `3000`
   - Health Check: `/` (HTTP 200)

### Manual Docker Deployment

```bash
# Build Docker image
docker build -t fleetflow-mvp .

# Run container
docker run -p 3000:3000 fleetflow-mvp
```

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