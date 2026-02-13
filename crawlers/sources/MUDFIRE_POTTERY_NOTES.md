# MudFire Pottery Studio Crawler

## Overview

MudFire is a pottery studio in Decatur, GA offering pottery classes for all skill levels including date night experiences, beginner workshops, and advanced techniques.

## Technical Implementation

### Scheduling System
- **Platform**: Acuity Scheduling (Square Appointments)
- **URL**: https://app.squarespacescheduling.com/schedule.php?owner=25826043
- **Data Source**: Embedded JavaScript `BUSINESS` object in page HTML

### Approach
1. Load the Acuity Scheduling page with Playwright
2. Extract and parse the `BUSINESS` JavaScript object containing all class metadata
3. Generate upcoming class occurrences (4 weeks of Saturdays) for each active class type
4. Create series-linked events for recurring classes

### Why Not Scrape Specific Times?
Acuity Scheduling requires user interaction to see specific available time slots:
1. Select a class type
2. Click through calendar dates
3. View available times for that date

Instead, we extract the class type catalog and generate reasonable recurring schedules based on typical pottery class patterns (Saturday classes).

## Class Types Discovered

### Beginner Level (101 Classes)
- **Wheel 101** - Beginner wheel throwing ($65, 2 hours)
- **Handbuilding 101** - Vases, planters, mugs ($65, 2 hours)
- **Mugs 101** - Handbuilt mug class ($65, 2 hours)
- **Valentine's Wheel Class** - Seasonal beginner wheel class ($65, 2 hours)
- **Valentine's Handbuilding** - Seasonal heart box class ($65, 2 hours)

### Intermediate/Advanced Classes
- **Wheel 102** - Custom projects ($65, 2 hours)
- **Wheel 103: Trimming** - Two-part trimming workshop ($95, 2-part)
- **Wheel 103: Mugs** - Two-part mug making ($95, 2-part)
- **Pet Portraits with Molly** - Two-part portrait class ($95, 2-part)

## Data Quality

- **Venue**: Complete with address, coordinates, neighborhood
- **Events**: Full class descriptions from Acuity metadata
- **Pricing**: Accurate per-person pricing from platform
- **Series**: All classes linked as recurring series
- **Tags**: Properly categorized (pottery, ceramics, hands-on, beginner-friendly, etc.)

## Future Improvements

1. **Click Through Calendar**: Use Playwright to click class types and extract actual scheduled times
2. **Image Extraction**: Parse class thumbnail URLs from Acuity data
3. **Class Duration**: Use the `duration` field (in minutes) to calculate end times
4. **Class Size**: Could surface the `classSize` limit in event metadata
5. **Multi-part Classes**: Better handling of 2-part classes (currently generates weekly occurrences)

## Maintenance Notes

- Classes are marked `active: true/false` in the JSON - we filter for active only
- Seasonal classes (Valentine's) may need to be filtered by date relevance
- Pricing is embedded as strings like "65.00" - handle parsing gracefully
- Class descriptions contain HTML - may need sanitization (currently handled by db layer)
