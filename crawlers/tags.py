"""
Canonical tag definitions for Lost City events.
Tags are organized into three categories: experiential, practical, and content.

Hardcoded values serve as offline fallbacks. Call load_taxonomy_from_db() at
crawler startup to supplement these sets with DB-authoritative data from
taxonomy_definitions.
"""

from __future__ import annotations

import logging
from typing import Optional

_logger = logging.getLogger(__name__)

# Experiential tags (mood/vibe)
EXPERIENTIAL_TAGS = {
    "date-night",  # Romantic atmosphere
    "chill",  # Relaxed, low-key
    "high-energy",  # Loud, exciting, dancing
    "intimate",  # Small crowd, personal
    "rowdy",  # Party atmosphere
}

# Practical tags (attributes)
PRACTICAL_TAGS = {
    "free",  # No cost
    "ticketed",  # Requires tickets
    "18+",  # Age restricted (18+)
    "21+",  # Age restricted (21+)
    "all-ages",  # No age restrictions
    "family-friendly",  # Good for kids
    "outdoor",  # Outside event
    "accessible",  # Wheelchair accessible
    "rsvp-required",  # Must register
    "sold-out",  # No tickets available
    "limited-seating",  # Small capacity
    # Age band tags (Hooky family portal)
    "infant",  # Ages 0-1 / newborns
    "toddler",  # Ages 1-3
    "preschool",  # Ages 3-5 / pre-K
    "elementary",  # Ages 5-12 / grades K-5
    "tween",  # Ages 10-13 / grades 6-8
    "teen",  # Ages 13-18 / high school
}

