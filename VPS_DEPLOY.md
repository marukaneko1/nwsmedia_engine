# VPS Deployment — Budget Options for 24/7 Lead Engine

Your stack needs: **Python, Celery, Redis, Playwright (Chromium)**. Plan for **at least 2GB RAM**; **4GB is more comfortable** for scraping + worker.

---

## Option 1: **Hetzner Cloud** (best value, paid)

- **Price:** ~**€4.51–7/mo** (~$5–8 USD)
- **Specs (CX22):** 2 vCPU, 4GB RAM, 40GB SSD, 20TB traffic
- **Why it works:** Same region (US or EU) as your Supabase/APIs, plenty of RAM for Playwright + Celery, very reliable.
- **Signup:** [hetzner.com/cloud](https://www.hetzner.com/cloud) — create a project, add a CX22 (or CX21 if you want the smallest 4GB option).

**Regions:** Falkenstein, Nuremberg, Helsinki (EU); Ashburn (US). Pick one close to you or your Supabase region.

---

## Option 2: **DigitalOcean** (easiest, paid)

- **Price:** **$12/mo** (2GB) or **$18/mo** (4GB)
- **Why it works:** Simple UI, great docs, one-click Ubuntu. New accounts often get **$200 credit** (search “DigitalOcean promo”).
- **Signup:** [digitalocean.com](https://www.digitalocean.com) → Create Droplet → Ubuntu 22.04 → Basic plan, 2GB or 4GB.

---

## Option 3: **Oracle Cloud Free Tier** (free, more setup)

- **Price:** **$0** (Always Free)
- **Specs:** 4 ARM cores, **24GB RAM**, 200GB storage
- **Why it works:** More than enough for this app; no monthly cost.
- **Catch:** Signup can take a day; console and firewall (security lists, ingress rules) are fiddly. Some people report account/review issues; use a real card and avoid mining/crypto.
- **Signup:** [oracle.com/cloud/free](https://www.oracle.com/cloud/free/) — create Always Free ARM VM (Ubuntu 22.04).

---

## Recommendation

| If you want…              | Choose              |
|---------------------------|---------------------|
| **Cheapest that’s reliable** | **Hetzner** (CX22)   |
| **Easiest and predictable** | **DigitalOcean**     |
| **$0 and you’re okay with setup** | **Oracle Free** |

For “budget but no headaches,” **Hetzner CX22** is the sweet spot.

---

## After you create the VPS

1. **OS:** Ubuntu 22.04 LTS.
2. **On the server:** Install Python 3.12, Redis, Chromium (for Playwright), clone your repo, set `.env` (same vars as local, including `DATABASE_URL` to Supabase).
3. **Processes to run 24/7:**  
   - `celery -A src.celery_app worker --pool=solo`  
   - `celery -A src.celery_app beat`  
   Use **systemd** (or a process manager) so they restart on reboot.
4. **Optional:** Run the Next.js dashboard on the same box or on Vercel; if same box, use a process manager (e.g. systemd or PM2) and a reverse proxy (e.g. Caddy or Nginx).

If you tell me which option you picked (Hetzner, DigitalOcean, or Oracle), I can give you step-by-step commands for that provider (create VM → SSH → install stack → systemd units).

---

## Server is running — what to do next (Hetzner)

Your server has an **IPv4** (e.g. `178.156.247.36`). Do the following.

### 1. SSH in

From your PC (Command Prompt or PowerShell):

```bat
ssh root@178.156.247.36
```

(Replace with your server’s actual IP.) Accept the host key if asked.

### 2. Get the project on the server

**Option A — GitHub (recommended)**  
Push this repo to a private GitHub repo, then on the server:

```bash
apt-get update && apt-get install -y git
git clone https://github.com/YOUR_USERNAME/nwsmedia_engine.git /opt/nwsmedia
cd /opt/nwsmedia
```

**Option B — Copy from your PC**  
From **PowerShell on your PC** (not on the server), from the folder that contains `nwsmedia_engine`:

```powershell
scp -r .\nwsmedia_engine\* root@178.156.247.36:/opt/nwsmedia/
```

Then on the server: `mkdir -p /opt/nwsmedia` first if you did the clone step differently.

### 3. Run the setup script on the server

On the server (over SSH), after the code is in `/opt/nwsmedia`:

```bash
chmod +x scripts/setup-hetzner.sh
./scripts/setup-hetzner.sh
```

The script installs Python 3.12, Redis, Chromium, dependencies, and systemd services. It will stop if `.env` is missing.

### 4. Create `.env` on the server

On the server:

```bash
cd /opt/nwsmedia
cp .env.example .env
nano .env
```

Paste the same values as on your PC: `DATABASE_URL` (Supabase), `REDIS_URL=redis://localhost:6379/0`, all API keys, `SUMMARY_EMAIL_FROM`, `SUMMARY_EMAIL_PASSWORD`, `SUMMARY_EMAIL_TO`, etc. Save (Ctrl+O, Enter, Ctrl+X).

### 5. Finish setup and start services

```bash
./scripts/setup-hetzner.sh
```

If the script already ran once and only complained about `.env`, install deps and start services manually:

```bash
cd /opt/nwsmedia
.venv/bin/pip install -e .
.venv/bin/playwright install chromium
systemctl start nwsmedia-worker nwsmedia-beat
systemctl status nwsmedia-worker nwsmedia-beat
```

### 6. Check that it’s running

- `systemctl status nwsmedia-worker nwsmedia-beat` — both should be **active (running)**.
- `journalctl -u nwsmedia-worker -f` — worker logs (Ctrl+C to exit).

The pipeline will run on the schedule (e.g. full pipeline at 2:00 AM, summary email at 8:00 AM server time). Use the same Supabase DB so the dashboard on your PC (or elsewhere) shows the same data.

---

### 7. Updating the server (if `/opt/nwsmedia` is not a git clone)

If the server was set up by copying files (e.g. `scp`) instead of `git clone`, you can’t use `git pull`. Update the code by syncing from your PC:

**From PowerShell on your PC** (run `cd C:\Users\mkane\nwsmedia_engine` first):

```powershell
# Python / backend
scp -r .\src root@178.156.247.36:/opt/nwsmedia/
scp .\run.py root@178.156.247.36:/opt/nwsmedia/
scp .\pyproject.toml root@178.156.247.36:/opt/nwsmedia/

# Dashboard — sync only app code (do NOT sync whole .\dashboard; it includes node_modules and .next and will fail)
scp -r .\dashboard\app root@178.156.247.36:/opt/nwsmedia/dashboard/
scp -r .\dashboard\components root@178.156.247.36:/opt/nwsmedia/dashboard/
scp -r .\dashboard\lib root@178.156.247.36:/opt/nwsmedia/dashboard/
scp -r .\dashboard\public root@178.156.247.36:/opt/nwsmedia/dashboard/
scp -r .\dashboard\types root@178.156.247.36:/opt/nwsmedia/dashboard/
scp .\dashboard\package.json .\dashboard\package-lock.json root@178.156.247.36:/opt/nwsmedia/dashboard/
scp .\dashboard\tsconfig.json .\dashboard\next.config.ts .\dashboard\postcss.config.mjs .\dashboard\eslint.config.mjs root@178.156.247.36:/opt/nwsmedia/dashboard/
```

(`app/` already contains `globals.css`.) On the server, run `npm install` in `/opt/nwsmedia/dashboard` only if you build or run the dashboard there; the Python worker does not need it.

Then on the server:

```bash
cd /opt/nwsmedia
.venv/bin/pip install -e .
systemctl restart nwsmedia-worker nwsmedia-beat
```

**Optional: use git on the server**  
To use `git pull` in the future, on the server run once:

```bash
cd /opt/nwsmedia
git init
git remote add origin https://github.com/marukaneko1/nwsmedia_engine.git
git fetch origin main
git reset --hard origin/main
# Keep your .env (don't overwrite)
.venv/bin/pip install -e .
systemctl restart nwsmedia-worker nwsmedia-beat
```

---

### 8. Troubleshooting: pipeline and summary email not running on schedule

The **nightly pipeline** runs at **2:00 AM** and the **daily summary email** at **8:00 AM** (America/New_York). Both are triggered by **Celery Beat**. If nothing runs at those times, check the following on the server.

#### 1. Beat must be running

Beat is what actually enqueues the scheduled tasks. If only the worker is running, manual `trigger-pipeline` works but the 2am/8am schedule never fires.

```bash
systemctl status nwsmedia-worker nwsmedia-beat
```

You must see **both** `active (running)`. If `nwsmedia-beat` is inactive or failed:

```bash
sudo systemctl start nwsmedia-beat
sudo systemctl enable nwsmedia-beat
journalctl -u nwsmedia-beat -n 50 --no-pager
```

#### 2. Redis must be up

The worker and beat use Redis as the broker. If Redis is down, tasks are not enqueued or executed.

```bash
systemctl status redis-server
redis-cli ping   # should reply PONG
```

#### 3. Summary email env vars

The 8am email only sends if these are set in `/opt/nwsmedia/.env`:

- `SUMMARY_EMAIL_FROM` (e.g. your Gmail)
- `SUMMARY_EMAIL_PASSWORD` (Gmail app password)
- `SUMMARY_EMAIL_TO` (recipient address)

If any are missing, the task still runs but logs `summary_email_skipped` and does not send. Check:

```bash
cd /opt/nwsmedia
grep -E "SUMMARY_EMAIL_FROM|SUMMARY_EMAIL_PASSWORD|SUMMARY_EMAIL_TO" .env
```

#### 4. Test the schedule manually

Without waiting for 2am/8am, you can trigger the same tasks from the server:

```bash
cd /opt/nwsmedia
# Trigger full pipeline (same as 2am)
.venv/bin/python run.py trigger-pipeline --max-per-run 75 --parallel 5

# Trigger summary email (same as 8am)
.venv/bin/python run.py trigger-summary
```

If `trigger-summary` runs but you don’t get an email, check the worker logs for `summary_email_skipped` or `summary_email_failed` (e.g. wrong password or missing env).

#### 5. Service names

The setup script creates **nwsmedia-worker** and **nwsmedia-beat**. If you created custom units named e.g. `celery-worker` and `celery-beat`, use those names in the `systemctl` commands above and ensure the beat unit runs the same app: `celery -A src.celery_app beat`.

---

### 9. Deduplicate existing leads

To see how many duplicate businesses exist (same name+phone or name+city):

```bash
cd /opt/nwsmedia
.venv/bin/python run.py dedup --dry-run
```

To remove duplicates (keeps oldest row per business, deletes the rest and their related data):

```bash
.venv/bin/python run.py dedup
```

Then re-run the pipeline so triage/score/enrich apply to the cleaned set: from the dashboard run **Scraper → Auto** (or trigger pipeline manually).
