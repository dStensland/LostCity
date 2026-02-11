"""
Genre normalization for LostCity taxonomy.

Provides canonical genre slugs, normalization maps, and helper functions
for normalizing genre strings from crawlers, Ticketmaster, Spotify, user input, etc.

Usage:
    from genre_normalize import normalize_genre, normalize_genres, VALID_GENRES

    genres = normalize_genres(["Hip-Hop", "Rap/Hip Hop", "trap"])
    # → ["hip-hop"]

    genre = normalize_genre("country music")
    # → "country"
"""

from typing import Optional

# ============================================================================
# VALID GENRE SLUGS (canonical, lowercase-hyphenated)
# Organized by category. A genre slug is valid in any category context —
# the genre_options table tracks which genres belong to which categories.
# ============================================================================

MUSIC_GENRES = {
    "rock", "indie", "hip-hop", "r-and-b", "jazz", "blues", "country",
    "folk", "electronic", "pop", "soul", "metal", "punk", "latin", "classical",
    # Extended
    "alternative", "singer-songwriter", "house", "reggae", "gospel",
    "opera", "world", "jam", "cover", "edm", "funk", "bluegrass", "ambient",
}

FILM_GENRES = {
    "action", "comedy", "documentary", "drama", "horror", "sci-fi", "thriller",
    "indie", "animation", "romance", "classic", "foreign",
}

COMEDY_GENRES = {
    "stand-up", "improv", "sketch", "open-mic", "roast", "storytelling",
}

THEATER_GENRES = {
    "musical", "drama", "comedy", "ballet", "opera", "immersive",
    "spoken-word", "burlesque", "puppet", "shakespeare",
}

SPORTS_GENRES = {
    "baseball", "basketball", "football", "soccer", "hockey", "mma",
    "racing", "golf", "tennis", "running", "esports", "roller-derby",
    # Extended
    "softball", "volleyball", "lacrosse", "rugby", "cricket", "field-hockey",
    "boxing", "wrestling", "kickboxing", "motorsports", "nascar",
    "monster-truck", "dirt-track", "track", "gymnastics", "swimming",
    "diving", "figure-skating", "marathon", "triathlon", "cycling",
    "crossfit", "poker", "pickleball", "cornhole", "axe-throwing",
}

FITNESS_GENRES = {
    "yoga", "run", "cycling", "dance", "hike", "crossfit",
    "martial-arts", "pilates", "swimming", "climbing",
}

FOOD_DRINK_GENRES = {
    "southern", "mexican", "italian", "asian", "brunch", "wine", "beer",
    "cocktails", "coffee", "pop-up", "tasting", "cooking-class",
    "food-festival", "seafood",
}

ART_GENRES = {
    "exhibition", "gallery-opening", "photography", "sculpture",
    "street-art", "craft", "digital", "performance", "market",
}

NIGHTLIFE_GENRES = {
    "dj", "drag", "trivia", "karaoke", "dance-party", "game-night",
    "burlesque", "wine-night", "cocktail-night",
}

LEARNING_GENRES = {
    "workshop", "class", "lecture", "seminar", "book-club", "tour",
    "film-screening", "language",
}

COMMUNITY_GENRES = {
    "volunteer", "meetup", "networking", "lgbtq", "faith", "activism",
    "support", "cultural", "meditation", "interfaith",
}

FAMILY_GENRES = {
    "storytime", "crafts", "science", "nature", "puppet-show",
    "festival", "music-for-kids", "outdoor-play",
}

OUTDOOR_GENRES = {
    "parks", "garden", "market", "sightseeing", "water", "camping", "adventure",
}

WORDS_GENRES = {
    "reading", "poetry", "book-club", "storytelling", "writing",
    "comics", "literary-festival",
}

# Union of all valid genres
VALID_GENRES: set[str] = (
    MUSIC_GENRES | FILM_GENRES | COMEDY_GENRES | THEATER_GENRES |
    SPORTS_GENRES | FITNESS_GENRES | FOOD_DRINK_GENRES | ART_GENRES |
    NIGHTLIFE_GENRES | LEARNING_GENRES | COMMUNITY_GENRES | FAMILY_GENRES |
    OUTDOOR_GENRES | WORDS_GENRES
)

