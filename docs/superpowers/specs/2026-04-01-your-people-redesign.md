# Your People — Page Redesign

## Summary

Redesign the social page from a passive activity feed into a coordination hub. "Your People" becomes a top-level nav destination with three jobs in priority order: coordination ("I'm in"), social proof discovery, and friend growth. The Community view (`?view=community`) is killed; Curations and Groups are rehomed.

## Design Compositions

Pencil file: `docs/design-system.pen`
- Mobile (375px): node `Uz0m0` — "Your People — Mobile"
- Desktop (1440px): node `w2Zfb` — "Your People — Desktop"

## Route & Navigation

### New route
- **`/your-people`** — top-level destination, own nav entry
- Mobile: tab bar icon (lucide `users`, coral when active)
- Desktop: header nav tab "YOUR PEOPLE" (coral when active)

### Redirects
- `/people` → `/your-people` (301)
- `/friends` → `/your-people` (301)
- `/atl?view=community` → `/your-people` (301)
- `/atl?view=community&tab=people` → `/your-people` (301)

### Killed routes
- Community view tabs (Friends / Curations / Groups) are decomposed:
  - **Curations** → moves to Find/Explore as a section
  - **Groups** → `/groups` gets its own route; user's groups accessible from profile or a "Your Groups" link on the Your People page
  - The `CommunityView.tsx` component is deprecated

## Page Structure

Five sections, vertically stacked. Sections that have no data are hidden, not shown empty.

### 1. Friend Requests (conditional)

Shown only when pending requests exist. Same accept/decline UI as current, compact inline banner format.

- **Data source:** existing `/api/friend-requests?type=received`
- **Behavior:** Accept = create friendship + notification. Decline = dismiss.
- No changes to the current friend request logic.

### 2. This Week (Crew Board)

The primary section. Shows events friends are **going to** (RSVP status: going), grouped by day of week.

- **Data source:** extend existing `/api/dashboard/crew-this-week`
  - Currently returns friends + their events grouped by user
  - Change: group by **day**, not by friend. Return events with attending friend list.
  - Only include events where friends have RSVP status `going` (not saves — saves go in section 3)
  - Multiple friends at same event = single card with stacked avatars
- **Card anatomy:**
  - Event image thumbnail (48px mobile, 56px desktop)
  - Event title
  - Friend attribution: avatar(s) + "[Name] is going" or "[Name] + N going"
  - Time/venue metadata (mono, muted)
  - "I'm in" button (right-aligned)
- **"I'm in" action:**
  - Tap → RSVP (status: going) via existing `/api/rsvp`
  - Tap → push notification to all friends attending that event: "[Name] is joining you at [Event]!"
  - Button transitions: `I'm in` (coral ghost) → `Going` (green solid with checkmark)
  - Tap again to undo (remove RSVP, no notification on undo)
  - If user already saved the event, "I'm in" upgrades save to RSVP
- **Push notification throttling:** max 1 notification per event per user per 24h window, regardless of how many friends tap "I'm in"
- **Empty state:** "Nobody's got plans yet." + "Browse events →" CTA linking to Find
- **When empty AND user has < 3 friends:** reorder page to show section 5 (Find Friends) first

### 3. On Your Friends' Radar (Discovery Carousel)

Horizontal scroll of event cards with friend signal. Shows events friends have RSVP'd to OR saved.

- **Data source:** new API endpoint `/api/your-people/friend-signal-events`
  - Query: events in next 14 days where at least 1 friend has RSVP'd or saved
  - Return: event data + friend count + signal type (going vs interested)
  - Sort by friend count descending, then by event date
  - Exclude events already shown in section 2 (This Week crew board)
- **Card anatomy (carousel card, 160px mobile / 220px desktop):**
  - Event image (full width, 90px mobile / 120px desktop)
  - Event title
  - Friend avatar stack + count label: "3 friends going" (coral) or "2 friends interested" (gold)
- **Empty state:** hide section entirely

### 4. Lately (Collapsed Activity Feed)

The existing chronological activity feed, demoted to an expandable accordion.

- **Data source:** existing `/api/activities` (infinite scroll via `useInfiniteActivities`)
- **Default state:** collapsed, showing section header + count badge
- **Expanded state:** same FriendsActivity component as current, rendered inline
- **Count badge:** number of new activities since last visit (stored in localStorage)
- **Empty state:** hide section entirely

### 5. Find Friends

Tools for growing the friend network. Lowest priority, at the bottom — unless the user has < 3 friends, in which case it promotes to top.

- **Three action cards:**
  - Search (magenta accent): links to inline search or `/people` search
  - Import Contacts (vibe accent): links to `/find-friends?tab=import`
  - Share Invite (cyan accent): copies invite link to clipboard
