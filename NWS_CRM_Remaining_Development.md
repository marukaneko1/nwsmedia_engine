# NWS Media CRM — Remaining Development Checklist

**Last Updated:** March 31, 2026  
**Status Key:** ✅ Done | 🔧 Needs API Key / External Service | ⬜ Not Started

---

## Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Production Hardening | 4 | 4 | 0 |
| Duplicate Lead Detection | 3 | 3 | 0 |
| Commission & Payout CSV Export | 3 | 3 | 0 |
| Advanced Analytics & Forecasting | 7 | 7 | 0 |
| GDPR Compliance | 3 | 3 | 0 |
| Notifications System | 7 | 7 | 0 |
| Sequence / Automation Engine | 7 | 6 | 1 |
| Outbound Webhooks (Zapier) | 3 | 3 | 0 |
| Lead Capture Webhooks | 5 | 4 | 1 |
| Proposal Templates & Builder | 6 | 6 | 0 |
| Testing Suite | 8 | 5 | 3 |
| CI/CD Pipeline | 4 | 4 | 0 |
| Operations Role & Project Mgmt | 8 | 8 | 0 |
| Kanban Pipeline Board | 3 | 3 | 0 |
| PDF Generation | 4 | 4 | 0 |
| Dark Mode | 3 | 3 | 0 |
| Docker + Local PostgreSQL | 4 | 4 | 0 |
| Client Onboarding Links | 6 | 6 | 0 |
| Lead Import (CSV/XLSX) | 5 | 5 | 0 |
| Employee Invite & Onboarding | 5 | 5 | 0 |
| Contracts Section | 5 | 5 | 0 |
| Real-Time Chat (Socket.IO) | 10 | 10 | 0 |
| Meetings & Google Meet | 7 | 7 | 0 |
| Time Tracking & Timesheets | 6 | 6 | 0 |
| Admin Schedule & KPI Dashboard | 5 | 5 | 0 |
| Training / Onboarding Materials | 8 | 8 | 0 |
| Global Search | 4 | 4 | 0 |
| Audit Log Viewer (Admin) | 4 | 4 | 0 |
| User Profile & Settings | 4 | 4 | 0 |
| User Activity Tracker (Admin) | 5 | 5 | 0 |
| Closer Onboarding Wizard | 10 | 0 | 10 |
| **Real Stripe SDK Integration** | 6 | 0 | 6 |
| **File Upload/Download (S3)** | 8 | 2 | 6 |
| **Email Service (SendGrid)** | 8 | 0 | 8 |
| **Background Job Queue (Bull+Redis)** | 6 | 0 | 6 |
| **Twilio Phone System** | 11 | 0 | 11 |
| **Square Payment Processor** | 4 | 0 | 4 |
| **PayPal Payment Processor** | 4 | 0 | 4 |
| **DocuSign E-Signatures** | 5 | 0 | 5 |
| **PandaDoc Proposal Builder** | 5 | 0 | 5 |
| **Lead Enrichment (Clearbit/Apollo)** | 5 | 0 | 5 |
| **Google Drive Sync** | 3 | 0 | 3 |
| **QuickBooks Export** | 3 | 0 | 3 |
| **Slack Integration** | 4 | 0 | 4 |
| **Mobile App (React Native)** | 5 | 0 | 5 |
| **AI/ML Features** | 5 | 0 | 5 |
| **Monitoring (Sentry)** | 5 | 0 | 5 |
| **Database Ops & Scaling** | 5 | 0 | 5 |

---

## ✅ Completed (No API Keys Needed)

### 1. Production Hardening
- [x] Helmet.js security headers — `server.ts`
- [x] Per-route auth rate limiting (5 attempts/15 min on `/api/auth/login`)
- [x] Global rate limiting (200 req/15 min)
- [x] Input sanitization middleware — `middleware/sanitize.ts` (strips HTML/script tags, control chars, XSS vectors)

### 2. Duplicate Lead Detection
- [x] Email exact match check on lead creation — `routes/leads.ts`
- [x] Phone normalized match (strip non-digits) — `routes/leads.ts`
- [x] 409 response with existing lead ID for duplicates

