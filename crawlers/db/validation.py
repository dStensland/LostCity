"""
Event and title validation, sanitization, and category normalization.
"""

import re
import html
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple
from urllib.parse import urlparse
from bs4 import BeautifulSoup

from db.client import (
    _validation_stats,
    smart_title_case,
    _normalize_image_url,
    _normalize_source_url,
)
from date_utils import MAX_FUTURE_DAYS_DEFAULT
from tags import VALID_CATEGORIES

logger = logging.getLogger(__name__)

_FESTIVAL_SCHEDULE_FUTURE_DAYS = 400

# ===== AGGREGATOR GUARD =====

PROHIBITED_SOURCE_DOMAINS = {
    "badslava.com",
    "artsatl.org",
    "creativeloafing.com",
    "discoveratlanta.com",
    "discoversouthside.com",
    "timeout.com",
    "accessatlanta.com",
    "nashvillescene.com",
}


def _reject_aggregator_source_url(source_url: Optional[str]) -> None:
    """Raise ValueError if source_url points to a known aggregator/curator domain."""
    if not source_url:
        return
    try:
        domain = urlparse(source_url).netloc.lower().lstrip("www.")
        for prohibited in PROHIBITED_SOURCE_DOMAINS:
            if prohibited in domain:
                raise ValueError(
                    f"source_url points to prohibited aggregator '{domain}' — "
                    f"crawl the original venue source instead"
                )
    except ValueError:
        raise
    except Exception:
        pass


# ===== TEXT SANITIZATION =====

def sanitize_text(text: str) -> str:
    """
    Sanitize text field by stripping whitespace, removing HTML tags,
    decoding HTML entities, and normalizing whitespace.

    Also strips navigation breadcrumb artifacts like "Home >> Events >> Details"
    and repeated '>' characters that appear from unescaped HTML entities or
    markdown-style blockquotes in scraped web content.
    """
    if not text:
        return text

    text = html.unescape(html.unescape(str(text).strip()))
    if "<" in text and ">" in text:
        soup = BeautifulSoup(text, "html.parser")
        for br in soup.find_all("br"):
            br.replace_with(" ")
        text = soup.get_text(separator=" ")

    text = text.replace("\xa0", " ")

    # Strip navigation breadcrumb artifacts: "Home >> Events >> Details"
    # These appear when breadcrumb/path text is captured as event descriptions.
    # Match one or more words separated by >> sequences, with optional surrounding
    # whitespace — but only when the pattern dominates the whole string or a line.
    # Strategy: remove >> separators and collapse what remains into clean text,
    # but only when >> appears as a separator (not inside legitimate content).
    # Simple rule: replace any " >> " or ">> " or " >>" with " " (space-separated breadcrumbs),
    # then strip any leading/trailing lone '>' characters left over.
    text = re.sub(r"\s*>>\s*", " ", text)
    # Remove stray runs of '>' that aren't part of HTML (already stripped above)
    text = re.sub(r">{2,}", " ", text)
    # Remove a lone leading '>' (markdown blockquote artifact)
    text = re.sub(r"^>\s*", "", text)

    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(r"\(\s+", "(", text)
    text = re.sub(r"\s+\)", ")", text)
    text = re.sub(r"\s+", " ", text)

    return text.strip()


# ===== EVENT VALIDATION =====

