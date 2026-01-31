"""
Tag inference logic for Lost City events.
Automatically assigns tags based on event data and venue vibes.
"""

from __future__ import annotations

from typing import Optional
from tags import INHERITABLE_VIBES, VIBE_TO_TAG, ALL_TAGS


def infer_tags(
    event: dict,
    venue_vibes: Optional[list[str]] = None,
    preserve_existing: bool = True
) -> list[str]:
    """
    Infer tags from event data and venue vibes.

    Args:
        event: Event dict with title, description, is_free, price_min, etc.
        venue_vibes: List of vibes from the event's venue
        preserve_existing: If True, keep existing tags and add inferred ones

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

    # --- Inherit relevant vibes from venue ---
    if venue_vibes:
        for vibe in venue_vibes:
            if vibe in INHERITABLE_VIBES:
                tag = VIBE_TO_TAG.get(vibe, vibe)
                tags.add(tag)

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

    # RSVP required
    if any(phrase in text for phrase in [
        "rsvp", "registration required", "must register",
        "sign up required", "reserve your spot"
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

    # Filter to only valid tags
    valid_tags = [t for t in tags if t in ALL_TAGS]

    return sorted(valid_tags)


def merge_tags(existing: list[str], new: list[str]) -> list[str]:
    """Merge two tag lists, removing duplicates."""
    combined = set(existing or []) | set(new or [])
    valid = [t for t in combined if t in ALL_TAGS]
    return sorted(valid)


def infer_subcategory(event: dict) -> str | None:
    """
    Infer subcategory from event title and description.

    Args:
        event: Event dict with title, description, category

    Returns:
        Inferred subcategory or None
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
