"""
Artist info fetching utility for music events.
Uses MusicBrainz (CC0) for identity, Wikidata (CC0) for genres/images,
and optional Spotify fallback for images when configured.
"""

from __future__ import annotations

import hashlib
import re
import logging
import time
import requests
from typing import Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Artist name blocklist — common non-artist words that MusicBrainz will
# happily match to random artists (instruments, generic event terms, etc.)
# ---------------------------------------------------------------------------
_ARTIST_BLOCKLIST: set[str] = {
    # Instruments
    "piano", "violin", "cello", "guitar", "bass", "drums", "flute",
    "oboe", "clarinet", "trumpet", "trombone", "saxophone", "harp",
    "organ", "percussion", "viola", "recorder", "banjo", "mandolin",
    "ukulele", "harmonica", "bagpipes", "sitar", "tabla", "didgeridoo",
    # Ensemble types
    "ensemble", "orchestra", "quartet", "trio", "duo", "choir",
    "chorus", "band", "soloist", "conductor", "accompanist", "quintet",
    "sextet", "octet", "symphony", "philharmonic",
    # Event types
    "recital", "concert", "performance", "show", "live", "festival",
    "dancing", "singing", "lecture", "seminar", "workshop", "class",
    "session", "meeting", "reception", "ceremony", "celebration",
    "fundraiser", "gala", "luncheon", "brunch", "dinner",
    # Academic / institutional
    "faculty", "senior", "junior", "guest", "masters", "doctoral",
    "graduate", "undergraduate", "department", "music",
    # Status words
    "free", "open", "closed", "cancelled", "postponed", "rescheduled",
    "tba", "tbd", "various", "artist", "artists", "special guest", "student",
}

# ---------------------------------------------------------------------------
# MusicBrainz rate limiting — max 1 request per second
# ---------------------------------------------------------------------------
_last_mb_request: float = 0.0


def _mb_rate_limit() -> None:
    """Enforce MusicBrainz 1 req/sec rate limit."""
    global _last_mb_request
    now = time.monotonic()
    elapsed = now - _last_mb_request
    if elapsed < 1.0:
        time.sleep(1.0 - elapsed)
    _last_mb_request = time.monotonic()


def _mb_headers() -> dict[str, str]:
    """User-Agent header required by MusicBrainz API."""
    from config import config
    return {
        "User-Agent": config.crawler.user_agent,
        "Accept": "application/json",
    }


# ---------------------------------------------------------------------------
# Spotify token cache
# ---------------------------------------------------------------------------
_spotify_token: Optional[str] = None
_spotify_token_expiry: float = 0.0


@dataclass
class ArtistInfo:
    """Artist information from MusicBrainz / Wikidata / Spotify."""
    name: str
    image_url: Optional[str] = None
    genres: Optional[list[str]] = None
    bio: Optional[str] = None  # Wikipedia intro paragraph
    website: Optional[str] = None  # Official band/artist website
    deezer_id: Optional[int] = None  # kept for backward compat, no longer populated
    musicbrainz_id: Optional[str] = None
    wikidata_id: Optional[str] = None
    spotify_id: Optional[str] = None


# Cache for artist info to avoid duplicate API calls
_artist_cache: dict[str, Optional[ArtistInfo]] = {}

# Legacy cache for backwards compatibility
_image_cache: dict[str, Optional[str]] = {}


