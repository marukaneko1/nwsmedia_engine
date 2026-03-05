# Local setup – NWS Media Lead Engine

This project is ready to run locally. Follow these steps.

## What’s already done

- **`.env`** – Created from `.env.example` (edit with your API keys when needed).
- **Python 3.12** – Installed via winget (if you ran the install step).
- **Virtual environment** – `.venv` with all Python dependencies and dev tools.
- **Playwright** – Browsers (Chromium, Firefox, WebKit) installed for the scraper.

## 1. Start Postgres and Redis (Docker)

Backend and migrations need Postgres and Redis. If Docker is installed:

```powershell
docker compose up -d
```

- Postgres: `localhost:5433`, user `nwsmedia`, password `nwsmedia`, database `nwsmedia_leads`.
- Redis: `localhost:6379`.

If Docker isn’t installed, install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and run the command above.

## 2. Run database migrations

With Postgres running:

```powershell
cd c:\Users\mkane\nwsmedia_engine
.\.venv\Scripts\Activate.ps1
alembic upgrade head
```

## 3. Use the Python backend

Activate the venv and use the CLI:

```powershell
.\.venv\Scripts\Activate.ps1
python run.py --help
# or: nwsmedia --help
```

Example: run the scraper, triage, or other commands as in the project docs.

## 4. Dashboard (Next.js)

The dashboard lives in `dashboard/` and needs Node.js (LTS recommended).

### Install Node.js (if needed)

```powershell
winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
```

Then **close and reopen your terminal** so `node` and `npm` are on PATH.

### Install and run the dashboard

```powershell
cd c:\Users\mkane\nwsmedia_engine\dashboard
npm install
npm run dev
```

Open http://localhost:3000.

### Dashboard environment (Supabase)

The dashboard uses Supabase for data. Either:

- Use a Supabase project and create `dashboard/.env.local` with:
  - `NEXT_PUBLIC_SUPABASE_URL=<your-project-url>`
  - `SUPABASE_ANON_KEY=<your-anon-key>`
- Or point your Supabase project to the same Postgres (e.g. connection string in `.env` for the backend).

**Important when running scrapes from the dashboard:** The scraper is a child process and gets `DATABASE_URL` from the **repo root** `.env` (the API route reads it and passes it through). Set the root `.env` to your Supabase Postgres URL (Settings → Database → Connection string, pooler) so that "Do it all" / scrape-batch saves to the same database the dashboard displays. If `DATABASE_URL` in the root `.env` points to local Postgres or is missing, scrapes may write elsewhere and your dashboard total won’t increase.

API keys for email, Instantly, etc. can stay in the repo root `.env`; the dashboard can inherit or you can document which vars it needs in `.env.local`.

## 5. Optional: Celery + Redis

For async tasks (e.g. scraping), start Celery with Redis running:

```powershell
.\.venv\Scripts\Activate.ps1
celery -A src.celery_app worker -l info
```

(Use the real Celery app module name if different in this repo.)

## Quick reference

| Step              | Command / action                                      |
|-------------------|--------------------------------------------------------|
| Start DB + Redis  | `docker compose up -d`                                 |
| Migrations        | `alembic upgrade head` (with venv active)               |
| Python CLI        | `python run.py --help` (with venv active)              |
| Dashboard deps    | `cd dashboard && npm install`                          |
| Dashboard dev     | `cd dashboard && npm run dev` → http://localhost:3000  |

## Troubleshooting

- **`python` / `node` not found**  
  Install Python 3.12 and/or Node LTS via winget (see above), then open a **new** terminal.

- **Migrations fail (connection refused)**  
  Start Postgres first: `docker compose up -d`, then run `alembic upgrade head` again.

- **Dashboard “Missing Supabase env”**  
  Add `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_ANON_KEY` to `dashboard/.env.local` (or your Supabase-backed Postgres).

- **Scrapes from dashboard don’t increase total leads / “no businesses found”**  
  Ensure the **repo root** `.env` has `DATABASE_URL` set to your **Supabase** Postgres URL (Supabase Dashboard → Settings → Database → Connection string, use the pooler URL). The dashboard only has Supabase URL + anon key; the Python scraper needs the direct Postgres URL. The API route now passes `DATABASE_URL` from the root `.env` into the scraper so both use the same DB.

- **Playwright errors**  
  From repo root with venv active: `playwright install` to reinstall browsers.