# Content tags (what it is)
CONTENT_TAGS = {
    "local-artist",  # Local/regional act
    "touring",  # National/international tour
    "debut",  # First show/premiere
    "album-release",  # Album release show
    "holiday",  # Holiday-themed
    "seasonal",  # Seasonal event
    "one-night-only",  # Single performance
    "opening-night",  # Theater/show opening
    "closing-night",  # Final performance
    "library",  # Library event
    "educational",  # Educational/learning focused
    "kids",  # For children
    "teens",  # For teenagers
    "adults",  # For adults
    "play",  # Games/playful activities
    "hands-on",  # Interactive/participatory
    "volunteer",  # Volunteer opportunity
    "activism",  # Civic engagement / organizing
    "mobilize",  # From Mobilize platform (activism source)
    "community",  # Community gathering/meetup

    # Civic/government
    "civic",  # Civic engagement event
    "civic-engagement",  # Civic participation
    "government",  # Government meeting/hearing
    "public-meeting",  # Open public meeting
    "public-comment",  # Public comment period available
    "attend",  # Worth attending in person
    "npu",  # Neighborhood Planning Unit meeting
    "neighborhood",  # Neighborhood-level event
    "zoning",  # Zoning hearing/review
    "land-use",  # Land use decision
    "urban-planning",  # Urban planning/design
    "transit",  # Transit-related
    "advocacy",  # Advocacy/organizing
    "school-board",  # School board meeting
    "education",  # Education-focused
    "environment",  # Environmental cause
    "food-security",  # Food security/hunger
    "housing",  # Housing/homelessness
    "health",  # Health-related
    "election",  # Election-related event
    "voter-registration",  # Voter registration drive
    "mutual-aid",  # Mutual aid / community solidarity event
    "town-hall",  # Town hall / community forum
    "arts",  # Arts & culture event
    "artsatl",  # ArtsATL calendar source
    "design-review",  # Design review hearing
    "trees",  # Tree conservation/urban forestry
    "planning",  # Planning-related meeting
    "marta-army",  # MARTA Army transit advocacy
    "arc",  # Atlanta Regional Commission
    "regional-planning",  # Regional planning event
    "streets-alive",  # Atlanta Streets Alive car-free event
    "bike",  # Bike/cycling related
    "pedestrian",  # Pedestrian/walkability
    "bus",  # Bus transit
    "rail",  # Rail transit
    "service-change",  # Transit service change

    "valentines",  # Valentine's Day related
    "black-history-month",  # Black History Month
    "lunar-new-year",  # Lunar New Year
    "mardi-gras",  # Mardi Gras
    "gwinnett",  # Gwinnett County location
    "fulton",  # Fulton County location
    "dekalb",  # DeKalb County location
    "cobb",  # Cobb County location
    "live-music",  # Music performance (not a class)
    "class",  # Class/workshop/lesson
    "showtime",  # Regular cinema showtime (filtered from curated feeds)
    "friday-13",  # Friday the 13th themed/spooky

    # Activity types
    "trivia",  # Trivia night
    "karaoke",  # Karaoke
    "open-mic",  # Open mic (comedy, music, poetry)
    "dj",  # DJ set / dance night
    "drag",  # Drag show
    "bingo",  # Bingo night
    "jam-session",  # Jam session
    "open-jam",  # Open jam session (all welcome)
    "jazz",  # Jazz performance
    "blues",  # Blues performance
    "bluegrass",  # Bluegrass music
    "poetry",  # Poetry reading / spoken word
    "dance",  # Dance event
    "comedy",  # Comedy show
    "games",  # Games / gaming
    "chess",  # Chess night
    "bar-games",  # Bar games (darts, pool, shuffleboard, etc.)
    "dnd",  # D&D / tabletop RPG
    "tabletop",  # Tabletop gaming
    "board-games",  # Board game night
    "running",  # Running / run club
    "cycling",  # Cycling / bike ride
    "hiking",  # Hiking / trail activity
    "volunteer-outdoors",  # Outdoor volunteer / cleanup
    "water-sports",  # Water sports / paddling
    "yoga",  # Yoga
    "pickleball",  # Pickleball
    "skating",  # Skating (ice or roller)
    "roller-skating",  # Roller skating
    "brunch",  # Brunch
    "happy-hour",  # Happy hour
    "food-specials",  # Food/drink specials
    "nightlife",  # Nightlife event

    # More activity types
    "standup",  # Stand-up comedy
    "sketch-comedy",  # Sketch comedy
    "improv",  # Improv comedy
    "acoustic",  # Acoustic performance
    "spoken-word",  # Spoken word / poetry slam
    "live-band",  # Live band performance
    "swing",  # Swing dance
    "lindy-hop",  # Lindy hop dance
    "salsa",  # Salsa dance
    "salsa-night",  # Salsa dance night
    "bachata",  # Bachata dance
    "latin",  # Latin music/dance
    "latin-night",  # Latin dance night
    "reggaeton",  # Reggaeton music
    "line-dancing",  # Line dancing / country dance
    "country-dance",  # Country dance / two-step
    "motown",  # Motown / soul music night
    "soul",  # Soul music
    "viewing-party",  # Watch party / viewing event
    "football",  # Football event / watch party
    "nfl",  # NFL game / watch party
    "run-club",  # Running club
    "bike-ride",  # Group bike ride
    "tennis",  # Tennis
    "arcade",  # Arcade games
    "pinball",  # Pinball
    "video-games",  # Video gaming
    "card-games",  # Card games (TCG, poker, etc.)
    "poker",  # Poker night
    "bar-poker",  # Bar poker league (freeroll)
    "freeroll",  # Free-entry poker tournament
    "miniatures",  # Miniatures gaming (Warhammer, etc.)
    "warhammer",  # Warhammer / 40k
    "40k",  # Warhammer 40,000
    "magic-the-gathering",  # MTG
    "mtg",  # Magic: The Gathering (short)
    "commander",  # MTG Commander format
    "pauper",  # MTG Pauper format
    "comics",  # Comic book related
    "game-night",  # General game night
    "competitive",  # Competitive / tournament play
    "drop-in",  # Drop-in welcome (no commitment)
    "geek",  # Geek / nerd culture
    "social",  # Social gathering
    "free-lesson",  # Free beginner lesson included
    "shopping",  # Shopping / retail event
    "vintage",  # Vintage / retro
    "farmers-market",  # Farmers market / green market
    "market",  # Market / pop-up market

    # Deal/value tags
    "specials",  # Venue specials / deals
    "oysters",  # Oyster special
    "dollar-oysters",  # $1 oysters
    "tacos",  # Taco special
    "taco-tuesday",  # Taco Tuesday special
    "wings",  # Wing special
    "wine",  # Wine special
    "bottomless",  # Bottomless drinks
    "half-price",  # Half-price deal
    "margaritas",  # Margarita special
    "craft-beer",  # Craft beer focus
    "beer",  # Beer special / event
    "crab",  # Crab / seafood special
    "seafood",  # Seafood special
    "tapas",  # Tapas / small plates
    "sangria",  # Sangria special
    "mimosas",  # Mimosa special
    "pizza",  # Pizza special
    "drink-specials",  # Drink specials / deals
    "budget-friendly",  # Good value / affordable

    # Tasting events
    "wine-tasting",  # Wine tasting event
    "bourbon-tasting",  # Bourbon tasting event
    "whiskey-tasting",  # Whiskey tasting event
    "beer-tasting",  # Beer/craft beer tasting

    # Sports
    "soccer",  # Soccer / football watch party
    "basketball",  # Basketball watch party
    "baseball",  # Baseball watch party
    "hockey",  # Hockey watch party
    "mma",  # MMA / UFC watch party
    "ufc",  # UFC fight night
    "boxing",  # Boxing watch party
    "wrestling",  # Wrestling watch party

    # Vibe extensions
    "late-night",  # Late-night event (after 10pm)
    "lgbtq",  # LGBTQ+ event
    "lgbtq-friendly",  # LGBTQ+ friendly
    "weekly",  # Weekly recurring
    "biweekly",  # Every two weeks
    "monthly",  # Monthly recurring
    "morning",  # Morning event
    "afternoon",  # Afternoon event
    "brewery",  # At a brewery
    "beltline",  # Near the BeltLine

    # Oddball / variety
    "tarot",  # Tarot reading / psychic event
    "burlesque",  # Burlesque show
    "variety-show",  # Variety show / cabaret / revue
    "murder-mystery",  # Murder mystery dinner / event
    "cabaret",  # Cabaret night
    "speed-dating",  # Speed dating event
    "silent-disco",  # Silent disco event
    "figure-drawing",  # Life drawing / figure drawing at a bar
    "yappy-hour",  # Dog-friendly social event at a bar
    "pro-wrestling",  # Live indie wrestling show
    "rocky-horror",  # Rocky Horror Picture Show screening w/ shadow cast
    "sip-and-paint",  # Paint night at a bar (not a dedicated studio)
    "outdoor-movies",  # Outdoor movie screening (parks, plazas)
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
    "music",
    "film",
    "comedy",
    "theater",
    "dance",
    "art",
    "sports",
    "food_drink",
    "nightlife",
    "community",
    "fitness",  # legacy alias — normalizes to "exercise"
    "exercise",
    "recreation",
    "family",
    "learning",
    "words",
    "religious",
    "wellness",
    "support_group",
    "outdoors",
    "other",
}

