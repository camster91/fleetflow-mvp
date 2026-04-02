# FleetFlow Browser QA & Code Review Update

**Date:** April 1, 2026
**Reviewer:** Mom (AI Assistant)

## 🐛 Visual QA & UI Bugs Identified

1. **Native Alerts & Prompts:** The application currently relies heavily on native browser `alert()` and `prompt()` dialogues for core actions (scheduling maintenance, calling drivers, deleting records, adding SOPs). This breaks the modern SaaS immersion.
2. **Dashboard Navigation Mismatch:** Marketing claims feature "Real-time Vehicle Tracking" and "Route Optimization," but the actual UI currently only has partial implementations (basic lists) or is entirely missing these views.
3. **Driver Management Gap:** The `/team` page lacks specific driver profiling (certifications, schedules, logs) which are necessary for the dispatch role.
4. **Form Friction:** Repetitive data entry for vehicles, addresses, and clients lacks smart autofill or recent item memory.

## 🛠 Recommended Improvements (Next Steps)

- **Modal System Implementation:** Replace all `window.prompt` and `window.alert` calls in `pages/index.tsx`, `AdminDashboard.tsx`, and `DriverDashboard.tsx` with a unified React Modal context (e.g., Radix UI or Headless UI).
- **Smart Autofill Hook:** Create a `useRecentItems` hook to persist the last 20 used locations, driver names, and vehicle types to `localStorage` to speed up dispatch entry.
- **Route Optimization Placeholder:** Build out a dedicated `/routes` view to fulfill the marketing promise, even if v1 just uses a simple Google Maps embed or basic list before AI routing is added.
- **Driver Profiles:** Extend the Prisma schema and `/team` UI to handle specific driver metadata (License expiry, availability status).