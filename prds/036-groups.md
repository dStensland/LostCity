# PRD-036: Groups ("Crews")

**Status:** Strategy Lock
**Type:** Social Layer Extension (T3)
**Tagline:** Your people, your spots, your plans.

---

## Mission

Groups answer: **"What are my people doing?"**

LostCity already answers "what's happening?" (Feed) and "what should I do?" (Find). Groups close the coordination gap — the reason most plans die isn't lack of options, it's lack of alignment between friends. Groups give friend clusters a shared home for hangs, spots, and plans without building yet another chat app.

---

## What This Is NOT

| Not This | Instead |
|----------|---------|
| Chat app (Slack, iMessage, Discord) | Coordination layer — "where" and "when," not "lol did you see that" |
| Public communities (Facebook Groups, Meetup) | Private crews — invite-only, no directory, no strangers |
| Event management platform (Eventbrite, Partiful) | Lightweight hangs — "I'll be at Ormsby's at 7, who's in?" |
| Social network feed | Shared venue intelligence — spots list, group activity history |
| Forum / message board | No threads, no posts, no content feed |

---

## Differentiation

The unique angle: **group coordination attached to venue and event data.**

GroupMe doesn't know what's happening at Monday Night Brewing tonight. Slack can't show you which of your crew is already at the bar. iMessage can't maintain a shared list of places you want to try together. LostCity can do all three because groups sit on top of the venue/event layer.

---

## Primary Users

**The Organizer** (you, with your Cheers Bar group)
- Has an existing friend group that coordinates through scattered channels
- Wants a single place where "let's hang" turns into an actual plan
- Tired of the "where should we go?" → "idk, wherever" → nobody goes loop

**The Joiner**
- Part of 1-3 friend groups, not the one who organizes
- Wants to see what the crew is doing without asking
- Will show up if it's easy to see who's going and where

**The Explorer Crew**
- Group of friends who try new places together
- Values a shared "want to try" list
- Uses the group as a filter on the city: "our kind of spots"

---

## Core Features

### F1: Groups (Entity)

A named, persistent collection of LostCity users.

**Data Model:**

```sql
CREATE TABLE groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  description   TEXT CHECK (char_length(description) <= 280),
  emoji         TEXT,                          -- group avatar emoji (optional, used if no image)
  avatar_url    TEXT,                          -- group avatar image (optional, overrides emoji)
  creator_id    UUID NOT NULL REFERENCES profiles(id),
  invite_code   TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  visibility    TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted')),
  max_members   INT NOT NULL DEFAULT 50 CHECK (max_members BETWEEN 2 AND 100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Visibility:**
- `private` — Only members can see the group exists. Joinable via invite link only.
- `unlisted` — Group name visible on member profiles (if their privacy allows). Still joinable via invite link only.
- No `public` visibility at launch. No group directory. No search. Groups grow through personal invitation, not discovery.

**Avatar:** Emoji picker (default) or image upload. Most groups will use an emoji — it's fast and fun. Image upload available for groups that want a photo (the crew at a tailgate, etc.).

**Invite code:** 16-char hex string. Shareable as `lostcity.com/groups/join/{code}`. Admins can regenerate (invalidates old link). No expiry at launch.

---

### F2: Group Membership

```sql
CREATE TABLE group_members (
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id),
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_by  UUID REFERENCES profiles(id),
  PRIMARY KEY (group_id, user_id)
);
```

**Roles:**
- `admin` — Can invite, remove members, edit group info, regenerate invite link, delete group. Creator is auto-admin.
- `member` — Can post hangs, add/remove spots, see all group activity. Can leave anytime.

**Limits:**
- Max 100 members per group (prevents "group" from becoming "community")
- Max 20 groups per user (prevents spam/hoarding)
- No minimum members — a group of 2 is fine (couples, workout buddies)

**Leaving/Removal:**
- Members can leave voluntarily
- Admins can remove members
- If last admin leaves, most senior member auto-promoted
- If last member leaves, group is soft-deleted

**Block propagation:** If User A blocks User B, and both are in the same group, they remain in the group but B's hangs/activity are hidden from A (consistent with existing block behavior). No auto-removal — that would reveal the block.

---

### F3: Group Hangs

Extend the existing `hangs` table with a group dimension.

```sql
ALTER TABLE hangs ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
CREATE INDEX idx_hangs_group_active ON hangs (group_id, status, started_at DESC)
  WHERE group_id IS NOT NULL AND status IN ('active', 'planned');
