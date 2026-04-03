# Lead engine + CRM (monorepo layout)

This folder combines **NWS Media CRM** (`backend/` + `frontend/`) with the **lead generation engine** (Python `src/` + Next.js `dashboard/`).

## What lives where

| Path | Stack | Role |
|------|--------|------|
| `backend/` | Express + TypeScript | CRM API, auth, deals, sequences, etc. |
| `frontend/` | React + Vite | CRM UI |
| `src/` | Python (Click, Playwright, SQLAlchemy) | Scrapers (Google Maps, Craigslist), enrichment, outreach CLI |
| `dashboard/` | Next.js 16 | Internal ops UI: leads, pipeline, Craigslist panel, **Voice agent**, scraper controls |
| `alembic/` | Alembic | Postgres migrations for **engine** `businesses` table (often Supabase) |
| `templates/` | Jinja2 | Email templates (including Craigslist sequences) |
| `scripts/` | Python / Node helpers | e.g. `export_leads_csv.py`, `count_leads.py` |

CRM and the engine can share **one** Postgres (e.g. Supabase) or use **separate** databases — today the engine typically uses `DATABASE_URL` in the **repo root** `.env`, while the CRM backend uses `backend/.env` and local Docker Postgres in `docker-compose.yml` by default.

## Environment files (do not commit secrets)

| File | Used by |
|------|---------|
| `.env` | Python CLI / Alembic (`DATABASE_URL`, API keys for scrapers, Instantly, etc.) |
| `dashboard/.env.local` | Next dashboard (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY`, Gmail, VAPI keys, etc.) |
| `backend/.env` | CRM API |

When you **unify** data later, point both Python DB URL and CRM DB at the same Postgres and design schema or sync jobs (see below).

## Run everything locally

### 1. CRM databases (if using local Docker CRM DB)

```bash
docker-compose up -d
```

### 2. CRM backend

```bash
cd backend
npm install
npm run dev   # default port from backend — often 3000
```

### 3. CRM frontend

```bash
cd frontend
npm install
npm run dev   # often http://localhost:5173
```

### 4. Lead engine (Python)

```bash
# From repo root (this folder)
python -m venv .venv
.\.venv\Scripts\activate
pip install -e .
# Uses root .env for DATABASE_URL
python -m src.cli --help
```

### 5. Marketing / lead dashboard (Next.js)

```bash
cd dashboard
npm install
npx next dev --port 3001
```

**Port note:** If CRM backend already uses `3000`, run Next on `--port 3001` (or set `PORT` in CRM) so they do not clash.

## Voice agent

- Local SQLite: `dashboard/voice_agent.db` (copied when you sync from the dev machine).
- UI: `http://localhost:3001/dashboard/voice-agent` (when Next runs on 3001).

## Full file sync from `nwsmedia_engine` (another PC)

From the machine that has the canonical repo:

```powershell
$src = "C:\path\to\nwsmedia_engine"
$dest = "C:\Users\YOU\Desktop\NWSMEDIA_CRM"
robocopy $src $dest /E /COPY:DAT /R:2 /W:2 `
  /XD node_modules .venv .next __pycache__ .turbo dist build .eggs playwright-report test-results docker-data `
  /XF "cl_batch_*.log" "cl_batch_*_err.log"
```

Then re-copy secrets if needed: root `.env`, `dashboard/.env.local`, `backend/.env`.

Excluded on purpose (regenerate): `node_modules`, `.venv`, `.next`, huge scrape logs.

## Deeper integration (next steps)

1. **Navigation:** Add a CRM sidebar link to the Next dashboard URL (new tab or iframe).
2. **Single DB:** Migrate CRM to Supabase or migrate engine tables into CRM Postgres; align UUID/ID strategy.
3. **API:** CRM `backend` exposes/import job that reads from `businesses` / enrichment tables or calls a small internal service wrapping `src/` jobs.
4. **Auth:** Put Next dashboard behind same SSO or VPN as CRM if exposed.

## Git

The **engine** source of truth in your team may remain `github.com/marukaneko1/nwsmedia_engine`. This Desktop monorepo can be a **private** umbrella repo; keep `.env*` out of Git (see `.gitignore`).