def extract_artist_from_title(title: str) -> Optional[str]:
    """
    Extract artist name from an event title.

    Common patterns:
    - "Artist Name" (just the artist)
    - "Artist Name at Venue"
    - "Artist Name with Special Guest"
    - "Artist Name: Tour Name"
    - "Artist Name - Tour Name"
    - "Artist Name w/ Opening Act"
    - "Artist Name Live"
    - "An Evening with Artist Name"

    Returns:
        Artist name or None if can't extract
    """
    if not title:
        return None

    cleaned = title.strip()

    # Remove "An Evening with" prefix
    cleaned = re.sub(r'^An Evening [Ww]ith\s+', '', cleaned)

    # Remove "SOLD OUT" prefix/suffix
    cleaned = re.sub(r'\bSOLD OUT\b\s*[-:]*\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*[-:]*\s*\bSOLD OUT\b', '', cleaned, flags=re.IGNORECASE)

    # Remove "POSTPONED", "CANCELLED", "RESCHEDULED" markers
    cleaned = re.sub(r'\b(POSTPONED|CANCELLED|CANCELED|RESCHEDULED)\b\s*[-:]*\s*', '', cleaned, flags=re.IGNORECASE)

    # Strip blocklisted prefix before colon (academic pattern: "Student Recital: Christine Park, cello")
    colon_match = re.match(r'^(.+?):\s+(.+)$', cleaned)
    if colon_match:
        prefix = colon_match.group(1).strip()
        prefix_words = prefix.split()
        if all(w.lower() in _ARTIST_BLOCKLIST for w in prefix_words):
            cleaned = colon_match.group(2).strip()

    # Remove "Live at/in [Venue]" suffix
    cleaned = re.sub(r'\s+[Ll]ive\s+(?:at|in)\s+.*$', '', cleaned)

    # Remove "at [Venue]" suffix (but be careful not to catch artist names with "at")
    cleaned = re.sub(r'\s+at\s+(?:The\s+)?[A-Z][^,]+$', '', cleaned)

    # Split on common delimiters and take the first part (usually the headliner)
    # Order matters - check more specific patterns first
    delimiters = [
        r'\s+w/\s+',           # "w/" for with
        r'\s+with\s+',         # "with"
        r'\s+featuring\s+',    # "featuring"
        r'\s+ft\.?\s+',        # "ft" or "ft."
        r'\s+feat\.?\s+',      # "feat" or "feat."
        r'\s*[,&]\s+',         # comma or ampersand (multiple artists)
        r'\s*[-–—]\s+',        # dash variants (tour name or support)
        r':\s+',               # colon (tour name)
        r'\s+\+\s+',           # plus sign
        r'\s*[|]\s*',          # pipe
    ]

    for delimiter in delimiters:
        parts = re.split(delimiter, cleaned, maxsplit=1, flags=re.IGNORECASE)
        if len(parts) > 1:
            cleaned = parts[0].strip()
            break

    # Remove trailing "Live" or "Live!"
    cleaned = re.sub(r'\s+[Ll]ive!?$', '', cleaned)

    # Remove year in parentheses
    cleaned = re.sub(r'\s*\(\d{4}\)\s*$', '', cleaned)

    # Remove tour names in parentheses
    cleaned = re.sub(r'\s*\([^)]*[Tt]our[^)]*\)\s*$', '', cleaned)

    # Clean up whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    # Validate: should be at least 2 characters and not just numbers
    if len(cleaned) < 2 or cleaned.isdigit():
        return None

    # Reject blocklisted words (instruments, generic terms, etc.)
    if cleaned.lower() in _ARTIST_BLOCKLIST:
        return None

    # Reject multi-word results where every word is blocklisted
    # (e.g., "Emory Collaborative Piano" — last word is instrument)
    words = cleaned.split()
    if len(words) > 1 and words[-1].lower() in _ARTIST_BLOCKLIST:
        return None

    # Reject single short generic words (< 4 chars) — likely not an artist name
    if len(cleaned) < 4 and " " not in cleaned:
        return None

    return cleaned


# ---------------------------------------------------------------------------
# MusicBrainz lookup
# ---------------------------------------------------------------------------

