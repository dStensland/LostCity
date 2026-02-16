# BP-6 Validation Plan: Atlanta Dog Portal

## UX Quality Gates

All must pass before launch.

| # | Gate | Pass Criteria |
|---|------|---------------|
| 1 | Action clarity | User understands what the portal is and what to do in < 10 seconds |
| 2 | Mobile no-overflow | Zero horizontal scroll on any screen (iPhone SE through iPhone 16 Pro Max) |
| 3 | Feed loads with content | At least 10 items visible in Explore feed on first load |
| 4 | Map loads with pins | At least 20 pins visible on map view for Atlanta center |
| 5 | Content type clarity | User can distinguish events from places in the feed without reading |
| 6 | No-photo cards work | Cards without photos look intentional, not broken |
| 7 | Save flow works | User can save an event/place and find it in Saved tab |
| 8 | Detail views load | Tapping any card opens a detail view with correct data |
| 9 | Source attribution | Every item shows its source (e.g., "via Atlanta Humane Society") |
| 10 | Location prompt | App asks for location once, uses it for proximity sorting |
| 11 | Search works | Searching "dog park" returns dog parks |
| 12 | Category filters work | Filtering by "Parks" shows only parks |
| 13 | Curated lists load | At least 3 curated lists accessible and populated |
| 14 | Tag submission works | User can tag a venue as dog-friendly |
| 15 | Design review passed | `/design` audit approved visual consistency |
| 16 | Owner gut-check | Portal owner says "this feels like my product" |

## Device / Browser QA Matrix

### Mobile (primary)

| Device | Browser | Priority |
|--------|---------|----------|
| iPhone 14/15/16 | Safari | P1 |
| iPhone SE (small screen) | Safari | P1 |
| iPhone 16 Pro Max (large) | Safari | P2 |
| Samsung Galaxy S24 | Chrome | P2 |
| Pixel 8 | Chrome | P3 |

### Desktop (secondary)

| Device | Browser | Priority |
|--------|---------|----------|
| MacBook | Chrome | P1 |
| MacBook | Safari | P2 |
| Windows | Chrome | P2 |
| Windows | Firefox | P3 |

### Specific Checks

- [ ] Bottom nav doesn't overlap with iOS home indicator
- [ ] Bottom nav doesn't overlap with Android nav bar
- [ ] Map gestures work (pinch zoom, pan) without conflicting with page scroll
- [ ] Bottom sheet (map view) drags smoothly on iOS and Android
- [ ] Baloo 2 font loads correctly (no FOUT/FOIT flash)
- [ ] Color-coded cards meet WCAG AA contrast on warm cream background
- [ ] Bouncy hover animations don't trigger on mobile (touch devices)

## Analytics Instrumentation Checklist

### Page-Level Events

| Event | Properties | Purpose |
|-------|-----------|---------|
| `portal_view` | `portal_slug`, `view_mode` | Track which view users prefer |
| `feed_scroll_depth` | `portal_slug`, `section_reached` | How far users scroll |
| `map_open` | `portal_slug` | Map tab usage |
| `saved_open` | `portal_slug` | Saved tab usage |

### Interaction Events

| Event | Properties | Purpose |
|-------|-----------|---------|
| `card_tap` | `item_type`, `item_id`, `section` | What users tap |
| `event_save` | `event_id`, `source` | Save engagement |
| `venue_save` | `venue_id`, `source` | Save engagement |
| `event_share` | `event_id`, `method` | Share engagement |
| `directions_tap` | `venue_id` | Intent to visit |
| `list_open` | `list_slug` | Curated list engagement |
| `tag_submit` | `venue_id`, `tag` | Crowdsource participation |
| `search_submit` | `query`, `result_count` | Search usage |
| `filter_apply` | `filter_type`, `value` | Filter usage |

### Funnel: Discovery → Action

```
portal_view → card_tap → (detail_view) → save OR directions_tap OR share
```

Track conversion at each step. Target: 30% of portal views → card tap, 10% → save or directions.

## Demo Script

### Scenario 1: "Weekend Discovery" (Primary JTBD)

```
1. Open /atl-dogs on iPhone
2. See hero: "SNIFF. PLAY. REPEAT."
3. See "This Weekend" carousel with 3+ events
4. Swipe through events
5. Tap "Adoption Event at Piedmont"
6. See event detail with date, location, description
7. Tap "Save"
8. Go back to feed
9. Scroll to "Dog Parks Near You"
10. See parks sorted by distance
11. Tap nearest park
12. Tap "Directions" → Opens Maps app
```

Duration: ~60 seconds. Tests: feed, cards, detail view, save, map link.

### Scenario 2: "Map Explorer"

```
1. Open /atl-dogs on iPhone
2. Tap "Map" tab
3. See full-screen map with 20+ pins
4. See different colored pins (parks=yellow, events=coral, services=teal)
5. Tap a park pin
6. See bottom sheet with park details
7. Swipe bottom sheet up for full details
8. Tap "Directions"
```

Duration: ~30 seconds. Tests: map, pins, bottom sheet, directions.

### Scenario 3: "New Dog Parent"

```
1. Open /atl-dogs on desktop
2. Scroll to "Curated Lists"
3. Click "New Dog Parent Starter Pack"
4. See list with vets, training, parks, supply shops
5. Save 3 items
6. Go to Saved tab
7. See all 3 saved items
```

Duration: ~45 seconds. Tests: lists, saving, saved view.

### Scenario 4: "Community Contributor"

```
1. Open /atl-dogs on iPhone
2. Tap a restaurant venue (from any section)
3. See venue detail
4. Tap "Tag as dog-friendly"
5. See confirmation
6. Venue now shows "dog-friendly" badge
```

Duration: ~20 seconds. Tests: tagging, community contribution.

## Success Criteria (from BP-1)

### Launch (Week 1)
- [ ] 25+ real events in feed
- [ ] 100+ places (parks, restaurants, services)
- [ ] 3+ curated lists populated
- [ ] Mobile < 2s load time
- [ ] Zero horizontal overflow

### Month 1
- [ ] 500+ unique visitors
- [ ] 15%+ return visitor rate
- [ ] 1+ inbound sponsor inquiry
- [ ] 5+ social shares tracked

### Month 3
- [ ] 2,000+ monthly uniques
- [ ] 2+ paying sponsors
- [ ] 10+ community-submitted tags
- [ ] 1+ local media mention
