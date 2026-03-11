-- Migrate HelpATL-specific behavior from hardcoded slug checks to portal.settings flags.
-- This enables any future civic portal to use the same features via config.

UPDATE portals
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'show_impact_snapshot', true,
  'show_upcoming_deadlines', true,
  'hero_quick_links', jsonb_build_array(
    jsonb_build_object(
      'label', 'Follow Government',
      'icon', 'Bank',
      'href', '/helpatl/groups#city-county-watch',
      'accent_color', '#f97316'
    ),
    jsonb_build_object(
      'label', 'Join Volunteer',
      'icon', 'UsersThree',
      'href', '/helpatl/groups#volunteer-opportunities',
      'accent_color', '#22d3ee'
    ),
    jsonb_build_object(
      'label', 'Track School Board',
      'icon', 'CalendarCheck',
      'href', '/helpatl/groups#school-board-watch',
      'accent_color', '#34d399'
    )
  ),
  'interest_channels_subtitle', 'Follow city, county, school board, and civic groups.',
  'interest_channels_label', 'Civic Channels',
  'groups_page_description', 'Follow city, county, school board, and topic groups to keep your civic feed relevant.',
  'groups_meta_description', 'Follow civic groups and volunteer opportunities across Atlanta.',
  'recommendation_labels', jsonb_build_object(
    'followed_venue', 'Source match',
    'followed_organization', 'Institution match',
    'followed_channel', 'Matched civic group',
    'neighborhood', 'Jurisdiction match',
    'category', 'Topic match'
  )
),
updated_at = now()
WHERE slug = 'helpatl';