def validate_event(event_data: dict) -> Tuple[bool, Optional[str], list[str]]:
    """
    Validate event data before insertion into database.

    Returns:
        Tuple of (is_valid, rejection_reason, warnings)
    """
    _validation_stats.total_validated += 1

    warnings = []

    title = event_data.get("title", "")
    if not title or not title.strip():
        _validation_stats.record_rejection("missing_title")
        return False, "Missing or empty title", warnings

    title = title.strip()

    if len(title) > 500:
        _validation_stats.record_rejection("title_too_long")
        return False, f"Title exceeds 500 characters ({len(title)} chars)", warnings

    start_date = event_data.get("start_date")
    if not start_date:
        _validation_stats.record_rejection("missing_start_date")
        return False, "Missing start_date", warnings

    try:
        date_obj = datetime.strptime(start_date, "%Y-%m-%d")
    except (ValueError, TypeError):
        _validation_stats.record_rejection("invalid_date_format")
        return (
            False,
            f"Invalid date format: {start_date} (expected YYYY-MM-DD)",
            warnings,
        )

    if not event_data.get("source_id"):
        _validation_stats.record_rejection("missing_source_id")
        return False, "Missing source_id", warnings

    today = datetime.now().date()
    event_date = date_obj.date()
    max_future_days = MAX_FUTURE_DAYS_DEFAULT

    try:
        from db.sources import get_source_info

        source_info = get_source_info(event_data["source_id"]) or {}
        integration_method = str(source_info.get("integration_method") or "").strip().lower()
        if integration_method == "festival_schedule":
            # Official annual program pages often publish next-cycle dates ~10-12 months ahead.
            max_future_days = max(max_future_days, _FESTIVAL_SCHEDULE_FUTURE_DAYS)
    except Exception:
        pass

    if event_date > today + timedelta(days=max_future_days):
        _validation_stats.record_rejection("date_too_far_future")
        return (
            False,
            (
                f"Date >{max_future_days} days in future "
                f"(likely parsing bug): {start_date} - {title}"
            ),
            warnings,
        )

    end_date_str = event_data.get("end_date")
    if end_date_str:
        try:
            end_date_obj = datetime.strptime(end_date_str, "%Y-%m-%d")
            span_days = (end_date_obj.date() - event_date).days
            if span_days > 30:
                explicit_kind = str(event_data.get("content_kind") or "").strip().lower()
                if explicit_kind != "event":
                    _LONG_SPAN_OK_RE = re.compile(
                        r"(festival|conference|convention|fair|summit|expo|marathon|relay)",
                        re.IGNORECASE,
                    )
                    if not _LONG_SPAN_OK_RE.search(title):
                        event_data["content_kind"] = "exhibit"
                        warnings.append(
                            f"Classified as exhibit (spans {span_days} days): {title}"
                        )
                        _validation_stats.record_warning("long_span_exhibit")
        except (ValueError, TypeError):
            pass

    start_time = event_data.get("start_time")
    is_all_day = event_data.get("is_all_day", False)

    # Midnight sentinel: 00:00:00 is almost always "time unknown", not a real midnight event.
    # Real midnight events (NYE parties) should set is_all_day=True instead.
    if start_time == "00:00:00" and not is_all_day:
        event_data["start_time"] = None
        start_time = None
        warnings.append("Cleared midnight sentinel time (00:00:00)")
        _validation_stats.record_warning("midnight_time_cleared")

    if not start_time and not is_all_day:
        warnings.append(f"Missing start_time (not all-day): {title}")
        _validation_stats.record_warning("missing_start_time")

    if event_date < today - timedelta(days=1):
        warnings.append(f"Date is in the past: {start_date}")
        _validation_stats.record_warning("past_date")

    # Strip status indicators (SOLD OUT, CANCELLED, etc.) from title
    _STATUS_TITLE_RE = re.compile(
        r'(?:^\s*(?:SOLD\s*OUT|CANCELLED|POSTPONED|RESCHEDULED)\s*[-:!]\s*)'
        r'|(?:\s*[-:]\s*(?:SOLD\s*OUT|CANCELLED|POSTPONED|RESCHEDULED)\s*$)'
        r'|(?:\s*[\[(](?:SOLD\s*OUT|CANCELLED|POSTPONED|RESCHEDULED)[\])]\s*)',
        re.IGNORECASE,
    )
    _status_match = _STATUS_TITLE_RE.search(title)
    if _status_match:
        matched_text = _status_match.group(0).strip().lower()
        cleaned_title = _STATUS_TITLE_RE.sub('', title).strip()
        if cleaned_title:
            event_data["title"] = cleaned_title
            title = cleaned_title
            if 'sold' in matched_text and 'out' in matched_text:
                event_data["ticket_status"] = "sold-out"
            warnings.append(f"Stripped status indicator from title: {_status_match.group(0).strip()}")
            _validation_stats.record_warning("status_stripped_from_title")

    if title.isupper() and len(title) > 5:
        event_data["title"] = smart_title_case(title)
        warnings.append("All-caps title converted to title case")
        _validation_stats.record_warning("all_caps_title")

    description = event_data.get("description")
    if description and len(description) > 5000:
        event_data["description"] = description[:4997] + "..."
        warnings.append(f"Description truncated from {len(description)} to 5000 chars")
        _validation_stats.record_warning("description_truncated")

    price_min = event_data.get("price_min")
    price_max = event_data.get("price_max")

    if price_min is not None:
        try:
            price_min_val = float(price_min)
            if price_min_val < 0 or price_min_val > 10000:
                warnings.append(f"price_min out of range: {price_min_val}")
                _validation_stats.record_warning("invalid_price_min")
                event_data["price_min"] = None
        except (ValueError, TypeError):
            warnings.append(f"Invalid price_min: {price_min}")
            _validation_stats.record_warning("invalid_price_min")
            event_data["price_min"] = None

    if price_max is not None:
        try:
            price_max_val = float(price_max)
            if price_max_val < 0 or price_max_val > 10000:
                warnings.append(f"price_max out of range: {price_max_val}")
                _validation_stats.record_warning("invalid_price_max")
                event_data["price_max"] = None
        except (ValueError, TypeError):
            warnings.append(f"Invalid price_max: {price_max}")
            _validation_stats.record_warning("invalid_price_max")
            event_data["price_max"] = None

    # A1: Auto-fix price inversions (min > max → swap)
    if event_data.get("price_min") is not None and event_data.get("price_max") is not None:
        try:
            min_v, max_v = float(event_data["price_min"]), float(event_data["price_max"])
            if min_v > max_v:
                event_data["price_min"], event_data["price_max"] = max_v, min_v
                warnings.append(f"Swapped inverted prices: {min_v} > {max_v}")
                _validation_stats.record_warning("price_inversion_fixed")
        except (ValueError, TypeError):
            pass

    # A2: Flag suspicious high prices (> $500) as warning
    for _price_field in ("price_min", "price_max"):
        _price_val = event_data.get(_price_field)
        if _price_val is not None:
            try:
                if float(_price_val) > 500:
                    warnings.append(f"Suspicious {_price_field}: ${float(_price_val):.0f}")
                    _validation_stats.record_warning("suspicious_price")
            except (ValueError, TypeError):
                pass

    sanitized_title = sanitize_text(title)
    if sanitized_title != title:
        event_data["title"] = sanitized_title
        _validation_stats.record_warning("title_sanitized")

    if description:
        sanitized_desc = sanitize_text(description)
        if sanitized_desc != description:
            event_data["description"] = sanitized_desc
            _validation_stats.record_warning("description_sanitized")

    if "venue_name" in event_data and event_data["venue_name"]:
        sanitized_venue = sanitize_text(event_data["venue_name"])
        if sanitized_venue != event_data["venue_name"]:
            event_data["venue_name"] = sanitized_venue
            _validation_stats.record_warning("venue_name_sanitized")

    _validation_stats.record_pass()
    return True, None, warnings


