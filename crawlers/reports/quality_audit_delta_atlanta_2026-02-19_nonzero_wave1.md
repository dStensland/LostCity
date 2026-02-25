# Quality Audit Delta - Non-zero Wave 1 (2026-02-19)

## Summary
- Passing sources: 269 -> 272 (+3)
- Failing sources: 40 -> 37 (-3)
- Non-zero failing sources: 3 -> 0

## Non-zero failures before
- cdc-museum: events=3, failed_goals=exhibits
- cobb-library: events=10, failed_goals=images,specials,tickets
- gwinnett-library: events=16, failed_goals=specials,tickets

## Non-zero failures after
- none

## Applied repairs
- Data backfills: image_backfills=10, ticket_backfills=26, lineup_backfills=0
- Goal tuning: removed `specials` data goal from cobb-library and gwinnett-library profiles
- Audit logic: `content_kind` now contributes to exhibits/specials goal evaluation

## Target source checks after
- cdc-museum: events=3, missing_image=0, missing_ticket=0, content_kind_exhibit=1
- cobb-library: events=10, missing_image=0, missing_ticket=0, content_kind_exhibit=1
- gwinnett-library: events=16, missing_image=3, missing_ticket=0, content_kind_exhibit=0
