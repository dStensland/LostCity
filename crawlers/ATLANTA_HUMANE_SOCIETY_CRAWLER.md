# Atlanta Humane Society Crawler

## Overview
Crawler for Atlanta Humane Society events using the Eventbrite API (Organizer ID: 12003007997).

## Implementation Details

### Files Created
- `/Users/coach/Projects/LostCity/crawlers/sources/atlanta_humane_society.py` - Main crawler
- `/Users/coach/Projects/LostCity/crawlers/add_atlanta_humane_source.py` - Source registration script

### Source Registration
- **Source ID**: 1041
- **Slug**: atlanta-humane-society
- **Name**: Atlanta Humane Society
- **URL**: https://atlantahumane.org
- **Type**: venue
- **Status**: Active

### Venue Data
- **Venue ID**: 1797
- **Name**: Atlanta Humane Society
- **Address**: 981 Howell Mill Rd NW, West Midtown, Atlanta GA 30318
- **Coordinates**: 33.7867, -84.4109
- **Type**: animal_shelter
- **Vibes**: adoption, low-cost-vet, vaccination

## Features

### Event Categorization
The crawler intelligently categorizes events based on title and description:

1. **Adoption Events** → family/adoption-event
   - Keywords: adoption, adopt, meet & greet, meet the pets
   - Tags: animals, adoption, atlanta-humane-society, family-friendly, pets

2. **Vaccine/Spay/Neuter Clinics** → family/pet-clinic
   - Keywords: vaccine, vaccination, clinic, spay, neuter, wellness, vet
   - Tags: animals, adoption, atlanta-humane-society, pets, family-friendly

3. **Volunteer Events** → community/volunteer
   - Keywords: volunteer, orientation, training, walk dogs
   - Tags: animals, adoption, atlanta-humane-society, volunteer

4. **Fundraising Events** → community/fundraiser
   - Keywords: fundraiser, gala, benefit, donation, auction
   - Tags: animals, adoption, atlanta-humane-society, fundraiser, charity

5. **Educational Workshops** → learning/workshop
   - Keywords: workshop, class, seminar, learn, education
   - Tags: animals, adoption, atlanta-humane-society, education, family-friendly

6. **Community Outreach** → community/community-event
   - Keywords: outreach, community, awareness, celebration
   - Tags: animals, adoption, atlanta-humane-society, community, family-friendly

### API Integration
- Uses Eventbrite API v3 (`/v3/organizers/{id}/events/`)
- Fetches live events with venue and category expansion
- Handles pagination automatically
- Includes rate limiting protection (30s backoff on 429 responses)
- 0.5s delay between page requests

### Data Quality
- All events include start_date, start_time, end_time
- Descriptions are extracted from Eventbrite
- Images are included from event logos
- Price information: defaults to free (most AHS events are free)
- Deduplication via content hash

## Test Results

### Initial Crawl (2026-02-14)
```
Events found: 6
Events new: 4-6 (some socket errors on first run)
Events updated: 0

Sample events:
- 2026-02-21: Game Night (family/None) - family-friendly, free
- 2026-03-07: Dogs for Better Lives Information Session (community/None) - volunteer, free
- 2026-05-09: Dogs for Better Lives Information Session (community/None) - volunteer, free
- 2026-07-11: Dogs for Better Lives Information Session (community/None) - volunteer, free
- 2026-09-12: Dogs for Better Lives Information Session (community/None) - volunteer, free
- 2026-11-07: Dogs for Better Lives Information Session (community/None) - volunteer, free
```

### Duplicate Detection Test
```
Events found: 6
Events new: 0
Events updated: 6
✓ Deduplication working correctly
```

## Usage

### Run the crawler
```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source atlanta-humane-society
```

### Register the source (already done)
```bash
python3 add_atlanta_humane_source.py
```

## Notes

- Most Atlanta Humane Society events are free
- Events are typically family-friendly and pet-related
- The Eventbrite organizer page is the canonical source
- Auto-tagging via `tag_inference.py` adds contextual tags (free, volunteer, etc.)
- Venue vibes (adoption, low-cost-vet, vaccination) are applied to all events
