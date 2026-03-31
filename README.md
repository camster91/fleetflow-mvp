# FleetFlow MVP (Logistics Dashboard)

**A high-performance Minimum Viable Product for logistics, dispatching, and fleet tracking operations.**

As part of our broader business tool consolidation, **FleetFlow** serves as a foundational dispatch and management system. Future iterations aim to integrate this platform seamlessly with the GlowOS ecosystem, utilizing AI logic to automate dispatch routing and driver communication.

## 🚀 The Vision: Automated Logistics

This application is transitioning from a standalone MVP to a template module in the Nexus AI product suite. The ultimate goal is:
- **Intelligent Dispatching:** A Pi Coding Agent running a logistics skill could analyze traffic, driver availability, and load size to autonomously schedule the entire day.
- **Unified Dashboards:** Bringing fleet managers out of convoluted legacy software and into clean, real-time React interfaces.
- **Scalable Backend:** Preparing the system for multi-tenant SaaS monetization models using our daily compute token constraints for smaller fleets.

## 🛠 Tech Stack

- **Frontend:** React (Vite) / Tailwind CSS
- **State Management:** Zustand / Context API
- **Data Visualization:** Recharts
- **Mapping:** Integrated map modules (Leaflet/Mapbox placeholder)

## ⚡ Getting Started

```bash
# Clone the repository
git clone https://github.com/camster91/fleetflow-mvp.git
cd fleetflow-mvp

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173`.

## 📈 Roadmap
- Integrate GlowOS text-to-speech for automated dispatch calls to drivers.
- Implement the comprehensive driver app view.
- Finalize the multi-tenant architecture for SaaS public release.

---
*Developed by Cameron Ashley / Nexus AI.*
