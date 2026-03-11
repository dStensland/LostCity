# HelpATL Provisioning Run 003 (School-Board Source-Backed v2)

- Date: 2026-03-07
- Portal slug: `helpatl`
- Action: replace school-board tag fallback with source-backed rules

## Changes Applied

1. Added school-board source profiles:
   - `crawlers/sources/profiles/atlanta-public-schools-board.yaml`
   - `crawlers/sources/profiles/fulton-county-schools-board.yaml`
   - `crawlers/sources/profiles/dekalb-county-schools-board.yaml`
2. Added/activated source rows and sharing rules:
   - `atlanta-public-schools-board` (ID `1185`)
   - `fulton-county-schools-board` (ID `1186`)
   - `dekalb-county-schools-board` (ID `1187`)
3. Updated manifest source pack and `school-board-watch` rule set:
   - active source rule over 3 school-board sources
   - old `tag=school-board` fallback rule deactivated
4. Re-applied manifest with activation mode.

## Validation + Provisioning Results

- Source-pack validation: pass (`11` source slugs, no missing/inactive rows)
- Provisioning update result:
  - sections: `insert=0`, `update=3`
  - channels: `insert=0`, `update=5`
  - rules: `insert=1`, `update=0`, `deactivate=1`
- Portal status: `active`
- Active source subscriptions: `11`

## School-Board Rule State

- `school-board-watch` active rule:
  - `rule_type=source`
  - `source_slugs=[atlanta-public-schools-board, fulton-county-schools-board, dekalb-county-schools-board]`
- `school-board-watch` fallback rule:
  - `rule_type=tag`
  - `tag=school-board`
  - `is_active=false`

## Match Refresh

- Manual match materialization after v2:
  - events scanned: `17`
  - matches written: `7`
