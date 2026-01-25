---
description: Run QA tests on the LostCity web app using browser automation
---

# QA Testing

$ARGUMENTS

## Usage

- `/qa site` - Full site check across all major features
- `/qa portal <slug>` - Deep test a specific portal (e.g., `/qa portal atlanta`)
- `/qa new` - Test the latest features based on recent git changes
- `/qa` - Quick health check of the homepage and core navigation

## What Gets Tested

**Site Check:**
- Homepage rendering
- Portal pages
- Feed tabs (Curated, For You, Activity)
- Event cards and detail pages
- Search and filters
- Map view
- Mobile responsiveness
- Console errors

**Portal Check:**
- Portal branding and customization
- All feed sections (Tonight's Picks, Trending, etc.)
- Category filtering
- Neighborhood filtering
- Event and venue pages

**New Features:**
- Identifies recent component changes from git
- Navigates to affected pages
- Verifies new UI elements render
- Checks for regressions

## Environment

Default: http://localhost:3000 (local dev server must be running)

For production: `/qa site prod`

## Instructions

1. Parse the arguments to determine test mode
2. Use browser automation tools to navigate and test
3. Take screenshots of key states
4. Check console for JavaScript errors
5. Report findings with pass/fail status
6. Provide actionable recommendations for any failures