```

**Behavior:**
- A hang with `group_id` is visible to group members (regardless of `visibility` setting on the hang itself)
- `visibility` still controls non-group reach: `friends` means your non-group friends also see it, `private` means only group members see it
- Creating a group hang = creating a regular hang + tagging it to a group
- One active hang per user (existing constraint) — so a group hang IS your hang, you're just flagging which crew you're with
- Planned group hangs serve as lightweight "who's in?" coordination

**UX Flow:**
1. User opens HangSheet (existing component)
2. New "Group" selector appears if user has groups — pick which crew this is for (or "Just me")
3. Hang is created with `group_id` set
4. Group members see it in their group's activity feed
5. Other group members can "join" by creating their own hang at the same venue (linking happens at venue level, not explicit RSVP)

**RSVP:** Uses the existing hang RSVP mechanics — soft commit ("maybe"), hard commit ("I'm in"), and ETA ("I'll be there around 8"). No new RSVP system needed. Group members see who's committed and when they're planning to arrive.

---

### F4: Group Spots

Shared venue wishlist/favorites for the group.

```sql
CREATE TABLE group_spots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  venue_id    INT NOT NULL REFERENCES venues(id),
  added_by    UUID NOT NULL REFERENCES profiles(id),
  note        TEXT CHECK (char_length(note) <= 140),  -- "great patio" / "try the wings"
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, venue_id)
);
```

**Purpose:** "Places we like" and "places we want to try." The shared answer to "where should we go?"

**UX:**
- Any member can add or remove spots
- Optional short note per spot (140 chars — "best wings in the city", "they have cornhole")
- Spots link to full venue detail (inherits all LostCity venue intelligence)
- On venue detail pages, show "Saved by Cheers Bar" badge if the viewing user's group has this spot

---

### F5: Group Activity Feed

Lightweight timeline showing what's happening in the group. NOT a social feed — no likes, comments, or posts.

**Activity types (auto-generated, not user-created):**
- 🍺 `hang_started` — "Alex checked in at Monday Night Brewing"
- 📍 `spot_added` — "Jordan added Ormsby's to group spots"
- 👋 `member_joined` — "Sam joined the group"
- 📅 `hang_planned` — "Alex is heading to Painted Duck on Saturday"

**Implementation:** Derived from existing data (hangs, spots, members) via query, not a separate activity/events table. Keeps the data model clean and avoids sync issues.

**Retention:** Show last 30 days of activity. No infinite scroll through group history.

---

## Navigation & Surface Area

### Where Groups Live

**Community Hub** (the "Going Out" tab) — Groups appear as a section:

```
Community Hub
├── [Active Hang Banner]        (existing)
├── My Groups                   ← NEW
│   ├── Group cards (compact)
│   └── "Create a Group" CTA
├── Friends Out Now             (existing)
│   ├── Friend hang rows
│   └── Hot venues
└── Plans                       (existing)
```

**Group Detail Page** — `/groups/[id]` (standalone, outside portal routing):

```
Group Detail
├── Header: emoji + name + member count + "Invite" button
├── Tabs:
│   ├── Activity (default) — recent group hangs + spots added
│   ├── Spots — venue cards grid
│   └── Members — avatar list + roles
└── FAB: "Check In with [Group Name]" → opens HangSheet with group pre-selected
```

**Why outside portal routing?** A group might have members who use different portals. The Cheers Bar crew doesn't care about portal context — they care about each other. Groups are platform-level, not portal-scoped.

---

## Visual Design Direction

Groups should feel warm and personal — these are your friends, not a product feature.

### Group Card (Community Hub)

```
┌─────────────────────────────────┐
│  🍺  Cheers Bar           5/50  │
│  "Ormsby's at 7?"    · 2h ago   │
│  ●●●●○  Alex, Jordan +3        │
└─────────────────────────────────┘
```

- Avatar: emoji (40px) or group image (40px, rounded-xl)
- Group name in `text-base font-semibold text-[var(--cream)]`
- Member count as `text-xs text-[var(--muted)]`
- Latest activity preview in `text-sm text-[var(--soft)]` (truncated)
- Member avatars as stacked circles (max 5 shown)
- Card: `border border-[var(--twilight)] rounded-xl` — no glow, no drama

### Group Detail Header

```
┌─────────────────────────────────┐
│         🍺 / 📷                  │
│        Cheers Bar                │
│     5 members · est. Mar 2026    │
│                                  │
│  [Invite Friends]  [Settings ⚙]  │
└─────────────────────────────────┘
```

- Centered avatar: emoji (48px) or image (64px, rounded-2xl)
- Group name: `text-2xl font-semibold text-[var(--cream)]`
- Metadata: `text-sm text-[var(--muted)]`
- Accent color: `--vibe` (#A78BFA, lavender) — distinct from hangs (green) and plans (coral)
- Invite button: `bg-[var(--vibe)] text-white rounded-full`

### Group Hang Indicator

When someone checks in with a group, the hang strip shows the group context:

```
●  Alex is at Ormsby's        🍺 Cheers Bar
   "Wings and cornhole"       · 45m ago