# Category → genre set mapping (for category-scoped lookups)
GENRES_BY_CATEGORY: dict[str, set[str]] = {
    "music": MUSIC_GENRES,
    "film": FILM_GENRES,
    "comedy": COMEDY_GENRES,
    "theater": THEATER_GENRES,
    "sports": SPORTS_GENRES,
    "fitness": FITNESS_GENRES,
    "food_drink": FOOD_DRINK_GENRES,
    "art": ART_GENRES,
    "nightlife": NIGHTLIFE_GENRES,
    "learning": LEARNING_GENRES,
    "community": COMMUNITY_GENRES,
    "family": FAMILY_GENRES,
    "outdoor": OUTDOOR_GENRES,
    "words": WORDS_GENRES,
}


# ============================================================================
# NORMALIZATION MAP
# Maps raw genre strings (from crawlers, APIs, user input) to canonical slugs.
# Keys are lowercase. Lookup should lowercase the input first.
# ============================================================================

GENRE_NORMALIZATION: dict[str, str] = {
    # --- Music: case + spelling variants ---
    "country music": "country",
    "country": "country",
    "hip hop": "hip-hop",
    "hip-hop": "hip-hop",
    "hiphop": "hip-hop",
    "rap": "hip-hop",
    "rap/hip hop": "hip-hop",
    "rap/hip-hop": "hip-hop",
    "trap": "hip-hop",
    "r&b": "r-and-b",
    "rnb": "r-and-b",
    "r&b/soul": "r-and-b",
    "rhythm and blues": "r-and-b",
    "contemporary r&b": "r-and-b",
    "edm": "electronic",
    "electronic/dance": "electronic",
    "electronica": "electronic",
    "electronic music": "electronic",
    "singer/songwriter": "singer-songwriter",
    "singer-songwriter": "singer-songwriter",
    "singer songwriter": "singer-songwriter",
    "acoustic": "singer-songwriter",

    # --- Music: merge near-duplicates ---
    "alternative rock": "alternative",
    "alt-rock": "alternative",
    "alt rock": "alternative",
    "indie rock": "indie",
    "indie pop": "indie",
    "indie folk": "indie",
    "dream pop": "indie",
    "shoegaze": "indie",
    "post-rock": "indie",
    "art rock": "indie",
    "punk rock": "punk",
    "pop-punk": "punk",
    "post-punk": "punk",
    "emo": "punk",
    "ska": "punk",
    "ska-punk": "punk",
    "hard rock": "rock",
    "classic rock": "rock",
    "southern rock": "rock",
    "garage rock": "rock",
    "death metal": "metal",
    "heavy metal": "metal",
    "metalcore": "metal",
    "black metal": "metal",
    "doom metal": "metal",
    "thrash metal": "metal",
    "thrash": "metal",
    "hardcore": "metal",
    "deep house": "house",
    "tech house": "house",
    "progressive house": "house",
    "house music": "house",
    "dubstep": "electronic",
    "trance": "electronic",
    "drum and bass": "electronic",
    "dnb": "electronic",
    "d&b": "electronic",
    "techno": "electronic",
    "synth": "electronic",
    "synthwave": "electronic",
    "americana": "folk",
    "roots": "folk",
    "roots music": "folk",
    "old-time": "folk",
    "old time": "folk",
    "neo-soul": "soul",
    "neo soul": "soul",
    "motown": "soul",
    "disco": "soul",
    "p-funk": "funk",
    "go-go": "funk",
    "salsa": "latin",
    "bachata": "latin",
    "reggaeton": "latin",
    "cumbia": "latin",
    "merengue": "latin",
    "mariachi": "latin",
    "tropical": "latin",
    "afrobeat": "latin",
    "afrobeats": "latin",
    "reggae": "reggae",
    "dancehall": "reggae",
    "dub": "reggae",
    "ska": "reggae",
    "jam band": "jam",
    "jam bands": "jam",
    "newgrass": "bluegrass",
    "banjo": "bluegrass",
    "string band": "bluegrass",
    "praise & worship": "gospel",
    "ccm": "gospel",
    "christian": "gospel",
    "worship": "gospel",
    "symphony": "classical",
    "orchestra": "classical",
    "chamber music": "classical",
    "choral": "classical",
    "philharmonic": "classical",
    "cover band": "cover",
    "tribute": "cover",
    "tribute band": "cover",
    "bebop": "jazz",
    "swing": "jazz",
    "big band": "jazz",
    "smooth jazz": "jazz",
    "fusion": "jazz",
    "delta blues": "blues",
    "electric blues": "blues",
    "chicago blues": "blues",
    "honky-tonk": "country",
    "honky tonk": "country",
    "outlaw country": "country",
    "bro-country": "country",
    "dance-pop": "pop",
    "synth-pop": "pop",
    "power pop": "pop",
    "top 40": "pop",
    "world music": "world",
    "global": "world",

    # --- Film ---
    "science fiction": "sci-fi",
    "sci fi": "sci-fi",
    "scifi": "sci-fi",
    "animated": "animation",
    "anime": "animation",
    "cartoon": "animation",
    "mystery": "thriller",
    "noir": "thriller",
    "suspense": "thriller",
    "crime": "thriller",
    "heist": "thriller",
    "rom-com": "romance",
    "romcom": "romance",
    "love story": "romance",
    "cult": "classic",
    "repertory": "classic",
    "revival": "classic",
    "arthouse": "indie",
    "art house": "indie",
    "independent": "indie",
    "international": "foreign",
    "subtitled": "foreign",
    "bollywood": "foreign",
    "slasher": "horror",
    "supernatural": "horror",
    "zombie": "horror",

    # --- Comedy ---
    "stand up": "stand-up",
    "standup": "stand-up",
    "stand-up comedy": "stand-up",
    "standup comedy": "stand-up",
    "improvisation": "improv",
    "improv comedy": "improv",
    "long-form improv": "improv",
    "short-form improv": "improv",
    "sketch comedy": "sketch",
    "comedy revue": "sketch",
    "variety show": "sketch",
    "open mic": "open-mic",
    "open-mic comedy": "open-mic",
    "amateur night": "open-mic",
    "new material night": "open-mic",
    "roast battle": "roast",
    "comedy roast": "roast",
    "moth": "storytelling",
    "story slam": "storytelling",
    "comedic monologue": "storytelling",

    # --- Theater ---
    "broadway": "musical",
    "off-broadway": "musical",
    "play": "drama",
    "tragedy": "drama",
    "new work": "drama",
    "contemporary ballet": "ballet",
    "modern dance": "ballet",
    "dance company": "ballet",
    "grand opera": "opera",
    "chamber opera": "opera",
    "operetta": "opera",
    "site-specific": "immersive",
    "interactive theater": "immersive",
    "promenade": "immersive",
    "poetry slam": "spoken-word",
    "spoken word": "spoken-word",
    "cabaret": "burlesque",
    "vaudeville": "burlesque",
    "puppetry": "puppet",
    "marionette": "puppet",
    "shadow puppet": "puppet",

    # --- Sports ---
    "mlb": "baseball",
    "nba": "basketball",
    "nfl": "football",
    "mls": "soccer",
    "nwsl": "soccer",
    "futbol": "soccer",
    "nhl": "hockey",
    "ufc": "mma",
    "mixed martial arts": "mma",
    "fight night": "mma",
    "kickboxing": "mma",
    "pga": "golf",
    "atp": "tennis",
    "wta": "tennis",
    "5k": "running",
    "10k": "running",
    "half-marathon": "running",
    "half marathon": "running",
    "fun run": "running",
    "road race": "running",
    "nascar": "racing",
    "motorsport": "racing",
    "motorsports": "racing",
    "grand prix": "racing",
    "auto racing": "racing",
    "horse racing": "racing",
    "derby": "racing",
    "gaming tournament": "esports",
    "league of legends": "esports",
    "valorant": "esports",

    # --- Fitness ---
    "vinyasa": "yoga",
    "hot yoga": "yoga",
    "yin yoga": "yoga",
    "restorative yoga": "yoga",
    "aerial yoga": "yoga",
    "run club": "run",
    "running club": "run",
    "group run": "run",
    "trail run": "run",
    "spin": "cycling",
    "spin class": "cycling",
    "mountain biking": "cycling",
    "group ride": "cycling",
    "dance class": "dance",
    "zumba": "dance",
    "salsa class": "dance",
    "bachata class": "dance",
    "group hike": "hike",
    "guided hike": "hike",
    "nature walk": "hike",
    "trail walk": "hike",
    "hiit": "crossfit",
    "bootcamp": "crossfit",
    "boot camp": "crossfit",
    "functional fitness": "crossfit",
    "bjj": "martial-arts",
    "brazilian jiu-jitsu": "martial-arts",
    "jiu-jitsu": "martial-arts",
    "karate": "martial-arts",
    "muay thai": "martial-arts",
    "krav maga": "martial-arts",
    "self-defense": "martial-arts",
    "self defense": "martial-arts",
    "reformer": "pilates",
    "barre": "pilates",
    "bouldering": "climbing",
    "top rope": "climbing",
    "rock climbing": "climbing",
    "lap swim": "swimming",
    "aqua fitness": "swimming",
    "masters swim": "swimming",

    # --- Food & Drink ---
    "soul food": "southern",
    "bbq": "southern",
    "barbecue": "southern",
    "cajun": "southern",
    "creole": "southern",
    "low-country": "southern",
    "tex-mex": "mexican",
    "tacos": "mexican",
    "mezcal": "mexican",
    "tequila": "mexican",
    "sushi": "asian",
    "ramen": "asian",
    "dim sum": "asian",
    "pho": "asian",
    "curry": "asian",
    "thai": "asian",
    "korean": "asian",
    "japanese": "asian",
    "chinese": "asian",
    "vietnamese": "asian",
    "indian": "asian",
    "wine tasting": "wine",
    "wine pairing": "wine",
    "natural wine": "wine",
    "sommelier": "wine",
    "craft beer": "beer",
    "brewery": "beer",
    "taproom": "beer",
    "ipa": "beer",
    "cocktail": "cocktails",
    "mixology": "cocktails",
    "spirits": "cocktails",
    "espresso": "coffee",
    "latte": "coffee",
    "barista": "coffee",
    "pour-over": "coffee",
    "popup": "pop-up",
    "pop up": "pop-up",
    "supper club": "pop-up",
    "guest chef": "pop-up",
    "food tasting": "tasting",
    "multi-course": "tasting",
    "prix fixe": "tasting",
    "cooking class": "cooking-class",
    "baking class": "cooking-class",
    "culinary workshop": "cooking-class",
    "farmers market": "food-festival",
    "farmers' market": "food-festival",
    "food truck": "food-festival",
    "night market": "food-festival",
    "food fest": "food-festival",
    "oyster": "seafood",
    "crawfish": "seafood",
    "crab": "seafood",
    "fish fry": "seafood",

    # --- Nightlife ---
    "club night": "dj",
    "dj set": "dj",
    "resident dj": "dj",
    "drag show": "drag",
    "drag brunch": "drag",
    "drag bingo": "drag",
    "pub trivia": "trivia",
    "quiz night": "trivia",
    "pub quiz": "trivia",
    "team trivia": "trivia",
    "sing-along": "karaoke",
    "noraebang": "karaoke",
    "80s night": "dance-party",
    "90s night": "dance-party",
    "silent disco": "dance-party",
    "throwback": "dance-party",
    "board game": "game-night",
    "board games": "game-night",
    "arcade": "game-night",
    "bingo": "game-night",
    "wine down": "wine-night",
    "wine wednesday": "wine-night",

    # --- Learning ---
    "hands-on": "workshop",
    "maker session": "workshop",
    "skill-building": "workshop",
    "course": "class",
    "instruction": "class",
    "keynote": "lecture",
    "guest speaker": "lecture",
    "author talk": "lecture",
    "panel": "seminar",
    "conference": "seminar",
    "summit": "seminar",
    "symposium": "seminar",
    "reading group": "book-club",
    "book discussion": "book-club",
    "author q&a": "book-club",
    "walking tour": "tour",
    "guided tour": "tour",
    "behind-the-scenes": "tour",
    "doc & discussion": "film-screening",
    "documentary night": "film-screening",
    "watch party": "film-screening",
    "language exchange": "language",
    "conversation practice": "language",

    # --- Community ---
    "cleanup": "volunteer",
    "service project": "volunteer",
    "giving back": "volunteer",
    "habitat": "volunteer",
    "social mixer": "meetup",
    "newcomers": "meetup",
    "new in town": "meetup",
    "professional networking": "networking",
    "industry mixer": "networking",
    "career event": "networking",
    "pride": "lgbtq",
    "queer": "lgbtq",
    "trans": "lgbtq",
    "church event": "faith",
    "interfaith": "interfaith",
    "spiritual": "faith",
    "worship": "faith",
    "prayer": "faith",
    "vespers": "faith",
    "shabbat": "faith",
    "sabbath": "faith",
    "torah study": "faith",
    "bible study": "faith",
    "dharma": "faith",
    "puja": "faith",
    "kirtan": "faith",
    "satsang": "faith",
    "meditation session": "meditation",
    "mindfulness": "meditation",
    "zazen": "meditation",
    "zen meditation": "meditation",
    "guided meditation": "meditation",
    "sound bath": "meditation",
    "contemplative": "meditation",
    "retreat": "faith",
    "eid": "cultural",
    "passover": "cultural",
    "seder": "cultural",
    "purim": "cultural",
    "chanukah": "cultural",
    "hanukkah": "cultural",
    "holi": "cultural",
    "navaratri": "cultural",
    "vaisakhi": "cultural",
    "losar": "cultural",
    "vesak": "cultural",
    "christmas concert": "classical",
    "easter concert": "classical",
    "gospel concert": "gospel",
    "organ recital": "classical",
    "choral": "classical",
    "sacred music": "classical",
    "rally": "activism",
    "town hall": "activism",
    "civic": "activism",
    "march": "activism",
    "advocacy": "activism",
    "support group": "support",
    "recovery": "support",
    "grief": "support",
    "nami": "support",
    "diwali": "cultural",
    "lunar new year": "cultural",
    "heritage": "cultural",
    "diaspora": "cultural",
    "juneteenth": "cultural",

    # --- Family ---
    "story hour": "storytime",
    "story time": "storytime",
    "read-aloud": "storytime",
    "kids craft": "crafts",
    "art project": "crafts",
    "stem": "science",
    "experiment": "science",
    "zoo": "nature",
    "wildlife": "nature",
    "butterfly": "nature",
    "animal encounter": "nature",
    "puppet show": "puppet-show",
    "marionette show": "puppet-show",
    "fair": "festival",
    "carnival": "festival",
    "hayride": "festival",
    "pumpkin patch": "festival",
    "egg hunt": "festival",
    "kids concert": "music-for-kids",
    "toddler music": "music-for-kids",
    "splash pad": "outdoor-play",
    "playground": "outdoor-play",
    "field day": "outdoor-play",

    # --- Outdoor ---
    "picnic": "parks",
    "lawn": "parks",
    "botanical": "garden",
    "plant sale": "garden",
    "flea market": "market",
    "artisan market": "market",
    "outdoor market": "market",
    "maker fair": "market",
    "craft fair": "market",
    "beltline": "sightseeing",
    "scenic": "sightseeing",
    "kayak": "water",
    "paddle": "water",
    "paddleboard": "water",
    "canoe": "water",
    "stargazing": "camping",
    "campfire": "camping",
    "zip line": "adventure",
    "zipline": "adventure",
    "ropes course": "adventure",
    "obstacle": "adventure",

    # --- Words ---
    "book signing": "reading",
    "book launch": "reading",
    "author reading": "reading",
    "author event": "reading",
    "slam": "poetry",
    "verse": "poetry",
    "poem": "poetry",
    "nanowrimo": "writing",
    "fiction writing": "writing",
    "critique group": "writing",
    "zine": "comics",
    "graphic novel": "comics",
    "manga": "comics",
    "comic book": "comics",
    "book festival": "literary-festival",
    "literary fest": "literary-festival",
    "book fair": "literary-festival",
}