def _mb_name_matches(query: str, result_name: str) -> bool:
    """Check if a MusicBrainz result name reasonably matches our query.

    Compares lowercased names. Accepts if either contains the other,
    or if the first word matches (handles "Artist Name" vs "Artist Name Band").
    """
    q = query.lower().strip()
    r = result_name.lower().strip()

    # Exact match
    if q == r:
        return True

    # One contains the other
    if q in r or r in q:
        return True

    # First word matches (e.g. "Beyonce" vs "Beyoncé")
    q_first = q.split()[0] if q else ""
    r_first = r.split()[0] if r else ""
    if len(q_first) >= 3 and q_first == r_first:
        return True

    # Strip accents/diacritics for comparison
    import unicodedata
    q_norm = unicodedata.normalize("NFD", q)
    q_ascii = "".join(c for c in q_norm if unicodedata.category(c) != "Mn")
    r_norm = unicodedata.normalize("NFD", r)
    r_ascii = "".join(c for c in r_norm if unicodedata.category(c) != "Mn")
    if q_ascii == r_ascii or q_ascii in r_ascii or r_ascii in q_ascii:
        return True

    return False


def _search_musicbrainz(name: str) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """Search MusicBrainz for an artist, return (mbid, wikidata_qid, spotify_id, website).

    Makes 2 API calls: search + lookup with url-rels.
    """
    # Step 1: Search for artist
    _mb_rate_limit()
    try:
        resp = requests.get(
            "https://musicbrainz.org/ws/2/artist/",
            params={"query": f'artist:"{name}"', "limit": 1, "fmt": "json"},
            headers=_mb_headers(),
            timeout=10,
        )
        if resp.status_code != 200:
            logger.debug(f"MusicBrainz search returned {resp.status_code} for '{name}'")
            return None, None, None, None

        data = resp.json()
        artists = data.get("artists", [])
        if not artists:
            logger.debug(f"No MusicBrainz results for '{name}'")
            return None, None, None, None

        top = artists[0]
        score = top.get("score", 0)
        mb_name = top.get("name", "")

        # Require high confidence score
        if score < 80:
            logger.debug(f"MusicBrainz score too low for '{name}': {score} ('{mb_name}')")
            return None, None, None, None

        # Fuzzy name check — the returned name should resemble our query
        if not _mb_name_matches(name, mb_name):
            logger.debug(f"MusicBrainz name mismatch for '{name}': got '{mb_name}' (score {score})")
            return None, None, None, None

        mbid = top.get("id")
        if not mbid:
            return None, None, None, None

    except Exception as e:
        logger.debug(f"MusicBrainz search error for '{name}': {e}")
        return None, None, None, None

    # Step 2: Lookup with URL relationships to get Wikidata / Spotify / website links
    _mb_rate_limit()
    wikidata_qid = None
    spotify_id = None
    website = None

    try:
        resp = requests.get(
            f"https://musicbrainz.org/ws/2/artist/{mbid}",
            params={"inc": "url-rels", "fmt": "json"},
            headers=_mb_headers(),
            timeout=10,
        )
        if resp.status_code != 200:
            logger.debug(f"MusicBrainz lookup returned {resp.status_code} for mbid {mbid}")
            return mbid, None, None, None

        data = resp.json()
        for rel in data.get("relations", []):
            url_resource = rel.get("url", {}).get("resource", "")
            rel_type = rel.get("type", "")

            # Wikidata: https://www.wikidata.org/wiki/Q123456
            if "wikidata.org" in url_resource:
                match = re.search(r"(Q\d+)", url_resource)
                if match:
                    wikidata_qid = match.group(1)

            # Spotify: https://open.spotify.com/artist/XXXXX
            if "open.spotify.com/artist/" in url_resource:
                parts = url_resource.rstrip("/").split("/")
                if parts:
                    spotify_id = parts[-1]

            # Official homepage
            if rel_type == "official homepage" and not website:
                website = url_resource

    except Exception as e:
        logger.debug(f"MusicBrainz lookup error for mbid {mbid}: {e}")
        return mbid, None, None, None

    return mbid, wikidata_qid, spotify_id, website


# ---------------------------------------------------------------------------
# Wikidata lookup
# ---------------------------------------------------------------------------