# Canonical valid venue types (union of web spots-constants.ts + explore types)
VALID_VENUE_TYPES = {
    # Entertainment
    "music_venue",
    "theater",
    "comedy_club",
    "club",
    "arena",
    "cinema",
    "attraction",
    "amphitheater",
    "stadium",
    "nightclub",
    # Food & Drink
    "bar",
    "restaurant",
    "coffee_shop",
    "brewery",
    "distillery",
    "winery",
    "rooftop",
    "sports_bar",
    "food_hall",
    "wine_bar",
    "cocktail_bar",
    "lounge",
    "eatertainment",
    # Cultural
    "gallery",
    "museum",
    "studio",
    "record_store",
    "arts_center",
    # Education
    "college",
    "university",
    "library",
    "bookstore",
    "cooking_school",
    "dance_studio",
    # Community & Events
    "convention_center",
    "community_center",
    "event_space",
    "coworking",
    "nonprofit_hq",
    "venue",
    "organization",
    "festival",
    "institution",
    # Recreation
    "games",
    "arcade",
    "karaoke",
    "park",
    "campground",
    "garden",
    "outdoor_venue",
    "farmers_market",
    "market",
    "fitness_center",
    "fitness",
    "bowling",
    "pool_hall",
    "recreation",
    "plaza",
    "zoo",
    "aquarium",
    # Sightseeing & Explore
    "landmark",
    "skyscraper",
    "artifact",
    "public_art",
    "viewpoint",
    "trail",
    "historic_site",
    # Healthcare
    "healthcare",
    "hospital",
    # Hospitality
    "hotel",
    # Religious
    "church",
    "temple",
    "mosque",
    "monastery",
    "synagogue",
    "community_center_religious",
    # Identity
    "lgbtq",
    # Retail & Services
    "retail",
    # Virtual
    "virtual",
}

# Canonical valid vibes (matches web spots-constants.ts VIBE_GROUPS)
VALID_VIBES = {
    # Atmosphere
    "late-night",
    "date-spot",
    "divey",
    "intimate",
    "upscale",
    "casual",
    "artsy",
    "historic",
    "trendy",
    "cozy",
    "lively",
    # Venue style
    "sports-bar",
    "neighborhood-bar",
    "dive-bar",
    "pop-up",
    "fast-casual",
    "counter-service",
    "happy-hour",
    # Amenities
    "outdoor-seating",
    "craft-cocktails",
    "live-music",
    "good-for-groups",
    "rooftop",
    "patio",
    "free-parking",
    "games",
    "karaoke",
    # Accessibility
    "all-ages",
    "family-friendly",
    "dog-friendly",
    "wheelchair-accessible",
    # Identity
    "lgbtq-friendly",
    "black-owned",
    "woman-owned",
    # Faith tradition (venue operator identity)
    "faith-christian",
    "faith-jewish",
    "faith-buddhist",
    "faith-hindu",
    "faith-muslim",
    "faith-sikh",
    "faith-interfaith",
    # Christian denominations (more specific, optional)
    "episcopal",
    "baptist",
    "methodist",
    "presbyterian",
    "catholic",
    "nondenominational",
    "ame",
}