```

Group emoji + name appears as a subtle badge on hang rows, letting other members know this is a crew hang.

### Color Language

- `--vibe` (#A78BFA) — Group accent color (headers, badges, invite button)
- `--cream` — Group names, member names
- `--soft` — Activity text, timestamps
- `--twilight` — Card borders, dividers
- `--neon-green` — Active hang indicators (inherited from hangs system)

---

## API Routes

### Groups CRUD

```
POST   /api/groups                  — Create group
GET    /api/groups                  — List my groups
GET    /api/groups/[id]             — Group detail
PATCH  /api/groups/[id]             — Update group (admin)
DELETE /api/groups/[id]             — Delete group (admin)
```

### Membership

```
POST   /api/groups/join             — Join via invite code { invite_code }
POST   /api/groups/[id]/members     — Invite user (admin) { user_id }
DELETE /api/groups/[id]/members/[userId] — Remove member (admin) or leave (self)
PATCH  /api/groups/[id]/members/[userId] — Change role (admin) { role }
```

### Group Spots

```
GET    /api/groups/[id]/spots       — List group spots
POST   /api/groups/[id]/spots       — Add spot { venue_id, note? }
DELETE /api/groups/[id]/spots/[spotId] — Remove spot
```

### Group Activity

```
GET    /api/groups/[id]/activity    — Recent activity (derived, not stored)
```

### Group Hangs (extends existing)

```
POST   /api/hangs                   — Existing route, add optional group_id to body
GET    /api/groups/[id]/hangs       — Active + planned hangs for this group
```

---

## RLS Policies

```sql
-- Groups: members can read, creator/admins can modify
CREATE POLICY groups_select ON groups FOR SELECT USING (
  id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);

CREATE POLICY groups_insert ON groups FOR INSERT WITH CHECK (
  creator_id = auth.uid()
);

