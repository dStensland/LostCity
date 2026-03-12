# HelpATL Provisioning Run 002 (Activation)

- Date: 2026-03-07
- Portal slug: `helpatl`
- Action: activate existing draft portal

## Execution

Command:

```bash
cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/provision-portal.ts \
  --manifest ../docs/portal-factory/manifests/atlanta-civic-volunteer-v1.json \
  --activate
```

## Result

- Portal ID: `8d479b53-bab7-433f-8df6-b26cf412cd1d`
- Status: `active`
- Active source subscriptions: `8`
- Active channels: `5`
- Channel rules: `6`

Post-activation match refresh:
- Events scanned: `17`
- Matches written: `7`

## Notes

1. School-board channel is still tag fallback and should be upgraded to source-backed rules in v2.
