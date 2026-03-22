"""
Tag inference logic for Lost City events.
Automatically assigns tags based on event data and venue vibes.
Also infers genres from event title/description using the unified taxonomy.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Optional
from tags import INHERITABLE_VIBES, VIBE_TO_TAG, ALL_TAGS, GENRE_TO_TAGS
from genre_normalize import normalize_genres, normalize_genre, genres_for_category, VALID_GENRES


def infer_tags(
    event: dict,
    venue_vibes: Optional[list[str]] = None,
    preserve_existing: bool = True,
    venue_type: Optional[str] = None,
    genres: Optional[list[str]] = None,
) -> list[str]:
    """
    Infer tags from event data, venue vibes, and venue type.

    Args:
        event: Event dict with title, description, is_free, price_min, etc.
        venue_vibes: List of vibes from the event's venue
        preserve_existing: If True, keep existing tags and add inferred ones
        venue_type: The venue's type (bar, library, park, etc.)

    Returns:
        List of tags for the event
    """
    tags = set()

    # Preserve existing tags if requested
    if preserve_existing:
        existing = event.get("tags") or []
        tags.update(existing)

    title = (event.get("title") or "").lower()
    desc = (event.get("description") or "").lower()
    text = f"{title} {desc}"
    category = (event.get("category") or event.get("category_id") or "").lower()

    # --- Inherit relevant vibes from venue ---
    if venue_vibes:
        for vibe in venue_vibes:
            if vibe in INHERITABLE_VIBES:
                tag = VIBE_TO_TAG.get(vibe, vibe)
                tags.add(tag)

    # --- Infer from venue type ---
    if venue_type:
        # 21+ venues
        if venue_type in (
            "bar",
            "nightclub",
            "brewery",
            "distillery",
            "wine_bar",
            "cocktail_bar",
            "lounge",
        ):
            tags.add("21+")

        # Outdoor venues
        if venue_type in (
            "park",
            "amphitheater",
            "farmers_market",
            "plaza",
            "garden",
            "outdoor_venue",
            "trail",
        ):
            tags.add("outdoor")

        # Family-friendly venues (unless it's a 21+ category event)
        if venue_type in (
            "library",
            "museum",
            "park",
            "community_center",
            "bookstore",
            "recreation",
            "zoo",
            "aquarium",
        ):
            if category not in ("nightlife",):
                tags.add("family-friendly")
                tags.add("all-ages")

        # Educational venues
        if venue_type in ("museum", "library"):
            tags.add("educational")

        # Intimate venues
        if venue_type in ("gallery", "bookstore", "wine_bar", "coffee_shop"):
            tags.add("intimate")

        # High-energy venues
        if venue_type in ("stadium", "arena", "nightclub"):
            tags.add("high-energy")

        # Date-night venues
        if venue_type in ("wine_bar", "cocktail_bar"):
            tags.add("date-night")

    # --- Infer showtime tag for film events at cinema venues ---
    # Every film event at a cinema venue gets the showtime tag.
    # This ensures indie cinemas (Plaza, Starlight, etc.) are included
    # alongside chains. Special screenings are distinguished in the UI
    # by other tags, not by absence of "showtime".
    if category == "film" and venue_type == "cinema":
        tags.add("showtime")

    # --- Infer from category ---
    if category == "comedy":
        tags.add("date-night")
    if category == "theater":
        tags.add("date-night")
    if category == "dance":
        tags.add("date-night")
    if category == "film":
        tags.add("date-night")
    if category in ("sports", "recreation", "exercise", "fitness"):
        tags.add("high-energy")
    if category == "nightlife":
        tags.add("21+")
    if category == "family":
        tags.add("family-friendly")
    if category == "outdoors":
        tags.add("outdoor")
    if category == "learning":
        tags.add("educational")

    # Live music tag (music events that aren't classes)
    if category == "music" and not event.get("is_class"):
        tags.add("live-music")

    # Class tag
    if event.get("is_class"):
        tags.add("class")

    # --- Infer from structured fields ---

    # Free vs ticketed
    if event.get("is_free"):
        tags.add("free")
    elif event.get("price_min") or event.get("ticket_url"):
        tags.add("ticketed")

    # --- Infer from title/description text ---

    # Album/record release
    if any(
        phrase in text
        for phrase in [
            "album release",
            "record release",
            "new album",
            "ep release",
            "single release",
            "release party",
            "release show",
        ]
    ):
        tags.add("album-release")

    # Touring artists/productions — context-aware to avoid venue/hospital/museum tours.
    # "tour" alone is too broad: matches "winery tour", "hospital tour", "walking tour".
    # Venue-tour detection uses TITLE ONLY to avoid false positives from venue names
    # in descriptions (e.g. "State Farm Arena" triggering the "farm" pattern).
    _tour_artist = re.search(
        r'\bon tour\b|\bworld tour\b|\bnational tour\b|\bnorth american tour\b'
        r'|\bfall tour\b|\bspring tour\b|\bsummer tour\b|\bwinter tour\b'
        r'|\b\w+ tour 20\d{2}\b'    # "Sunrise Tour 2026"
        r'|\b\w+\s+tour\b'          # Generic "X tour" (album release tour, etc.)
        r'|\btour\b.*\b(edition|leg|dates)\b'
        r'|\(touring\)',             # explicit "(Touring)" suffix
        text,
    )
    _tour_venue = re.search(
        r'\btour\s*(of|at|:)\b|\btour\s*[+&]\s*(tasting|lunch|dinner|brunch)\b'
        r'|\b(winery|brewery|distillery|hospital|maternity|birthing|museum|farm|stadium)\b.{0,15}\btour'
        r'|\btour.{0,15}\b(winery|brewery|distillery|hospital|maternity|birthing|museum|farm|stadium)\b'
        r'|\bwalking\s+tour\b|\bhistory\s+tour\b|\btour\s+guide\b|\bhomeschool\b'
        r'|\bopen\s+house\b.{0,15}\btour\b|\btour\b.{0,15}\bopen\s+house\b',
        title,  # TITLE ONLY — descriptions contain venue names that cause false positives
    )
    if _tour_artist and not _tour_venue:
        tags.add("touring")
    elif not _tour_venue and re.search(r'\btouring\b', text):
        # "touring" as an adjective (e.g. "touring production") is usually legit
        tags.add("touring")

    # Debuts/premieres
    if any(
        phrase in text
        for phrase in [
            "premiere",
            "debut",
            "first time",
            "world premiere",
            "atlanta premiere",   # TODO: use CrawlContext.city for city-specific premiere phrases
            "southeast premiere",
        ]
    ):
        tags.add("debut")

    # Sold out
    if any(phrase in text for phrase in ["sold out", "soldout", "sold-out"]):
        tags.add("sold-out")

    # Family friendly
    if any(
        phrase in text
        for phrase in [
            "kids",
            "children",
            "family",
            "all ages welcome",
            "bring the kids",
            "kid-friendly",
            "child-friendly",
        ]
    ):
        tags.add("family-friendly")

    # Kids content tag — events specifically for children (not just family-friendly)
    if any(
        phrase in text
        for phrase in [
            "for kids", "for children", "for toddlers", "for preschool",
            "kids camp", "youth camp", "day camp", "art camp",
            "kindergarten", "pre-k", "mommy and me", "daddy and me",
            "little artist", "young artist", "kids class", "kids workshop",
            "children's class", "children's workshop",
        ]
    ):
        tags.add("kids")

    # Age restrictions
    if any(
        phrase in text
        for phrase in [
            "21+",
            "21 and over",
            "ages 21",
            "21 & over",
            "21 and up",
            "must be 21",
            "over 21",
        ]
    ):
        tags.add("21+")

    if any(
        phrase in text
        for phrase in [
            "18+",
            "18 and over",
            "ages 18",
            "18 & over",
            "18 and up",
            "must be 18",
            "over 18",
        ]
    ):
        tags.add("18+")

    if any(
        phrase in text
        for phrase in ["all ages", "all-ages", "any age", "open to all ages"]
    ):
        tags.add("all-ages")

    # --- Age band tags (additive — an event can have multiple) ---
    # Used by the Hooky family portal for per-kid filtering.

    if any(
        phrase in text
        for phrase in [
            "baby", "infant", "newborn", "0-1", "0-2",
        ]
    ):
        tags.add("infant")

    if any(
        phrase in text
        for phrase in [
            "toddler", "ages 1-3", "ages 2-4", "mommy and me", "parent and tot",
        ]
    ):
        tags.add("toddler")

    if any(
        phrase in text
        for phrase in [
            "preschool", "pre-k", "prek", "ages 3-5", "ages 4-5",
        ]
    ):
        tags.add("preschool")

    if any(
        phrase in text
        for phrase in [
            "elementary", "ages 5-10", "ages 6-10", "ages 6-12",
            "grades k-5", "grades 1-5",
        ]
    ):
        tags.add("elementary")

    if any(
        phrase in text
        for phrase in [
            "tween", "ages 10-13", "ages 9-12", "middle school", "grades 6-8",
        ]
    ):
        tags.add("tween")

    if any(
        phrase in text
        for phrase in [
            "teen", "ages 13-17", "ages 14-18", "high school",
            "grades 9-12", "young adult",
        ]
    ):
        tags.add("teen")

    # Opening/closing nights
    if any(phrase in text for phrase in ["opening night", "opening weekend"]):
        tags.add("opening-night")

    if any(
        phrase in text
        for phrase in [
            "final performance",
            "closing night",
            "last chance",
            "final show",
            "last performance",
            "closing weekend",
        ]
    ):
        tags.add("closing-night")

    # One night only
    if any(
        phrase in text
        for phrase in [
            "one night only",
            "one-night-only",
            "single performance",
            "one night",
            "special engagement",
        ]
    ):
        tags.add("one-night-only")

    # Outdoor events
    if any(
        phrase in text
        for phrase in [
            "outdoor",
            "outside",
            "lawn",
            "patio",
            "rooftop",
            "under the stars",
            "open air",
        ]
    ):
        tags.add("outdoor")

    # Hiking / trail activities
    if any(
        phrase in text
        for phrase in [
            "hike",
            "hiking",
            "trail run",
            "nature walk",
            "nature hike",
            "guided hike",
            "trail walk",
        ]
    ):
        tags.add("hiking")

    # Running (supplement existing run-club patterns)
    if any(
        phrase in text
        for phrase in [
            "run club",
            "running club",
            "5k",
            "10k",
            "marathon",
            "fun run",
            "color run",
            "trail run",
            "half marathon",
        ]
    ):
        tags.add("running")

    # Civic meeting tags
    if any(
        phrase in text
        for phrase in [
            "public meeting",
            "public hearing",
            "board meeting",
            "commission meeting",
            "public comment",
        ]
    ):
        tags.add("public-meeting")

    if any(phrase in text for phrase in ["mutual aid", "solidarity", "free pantry", "food distribution"]):
        tags.add("mutual-aid")

    if re.search(r"\bnpu\b", text) or any(
        phrase in text for phrase in ["neighborhood planning unit"]
    ):
        tags.add("npu")

    if any(
        phrase in text
        for phrase in [
            "town hall",
            "community forum",
            "constituent meeting",
        ]
    ):
        tags.add("town-hall")

    # Outdoor volunteer / cleanup
    if any(
        phrase in text
        for phrase in [
            "trail cleanup",
            "park cleanup",
            "tree planting",
            "river cleanup",
            "creek cleanup",
            "stream cleanup",
            "litter cleanup",
            "volunteer cleanup",
            "park restoration",
            "invasive species",
        ]
    ):
        tags.add("volunteer-outdoors")

    # Water sports / paddling
    if any(
        phrase in text
        for phrase in [
            "kayak",
            "paddleboard",
            "paddle board",
            "canoe",
            "canoeing",
            "rowing",
            "sup class",
            "stand up paddle",
            "stand-up paddle",
            "paddle yoga",
            "dragon boat",
        ]
    ):
        tags.add("water-sports")

    # Cycling (supplement existing bike-ride patterns)
    if any(
        phrase in text
        for phrase in [
            "bike ride",
            "cycling",
            "bike tour",
            "critical mass",
            "group ride",
            "bicycle ride",
            "bike night",
        ]
    ):
        tags.add("cycling")

    # RSVP required — check for negations first
    rsvp_negations = [
        "no rsvp",
        "rsvp not required",
        "rsvp not needed",
        "no registration",
        "no sign up",
        "no signup",
        "walk-in",
        "walk in welcome",
        "drop-in",
        "drop in",
        "just show up",
        "no reservation",
    ]
    has_rsvp_negation = any(phrase in text for phrase in rsvp_negations)

    if not has_rsvp_negation and any(
        phrase in text
        for phrase in [
            "rsvp required",
            "rsvp to",
            "rsvp at",
            "rsvp here",
            "registration required",
            "must register",
            "must rsvp",
            "sign up required",
            "reserve your spot",
            "register now",
            "register to attend",
            "registration is required",
        ]
    ):
        tags.add("rsvp-required")

    # Limited seating
    if any(
        phrase in text
        for phrase in [
            "limited seating",
            "limited capacity",
            "small venue",
            "intimate setting",
            "limited tickets",
            "only 50",
            "only 100",
        ]
    ):
        tags.add("limited-seating")

    # Holiday detection
    holidays = [
        "christmas",
        "halloween",
        "thanksgiving",
        "valentine",
        "new year",
        "easter",
        "july 4",
        "fourth of july",
        "memorial day",
        "labor day",
        "juneteenth",
        "mlk day",
        "martin luther king",
        "independence day",
        "st. patrick",
        "cinco de mayo",
        "mardi gras",
    ]
    if any(holiday in text for holiday in holidays):
        tags.add("holiday")

    # --- Specific cultural/holiday tags ---

    # Parse event date once for all date-aware holiday checks
    start_date_str = event.get("start_date") or ""
    event_month = 0
    event_day = 0
    if start_date_str:
        try:
            event_month = int(start_date_str[5:7])
            event_day = int(start_date_str[8:10])
        except (ValueError, IndexError):
            pass

    # Valentine's Day — only tag events in the Valentine's window (Feb 1-16)
    if any(kw in text for kw in ["valentine", "galentine", "love day"]):
        if event_month == 2 and 1 <= event_day <= 16:
            tags.add("valentines")
            tags.add("holiday")

    # Mardi Gras
    if any(kw in text for kw in ["mardi gras", "fat tuesday", "krewe", "king cake"]):
        tags.add("mardi-gras")
        tags.add("holiday")

    # Lunar New Year
    if any(kw in text for kw in [
        "lunar new year", "chinese new year", "lunar celebration",
        "year of the snake", "year of the horse", "year of the dragon",
        "year of the rabbit", "year of the tiger", "year of the ox",
        "year of the rat", "year of the pig", "year of the dog",
        "year of the rooster", "year of the monkey", "year of the goat",
        "tet festival", "seollal", "losar",
        "lion dance", "dragon dance", "red envelope", "lunar fest",
    ]):
        tags.add("lunar-new-year")
        tags.add("holiday")

    bhm_keywords = [
        "black history", "african american", "african-american",
        "civil rights", "martin luther king", "mlk ",
        "black heritage", "black culture", "black excellence",
        "black joy", "black love", "black voices", "black stories",
        "black experience", "black changemaker", "black entertainment",
        "african diaspora", "pan-african", "black film festival",
        "black art", "afro-american", "negro spiritual",
    ]
    if any(kw in text for kw in bhm_keywords):
        if event_month == 2:
            tags.add("black-history-month")
        tags.add("holiday")

    # Friday the 13th (date-aware)
    if start_date_str:
        try:
            event_date = date.fromisoformat(start_date_str)
            if event_date.weekday() == 4 and event_date.day == 13:  # Friday + 13th
                fri13_keywords = [
                    "friday the 13", "friday 13", "tattoo flash",
                    "horror", "haunted", "ghost", "spooky", "serial killer",
                    "murder", "macabre", "occult", "supernatural", "paranormal",
                    "cemetery", "graveyard", "zombie", "vampire",
                    "goth", "gothic", "curse", "death", "dead",
                    "bloodbath", "seance", "tarot",
                ]
                if any(kw in text for kw in fri13_keywords):
                    tags.add("friday-13")
        except (ValueError, TypeError):
            pass

    # Seasonal
    seasonal_terms = [
        "summer series",
        "winter series",
        "fall festival",
        "spring festival",
        "holiday season",
        "seasonal",
    ]
    if any(term in text for term in seasonal_terms):
        tags.add("seasonal")

    # --- Experiential tags (harder to infer, be conservative) ---

    # High energy indicators
    high_energy_terms = [
        "dance party",
        "rave",
        "edm",
        "dj set",
        "club night",
        "bass",
        "techno",
        "house music",
    ]
    if any(term in text for term in high_energy_terms):
        tags.add("high-energy")

    # Chill indicators
    chill_terms = [
        "acoustic",
        "singer-songwriter",
        "jazz brunch",
        "wine tasting",
        "listening room",
        "unplugged",
    ]
    if any(term in text for term in chill_terms):
        tags.add("chill")

    # Intimate indicators
    intimate_terms = [
        "acoustic",
        "unplugged",
        "intimate",
        "solo",
        "reading",
        "poetry",
        "spoken word",
        "open mic",
        "songwriter",
        "candlelight",
    ]
    if any(term in text for term in intimate_terms):
        tags.add("intimate")

    # Date night indicators
    date_night_terms = [
        "jazz",
        "wine",
        "tasting",
        "cocktail",
        "acoustic",
        "candlelight",
        "couples",
        "date night",
        "romantic",
        "duo",
        "quartet",
        "piano",
        "soul",
        "r&b",
        "bossa",
        "blues",
        "prix fixe",
        "dinner",
        "supper club",
    ]
    if any(term in title for term in date_night_terms):
        tags.add("date-night")

    # Educational indicators
    educational_terms = [
        "workshop",
        "class",
        "lecture",
        "seminar",
        "talk",
        "panel",
        "author",
        "book signing",
        "masterclass",
        "tutorial",
        "exhibit",
    ]
    if any(term in text for term in educational_terms):
        tags.add("educational")

    # Infer experiential tags from genres
    for genre in genres or event.get("genres") or []:
        for gt in GENRE_TO_TAGS.get(genre, []):
            tags.add(gt)

    # Resolve conflicting age tags: all-ages wins
    if "all-ages" in tags:
        tags.discard("21+")
        tags.discard("18+")

    # 21+ venue-type signal overrides weak family-friendly text signal
    if "21+" in tags and "family-friendly" in tags:
        # Only keep family-friendly if explicit family language in title/description
        family_phrases = [
            "bring the kids", "kid-friendly", "children welcome",
            "for families", "family event", "all ages welcome",
            "family-friendly", "for all ages",
        ]
        text_check = f"{event.get('title', '')} {event.get('description', '')}".lower()
        if not any(phrase in text_check for phrase in family_phrases):
            tags.discard("family-friendly")

    # Filter to only valid tags
    valid_tags = [t for t in tags if t in ALL_TAGS]

    return sorted(valid_tags)


# Known class sources — events from these sources are always classes
CLASS_SOURCES = {
    "painting-with-a-twist",
    "sur-la-table",
    "williams-sonoma",
    "arthur-murray-atlanta",
    "atlanta-dance-ballroom",
    "atlanta-clay-works",
    "mudfire",
    "mudfire-pottery-studio",
    "spruill-center",
    "spruill-center-for-the-arts",
    "irwin-street-cooking",
    "publix-aprons",
    "cooks-warehouse",
    "callanwolde-fine-arts-center",
    "sndbath",
    "central-rock-gym-atlanta",
    # Dance studios
    "academy-ballroom",
    "ballroom-impact",
    "dancing4fun",
    "salsa-atlanta",
    "pasofino-dance",
    # Yoga studios
    "highland-yoga",
    "dancing-dogs-yoga",
    "evolation-yoga",
    "vista-yoga",
    "yonder-yoga",
    # Makerspaces
    "decatur-makers",
    "maker-station",
    "janke-studios",
    "freeside-atlanta",
    # Arts centers
    "chastain-arts-center",
    "chastain-arts",
    # Healthcare classes
    "piedmont-classes",
    # New class venues
    "candlelit-atl",
    "rockler-woodworking",
    "halls-floral",
    "rei-atlanta",
    "all-fired-up-art",
    "stone-summit",
}

# Class studio venue types
CLASS_VENUE_TYPES = {"studio", "cooking_school", "dance_studio", "fitness_center"}

# Title/description patterns that indicate a class
CLASS_TITLE_PATTERNS = [
    "cooking class",
    "pottery class",
    "painting class",
    "dance class",
    "dance lesson",
    "yoga class",
    "art workshop",
    "craft workshop",
    "woodworking class",
    "candle making",
    "flower arranging",
    "floral design",
    "photography class",
    "sewing class",
    "ceramics class",
    "wheel throwing",
    "glass blowing",
    "paint and sip",
    "paint & sip",
    "paint-and-sip",
    "sip and paint",
    "sip & paint",
    "paint -n- sip",
    "paint + sip",
    "hands-on class",
    "hands on class",
    "masterclass",
    "beginner class",
    "intermediate class",
    "advanced class",
    # Online / virtual courses
    "online course",
    "(online course)",
    "virtual course",
    "online workshop",
    "virtual workshop",
    "webinar",
    "certification course",
    "certificate program",
]


SUPPORT_GROUP_KEYWORDS = [
    "support group",
    "grief share",
    "griefshare",
    "grief support",
    "bereavement group",
    "recovery group",
    "recovery meeting",
    "celebrate recovery",
    "al-anon",
    "nar-anon",
    "na meeting",
    "aa meeting",
    "alcoholics anonymous",
    "narcotics anonymous",
    "survivors group",
    "divorce care",
    "divorcecare",
    "cancer support",
    "caregiver support",
    "mental health support group",
    "nami",
]

# Sources that are always support groups
SUPPORT_GROUP_SOURCES = {
    "griefshare-atlanta",
    "griefshare",
    "celebrate-recovery",
    "na-georgia",
    "aa-atlanta",
    "metro-atl-aa",
    "divorcecare-atlanta",
    "ridgeview-institute",
    "ga-council-recovery",
    "ga-harm-reduction",
    "nami-georgia",
    "atlanta-mission",
}


# ---------------------------------------------------------------------------
# Religious / faith event detection
# ---------------------------------------------------------------------------
# Events from church venues or with strong faith keywords should be
# category="religious", NOT "community".  Catches crawlers that default to
# community for church events.

RELIGIOUS_VENUE_TYPES = {
    "church",
    "temple",
    "mosque",
    "synagogue",
    "monastery",
}

# Keywords that strongly signal a religious event (not just a community event
# hosted at a church).  Cultural celebrations (Diwali, Eid, etc.) stay in
# community — they're cultural, not devotional.
_RELIGIOUS_KEYWORDS = [
    "worship service",
    "sunday service",
    "church service",
    "bible study",
    "prayer meeting",
    "prayer service",
    "gospel",
    "sermon",
    "vespers",
    "mass",
    "liturgy",
    "shabbat service",
    "torah study",
    "dharma talk",
    "puja",
    "worship night",
    "praise and worship",
    "prayer walk",
    "revival",
    "vacation bible school",
    "vbs",
    "devotional",
    "baptism",
    "communion",
]

# Source slugs for dedicated church/religious org crawlers.
# Events from these sources default to religious unless clearly secular
# (e.g. a concert or community meal).
RELIGIOUS_SOURCES = {
    "passion-city",
    "passion-city-church",
    "ebenezer-church",
    "ebenezer-baptist-church",
    "st-lukes-episcopal",
    "peachtree-road-umc",
    "cathedral-st-philip",
    "central-presbyterian",
    "all-saints-episcopal",
    "new-birth",
    "new-birth-missionary-baptist",
    "chabad-intown",
    "baps-mandir",
    "faith-alliance",
}

# Title-level keywords for reclassifying music→religious at church venues.
# Tighter than _RELIGIOUS_KEYWORDS — only catches actual services, not gospel
# performances at music venues.
_WORSHIP_TITLE_KEYWORDS = [
    "worship",
    "sunday service",
    "church service",
    "prayer",
    "sermon",
    "vespers",
    "liturgy",
    "bible study",
    "devotional",
    "revival",
]

# Secular-signal keywords — if present, don't reclassify even from a church source.
_SECULAR_OVERRIDES = [
    "concert",
    "jazz",
    "fundraiser",
    "gala",
    "community meal",
    "food drive",
    "clothing drive",
    "blood drive",
    "voter registration",
    "job fair",
    "health fair",
    "festival",
]


def infer_is_religious(
    event: dict,
    source_slug: str | None = None,
    venue_type: str | None = None,
) -> bool:
    """
    Infer whether an event should be categorized as 'religious'.

    Reclassifies from community OR music when the signal is strong enough.
    A worship service at a church miscategorized as "music" should still be
    caught — but a gospel brunch at City Winery should stay music.
    """
    if event.get("category") == "religious":
        return True

    category = event.get("category") or ""
    # Only reclassify community and music — don't touch art, family, etc.
    if category not in ("community", "music"):
        return False

    title = (event.get("title") or "").lower()
    desc = (event.get("description") or "").lower()
    text = f"{title} {desc}"

    # For music events, reclassify when worship signal is strong enough.
    # Two tiers:
    #   1. Any venue: title is dominated by worship keywords (e.g. "Sunday Worship")
    #   2. Church venue: title contains any worship keyword (e.g. "Easter Festival Worship")
    # "Gospel Brunch Ft. William Murphy" at City Winery stays music — performer
    # name in title signals a real music event, and it's at a music venue.
    if category == "music":
        # Tier 1: Title is entirely worship-focused (no performer names)
        for kw in _WORSHIP_TITLE_KEYWORDS:
            if kw in title:
                # If the entire title is basically just the worship keyword,
                # it's a service regardless of venue
                if venue_type in RELIGIOUS_VENUE_TYPES:
                    return True
                # At non-church venues, only reclassify when title is
                # short/generic (no named performers)
                if len(title.split()) <= 5:
                    return True
        return False

    # --- community category path (original logic) ---

    # Check for secular overrides first — a concert at a church stays community
    for kw in _SECULAR_OVERRIDES:
        if kw in title:
            return False

    # At outdoor/nature venues, only check title — descriptions often
    # mention prayer/worship in historical or incidental context.
    _OUTDOOR_VENUE_TYPES = frozenset({
        "park", "garden", "trail", "amphitheater", "outdoor_venue",
        "farmers_market", "plaza", "recreation", "zoo", "aquarium",
        "nature_center",
    })
    search_text = title if venue_type in _OUTDOOR_VENUE_TYPES else text

    # Strong keyword match in title or description
    for kw in _RELIGIOUS_KEYWORDS:
        if kw in search_text:
            return True

    # Church venue type + church source = religious by default
    if venue_type in RELIGIOUS_VENUE_TYPES:
        if source_slug and source_slug in RELIGIOUS_SOURCES:
            return True

    # Church source with faith/spiritual subcategory
    if source_slug and source_slug in RELIGIOUS_SOURCES:
        sub = (event.get("subcategory") or "").lower()
        if sub in ("faith", "spiritual", "worship", "service"):
            return True

    return False


def infer_is_support_group(
    event: dict,
    source_slug: str | None = None,
) -> bool:
    """
    Infer whether an event is a support group.
    Support groups should be categorized as support_group and marked is_sensitive.
    """
    if event.get("category") == "support_group":
        return True

    if source_slug and source_slug in SUPPORT_GROUP_SOURCES:
        return True

    title = (event.get("title") or "").lower()
    desc = (event.get("description") or "").lower()
    text = f"{title} {desc}"

    for kw in SUPPORT_GROUP_KEYWORDS:
        if kw in text:
            # Short keywords need word-boundary check to avoid false positives
            # e.g. "nami" matching "examination", "na meeting" matching "sauna meeting"
            if len(kw) <= 4:
                import re as _re
                if _re.search(r'\b' + _re.escape(kw) + r'\b', text):
                    return True
            else:
                return True
    return False


# ── Kids activity recategorization ─────────────────────────────────

# Categories where a kids/children signal should override to "family"
_KIDS_RECATEGORIZE_FROM = {"art", "learning", "fitness", "exercise", "recreation", "community", "food"}

_KIDS_TITLE_KEYWORDS = [
    "for kids", "for children", "for toddlers", "for preschool",
    "kids camp", "youth camp", "day camp", "summer camp", "art camp",
    "kindergarten", "pre-k", "prek",
    "kids class", "children's class", "kids workshop",
    "mommy and me", "daddy and me", "parent and child",
    "little artist", "young artist", "tiny artist",
    "kids art", "children's art",
]

_KIDS_AGE_PATTERNS = [
    "ages 3-", "ages 4-", "ages 5-", "ages 6-",
    "ages 2-", "age 3-", "age 4-", "age 5-",
    "grades k-", "grades 1-", "grades pre-",
]


def infer_is_kids_activity(event: dict) -> bool:
    """
    Detect events that are fundamentally kids/family activities miscategorized
    under adult categories (art, learning, fitness, etc.).

    A kindergartners' art camp is a kids event, not an art event.
    "Art" should be reserved for fine art, galleries, and exhibitions.
    """
    category = (event.get("category") or event.get("category_id") or "").lower()
    if category not in _KIDS_RECATEGORIZE_FROM:
        return False

    # Already family — no need to recategorize
    if category == "family":
        return False

    title = (event.get("title") or "").lower()
    desc = (event.get("description") or "").lower()

    # Check title keywords (high confidence)
    for kw in _KIDS_TITLE_KEYWORDS:
        if kw in title:
            return True

    # Check age patterns in title or description
    text = f"{title} {desc}"
    for pattern in _KIDS_AGE_PATTERNS:
        if pattern in text:
            return True

    return False


def infer_is_class(
    event: dict,
    source_slug: str | None = None,
    venue_type: str | None = None,
) -> bool:
    """
    Infer whether an event is a class based on source, venue type, and content.

    Returns True if the event should be marked as a class.
    """
    # Already explicitly set
    if event.get("is_class"):
        return True

    # Known class source
    if source_slug and source_slug in CLASS_SOURCES:
        return True

    # Class venue type (studio, cooking_school, dance_studio)
    if venue_type and venue_type in CLASS_VENUE_TYPES:
        return True

    # Genre match (new taxonomy)
    event_genres = set(event.get("genres") or [])
    class_genres = {
        "workshop",
        "class",
        "cooking-class",
        "yoga",
        "dance",
        "pilates",
        "craft",
    }
    if event_genres & class_genres:
        return True

    # Title/description pattern matching
    title = (event.get("title") or "").lower()
    desc = (event.get("description") or "").lower()
    text = f"{title} {desc}"
    category = (event.get("category") or event.get("category_id") or "").lower()
    if any(pattern in text for pattern in CLASS_TITLE_PATTERNS):
        return True

    # Title-only regex patterns for generic class words — more aggressive but
    # scoped to title to avoid description false positives (e.g. "class act").
    # Skip film category to avoid movie titles like "How to Make a Killing".
    if category != "film":
        if re.search(
            r'\bclass\b(?!ic|\s*act)'   # "class" but not "classic" or "class act"
            r'|\bworkshop\b'
            r'|\bseminar\b'
            r'|\bclinic\b(?!\s*$)'       # "clinic" but not as last word alone
            r'|\bcourse\b(?!\s)'         # "course" — refined below
            r'|\bbootcamp\b'
            r'|\bmaster\s*class\b'
            r'|\bintroduction to\s+\w+'  # "Introduction to Drawing"
            r'|\bintro to\s+\w+'
            r'|\blearn to\s+\w+',
            title,
        ):
            # Exclude support group meetings and non-class uses of these words
            if not re.search(
                r'\bgroup\b|\bmeeting\b|\bfellowship\b'
                r'|\badventure\s+course\b|\bobstacle\s+course\b|\bgolf\s+course\b'
                r'|\bzip\s*line\b',
                title,
            ):
                return True

    return False


def merge_tags(existing: list[str], new: list[str]) -> list[str]:
    """Merge two tag lists, removing duplicates."""
    combined = set(existing or []) | set(new or [])
    valid = [t for t in combined if t in ALL_TAGS]
    return sorted(valid)


def infer_genres(
    event: dict,
    venue_genres: list[str] | None = None,
    venue_vibes: list[str] | None = None,
    venue_type: str | None = None,
) -> list[str]:
    """
    Infer genre slugs from event data (title, description, category, existing genres).

    Uses pattern matching on title/description scoped by category to infer
    the most specific genre(s). Also normalizes any existing genres on the event
    and inherits relevant venue genres. Falls back to venue vibes/type when no
    genres can be inferred from event content.

    Args:
        event: Event dict with title, description, category, genres (optional)
        venue_genres: Optional list of genres from the event's venue
        venue_vibes: Optional list of vibes from the event's venue
        venue_type: Optional venue type string

    Returns:
        Deduplicated list of canonical genre slugs
    """
    genres: set[str] = set()

    # Preserve + normalize existing genres
    existing = event.get("genres") or []
    genres.update(normalize_genres(existing))

    title = (event.get("title") or "").lower()
    desc = (event.get("description") or "").lower()
    category = (event.get("category") or event.get("category_id") or "").lower()
    category_key = "outdoor" if category == "outdoors" else category
    text = f"{title} {desc}"

    # Derive genre from subcategory (e.g. "nightlife.karaoke" → "karaoke")
    subcategory = (event.get("subcategory") or "").lower()
    if "." in subcategory:
        sub_genre = subcategory.split(".", 1)[1].strip().replace("_", "-")
        if sub_genre:
            normalized = normalize_genre(sub_genre)
            if normalized:
                genres.add(normalized)

    # Infer from tags when we have sparse title/description payloads.
    # Keep this category-scoped to avoid cross-domain genre bleed.
    allowed_genres = genres_for_category(category_key)
    tag_overrides = {
        ("fitness", "running"): "run",
        ("fitness", "race"): "run",
        ("fitness", "athletics"): "run",
        ("fitness", "cardio"): "run",
        # exercise/recreation aliases (new category names)
        ("exercise", "running"): "run",
        ("exercise", "race"): "run",
        ("exercise", "athletics"): "run",
        ("exercise", "cardio"): "run",
        ("recreation", "running"): "run",
        ("recreation", "race"): "run",
    }
    for raw_tag in event.get("tags") or []:
        if not isinstance(raw_tag, str):
            continue
        tag_value = raw_tag.strip().lower()
        from_tag = tag_overrides.get((category_key, tag_value)) or normalize_genre(tag_value)
        if not from_tag:
            continue
        if allowed_genres and from_tag not in allowed_genres:
            continue
        genres.add(from_tag)

    # --- Category-specific genre inference ---

    if category == "music":
        # Music: infer from title keywords
        music_patterns: list[tuple[list[str], str]] = [
            (["jazz", "bebop", "swing", "big band", "quartet", "trio"], "jazz"),
            (["blues", "juke joint", "harmonica"], "blues"),
            (
                ["hip hop", "hip-hop", "rap ", "trap", "mc ", "cypher", "freestyle"],
                "hip-hop",
            ),
            (["r&b", "rnb", "neo-soul", "neo soul", "quiet storm"], "r-and-b"),
            (["rock", "guitar", "riff"], "rock"),
            (["indie", "lo-fi", "bedroom pop"], "indie"),
            (["country", "honky-tonk", "honky tonk"], "country"),
            (
                [
                    "folk",
                    "acoustic",
                    "roots",
                    "americana",
                    "bluegrass",
                    "banjo",
                    "mandolin",
                ],
                "folk",
            ),
            (
                ["electronic", "edm", "techno", "trance", "dnb", "dubstep", "synth"],
                "electronic",
            ),
            (["dj ", " dj ", "dj set", "deejay", "turntablist"], "electronic"),
            (["pop ", "top 40", "chart"], "pop"),
            (["soul", "funk", "motown", "disco", "groove", "boogie"], "soul"),
            (
                ["metal", "death ", "doom", "thrash", "hardcore", "mosh", "shred"],
                "metal",
            ),
            (["punk", "emo", "ska"], "punk"),
            (
                [
                    "latin",
                    "salsa",
                    "bachata",
                    "reggaeton",
                    "cumbia",
                    "merengue",
                    "afrobeat",
                ],
                "latin",
            ),
            (
                [
                    "symphony",
                    "orchestra",
                    "chamber",
                    "philharmonic",
                    "concerto",
                    "sonata",
                ],
                "classical",
            ),
            (["opera", "soprano", "aria", "libretto", "operetta"], "opera"),
            (["reggae", "dancehall", "dub "], "reggae"),
            (["gospel", "praise", "worship", "ccm"], "gospel"),
            (["cover band", "tribute"], "cover"),
            (["open mic", "open-mic", "openmic"], "open-mic"),
            (["singer-songwriter", "singer/songwriter"], "singer-songwriter"),
            (["brunch", "jazz brunch", "gospel brunch", "sunday brunch"], "brunch"),
        ]
        for keywords, genre in music_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "film":
        film_patterns: list[tuple[list[str], str]] = [
            (["documentary", "doc ", "true story", "real-life"], "documentary"),
            (["horror", "scary", "slasher", "zombie", "haunted"], "horror"),
            (
                ["sci-fi", "science fiction", "space", "alien", "dystopia", "fantasy"],
                "sci-fi",
            ),
            (
                ["animation", "animated", "anime", "pixar", "ghibli", "cartoon"],
                "animation",
            ),
            (["thriller", "mystery", "noir", "suspense", "heist"], "thriller"),
            (
                ["indie", "arthouse", "art house", "independent", "sundance", "a24"],
                "indie",
            ),
            (["classic", "repertory", "revival", "35mm", "cult"], "classic"),
            (["foreign", "subtitled", "international", "bollywood"], "foreign"),
            (["romance", "love story", "rom-com", "romcom", "valentine"], "romance"),
            (["action", "adventure", "superhero", "marvel", "dc "], "action"),
            (["comedy", "funny", "parody", "satire"], "comedy"),
            (["drama", "biopic", "period"], "drama"),
        ]
        for keywords, genre in film_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "comedy":
        comedy_patterns: list[tuple[list[str], str]] = [
            (
                ["open mic", "open-mic", "openmic", "amateur night", "new material"],
                "open-mic",
            ),
            (["improv", "improvisation", "audience suggestion", "yes and"], "improv"),
            (["sketch", "variety show", "comedy revue"], "sketch"),
            (["roast", "roast battle"], "roast"),
            (["moth", "story slam", "storytelling", "monologue"], "storytelling"),
            (
                [
                    "stand-up",
                    "stand up",
                    "standup",
                    "comedy special",
                    "headliner",
                    "comedian",
                ],
                "stand-up",
            ),
        ]
        for keywords, genre in comedy_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)
        # Default to stand-up if no genre matched and it's clearly a comedy show
        if not genres and "comedy" in title:
            genres.add("stand-up")

    elif category == "theater":
        theater_patterns: list[tuple[list[str], str]] = [
            (["musical", "broadway", "tony", "soundtrack", "songbook"], "musical"),
            (["ballet", "nutcracker", "dance company", "choreograph"], "ballet"),
            (["opera", "soprano", "aria", "libretto", "operetta"], "opera"),
            (
                ["immersive", "interactive", "site-specific", "choose your own"],
                "immersive",
            ),
            (["spoken word", "poetry slam", "verse"], "spoken-word"),
            (["burlesque", "cabaret", "vaudeville"], "burlesque"),
            (["puppet", "marionette", "shadow puppet"], "puppet"),
            (["shakespeare", "hamlet", "romeo", "othello", "macbeth"], "shakespeare"),
            (["play", "drama", "tragedy", "premiere", "playwright"], "drama"),
            (["comedy", "farce", "hilarious", "witty"], "comedy"),
        ]
        for keywords, genre in theater_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "dance":
        dance_patterns: list[tuple[list[str], str]] = [
            (
                ["ballet", "nutcracker", "pointe", "barre", "pas de", "grand jeté",
                 "classical ballet", "ballet company", "ballet theatre", "ballet theater"],
                "ballet",
            ),
            (
                ["contemporary", "modern dance", "modern ballet", "postmodern",
                 "contemporary dance", "contemporary ballet"],
                "contemporary",
            ),
            (
                ["afro", "afrocentric", "african dance", "afro-haitian", "west african"],
                "afrocentric",
            ),
            (
                ["hip-hop", "hip hop", "street dance", "breaking", "breakdance"],
                "hip-hop",
            ),
            (
                ["flamenco", "tango", "salsa", "bachata", "cumbia", "latin dance"],
                "latin",
            ),
            (
                ["ballroom", "waltz", "foxtrot", "cha cha", "swing dance", "east coast swing",
                 "west coast swing"],
                "ballroom",
            ),
            (
                ["social dance", "social dancing", "partner dance"],
                "social-dance",
            ),
        ]
        for keywords, genre in dance_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)
        # If no specific genre matched, default to ballet (canonical performing dance)
        if not genres:
            genres.add("ballet")

    elif category == "sports":
        sports_patterns: list[tuple[list[str], str]] = [
            (["braves", "baseball", "mlb", "softball", "batting"], "baseball"),
            (["hawks", "basketball", "nba", "ncaa basketball", "hoops", "pickup basketball", "pick-up basketball"], "basketball"),
            (["falcons", "football", "nfl", "sec ", "touchdown", "flag football", "pickup football", "pick-up football"], "football"),
            (["united", "soccer", "mls", "nwsl", "fc ", "futbol", "pickup soccer", "pick-up soccer", "futsal"], "soccer"),
            (["hockey", "nhl", "gladiators", "puck"], "hockey"),
            (["ufc", "mma", "boxing", "fight night", "bout", "knockout"], "mma"),
            (["nascar", "racing", "motorsport", "grand prix", "derby"], "racing"),
            (["golf", "pga", "tour championship", "scramble"], "golf"),
            (["tennis", "atp", "wta", "serve", "court"], "tennis"),
            (
                ["marathon", "5k", "10k", "half-marathon", "road race", "fun run"],
                "running",
            ),
            (["esports", "gaming", "league of legends", "valorant"], "esports"),
            (["roller derby", "rollergirls", "bout"], "roller-derby"),
            (["wrestling"], "wrestling"),
            (["volleyball", "pickup volleyball", "pick-up volleyball"], "volleyball"),
            (["lacrosse"], "lacrosse"),
            (["pickleball"], "pickleball"),
        ]
        for keywords, genre in sports_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category in ("exercise", "fitness"):
        fitness_patterns: list[tuple[list[str], str]] = [
            (["yoga", "vinyasa", "hot yoga", "yin", "asana", "namaste"], "yoga"),
            (
                ["run club", "group run", "trail run", "pace group", "runners", "5k", "10k", "half-marathon", "half marathon", "fun run",
                 "walk club", "walking club", "group walk", "power walk", "walk group", "ruck club", "ruck march", "rucking"],
                "run",
            ),
            (["spin", "cycling", "bike ride", "peloton", "criterium"], "cycling"),
            (
                ["dance class", "salsa", "bachata", "swing dance", "two-step", "zumba"],
                "dance",
            ),
            (["hike", "trail walk", "nature walk", "guided hike"], "hike"),
            (
                ["crossfit", "wod", "hiit", "bootcamp", "burpee", "functional"],
                "crossfit",
            ),
            (
                [
                    "bjj",
                    "karate",
                    "muay thai",
                    "krav maga",
                    "self-defense",
                    "jiu-jitsu",
                ],
                "martial-arts",
            ),
            (["pilates", "reformer", "barre", "core work"], "pilates"),
            (["swim", "lap swim", "open water", "aqua", "pool"], "swimming"),
            (["climbing", "bouldering", "belay", "top rope", "send"], "climbing"),
        ]
        for keywords, genre in fitness_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "recreation":
        recreation_patterns: list[tuple[list[str], str]] = [
            (["pickleball"], "pickleball"),
            (["cornhole", "corn hole"], "cornhole"),
            (["axe throwing", "axe-throwing", "hatchet"], "axe-throwing"),
            (["softball"], "softball"),
            (["volleyball", "pick-up volleyball", "pickup volleyball"], "volleyball"),
            (["swim", "lap swim", "open water", "aqua", "pool"], "swimming"),
            (["marathon", "full marathon"], "marathon"),
            (["triathlon", "tri "], "triathlon"),
            (["cycling", "bike ride", "group ride", "criterium"], "cycling"),
            (["crossfit", "wod", "hiit", "bootcamp", "functional"], "crossfit"),
            (["running", "run club", "fun run", "5k", "10k", "road race"], "running"),
            (["open play", "open gym", "drop-in", "drop in"], "open-play"),
            (["pickup", "pick-up", "pick up"], "pickup"),
            (["rec league", "recreational league", "league play"], "league"),
            (["adaptive", "para sport", "wheelchair sport"], "adaptive-sports"),
            (["batting cage", "batting cages"], "batting-cage"),
        ]
        for keywords, genre in recreation_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "food_drink":
        food_patterns: list[tuple[list[str], str]] = [
            (
                [
                    "southern",
                    "soul food",
                    "bbq",
                    "barbecue",
                    "cajun",
                    "creole",
                    "biscuit",
                ],
                "southern",
            ),
            (["mexican", "tacos", "mezcal", "tequila", "margarita"], "mexican"),
            (["italian", "pasta", "pizza", "trattoria", "risotto"], "italian"),
            (
                [
                    "sushi",
                    "ramen",
                    "dim sum",
                    "pho",
                    "curry",
                    "bibimbap",
                    "thai",
                    "korean",
                ],
                "asian",
            ),
            (["brunch", "bottomless", "mimosa", "bloody mary"], "brunch"),
            (
                [
                    "wine tasting",
                    "wine pairing",
                    "sommelier",
                    "natural wine",
                    "vineyard",
                    "wine night",
                    "wine wednesday",
                    "wine down",
                ],
                "wine",
            ),
            (
                [
                    "craft beer",
                    "brewery",
                    "taproom",
                    "ipa",
                    "stout",
                    "ale",
                    "lager",
                    "brew",
                ],
                "beer",
            ),
            (["cocktail", "mixology", "spirits", "bartend", "aperitif"], "cocktails"),
            (
                ["coffee", "latte", "espresso", "barista", "cupping", "pour-over"],
                "coffee",
            ),
            (["pop-up", "popup", "supper club", "guest chef", "one-night"], "pop-up"),
            (["tasting", "pairing", "flight", "prix fixe", "multi-course"], "tasting"),
            (
                [
                    "cooking class",
                    "baking class",
                    "culinary",
                    "hands-on",
                    "from scratch",
                ],
                "cooking-class",
            ),
            (
                ["food fest", "farmers market", "food truck", "night market"],
                "food-festival",
            ),
            (
                ["seafood", "oyster", "crawfish", "crab", "shrimp", "fish fry"],
                "seafood",
            ),
            (
                ["happy hour", "drink special", "half-price drink",
                 "industry night", "after-work"],
                "happy-hour",
            ),
            (
                ["wing night", "wing wednesday", "taco tuesday", "burger night",
                 "half off", "half-price", "dollar oyster", "$1 oyster",
                 "all you can", "prix fixe", "specials"],
                "specials",
            ),
        ]
        for keywords, genre in food_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "art":
        art_patterns: list[tuple[list[str], str]] = [
            (
                [
                    "exhibition",
                    "exhibit",
                    "gallery show",
                    "retrospective",
                    "collection",
                ],
                "exhibition",
            ),
            (
                ["opening reception", "first friday", "art walk", "gallery night"],
                "gallery-opening",
            ),
            (["photography", "photo exhibit", "darkroom", "portrait"], "photography"),
            (["sculpture", "installation", "outdoor art", "public art"], "sculpture"),
            (
                ["mural", "graffiti", "street art", "live painting", "wheatpaste"],
                "street-art",
            ),
            (
                [
                    "pottery",
                    "ceramics",
                    "weaving",
                    "printmaking",
                    "letterpress",
                    "craft",
                ],
                "craft",
            ),
            (
                ["digital art", "new media", "projection", "video art", "generative"],
                "digital",
            ),
            (["performance art", "happening", "durational", "body art"], "performance"),
            (["art market", "maker fair", "craft fair", "handmade"], "market"),
        ]
        # Museum-specific patterns (merged from duplicate art block)
        museum_patterns: list[tuple[list[str], str]] = [
            (
                ["science", "stem", "planetarium", "observatory", "dinosaur", "fossil"],
                "science",
            ),
            (
                ["history", "historic", "civil war", "civil rights", "heritage", "archive"],
                "history",
            ),
            (
                ["children", "kids", "family day", "youth", "storytime"],
                "children",
            ),
            (
                ["cultural", "culture", "indigenous", "african", "diaspora"],
                "cultural",
            ),
            (
                ["opening reception", "first friday", "art walk", "member preview"],
                "opening",
            ),
            (
                ["lecture", "talk", "panel", "symposium", "curator"],
                "lecture",
            ),
            (["workshop", "hands-on", "craft", "make your own"], "workshop"),
            (["tour", "guided", "docent", "walkthrough"], "tour"),
        ]
        for keywords, genre in art_patterns + museum_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "nightlife":
        nightlife_patterns: list[tuple[list[str], str]] = [
            (["dj", "club night", "dance floor", " set ", "spinning", "remix", "mixtape", "mixed tape"], "dj"),
            (["drag", "drag show", "queen", "pageant", "lip sync", "tossed salad"], "drag"),
            (["trivia", "quiz night", "pub quiz", "team trivia"], "trivia"),
            (["karaoke", "sing-along", "noraebang", "mic night"], "karaoke"),
            (
                ["dance party", "80s night", "90s night", "silent disco", "throwback"],
                "dance-party",
            ),
            (["poker", "texas hold", "hold 'em", "holdem", "freeroll", "card tournament"], "poker"),
            (["bingo", "drag bingo", "music bingo", "b-i-n-g-o"], "bingo"),
            (["board game", "game night", "community game"], "game-night"),
            (["arcade", "darts", "shuffleboard", "cornhole", "bocce", "skee-ball", "ping pong", "pool tournament", "billiards"], "bar-games"),
            (["pub crawl", "bar crawl", "brewery crawl", "brewery tour", "beer tour"], "pub-crawl"),
            (["happy hour", "drink special", "industry night", "ladies night",
              "thirsty thursday", "bottomless"], "happy-hour"),
            (["taco tuesday", "wing night", "crab night",
              "oyster night", "wing wednesday",
              "burger night", "half off", "half-price",
              "all you can", "prix fixe"], "specials"),
            (
                ["latin night", "salsa night", "bachata", "reggaeton", "cumbia",
                 "merengue", "noche latina", "noche de", "tropical night"],
                "latin-night",
            ),
            (["line dancing", "line dance", "two-step", "two step", "honky tonk", "country night", "boot scoot"], "line-dancing"),
            (["burlesque", "cabaret", "variety show", "vaudeville"], "burlesque"),
            (["brunch", "bottomless brunch", "boozy brunch", "drag brunch", "jazz brunch", "sunday brunch"], "brunch"),
            (["wine night", "wine down", "wine bar"], "wine-night"),
            (
                ["speakeasy", "cocktail party", "mixology", "craft cocktail"],
                "cocktail-night",
            ),
            (["open mic", "open-mic", "openmic", "poetry slam"], "open-mic"),
            (
                ["game day", "watch party", "viewing party", "football",
                 "monday night", "thursday night", "super bowl", "big game"],
                "viewing-party",
            ),
            (
                ["d&d", "dungeons", "mtg", "magic the gathering", "ttrpg",
                 "tabletop", "adventurers league", "warhammer", "pathfinder"],
                "nerd-stuff",
            ),
        ]
        for keywords, genre in nightlife_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "learning":
        learning_patterns: list[tuple[list[str], str]] = [
            (["workshop", "hands-on", "make your own", "build", "create"], "workshop"),
            (["class", "course", "session", "week series", "instruction"], "class"),
            (["lecture", "talk", "keynote", "speaker", "presents"], "lecture"),
            (["seminar", "panel", "conference", "summit", "symposium"], "seminar"),
            (
                ["book club", "reading group", "book discussion", "author q&a"],
                "book-club",
            ),
            (["tour", "walking tour", "guided", "behind-the-scenes"], "tour"),
            (
                ["screening", "film discussion", "watch party", "documentary night"],
                "film-screening",
            ),
            (
                ["language exchange", "conversation", "practice", "spanish", "french"],
                "language",
            ),
        ]
        for keywords, genre in learning_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "community":
        community_patterns: list[tuple[list[str], str]] = [
            (
                ["volunteer", "cleanup", "service", "giving back", "habitat"],
                "volunteer",
            ),
            (["meetup", "social", "mixer", "newcomers", "new in town"], "meetup"),
            (["networking", "professional", "career", "industry"], "networking"),
            (
                ["pride", "lgbtq", "queer", "trans", "gay", "lesbian", "rainbow"],
                "lgbtq",
            ),
            (
                [
                    "faith",
                    "spiritual",
                    "worship",
                    "prayer",
                    "bible study",
                    "torah",
                    "dharma",
                    "puja",
                    "vespers",
                    "shabbat",
                ],
                "faith",
            ),
            (["interfaith", "multifaith", "multi-faith"], "interfaith"),
            (
                ["meditation", "mindfulness", "zazen", "contemplative", "sound bath"],
                "meditation",
            ),
            (
                [
                    "rally",
                    "town hall",
                    "march",
                    "protest",
                    "advocacy",
                    "civic engagement",
                    "organizing",
                    "phone bank",
                    "canvass",
                    "voter registration",
                ],
                "activism",
            ),
            (
                ["support group", "recovery", "nami", "grief", "wellness circle"],
                "support",
            ),
            (
                [
                    "cultural",
                    "heritage",
                    "diwali",
                    "lunar new year",
                    "diaspora",
                    "eid",
                    "passover",
                    "purim",
                    "holi",
                    "navaratri",
                    "losar",
                    "vaisakhi",
                    "chanukah",
                    "hanukkah",
                    "juneteenth",
                ],
                "cultural",
            ),
            (["board game", "game night", "community game"], "game-night"),
            (["open mic", "open-mic", "openmic", "poetry slam"], "open-mic"),
            (
                ["d&d", "dungeons", "mtg", "magic the gathering", "ttrpg",
                 "tabletop", "adventurers league", "warhammer", "pathfinder"],
                "nerd-stuff",
            ),
        ]
        for keywords, genre in community_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "family":
        family_patterns: list[tuple[list[str], str]] = [
            (["storytime", "story hour", "read-aloud", "story time"], "storytime"),
            (["craft", "art project", "make your own", "diy", "painting"], "crafts"),
            (["science", "stem", "experiment", "discovery"], "science"),
            (
                ["nature walk", "animal", "zoo", "garden", "wildlife", "butterfly"],
                "nature",
            ),
            (["puppet", "marionette", "puppet show"], "puppet-show"),
            (
                ["festival", "fair", "carnival", "hayride", "pumpkin", "egg hunt"],
                "festival",
            ),
            (
                ["kids concert", "sing-along", "music class", "toddler", "little"],
                "music-for-kids",
            ),
            (["play day", "splash pad", "playground", "field day"], "outdoor-play"),
            (
                ["game night", "board game", "d&d", "dungeons", "tabletop",
                 "magic the gathering", "mtg", "ttrpg", "pokemon"],
                "game-night",
            ),
        ]
        for keywords, genre in family_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "outdoors":
        outdoor_patterns: list[tuple[list[str], str]] = [
            (["park", "picnic", "lawn", "green space"], "parks"),
            (["garden", "botanical", "plant", "bloom", "flower"], "garden"),
            (
                ["market", "flea market", "artisan", "vendor", "outdoor market"],
                "market",
            ),
            (
                ["tour", "sightseeing", "scenic", "overlook", "walk", "beltline"],
                "sightseeing",
            ),
            (["kayak", "paddle", "canoe", "river", "lake", "water"], "water"),
            (["camping", "stargazing", "campfire", "overnight"], "camping"),
            (["adventure", "zip line", "ropes course", "obstacle"], "adventure"),
        ]
        for keywords, genre in outdoor_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "words":
        words_patterns: list[tuple[list[str], str]] = [
            (["reading", "signing", "book launch", "author event"], "reading"),
            (["poetry", "slam", "spoken word", "verse", "poem"], "poetry"),
            (["book club", "reading group", "book discussion"], "book-club"),
            (["storytelling", "story slam", "moth", "narrative"], "storytelling"),
            (
                ["writing workshop", "nanowrimo", "critique", "fiction writing"],
                "writing",
            ),
            (["comic", "zine", "graphic novel", "manga"], "comics"),
            (["book festival", "literary fest", "book fair"], "literary-festival"),
        ]
        for keywords, genre in words_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "wellness":
        wellness_patterns: list[tuple[list[str], str]] = [
            (
                ["a.a.", "alcoholics anonymous", "12 step", "twelve step",
                 "sober", "sobriety", "recovery", "al-anon", "alanon",
                 "celebrate recovery", "step study", "big book",
                 "speaker meeting", "open discussion"],
                "recovery",
            ),
            (
                ["narcotics anonymous", "n.a.", "clean time", "just for today"],
                "recovery",
            ),
            (["yoga", "vinyasa", "hot yoga", "yin ", "asana", "namaste"], "yoga"),
            (["meditation", "mindfulness", "zazen", "contemplative", "vipassana"], "meditation"),
            (["breathwork", "pranayama", "breath work", "holotropic"], "breathwork"),
            (["sound bath", "sound healing", "gong bath", "singing bowl"], "sound-bath"),
            (["reiki", "energy healing", "chakra", "crystal healing"], "reiki"),
            (["support group", "grief", "nami", "wellness circle"], "support"),
            (["therapy", "counseling", "cbt ", "dbt "], "therapy"),
        ]
        for keywords, genre in wellness_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "meetup":
        meetup_patterns: list[tuple[list[str], str]] = [
            (
                ["hike", "hiking", "trail", "summit", "mountain",
                 "nature walk", "waterfall", "creek"],
                "hiking",
            ),
            (["book club", "book & brew", "reading group", "book session"], "book-club"),
            (
                ["foodie", "eat & explore", "food tour", "restaurant",
                 "dinner", "brunch", "tasting"],
                "foodie",
            ),
            (["camping", "campfire", "campground", "glamping", "overnight"], "camping"),
            (["tennis", "pickleball", "volleyball", "basketball", "soccer"], "recreation"),
            (["dance", "salsa", "bachata", "swing", "two-step", "heels"], "dance"),
            (["photo walk", "photography", "camera", "shoot"], "photography"),
            (["language exchange", "spanish", "french", "conversation"], "language"),
            (["networking", "professional", "career", "industry"], "networking"),
            (["singles", "speed dating", "mingle", "mixer"], "singles"),
            (["kayak", "paddle", "canoe", "float"], "outdoors"),
        ]
        for keywords, genre in meetup_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)
        # Fallback: check tags for hiking signal (very common in meetups)
        if not genres:
            meetup_tags = set(event.get("tags") or [])
            if "hiking" in meetup_tags:
                genres.add("hiking")

    elif category == "gaming":
        gaming_patterns: list[tuple[list[str], str]] = [
            (["expo", "convention", "con ", "fest"], "convention"),
            (["esports", "tournament", "competitive", "dreamhack", "lan"], "esports"),
            (["arcade", "pinball", "retro game", "classic game"], "arcade"),
            (["tabletop", "board game", "d&d", "rpg", "warhammer"], "tabletop"),
            (["anime", "cosplay", "manga", "otaku"], "anime"),
            (["retro", "classic", "8-bit", "pixel"], "retro"),
        ]
        for keywords, genre in gaming_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    # --- Cross-category title signals (block wrong venue genre inheritance) ---
    # When category-specific patterns miss (e.g. karaoke event miscategorized as
    # "music"), these catch unambiguous activity keywords and set the genre before
    # venue inheritance can fill in something wrong.
    if not genres:
        _cross_category_signals: list[tuple[list[str], str]] = [
            (["karaoke", "sing-along", "singalong", "noraebang"], "karaoke"),
            (["trivia", "pub quiz", "quiz night"], "trivia"),
            (["drag show", "drag brunch", "drag bingo"], "drag"),
            (["bingo night", "music bingo"], "bingo"),
            (["open mic", "open-mic", "openmic"], "open-mic"),
        ]
        for keywords, genre in _cross_category_signals:
            if any(kw in text for kw in keywords):
                genres.add(genre)
                break

    # --- Inherit venue genres (if event is at a jazz bar, it's likely jazz-related) ---
    # Scoped to the event's category to prevent cross-domain bleed (e.g. a doom metal
    # show at 529 should not inherit `comedy`/`trivia`/`stand-up` just because 529
    # also hosts those programming types).
    if venue_genres:
        normalized_venue = normalize_genres(venue_genres)
        # Only inherit if event has no genres yet (don't override explicit genres)
        if not genres and normalized_venue:
            allowed = genres_for_category(category_key)
            if allowed:
                scoped = [g for g in normalized_venue if g in allowed]
                genres.update(scoped)
            else:
                # No defined genre set for this category — don't blindly
                # inherit all venue genres (a multi-purpose venue like a
                # bar/restaurant could have jazz, dj, trivia, karaoke, etc.)
                pass

    # --- Fallback: infer from venue vibes/type when no genres found ---
    if not genres and (venue_vibes or venue_type):
        vibe_genre_map = {
            "paint-and-sip": "craft",
            "painting": "craft",
            "pottery": "craft",
            "crafts": "craft",
            "karaoke": "karaoke",
            "trivia": "trivia",
            "drag": "drag",
            "burlesque": "burlesque",
            "open-mic": "open-mic",
            "comedy": "stand-up",
            "jazz": "jazz",
            "blues": "blues",
            "dj": "dj",
            "latin-dance": "latin-night",
            "salsa": "latin-night",
            "hip-hop": "hip-hop",
            "country": "country",
            "board-games": "game-night",
            "arcade": "game-night",
            "yoga": "yoga",
            "fitness": "crossfit",
            "meditation": "meditation",
            "wine": "wine",
            "wine-tasting": "wine",
            "beer-tasting": "beer",
            "craft-beer": "beer",
            "cocktails": "cocktails",
        }
        type_genre_map = {
            "comedy_club": "stand-up",
            "gallery": "exhibition",
            "brewery": "beer",
            "winery": "wine",
            "distillery": "cocktails",
            "yoga_studio": "yoga",
            "fitness_center": "crossfit",
            "record_store": "indie",
            "bookstore": "reading",
            "farmers_market": "farmers-market",
        }
        for vibe in (venue_vibes or []):
            if vibe in vibe_genre_map:
                genres.add(vibe_genre_map[vibe])
        if not genres and venue_type and venue_type in type_genre_map:
            genres.add(type_genre_map[venue_type])

    # --- Last resort: source-level default genres ---
    # Some sources are monolithic — every event is the same genre.
    # Only applies when no genres were inferred from content.
    if not genres:
        source_id = event.get("source_id")
        if source_id:
            _SOURCE_DEFAULT_GENRES: dict[int, list[str]] = {
                # Recovery
                851: ["recovery"],   # Alcoholics Anonymous - Atlanta
                854: ["recovery"],   # Narcotics Anonymous - Georgia
                # Health / support
                911: ["support"],    # Shepherd Center (rehab hospital)
                906: ["wellness-class"],  # Emory Healthcare Community Events
                913: ["support"],    # Cancer Support Community Atlanta
                974: ["support"],    # Pulmonary Fibrosis Foundation
                967: ["support"],    # Respite Care Atlanta
                956: ["support"],    # The Warrior Alliance (veterans)
                # Art / craft
                554: ["craft"],      # Painting With a Twist
            }
            defaults = _SOURCE_DEFAULT_GENRES.get(int(source_id))
            if defaults:
                genres.update(defaults)

    return sorted(genres)