# ============================================================================
# SUBCATEGORY → GENRE MIGRATION MAP
# Maps old subcategory values to genre slugs for backfill.
# ============================================================================

SUBCATEGORY_TO_GENRE: dict[str, Optional[str]] = {
    "music.live": None,
    "music.live.rock": "rock",
    "music.live.jazz": "jazz",
    "music.live.hiphop": "hip-hop",
    "music.live.electronic": "electronic",
    "music.live.country": "country",
    "music.live.metal": "metal",
    "music.live.pop": "pop",
    "music.live.latin": "latin",
    "music.live.acoustic": "singer-songwriter",
    "music.live.classical": "classical",
    "music.live.openmic": "open-mic",
    "music.concert": None,
    "music.rock": "rock",
    "music.country": "country",
    "music.pop": "pop",
    "music.alternative": "alternative",
    "music.classical": "classical",
    "comedy.improv": "improv",
    "comedy.standup": "stand-up",
    "comedy.sketch": "sketch",
    "comedy.openmic": "open-mic",
    "theater.play": "drama",
    "theater.musical": "musical",
    "theater.dance": "ballet",
    "film.cinema": None,
    "film.documentary": "documentary",
    "sports.baseball": "baseball",
    "sports.softball": "baseball",
    "sports.fitness": None,  # reclassify to category:fitness
    "nightlife.lgbtq": "lgbtq",
    "nightlife.club": "dj",
    "nightlife.karaoke": "karaoke",
    "food_drink.farmers_market": "food-festival",
    "outdoor.sightseeing": None,
    "art.exhibition": "exhibition",
    "art.arts.workshop": "craft",
    "art.performance": None,
    "words.reading": "reading",
    "family.festival": None,
    "family.kids": None,
    "family.puppetry": "puppet-show",
    "community.gaming": "game-night",
}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def normalize_genre(raw: str) -> Optional[str]:
    """Normalize a single genre string to its canonical slug.

    Returns None if the genre can't be normalized to a known value.

    Examples:
        normalize_genre("Hip-Hop") → "hip-hop"
        normalize_genre("country music") → "country"
        normalize_genre("gibberish") → None
    """
    if not raw or not isinstance(raw, str):
        return None

    cleaned = raw.strip().lower()
    if not cleaned:
        return None

    # Direct match to valid genres
    if cleaned in VALID_GENRES:
        return cleaned

    # Check normalization map
    if cleaned in GENRE_NORMALIZATION:
        return GENRE_NORMALIZATION[cleaned]

    return None


