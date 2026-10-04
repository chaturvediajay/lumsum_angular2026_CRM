# Lumsum CRM — Dedicated Frontend Application (`lumsum_angular2026_CRM`)

A modern, standalone Angular 22 Customer Relationship Management (CRM) application with complete enterprise pipeline workflows, Kanban board, lead qualification, customer accounts 360°, and activity management.

## Integration Architecture

- **Token Authentication**: Authenticates against the central `lumsum_2026` backend (`http://localhost:8080/api/auth/signin`). Uses the shared JWT token system for login, refresh, route guards, and active click validation.
- **Dedicated CRM API**: Connects to the standalone `lumsum_2026_CRM` backend (`http://localhost:8082/api/v1/crm/**`) for all CRM operations.
- **Port**: Serves on port `4201` (`http://localhost:4201`) to run harmoniously alongside the main platform (`http://localhost:4200`).

## CRM Features in Admin Dashboard

- 📊 **CRM Executive Dashboard** (`/home`): Real-time metrics for total pipeline value, won revenue, active deals, lead conversion rate, win rate, and sales momentum.
- 🎯 **Leads Management** (`/leads`): Capture, score (0-100), filter by acquisition source (`LinkedIn`, `Referral`, `Website`), and one-click convert leads to customer accounts and deals.
- 💼 **Deals Kanban Pipeline** (`/deals`): Visual drag-and-drop / stage management across 6 stages (`Prospecting`, `Qualification`, `Proposal`, `Negotiation`, `Closed Won`, `Closed Lost`) with automatic win probability calculations.
- 🏢 **Customers 360° Directory** (`/customers`): Searchable accounts with total spend tracking, industry categorization, and linked deals drawer.
- 📅 **Activity & Task Planner** (`/activities`): Schedule and manage calls, meetings, tasks, and follow-ups with instant completion toggles and urgency filters.
- 📈 **CRM Reports & Telemetry** (`/reports`): Pipeline distribution charts, lead sources, and conversion funnels.
- 🤖 **AI Assistant** (`/ai-assistant`): Integrated voice assistant for quick CRM queries and navigation.

## Quick Start

```bash
# Install dependencies (if needed)
npm install

# Start development server on port 4201
npm start

# Run unit tests (100% passing)
npm test -- --watch=false

# Build production artifacts
npm run build
```
