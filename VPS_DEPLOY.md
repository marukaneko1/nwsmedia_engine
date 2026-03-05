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
