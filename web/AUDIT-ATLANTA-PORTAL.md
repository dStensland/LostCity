# Atlanta Portal — Polish Audit

**Date:** Feb 20, 2026
**Scope:** Every user-facing surface on the Atlanta city portal
**Audience:** Design, content, and product team

---

## How to use this document

Issues are organized by surface area, then ranked:
- **P0** — Broken or confusing. Fix before showing to anyone.
- **P1** — Noticeable polish gap. Fix before launch push.
- **P2** — Nice-to-have refinement. Backlog.

Each item has a short code (e.g. `FEED-03`) for easy reference in standups.

---

## 1. FEED — Curated Homepage

### Content & Copy

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| FEED-01 | P1 | "What are you in the mood for?" (BrowseByActivity header) feels passive for a discovery product | Try "Find something to do" or "Pick your vibe" — more action-oriented |
| FEED-02 | P1 | "Most popular this week" (TrendingNow subtitle) is generic | "What Atlanta's buzzing about" or "Heating up this week" — more local flavor |
| FEED-03 | P2 | "Upcoming Festivals and Conventions" (MomentsSection) reads like a database label | "Coming up" or "On the horizon" — warmer |
| FEED-04 | P1 | The Explore tab outro says "Take this energy somewhere specific" — unclear what "this energy" refers to after scrolling editorial tracks | Tie the CTA to the track the user just viewed, or simplify to "Ready to go?" |
| FEED-05 | P2 | "City Field Guide" (curated index header) — is this the brand name for the feed? Users may not understand what this means | Consider removing the label or using "Jump to..." |
| FEED-06 | P1 | Index labels mix tone: "Help People Out" and "Free Stuff" are casual, "Highlights" and "Festivals" are formal | Pick one voice. Recommend casual throughout: "What's Free", "Give Back", "Go Out Tonight" |
| FEED-07 | P2 | For You sign-up prompt says "Sign in to see events matched to your interests" — "sign in" implies they already have an account | "Create an account to get personalized picks" for new users, "Sign in" for returning |
| FEED-08 | P1 | Afternoon greeting ("This afternoon") ignores event/spot counts in the CTA. Morning/evening/night all use them. | Fixed in code — verify it's deployed |

### Design & Layout

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| FEED-09 | P1 | Section spacing varies: some sections use `py-6`, others `gap-3`, others have explicit borders. No consistent rhythm. | Standardize: every major section gets `pt-6 pb-4` with a `border-t border-[var(--twilight)]/30` divider. Drop borders between tightly coupled sections (e.g. hero + thumbnails). |
| FEED-10 | P1 | HighlightsPicks auto-rotates hero every 6.5s — too fast to read a title + decide to tap. Users who read slowly lose it. | 10s minimum, or pause on hover/touch. Better: no auto-rotate, let user swipe. |
| FEED-11 | P2 | BrowseByActivity expanded panel closes if you tap another category — losing context. No animation on open/close. | Add a slide transition (150ms). Consider keeping the panel open and swapping content instead of closing. |
| FEED-12 | P2 | TrendingNow horizontal scroll has no scroll indicators on desktop. Users may not know it scrolls. | Add fade-out gradient on the right edge, or left/right arrow buttons on hover. |
| FEED-13 | P1 | HolidayHero cards have dramatically different visual treatments (animated GIFs, SVGs, PNGs, various glow effects). Some look premium, others look clipped-art. | Establish a single visual template for holiday heroes. Animated icons should all be the same style/fidelity. |
| FEED-14 | P2 | The curated index (desktop) uses a collapsible panel with progress dots. The FeedView index (below) uses a different collapsible panel with no dots. Two different index UIs on the same page. | Unify into one index pattern. |

### Edge Cases

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| FEED-15 | P1 | If HappeningNowCTA returns 0 events + 0 spots, it renders nothing — the first thing users see is HolidayHero or Highlights. No indication that "happening now" exists as a feature. | Show a muted CTA even when count is 0: "Nothing live right now — check back tonight" with a link to happening-now. |
| FEED-16 | P1 | TrendingNow returns null when no trending events. No section rendered, no explanation. The feed just... skips it. | Either always show the section with an empty state ("Check back later for trending picks") or don't have a Trending section in the index when empty. |
| FEED-17 | P2 | HighlightsPicks empty state is "No highlights for this period yet" — sounds like a system message, not a human. | "Nothing picked for today yet. Check this week's highlights." |

---

## 2. HAPPENING NOW

