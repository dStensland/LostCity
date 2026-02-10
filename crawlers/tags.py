"""
Canonical tag definitions for Lost City events.
Tags are organized into three categories: experiential, practical, and content.
"""

from __future__ import annotations

# Experiential tags (mood/vibe)
EXPERIENTIAL_TAGS = {
    "date-night",      # Romantic atmosphere
    "chill",           # Relaxed, low-key
    "high-energy",     # Loud, exciting, dancing
    "intimate",        # Small crowd, personal
    "rowdy",           # Party atmosphere
}

# Practical tags (attributes)
PRACTICAL_TAGS = {
    "free",            # No cost
    "ticketed",        # Requires tickets
    "21+",             # Age restricted
    "all-ages",        # No age restrictions
    "family-friendly", # Good for kids
    "outdoor",         # Outside event
    "accessible",      # Wheelchair accessible
    "rsvp-required",   # Must register
    "sold-out",        # No tickets available
    "limited-seating", # Small capacity
}

# Content tags (what it is)
CONTENT_TAGS = {
    "local-artist",    # Local/regional act
    "touring",         # National/international tour
    "debut",           # First show/premiere
    "album-release",   # Album release show
    "holiday",         # Holiday-themed
    "seasonal",        # Seasonal event
    "one-night-only",  # Single performance
    "opening-night",   # Theater/show opening
    "closing-night",   # Final performance
    "library",         # Library event
    "educational",     # Educational/learning focused
    "kids",            # For children
    "teens",           # For teenagers
    "adults",          # For adults
    "play",            # Games/playful activities
    "hands-on",        # Interactive/participatory
    "volunteer",       # Volunteer opportunity
    "community",       # Community gathering/meetup
    "super-bowl",      # Super Bowl related
    "valentines",      # Valentine's Day related
    "black-history-month",  # Black History Month
    "lunar-new-year",  # Lunar New Year
    "mardi-gras",      # Mardi Gras
    "gwinnett",        # Gwinnett County location
    "fulton",          # Fulton County location
    "dekalb",          # DeKalb County location
    "cobb",            # Cobb County location
    "live-music",      # Music performance (not a class)
    "class",           # Class/workshop/lesson
}

# Combined set of all valid tags
ALL_TAGS = EXPERIENTIAL_TAGS | PRACTICAL_TAGS | CONTENT_TAGS

# Tags that can be inherited from venue vibes
INHERITABLE_VIBES = {
    "intimate",
    "all-ages",
    "family-friendly",
    "outdoor-seating",  # Maps to "outdoor" tag
}

# Mapping from venue vibe to event tag (when different)
VIBE_TO_TAG = {
    "outdoor-seating": "outdoor",
}

# Canonical valid categories (matches web search-constants.ts CATEGORIES)
VALID_CATEGORIES = {
    "music", "film", "comedy", "theater", "art", "sports",
    "food_drink", "nightlife", "community", "fitness", "family",
    "learning", "dance", "tours", "meetup", "words", "religious",
    "markets", "wellness", "gaming", "outdoors", "other",
}

# Canonical valid venue types (union of CLAUDE.md + web spots-constants.ts)
VALID_VENUE_TYPES = {
    "bar", "restaurant", "music_venue", "nightclub", "comedy_club",
    "gallery", "museum", "brewery", "coffee_shop", "bookstore",
    "library", "arena", "cinema", "park", "garden", "food_hall",
    "farmers_market", "convention_center", "venue", "organization",
    "festival", "church", "event_space", "sports_bar", "distillery",
    "winery", "hotel", "rooftop", "coworking", "record_store",
    "studio", "fitness_center", "community_center", "college",
    "university", "theater", "club", "attraction", "arcade",
    "karaoke", "nonprofit_hq", "cooking_school", "dance_studio",
    "amphitheater", "outdoor_venue", "wine_bar", "cocktail_bar",
    "lounge", "plaza", "recreation", "zoo", "aquarium", "stadium",
    "bowling", "pool_hall", "virtual",
}

# Canonical valid vibes (matches web spots-constants.ts VIBE_GROUPS)
VALID_VIBES = {
    # Atmosphere
    "late-night", "date-spot", "divey", "intimate", "upscale",
    "casual", "artsy", "historic",
    # Amenities
    "outdoor-seating", "craft-cocktails", "live-music", "good-for-groups",
    "rooftop", "patio", "free-parking",
    # Accessibility
    "all-ages", "family-friendly", "dog-friendly", "wheelchair-accessible",
    # Identity
    "lgbtq-friendly", "black-owned", "woman-owned",
}

# Canonical valid organization types
VALID_ORG_TYPES = {
    "arts_nonprofit", "community_group", "film_society", "running_club",
    "food_festival", "cultural_org", "performing_arts", "museum",
    "nonprofit", "government", "business", "lgbtq", "library",
    "music_industry", "music_museum", "public_market", "convention_center",
    "neighborhood", "business_improvement_district", "neighborhood_association",
    "tourism_organization", "historical_society", "municipal_recreation",
    "recreation_center", "religious_nonprofit", "sports", "education",
    "media", "advocacy", "religious", "professional",
}

# Canonical valid festival types
VALID_FESTIVAL_TYPES = {"festival", "conference", "convention"}

# Genre → experiential tag mapping
GENRE_TO_TAGS: dict[str, list[str]] = {
    # Music → experiential
    "jazz": ["date-night", "chill"], "blues": ["date-night", "chill"],
    "soul": ["date-night", "chill"], "r-and-b": ["date-night"],
    "classical": ["date-night", "chill"], "opera": ["date-night"],
    "singer-songwriter": ["chill", "intimate"], "folk": ["chill", "intimate"],
    "ambient": ["chill"], "reggae": ["chill"],
    "electronic": ["high-energy"], "edm": ["high-energy"],
    "house": ["high-energy"], "metal": ["high-energy"],
    "punk": ["high-energy"], "rock": ["high-energy"],
    "hip-hop": ["high-energy"], "latin": ["high-energy"],
    # Comedy
    "stand-up": ["date-night"], "improv": ["date-night"],
    # Food/drink
    "wine": ["date-night"], "cocktails": ["date-night"],
    "tasting": ["date-night"], "brunch": ["chill"], "coffee": ["chill"],
    # Fitness
    "yoga": ["chill"], "pilates": ["chill"],
    "crossfit": ["high-energy"], "martial-arts": ["high-energy"],
    # Words
    "poetry": ["chill", "intimate"], "reading": ["chill", "intimate"],
    "book-club": ["chill"],
    # Art
    "gallery-opening": ["date-night"], "exhibition": ["date-night"],
    # Nightlife
    "dj": ["high-energy"], "dance-party": ["high-energy"],
    "drag": ["high-energy"], "karaoke": ["rowdy"],
    "trivia": ["chill"], "game-night": ["chill"],
    "wine-night": ["date-night", "chill"], "cocktail-night": ["date-night"],
    "burlesque": ["date-night"],
}
