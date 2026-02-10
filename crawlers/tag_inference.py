"""
Tag inference logic for Lost City events.
Automatically assigns tags based on event data and venue vibes.
Also infers genres from event title/description using the unified taxonomy.
"""

from __future__ import annotations

from typing import Optional
from tags import INHERITABLE_VIBES, VIBE_TO_TAG, ALL_TAGS, GENRE_TO_TAGS
from genre_normalize import normalize_genres, VALID_GENRES


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
    category = (event.get("category") or "").lower()

    # --- Inherit relevant vibes from venue ---
    if venue_vibes:
        for vibe in venue_vibes:
            if vibe in INHERITABLE_VIBES:
                tag = VIBE_TO_TAG.get(vibe, vibe)
                tags.add(tag)

    # --- Infer from venue type ---
    if venue_type:
        # 21+ venues
        if venue_type in ("bar", "nightclub", "brewery", "distillery", "wine_bar",
                          "cocktail_bar", "lounge"):
            tags.add("21+")

        # Outdoor venues
        if venue_type in ("park", "amphitheater", "farmers_market", "plaza",
                          "garden", "outdoor_venue", "trail"):
            tags.add("outdoor")

        # Family-friendly venues (unless it's a 21+ category event)
        if venue_type in ("library", "museum", "park", "community_center",
                          "bookstore", "recreation", "zoo", "aquarium"):
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

    # --- Infer from category ---
    if category == "comedy":
        tags.add("date-night")
    if category == "theater":
        tags.add("date-night")
    if category == "film":
        tags.add("date-night")
    if category in ("sports", "fitness"):
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
    if any(phrase in text for phrase in [
        "album release", "record release", "new album", "ep release",
        "single release", "release party", "release show"
    ]):
        tags.add("album-release")

    # Touring artists
    if any(phrase in text for phrase in [
        "tour", "touring", "on tour", "world tour", "national tour",
        "north american tour"
    ]):
        tags.add("touring")

    # Debuts/premieres
    if any(phrase in text for phrase in [
        "premiere", "debut", "first time", "world premiere",
        "atlanta premiere", "southeast premiere"
    ]):
        tags.add("debut")

    # Sold out
    if any(phrase in text for phrase in ["sold out", "soldout", "sold-out"]):
        tags.add("sold-out")

    # Family friendly
    if any(phrase in text for phrase in [
        "kids", "children", "family", "all ages welcome",
        "bring the kids", "kid-friendly", "child-friendly"
    ]):
        tags.add("family-friendly")

    # Age restrictions
    if any(phrase in text for phrase in [
        "21+", "21 and over", "ages 21", "21 & over", "21 and up",
        "must be 21", "over 21"
    ]):
        tags.add("21+")

    if any(phrase in text for phrase in [
        "all ages", "all-ages", "any age", "open to all ages"
    ]):
        tags.add("all-ages")

    # Opening/closing nights
    if any(phrase in text for phrase in ["opening night", "opening weekend"]):
        tags.add("opening-night")

    if any(phrase in text for phrase in [
        "final performance", "closing night", "last chance",
        "final show", "last performance", "closing weekend"
    ]):
        tags.add("closing-night")

    # One night only
    if any(phrase in text for phrase in [
        "one night only", "one-night-only", "single performance",
        "one night", "special engagement"
    ]):
        tags.add("one-night-only")

    # Outdoor events
    if any(phrase in text for phrase in [
        "outdoor", "outside", "lawn", "patio", "rooftop",
        "under the stars", "open air"
    ]):
        tags.add("outdoor")

    # RSVP required — check for negations first
    rsvp_negations = [
        "no rsvp", "rsvp not required", "rsvp not needed",
        "no registration", "no sign up", "no signup",
        "walk-in", "walk in welcome", "drop-in", "drop in",
        "just show up", "no reservation",
    ]
    has_rsvp_negation = any(phrase in text for phrase in rsvp_negations)

    if not has_rsvp_negation and any(phrase in text for phrase in [
        "rsvp required", "rsvp to", "rsvp at", "rsvp here",
        "registration required", "must register", "must rsvp",
        "sign up required", "reserve your spot", "register now",
        "register to attend", "registration is required",
    ]):
        tags.add("rsvp-required")

    # Limited seating
    if any(phrase in text for phrase in [
        "limited seating", "limited capacity", "small venue",
        "intimate setting", "limited tickets", "only 50", "only 100"
    ]):
        tags.add("limited-seating")

    # Holiday detection
    holidays = [
        "christmas", "halloween", "thanksgiving", "valentine",
        "new year", "easter", "july 4", "fourth of july",
        "memorial day", "labor day", "juneteenth", "mlk day",
        "martin luther king", "independence day", "st. patrick",
        "cinco de mayo", "mardi gras"
    ]
    if any(holiday in text for holiday in holidays):
        tags.add("holiday")

    # Seasonal
    seasonal_terms = [
        "summer series", "winter series", "fall festival",
        "spring festival", "holiday season", "seasonal"
    ]
    if any(term in text for term in seasonal_terms):
        tags.add("seasonal")

    # --- Experiential tags (harder to infer, be conservative) ---

    # High energy indicators
    high_energy_terms = [
        "dance party", "rave", "edm", "dj set", "club night",
        "bass", "techno", "house music"
    ]
    if any(term in text for term in high_energy_terms):
        tags.add("high-energy")

    # Chill indicators
    chill_terms = [
        "acoustic", "singer-songwriter", "jazz brunch",
        "wine tasting", "listening room", "unplugged"
    ]
    if any(term in text for term in chill_terms):
        tags.add("chill")

    # Intimate indicators
    intimate_terms = [
        "acoustic", "unplugged", "intimate", "solo", "reading",
        "poetry", "spoken word", "open mic", "songwriter",
        "candlelight"
    ]
    if any(term in text for term in intimate_terms):
        tags.add("intimate")

    # Date night indicators
    date_night_terms = [
        "jazz", "wine", "tasting", "cocktail", "acoustic",
        "candlelight", "couples", "date night", "romantic",
        "duo", "quartet", "piano", "soul", "r&b", "bossa",
        "blues", "prix fixe", "dinner", "supper club"
    ]
    if any(term in text for term in date_night_terms):
        tags.add("date-night")

    # Educational indicators
    educational_terms = [
        "workshop", "class", "lecture", "seminar", "talk",
        "panel", "author", "book signing", "masterclass",
        "tutorial", "exhibit"
    ]
    if any(term in text for term in educational_terms):
        tags.add("educational")

    # Infer experiential tags from genres
    for genre in (genres or event.get("genres") or []):
        for gt in GENRE_TO_TAGS.get(genre, []):
            tags.add(gt)

    # Filter to only valid tags
    valid_tags = [t for t in tags if t in ALL_TAGS]

    return sorted(valid_tags)


