-- Add dashboard_cards and quick_links to the 35 day×slot feed headers.
-- Cards use live-count queries where possible.
-- Quick links point to pre-filtered Find views.

DO $$
DECLARE
  v_portal_id UUID;
BEGIN
  SELECT id INTO v_portal_id FROM portals WHERE slug = 'atlanta' LIMIT 1;
  IF v_portal_id IS NULL THEN RETURN; END IF;

  -- =========================================================================
  -- MONDAY
  -- =========================================================================

  -- Monday Morning
  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"coffee","label":"Coffee spots","icon":"Coffee","href":"/atlanta?view=find&type=spots&venue_type=coffee_shop","value":"Open now"},
      {"id":"classes","label":"Morning classes","icon":"Barbell","href":"/atlanta?view=find&type=events&categories=fitness&date=today","value":"Today","query":{"entity":"events","category":"fitness","date_filter":"today"}},
      {"id":"today","label":"Today in ATL","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=today","query":{"entity":"events","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Coffee","icon":"Coffee","href":"/atlanta?view=find&type=destinations&tags=coffee","accent_color":"var(--neon-amber)"},
      {"label":"Classes","icon":"Barbell","href":"/atlanta?view=find&type=events&categories=fitness&date=today","accent_color":"var(--neon-cyan)"},
      {"label":"Today","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=today","accent_color":"var(--coral)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"},
      {"label":"This Weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","accent_color":"var(--neon-cyan)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'mon-morning';

  -- Monday Lunch
  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"lunch","label":"Lunch spots","icon":"ForkKnife","href":"/atlanta?view=find&type=spots&venue_type=restaurant","value":"Open now"},
      {"id":"tonight","label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17:00","query":{"entity":"events","date_filter":"today","time_after":"17:00"}},
      {"id":"free","label":"Free today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","query":{"entity":"events","date_filter":"today","is_free":true}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Lunch Spots","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&venue_types=restaurant","accent_color":"var(--coral)"},
      {"label":"Today","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=today","accent_color":"var(--coral)"},
      {"label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17%3A00","accent_color":"var(--neon-magenta)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"},
      {"label":"Museums","icon":"Bank","href":"/atlanta?view=find&type=destinations&venue_types=museum%2Cgallery","accent_color":"var(--neon-cyan)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'mon-lunch';

  -- Monday Afternoon
  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"happy_hour","label":"Happy hours","icon":"BeerStein","href":"/atlanta?view=find&type=spots&venue_type=bar","value":"Active now","accent":"var(--gold)"},
      {"id":"live_music","label":"Live music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&category=music&date=today","value":"Tonight","accent":"var(--coral)","query":{"entity":"events","category":"music","date_filter":"today"}},
      {"id":"comedy","label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&category=comedy&date=today","value":"Tonight","query":{"entity":"events","category":"comedy","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Happy Hour","icon":"BeerStein","href":"/atlanta?view=find&type=destinations&tags=happy-hour","accent_color":"var(--neon-amber)"},
      {"label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17%3A00","accent_color":"var(--neon-magenta)"},
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&categories=comedy&date=today","accent_color":"var(--gold)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'mon-afternoon';

  -- Monday Evening
  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"live_music","label":"Live music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&category=music&date=today","value":"Tonight","accent":"var(--coral)","query":{"entity":"events","category":"music","date_filter":"today"}},
      {"id":"nightlife","label":"Nightlife","icon":"Martini","href":"/atlanta?view=find&type=events&category=nightlife&date=today","value":"Trending","accent":"var(--neon-magenta)","query":{"entity":"events","category":"nightlife","date_filter":"today"}},
      {"id":"late_night","label":"Late night eats","icon":"ForkKnife","href":"/atlanta?view=find&type=spots&venue_type=restaurant&open_now=true","value":"Open now"}
    ]'::jsonb,
    quick_links = '[
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&categories=comedy&date=today","accent_color":"var(--gold)"},
      {"label":"Nightlife","icon":"Champagne","href":"/atlanta?view=find&type=events&categories=nightlife&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Late Night Eats","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&tags=late-night","accent_color":"var(--coral)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'mon-evening';

  -- Monday Night
  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"nightlife","label":"Nightlife","icon":"Martini","href":"/atlanta?view=find&type=events&category=nightlife&date=today","value":"Trending","accent":"var(--neon-magenta)","query":{"entity":"events","category":"nightlife","date_filter":"today"}},
      {"id":"late_night","label":"Late night eats","icon":"ForkKnife","href":"/atlanta?view=find&type=spots&venue_type=restaurant&open_now=true","value":"Open now"},
      {"id":"comedy","label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&category=comedy&date=today","value":"Still going","query":{"entity":"events","category":"comedy","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Nightlife","icon":"Champagne","href":"/atlanta?view=find&type=events&categories=nightlife&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Late Night Eats","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&tags=late-night","accent_color":"var(--coral)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'mon-night';

  -- =========================================================================
  -- TUESDAY (Taco Tuesday flavor)
  -- =========================================================================

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"coffee","label":"Coffee spots","icon":"Coffee","href":"/atlanta?view=find&type=spots&venue_type=coffee_shop","value":"Open now"},
      {"id":"classes","label":"Morning classes","icon":"Barbell","href":"/atlanta?view=find&type=events&categories=fitness&date=today","value":"Today","query":{"entity":"events","category":"fitness","date_filter":"today"}},
      {"id":"today","label":"Today in ATL","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=today","query":{"entity":"events","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Coffee","icon":"Coffee","href":"/atlanta?view=find&type=destinations&tags=coffee","accent_color":"var(--neon-amber)"},
      {"label":"Brunch","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&venue_types=restaurant&tags=brunch","accent_color":"var(--gold)"},
      {"label":"Classes","icon":"Barbell","href":"/atlanta?view=find&type=events&categories=fitness&date=today","accent_color":"var(--neon-cyan)"},
      {"label":"Today","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=today","accent_color":"var(--coral)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'tue-morning';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"tacos","label":"Taco spots","icon":"ForkKnife","href":"/atlanta?view=find&type=spots&venue_type=restaurant&cuisine=mexican","value":"Taco Tuesday","accent":"var(--gold)"},
      {"id":"tonight","label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17:00","query":{"entity":"events","date_filter":"today","time_after":"17:00"}},
      {"id":"free","label":"Free today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","query":{"entity":"events","date_filter":"today","is_free":true}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Taco Tuesday","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&venue_types=restaurant&tags=tacos","accent_color":"var(--gold)"},
      {"label":"Lunch Spots","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&venue_types=restaurant","accent_color":"var(--coral)"},
      {"label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17%3A00","accent_color":"var(--neon-magenta)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"},
      {"label":"This Weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","accent_color":"var(--neon-cyan)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'tue-lunch';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"happy_hour","label":"Happy hours","icon":"BeerStein","href":"/atlanta?view=find&type=spots&venue_type=bar","value":"Active now","accent":"var(--gold)"},
      {"id":"tacos","label":"Taco specials","icon":"ForkKnife","href":"/atlanta?view=find&type=spots&venue_type=restaurant&cuisine=mexican","value":"Taco Tuesday","accent":"var(--gold)"},
      {"id":"live_music","label":"Live music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&category=music&date=today","value":"Tonight","accent":"var(--coral)","query":{"entity":"events","category":"music","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Happy Hour","icon":"BeerStein","href":"/atlanta?view=find&type=destinations&tags=happy-hour","accent_color":"var(--neon-amber)"},
      {"label":"Taco Tuesday","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&venue_types=restaurant&tags=tacos","accent_color":"var(--gold)"},
      {"label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17%3A00","accent_color":"var(--neon-magenta)"},
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&categories=comedy&date=today","accent_color":"var(--gold)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'tue-afternoon';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"live_music","label":"Live music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&category=music&date=today","value":"Tonight","accent":"var(--coral)","query":{"entity":"events","category":"music","date_filter":"today"}},
      {"id":"nightlife","label":"Nightlife","icon":"Martini","href":"/atlanta?view=find&type=events&category=nightlife&date=today","value":"Trending","accent":"var(--neon-magenta)","query":{"entity":"events","category":"nightlife","date_filter":"today"}},
      {"id":"late_night","label":"Late night eats","icon":"ForkKnife","href":"/atlanta?view=find&type=spots&venue_type=restaurant&open_now=true","value":"Open now"}
    ]'::jsonb,
    quick_links = '[
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Nightlife","icon":"Champagne","href":"/atlanta?view=find&type=events&categories=nightlife&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&categories=comedy&date=today","accent_color":"var(--gold)"},
      {"label":"Late Night Eats","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&tags=late-night","accent_color":"var(--coral)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'tue-evening';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"nightlife","label":"Nightlife","icon":"Martini","href":"/atlanta?view=find&type=events&category=nightlife&date=today","value":"Trending","accent":"var(--neon-magenta)","query":{"entity":"events","category":"nightlife","date_filter":"today"}},
      {"id":"late_night","label":"Late night eats","icon":"ForkKnife","href":"/atlanta?view=find&type=spots&venue_type=restaurant&open_now=true","value":"Open now"},
      {"id":"comedy","label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&category=comedy&date=today","value":"Still going","query":{"entity":"events","category":"comedy","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Nightlife","icon":"Champagne","href":"/atlanta?view=find&type=events&categories=nightlife&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Late Night Eats","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&tags=late-night","accent_color":"var(--coral)"},
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'tue-night';

  -- =========================================================================
  -- WEDNESDAY (Wine Wednesday flavor)
  -- =========================================================================

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"coffee","label":"Coffee spots","icon":"Coffee","href":"/atlanta?view=find&type=spots&venue_type=coffee_shop","value":"Open now"},
      {"id":"classes","label":"Morning classes","icon":"Barbell","href":"/atlanta?view=find&type=events&categories=fitness&date=today","value":"Today","query":{"entity":"events","category":"fitness","date_filter":"today"}},
      {"id":"today","label":"Today in ATL","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=today","query":{"entity":"events","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Coffee","icon":"Coffee","href":"/atlanta?view=find&type=destinations&tags=coffee","accent_color":"var(--neon-amber)"},
      {"label":"Classes","icon":"Barbell","href":"/atlanta?view=find&type=events&categories=fitness&date=today","accent_color":"var(--neon-cyan)"},
      {"label":"Today","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=today","accent_color":"var(--coral)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"},
      {"label":"This Weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","accent_color":"var(--neon-cyan)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'wed-morning';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"wine","label":"Wine bars","icon":"Wine","href":"/atlanta?view=find&type=spots&venue_type=bar&vibe=wine","value":"Wine Wednesday","accent":"var(--neon-magenta)"},
      {"id":"tonight","label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17:00","query":{"entity":"events","date_filter":"today","time_after":"17:00"}},
      {"id":"free","label":"Free today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","query":{"entity":"events","date_filter":"today","is_free":true}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Wine Bars","icon":"Wine","href":"/atlanta?view=find&type=destinations&tags=wine","accent_color":"var(--neon-magenta)"},
      {"label":"Lunch Spots","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&venue_types=restaurant","accent_color":"var(--coral)"},
      {"label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17%3A00","accent_color":"var(--neon-magenta)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"},
      {"label":"This Weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","accent_color":"var(--neon-cyan)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'wed-lunch';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"wine","label":"Wine specials","icon":"Wine","href":"/atlanta?view=find&type=spots&venue_type=bar&vibe=wine","value":"Wine Wednesday","accent":"var(--neon-magenta)"},
      {"id":"happy_hour","label":"Happy hours","icon":"BeerStein","href":"/atlanta?view=find&type=spots&venue_type=bar","value":"Active now","accent":"var(--gold)"},
      {"id":"live_music","label":"Live music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&category=music&date=today","value":"Tonight","accent":"var(--coral)","query":{"entity":"events","category":"music","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Wine Bars","icon":"Wine","href":"/atlanta?view=find&type=destinations&tags=wine","accent_color":"var(--neon-magenta)"},
      {"label":"Happy Hour","icon":"BeerStein","href":"/atlanta?view=find&type=destinations&tags=happy-hour","accent_color":"var(--neon-amber)"},
      {"label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17%3A00","accent_color":"var(--neon-magenta)"},
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&categories=comedy&date=today","accent_color":"var(--gold)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'wed-afternoon';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"live_music","label":"Live music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&category=music&date=today","value":"Tonight","accent":"var(--coral)","query":{"entity":"events","category":"music","date_filter":"today"}},
      {"id":"comedy","label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&category=comedy&date=today","value":"Tonight","query":{"entity":"events","category":"comedy","date_filter":"today"}},
      {"id":"nightlife","label":"Nightlife","icon":"Martini","href":"/atlanta?view=find&type=events&category=nightlife&date=today","value":"Trending","accent":"var(--neon-magenta)","query":{"entity":"events","category":"nightlife","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&categories=comedy&date=today","accent_color":"var(--gold)"},
      {"label":"Nightlife","icon":"Champagne","href":"/atlanta?view=find&type=events&categories=nightlife&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Wine Bars","icon":"Wine","href":"/atlanta?view=find&type=destinations&tags=wine","accent_color":"var(--neon-magenta)"},
      {"label":"Late Night Eats","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&tags=late-night","accent_color":"var(--coral)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'wed-evening';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"nightlife","label":"Nightlife","icon":"Martini","href":"/atlanta?view=find&type=events&category=nightlife&date=today","value":"Trending","accent":"var(--neon-magenta)","query":{"entity":"events","category":"nightlife","date_filter":"today"}},
      {"id":"late_night","label":"Late night eats","icon":"ForkKnife","href":"/atlanta?view=find&type=spots&venue_type=restaurant&open_now=true","value":"Open now"},
      {"id":"comedy","label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&category=comedy&date=today","value":"Still going","query":{"entity":"events","category":"comedy","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Nightlife","icon":"Champagne","href":"/atlanta?view=find&type=events&categories=nightlife&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Late Night Eats","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&tags=late-night","accent_color":"var(--coral)"},
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'wed-night';

  -- =========================================================================
  -- THURSDAY (Thirsty Thursday flavor)
  -- =========================================================================

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"coffee","label":"Coffee spots","icon":"Coffee","href":"/atlanta?view=find&type=spots&venue_type=coffee_shop","value":"Open now"},
      {"id":"weekend","label":"This weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","query":{"entity":"events","date_filter":"this_weekend"}},
      {"id":"today","label":"Today in ATL","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=today","query":{"entity":"events","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Coffee","icon":"Coffee","href":"/atlanta?view=find&type=destinations&tags=coffee","accent_color":"var(--neon-amber)"},
      {"label":"Today","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=today","accent_color":"var(--coral)"},
      {"label":"This Weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","accent_color":"var(--neon-cyan)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"},
      {"label":"Classes","icon":"Barbell","href":"/atlanta?view=find&type=events&categories=fitness&date=today","accent_color":"var(--neon-cyan)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'thu-morning';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"lunch","label":"Lunch spots","icon":"ForkKnife","href":"/atlanta?view=find&type=spots&venue_type=restaurant","value":"Open now"},
      {"id":"weekend","label":"This weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","query":{"entity":"events","date_filter":"this_weekend"}},
      {"id":"tonight","label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17:00","query":{"entity":"events","date_filter":"today","time_after":"17:00"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Lunch Spots","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&venue_types=restaurant","accent_color":"var(--coral)"},
      {"label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17%3A00","accent_color":"var(--neon-magenta)"},
      {"label":"This Weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","accent_color":"var(--neon-cyan)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"},
      {"label":"Art & Culture","icon":"PaintBrush","href":"/atlanta?view=find&type=events&categories=art","accent_color":"var(--neon-magenta)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'thu-lunch';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"happy_hour","label":"Thirsty Thursday","icon":"BeerStein","href":"/atlanta?view=find&type=spots&venue_type=bar","value":"Drink specials","accent":"var(--gold)"},
      {"id":"live_music","label":"Live music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&category=music&date=today","value":"Tonight","accent":"var(--coral)","query":{"entity":"events","category":"music","date_filter":"today"}},
      {"id":"weekend","label":"This weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","query":{"entity":"events","date_filter":"this_weekend"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Happy Hour","icon":"BeerStein","href":"/atlanta?view=find&type=destinations&tags=happy-hour","accent_color":"var(--neon-amber)"},
      {"label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17%3A00","accent_color":"var(--neon-magenta)"},
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"This Weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","accent_color":"var(--neon-cyan)"},
      {"label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&categories=comedy&date=today","accent_color":"var(--gold)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'thu-afternoon';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"live_music","label":"Live music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&category=music&date=today","value":"Tonight","accent":"var(--coral)","query":{"entity":"events","category":"music","date_filter":"today"}},
      {"id":"nightlife","label":"Nightlife","icon":"Martini","href":"/atlanta?view=find&type=events&category=nightlife&date=today","value":"Trending","accent":"var(--neon-magenta)","query":{"entity":"events","category":"nightlife","date_filter":"today"}},
      {"id":"comedy","label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&category=comedy&date=today","value":"Tonight","query":{"entity":"events","category":"comedy","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Nightlife","icon":"Champagne","href":"/atlanta?view=find&type=events&categories=nightlife&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&categories=comedy&date=today","accent_color":"var(--gold)"},
      {"label":"Late Night Eats","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&tags=late-night","accent_color":"var(--coral)"},
      {"label":"This Weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","accent_color":"var(--neon-cyan)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'thu-evening';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"nightlife","label":"Nightlife","icon":"Martini","href":"/atlanta?view=find&type=events&category=nightlife&date=today","value":"Trending","accent":"var(--neon-magenta)","query":{"entity":"events","category":"nightlife","date_filter":"today"}},
      {"id":"late_night","label":"Late night eats","icon":"ForkKnife","href":"/atlanta?view=find&type=spots&venue_type=restaurant&open_now=true","value":"Open now"},
      {"id":"weekend","label":"This weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","query":{"entity":"events","date_filter":"this_weekend"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Nightlife","icon":"Champagne","href":"/atlanta?view=find&type=events&categories=nightlife&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Late Night Eats","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&tags=late-night","accent_color":"var(--coral)"},
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"This Weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","accent_color":"var(--neon-cyan)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'thu-night';

  -- =========================================================================
  -- FRIDAY (Weekend energy)
  -- =========================================================================

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"coffee","label":"Coffee spots","icon":"Coffee","href":"/atlanta?view=find&type=spots&venue_type=coffee_shop","value":"Open now"},
      {"id":"weekend","label":"This weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","query":{"entity":"events","date_filter":"this_weekend"}},
      {"id":"today","label":"Today in ATL","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=today","query":{"entity":"events","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Coffee","icon":"Coffee","href":"/atlanta?view=find&type=destinations&tags=coffee","accent_color":"var(--neon-amber)"},
      {"label":"This Weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","accent_color":"var(--neon-cyan)"},
      {"label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17%3A00","accent_color":"var(--neon-magenta)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"},
      {"label":"Brunch","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&venue_types=restaurant&tags=brunch","accent_color":"var(--gold)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'fri-morning';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"lunch","label":"Lunch spots","icon":"ForkKnife","href":"/atlanta?view=find&type=spots&venue_type=restaurant","value":"Open now"},
      {"id":"tonight","label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17:00","query":{"entity":"events","date_filter":"today","time_after":"17:00"}},
      {"id":"weekend","label":"This weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","query":{"entity":"events","date_filter":"this_weekend"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Lunch Spots","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&venue_types=restaurant","accent_color":"var(--coral)"},
      {"label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17%3A00","accent_color":"var(--neon-magenta)"},
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"This Weekend","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_weekend","accent_color":"var(--neon-cyan)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'fri-lunch';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"happy_hour","label":"Happy hours","icon":"BeerStein","href":"/atlanta?view=find&type=spots&venue_type=bar","value":"Active now","accent":"var(--gold)"},
      {"id":"patio","label":"Patio bars","icon":"SunHorizon","href":"/atlanta?view=find&type=spots&venue_type=bar&vibe=patio","value":"Open now","accent":"var(--gold)"},
      {"id":"live_music","label":"Live music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&category=music&date=today","value":"Tonight","accent":"var(--coral)","query":{"entity":"events","category":"music","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Happy Hour","icon":"BeerStein","href":"/atlanta?view=find&type=destinations&tags=happy-hour","accent_color":"var(--neon-amber)"},
      {"label":"Patios","icon":"SunHorizon","href":"/atlanta?view=find&type=destinations&vibes=outdoor%2Crooftop%2Cpatio","accent_color":"var(--gold)"},
      {"label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17%3A00","accent_color":"var(--neon-magenta)"},
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Nightlife","icon":"Champagne","href":"/atlanta?view=find&type=events&categories=nightlife&date=today","accent_color":"var(--neon-magenta)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'fri-afternoon';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"live_music","label":"Live music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&category=music&date=today","value":"Tonight","accent":"var(--coral)","query":{"entity":"events","category":"music","date_filter":"today"}},
      {"id":"nightlife","label":"Nightlife","icon":"Martini","href":"/atlanta?view=find&type=events&category=nightlife&date=today","value":"Friday night","accent":"var(--neon-magenta)","query":{"entity":"events","category":"nightlife","date_filter":"today"}},
      {"id":"comedy","label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&category=comedy&date=today","value":"Tonight","query":{"entity":"events","category":"comedy","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Nightlife","icon":"Champagne","href":"/atlanta?view=find&type=events&categories=nightlife&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&categories=comedy&date=today","accent_color":"var(--gold)"},
      {"label":"Late Night Eats","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&tags=late-night","accent_color":"var(--coral)"},
      {"label":"Tomorrow","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=tomorrow","accent_color":"var(--neon-cyan)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'fri-evening';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"nightlife","label":"Nightlife","icon":"Martini","href":"/atlanta?view=find&type=events&category=nightlife&date=today","value":"Friday night","accent":"var(--neon-magenta)","query":{"entity":"events","category":"nightlife","date_filter":"today"}},
      {"id":"late_night","label":"Late night eats","icon":"ForkKnife","href":"/atlanta?view=find&type=spots&venue_type=restaurant&open_now=true","value":"Open now"},
      {"id":"live_music","label":"Live music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&category=music&date=today","value":"Still going","accent":"var(--coral)","query":{"entity":"events","category":"music","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Nightlife","icon":"Champagne","href":"/atlanta?view=find&type=events&categories=nightlife&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Late Night Eats","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&tags=late-night","accent_color":"var(--coral)"},
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Tomorrow","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=tomorrow","accent_color":"var(--neon-cyan)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'fri-night';

  -- =========================================================================
  -- SATURDAY (Peak weekend energy)
  -- =========================================================================

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"brunch","label":"Brunch","icon":"Egg","href":"/atlanta?view=find&type=spots&venue_type=restaurant&vibe=brunch","value":"Weekend picks","accent":"var(--gold)"},
      {"id":"markets","label":"Markets","icon":"Storefront","href":"/atlanta?view=find&type=events&category=markets","value":"This weekend","query":{"entity":"events","date_filter":"today"}},
      {"id":"parks","label":"Parks & outdoors","icon":"Tree","href":"/atlanta?view=find&type=spots&venue_type=park","value":"Near you"}
    ]'::jsonb,
    quick_links = '[
      {"label":"Brunch","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&venue_types=restaurant&tags=brunch","accent_color":"var(--gold)"},
      {"label":"Markets","icon":"Storefront","href":"/atlanta?view=find&type=events&categories=food_drink&tags=market%2Cfarmers-market&date=today","accent_color":"var(--neon-green)"},
      {"label":"Coffee","icon":"Coffee","href":"/atlanta?view=find&type=destinations&tags=coffee","accent_color":"var(--neon-amber)"},
      {"label":"Family","icon":"UsersThree","href":"/atlanta?view=find&type=events&categories=family&date=today","accent_color":"var(--neon-green)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'sat-morning';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"today","label":"Today in ATL","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=today","query":{"entity":"events","date_filter":"today"}},
      {"id":"outdoors","label":"Outdoors","icon":"Tree","href":"/atlanta?view=find&type=spots&venue_type=park","value":"Great day for it"},
      {"id":"free","label":"Free today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","query":{"entity":"events","date_filter":"today","is_free":true}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Today","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=today","accent_color":"var(--coral)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"},
      {"label":"Outdoors","icon":"Park","href":"/atlanta?view=find&type=destinations&venue_types=park%2Cgarden%2Coutdoor_venue","accent_color":"var(--neon-green)"},
      {"label":"Family","icon":"UsersThree","href":"/atlanta?view=find&type=events&categories=family&date=today","accent_color":"var(--neon-green)"},
      {"label":"Art & Culture","icon":"PaintBrush","href":"/atlanta?view=find&type=events&categories=art","accent_color":"var(--neon-magenta)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'sat-lunch';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"happy_hour","label":"Happy hours","icon":"BeerStein","href":"/atlanta?view=find&type=spots&venue_type=bar","value":"Active now","accent":"var(--gold)"},
      {"id":"patio","label":"Rooftop bars","icon":"SunHorizon","href":"/atlanta?view=find&type=spots&venue_type=bar&vibe=patio","value":"Open now","accent":"var(--gold)"},
      {"id":"tonight","label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17:00","query":{"entity":"events","date_filter":"today","time_after":"17:00"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Happy Hour","icon":"BeerStein","href":"/atlanta?view=find&type=destinations&tags=happy-hour","accent_color":"var(--neon-amber)"},
      {"label":"Patios","icon":"SunHorizon","href":"/atlanta?view=find&type=destinations&vibes=outdoor%2Crooftop%2Cpatio","accent_color":"var(--gold)"},
      {"label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17%3A00","accent_color":"var(--neon-magenta)"},
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Nightlife","icon":"Champagne","href":"/atlanta?view=find&type=events&categories=nightlife&date=today","accent_color":"var(--neon-magenta)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'sat-afternoon';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"live_music","label":"Live music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&category=music&date=today","value":"Saturday night","accent":"var(--coral)","query":{"entity":"events","category":"music","date_filter":"today"}},
      {"id":"nightlife","label":"Nightlife","icon":"Martini","href":"/atlanta?view=find&type=events&category=nightlife&date=today","value":"Go big","accent":"var(--neon-magenta)","query":{"entity":"events","category":"nightlife","date_filter":"today"}},
      {"id":"comedy","label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&category=comedy&date=today","value":"Tonight","query":{"entity":"events","category":"comedy","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Nightlife","icon":"Champagne","href":"/atlanta?view=find&type=events&categories=nightlife&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&categories=comedy&date=today","accent_color":"var(--gold)"},
      {"label":"Late Night Eats","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&tags=late-night","accent_color":"var(--coral)"},
      {"label":"Tomorrow","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=tomorrow","accent_color":"var(--neon-cyan)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'sat-evening';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"nightlife","label":"Nightlife","icon":"Martini","href":"/atlanta?view=find&type=events&category=nightlife&date=today","value":"Saturday night","accent":"var(--neon-magenta)","query":{"entity":"events","category":"nightlife","date_filter":"today"}},
      {"id":"late_night","label":"Late night eats","icon":"ForkKnife","href":"/atlanta?view=find&type=spots&venue_type=restaurant&open_now=true","value":"Open now"},
      {"id":"live_music","label":"Live music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&category=music&date=today","value":"Still going","accent":"var(--coral)","query":{"entity":"events","category":"music","date_filter":"today"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Nightlife","icon":"Champagne","href":"/atlanta?view=find&type=events&categories=nightlife&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Late Night Eats","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&tags=late-night","accent_color":"var(--coral)"},
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Tomorrow","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=tomorrow","accent_color":"var(--neon-cyan)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'sat-night';

  -- =========================================================================
  -- SUNDAY (Wind-down / Sunday Funday energy)
  -- =========================================================================

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"brunch","label":"Brunch","icon":"Egg","href":"/atlanta?view=find&type=spots&venue_type=restaurant&vibe=brunch","value":"Sunday brunch","accent":"var(--gold)"},
      {"id":"markets","label":"Markets","icon":"Storefront","href":"/atlanta?view=find&type=events&category=markets","value":"This morning","query":{"entity":"events","date_filter":"today"}},
      {"id":"coffee","label":"Coffee spots","icon":"Coffee","href":"/atlanta?view=find&type=spots&venue_type=coffee_shop","value":"Open now"}
    ]'::jsonb,
    quick_links = '[
      {"label":"Brunch","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&venue_types=restaurant&tags=brunch","accent_color":"var(--gold)"},
      {"label":"Markets","icon":"Storefront","href":"/atlanta?view=find&type=events&categories=food_drink&tags=market%2Cfarmers-market&date=today","accent_color":"var(--neon-green)"},
      {"label":"Coffee","icon":"Coffee","href":"/atlanta?view=find&type=destinations&tags=coffee","accent_color":"var(--neon-amber)"},
      {"label":"Family","icon":"UsersThree","href":"/atlanta?view=find&type=events&categories=family&date=today","accent_color":"var(--neon-green)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'sun-morning';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"today","label":"Sunday Funday","icon":"SunHorizon","href":"/atlanta?view=find&type=events&date=today","query":{"entity":"events","date_filter":"today"}},
      {"id":"outdoors","label":"Outdoors","icon":"Tree","href":"/atlanta?view=find&type=spots&venue_type=park","value":"Get outside"},
      {"id":"free","label":"Free today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","query":{"entity":"events","date_filter":"today","is_free":true}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Today","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=today","accent_color":"var(--coral)"},
      {"label":"Free Today","icon":"Ticket","href":"/atlanta?view=find&type=events&date=today&price=free","accent_color":"var(--neon-green)"},
      {"label":"Outdoors","icon":"Park","href":"/atlanta?view=find&type=destinations&venue_types=park%2Cgarden%2Coutdoor_venue","accent_color":"var(--neon-green)"},
      {"label":"Patios","icon":"SunHorizon","href":"/atlanta?view=find&type=destinations&vibes=outdoor%2Crooftop%2Cpatio","accent_color":"var(--gold)"},
      {"label":"Art & Culture","icon":"PaintBrush","href":"/atlanta?view=find&type=events&categories=art","accent_color":"var(--neon-magenta)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'sun-lunch';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"happy_hour","label":"Sunday happy hour","icon":"BeerStein","href":"/atlanta?view=find&type=spots&venue_type=bar","value":"Wind-down deals","accent":"var(--gold)"},
      {"id":"live_music","label":"Live music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&category=music&date=today","value":"Tonight","accent":"var(--coral)","query":{"entity":"events","category":"music","date_filter":"today"}},
      {"id":"food","label":"Food & drink","icon":"CookingPot","href":"/atlanta?view=find&type=events&category=food_drink","value":"This week","query":{"entity":"events","category":"food_drink","date_filter":"this_week"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Happy Hour","icon":"BeerStein","href":"/atlanta?view=find&type=destinations&tags=happy-hour","accent_color":"var(--neon-amber)"},
      {"label":"Tonight","icon":"MoonStars","href":"/atlanta?view=find&type=events&date=today&time_after=17%3A00","accent_color":"var(--neon-magenta)"},
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"This Week","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_week","accent_color":"var(--neon-cyan)"},
      {"label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&categories=comedy&date=today","accent_color":"var(--gold)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'sun-afternoon';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"live_music","label":"Live music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&category=music&date=today","value":"Tonight","accent":"var(--coral)","query":{"entity":"events","category":"music","date_filter":"today"}},
      {"id":"comedy","label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&category=comedy&date=today","value":"Tonight","query":{"entity":"events","category":"comedy","date_filter":"today"}},
      {"id":"food","label":"Restaurants","icon":"ForkKnife","href":"/atlanta?view=find&type=spots&venue_type=restaurant","value":"Open now"}
    ]'::jsonb,
    quick_links = '[
      {"label":"Live Music","icon":"MusicNotes","href":"/atlanta?view=find&type=events&categories=music&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Comedy","icon":"SmileyWink","href":"/atlanta?view=find&type=events&categories=comedy&date=today","accent_color":"var(--gold)"},
      {"label":"Cozy Spots","icon":"Coffee","href":"/atlanta?view=find&type=destinations&vibes=cozy%2Cintimate","accent_color":"var(--neon-amber)"},
      {"label":"This Week","icon":"CalendarCheck","href":"/atlanta?view=find&type=events&date=this_week","accent_color":"var(--neon-cyan)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'sun-evening';

  UPDATE portal_feed_headers SET
    dashboard_cards = '[
      {"id":"nightlife","label":"Industry night","icon":"Martini","href":"/atlanta?view=find&type=events&category=nightlife&date=today","value":"Sunday night","accent":"var(--neon-magenta)","query":{"entity":"events","category":"nightlife","date_filter":"today"}},
      {"id":"late_night","label":"Late night eats","icon":"ForkKnife","href":"/atlanta?view=find&type=spots&venue_type=restaurant&open_now=true","value":"Open now"},
      {"id":"tomorrow","label":"Tomorrow","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=tomorrow","query":{"entity":"events","date_filter":"tomorrow"}}
    ]'::jsonb,
    quick_links = '[
      {"label":"Nightlife","icon":"Champagne","href":"/atlanta?view=find&type=events&categories=nightlife&date=today","accent_color":"var(--neon-magenta)"},
      {"label":"Late Night Eats","icon":"ForkKnife","href":"/atlanta?view=find&type=destinations&tags=late-night","accent_color":"var(--coral)"},
      {"label":"Tomorrow","icon":"CalendarBlank","href":"/atlanta?view=find&type=events&date=tomorrow","accent_color":"var(--neon-cyan)"}
    ]'::jsonb
  WHERE portal_id = v_portal_id AND slug = 'sun-night';

END $$;
