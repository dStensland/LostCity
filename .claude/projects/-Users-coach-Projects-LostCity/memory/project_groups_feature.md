---
name: Groups Feature (Crews)
description: Private friend groups for coordinating hangs and shared venue lists - PRD-036, Phase 1+2 built 2026-03-13
type: project
---

## Groups Feature — PRD-036

**Status**: Phase 1 (backend) + Phase 2 (UI) complete. Feature-flagged behind `ENABLE_GROUPS_V1`.

**What it is**: Private, invite-only friend groups with shared hangs, venue spots lists, and activity feeds. Built on top of existing hangs system — `group_id` FK on hangs table.

**Key decisions**:
- No chat (use existing group chats for that). LostCity = coordination layer, not conversation.
- No public group directory. Groups grow through personal invite links only.
- Emoji or image avatars. Emoji default, image upload available.
- Existing hang RSVP mechanics (soft/hard commit + ETA) — no new RSVP system.
- Groups are platform-level, not portal-scoped.
- `--vibe` (#A78BFA lavender) as the group accent color.
- Max 100 members per group, 20 groups per user.
- Activity feed is derived (query-time), not stored.

**Database**: Migration 492 — `groups`, `group_members`, `group_spots` tables + `group_id` on `hangs`. Triggers for max members, max groups, admin auto-promotion. Full RLS policies.

**API routes** (8 files under `web/app/api/groups/`):
- CRUD: `route.ts` (POST create, GET list mine), `[id]/route.ts` (GET detail, PATCH update, DELETE)
- Membership: `join/route.ts` (POST join via invite code), `[id]/invite-code/route.ts` (POST regenerate)
- Content: `[id]/spots/route.ts` (GET/POST), `[id]/spots/[spotId]/route.ts` (DELETE)
- Social: `[id]/activity/route.ts` (GET derived feed), `[id]/hangs/route.ts` (GET active+planned)

**React hooks** (`web/lib/hooks/useGroups.ts`): 13 hooks — 5 query + 8 mutation. No optimistic updates (groups are more relational than hangs).

**UI components**:
- `web/components/groups/GroupCard.tsx` — compact card for lists
- `web/components/groups/CreateGroupModal.tsx` — creation form modal
- `web/components/groups/MyGroupsSection.tsx` — Community Hub section
- `web/app/groups/[id]/page.tsx` — group detail with Activity/Spots/Members tabs
- `web/app/groups/join/[code]/page.tsx` — join via invite link

**Integrations**:
- `CommunityHub.tsx` — MyGroupsSection added before Plans section
- `HangSheet.tsx` — group selector added above visibility
- `hangs.ts` types — `group_id?: string` added to CreateHangRequest

**Phase 3 (not built)**: Group activity feed integration into friends hangs, "Saved by [Group]" badge on venue detail, empty states and onboarding.
**Phase 4 (future)**: Push notifications, group stats, suggest-a-spot, group plans integration.