def validate_event_title(title: str) -> bool:
    """Reject obviously bad event titles (nav elements, descriptions, junk).
    Returns True if valid, False if title should be rejected."""
    if not title or not title.strip():
        return False

    title = title.strip()

    if len(title) < 3 or len(title) > 200:
        return False

    junk_exact = {
        "learn more", "host an event", "upcoming events", "see details", "buy tickets",
        "click here", "read more", "view all", "sign up", "subscribe", "follow us",
        "contact us", "more info", "register", "rsvp", "get tickets", "see more",
        "shows", "about us", "skip to content", "skip to main content",
        "events search and views navigation", "google calendar", "event calendar",
        "events list view", "upcoming shows", "all dates", "all events", "all locations",
        "event type", "event location", "this month", "select date.", "sold out",
        "our calendar of shows and events", "corporate partnerships", "big futures",
        "match resources",
        # Placeholder/TBA titles
        "tba", "tbd", "tbc", "t.b.a.", "t.b.d.", "to be announced",
        "to be determined", "to be confirmed", "event tba", "event tbd", "show tba",
        "show tbd", "artist tba", "performer tba", "special event", "special event tba",
        "private event", "closed", "closed for private event", "n/a", "none",
        "book now", "buy now", "get tickets now", "reserve now", "events", "event",
        "shows", "calendar", "schedule", "add to calendar", "add to my calendar",
        "support", "donate", "home", "menu", "gallery", "news", "blog", "press",
        "membership", "shop", "store", "faq", "info", "details", "view details",
        "view event", "more details", "more information",
        # Concession/promo items
        "view fullsize", "more details", "gnashcash",
        "value pack hot dog & soda", "value pack hot dog and soda",
        # Test/placeholder events
        "test event", "test event - do not purchase", "do not purchase",
    }
    if title.lower().strip() in junk_exact:
        return False

    # Test event patterns (regex)
    if re.match(r'^test\s*[-:]?\s*event', title, re.IGNORECASE):
        return False
    if re.search(r'do\s+not\s+purchase', title, re.IGNORECASE):
        return False

    if re.match(r"^https?://", title, re.IGNORECASE):
        return False

    if re.match(r"^(advance ticket sales|current production)", title, re.IGNORECASE):
        return False

    if re.match(r"^(MON|TUE|WED|THU|FRI|SAT|SUN),\s+\w+\s+\d", title):
        return False

    stripped = re.sub(r"[^a-zA-Z0-9\s]", "", title).strip()
    if stripped.upper() in {"TBA", "TBD", "TBC"}:
        return False

    if re.match(
        r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$",
        title,
        re.IGNORECASE,
    ):
        return False

    if re.match(
        r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}",
        title,
        re.IGNORECASE,
    ):
        return False

    if re.match(
        r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December|"
        r"Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d",
        title,
        re.IGNORECASE,
    ):
        return False

    if re.match(
        r"^(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"\d{1,2}(st|nd|rd|th)?,?\s*\d{0,4}\s*!?$",
        title,
        re.IGNORECASE,
    ):
        return False

    if re.match(
        r"^(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(Activities|Events|Calendar|Schedule|Programs|Classes|\d{4})$",
        title.strip(),
        re.IGNORECASE,
    ):
        return False

    if re.match(r"^\d{4}-\d{2}-\d{2}$", title):
        return False

    if re.match(
        r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\d{6}$",
        title,
        re.IGNORECASE,
    ):
        return False

    if re.match(r"^(\w{3,})\1$", title, re.IGNORECASE):
        return False

    if re.match(r"^\d+\s*events?\d+$", title, re.IGNORECASE):
        return False

    if re.match(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\d+$", title, re.IGNORECASE):
        return False

    if re.match(
        r"^\d{1,2}\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b"
        r"\s*,?\s*(January|February|March|April|May|June|July|August|September|October|November|December|"
        r"Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,?\s+\d{4})?\s*$",
        title,
        re.IGNORECASE,
    ):
        return False

    if re.match(r"^[\d\-\(\)\.\s]{7,}$", title):
        return False

    if re.match(r"^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$", title):
        return False

    if title.rstrip().endswith("(Copy)"):
        return False

    if re.match(
        r"^(Mondays|Tuesdays|Wednesdays|Thursdays|Fridays|Saturdays|Sundays),?\s+\d",
        title,
        re.IGNORECASE,
    ):
        return False

    if re.match(
        r"^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$",
        title,
        re.IGNORECASE,
    ):
        return False

    if re.match(
        r"^\w+ \d+,?\s*\d{4}\s+to\s+\w+ \d+",
        title,
        re.IGNORECASE,
    ):
        return False

    if title.strip().lower() == "recurring":
        return False

    if re.match(r"^\d+ events?,\d+$", title, re.IGNORECASE):
        return False

    desc_starts = [
        "every monday", "every tuesday", "every wednesday", "every thursday",
        "every friday", "every saturday", "every sunday",
        'join us for "navigating', "registration for this free event",
        "keep your pet happy", "come join the tipsy", "viewing 1-",
        "click here to download",
    ]
    title_lower = title.lower()
    for pattern in desc_starts:
        if title_lower.startswith(pattern):
            return False

    return True


# ===== CATEGORY NORMALIZATION =====

_CATEGORY_NORMALIZATION_MAP: dict[str, str] = {
    "arts": "art",
    "activism": "community",
    "cultural": "community",
    "dance": "learning",
    "tours": "learning",
    "meetup": "community",
    "gaming": "community",
    "markets": "community",
    "haunted": "nightlife",
    "eatertainment": "nightlife",
    "entertainment": "family",
    "food": "food_drink",
    "yoga": "fitness",
    "cooking": "learning",
    "class": "learning",
    "outdoor": "outdoors",
    "museums": "art",
    "shopping": "community",
    "education": "learning",
    "sports_recreation": "sports",
    "health": "wellness",
    "programs": "family",
}


def normalize_category(category):
    """Normalize a category value to the canonical taxonomy."""
    if not category:
        return category
    return _CATEGORY_NORMALIZATION_MAP.get(category, category)


# ===== CONTENT KIND INFERENCE =====

_CONTENT_KIND_ALLOWED = {"event", "exhibit", "special"}
_EXHIBIT_SIGNAL_TAGS = {
    "exhibit", "exhibition", "museum", "gallery", "installation", "on-view", "on_view",
}
_SPECIAL_SIGNAL_TAGS = {"special", "specials", "happy-hour", "happy_hour"}
_EXHIBIT_SIGNAL_RE = re.compile(
    r"(exhibit|exhibition|on view|collection|installation|permanent)",
    flags=re.IGNORECASE,
)

_ATTRACTION_TITLES = {
    "summit skyride", "scenic railroad", "dinosaur explore", "skyhike", "mini golf",
    "general admission", "play at the museum", "geyser tower", "farmyard", "4-d theater",
    "duck adventures", "adventure golf", "gemstone mining", "nature playground",
    "splash pad", "permanent collection", "river roots science stations",
    "weekend activities", "birdseed fundraiser pick up",
}
_ATTRACTION_TITLE_RE = re.compile(
    r"^(general\s+admission\b|daily\s+operation)",
    flags=re.IGNORECASE,
)


def infer_content_kind(
    event_data: dict,
    series_hint: Optional[dict] = None,
    source_slug: Optional[str] = None,
) -> str:
    """Infer event content kind for feed-level filtering and UX treatment."""
    explicit_value = str(event_data.get("content_kind") or "").strip().lower()
    if explicit_value in _CONTENT_KIND_ALLOWED:
        return explicit_value

    series_type = (
        str(
            (series_hint or {}).get("series_type")
            or (
                (event_data.get("series") or {})
                if isinstance(event_data.get("series"), dict)
                else {}
            ).get("series_type")
            or ""
        )
        .strip()
        .lower()
    )
    if series_type == "exhibition":
        return "exhibit"

    tags = {str(tag).strip().lower() for tag in (event_data.get("tags") or [])}
    genres = {str(genre).strip().lower() for genre in (event_data.get("genres") or [])}
    searchable_text = " ".join(
        filter(
            None,
            [
                str(event_data.get("title") or ""),
                str(event_data.get("description") or ""),
                str((series_hint or {}).get("series_title") or ""),
            ],
        )
    )

    if tags & _EXHIBIT_SIGNAL_TAGS or genres & _EXHIBIT_SIGNAL_TAGS:
        return "exhibit"
    if _EXHIBIT_SIGNAL_RE.search(searchable_text):
        return "exhibit"

    title = str(event_data.get("title") or "").strip().lower()
    if title in _ATTRACTION_TITLES or _ATTRACTION_TITLE_RE.match(title):
        return "exhibit"

    return "event"