# Known class sources — events from these sources are always classes
CLASS_SOURCES = {
    "painting-with-a-twist", "sur-la-table", "williams-sonoma",
    "arthur-murray-atlanta", "atlanta-dance-ballroom",
    "atlanta-clay-works", "mudfire", "spruill-center",
    "irwin-street-cooking", "publix-aprons", "cooks-warehouse",
    # Dance studios
    "academy-ballroom", "ballroom-impact", "dancing4fun",
    "salsa-atlanta", "pasofino-dance",
    # Yoga studios
    "highland-yoga", "dancing-dogs-yoga", "evolation-yoga",
    "vista-yoga", "yonder-yoga",
    # Makerspaces
    "decatur-makers", "maker-station", "janke-studios",
    "freeside-atlanta",
    # Arts centers
    "chastain-arts-center", "chastain-arts",
    # Healthcare classes
    "piedmont-classes",
    # New class venues
    "candlelit-atl", "rockler-woodworking", "halls-floral",
    "rei-atlanta", "all-fired-up-art", "stone-summit",
}

# Class studio venue types
CLASS_VENUE_TYPES = {"studio", "cooking_school", "dance_studio"}

# Title/description patterns that indicate a class
CLASS_TITLE_PATTERNS = [
    "cooking class", "pottery class", "painting class", "dance class",
    "dance lesson", "yoga class", "art workshop", "craft workshop",
    "woodworking class", "candle making", "flower arranging",
    "floral design", "photography class", "sewing class",
    "ceramics class", "wheel throwing", "glass blowing",
    "paint and sip", "paint & sip", "paint-and-sip",
    "hands-on class", "hands on class", "masterclass",
    "beginner class", "intermediate class", "advanced class",
    # Online / virtual courses
    "online course", "(online course)", "virtual course",
    "online workshop", "virtual workshop", "webinar",
    "certification course", "certificate program",
]


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
    class_genres = {"workshop", "class", "cooking-class", "yoga", "dance", "pilates", "craft"}
    if event_genres & class_genres:
        return True

    # Subcategory match (legacy, kept for transition)
    subcategory = event.get("subcategory") or ""
    class_subcategories = {
        "learning.workshop", "learning.class", "art.workshop",
        "arts.workshop", "art.class", "food_drink.class",
        "fitness.yoga", "fitness.class", "fitness.dance",
    }
    if subcategory in class_subcategories:
        return True

    # Title/description pattern matching
    title = (event.get("title") or "").lower()
    desc = (event.get("description") or "").lower()
    text = f"{title} {desc}"
    if any(pattern in text for pattern in CLASS_TITLE_PATTERNS):
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
) -> list[str]:
    """
    Infer genre slugs from event data (title, description, category, existing genres).

    Uses pattern matching on title/description scoped by category to infer
    the most specific genre(s). Also normalizes any existing genres on the event
    and inherits relevant venue genres.

    Args:
        event: Event dict with title, description, category, genres (optional)
        venue_genres: Optional list of genres from the event's venue

    Returns:
        Deduplicated list of canonical genre slugs
    """
    genres: set[str] = set()

    # Preserve + normalize existing genres
    existing = event.get("genres") or []
    genres.update(normalize_genres(existing))

    title = (event.get("title") or "").lower()
    desc = (event.get("description") or "").lower()
    category = (event.get("category") or "").lower()
    text = f"{title} {desc}"

    # --- Category-specific genre inference ---

    if category == "music":
        # Music: infer from title keywords
        music_patterns: list[tuple[list[str], str]] = [
            (["jazz", "bebop", "swing", "big band", "quartet", "trio"], "jazz"),
            (["blues", "juke joint", "harmonica"], "blues"),
            (["hip hop", "hip-hop", "rap ", "trap", "mc ", "cypher", "freestyle"], "hip-hop"),
            (["r&b", "rnb", "neo-soul", "neo soul", "quiet storm"], "r-and-b"),
            (["rock", "guitar", "riff"], "rock"),
            (["indie", "lo-fi", "bedroom pop"], "indie"),
            (["country", "honky-tonk", "honky tonk"], "country"),
            (["folk", "acoustic", "roots", "americana", "bluegrass", "banjo", "mandolin"], "folk"),
            (["electronic", "edm", "techno", "trance", "dnb", "dubstep", "synth"], "electronic"),
            (["pop ", "top 40", "chart"], "pop"),
            (["soul", "funk", "motown", "disco", "groove", "boogie"], "soul"),
            (["metal", "death ", "doom", "thrash", "hardcore", "mosh", "shred"], "metal"),
            (["punk", "emo", "ska"], "punk"),
            (["latin", "salsa", "bachata", "reggaeton", "cumbia", "merengue", "afrobeat"], "latin"),
            (["symphony", "orchestra", "chamber", "philharmonic", "concerto", "sonata"], "classical"),
            (["opera", "soprano", "aria", "libretto", "operetta"], "opera"),
            (["reggae", "dancehall", "dub "], "reggae"),
            (["gospel", "praise", "worship", "ccm"], "gospel"),
            (["cover band", "tribute"], "cover"),
            (["open mic", "open-mic", "openmic"], "open-mic"),
            (["singer-songwriter", "singer/songwriter"], "singer-songwriter"),
        ]
        for keywords, genre in music_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "film":
        film_patterns: list[tuple[list[str], str]] = [
            (["documentary", "doc ", "true story", "real-life"], "documentary"),
            (["horror", "scary", "slasher", "zombie", "haunted"], "horror"),
            (["sci-fi", "science fiction", "space", "alien", "dystopia", "fantasy"], "sci-fi"),
            (["animation", "animated", "anime", "pixar", "ghibli", "cartoon"], "animation"),
            (["thriller", "mystery", "noir", "suspense", "heist"], "thriller"),
            (["indie", "arthouse", "art house", "independent", "sundance", "a24"], "indie"),
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
            (["open mic", "open-mic", "openmic", "amateur night", "new material"], "open-mic"),
            (["improv", "improvisation", "audience suggestion", "yes and"], "improv"),
            (["sketch", "variety show", "comedy revue"], "sketch"),
            (["roast", "roast battle"], "roast"),
            (["moth", "story slam", "storytelling", "monologue"], "storytelling"),
            (["stand-up", "stand up", "standup", "comedy special", "headliner", "comedian"], "stand-up"),
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
            (["immersive", "interactive", "site-specific", "choose your own"], "immersive"),
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

    elif category == "sports":
        sports_patterns: list[tuple[list[str], str]] = [
            (["braves", "baseball", "mlb", "softball", "batting"], "baseball"),
            (["hawks", "basketball", "nba", "ncaa basketball", "hoops"], "basketball"),
            (["falcons", "football", "nfl", "sec ", "touchdown"], "football"),
            (["united", "soccer", "mls", "nwsl", "fc ", "futbol"], "soccer"),
            (["hockey", "nhl", "gladiators", "puck"], "hockey"),
            (["ufc", "mma", "boxing", "fight night", "bout", "knockout"], "mma"),
            (["nascar", "racing", "motorsport", "grand prix", "derby"], "racing"),
            (["golf", "pga", "tour championship", "scramble"], "golf"),
            (["tennis", "atp", "wta", "serve", "court"], "tennis"),
            (["marathon", "5k", "10k", "half-marathon", "road race", "fun run"], "running"),
            (["esports", "gaming", "league of legends", "valorant"], "esports"),
            (["roller derby", "rollergirls", "bout"], "roller-derby"),
            (["wrestling"], "wrestling"),
            (["volleyball"], "volleyball"),
            (["lacrosse"], "lacrosse"),
            (["pickleball"], "pickleball"),
        ]
        for keywords, genre in sports_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "fitness":
        fitness_patterns: list[tuple[list[str], str]] = [
            (["yoga", "vinyasa", "hot yoga", "yin", "asana", "namaste"], "yoga"),
            (["run club", "group run", "trail run", "pace group", "runners"], "run"),
            (["spin", "cycling", "bike ride", "peloton", "criterium"], "cycling"),
            (["dance class", "salsa", "bachata", "swing dance", "two-step", "zumba"], "dance"),
            (["hike", "trail walk", "nature walk", "guided hike"], "hike"),
            (["crossfit", "wod", "hiit", "bootcamp", "burpee", "functional"], "crossfit"),
            (["bjj", "karate", "muay thai", "krav maga", "self-defense", "jiu-jitsu"], "martial-arts"),
            (["pilates", "reformer", "barre", "core work"], "pilates"),
            (["swim", "lap swim", "open water", "aqua", "pool"], "swimming"),
            (["climbing", "bouldering", "belay", "top rope", "send"], "climbing"),
        ]
        for keywords, genre in fitness_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "food_drink":
        food_patterns: list[tuple[list[str], str]] = [
            (["southern", "soul food", "bbq", "barbecue", "cajun", "creole", "biscuit"], "southern"),
            (["mexican", "tacos", "mezcal", "tequila", "margarita"], "mexican"),
            (["italian", "pasta", "pizza", "trattoria", "risotto"], "italian"),
            (["sushi", "ramen", "dim sum", "pho", "curry", "bibimbap", "thai", "korean"], "asian"),
            (["brunch", "bottomless", "mimosa", "bloody mary"], "brunch"),
            (["wine tasting", "wine pairing", "sommelier", "natural wine", "vineyard"], "wine"),
            (["craft beer", "brewery", "taproom", "ipa", "stout", "ale", "lager", "brew"], "beer"),
            (["cocktail", "mixology", "spirits", "bartend", "aperitif"], "cocktails"),
            (["coffee", "latte", "espresso", "barista", "cupping", "pour-over"], "coffee"),
            (["pop-up", "popup", "supper club", "guest chef", "one-night"], "pop-up"),
            (["tasting", "pairing", "flight", "prix fixe", "multi-course"], "tasting"),
            (["cooking class", "baking class", "culinary", "hands-on", "from scratch"], "cooking-class"),
            (["food fest", "farmers market", "food truck", "night market"], "food-festival"),
            (["seafood", "oyster", "crawfish", "crab", "shrimp", "fish fry"], "seafood"),
        ]
        for keywords, genre in food_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "art":
        art_patterns: list[tuple[list[str], str]] = [
            (["exhibition", "exhibit", "gallery show", "retrospective", "collection"], "exhibition"),
            (["opening reception", "first friday", "art walk", "gallery night"], "gallery-opening"),
            (["photography", "photo exhibit", "darkroom", "portrait"], "photography"),
            (["sculpture", "installation", "outdoor art", "public art"], "sculpture"),
            (["mural", "graffiti", "street art", "live painting", "wheatpaste"], "street-art"),
            (["pottery", "ceramics", "weaving", "printmaking", "letterpress", "craft"], "craft"),
            (["digital art", "new media", "projection", "video art", "generative"], "digital"),
            (["performance art", "happening", "durational", "body art"], "performance"),
            (["art market", "maker fair", "craft fair", "handmade"], "market"),
        ]
        for keywords, genre in art_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "nightlife":
        nightlife_patterns: list[tuple[list[str], str]] = [
            (["dj", "club night", "dance floor", " set ", "spinning"], "dj"),
            (["drag", "drag show", "queen", "pageant", "lip sync"], "drag"),
            (["trivia", "quiz night", "pub quiz", "team trivia"], "trivia"),
            (["karaoke", "sing-along", "noraebang", "mic night"], "karaoke"),
            (["dance party", "80s night", "90s night", "silent disco", "throwback"], "dance-party"),
            (["board game", "bingo", "arcade", "game night", "poker"], "game-night"),
            (["burlesque", "cabaret", "variety show", "vaudeville"], "burlesque"),
            (["wine night", "wine down", "wine bar", "happy hour"], "wine-night"),
            (["speakeasy", "cocktail party", "mixology", "craft cocktail"], "cocktail-night"),
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
            (["book club", "reading group", "book discussion", "author q&a"], "book-club"),
            (["tour", "walking tour", "guided", "behind-the-scenes"], "tour"),
            (["screening", "film discussion", "watch party", "documentary night"], "film-screening"),
            (["language exchange", "conversation", "practice", "spanish", "french"], "language"),
        ]
        for keywords, genre in learning_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "community":
        community_patterns: list[tuple[list[str], str]] = [
            (["volunteer", "cleanup", "service", "giving back", "habitat"], "volunteer"),
            (["meetup", "social", "mixer", "newcomers", "new in town"], "meetup"),
            (["networking", "professional", "career", "industry"], "networking"),
            (["pride", "lgbtq", "queer", "trans", "gay", "lesbian", "rainbow"], "lgbtq"),
            (["church", "faith", "spiritual", "worship", "prayer", "interfaith"], "faith"),
            (["rally", "town hall", "civic", "march", "protest", "advocacy"], "activism"),
            (["support group", "recovery", "nami", "grief", "wellness circle"], "support"),
            (["cultural", "heritage", "diwali", "lunar new year", "diaspora"], "cultural"),
        ]
        for keywords, genre in community_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "family":
        family_patterns: list[tuple[list[str], str]] = [
            (["storytime", "story hour", "read-aloud", "story time"], "storytime"),
            (["craft", "art project", "make your own", "diy", "painting"], "crafts"),
            (["science", "stem", "experiment", "discovery"], "science"),
            (["nature walk", "animal", "zoo", "garden", "wildlife", "butterfly"], "nature"),
            (["puppet", "marionette", "puppet show"], "puppet-show"),
            (["festival", "fair", "carnival", "hayride", "pumpkin", "egg hunt"], "festival"),
            (["kids concert", "sing-along", "music class", "toddler", "little"], "music-for-kids"),
            (["play day", "splash pad", "playground", "field day"], "outdoor-play"),
        ]
        for keywords, genre in family_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    elif category == "outdoor":
        outdoor_patterns: list[tuple[list[str], str]] = [
            (["park", "picnic", "lawn", "green space"], "parks"),
            (["garden", "botanical", "plant", "bloom", "flower"], "garden"),
            (["market", "flea market", "artisan", "vendor", "outdoor market"], "market"),
            (["tour", "sightseeing", "scenic", "overlook", "walk", "beltline"], "sightseeing"),
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
            (["writing workshop", "nanowrimo", "critique", "fiction writing"], "writing"),
            (["comic", "zine", "graphic novel", "manga"], "comics"),
            (["book festival", "literary fest", "book fair"], "literary-festival"),
        ]
        for keywords, genre in words_patterns:
            if any(kw in text for kw in keywords):
                genres.add(genre)

    # --- Inherit venue genres (if event is at a jazz bar, it's likely jazz-related) ---
    if venue_genres:
        normalized_venue = normalize_genres(venue_genres)
        # Only inherit if event has no genres yet (don't override explicit genres)
        if not genres and normalized_venue:
            genres.update(normalized_venue)

    return sorted(genres)


def infer_subcategory(event: dict) -> str | None:
    """
    DEPRECATED: Subcategory has been migrated to genres[].
    Use infer_genres() instead. This function is kept for reference only.

    Infer subcategory from event title and description.
    """
    title = (event.get("title") or "").lower()
    desc = (event.get("description") or "").lower()
    category = event.get("category") or ""
    text = f"{title} {desc}"

    # Words subcategories
    if category == "words":
        if any(term in text for term in ["book club", "bookclub", "reading group"]):
            return "words.bookclub"
        if any(term in text for term in ["poetry", "poem", "spoken word"]):
            return "words.poetry"
        if any(term in text for term in ["storytelling", "story time", "storytime"]):
            return "words.storytelling"
        if any(term in text for term in ["writing workshop", "writers group", "creative writing"]):
            return "words.workshop"
        if any(term in text for term in ["author", "signing", "in conversation", "reading"]):
            return "words.lecture"
        return "words.reading"  # Default for words

    # Learning subcategories
    if category == "learning":
        if any(term in text for term in ["workshop", "hands-on", "hands on"]):
            return "learning.workshop"
        if any(term in text for term in ["class", "course", "lesson"]):
            return "learning.class"
        if any(term in text for term in ["lecture", "talk", "presentation", "speaker"]):
            return "learning.lecture"
        if any(term in text for term in ["seminar", "conference", "symposium"]):
            return "learning.seminar"
        return "learning.workshop"  # Default

    # Fitness subcategories
    if category == "fitness":
        if any(term in text for term in ["yoga", "vinyasa", "hatha"]):
            return "fitness.yoga"
        if any(term in text for term in ["run", "5k", "10k", "marathon", "jog"]):
            return "fitness.run"
        if any(term in text for term in ["cycle", "cycling", "bike", "spin"]):
            return "fitness.cycling"
        if any(term in text for term in ["dance", "zumba", "barre"]):
            return "fitness.dance"
        if any(term in text for term in ["hike", "hiking", "trail", "walk"]):
            return "fitness.hike"
        if any(term in text for term in ["class", "workout", "bootcamp", "hiit"]):
            return "fitness.class"
        return "fitness.class"  # Default

    # Music subcategories
    if category == "music":
        if any(term in text for term in ["open mic", "open-mic", "openmic"]):
            return "music.openmic"
        if any(term in text for term in ["symphony", "orchestra", "chamber", "philharmonic"]):
            return "music.classical"
        if any(term in text for term in ["jazz", "blues"]):
            return "music.live.jazz"
        if any(term in text for term in ["hip hop", "hip-hop", "rap", "r&b", "rnb"]):
            return "music.live.hiphop"
        if any(term in text for term in ["electronic", "edm", "techno", "house", "dj set"]):
            return "music.live.electronic"
        if any(term in text for term in ["country", "folk", "bluegrass"]):
            return "music.live.country"
        if any(term in text for term in ["metal", "punk", "hardcore"]):
            return "music.live.metal"
        if any(term in text for term in ["rock", "indie", "alternative"]):
            return "music.live.rock"
        return "music.live"  # Default for concerts

    # Comedy subcategories
    if category == "comedy":
        if any(term in text for term in ["open mic", "open-mic", "openmic"]):
            return "comedy.openmic"
        if any(term in text for term in ["improv", "improvisation"]):
            return "comedy.improv"
        return "comedy.standup"  # Default

    # Theater subcategories
    if category == "theater":
        if any(term in text for term in ["musical", "broadway"]):
            return "theater.musical"
        if any(term in text for term in ["ballet", "dance company", "dance performance"]):
            return "theater.dance"
        if any(term in text for term in ["opera"]):
            return "theater.opera"
        return "theater.play"  # Default

    # Film subcategories
    if category == "film":
        if any(term in text for term in ["documentary", "doc"]):
            return "film.documentary"
        if any(term in text for term in ["festival", "film fest"]):
            return "film.festival"
        if any(term in text for term in ["classic", "repertory", "revival"]):
            return "film.repertory"
        return "film.new"  # Default

    # Community subcategories
    if category == "community":
        if any(term in text for term in ["volunteer", "volunteering"]):
            return "community.volunteer"
        if any(term in text for term in ["meetup", "meet up", "gathering"]):
            return "community.meetup"
        if any(term in text for term in ["networking", "mixer", "professional"]):
            return "community.networking"
        if any(term in text for term in ["lgbtq", "pride", "queer", "gay"]):
            return "community.lgbtq"
        return None

    # Nightlife subcategories
    if category == "nightlife":
        if any(term in text for term in ["trivia", "quiz"]):
            return "nightlife.trivia"
        if any(term in text for term in ["drag", "drag show", "drag brunch"]):
            return "nightlife.drag"
        if any(term in text for term in ["dj", "dance night", "dance party"]):
            return "nightlife.dj"
        if any(term in text for term in ["burlesque"]):
            return "nightlife.burlesque"
        return "nightlife.dj"  # Default for club nights

    # Meetup subcategories
    if category == "meetup":
        if any(term in text for term in ["tech", "developer", "coding", "programming"]):
            return "meetup.tech"
        if any(term in text for term in ["professional", "career", "business"]):
            return "meetup.professional"
        if any(term in text for term in ["outdoor", "hike", "nature"]):
            return "meetup.outdoors"
        if any(term in text for term in ["creative", "art", "craft"]):
            return "meetup.creative"
        if any(term in text for term in ["food", "dinner", "brunch"]):
            return "meetup.food"
        if any(term in text for term in ["parent", "mom", "dad", "family"]):
            return "meetup.parents"
        return "meetup.social"  # Default

    return None