- **Suggested friends:** horizontal scroll of suggestion cards (reuses existing `FriendSuggestions` component)
- **Data source:** existing `/api/users/search` and `useFriendSuggestions` hook

## Adaptive Layout

### Zero-friend state
When user has 0-2 friends, the page reorders:
1. Friend Requests (if any)
2. **Find Friends** (promoted to top)
3. This Week (will be empty but shows the empty state CTA)
4. On Your Friends' Radar (hidden)
5. Lately (hidden)

### Mobile (375px)
- Single column, full-width sections
- Crew board in container with gradient accent bar (coral → magenta → transparent)
- "I'm in" buttons: min-height 44px for touch targets
- Tab bar: People tab active (coral icon + label)
- Carousel sections: horizontal scroll with overflow hidden

### Desktop (1440px+)
- Centered content column (720px) — consistent with profile and settings pages
- Crew board in bordered container with gradient accent bar
- Trending carousel: 3 cards visible (220px each)
- Find Friends: horizontal row of descriptive action cards with icon + title + subtitle

## Visual Design

### Section headers
All sections use the existing `FeedSectionHeader` pattern:
- Mono uppercase, 10-11px, bold, accent-colored
- 3px accent dot left of label
- Section-specific accent colors:
  - This Week: `--coral`
  - On Your Friends' Radar: `--neon-cyan`
  - Lately: `--vibe`
  - Find Friends: `--neon-magenta`

### "I'm in" button states
| State | Fill | Stroke | Text | Icon |
|-------|------|--------|------|------|
| Default | coral 12% | coral 30% | "I'm in" coral | none |
| Going | neon-green 12% | neon-green 30% | "Going" green | checkmark |
| Saved (pre-existing) | gold 12% | gold 30% | "Interested" gold | star |

### Container treatment
Crew Board section gets a container card:
- `cornerRadius: 12` (card radius)
- `stroke: 1px twilight`
- 2px gradient accent bar at top (coral → magenta → transparent)
- `padding: 16px` (mobile), `20px` (desktop)

## Components

### New
- **`YourPeoplePage`** — page component at `/your-people`
- **`CrewBoard`** — day-grouped event list with "I'm in" buttons (extends CrewThisWeekCard concept)
- **`CrewEventCard`** — individual event row within crew board
- **`ImInButton`** — RSVP + notification button with three states
- **`FriendRadarCarousel`** — horizontal event carousel with friend signal

### Reused
- `PendingRequests` — unchanged
- `FriendSuggestions` — unchanged
- `FriendSearch` — unchanged (inline in Find Friends section)
- `FriendsActivity` — unchanged (rendered inside collapsed accordion)
- `FeedSectionHeader` — section header component

### Deprecated
- `CommunityView` — replaced entirely
- `DashboardActivity` — replaced by YourPeoplePage
- `CrewThisWeekCard` — functionality absorbed into CrewBoard

## API Changes

### Modified
- **`GET /api/dashboard/crew-this-week`** — restructure response to group by day instead of by user. Add event image URLs. Only return RSVP'd events (not saves).

### New
- **`GET /api/your-people/friend-signal-events`** — events with friend signal (RSVP or save) in next 14 days, sorted by friend count
- **`POST /api/your-people/im-in`** — RSVP + trigger push notification to attending friends. Accepts `{ event_id, friend_ids }`. Respects throttle: 1 notification per event per recipient per 24h.

### Push notifications
- New notification type: `friend_joining` — "[Name] is joining you at [Event]!"
- Throttle: per-event, per-recipient, 24h window
- Requires: push notification infrastructure confirmed working (existing `notifications` table + delivery mechanism)

## Migration Plan

1. Build new page and components behind the `/your-people` route
2. Add nav entry (tab bar + header) pointing to new route
3. Set up redirects from old routes
4. Remove Community tab from nav
5. Rehome Curations into Find/Explore
6. Ensure Groups has its own route (`/groups`) and is discoverable from profile
7. Deprecate `CommunityView`, `DashboardActivity` components

## Open Questions

1. **Desktop 2-column layout** — Current spec uses centered single column (720px) matching profile pages. Reviewer flagged this as underusing desktop space. Consider: crew board + sidebar with Find Friends. Decision deferred to implementation.
2. **Groups nav home** — After Community view dies, where do users find their groups? Options: section on Your People, link in profile, or dedicated `/groups` route. Needs decision before Community is removed.
3. **Curations placement in Find** — Curations need an explicit section in the Find/Explore view before Community tabs are killed. Coordinate with Explore Home work.