### 3. Commission & Payout CSV Export
- [x] `GET /api/commissions/export` — CSV with date range + user filters
- [x] Joins users/deals for employee name, deal company in export
- [x] Response with proper CSV headers (`Content-Disposition: attachment`)

### 4. Advanced Analytics & Forecasting
- [x] `GET /api/analytics/revenue-timeseries` — monthly/weekly revenue data
- [x] `GET /api/analytics/conversion-funnel` — leads → contacted → qualified → deals → won
- [x] `GET /api/analytics/forecasting` — weighted pipeline, close rate, projected revenue
- [x] `GET /api/analytics/va-effectiveness` — per-VA: leads, calls, conversions, avg ICP
- [x] `GET /api/analytics/closer-metrics` — per-Closer: deals, win rate, avg size, cycle days
- [x] Pipeline analytics (existing)
- [x] Team performance (existing)

### 5. GDPR Compliance
- [x] `GET /api/gdpr/export` — exports user record, leads, activities, commissions as JSON
- [x] `DELETE /api/gdpr/delete-account` — anonymizes user data (email, name, phone cleared)
- [x] Both require authentication

### 6. Notification System
- [x] `notifications` table with migration 003
- [x] `sendNotification()` service — `services/notifications.ts`
- [x] `GET /api/notifications` — list user's notifications (limit 50)
- [x] `PATCH /api/notifications/:id/read` — mark single as read
- [x] `POST /api/notifications/read-all` — mark all as read
- [x] `GET /api/notifications/unread-count` — unread count
- [x] Socket.IO real-time push — notifications emit to `user:{userId}` room
- [x] Frontend notification bell in `AppLayout.tsx` — dropdown with unread badge, mark all read

### 7. Sequence / Automation Engine
- [x] `sequences` + `sequence_enrollments` tables (migration 003)
- [x] `GET /api/sequences` — list all with enrollment counts
- [x] `POST /api/sequences` — create sequence with steps (JSONB)
- [x] `POST /api/sequences/:id/enroll` — enroll lead/deal, compute next_send_at
- [x] `POST /api/sequences/enrollments/:id/cancel` — cancel enrollment
- [x] `POST /api/sequences/seed-defaults` — seeds 3 default sequences (Nurture, Follow-Up, Ghost Recovery)
- [ ] 🔧 Step execution worker (requires Bull+Redis background jobs + SendGrid for email delivery)

### 8. Outbound Webhook System
- [x] `webhook_subscriptions` table (migration 003)
- [x] CRUD: `GET/POST/DELETE /api/webhooks` (admin)
- [x] `fireWebhook(eventType, payload)` — fire-and-forget POST to subscribed URLs

### 9. Lead Capture Webhooks
- [x] `POST /webhooks/scraper/google-maps` — bulk lead ingest with ICP scoring
- [x] `POST /webhooks/scraper/apify` — Apify pipeline ingest
- [x] `POST /webhooks/meta-ads` — Meta lead form webhook parsing
- [x] All public endpoints with payload validation
- [ ] 🔧 Instagram DM capture (requires Instagram API credentials)

### 10. Proposal Templates & Builder
- [x] `proposal_templates` table (migration 003)
- [x] `GET/POST/PATCH/DELETE /api/proposals/templates` — full CRUD
- [x] `POST /api/proposals/templates/seed-defaults` — Basic ($4,700) + Premium ($11,500) packages
- [x] Soft-delete support (active=false)
- [x] Frontend proposal builder for closers — template selection, service editor, client details
- [x] Proposal preview with print-ready layout + PDF generation via browser print

### 11. Testing Suite
- [x] Jest + ts-jest configuration — `jest.config.ts`
- [x] Commission calculation unit tests (8 tests) — VA 10%/$500 min, Closer tiered
- [x] ICP Scoring unit tests (5 tests) — high/low value, factors, cap, missing fields
- [x] `npm test` and `npm run test:watch` scripts
- [x] **All 13 tests passing**
- [ ] API integration tests with Supertest (requires test DB)
- [ ] Playwright E2E tests
- [ ] Webhook integration tests

### 12. CI/CD Pipeline
- [x] `.github/workflows/ci.yml` — GitHub Actions
- [x] `test` job: PostgreSQL service, migrations, Jest
- [x] `lint-frontend` job: type checking
- [x] Triggers on push/PR to `main`

