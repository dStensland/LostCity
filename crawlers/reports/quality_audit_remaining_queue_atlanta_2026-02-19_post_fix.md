# Quality Audit Remaining Queue - Post Fix (2026-02-19)

## Resolved in this wave (dry-run validated)
1. `clark-atlanta` -> 10 events found after switching to CAU calendar API.
2. `theatrical-outfit` -> 4 events found after switching to calendar performance nodes.

## Remaining priority queue
1. `silverspot-cinema-atlanta` (blocked-access)
Evidence: Cloudflare challenge and health transient backoff (`captcha`).

2. `steady-hand-beer` (likely stale archive)
Evidence: Events page content appears archival (mostly 2024 entries), no current dated schedule.

3. `georgia-peace` (likely deactivated or migrated)
Evidence: events path resolves to blog-like content without structured upcoming events.

4. `community-foundation-atl` (likely no upcoming schedule)
Evidence: site copy says "Check back soon for upcoming events."

5. `l5p-community-center` (likely no upcoming schedule)
Evidence: calendar UI and embedded payload show "There are no upcoming events."

6. `moca-ga` (likely no upcoming schedule)
Evidence: page copy says "No Current or Upcoming Events"; old `/events` URL is 404.

## Operational note
- Remediation is currently dry-run verified.
- Persisting recovered events requires write-enabled crawler runs (e.g. `--allow-production-writes` or staging target).
