# Yonder Inventory Operations

**Status:** Active  
**Purpose:** Define the supported execution modes for Yonder inventory refresh so operations do not depend on tribal knowledge.

---

## 1. Supported Modes

### Mode A: Co-Located Web + Crawlers

Use when:

- the web runtime can access the repo workspace
- the web runtime can execute `python3`
- `crawlers/` exists alongside `web/`

Execution path:

- call `/api/cron/yonder-inventory`
- that route runs `crawlers/scripts/run_yonder_inventory_cycle.py --apply`

Requirements:

- `YONDER_INVENTORY_CRON_API_KEY`
- `SUPABASE_SERVICE_KEY`
- `crawlers/` available on disk

### Mode B: External Crawler Host

Use when:

- web is deployed in a serverless-only environment
- the web deployment cannot shell into `crawlers/`

Execution path:

- schedule `python3 crawlers/scripts/run_yonder_inventory_cycle.py --apply` directly on the crawler host

Requirements:

- repo checkout present on the runner
- crawler Python environment configured
- DB credentials present in `.env`

This mode is the safer default for split deployments.

### Mode C: GitHub Actions Runner

Use when:

- the repository already uses GitHub Actions for scheduled crawler jobs
- you want a managed daily runner without relying on web runtime shell access

Execution path:

- `.github/workflows/yonder-inventory-refresh.yml`
- that workflow runs `python3 scripts/run_yonder_inventory_cycle.py --apply`

Requirements:

- GitHub Actions enabled for the repo
- secrets:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`

This is now the preferred scheduled mode for split deployments.

---

## 2. Trigger Helpers

Route trigger:

- `web/app/api/cron/yonder-inventory/route.ts`

Direct cycle runner:

- `crawlers/scripts/run_yonder_inventory_cycle.py`

External HTTP trigger helper:

- `web/scripts/trigger-yonder-inventory-cron.ts`

Example:

```bash
cd /Users/coach/Projects/LostCity/web
npx tsx scripts/trigger-yonder-inventory-cron.ts --force
```

GitHub Actions workflow:

- `.github/workflows/yonder-inventory-refresh.yml`

---

## 3. Current Live Yonder Settings

Portal:

- `slug = yonder`
- `settings.yonder_inventory_refresh = { cadence: daily, hour_utc: 11 }`

Freshness gate:

- `1` day max age

Retention rule:

- keep latest `2` capture dates per venue/provider/window

---

## 4. Hard Stop Conditions

Do not rely on the web cron route if:

- the deployment does not have local access to `crawlers/`
- `python3` is not available in the web runtime
- the runtime cannot access the shared `.env` / service credentials

In those cases, use the direct crawler-host mode or the GitHub Actions mode instead.