### 13. Operations Role & Project Management
- [x] `projects` + `project_notes` + `project_milestones` tables (migration 004)
- [x] Ops role with dedicated dashboard, projects list, and project detail view
- [x] Deal-to-project handoff flow (closer closes → ops picks up)
- [x] `routes/projectNotes.ts` — CRUD for project notes
- [x] `routes/projectMilestones.ts` — CRUD for project milestones with progress tracking
- [x] Ops Dashboard page with project stats and recent activity
- [x] Ops Projects page with filtering and status updates
- [x] Ops Project Detail page with notes, milestones, and client info

### 14. Kanban Pipeline Board
- [x] Admin Pipeline Board page with drag-and-drop columns
- [x] Visual deal flow: Prospect → Qualified → Proposal → Negotiation → Won/Lost
- [x] Deal cards with company, value, and assigned closer

### 15. PDF Generation
- [x] `routes/pdf.ts` — PDF generation endpoints
- [x] Client contract PDF generation from deal data
- [x] Business proposal PDF generation
- [x] PDF download endpoint with proper headers

### 16. Dark Mode
- [x] `ThemeContext` with system preference detection + manual toggle
- [x] Dark mode classes applied across all pages and components
- [x] Toggle button in sidebar footer (sun/moon icon)

### 17. Docker + Local PostgreSQL
- [x] `docker-compose.yml` with PostgreSQL 15 service
- [x] Database environment configuration with connection pooling
- [x] All migrations run against real PostgreSQL (not static data)
- [x] Seed scripts for default data (channels, sequences, proposals)

### 18. Client Onboarding Links
- [x] `onboarding_links` + `onboarding_submissions` tables (migration 005)
- [x] Token-based public onboarding form (no login required)
- [x] Client fills out business info, goals, preferences
- [x] Submission data linked to deal/client record
- [x] Public project tracker page for clients
- [x] Admin can generate and manage onboarding links

### 19. Lead Import (CSV/XLSX)
- [x] `POST /api/leads/import` — CSV/XLSX file upload and parsing
- [x] Column mapping and validation
- [x] Bulk lead creation with ICP scoring
- [x] Lead distribution to sales reps
- [x] Admin import UI with drag-and-drop file upload

### 20. Employee Invite & Onboarding
- [x] `invite_links` table (migration 006)
- [x] Admin can generate invite links per role (VA, Closer, Ops)
- [x] Public registration page at `/invite/:token`
- [x] New user created with correct role from invite
- [x] Admin Onboarding hub page to manage invites

### 21. Contracts Section
- [x] `routes/contracts.ts` — contract template CRUD
- [x] Pre-built templates: Employee Agreement, Client Business Proposal, NDA, Service Agreement, Independent Contractor
- [x] Admin Contracts page with template viewer
- [x] Variable substitution ({{company_name}}, {{date}}, etc.)
- [x] Dark mode support for contract viewer

### 22. Real-Time Chat (Socket.IO)
- [x] `channels` + `channel_members` + `messages` tables (migration 007)
- [x] Socket.IO server with JWT authentication — `server.ts`
- [x] Auto-join channels on connect, room-based messaging
- [x] Real-time message broadcast + typing indicators
- [x] `routes/chat.ts` — channel list, message history, DM creation, file upload
- [x] Multer file uploads for chat attachments (`/uploads/chat`)
- [x] Default channels seeded: #general, #closers, #vas, #ops
- [x] ChatPage frontend: 3-panel layout (channels, messages, input)
- [x] Online presence indicators + unread count badges
- [x] Direct message support between any two users

### 23. Meetings & Google Meet
- [x] `meetings` + `meeting_participants` tables (migration 007)
- [x] `routes/meetings.ts` — schedule, update, cancel, RSVP
- [x] Google Meet link generation (pluggable — works without credentials)
- [x] Meeting creates a linked chat channel thread
- [x] Recurrence support: none, weekly, biweekly, monthly
- [x] MeetingsPage frontend: schedule UI, date grouping, RSVP buttons
- [x] Quick "Weekly Check-up" scheduling button

