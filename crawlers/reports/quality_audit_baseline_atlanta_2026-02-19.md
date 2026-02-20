# Quality Audit Baseline - Atlanta (2026-02-19)

Window: 120 days
Source report: source_data_goals_audit_atlanta_2026-02-19_fresh_scoped.json

## Source-goal snapshot
- Sources audited: 309
- Sources passing all goals: 269
- Sources with failures: 40

## Failure split
- Zero-event failures: 37
- Non-zero failures: 3

## Non-zero failing sources
- cdc-museum: events=3, failed_goals=exhibits
- cobb-library: events=10, failed_goals=images,specials,tickets
- gwinnett-library: events=16, failed_goals=specials,tickets

## Event-quality fingerprint (scoped upcoming events)
- Events sampled: 9738
- all_caps_title: 213 (2.2%)
- missing_image: 1633 (16.8%)
- missing_start_time_non_all_day: 195 (2.0%)
- missing_ticket_likely_paid_or_ticketed: 512 (5.3%)
- short_description: 1298 (13.3%)
