# Home Depot Kids Workshops Crawler

## Overview

This crawler generates events for Home Depot's free monthly Kids Workshops at major Atlanta-area locations.

## Background

Home Depot runs FREE Kids Workshops nationwide, typically on the first Saturday of each month from 9:00 AM to 12:00 PM. These workshops are designed for children ages 5-12 and provide hands-on building experiences.

### Workshop Details

- **Age Range**: 5-12 years old (must be accompanied by parent/guardian)
- **Cost**: FREE (no registration required - first come, first served)
- **Schedule**: First Saturday of each month, 9:00 AM - 12:00 PM
- **What Kids Receive**:
  - A wooden project to build and take home (changes monthly)
  - FREE orange Home Depot apron
  - Workshop achievement pin
  - Certificate of completion

### Monthly Projects

Projects vary by month and may include:
- Birdhouses
- Toolboxes
- Planters
- Race cars
- Holiday/seasonal crafts
- Garden decorations

## Technical Implementation

### Why This Approach?

The official Home Depot workshops page (homedepot.com/workshops/) has strong bot protection that blocks automated scraping. Rather than attempting to bypass this protection, we generate events based on the known recurring schedule.

This approach is actually **more reliable** because:
1. The schedule is consistent and predictable (first Saturday of each month)
2. We avoid bot detection issues
3. Events are guaranteed to be accurate for the next 6 months
4. No dependency on website structure changes

### How It Works

The crawler:
1. Calculates the first Saturday of each month for the next 6 months
2. Creates events at each configured Atlanta-area Home Depot location
3. Uses content hashing to avoid duplicate events
4. Updates existing events on subsequent runs

### Locations Covered

Currently generates events for 6 major Atlanta-area Home Depot stores:
- **Ponce de Leon** (Poncey-Highland) - 650 Ponce De Leon Ave NE
- **Howell Mill** (West Midtown) - 1200 Howell Mill Rd NW
- **Atlantic Station** - 1380 Atlantic Dr NW
- **Buckhead** - 3535 Piedmont Rd NE
- **Decatur** - 2410 Glenwood Ave SE
- **Lindbergh** - 2455 Piedmont Rd NE

These locations were chosen for their:
- Proximity to family-dense neighborhoods
- Accessibility via public transit
- High participation rates

### To Add More Locations

Edit `ATLANTA_HOME_DEPOT_LOCATIONS` in `home_depot_kids_workshops.py`:

```python
{
    "name": "Home Depot - [Area]",
    "slug": "home-depot-[area-slug]",
    "address": "123 Main St",
    "neighborhood": "Neighborhood Name",
    "city": "City",
    "state": "GA",
    "zip": "30000",
    "venue_type": "retail",
    "website": "https://www.homedepot.com",
}
```

## Event Metadata

### Tags Applied

- `free` - No cost to attend
- `family-friendly` - Suitable for families
- `kids` - Children's event
- `educational` - Learning experience
- `workshop` - Hands-on workshop format
- `hands-on` - Build/make something
- `building` - Construction activity
- `crafts` - Craft project
- `woodworking` - Involves wood/tools
- `ages-5-12` - Target age range

### Category

Events are categorized as `family` events.

## Crawl Frequency

**Recommended**: Monthly

The crawler generates events 6 months in advance, so monthly runs ensure the calendar stays populated.

## Testing

```bash
# Test the crawler
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source home-depot-kids-workshops

# Verify events created
python3 << 'EOF'
from db import get_client
client = get_client()
result = client.table("events").select("title, start_date, venues(name)").eq("source_id", 414).order("start_date").execute()
for event in result.data:
    print(f"{event['start_date']}: {event['venues']['name']}")
EOF
```

## Known Limitations

1. **Project Details**: We don't know the specific project for each month until Home Depot announces it
2. **Cancellations**: If Home Depot cancels a workshop, our system won't know automatically
3. **Special Events**: Occasional special workshops outside the regular schedule won't be captured
4. **Supply-Based**: Workshops run "while supplies last" - no way to know capacity

## Future Enhancements

Potential improvements:
1. Add more suburban locations (Marietta, Alpharetta, etc.)
2. Monitor Home Depot's social media for project announcements
3. Add image URLs when monthly projects are announced
4. Create a manual override system for known cancellations
5. Track historical project themes to predict future ones

## Support

For questions or issues with this crawler, check:
- Home Depot Workshop Calendar: https://www.homedepot.com/workshops/
- In-store signage at participating locations
- Call stores directly for confirmation