# Canonical valid organization types
VALID_ORG_TYPES = {
    "arts_nonprofit",
    "community_group",
    "film_society",
    "running_club",
    "food_festival",
    "cultural_org",
    "performing_arts",
    "museum",
    "nonprofit",
    "government",
    "business",
    "lgbtq",
    "library",
    "music_industry",
    "music_museum",
    "public_market",
    "convention_center",
    "neighborhood",
    "business_improvement_district",
    "neighborhood_association",
    "tourism_organization",
    "historical_society",
    "municipal_recreation",
    "recreation_center",
    "religious_nonprofit",
    "sports",
    "education",
    "media",
    "advocacy",
    "religious",
    "professional",
}

# Canonical valid festival types
VALID_FESTIVAL_TYPES = {"festival", "conference", "convention", "market", "fair", "expo", "tournament"}

# Genre → experiential tag mapping
GENRE_TO_TAGS: dict[str, list[str]] = {
    # Music → experiential
    "jazz": ["date-night", "chill"],
    "blues": ["date-night", "chill"],
    "soul": ["date-night", "chill"],
    "r-and-b": ["date-night"],
    "classical": ["date-night", "chill"],
    "opera": ["date-night"],
    "singer-songwriter": ["chill", "intimate"],
    "folk": ["chill", "intimate"],
    "ambient": ["chill"],
    "reggae": ["chill"],
    "electronic": ["high-energy"],
    "edm": ["high-energy"],
    "house": ["high-energy"],
    "metal": ["high-energy"],
    "punk": ["high-energy"],
    "rock": ["high-energy"],
    "hip-hop": ["high-energy"],
    "latin": ["high-energy"],
    # Comedy
    "stand-up": ["date-night"],
    "improv": ["date-night"],
    # Food/drink
    "wine": ["date-night"],
    "cocktails": ["date-night"],
    "tasting": ["date-night"],
    "brunch": ["chill"],
    "coffee": ["chill"],
    # Fitness
    "yoga": ["chill"],
    "pilates": ["chill"],
    "crossfit": ["high-energy"],
    "martial-arts": ["high-energy"],
    # Words
    "poetry": ["chill", "intimate"],
    "reading": ["chill", "intimate"],
    "book-club": ["chill"],
    # Art
    "gallery-opening": ["date-night"],
    "exhibition": ["date-night"],
    # Nightlife
    "dj": ["high-energy"],
    "dance-party": ["high-energy"],
    "drag": ["high-energy"],
    "karaoke": ["rowdy"],
    "trivia": ["chill"],
    "game-night": ["chill"],
    "wine-night": ["date-night", "chill"],
    "cocktail-night": ["date-night"],
    "burlesque": ["date-night"],
}


# ─── DB-backed taxonomy loading ──────────────────────────────────────────────

def load_taxonomy_from_db(client: Optional[object] = None) -> bool:
    """Load taxonomy values from taxonomy_definitions table at startup.

    Supplements the hardcoded sets above with DB-authoritative data.
    Falls back silently to hardcoded values if DB is unavailable (offline crawling).

    Returns True if DB load succeeded, False if fell back to hardcoded.
    """
    global ALL_TAGS, VALID_VIBES

    if client is None:
        try:
            from db import get_client
            client = get_client()
        except Exception:
            _logger.debug("Could not connect to DB for taxonomy loading — using hardcoded fallbacks")
            return False

    try:
        # Load genres
        result = client.table("taxonomy_definitions").select("id").eq("taxonomy_type", "genre").eq("is_active", True).execute()
        if result.data:
            db_genres = {row["id"] for row in result.data}
            # Supplement genre_normalize's VALID_GENRES at runtime
            try:
                from genre_normalize import VALID_GENRES
                VALID_GENRES.update(db_genres)
            except ImportError:
                pass

        # Load vibes
        result = client.table("taxonomy_definitions").select("id").eq("taxonomy_type", "venue_vibe").eq("is_active", True).execute()
        if result.data:
            db_vibes = {row["id"] for row in result.data}
            VALID_VIBES.update(db_vibes)

        # Load event tags
        result = client.table("taxonomy_definitions").select("id").eq("taxonomy_type", "event_tag").eq("is_active", True).execute()
        if result.data:
            db_tags = {row["id"] for row in result.data}
            ALL_TAGS.update(db_tags)

        _logger.debug("Loaded taxonomy definitions from DB")
        return True
    except Exception as e:
        _logger.debug(f"Failed to load taxonomy from DB — using hardcoded fallbacks: {e}")
        return False
