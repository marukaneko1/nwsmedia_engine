# NWS Media CRM — Features by Role

**Version:** 1.0  
**Last Updated:** March 29, 2026  
**System:** React + TypeScript + Tailwind (frontend) | Node.js + Express + PostgreSQL (backend)

---

## Table of Contents

1. [Role Overview](#role-overview)
2. [VA (Cold Caller)](#va-cold-caller)
3. [Closer (Sales Rep)](#closer-sales-rep)
4. [Ops (Project Manager)](#ops-project-manager)
5. [Admin (CEO / Finance)](#admin-ceo--finance)
6. [Client (Portal User)](#client-portal-user)
7. [Shared / Cross-Role Features](#shared--cross-role-features)
8. [Role Access Matrix](#role-access-matrix)

---

## Role Overview

The CRM has five distinct roles, each with its own dashboard and feature set:

| Role | Description | Login Method | Home Route |
|------|-------------|--------------|------------|
| **VA** | Virtual assistants / cold callers who generate and qualify leads | Email + password | `/va` |
| **Closer** | Sales reps who work deals through the pipeline to close | Email + password | `/closer` |
| **Ops** | Project managers who handle delivery after a deal closes | Email + password | `/ops` |
| **Admin** | CEO / finance with full system access and analytics | Email + password | `/admin` |
| **Client** | External clients who view project status and make payments | Magic link (email) | `/portal/dashboard` |

---

## VA (Cold Caller)

**Routes:** `/va`, `/va/leads`, `/va/commissions`  
**Sidebar Navigation:** Dashboard · My Leads · Commissions

### Dashboard (`/va`)

| Feature | Description |
|---------|-------------|
| **Total Leads** stat card | Count of all leads assigned to the VA |
| **Calls Today** stat card | Number of call activities logged by the VA today |
| **Qualified Leads** stat card | Count of leads in `qualified` stage |
| **Commissions Earned** stat card | Sum of pending + paid commissions |
| **Next Follow-ups** list | Up to 8 leads sorted by soonest `next_followup_at`, showing company, contact, stage badge, and follow-up date |
| **View All Leads** button | Navigates to `/va/leads` |
| **Open** button (per lead) | Navigates to lead detail |

### My Leads (`/va/leads`)

| Feature | Description |
|---------|-------------|
| **Lead count** | Total number of assigned leads displayed in subtitle |
| **Stage filter** | Dropdown to filter by: All, New, Contacted, Qualified, Nurture, Lost, Converted |
| **Leads table** | Columns: Company, Contact Name, ICP Score (badge), Stage (badge), Phone, Next Follow-up |
| **New Lead** button + modal | Create a lead with: first/last name, company, email, phone, source, industry |
| **Qualify** button + modal (per lead) | Hand off a lead to a closer with: assigned closer ID, pain point, budget min/max, timeline, handoff notes |
| **Log Activity** button + modal (per lead) | Record an activity with: type (call/email/SMS/meeting/note), outcome, notes, optional call duration |
| **Row click** | Navigate to lead detail view |

**Data scoping:** VAs only see leads where `assigned_va_id` matches their user ID (enforced server-side).

### Commissions (`/va/commissions`)

| Feature | Description |
|---------|-------------|
| **Pending** summary card | Total pending commission amount |
| **Paid** summary card | Total paid commission amount |
| **Commissions table** | Columns: Deal/Company, Amount (USD), Status (badge: paid/pending/approved/voided), Triggered Date |

**Data scoping:** VAs only see their own commission records (enforced server-side).

### VA Backend Capabilities

| API Action | Description |
|------------|-------------|
| List leads | Own assigned leads with filtering/sorting/pagination |
| Create lead | New lead with automatic ICP scoring and round-robin assignment |
| Qualify lead | Convert lead to a deal and hand off to a closer |
| Import leads | Bulk CSV-style lead import |
| View lead detail | Individual lead with activity history |
| Update lead | Edit lead fields (contact info, stage, follow-up dates, tags) |
| Create activity | Log calls, emails, SMS, meetings, notes against leads |
| View commissions | Own commissions with pending/paid totals |

---

## Closer (Sales Rep)

**Routes:** `/closer`, `/closer/deals`, `/closer/queue`, `/closer/commissions`  
**Sidebar Navigation:** Dashboard · Pipeline · Qualified Leads · Commissions

### Dashboard (`/closer`)

| Feature | Description |
|---------|-------------|
| **Active Deals** stat card | Count of deals excluding won/lost stages |
| **Pipeline Value** stat card | Sum of `estimated_value` for open deals (discovery through awaiting_deposit) |
| **Won This Month** stat card | Total revenue from deals closed as `won` this calendar month, with deal count |
| **Pending Commissions** stat card | Total pending commission amount |
| **Kanban Board** | Visual pipeline with columns: Discovery, Proposal Sent, Contract Sent, Awaiting Deposit, Won — each card shows company, estimated value, and days in pipeline |
| **Open Pipeline Table** button | Navigates to `/closer/deals` |

### Pipeline (`/closer/deals`)

| Feature | Description |
|---------|-------------|
| **Stage filter** | Dropdown: All, Discovery, Proposal Sent, Contract Sent, Awaiting Deposit, Won, Lost |
| **Deals table** | Columns: Company, Contact Name, Stage (badge), Estimated Value, Close %, Created Date |
| **Row click** | Expand/collapse deal detail panel |
| **Expanded detail** | Shows: company, contact info (name, email, phone), pain point, budget min–max |
| **Open** button | Navigate to deal detail view |
| **Create Payment Link** button + modal | Generate a payment link with: amount, payment type (deposit/final/milestone), processor (Stripe/Square/PayPal), due date, description |

### Qualified Leads Queue (`/closer/queue`)

| Feature | Description |
|---------|-------------|
| **Queue table** | Columns: Company, VA Who Qualified, Pain Point, Budget Range, Handoff Date |
| **Sorting** | Newest handoffs first (sorted by `created_at` descending) |
| **Row click / Open Deal** button | Navigate to deal detail view |

**Data shown:** Only deals in `discovery` stage (freshly qualified by VAs).

### Commissions (`/closer/commissions`)

| Feature | Description |
|---------|-------------|
| **Pending** summary card | Total pending commission amount |
| **Paid (All Time)** summary card | Total paid commission amount |
| **Commissions table** | Columns: Deal/Company, Commission Type, Amount, Percentage, Status (badge), Date |

**Data scoping:** Closers only see their own commission records (enforced server-side).

### Closer Backend Capabilities

| API Action | Description |
|------------|-------------|
| List deals | Own assigned deals with stage filtering and pagination |
| View deal detail | Individual deal with activities and payment links |
| Update deal | Edit stage, values, discovery/proposal/contract/deposit fields, loss details |
| Create payment link | Generate branded payment links (Stripe/Square/PayPal) |
| Void payment link | Cancel a pending payment link |
| Create invoice | Generate invoices against deals/clients |
| Create client from deal | Convert a won deal into a client record |
| Enroll in sequence | Add leads/deals to automated email/SMS sequences |
| View commissions | Own commissions with pending/paid totals |

---

## Ops (Project Manager)

**Routes:** `/ops`, `/ops/projects`, `/ops/clients`  
**Sidebar Navigation:** Dashboard · Projects · Clients

### Dashboard (`/ops`)

| Feature | Description |
|---------|-------------|
| **Active Projects** stat card | Count of clients with `project_status = in_progress` |
| **Revision Requests** stat card | Count of clients with `project_status = revision_requested` |
| **Deliveries This Week** stat card | Clients with `actual_delivery_date` in the last 7 days |
| **Clients In Progress** list | Displays company name, contact name, and project status badge for all in-progress clients |
| **View All Projects** button | Navigates to `/ops/projects` |

### Projects (`/ops/projects`)

| Feature | Description |
|---------|-------------|
| **Projects table** | Columns: Client Company, Project Status (badge), Current Phase, Expected Delivery Date, Revisions Used/Limit |
| **Row click** | Expand/collapse detail panel |
| **Expanded detail** | Shows: contact name, email, project name, kickoff date, actual delivery date, contract value |
| **Update Status** button + modal (per project) | Change project status (not_started/in_progress/awaiting_approval/revision_requested/complete/paused) and current phase (discovery/design/development/review/delivery) |

### Clients (`/ops/clients`)

| Feature | Description |
|---------|-------------|
| **Clients table** | Columns: Company, Contact, Services Contracted (purple badges), Total Paid (USD), Balance Due (USD), Project Status (badge) |

**Read-only view** — no edit actions on this page.

**Data scoping:** Ops users only see clients where `assigned_ops_lead_id` matches their user ID (enforced server-side).

### Ops Backend Capabilities

| API Action | Description |
|------------|-------------|
| List clients | Own assigned clients with project status filtering |
| View client detail | Individual client with projects and shared files |
| Update client | Edit project status, phase, delivery dates, revision limits, services, upsell notes |
| Create client from deal | Convert a won deal into a client with services and kickoff info |
| Create payment link | Generate payment links for clients |
| Create invoice | Generate invoices for clients |

---

## Admin (CEO / Finance)

**Routes:** `/admin`, `/admin/users`, `/admin/leads`, `/admin/deals`, `/admin/commissions`, `/admin/analytics`  
**Sidebar Navigation:** Dashboard · Users · Leads · Deals · Commissions · Analytics

### Dashboard (`/admin`)

| Feature | Description |
|---------|-------------|
| **Total Leads** stat card | Organization-wide lead count |
| **Total Deals** stat card | Organization-wide deal count |
| **Pipeline Value** stat card | Sum of `estimated_value` for all open deals |
| **Won Deals** stat card | Total deals with stage `won` |
| **Total Revenue** stat card | Sum of all completed payment transactions |
| **Pending Commissions** stat card | Total pending commission amount across all users |
| **Pipeline Summary** | Badge counts per deal stage: Discovery, Proposal Sent, Contract Sent, Awaiting Deposit, Won, Lost |

### User Management (`/admin/users`)

| Feature | Description |
|---------|-------------|
| **Users table** | Columns: Name (+ username), Work Email (+ personal email), Role (badge), Team Name, Join Date, Status (badge), Profile Complete (badge) |
| **Create User** button + modal | Full user creation: first/last name, work email, password, role (VA/Closer/Ops/Admin), team, phone, personal email, join date, emergency contact, weekly schedule |
| **Row click → Edit User** modal | Edit all profile fields, role (including Client), status (active/inactive/suspended), bio |

### All Leads (`/admin/leads`)

| Feature | Description |
|---------|-------------|
| **Leads table** | Columns: Company, Contact, Source (badge), ICP Score, Stage (badge), Assigned VA Name, Created Date |

**Read-only organization-wide view** — no stage filtering or edit actions on this page. Admins see all leads regardless of assignment.

### All Deals (`/admin/deals`)

| Feature | Description |
|---------|-------------|
| **Deals table** | Columns: Company, Contact Name, Closer Name, Stage (badge), Value, Close Probability, Created Date |

**Read-only organization-wide view** — no stage filtering or edit actions on this page. Admins see all deals regardless of assignment.

### Commissions (`/admin/commissions`)

| Feature | Description |
|---------|-------------|
| **Total Pending** summary card | Aggregate pending commissions |
| **Total Paid** summary card | Aggregate paid commissions |
| **Commissions table** | Columns: User Name, Role (badge), Deal Company, Commission Type, Amount, Percentage, Status (badge), Triggered Date |
| **Approve** button (per row) | Move a `pending` commission to `approved` status |
| **Checkbox selection** | Multi-select `approved` commissions for batch payout |
| **Payout (N)** button | Process batch payout for all selected approved commissions |

### Analytics (`/admin/analytics`)

| Feature | Description |
|---------|-------------|
| **VA Performance table** | Columns: Name, Total Leads, Qualified Leads, Calls Made, Commissions Earned |
| **Closer Performance table** | Columns: Name, Total Deals, Won Deals, Revenue, Commissions Earned |

### Admin Backend Capabilities (Full List)

| API Action | Description |
|------------|-------------|
| **User Management** | Create, read, update users (all roles); manage teams |
| **Lead Management** | View all leads org-wide; qualify leads; import leads; delete leads |
| **Deal Management** | View all deals org-wide; update deal stages and fields |
| **Commission Management** | View all commissions; approve commissions; batch payout; CSV export with date/user filters |
| **Client Management** | View all clients; update client records; create clients from deals |
| **Payment Management** | Create/void payment links; create invoices; view all transactions |
| **Sequence Management** | Create/edit/delete automated sequences; seed default sequences; enroll leads/deals |
| **Proposal Templates** | Create/edit/delete proposal templates; seed default templates |
| **Webhook Subscriptions** | Create/manage outbound webhook subscriptions |
| **Analytics — Overview** | Aggregate stats: leads, deals, pipeline value, revenue, commissions |
| **Analytics — Pipeline** | Deal counts and values grouped by stage |
| **Analytics — Team Performance** | Per-VA and per-closer metrics |
| **Analytics — Revenue Timeseries** | Weekly or monthly revenue charts (up to 12 months) |
| **Analytics — Conversion Funnel** | Funnel: Leads → Contacted → Qualified → Deals → Won (counts + percentages) |
| **Analytics — Forecasting** | Weighted pipeline, close rate, projected monthly revenue |
| **Analytics — VA Effectiveness** | Per-VA: leads, calls, qualified, conversion %, avg ICP score |
| **Analytics — Closer Metrics** | Per-closer: deals, win/loss rate, avg deal size, avg cycle days |

**Note:** The admin can also access all VA, Closer, and Ops pages (routes include `admin` in their allowed roles).

---

## Client (Portal User)

**Routes:** `/portal/login`, `/portal/auth/:token`, `/portal/dashboard`, `/portal/referral`  
**Authentication:** Passwordless magic link via email  
**Sidebar Navigation:** None (standalone portal layout)

### Login (`/portal/login`)

| Feature | Description |
|---------|-------------|
| **Email input** | Client enters their email address |
| **Send Login Link** button | Sends a one-time magic link (valid for 15 minutes) |
| **Check Your Inbox** confirmation | Shown after successful link request with instructions |
| **Staff Sign In** link | Navigates to `/login` for employee access |

### Magic Link Authentication (`/portal/auth/:token`)

| Feature | Description |
|---------|-------------|
| **Auto-verification** | Validates token, issues 7-day JWT, redirects to dashboard |
| **Error handling** | Expired/invalid token message with link back to login |

### Dashboard (`/portal/dashboard`)

| Feature | Description |
|---------|-------------|
| **Welcome message** | Personalized with contact name and company name |
| **Project Timeline** | Visual 4-step progress tracker: Kickoff → Design → Development → Launch (derived from `current_phase` and `project_status`) |
| **Total Paid** | Aggregate amount the client has paid |
| **Balance Due** | Remaining balance owed |
| **Make Payment** button | Opens the first pending payment link for the client |
| **View Files** quick action | Navigate to file listing (route pending implementation) |
| **Request Revision** quick action | Navigate to revision request form (route pending implementation) |
| **Submit Referral** quick action | Navigate to `/portal/referral` |
| **Recent Files** list | Up to 6 files shared with the client (filename, date, type badge) |
| **Logout** button | Clears portal session and returns to login |

### Referral Program (`/portal/referral`)

| Feature | Description |
|---------|-------------|
| **$500 credit reward** | Displayed program terms: earn $500 account credit per successful referral |
| **Referral form** | Fields: Company Name (required), Contact Name, Contact Email, Contact Phone, Notes |
| **Submit Referral** button | Creates referral record and optionally a lead in the system |
| **Submit Another** option | Reset form after successful submission |
| **Back to Dashboard** | Return to portal dashboard |

### Client Backend Capabilities

| API Action | Description |
|------------|-------------|
| Request magic link | Email-based passwordless authentication |
| View dashboard | Project status, payment summary, recent files |
| Submit referral | Create referral with optional lead auto-creation |
| Request revision | Submit a revision request (decrements from revision limit, updates project status) |

---

## Shared / Cross-Role Features

These features are available to multiple or all staff roles:

### Authentication & Session

| Feature | Available To | Description |
|---------|-------------|-------------|
| Register | VA, Closer, Ops | Self-registration with role selection |
| Login | All staff | Email/username + password |
| Token refresh | All staff | Automatic JWT renewal |
| Logout | All staff | Session termination |
| Profile (`/me`) | All staff | View own user profile |

### Notifications

| Feature | Available To | Description |
|---------|-------------|-------------|
| List notifications | All staff | View latest 50 notifications (own only) |
| Unread count | All staff | Badge count for unread notifications |
| Mark as read | All staff | Mark individual or all notifications as read |

### Activities

| Feature | Available To | Description |
|---------|-------------|-------------|
| List activities | All staff | Filterable by lead, deal, client, or activity type |
| Create activity | All staff | Log calls, emails, SMS, meetings, and notes |

### Sequences (Automated Outreach)

| Feature | Available To | Description |
|---------|-------------|-------------|
| View sequences | All staff | List all sequences and their steps |
| Enroll lead/deal | VA, Closer, Admin | Add a lead or deal to an automated sequence |
| Cancel enrollment | All staff | Stop an active sequence enrollment |
| Create/edit/delete sequences | Admin only | Full sequence management |
| Seed default sequences | Admin only | Initialize built-in sequence templates |

### Proposal Templates

| Feature | Available To | Description |
|---------|-------------|-------------|
| View templates | All staff | Browse active proposal templates |
| Create/edit/delete templates | Admin only | Full template management |
| Seed default templates | Admin only | Initialize built-in templates |

### Payment Links & Invoices

| Feature | Available To | Description |
|---------|-------------|-------------|
| View payment links | All staff | List payment links with deal/client/status filters |
| Create payment link | Closer, Ops, Admin | Generate branded payment links (Stripe/Square/PayPal) |
| Void payment link | Closer, Admin | Cancel a pending payment link |
| View invoices | All staff | List invoices |
| Create invoice | Closer, Ops, Admin | Generate invoices |
| View transactions | Admin only | Full transaction history |
| Public payment page | Anyone (no auth) | Branded payment page accessed via unique slug |

### GDPR / Data Privacy

| Feature | Available To | Description |
|---------|-------------|-------------|
| Data export | All staff (own data) | Portable export of profile, leads, activities, commissions |
| Account deletion | All staff (own account) | Anonymize personal data (email, name set to placeholders) |

### Webhooks

| Feature | Available To | Description |
|---------|-------------|-------------|
| Inbound (Stripe, etc.) | System (no auth) | Payment confirmations, refunds, lead ingestion from scrapers/Meta |
| Outbound subscriptions | Admin only | Manage webhook URLs for CRM events |

---

## Role Access Matrix

A complete view of which role can perform each action:

| Feature | VA | Closer | Ops | Admin | Client |
|---------|:--:|:------:|:---:|:-----:|:------:|
| **Leads** | | | | | |
| View own leads | ✅ | ✅ | — | ✅ (all) | — |
| Create lead | ✅ | ✅ | ✅ | ✅ | — |
| Edit lead | ✅ | ✅ | ✅ | ✅ | — |
| Qualify lead | ✅ | — | — | ✅ | — |
| Import leads | ✅ | — | — | ✅ | — |
| Delete lead | — | — | — | ✅ | — |
| **Deals** | | | | | |
| View own deals | — | ✅ | — | ✅ (all) | — |
| Update deal | — | ✅ | — | ✅ | — |
| **Clients** | | | | | |
| View clients | ✅ | ✅ | ✅ (own) | ✅ (all) | — |
| Edit client | — | — | ✅ | ✅ | — |
| Create from deal | — | ✅ | ✅ | ✅ | — |
| **Payments** | | | | | |
| Create payment link | — | ✅ | ✅ | ✅ | — |
| Void payment link | — | ✅ | — | ✅ | — |
| Create invoice | — | ✅ | ✅ | ✅ | — |
| View transactions | — | — | — | ✅ | — |
| Make payment | — | — | — | — | ✅ |
| **Commissions** | | | | | |
| View own commissions | ✅ | ✅ | ✅ | ✅ (all) | — |
| Approve commissions | — | — | — | ✅ | — |
| Batch payout | — | — | — | ✅ | — |
| Export CSV | — | — | — | ✅ | — |
| **Analytics** | | | | | |
| Overview dashboard | — | — | — | ✅ | — |
| Team performance | — | — | — | ✅ | — |
| Revenue timeseries | — | — | — | ✅ | — |
| Conversion funnel | — | — | — | ✅ | — |
| Forecasting | — | — | — | ✅ | — |
| VA effectiveness | — | — | — | ✅ | — |
| Closer metrics | — | — | — | ✅ | — |
| **User Management** | | | | | |
| View/create/edit users | — | — | — | ✅ | — |
| Manage teams | — | — | — | ✅ | — |
| **Sequences** | | | | | |
| View sequences | ✅ | ✅ | ✅ | ✅ | — |
| Enroll lead/deal | ✅ | ✅ | — | ✅ | — |
| Manage sequences | — | — | — | ✅ | — |
| **Proposals** | | | | | |
| View templates | ✅ | ✅ | ✅ | ✅ | — |
| Manage templates | — | — | — | ✅ | — |
| **Notifications** | ✅ | ✅ | ✅ | ✅ | — |
| **Activities** | ✅ | ✅ | ✅ | ✅ | — |
| **GDPR Export/Delete** | ✅ | ✅ | ✅ | ✅ | — |
| **Portal** | | | | | |
| View project status | — | — | — | — | ✅ |
| View files | — | — | — | — | ✅ |
| Submit referral | — | — | — | — | ✅ |
| Request revision | — | — | — | — | ✅ |
| **Webhooks (outbound)** | — | — | — | ✅ | — |

---

*Admin users also have access to all VA, Closer, and Ops dashboard pages in addition to their own admin section.*