### 24. Time Tracking & Timesheets
- [x] `time_entries` table (migration 008)
- [x] `routes/time.ts` — clock in/out, manual entry, my entries, team entries, summary
- [x] Activity types: cold_calls, follow_ups, meetings, admin_tasks, training, break, other
- [x] TimesheetPage frontend: clock in/out banner, daily log, weekly hours grid
- [x] Real-time elapsed time display when clocked in
- [x] Manual time entry modal for logging past hours

### 25. Admin Schedule & KPI Dashboard
- [x] `schedule_overrides` table (migration 008)
- [x] `routes/schedule.ts` — team schedule, user schedule, overrides CRUD
- [x] Admin Schedule page: Weekly Schedule tab + Time & KPI Tracking tab
- [x] Weekly calendar view of all employees with logged hours vs scheduled hours
- [x] Schedule overrides: PTO, sick day, half day, custom hours

### 26. Training / Onboarding Materials
- [x] `training_materials` + `training_completions` tables (migration 009)
- [x] `routes/training.ts` — CRUD, file upload, mark complete, progress, admin report
- [x] Role-based assignment (VA, Closer, Ops, or All)
- [x] Categories: onboarding, sales, operations, tools, policies, general
- [x] Admin Training page: upload PDFs, manage materials, view team completion progress
- [x] Employee Training page: progress bar, category filters, completion checkmarks
- [x] Required reading badge for mandatory materials
- [x] File support: PDF, DOC, DOCX, PPT, XLSX up to 50MB

### 27. Global Search
- [x] `routes/search.ts` — search across leads, deals, users, projects
- [x] Role-aware results (VAs see own leads, closers see own deals, admin sees all)
- [x] `GlobalSearch` component in top bar with keyboard shortcut (⌘K)
- [x] Instant results with debounced search, arrow key navigation, type badges

### 28. Audit Log Viewer (Admin)
- [x] `routes/auditLog.ts` — paginated audit log with filters, stats endpoint
- [x] Admin Audit Log page with stat cards (24h activity, total events, top action)
- [x] Filterable by action type (create, update, delete, login) and entity type
- [x] Expandable rows showing detailed JSON change diffs

### 29. User Profile & Settings
- [x] `routes/profile.ts` — get/update own profile, change password
- [x] Profile page accessible to all roles — personal info, address, emergency contact
- [x] Password change with current password verification
- [x] Clickable avatar in sidebar navigates to profile

### 30. User Activity Tracker (Admin)
- [x] `user_activity_log` table (migration 016) — tracks all authenticated API requests with IP, geolocation, device info
- [x] Activity tracking middleware — auto-logs every request with IP geolocation via ip-api.com (24h cache, best-effort)
- [x] `routes/userActivities.ts` — paginated activity log, stats, per-user detail, live activity endpoints (admin-only)
- [x] Admin User Activities page with 3 tabs: Live (active users), Activity Log (filterable table), Insights (top users, action breakdown, countries, devices, browsers)
- [x] IP address, city/region/country geolocation, device type, browser, OS detection per request

### 31. Closer Onboarding Wizard
> **Purpose:** Guided workflow for closers to onboard new clients during a sales call — walk through discovery, match the right package, configure pricing, and generate an offer in one flow.

- [ ] `pages/closer/OnboardingWizard.tsx` — multi-step wizard page at `/closer/onboarding`
- [ ] **Step 1 — Discovery:** Guided questionnaire (business type, industry, current marketing, monthly budget range, pain points, goals, timeline urgency) with auto-save per field
- [ ] **Step 2 — Needs Assessment:** Checklist of services the client needs (web design, SEO, social media, paid ads, branding, content creation, email marketing, etc.) with toggle selections
- [ ] **Step 3 — Package Recommender:** Auto-suggest the best package (Basic / Premium / Custom) based on discovery answers and selected services, with side-by-side comparison view
- [ ] **Step 4 — Pricing Configurator:** Interactive pricing builder — base package price, add-on services with individual pricing, volume/term discounts, custom line items, real-time total calculation
- [ ] **Step 5 — Offer Summary:** Clean presentation-ready view the closer can screen-share — branded layout with selected services, pricing breakdown, timeline, and deliverables
- [ ] **One-click proposal generation** from the wizard — pre-fills the existing Proposal Builder with all configured services and pricing, or calls `POST /pdf/proposal-from-template`
- [ ] **One-click deal creation** — auto-creates a deal record from the wizard data (company, contact, estimated value, stage set to `proposal_sent`) if no deal exists yet
- [ ] Sidebar nav entry under Closer → Sales: "Client Onboarding" at `/closer/onboarding` (between Proposals and Commissions)
- [ ] `routes/closerOnboarding.ts` — `POST /api/closer-onboarding/sessions` (save wizard session), `GET /api/closer-onboarding/sessions` (list past sessions), `GET /api/closer-onboarding/sessions/:id` (resume session), `GET /api/closer-onboarding/recommend` (package recommendation logic based on inputs)

