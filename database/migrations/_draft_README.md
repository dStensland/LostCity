# Draft migrations (not applied)

These `.sql.draft` files are future scaffolding committed for visibility,
not applied by the migration runner.

## Activation

When the product decides to ship multi-stop plans / voting-on-location
(per spec Section 5 item 4 of
`docs/superpowers/specs/2026-04-18-social-coordination-consolidation-design.md`),
review the draft SQL, promote to numbered migrations via
`python3 database/create_migration_pair.py plan_stops`, and apply.

## Files

- `_draft_plan_stops.sql.draft` — stops-within-a-plan table
- `_draft_plan_stop_invitees.sql.draft` — per-stop invitee RSVP
