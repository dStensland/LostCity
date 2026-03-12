# Performance Operations

## Local

Run an end-to-end local performance gate (build + start + prewarm + audit):

```bash
cd web
npm run perf:local
```

Optional env vars:
- `PERF_PORT` (default `4010`)
- `BASE_URL` (default `http://127.0.0.1:$PERF_PORT`)

## Remote/Staging/Prod

Run against any deployed URL:

```bash
cd web
BASE_URL=https://your-domain.com npm run perf:check
BASE_URL=https://your-domain.com npm run search:check
```

Available variants:
- `npm run perf:check` (cold <= 1500ms, warm <= 500ms)
- `npm run perf:check:strict` (cold <= 1200ms, warm <= 350ms)
- `npm run search:check` (prewarm + autocomplete quality audit with retries)

## GitHub Workflow

Workflow: `.github/workflows/web-perf-smoke.yml`

- Supports manual dispatch with `base_url` input.
- Runs daily on schedule.
- Reads `WEB_PERF_BASE_URL` secret if no input URL is provided.
- Runs both the latency audit and the search quality audit.
- Publishes markdown reports in the step summary and as workflow artifacts.