---

## 🔧 Requires API Keys / External Services

### 32. Real Stripe SDK Integration
> **Needs:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

- [ ] Install `stripe` npm package
- [ ] Stripe signature verification in webhook handler
- [ ] Real `PaymentIntent` creation on payment link generation
- [ ] Stripe Elements payment page (React)
- [ ] Payment confirm endpoint with client secret
- [ ] Success/error pages after payment

### 33. File Upload & Download (S3 / Cloudflare R2)
> **Needs:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, S3 bucket
> **Note:** Local file upload via multer already works for chat & training. S3 needed for production.

- [x] Multer-based local file upload for chat attachments
- [x] Multer-based local file upload for training materials
- [ ] S3 client configuration service
- [ ] Migrate file uploads to S3/R2
- [ ] Signed URL download endpoint
- [ ] Client portal file upload/download
- [ ] Revision screenshot upload support
- [ ] File management UI (Ops)

### 34. Email Service (SendGrid)
> **Needs:** `SENDGRID_API_KEY`

- [ ] Install `@sendgrid/mail`
- [ ] Reusable `sendEmail()` with template rendering
- [ ] Magic link email (portal) — currently returns `_dev_link`
- [ ] Payment receipt email
- [ ] Deposit request email after contract signed
- [ ] Commission earned notification email
- [ ] Sequence step email delivery
- [ ] Email template system (Handlebars or similar)

### 35. Background Job Queue (Bull + Redis)
> **Needs:** Redis server running, `REDIS_URL`

- [ ] Install `bull`, `ioredis`
- [ ] Queue configuration with Redis
- [ ] Sequence step processor worker
- [ ] Lead enrichment background job
- [ ] Payment reminder scheduler
- [ ] Email send queue for reliability

### 36. Twilio Phone System
> **Needs:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, Twilio phone number

- [ ] Install `twilio`
- [ ] `POST /api/calls/initiate` — click-to-dial API
- [ ] Voice webhook (`/webhooks/twilio/voice`) — TwiML response
- [ ] Recording webhook — save recording URL to activity
- [ ] Transcription webhook — save transcript
- [ ] `POST /api/sms/send` — SMS via Twilio
- [ ] SMS status webhook
- [ ] SMS templates (initial_contact, callback_reminder, payment_reminder)
- [ ] Click-to-dial modal (VA Dashboard frontend)
- [ ] Call logging UI with outcome dropdown
- [ ] SMS compose UI in lead detail

### 37. Square Payment Processor
> **Needs:** Square API credentials

- [ ] Install `square`
- [ ] Square checkout link creation
- [ ] Square webhook handler
- [ ] Square option on payment page

### 38. PayPal Payment Processor
> **Needs:** PayPal client ID + secret

- [ ] Install `@paypal/checkout-server-sdk`
- [ ] PayPal order creation
- [ ] PayPal IPN/webhook handler
- [ ] PayPal buttons on payment page

### 39. DocuSign E-Signatures
> **Needs:** DocuSign integration key, user ID, API base path

- [ ] Install `docusign-esign`
- [ ] DocuSign OAuth JWT grant
- [ ] `POST /api/deals/:id/send-contract` — create envelope
- [ ] Signed webhook → auto-trigger invoice + payment link
- [ ] Contract status UI on deal detail page

### 40. PandaDoc Proposal Builder
> **Needs:** PandaDoc API key

- [ ] Install PandaDoc SDK
- [ ] Proposal generation from deal + template
- [ ] Proposal viewed/completed webhooks
- [ ] Proposal tracking alerts to closer

