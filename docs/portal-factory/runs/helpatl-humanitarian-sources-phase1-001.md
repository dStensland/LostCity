# HelpATL Humanitarian Sources Phase 1

Date: 2026-03-09

## Goal

Add the next missing humanitarian breadth lanes without forcing weak event sources into the portal.

## What Changed

- Replaced the broken generic `atlanta-legal-aid` event crawler logic with a direct parser for the official volunteer page.
- Added structured HelpATL volunteer opportunities for:
  - Hope Atlanta
  - IRC Atlanta
  - Atlanta Legal Aid
- Activated and federated `atlanta-legal-aid` as a real HelpATL-accessible source.
- Updated HelpATL source-pack wiring so Atlanta Legal Aid can surface in event-based volunteer lanes.
- Expanded structured volunteer cause filters and volunteer profile causes to include:
  - `housing`
  - `immigrant_refugee`
  - `legal_aid`

## Product Decision

- `atlanta-legal-aid` is now treated as both:
  - a dated source for volunteer training events
  - a structured long-term commitment source
- `hope-atlanta` and `irc-atlanta` remain structured-opportunity additions rather than event-feed sources because their official sites publish volunteer roles, not reliable dated calendars.

## Verification Plan

- dry-run the `atlanta-legal-aid` crawler
- apply migration 308
- validate and reprovision the HelpATL manifest
- refresh channel matches
- verify the structured volunteer API now returns Hope/IRC/Legal Aid roles

## Verification Results

- `atlanta-legal-aid` dry-run now returns `1` upcoming event from the official volunteer page.
- migration `308_helpatl_humanitarian_opportunities.sql` applied successfully.
- source-pack validation passed with `23` source slugs.
- HelpATL provisioning completed with `24` active source subscriptions.
- `atlanta-legal-aid` production crawl inserted `1` real event:
  - `Representing Survivors at Temporary Protective Order Hearings`
  - `April 2, 2026`
- HelpATL channel refresh completed:
  - `eventsScanned: 1518`
  - `matchesWritten: 2906`
- Updated event lane count:
  - `volunteer-this-week-atl: 1178`
- Structured volunteer inventory now includes:
  - `2` Hope Atlanta roles
  - `4` IRC Atlanta roles
  - `2` Atlanta Legal Aid roles
- Structured cause distribution now includes:
  - `housing`
  - `immigrant_refugee`
  - `legal_aid`

## Notes

- `hope-atlanta` and `irc-atlanta` remain intentionally outside the event-feed source pack because their current official volunteer surfaces publish role inventory, not reliable dated event calendars.
- The right consumer outcome is still achieved: both organizations now appear through HelpATL's structured commitment layer without introducing noisy zero-event crawlers.
