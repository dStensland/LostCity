# Quality Audit Plan - Atlanta Wave 2 (2026-02-19)

## Handoff Closeout
- Closed: `home-depot-backyard` stale-date ingestion spike. Current dry run found 2 future events.
- Closed: `steady-hand-beer` stale/invalid title ingestion spike. Current dry run found 0 events (clean, but likely inactive/no schedule).
- Closed: `monday-night-garage` data-goal mismatch (`venue_hours` now treated as `na` in audit script).
- Closed: `silverspot-cinema-atlanta` health deadlock. Repeated transient failures now use timed backoff instead of permanent skip.

## Fresh Queue Sweep (dry-run, 2026-02-19)
| Source | Result | Notes | Audit Bucket |
|---|---:|---|---|
| `home-depot-backyard` | 2 found | No stale flood; now only near-term events | monitor |
| `steady-hand-beer` | 0 found | No bad inserts; schedule may be inactive | lifecycle check |
| `silverspot-cinema-atlanta` | skipped/failed | Cloudflare challenge; transient backoff active | blocked-access |
| `clark-atlanta` | 0 found | Crawl succeeds, no upcoming events extracted | extractor-refresh |
| `community-foundation-atl` | 0 found | Crawl succeeds, no upcoming events extracted | extractor-refresh |
| `georgia-peace` | 0 found | Crawl succeeds, parser fallback still yields zero | extractor-refresh |
| `l5p-community-center` | 0 found | Finds article cards but no valid events | extractor-refresh |
| `moca-ga` | 0 found | Crawl succeeds, event selectors likely stale | extractor-refresh |
| `theatrical-outfit` | 0 found | Finds show URLs, event parsing likely stale | extractor-refresh |

## Post-Fix Update (dry-run, 2026-02-19)
- `clark-atlanta` extractor fixed: now `10 found`.
- `theatrical-outfit` extractor fixed: now `4 found`.
- `silverspot-cinema-atlanta` still blocked by Cloudflare and now correctly on transient backoff (`captcha`).
- `community-foundation-atl`: page states "Check back soon for upcoming events."
- `l5p-community-center`: page states "There are no upcoming events."
- `moca-ga`: "No Current or Upcoming Events" on current pages; old `/events` endpoint is 404.
- `steady-hand-beer`: events page appears to be archival (predominantly 2024 listings), no current dated schedule detected.
- `georgia-peace`: events path currently resolves to blog content with no structured upcoming event listings.

## Quality Audit Execution Plan
1. Source lifecycle verification (same day)
`steady-hand-beer`, `clark-atlanta`, `community-foundation-atl`, `georgia-peace`, `l5p-community-center`, `moca-ga`, `theatrical-outfit`: confirm whether public pages currently advertise dated future events.
Decision: if no upcoming events publicly listed, mark as seasonal/deactivated candidate instead of extractor defect.

2. Blocked-access mitigation (same day)
`silverspot-cinema-atlanta`: keep timed retry behavior, test one forced probe run every retry window, and evaluate alternate source path/API if challenge persists.
Decision: if blocked for 72+ hours, move to manual/alternate feed path.

3. Extractor refresh pass (1-2 days)
Completed for `clark-atlanta` and `theatrical-outfit` in this wave.
Decision: persist via non-dry crawl once write target is confirmed.

4. Data-goal re-audit and signoff (same day as remediation)
Run:
```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/audit_source_data_goals.py --portal atlanta --days 120 --output-json reports/source_data_goals_audit_atlanta_2026-02-19_post_wave2_remediation.json
```
Decision: close wave when each audited source is either (a) passing goals with valid events, or (b) intentionally reclassified as seasonal/deactivated with rationale.

Note: dry-run remediation does not change DB-backed audit counts; a write-enabled run is required before the audit JSON reflects these fixes.
