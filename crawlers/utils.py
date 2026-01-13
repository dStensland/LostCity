"""
Utility functions for Lost City crawlers.
"""

from __future__ import annotations

import re
import time
import logging
from functools import wraps
from typing import Callable, TypeVar, Optional, Dict, Tuple
from typing_extensions import ParamSpec
from datetime import datetime, timedelta
import requests
from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_exponential
from config import get_config

logger = logging.getLogger(__name__)

P = ParamSpec("P")
T = TypeVar("T")


def setup_logging() -> None:
    """Configure logging for the crawler."""
    cfg = get_config()
    logging.basicConfig(
        level=getattr(logging, cfg.log_level),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def parse_price(price_text: str) -> Tuple[Optional[float], Optional[float], Optional[str]]:
    """
    Parse price text into min/max values and note.

    Returns:
        Tuple of (price_min, price_max, price_note)
    """
    if not price_text:
        return None, None, None

    price_text = price_text.strip().lower()

    # Check for free
    if "free" in price_text:
        return 0, 0, "Free"

    # Find all dollar amounts
    amounts = re.findall(r"\$?(\d+(?:\.\d{2})?)", price_text)

    if not amounts:
        return None, None, price_text

    amounts = [float(a) for a in amounts]

    if len(amounts) == 1:
        return amounts[0], amounts[0], None

    return min(amounts), max(amounts), None


def parse_relative_date(text: str) -> Optional[datetime]:
    """
    Parse relative date text like 'Tomorrow', 'Next Saturday'.

    Returns:
        datetime object or None if not parseable
    """
    text = text.lower().strip()
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    if text == "today":
        return today
    elif text == "tomorrow":
        return today + timedelta(days=1)

    # Day names
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for i, day in enumerate(days):
        if day in text:
            current_day = today.weekday()
            days_ahead = i - current_day
            if days_ahead <= 0:  # Target day already happened this week
                days_ahead += 7
            if "next" in text:
                days_ahead += 7
            return today + timedelta(days=days_ahead)

    return None


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
def fetch_page(url: str, use_session: Optional[requests.Session] = None) -> str:
    """
    Fetch a web page with retries and rate limiting.

    Args:
        url: The URL to fetch
        use_session: Optional requests session to use

    Returns:
        The page HTML content
    """
    cfg = get_config()

    session = use_session or requests.Session()
    headers = {"User-Agent": cfg.crawler.user_agent}

    response = session.get(
        url,
        headers=headers,
        timeout=cfg.crawler.request_timeout
    )
    response.raise_for_status()

    return response.text


def extract_text_content(html: str) -> str:
    """Extract readable text from HTML, removing scripts and styles."""
    soup = BeautifulSoup(html, "lxml")

    # Remove script and style elements
    for element in soup(["script", "style", "nav", "footer", "header"]):
        element.decompose()

    # Get text
    text = soup.get_text(separator="\n")

    # Clean up whitespace
    lines = (line.strip() for line in text.splitlines())
    text = "\n".join(line for line in lines if line)

    return text


def rate_limit(min_interval: float) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """
    Decorator to enforce minimum interval between calls.

    Args:
        min_interval: Minimum seconds between calls
    """
    last_call: Dict[str, float] = {}

    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            key = func.__name__
            now = time.time()

            if key in last_call:
                elapsed = now - last_call[key]
                if elapsed < min_interval:
                    time.sleep(min_interval - elapsed)

            last_call[key] = time.time()
            return func(*args, **kwargs)

        return wrapper

    return decorator


def get_date_range(days_ahead: int = 14) -> Tuple[str, str]:
    """Get start and end dates for crawling."""
    today = datetime.now().date()
    end_date = today + timedelta(days=days_ahead)
    return today.isoformat(), end_date.isoformat()


# Categories that commonly have late-night/early-morning events
NIGHTLIFE_CATEGORIES = {"nightlife", "music", "comedy", "theater"}


def validate_event_time(
    time_str: Optional[str],
    category: Optional[str] = None,
    title: str = ""
) -> Tuple[Optional[str], bool]:
    """
    Validate an event time string and flag suspicious times.

    Times between 1am-5am are suspicious unless the event is
    tagged as nightlife, music, comedy, or theater.

    Args:
        time_str: Time in "HH:MM" 24-hour format
        category: Event category (e.g., "music", "community")
        title: Event title for logging

    Returns:
        Tuple of (validated_time_or_none, is_suspicious)
        - If time is valid and not suspicious: (time_str, False)
        - If time is suspicious but category allows: (time_str, True)
        - If time is suspicious and category doesn't allow: (None, True)
    """
    if not time_str:
        return None, False

    try:
        # Parse the time
        parts = time_str.split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0

        # Check if time is in the suspicious 1am-5am range
        if 1 <= hour < 6:
            cat_lower = (category or "").lower()

            # Allow early AM times for nightlife categories
            if cat_lower in NIGHTLIFE_CATEGORIES:
                logger.debug(f"Early AM time {time_str} allowed for {cat_lower}: {title}")
                return time_str, True

            # For other categories, this is likely a parsing error
            logger.warning(
                f"Suspicious time {time_str} for category '{category}': {title}. "
                f"Rejecting time (likely parsing error)."
            )
            return None, True

        # Time looks valid
        return time_str, False

    except (ValueError, IndexError) as e:
        logger.warning(f"Invalid time format '{time_str}': {e}")
        return None, False


def normalize_time_format(time_str: str) -> Optional[str]:
    """
    Normalize various time formats to HH:MM (24-hour).

    Handles:
    - "7:00 PM" -> "19:00"
    - "19:00:00" -> "19:00"
    - "7pm" -> "19:00"
    - "7:30pm" -> "19:30"

    Args:
        time_str: Time string in various formats

    Returns:
        Normalized time in "HH:MM" format, or None if unparseable
    """
    if not time_str:
        return None

    time_str = time_str.strip().upper()

    # Handle "HH:MM:SS" format - strip seconds
    if re.match(r"^\d{1,2}:\d{2}:\d{2}$", time_str):
        time_str = ":".join(time_str.split(":")[:2])
        return time_str

    # Handle "HH:MM" 24-hour format (already correct)
    if re.match(r"^\d{1,2}:\d{2}$", time_str):
        parts = time_str.split(":")
        return f"{int(parts[0]):02d}:{parts[1]}"

    # Handle "7:00 PM", "7:00PM", "7PM", "7 PM" formats
    match = re.match(r"^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$", time_str)
    if match:
        hour = int(match.group(1))
        minute = match.group(2) or "00"
        period = match.group(3)

        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"

    logger.debug(f"Could not normalize time format: {time_str}")
    return None