def _wikidata_headers() -> dict[str, str]:
    """User-Agent header for Wikidata API (required to avoid 403)."""
    from config import config
    return {"User-Agent": config.crawler.user_agent}


def _fetch_wikidata_info(qid: str) -> tuple[Optional[list[str]], Optional[str], Optional[str]]:
    """Fetch genres (P136 labels), image filename (P18), and Wikipedia bio from Wikidata.

    Returns (genres, commons_filename, bio).
    """
    bio = None
    try:
        resp = requests.get(
            "https://www.wikidata.org/wiki/Special:EntityData/" + qid + ".json",
            headers=_wikidata_headers(),
            timeout=10,
        )
        if resp.status_code != 200:
            return None, None, None

        entity = resp.json().get("entities", {}).get(qid, {})
        claims = entity.get("claims", {})

        # P18 — image on Wikimedia Commons
        commons_filename = None
        p18 = claims.get("P18", [])
        if p18:
            mainsnak = p18[0].get("mainsnak", {})
            commons_filename = mainsnak.get("datavalue", {}).get("value")

        # P136 — genre (needs label resolution)
        genres = None
        p136 = claims.get("P136", [])
        if p136:
            genre_qids = []
            for claim in p136:
                genre_id = (
                    claim.get("mainsnak", {})
                    .get("datavalue", {})
                    .get("value", {})
                    .get("id")
                )
                if genre_id:
                    genre_qids.append(genre_id)

            if genre_qids:
                genres = _resolve_wikidata_labels(genre_qids)

        # Fetch Wikipedia intro bio
        bio = _fetch_wikipedia_bio(qid)

    except Exception as e:
        logger.debug(f"Wikidata fetch error for {qid}: {e}")
        return None, None, None

    return genres, commons_filename, bio


def _fetch_wikipedia_bio(wikidata_qid: str) -> Optional[str]:
    """Fetch the Wikipedia intro paragraph for an artist via the Wikidata sitelink.

    Uses the Wikidata entity to find the English Wikipedia article title,
    then fetches the intro extract via the MediaWiki API.

    Returns the first ~2000 chars of the Wikipedia intro, or None.
    """
    try:
        # Step 1: Get English Wikipedia sitelink from Wikidata entity
        resp = requests.get(
            f"https://www.wikidata.org/w/api.php",
            params={
                "action": "wbgetentities",
                "ids": wikidata_qid,
                "props": "sitelinks",
                "sitefilter": "enwiki",
                "format": "json",
            },
            headers=_wikidata_headers(),
            timeout=10,
        )
        if resp.status_code != 200:
            return None

        entity = resp.json().get("entities", {}).get(wikidata_qid, {})
        enwiki = entity.get("sitelinks", {}).get("enwiki", {})
        title = enwiki.get("title")
        if not title:
            return None

        # Step 2: Fetch intro extract from English Wikipedia
        resp = requests.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "titles": title,
                "prop": "extracts",
                "exintro": True,
                "explaintext": True,
                "format": "json",
            },
            headers=_wikidata_headers(),
            timeout=10,
        )
        if resp.status_code != 200:
            return None

        pages = resp.json().get("query", {}).get("pages", {})
        for page in pages.values():
            extract = page.get("extract", "")
            if extract and len(extract) >= 50:
                # Clean up and truncate
                bio = re.sub(r"\s+", " ", extract).strip()
                return bio[:2000]

    except Exception as e:
        logger.debug(f"Wikipedia bio fetch error for {wikidata_qid}: {e}")

    return None


def _resolve_wikidata_labels(qids: list[str]) -> Optional[list[str]]:
    """Resolve a list of Wikidata QIDs to English labels via wbgetentities."""
    if not qids:
        return None

    try:
        resp = requests.get(
            "https://www.wikidata.org/w/api.php",
            params={
                "action": "wbgetentities",
                "ids": "|".join(qids[:10]),  # cap at 10 genres
                "props": "labels",
                "languages": "en",
                "format": "json",
            },
            headers=_wikidata_headers(),
            timeout=10,
        )
        if resp.status_code != 200:
            return None

        data = resp.json()
        labels = []
        for qid in qids:
            entity = data.get("entities", {}).get(qid, {})
            label = entity.get("labels", {}).get("en", {}).get("value")
            if label:
                labels.append(label)

        return labels if labels else None

    except Exception as e:
        logger.debug(f"Wikidata label resolution error: {e}")
        return None