### 41. Lead Enrichment (Clearbit / Apollo)
> **Needs:** `CLEARBIT_API_KEY` or Apollo credentials

- [ ] Install Clearbit/Apollo SDK
- [ ] Enrichment service (company by domain/email)
- [ ] Auto-enrich on lead creation (background job)
- [ ] BuiltWith tech stack detection
- [ ] Enriched data display on lead detail

### 42. Google Drive Sync
> **Needs:** Google OAuth2 credentials

- [ ] Google Drive API auth setup
- [ ] Per-client folder sync
- [ ] Deliverable push to client Drive folder

### 43. QuickBooks Export
> **Needs:** QuickBooks OAuth2 credentials

- [ ] QuickBooks API integration
- [ ] Invoice sync to QuickBooks
- [ ] Payment sync for bookkeeping

### 44. Slack Integration
> **Needs:** Slack incoming webhook URL

- [ ] Slack webhook configuration
- [ ] New qualified lead notification to #sales
- [ ] Payment received notification
- [ ] Referral submitted notification

### 45. Mobile App (React Native)
> **Needs:** Standalone project setup, app store accounts

- [ ] React Native / Expo project setup
- [ ] Authentication screen
- [ ] Mobile call queue for VAs
- [ ] Push notifications (FCM/APNs)
- [ ] Mobile lead entry form

### 46. AI / ML Features
> **Needs:** ML infrastructure, training data

- [ ] ML lead scoring model
- [ ] Call sentiment analysis (requires transcripts)
- [ ] Deal close probability prediction
- [ ] Smart follow-up suggestions
- [ ] Churn prediction model

---

## 🔧 Infrastructure (Needs Hosting/Service Setup)

### 47. Monitoring & Error Tracking
> **Needs:** Sentry DSN, log aggregation service

- [ ] Install `@sentry/node` + `@sentry/react`
- [ ] Sentry initialization (backend + frontend)
- [ ] Structured logging with `winston` (package already installed)
- [ ] Uptime monitoring (Better Stack or similar)
- [ ] Alert rules for DB failures, webhook errors, slow API

### 48. Database Operations & Scaling
> **Needs:** Production database host, Redis

- [ ] Automated backup script (pg_dump → S3)
- [ ] Connection pooling (PgBouncer)
- [ ] Table partitioning for activities/audit_log
- [ ] Redis cache layer for expensive queries
- [ ] Read replica for analytics queries

---

## Database Migrations

| Migration | Tables | Status |
|-----------|--------|--------|
| 001_initial_schema | users, leads, activities, deals, payments, commissions, audit_log | ✅ |
| 002_employee_profile | user profile fields (schedule, phone, etc.) | ✅ |
| 003_notifications_and_sequences | notifications, sequences, enrollments, webhooks, proposals | ✅ |
| 004_project_management | projects, project_notes, project_milestones | ✅ |
| 005_onboarding_links | onboarding_links, onboarding_submissions | ✅ |
| 006_invite_links | invite_links | ✅ |
| 007_chat_and_meetings | channels, channel_members, messages, meetings, meeting_participants | ✅ |
| 008_time_tracking | time_entries, schedule_overrides | ✅ |
| 009_training | training_materials, training_completions | ✅ |
| 016_user_activity_tracking | user_activity_log | ✅ |

---

## Key Files by Feature

### Backend Routes
| File | Purpose |
|------|---------|
| `routes/auth.ts` | Login, register, me |
| `routes/users.ts` | User CRUD (admin) |
| `routes/profile.ts` | Self-service profile + password change |
| `routes/leads.ts` | Lead CRUD + import |
| `routes/deals.ts` | Deal CRUD + pipeline |
| `routes/activities.ts` | Activity logging |
| `routes/payments.ts` | Payment links |
| `routes/commissions.ts` | Commission CRUD + CSV export |
| `routes/analytics.ts` | All analytics endpoints |
| `routes/clients.ts` | Client management |
| `routes/gdpr.ts` | GDPR export + deletion |
| `routes/notifications.ts` | Notification CRUD |
| `routes/sequences.ts` | Sequence engine |
| `routes/proposals.ts` | Proposal templates |
| `routes/outboundWebhooks.ts` | Outbound webhooks |
| `routes/webhooks.ts` | Inbound lead capture |
| `routes/portal.ts` | Client portal |
| `routes/pdf.ts` | PDF generation |
| `routes/onboarding.ts` | Client onboarding |
| `routes/invites.ts` | Employee invites |
| `routes/closerOnboarding.ts` | Closer onboarding wizard sessions + package recommender |
| `routes/contracts.ts` | Contract templates |
| `routes/chat.ts` | Chat channels + messages + file upload |
| `routes/meetings.ts` | Meeting scheduling + RSVP |
| `routes/time.ts` | Time tracking + clock in/out |
| `routes/schedule.ts` | Employee schedules + overrides |
| `routes/training.ts` | Training materials + completions |
| `routes/search.ts` | Global search across entities |
| `routes/auditLog.ts` | Audit log viewer + stats |
| `routes/userActivities.ts` | User activity tracking + stats + live |

