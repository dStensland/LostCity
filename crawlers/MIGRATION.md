# Crawler Migration Guide: Legacy Python → v2 Profile

## When to Migrate

- **New sources:** Always create a v2 profile. No new Python crawlers.
- **Broken crawlers:** When a legacy crawler breaks, migrate instead of patching.
- **Batch sprints:** Agents can convert batches of simple crawlers in parallel.

## Migration Steps

### 1. Generate the v2 profile

```bash
python scripts/generate_v2_profile.py sources/my_crawler.py --dry-run
```

Review the output. Fix any issues (wrong URLs, missing category, etc.)

```bash
python scripts/generate_v2_profile.py sources/my_crawler.py
```

### 2. Test the profile pipeline

```bash
python pipeline_main.py --source my-crawler --limit 5
```

### 3. Switch to LLM extraction

Edit the profile: change `parse.method: custom` to `parse.method: llm` and remove `module:`.

Test: `python pipeline_main.py --source my-crawler --limit 5`

### 4. Archive the Python file

```bash
mv sources/my_crawler.py sources/archive/
```

### 5. Verify and commit

```bash
python main.py --source my-crawler --dry-run
git add sources/profiles/my-crawler.yaml sources/archive/my_crawler.py
git commit -m "migrate: convert my-crawler from Python to v2 profile with LLM extraction"
```

## When NOT to Migrate

- **API adapters** (Ticketmaster, Eventbrite, AEG) — complex API logic
- **Multi-page auth flows** — session/cookie management
- **Playwright-dependent** — genuinely needs browser rendering
- Keep these as `parse.method: custom` in their v2 profile.

## Batch Migration

```bash
python scripts/generate_v2_profile.py --batch sources/a.py sources/b.py sources/c.py
python scripts/migration_status.py
```
