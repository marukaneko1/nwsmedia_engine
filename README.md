# NWS Media CRM

A specialized sales and operations CRM for digital marketing agencies. Manages the complete lifecycle from cold lead capture through project delivery, with integrated payment processing, commission tracking, and client portals.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 15 |
| Cache/Queue | Redis (Bull for background jobs) |
| File Storage | AWS S3 / Cloudflare R2 |
| Payments | Stripe, Square, PayPal |

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL + Redis)

### 1. Start databases

```bash
docker-compose up -d
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
npm install
npm run migrate    # Create database tables
npx tsx src/migrations/seed.ts  # Seed sample data
npm run dev        # Starts on :3000
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev        # Starts on :5173
```

### 4. Login

Open http://localhost:5173 and use these credentials:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@nwsmedia.com | password123 |
| VA | va1@nwsmedia.com | password123 |
| Closer | closer1@nwsmedia.com | password123 |
| Ops | ops@nwsmedia.com | password123 |

## Project Structure

```
NWSMEDIA_CRM/
├── backend/
│   └── src/
│       ├── config/        # Database, env configuration
│       ├── middleware/     # Auth, error handling
│       ├── migrations/    # DB schema + seed data
│       ├── routes/        # Express route handlers
│       ├── services/      # Business logic (ICP scoring, lead assignment, audit)
│       └── server.ts      # Entry point
├── frontend/
│   └── src/
│       ├── components/ui/ # Reusable UI components
│       ├── contexts/      # Auth context
│       ├── hooks/         # Custom React hooks
│       ├── layouts/       # App layout with sidebar
│       ├── pages/         # Route pages by role
│       │   ├── admin/     # Admin dashboard, users, analytics
│       │   ├── closer/    # Deal pipeline, payments
│       │   ├── ops/       # Project management
│       │   ├── portal/    # Client self-service portal
│       │   └── va/        # Lead management, call queue
│       └── utils/         # API client
├── shared/                # TypeScript types shared between frontend/backend
└── docker-compose.yml     # Local PostgreSQL + Redis
```

## API Endpoints

### Auth
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Current user

### Leads
- `GET /api/leads` - List leads (filterable)
- `POST /api/leads` - Create lead (auto ICP scoring)
- `PATCH /api/leads/:id` - Update lead
- `POST /api/leads/:id/qualify` - Qualify lead, create deal
- `POST /api/leads/import` - Bulk CSV import

### Deals
- `GET /api/deals` - List deals
- `GET /api/deals/:id` - Deal detail with activities
- `PATCH /api/deals/:id` - Update deal stage

### Payments
- `POST /api/payment-links/create` - Generate payment link
- `GET /api/payment-links/pay/:slug` - Public payment page data
- `POST /api/payment-links/invoices/create` - Create invoice

### Commissions
- `GET /api/commissions` - List commissions
- `PATCH /api/commissions/:id/approve` - Approve commission
- `POST /api/commissions/payout` - Batch payout

### Client Portal
- `POST /api/portal/auth/request-link` - Magic link login
- `GET /api/portal/dashboard` - Portal dashboard
- `POST /api/portal/referrals/submit` - Submit referral
- `POST /api/portal/revisions/submit` - Request revision

### Analytics
- `GET /api/analytics/overview` - Dashboard metrics
- `GET /api/analytics/pipeline` - Pipeline breakdown
- `GET /api/analytics/team-performance` - VA/Closer performance

## Lead generation engine (bundled)

This repo also includes the **NWS Media lead engine**: Python scrapers (Google Maps, Craigslist), enrichment, outreach CLI, and a **Next.js ops dashboard** (leads table, Craigslist UI, voice agent).

| Path | Purpose |
|------|---------|
| `src/` | Python CLI (`python -m src.cli --help`) |
| `dashboard/` | Next.js app — run `npm install && npx next dev --port 3001` if CRM backend uses `3000` |
| `alembic/`, `templates/` | DB migrations & email templates |

**How to run and integrate ports, env files, and sync from another machine:** see **[LEAD_ENGINE_CRM_INTEGRATION.md](./LEAD_ENGINE_CRM_INTEGRATION.md)**.