### Content & Copy

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| HN-01 | P0 | CTA on homepage calls `/api/portals/{slug}/happening-now` (time-based liveness). Page calls `/api/around-me` (DB `is_live` column). Different definitions = different counts. User taps "12 events live" and sees a different number. | Unify liveness. Both should use the same logic. |
| HN-02 | P1 | Summary says "X events live, Y spots open in Atlanta" but the list may only show a subset (limit=200 applied after counting). | Either cap the counts to match displayed items, or add "showing nearest 200" qualifier. |
| HN-03 | P1 | Empty state says "Check back later or browse upcoming events" — but if the user filtered by category and got 0, the issue is the filter, not the time of day. | When filtered: "No {category} spots or events open right now. Try a different filter." |

### Design & Layout

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| HN-04 | P1 | The flat distance-sorted list has no visual grouping at all. 50+ cards in a row with no landmarks. | Add lightweight neighborhood subheaders inline: a small muted label when the neighborhood changes as you scroll (e.g. "Midtown" appears above the first Midtown card). Not a cluster — just a label. |
| HN-05 | P2 | Neighborhood dropdown has 35+ items with no grouping. On mobile native `<select>`, this is a long scroll. | Only show neighborhoods that currently have open items, or group by tier (Popular / More). |
| HN-06 | P1 | Sticky filter bar is two rows (~100px) on mobile. With header that's ~150px of chrome. | Collapse category chips into a single scrollable row alongside the dropdown. One row instead of two. |

---

## 3. NAVIGATION & HEADER

### Content & Copy

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| NAV-01 | P1 | Mobile quick links menu says "Events", "Places", "Map View" but the main nav says "Feed", "Find", "Community". Different vocabulary for overlapping concepts. | Align: quick links should use "Events", "Destinations", "Map" to match FindView tabs. |
| NAV-02 | P2 | "Settings" appears in mobile quick links menu but there's no settings page linked from the main nav on desktop. Inconsistent access. | Add settings to user menu dropdown on desktop, or remove from mobile quick links. |
| NAV-03 | P2 | "powered by Lost City" in footer — should this be visible on the Atlanta portal? It's the flagship. | Hide for Atlanta (it IS Lost City). Show only on white-label partner portals. |

### Design & Layout

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| NAV-04 | P1 | Atlanta header has an inverted skyline backdrop with cyan-magenta gradient overlay. Unique treatment not shared by any other portal. Is this intentional brand identity or a one-off experiment? | If keeping: make sure it looks intentional (consistent opacity, no artifacts at edges). If experimental: consider removing for a cleaner look. |
| NAV-05 | P2 | Header nav has four style options (pills, underline, minimal, tabs) configured per portal. Atlanta uses default tabs with gold-to-coral gradient. Verify this is the intended treatment. | Review in browser — does the gradient feel premium or busy? |
| NAV-06 | P1 | Community tab is hidden when user is not logged in. This means new users don't even know Community exists. | Show the tab but gate the content: "Sign in to see your community." |

---

## 4. FIND / BROWSE VIEW

### Content & Copy

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| FIND-01 | P1 | Type tabs say "Events", "Classes", "Destinations", "Now Playing". The header nav says "Find". The feed says "Explore". Three words for browse-like actions. | Establish vocabulary: "Find" = the browse mode. "Explore" = editorial tracks. Don't mix them. |
| FIND-02 | P1 | "Destinations" is a formal word. The mobile menu says "Places". SpotCard uses "spots" internally. Users hear three terms for the same thing. | Pick one user-facing term. "Places" is most natural. Use "Destinations" only if it's a deliberate brand choice. |
| FIND-03 | P2 | Destination type presets: "Food", "Nightlife", "Music", "Arts", "Coffee", "Games", "Sightseeing". No "Shopping" or "Wellness/Fitness". | Audit against actual venue types in DB. Add missing high-traffic categories. |
| FIND-04 | P2 | Location selector says "All Atlanta" (no "of"). Happening Now says "All of Atlanta". | Pick one. |

### Design & Layout

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| FIND-05 | P1 | Type tabs on mobile show icon-only when inactive, label-only when active. This means tapping "Classes" makes the calendar icon disappear and the word "Classes" appear — disorienting. | Always show icon + label on mobile (smaller font if needed), or always show icon-only with label below. |
| FIND-06 | P2 | Map split-pane on desktop has a fixed drawer (28vw, 360-560px). On a 1920px screen this is fine. On a 1280px laptop, the drawer is only 360px — quite narrow for event cards. | Consider a collapsible drawer or responsive width. |
| FIND-07 | P1 | Density toggle ("Detailed" / "Simple") only appears for events list view. No explanation of what it changes. Users may not notice it. | Add a subtle tooltip or make the visual difference more dramatic so the toggle is worth having. If engagement is low, remove it. |

---

## 5. EVENT CARDS