def normalize_genres(raw_genres: list[str]) -> list[str]:
    """Normalize a list of genre strings, deduplicate, and remove unknowns.

    Args:
        raw_genres: List of raw genre strings from any source.

    Returns:
        Deduplicated list of canonical genre slugs, preserving order.

    Examples:
        normalize_genres(["Hip-Hop", "Rap/Hip Hop", "trap"]) → ["hip-hop"]
        normalize_genres(["rock", "indie", "ROCK"]) → ["rock", "indie"]
    """
    if not raw_genres:
        return []

    seen: set[str] = set()
    result: list[str] = []

    for raw in raw_genres:
        normalized = normalize_genre(raw)
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)

    return result


def genre_from_subcategory(subcategory: str) -> Optional[str]:
    """Convert an old subcategory value to its genre equivalent.

    Args:
        subcategory: Old-style subcategory like "music.live.jazz"

    Returns:
        Canonical genre slug, or None if the subcategory has no genre equivalent.
    """
    if not subcategory:
        return None
    return SUBCATEGORY_TO_GENRE.get(subcategory.strip().lower())


def genres_for_category(category: str) -> set[str]:
    """Get the set of valid genres for a given category.

    Args:
        category: Event/venue category like "music", "comedy", etc.

    Returns:
        Set of valid genre slugs for that category.
    """
    return GENRES_BY_CATEGORY.get(category, set())
