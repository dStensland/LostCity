# PRD-003: Portal Member Management

**Status**: Draft
**Priority**: P1 — Demo Sprint (supporting)
**Strategic Alignment**: Principle 5 (Shared Auth, Separate Experiences)

---

## 1. Problem & Opportunity

Portal member roles (owner/admin/editor/viewer) exist in the database via the `portal_members` table. Authorization checks work — `canManagePortal()` validates membership before allowing admin actions. But there's no UI for managing portal members.

This matters for demos because it answers the question: "Who on my team can manage this?" It also unlocks multi-stakeholder portals where the GM, marketing manager, and front desk staff each have appropriate access.

Not the most critical demo item, but it's a gap that prospects will notice and a quick win since the backend is already built.

---

## 2. Target Users & Use Cases

### Primary User: Portal Owner
- Created the portal, needs to invite team members
- Wants to control who can edit content vs. just view analytics
- May need to transfer ownership or remove former employees

### Secondary User: Portal Admin/Editor
- Invited by owner
- Needs to manage portal content (sections, featured events, picks)
- Should not be able to change billing, delete portal, or manage other members

### Use Cases
1. **Invite team member**: Owner sends invite to colleague's email
2. **Set role**: Owner assigns editor role to front desk, admin role to marketing manager
3. **Remove member**: Owner removes former employee from portal
4. **View team**: Anyone on the team can see who else has access

---

## 3. Requirements

### Must-Have

**R1. Member list view**
- Show all portal members with name, email, role, and join date
- Display in portal admin dashboard (existing `/[portal]/admin/`)
- Owner highlighted, current user indicated

**R2. Invite member**
- Invite by email address
- Select role on invite: admin / editor / viewer
- If user exists in system → add to portal_members immediately
- If user doesn't exist → store pending invite, activated on signup
- Confirmation message with portal name and role

**R3. Change member role**
- Owner can change any member's role
- Admin can change editor/viewer roles (not other admins)
- Cannot change own role
- Cannot demote the last owner

**R4. Remove member**
- Owner can remove any non-owner member
- Admin can remove editors and viewers
- Cannot remove self (must transfer ownership first)
- Confirmation dialog before removal

**R5. Role-based access**
- **Owner**: Full access (settings, members, billing, delete portal)
- **Admin**: Manage content, sections, sources, subscriptions. Cannot manage members or delete portal.
- **Editor**: Manage featured content and curated sections only
- **Viewer**: Read-only access to portal admin (analytics, source health)

### Nice-to-Have

**R6. Transfer ownership**
- Owner can transfer ownership to another admin
- Requires confirmation from both parties

**R7. Invite link**
- Generate a shareable invite link with role preset
- Link expires after 7 days
- Single-use or multi-use option

**R8. Activity log**
- Show who made what changes in portal admin
- "John updated the 'Tonight' section" style log

### Out of Scope

- SSO/SAML integration for enterprise portals
- Fine-grained permissions beyond the 4 roles
- Cross-portal member management (managing members across multiple portals)
- Notification preferences per member

---

## 4. User Stories & Flows

### Flow 1: Invite Team Member
```
Owner opens Portal Admin → Members tab
  → Sees current members list (just themselves)
  → Clicks "Invite Member"
  → Enters email: "frontdesk@forthhotel.com"
  → Selects role: "Editor"
  → Clicks "Send Invite"
  → System checks if email exists in profiles
    → If yes: adds to portal_members, shows confirmation
    → If no: creates pending invite record
  → Member list updates to show new member (or pending invite)
```

### Flow 2: Manage Roles
```
Owner opens Portal Admin → Members tab
  → Sees marketing manager listed as "Editor"
  → Clicks role dropdown → selects "Admin"
  → Confirmation: "Change role for Sarah to Admin?"
  → Confirms → role updated
```

---

## 5. Technical Considerations

### Existing Infrastructure
- `portal_members` table: id, portal_id, user_id, role, created_at
- `canManagePortal(portalId)` checks membership with owner/admin roles
- Portal admin layout already has navigation sidebar

### API Endpoints Needed
- `GET /api/admin/portals/[id]/members` — List members with profile info
- `POST /api/admin/portals/[id]/members` — Add member (by user_id or email)
- `PATCH /api/admin/portals/[id]/members/[memberId]` — Update role
- `DELETE /api/admin/portals/[id]/members/[memberId]` — Remove member

### Frontend Components
- `MemberList` — Table of members with role badges
- `InviteMemberDialog` — Email input + role selector
- `RoleBadge` — Visual role indicator
- Add "Members" or "Team" nav item to portal admin sidebar

### Authorization Rules
```
Action                    | Owner | Admin | Editor | Viewer
View member list          |   Y   |   Y   |   Y    |   Y
Invite member             |   Y   |   N   |   N    |   N
Change roles              |   Y   |   N*  |   N    |   N
Remove member             |   Y   |   N*  |   N    |   N
```
*Admin can manage editor/viewer only (future enhancement)

### Data Model
- Existing `portal_members` table works
- May need `portal_invites` table for pending invitations:
  ```
  portal_invites: id, portal_id, email, role, invited_by, created_at, expires_at, accepted_at
  ```

---

## 6. Success Metrics

**Demo Success**:
- Can demonstrate "invite your team" flow in 30 seconds
- Prospect understands role model without explanation

**Product Success**:
- Average portal has 2+ members within 30 days
- Less than 5% of invites result in support tickets

---

## 7. Open Questions

1. **Invite flow**: Email notification on invite? Or just add directly and tell the owner to share the portal URL? Email invites add complexity but feel more professional.

2. **Pending invites**: What happens when an invited email signs up later? Do we need a webhook/trigger to auto-add them to the portal?

3. **Role granularity**: Four roles may be overkill for the demo. Could simplify to owner/editor for now and expand later. What do we think?

4. **UI placement**: New page in portal admin sidebar, or a section within the existing admin dashboard page?
