# MASS Collective Crawler

## Overview
MASS Collective is Atlanta's premier community makerspace offering hands-on workshops in welding, woodworking, machining, leatherwork, and other crafts.

## Implementation
- **Method**: Eventbrite API (organizer ID: 4567583831)
- **File**: `sources/mass_collective.py`
- **Source ID**: 369
- **Status**: Active, Daily crawl

## Venue Data
- **Name**: MASS Collective
- **Address**: 364 Nelson St SW, Atlanta, GA 30313
- **Neighborhood**: West End
- **Type**: studio/makerspace
- **Coordinates**: 33.7450, -84.4020
- **Website**: https://www.masscollective.org

## Event Categories
- **Category**: learning
- **Subcategory**: workshop
- **Tags**: Automatically inferred (makerspace, hands-on, workshop, welding, metalwork, etc.)

## Current Events (as of 2026-02-12)
- ~3 upcoming events (primarily MIG welding intro classes)
- 815 past events
- Price range: $95-$165

## Features
- Uses Eventbrite API v3 for reliable data
- Extracts pricing from ticket data
- Auto-tags based on title/description keywords
- Filters out events >270 days in future (prevents placeholder events)
- Content hash deduplication

## Tag Logic
Events are automatically tagged based on keywords in title/description:
- Welding/MIG/TIG → welding, metalwork
- Woodworking → woodworking
- Machining/lathe/mill → machining, metalwork
- Leather → leatherwork, crafts
- Blacksmithing → blacksmithing, metalwork
- Intro/beginner → beginner-friendly
- Certification → certification

## Testing
```bash
python3 main.py --source mass-collective
```

## Notes
- One event ("Machining: Metal Lathe & Mill - AVAILABLE ON REQUEST") is rejected for having a date >270 days in future (2027-01-02)
- This is expected behavior - likely a placeholder event for on-request bookings
- Most classes are MIG welding introductory courses
