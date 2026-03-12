# HelpATL Policy Watch Wave 2

- Date: 2026-03-11
- Portal: `helpatl`
- Surface: `consumer`
- Goal: deepen HelpATL's local policy/news authority without making Atlanta's default feed more wonky

## Scope

1. Add `GBPI` as a HelpATL-local network source
2. Move `Atlanta Civic Circle` from Atlanta's local pool into HelpATL's local policy pool
3. Fetch current posts for `GBPI`
4. Verify HelpATL local policy/news sources increase from `2` to `4`

## Rationale

- `Georgia Recorder` and `Capitol Beat` provide statewide reporting
- `Atlanta Civic Circle` is the strongest Atlanta-local policy explainer source
- `GBPI` adds policy analysis and budget/economic framing that suits the HelpATL audience
- Atlanta should retain a lighter city-news mix; HelpATL should carry the more policy-serious layer locally

## Verification plan

1. Confirm feed health for `GBPI` and `Atlanta Civic Circle`
2. Apply the local network-source reassignment
3. Run network feed ingestion for `GBPI`
4. Validate local vs parent source counts for `helpatl` and `atlanta`

## Result

- `GBPI` is now a HelpATL-local network source
- `Atlanta Civic Circle` moved from Atlanta's local network pool into HelpATL's local policy pool
- HelpATL local policy/news sources increased from `2` to `4`
- HelpATL local policy/news source set is now:
  - `atlanta-civic-circle`
  - `capitol-beat`
  - `gbpi`
  - `georgia-recorder`

## Live impact

- HelpATL local active network sources: `4`
- HelpATL local posts in 30 days: `45`
- HelpATL resolved posts in 30 days: `187`
- Atlanta local active network sources: `15`
- Atlanta resolved posts in 30 days: `142`

## Verification run

1. Verified feed health for:
   - `https://gbpi.org/feed/`
   - `https://atlantaciviccircle.org/feed/`
2. Ran network ingestion:
   - `python3 scrape_network_feeds.py --source gbpi --limit 20`
   - `python3 scrape_network_feeds.py --source atlanta-civic-circle --limit 20`
3. Validated inheritance:
   - `npx tsx scripts/portal-factory/validate-network-feed-inheritance.ts helpatl,atlanta`
