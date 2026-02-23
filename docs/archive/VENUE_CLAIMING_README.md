# Venue Claiming & Self-Service Event Submission

This feature enables venue owners to claim their listings and gain management access to submit events and update venue details.

## What Was Built

### Database Schema

**Migration:** `database/migrations/175_venue_claims.sql`

- **venue_claims table** - Tracks ownership claims
  - `venue_id`, `user_id`, `status` (pending/approved/rejected)
  - `proof_url` - Link to verification evidence
  - Auto-approval when user email domain matches venue website
  - Unique indexes prevent duplicate claims
  - RLS policies for user privacy

- **venues table additions**
  - `claimed_by` - User ID of owner
  - `is_verified` - Verification badge status
  - `claimed_at` - Timestamp of claim approval

- **events table additions**
  - `source_type` - Distinguishes crawler vs venue_submission vs user_submission
  - `submitted_by` - User who created the event

### API Routes

#### `/api/venues/claim` (POST, GET)
- **POST**: Submit a venue claim
  - Auto-approves if user email domain matches venue website
  - Rate limited (write tier)
  - Returns claim status and next steps
- **GET**: Fetch user's claims

#### `/api/venues/[slug]/edit` (PATCH)
- Update venue details (description, hours, images, accessibility, vibes)
- Authenticated, owner-only access
- Full input validation and sanitization

#### `/api/venues/[slug]/submit-event` (POST)
- Self-service event submission for venue owners
- Events auto-distributed to all relevant portals
- Full validation: dates, categories, pricing, URLs
- Sets `source_type: 'venue_submission'` and `submitted_by: user.id`

### Frontend Pages

#### Venue Dashboard (`/venue/[slug]/dashboard`)
- **Overview tab**: Quick stats, verification status, getting started guide
- **Edit Details tab**: Form to update venue information
- **Submit Event tab**: Full event submission form with validation
- **Analytics tab**: Event counts, portal coverage info (placeholder for future metrics)

#### Claim Flow
- **Spot detail page** (`/app/[portal]/spots/[slug]/page.tsx`)
  - "Claim this venue" link (only shows if unclaimed)
  - "Verified" badge (shows if claimed and verified)

- **Claim page** (`/venue/[slug]/claim/page.tsx`)
  - Simple claim submission with optional proof URL
  - Auto-approval explanation
  - Value prop: what owners get

- **Success page** (`/venue/[slug]/claim/success/page.tsx`)
  - Confirmation message
  - Timeline expectation (1-2 business days)

## Access Control

- All dashboard pages verify ownership (`claimed_by === user.id`)
- Non-owners get 403 with clear messaging
- Unauthenticated users redirected to login with return URL
- All mutations go through API routes (not client-side Supabase)

## Value Proposition for Venues

1. **Edit venue details** - Keep info fresh (hours, images, description)
2. **Submit events** - Events appear across ALL portals automatically
3. **Verified badge** - Trust signal on venue page
4. **Analytics** - (Placeholder for future engagement metrics)

## Security & Validation

- Rate limiting on all endpoints
- Input sanitization (XSS prevention)
- URL validation for all external links
- Date/time format validation
- Category whitelist enforcement
- SQL injection protection via parameterized queries
- Auto-approval only with domain match (prevents abuse)

## Future Enhancements

- Event page views and CTR analytics
- Portal-specific performance breakdowns
- User saves and RSVPs tracking
- Follower growth trends
- Email notifications on claim approval
- Admin dashboard for reviewing claims

## TypeScript Changes

Updated `lib/spots-constants.ts` to add:
- `claimed_by: string | null`
- `is_verified: boolean | null`

All pages and API routes are fully typed.

## Testing Checklist

- [ ] Run migration `175_venue_claims.sql`
- [ ] Verify claim submission works
- [ ] Test auto-approval with matching email domain
- [ ] Test manual approval flow
- [ ] Submit test event from dashboard
- [ ] Verify event appears on main feed
- [ ] Check access control (non-owner can't access dashboard)
- [ ] Test edit venue details
- [ ] Verify verified badge shows on venue page
- [ ] Run `npx tsc --noEmit` to verify no TypeScript errors