CREATE POLICY groups_update ON groups FOR UPDATE USING (
  id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY groups_delete ON groups FOR DELETE USING (
  creator_id = auth.uid()
);

-- Group members: members can see other members, admins can modify
CREATE POLICY group_members_select ON group_members FOR SELECT USING (
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);

CREATE POLICY group_members_insert ON group_members FOR INSERT WITH CHECK (
  -- Either self-joining via invite code (handled at API layer) or admin adding
  user_id = auth.uid() OR
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY group_members_delete ON group_members FOR DELETE USING (
  -- Self-leave or admin removal
  user_id = auth.uid() OR
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid() AND role = 'admin')
);

-- Group spots: members can CRUD
CREATE POLICY group_spots_select ON group_spots FOR SELECT USING (
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);

CREATE POLICY group_spots_insert ON group_spots FOR INSERT WITH CHECK (
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);

CREATE POLICY group_spots_delete ON group_spots FOR DELETE USING (
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);

-- Hangs with group_id: visible to group members (extends existing policies)
CREATE POLICY hangs_select_group ON hangs FOR SELECT USING (
  group_id IS NOT NULL AND
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()) AND
  NOT is_blocked(auth.uid(), user_id)
);
```

---

## Build Phases

### Phase 1: Foundation (MVP)
- [ ] Migration: `groups`, `group_members`, `group_spots` tables + RLS
- [ ] Migration: `group_id` column on `hangs`
- [ ] API: Groups CRUD + membership + join via invite code
- [ ] API: Group spots CRUD
- [ ] API: Group hangs (extend existing POST /api/hangs)
- [ ] Types: `Group`, `GroupMember`, `GroupSpot`, `GroupActivity`
- [ ] Hooks: `useMyGroups()`, `useGroup()`, `useGroupSpots()`, `useGroupHangs()`

### Phase 2: UI
- [ ] Group creation flow (name, emoji, description)
- [ ] Group detail page (`/groups/[id]`)
- [ ] Group spots list with add/remove
- [ ] Group members list with role management
- [ ] Invite link sharing (copy to clipboard, native share)
- [ ] Join page (`/groups/join/[code]`)
- [ ] Community Hub "My Groups" section
- [ ] HangSheet group selector

### Phase 3: Integration
- [ ] Group activity feed (derived query)
- [ ] Group hang badge on hang strips
- [ ] "Saved by [Group]" badge on venue detail
- [ ] Group hangs in friends' hangs feed (for members)
- [ ] Empty states and onboarding prompts

### Phase 4: Polish (Post-Launch)
- [ ] Push notifications for group hangs ("Alex just checked in with Cheers Bar")
- [ ] Group stats (most visited spot, total hangs, etc.)
- [ ] "Suggest a spot" — propose a venue for the group to try
- [ ] Group plans integration (coordinate Plans within a group)

---

## Non-Goals (v1)

- **No chat/messaging** — Use your existing group chat for that
- **No public group directory** — Groups grow through personal invitation
- **No group-created events** — Hangs are the primitive, not events
- **No group profiles/pages** — Groups are private coordination tools, not public brands
- **No cross-group features** — No "groups you might like," no group discovery
- **No content moderation tools** — At 50-100 max members with invite-only, trust the group
- **No group-level analytics** — No dashboards, no engagement metrics
- **No portal scoping** — Groups are platform-level, not portal-specific

---

## Success Metrics

**Launch Gate:**
- 5+ groups created by real users within first week
- At least 1 group hang posted

**Month 1:**
- 20+ active groups (≥2 members, activity in last 7 days)
- Group hangs represent 20%+ of all hangs created
- Group spots lists averaging 5+ venues per active group

**Month 3:**
- Retention: 60%+ of group creators still active
- Groups driving repeat usage (users in groups have 2x+ session frequency)
- Organic growth: 50%+ of new group members joined via invite link (not admin add)

---

## Open Questions

1. **Should group hangs auto-notify members?** Leaning yes for v1 (in-app only, not push). Low volume (your crew, not spam). But needs the notification infrastructure from T4.
2. **Portal attribution for group hangs?** Probably inherit from venue (existing behavior). Group itself is portal-agnostic.
3. **Can a hang be tagged to multiple groups?** No — one group per hang. You're hanging with one crew at a time. Simplifies everything.
4. **Group-specific venue notes vs. personal notes?** Group spots have notes. Personal saved venues have notes. They're separate — group notes are shared context ("they have a big patio"), personal notes are personal.