### Content & Copy

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| EVT-01 | P1 | "LIVE" badge on event cards — does the user know what "live" means? Is it "happening right now" or "livestreaming"? | Consider "NOW" or "Happening" instead. Test with real users. |
| EVT-02 | P2 | "SOON" badge — how soon? No time context. | Show "Starts in 2h" or "Doors at 7" instead of generic "SOON". |
| EVT-03 | P2 | Series badge says the series title but doesn't explain what a "series" is. Users unfamiliar with the concept may ignore it. | Add "Weekly" or "Monthly" prefix: "Weekly: Jazz at Apache" |

### Design & Layout

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| EVT-04 | P1 | Event cards have a LOT of information: category icon, date, time, title, venue, neighborhood, price, free badge, live badge, soon badge, series badge, friends going, RSVP count, recommendation reasons, description preview. This is overwhelming on mobile. | Audit which fields actually influence tap-through. Consider showing only: title, venue, time, price, and one badge. Expand on hover/focus. |
| EVT-05 | P2 | Image parallax on card scroll (`useImageParallax`) — is this adding delight or causing jank on low-end devices? | Test on a mid-range Android. If janky, remove. |
| EVT-06 | P2 | Recommendation reason badges ("Because you like jazz", "Near you") — are these showing for all users or only For You tab? If they show in the main feed without personalization context, they're confusing. | Only show reason badges in the For You tab or when the user has a taste profile. |

---

## 6. SPOT / DESTINATION CARDS

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| SPOT-01 | P1 | SpotCard shows "short_description" (2-line clamp) but many spots may not have one. What shows when it's empty? | Verify: if no description, does the card just have name + type + neighborhood? That's fine but looks sparse. Consider showing top tags as a fallback. |
| SPOT-02 | P2 | Genre pills max 2, tags max 3. These could feel like random metadata to users who don't know what "vibes" or "genres" mean in this context. | Label the section: small "Known for" header above tags. |
| SPOT-03 | P2 | Follower count and recommendation count shown as badges. Social proof is good but could feel like vanity metrics. | Only show if count > 5. Below that it can feel empty ("1 follower"). |

---

## 7. NEIGHBORHOODS PAGE

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| HOOD-01 | P1 | Subtitle: "Explore events and destinations across Atlanta's neighborhoods and metro areas." — "metro areas" is vague. Are OTP neighborhoods included? | If ITP only: "Explore events and places across Atlanta's neighborhoods." If includes OTP: list the outer areas separately. |
| HOOD-02 | P1 | Neighborhoods with 0 venues shown in muted disabled state. These are dead weight — a user tapping one gets nothing. | Hide neighborhoods with 0 venues entirely, or show them in a collapsed "Coming soon" section. |
| HOOD-03 | P2 | Tier labels: "Active Neighborhoods", "Neighborhoods", "Emerging Areas" — "Neighborhoods" as a tier name within a page called "Neighborhoods" is confusing. | "Popular", "More neighborhoods", "Up-and-coming" |
| HOOD-04 | P2 | Cards only show venue count. No event count, no vibe, no thumbnail. Hard to choose between neighborhoods. | Add event count and maybe a 1-line descriptor or top venue type. |

---

## 8. FESTIVALS PAGE

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| FEST-01 | P1 | Subtitle: "{count} festival(s) in Atlanta" — the "(s)" pluralization is a code smell visible to users? | Verify: is it actually showing "(s)" or proper pluralization? If the former, fix. |
| FEST-02 | P2 | Fallback photos are 4 hardcoded Unsplash URLs. If a festival has no image, it gets a random stock photo. | At minimum, make the fallback obviously a placeholder (overlay with "Image coming soon") so users don't think the stock photo IS the festival. |
| FEST-03 | P2 | Past festivals section at 70% opacity. Why show them at all? | Move to a separate "Archive" tab or link. Don't clutter the main view. |
| FEST-04 | P2 | Type filter chips use internal labels like "Cons & Gaming", "Expos & Shows". Are these the terms users would use? | User test the vocabulary. "Gaming Conventions" might be clearer than "Cons & Gaming". |

---

## 9. FOOTER

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| FOOT-01 | P2 | Copyright says "2026" — is this dynamically generated or hardcoded? | Verify it uses `new Date().getFullYear()`. If hardcoded, fix. |
| FOOT-02 | P2 | "AI-powered - Updated continuously" in tiny monospace text. Does this build trust or invite skepticism? | Test with users. If it raises more questions than it answers, remove. |
| FOOT-03 | P2 | Links: Privacy, Terms, Contact. No link to: About, FAQ, or the portal's social media. | Add "About Lost City" link and any Atlanta-specific social links. |

---