# ---------------------------------------------------------------------------
# Wikimedia Commons thumbnail
# ---------------------------------------------------------------------------

def _resolve_commons_thumbnail(filename: str, width: int = 500) -> str:
    """Build a Wikimedia Commons thumbnail URL from a filename.

    Uses the standard MD5-based URL scheme for thumbnails.
    """
    # Normalize: spaces → underscores
    filename = filename.replace(" ", "_")
    md5 = hashlib.md5(filename.encode("utf-8")).hexdigest()
    encoded = requests.utils.quote(filename)
    return (
        f"https://upload.wikimedia.org/wikipedia/commons/thumb/"
        f"{md5[0]}/{md5[0:2]}/{encoded}/{width}px-{encoded}"
    )


# ---------------------------------------------------------------------------
# Spotify fallback (dormant unless credentials are configured)
# ---------------------------------------------------------------------------

def _get_spotify_token() -> Optional[str]:
    """Get Spotify access token via client credentials flow.

    Returns None if no credentials are configured.
    """
    global _spotify_token, _spotify_token_expiry

    from config import config

    client_id = config.api.spotify_client_id
    client_secret = config.api.spotify_client_secret

    if not client_id or not client_secret:
        return None

    # Return cached token if still valid (with 60s buffer)
    if _spotify_token and time.time() < _spotify_token_expiry - 60:
        return _spotify_token

    try:
        resp = requests.post(
            "https://accounts.spotify.com/api/token",
            data={"grant_type": "client_credentials"},
            auth=(client_id, client_secret),
            timeout=10,
        )
        if resp.status_code != 200:
            logger.debug(f"Spotify token request failed: {resp.status_code}")
            return None

        data = resp.json()
        _spotify_token = data.get("access_token")
        _spotify_token_expiry = time.time() + data.get("expires_in", 3600)
        return _spotify_token

    except Exception as e:
        logger.debug(f"Spotify token error: {e}")
        return None


@dataclass
class SpotifyArtistData:
    """Data returned from Spotify artist endpoint."""
    image_url: Optional[str] = None
    genres: Optional[list[str]] = None


