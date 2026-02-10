# Community Needs Tags

Phase M implementation: Community-verified accessibility, dietary, and family needs tags across all entity types.

## Overview

Community needs tags are the most defensible data in the system (PRD 004 Section 8.1). Unlike self-reported business data, these tags are verified by multiple community members, creating trust badges like "Wheelchair accessible (47 people confirm)".

## Components

### TagVoteChip

Individual tag with voting functionality. Shows tag label, confirmation count (trust badge when >= 3), and allows users to confirm/remove their vote.

```tsx
import { TagVoteChip } from "@/components/TagVoteChip";

<TagVoteChip
  entityType="venue"
  entityId={123}
  tagSlug="wheelchair-accessible"
  tagLabel="Wheelchair Accessible"
  confirmCount={47}
  userVote="confirm"
  onVoteChange={(newVote) => console.log("Vote changed:", newVote)}
/>
```

### NeedsTagList

Full needs tag section for an entity. Automatically fetches and groups accessibility, dietary, and family tags.

```tsx
import { NeedsTagList } from "@/components/NeedsTagList";

<NeedsTagList
  entityType="venue"
  entityId={123}
  title="Accessibility & Needs"
  tagGroups={["accessibility", "dietary", "family"]}
/>
```

Only renders if tags exist (fails silently if no data).

## API Route

### POST /api/tags/vote

Cast or update a vote on a tag.

**Request:**
```json
{
  "entity_type": "venue",
  "entity_id": 123,
  "tag_slug": "wheelchair-accessible",
  "vote": "confirm"
}
```

**Response:**
```json
{
  "success": true,
  "vote": {
    "id": "...",
    "entity_type": "venue",
    "entity_id": 123,
    "tag_definition_id": "...",
    "user_id": "...",
    "vote": "confirm"
  }
}
```

### DELETE /api/tags/vote

Remove a vote.

**Query params:**
- `entity_type` (venue/event/series/festival)
- `entity_id` (number)
- `tag_slug` (string)

### GET /api/tags/vote

Get all tags and vote counts for an entity.

**Query params:**
- `entity_type` (venue/event/series/festival)
- `entity_id` (number)

**Response:**
```json
{
  "tags": [
    {
      "tag_id": "...",
      "tag_slug": "wheelchair-accessible",
      "tag_label": "Wheelchair Accessible",
      "tag_group": "accessibility",
      "confirm_count": 47,
      "deny_count": 2,
      "score": 45,
      "user_vote": "confirm"
    }
  ]
}
```

## Database

### Migration 173

Creates:
- `entity_tag_votes` table (unified voting across all entity types)
- `tag_definitions` table (renamed from venue_tag_definitions, adds entity_types array)
- `entity_tag_summary` materialized view (aggregated vote counts)
- Seed data for accessibility, dietary, and family tags

### Tag Categories

**Accessibility** (applies to: venue, event, series, festival)
- wheelchair-accessible
- elevator-access
- hearing-loop
- asl-interpreted
- sensory-friendly
- service-animals-welcome
- accessible-parking
- accessible-restroom

**Dietary** (applies to: venue, festival)
- gluten-free-options
- vegan-options
- vegetarian-options
- halal
- kosher
- nut-free
- dairy-free
- allergy-friendly-menu

**Family** (applies to: venue, event, festival)
- stroller-friendly
- kid-friendly
- changing-table
- nursing-room
- play-area

## Integration Example

Add to venue detail page:

```tsx
import { NeedsTagList } from "@/components/NeedsTagList";

// In your venue detail page component
<div className="space-y-6">
  {/* Existing venue info */}

  {/* Community needs tags */}
  <NeedsTagList
    entityType="venue"
    entityId={venue.id}
  />
</div>
```

The component will only render if there are confirmed tags, so it won't show empty state.

## Rate Limiting

- 20 votes per hour per user (via withAuth middleware)
- Uses same rate limit bucket as other authenticated writes

## Future Enhancements

- Post-RSVP tag prompts ("Is this good for date night?")
- Needs-based search filtering (boost confirmed matches, warn on conflicts)
- Trust tiers (higher-trust users get auto-approved suggestions)
- Batch materialized view refresh (every 5 minutes via cron)