## 10. HOLIDAYS / SEASONAL CONTENT

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| HOL-01 | P0 | 8 holidays are hardcoded with date ranges. These need manual updates every year. If someone forgets, stale holidays show up. | Add an `endDate` check that auto-hides expired holidays. Flag in monitoring when a holiday's date range has passed. |
| HOL-02 | P1 | "Friday the 13th" subtitle: "Toss your favorite body through a window to celebrate" — horror movie reference that could read as violent to someone unfamiliar. | Softer: "Embrace the spooky side of Atlanta" or lean into the camp more explicitly. |
| HOL-03 | P1 | "Lunar New Year" subtitle: "A Year of Fire Horsin' Around" — playful but could read as dismissive of the holiday to some audiences. | More respectful: "Year of the Horse — celebrate across Atlanta" |
| HOL-04 | P2 | Holiday icon assets are mixed formats (GIF, SVG, PNG) with different art styles. Valentine's has a neon GIF, Mardi Gras has a flat SVG mask, Lunar New Year has a pixel-art horse. | Commission a consistent icon set or use a single style (line art, neon, illustrated — pick one). |
| HOL-05 | P1 | Ramadan subtitle: "Iftars, community meals & reflection across Atlanta" — good. But verify the date range is correct for 2026. Ramadan dates shift yearly. | Ramadan 2026 is approximately Feb 17 – Mar 19. Confirm and update annually. |

---

## 11. CROSS-CUTTING ISSUES

| ID | P | Issue | Suggestion |
|----|---|-------|------------|
| XCUT-01 | P0 | Vocabulary inconsistency across surfaces: "Destinations" (FindView tabs), "Places" (mobile menu, feed outro), "Spots" (code/API), "Venues" (DB). Users see at least 3 different words. | Establish a glossary. Recommend: "Places" for all user-facing surfaces. Reserve "venues" for internal/API use only. |
| XCUT-02 | P1 | "Events" means different things: in FindView it means everything (concerts, classes, festivals). In the feed, "Festivals" are a separate section. In Happening Now, "events" means only live ones. | Clarify in UI: "Live events" for happening-now, "Upcoming events" for browse, "Festivals" as a distinct category. |
| XCUT-03 | P1 | Date formatting varies: some cards show "Fri Feb 14", some show "Feb 14", some show "2/14", some show "Tomorrow". | Pick a hierarchy: (1) relative when < 7 days ("Today", "Tomorrow", "This Saturday"), (2) short date otherwise ("Feb 14"). Never use numeric-only dates. |
| XCUT-04 | P1 | Loading skeletons differ between surfaces. Feed uses `skeleton-shimmer` class. Happening Now uses `animate-pulse`. Event detail uses a different pattern. | Standardize on one skeleton style across the app. |
| XCUT-05 | P2 | No "last updated" or freshness signal anywhere. For a real-time discovery product, users should know data is fresh. | Add a subtle "Updated just now" / "Updated 2m ago" indicator on Happening Now and the feed. |
| XCUT-06 | P1 | Empty states have inconsistent tone: "Nothing here yet" (friendly), "No results found" (robotic), "Check back soon" (vague). | Write a style guide for empty states. Always: (1) acknowledge what happened, (2) suggest an action, (3) use the same voice. |

---

## Priority Summary

### P0 — Fix now (4 items)
- `HN-01`: Unify liveness between CTA and page
- `HOL-01`: Holiday dates need auto-expiry
- `XCUT-01`: Vocabulary audit ("Destinations" vs "Places" vs "Spots")
- `HOL-02`/`HOL-03`: Review holiday copy for sensitivity

### P1 — Fix before next push (25 items)
- Feed: section spacing, auto-rotate speed, holiday hero consistency, empty states
- Happening Now: filter bar height, inline neighborhood labels, count accuracy
- Navigation: vocabulary alignment, community tab visibility
- Find: type tab behavior on mobile, density toggle
- Event cards: information density audit
- Neighborhoods: dead entries, tier naming
- Cross-cutting: date formats, skeleton styles, empty state voice

### P2 — Backlog (22 items)
- Copy refinements (MomentsSection header, For You prompt, footer links)
- Visual refinements (scroll indicators, icon style consistency, drawer sizing)
- Feature gaps (missing destination categories, "About" link, freshness indicator)

---

## Next Steps

1. **Content review session** — Walk through P0 and P1 copy items with the content team. Bring this doc.
2. **Design review session** — Open the portal in Chrome and screenshot every P1 design issue. Annotate.
3. **Vocabulary decision** — Lock in terminology ("Places" vs "Destinations") and update across all surfaces.
4. **Holiday audit** — Review all 8 holiday entries for accuracy, tone, and visual consistency.
5. **Browser walkthrough** — Connect Chrome extension for a live screen-by-screen review with annotations.