def _normalize_artist_identity(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def _search_spotify_artist_by_name(artist_name: str) -> tuple[Optional[str], SpotifyArtistData]:
    """Search Spotify by artist name and return best strict match.

    Used as a fallback when MusicBrainz cannot provide a Spotify ID.
    """
    result = SpotifyArtistData()
    token = _get_spotify_token()
    if not token:
        return None, result

    try:
        resp = requests.get(
            "https://api.spotify.com/v1/search",
            params={"q": f'artist:"{artist_name}"', "type": "artist", "limit": 5},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After", "5")
            logger.debug(f"Spotify search rate limited, retry after {retry_after}s")
            return None, result
        if resp.status_code != 200:
            logger.debug(f"Spotify search returned {resp.status_code} for '{artist_name}'")
            return None, result

        items = (resp.json().get("artists") or {}).get("items") or []
        if not items:
            return None, result

        query_norm = _normalize_artist_identity(artist_name)
        best_item = None
        best_score = -1

        for item in items:
            candidate_name = (item.get("name") or "").strip()
            if not candidate_name:
                continue
            if not _mb_name_matches(artist_name, candidate_name):
                continue

            candidate_norm = _normalize_artist_identity(candidate_name)
            popularity = int(item.get("popularity") or 0)
            exact_bonus = 100 if candidate_norm == query_norm else 0
            prefix_bonus = 30 if candidate_norm.startswith(query_norm) or query_norm.startswith(candidate_norm) else 0
            score = exact_bonus + prefix_bonus + popularity

            if score > best_score:
                best_score = score
                best_item = item

        if not best_item:
            return None, result

        spotify_id = best_item.get("id")
        if not spotify_id:
            return None, result

        images = best_item.get("images") or []
        if images:
            result.image_url = images[0].get("url")
        genres = best_item.get("genres") or []
        if genres:
            result.genres = [g.lower() for g in genres]

        return spotify_id, result

    except Exception as e:
        logger.debug(f"Spotify artist search error for '{artist_name}': {e}")
        return None, result


def _fetch_spotify_artist(spotify_id: str) -> SpotifyArtistData:
    """Fetch artist image and genres from Spotify.

    Returns SpotifyArtistData with whatever was available.
    """
    result = SpotifyArtistData()

    token = _get_spotify_token()
    if not token:
        return result

    try:
        resp = requests.get(
            f"https://api.spotify.com/v1/artists/{spotify_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After", "5")
            logger.debug(f"Spotify rate limited, retry after {retry_after}s")
            return result
        if resp.status_code != 200:
            logger.debug(f"Spotify artist lookup returned {resp.status_code}")
            return result

        data = resp.json()

        # Image — largest first
        images = data.get("images", [])
        if images:
            result.image_url = images[0].get("url")

        # Genres — Spotify's micro-genres (e.g. "atlanta indie", "chamber pop")
        genres = data.get("genres", [])
        if genres:
            result.genres = [g.lower() for g in genres]

    except Exception as e:
        logger.debug(f"Spotify artist fetch error: {e}")

    return result


def _fetch_spotify_image(spotify_id: str) -> Optional[str]:
    """Fetch the largest artist image from Spotify.

    Legacy wrapper — use _fetch_spotify_artist() for full data.
    """
    data = _fetch_spotify_artist(spotify_id)
    return data.image_url


# ---------------------------------------------------------------------------
# Main fetch pipeline
# ---------------------------------------------------------------------------

def fetch_artist_info(artist_name: str) -> Optional[ArtistInfo]:
    """
    Fetch artist info (image and genres) via MusicBrainz + Wikidata + Spotify.

    Pipeline:
      1. Search MusicBrainz → get MBID, Wikidata QID, Spotify ID
      2. Fetch Wikidata → genres, Commons image, Wikipedia bio
      3. Resolve Commons thumbnail → image URL
      4. Fetch Spotify → micro-genres, image fallback
      5. Merge genres (Spotify micro-genres + Wikidata broad labels)
      6. Return ArtistInfo

    Args:
        artist_name: Artist name to search for

    Returns:
        ArtistInfo with image URL and genres, or None if not found
    """
    # Check cache first
    cache_key = artist_name.lower()
    if cache_key in _artist_cache:
        return _artist_cache[cache_key]

    artist_info = None

    try:
        # Step 1: MusicBrainz search + lookup
        mbid, wikidata_qid, spotify_id, website = _search_musicbrainz(artist_name)

        image_url = None
        genres = None
        bio = None
        commons_filename = None

        # Step 2: Wikidata — genres, image, and Wikipedia bio
        if mbid and wikidata_qid:
            genres, commons_filename, bio = _fetch_wikidata_info(wikidata_qid)

            # Step 3: Resolve Commons thumbnail
            if commons_filename:
                image_url = _resolve_commons_thumbnail(commons_filename)

        spotify_data = SpotifyArtistData()

        # Step 4: Spotify — fetch by known ID, or fallback search by name.
        if spotify_id:
            spotify_data = _fetch_spotify_artist(spotify_id)
        else:
            # Fallback path catches artists not confidently matched in MusicBrainz.
            fallback_spotify_id, fallback_data = _search_spotify_artist_by_name(artist_name)
            if fallback_spotify_id:
                spotify_id = fallback_spotify_id
                spotify_data = fallback_data

        if not mbid and not spotify_id:
            _artist_cache[cache_key] = None
            return None

        if not image_url and spotify_data.image_url:
            image_url = spotify_data.image_url

        # Merge Spotify genres with Wikidata genres (Spotify first — more specific)
        if spotify_data.genres:
            wikidata_genres = genres or []
            merged = list(dict.fromkeys(spotify_data.genres + wikidata_genres))
            genres = merged
            logger.debug(f"Spotify genres for '{artist_name}': {spotify_data.genres}")

        # Step 5: Normalize all genres to our taxonomy (drops unknown labels)
        if genres:
            from genre_normalize import normalize_genres
            genres = normalize_genres(genres) or None

        artist_info = ArtistInfo(
            name=artist_name,
            image_url=image_url,
            genres=genres,
            bio=bio,
            website=website,
            musicbrainz_id=mbid,
            wikidata_id=wikidata_qid,
            spotify_id=spotify_id,
        )

        if image_url:
            logger.debug(f"Found image for '{artist_name}' (source: {'Commons' if commons_filename else 'Spotify'})")
        if genres:
            logger.debug(f"Found genres for '{artist_name}': {genres}")
        if bio:
            logger.debug(f"Found Wikipedia bio for '{artist_name}' ({len(bio)} chars)")

    except Exception as e:
        logger.debug(f"Error fetching artist info for '{artist_name}': {e}")

    # Cache the result (even if None)
    _artist_cache[cache_key] = artist_info

    # Also update legacy image cache for backwards compatibility
    if artist_info:
        _image_cache[cache_key] = artist_info.image_url

    return artist_info


def fetch_artist_image(artist_name: str) -> Optional[str]:
    """
    Fetch artist image URL.
    This is a convenience wrapper around fetch_artist_info for backwards compatibility.

    Args:
        artist_name: Artist name to search for

    Returns:
        Image URL or None if not found
    """
    # Check legacy cache first
    cache_key = artist_name.lower()
    if cache_key in _image_cache:
        return _image_cache[cache_key]

    info = fetch_artist_info(artist_name)
    return info.image_url if info else None


@dataclass
class MusicEventInfo:
    """Enhanced info for a music event."""
    image_url: Optional[str] = None
    genres: Optional[list[str]] = None
    artist_name: Optional[str] = None
    bio: Optional[str] = None  # Wikipedia intro for the headliner


def get_info_for_music_event(
    title: str,
    existing_image: Optional[str] = None,
    existing_genres: Optional[list[str]] = None
) -> MusicEventInfo:
    """
    Get artist image and genres for a music event.

    Args:
        title: The event title (will be parsed to extract artist name)
        existing_image: Existing image URL, if any
        existing_genres: Existing genres, if any

    Returns:
        MusicEventInfo with image URL and genres
    """
    result = MusicEventInfo(
        image_url=existing_image,
        genres=existing_genres
    )

    # If we already have both, return early
    if existing_image and existing_genres:
        return result

    # Try to extract artist and fetch info
    artist_name = extract_artist_from_title(title)
    result.artist_name = artist_name

    if artist_name:
        info = fetch_artist_info(artist_name)

        if info:
            # Only update what's missing
            if not result.image_url:
                result.image_url = info.image_url
            if not result.genres and info.genres:
                result.genres = info.genres
            if info.bio:
                result.bio = info.bio

    return result


def get_image_for_music_event(title: str, existing_image: Optional[str] = None) -> Optional[str]:
    """
    Get an artist image for a music event if one isn't already provided.
    This is a convenience wrapper for backwards compatibility.

    Args:
        title: The event title (will be parsed to extract artist name)
        existing_image: Existing image URL, if any

    Returns:
        Image URL (existing or fetched) or None
    """
    info = get_info_for_music_event(title, existing_image)
    return info.image_url


def clear_cache():
    """Clear the caches (useful for testing)."""
    global _image_cache, _artist_cache
    _image_cache = {}
    _artist_cache = {}