### Backend Middleware
| File | Purpose |
|------|---------|
| `middleware/auth.ts` | JWT authentication + role-based access |
| `middleware/sanitize.ts` | Input sanitization (XSS, script injection) |
| `middleware/errorHandler.ts` | Global error handler |
| `middleware/activityTracker.ts` | Auto-logs API requests with IP + geolocation |

### Frontend Pages
| File | Purpose |
|------|---------|
| `pages/admin/Dashboard.tsx` | Admin dashboard |
| `pages/admin/Users.tsx` | User management |
| `pages/admin/Leads.tsx` | Lead management + CSV import |
| `pages/admin/Deals.tsx` | Deal management |
| `pages/admin/PipelineBoard.tsx` | Kanban pipeline view |
| `pages/admin/Commissions.tsx` | Commission management |
| `pages/admin/Analytics.tsx` | Analytics dashboard |
| `pages/admin/Onboarding.tsx` | Invite link management |
| `pages/admin/Contracts.tsx` | Contract templates |
| `pages/admin/Schedule.tsx` | Team schedule + KPI tracking |
| `pages/admin/Training.tsx` | Training material management |
| `pages/admin/AuditLog.tsx` | System audit log viewer |
| `pages/admin/UserActivities.tsx` | User activity tracker with live view + insights |
| `pages/va/Dashboard.tsx` | VA dashboard |
| `pages/va/Leads.tsx` | VA lead queue |
| `pages/closer/Dashboard.tsx` | Closer dashboard |
| `pages/closer/Deals.tsx` | Closer deal pipeline |
| `pages/closer/Proposals.tsx` | Proposal builder for closers |
| `pages/closer/OnboardingWizard.tsx` | Closer client onboarding wizard (discovery → pricing → offer) |
| `pages/ops/Dashboard.tsx` | Ops dashboard |
| `pages/ops/Projects.tsx` | Project management |
| `pages/ops/ProjectDetail.tsx` | Project detail + notes/milestones |
| `pages/shared/ChatPage.tsx` | Real-time team chat |
| `pages/shared/MeetingsPage.tsx` | Meeting scheduling |
| `pages/shared/TimesheetPage.tsx` | Employee time tracking |
| `pages/shared/TrainingPage.tsx` | Employee training materials |
| `pages/shared/ProfilePage.tsx` | User profile + password change |
| `pages/shared/DealDetail.tsx` | Deal detail view |
| `pages/portal/Dashboard.tsx` | Client portal |
| `pages/onboarding/OnboardingForm.tsx` | Client onboarding form |
| `pages/onboarding/ProjectTracker.tsx` | Client project tracker |
| `pages/invite/InviteRegister.tsx` | Employee invite registration |

### Frontend Components
| File | Purpose |
|------|---------|
| `components/NotificationBell.tsx` | Real-time notification bell with dropdown |
| `components/GlobalSearch.tsx` | Search bar with instant results (⌘K shortcut) |
| `layouts/AppLayout.tsx` | Sidebar nav + top bar + outlet |
| `contexts/AuthContext.tsx` | Auth state + JWT management |
| `contexts/ThemeContext.tsx` | Dark/light mode toggle |

---

*Total items completed without needing your input: ~140 tasks across 29 categories*  
*Total items remaining (no API keys needed): 10 tasks across 1 category*  
*Total items remaining that need API keys or external services: ~87 tasks across 17 categories*
