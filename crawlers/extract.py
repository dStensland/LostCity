"""
LLM-based event extraction.
Converts raw HTML/text into structured event data.
"""

import json
import logging
from typing import Optional
from pydantic import BaseModel

from llm_client import generate_text

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """You are an event data extraction system. Given raw text or HTML from an event listing, extract structured event data.

RULES:
1. Extract ONLY information explicitly stated. Never invent details.
2. If a field is unclear or missing, use null.
3. Dates should be ISO 8601 format (YYYY-MM-DD).
4. Times should be 24-hour format (HH:MM).
5. If the listing contains multiple events, return an array.
6. Set confidence as a decimal between 0.0 and 1.0 (e.g. 0.85, not 85) based on how complete/clear the source data was.
7. TIME VALIDATION: Be careful with AM/PM. Events between 1:00-5:00 AM are rare except for nightlife/music venues. If an event seems like daytime (workshops, volunteer events, family events) but parses to early AM, the source probably meant PM or there's an error - use null instead.
8. ALL-DAY EVENTS: Set is_all_day=true ONLY for events that genuinely span the entire day (festivals, exhibitions, markets, open houses). Do NOT set is_all_day=true just because a specific time is unknown. "Night", "Evening", "Afternoon" events are NOT all-day - set is_all_day=false and start_time=null if time is unknown.
9. YEAR INFERENCE: When a date has no year specified, use 2026 for dates from January-December. Only use a past year if the content explicitly shows a past year.
10. detail_url should be the canonical event detail page when available (not the ticketing checkout link).
11. If multiple performers are listed, include them in artists ordered with the headliner first.

CATEGORIES (pick one):
music, art, comedy, theater, film, sports, food_drink, nightlife, community, fitness, family, learning, dance, tours, meetup, words, religious, markets, wellness, gaming, outdoors, activism, other

SUBCATEGORIES for nightlife (use when applicable):
- nightlife.dj: DJ sets, dance nights
- nightlife.drag: Drag shows, drag brunch
- nightlife.strip: Strip clubs, gentlemen's clubs (e.g., Clermont Lounge, Magic City, Pink Pony)
- nightlife.burlesque: Burlesque shows, adult cabaret
- nightlife.lifestyle: Swingers clubs, lifestyle events (e.g., Trapeze)
- nightlife.revue: Male revues, adult entertainment shows (e.g., Swinging Richards)

ADULT CONTENT TAGGING:
For events at adult entertainment venues (strip clubs, lifestyle clubs, etc.), include these tags:
- "21+" or "18+" for age restriction
- "adult" for adult-oriented content
Add these automatically for known adult venues like Clermont Lounge, Magic City, Pink Pony, Trapeze, Swinging Richards, Oasis, etc.

SERIES DETECTION:
Some events are instances of a "series" - a recurring show or film playing multiple times/venues:
- Films at theaters (same movie, multiple showtimes)
- Recurring shows ("Tuesday Night Improv", "Open Mic Night")
- Touring acts passing through
- Class series (recurring workshops or courses with multiple sessions)
- Festival/conference programs (DragonCon panels, Film Fest screenings, conference tracks)

If the event appears to be part of a series, populate the series_hint field:
- series_type: "film" | "recurring_show" | "class_series" | "festival_program" | "tour" | null
- series_title: The canonical name of the series (movie title, show name)
- For class series: use the class/course name as series_title
- For festival/conference programs: set series_title to the program/track name if shown
- For films: include director, runtime_minutes, year, rating if available
 - For festival/conference programs: include festival_name if the parent festival is named

GENRES:
For film, music, theater, and sports events, identify relevant genres:
- Film: action, comedy, drama, horror, sci-fi, documentary, thriller, animation, romance, indie, cult, classic, etc.
- Music: rock, pop, hip-hop, jazz, electronic, country, metal, punk, indie, folk, classical, r&b, blues, etc.
- Theater: musical, drama, comedy, improv, stand-up, ballet, opera, puppet, burlesque, sketch, etc.
- Sports: baseball, basketball, football, soccer, hockey, mma, racing, esports, marathon, etc.
Include 1-3 most relevant genres. Use lowercase. Custom genres allowed if standard ones don't fit.

OUTPUT FORMAT:
Return valid JSON matching this schema:
{
  "events": [
    {
      "title": string,
      "description": string | null,
      "start_date": "YYYY-MM-DD",
      "start_time": "HH:MM" | null,
      "end_date": "YYYY-MM-DD" | null,
      "end_time": "HH:MM" | null,
      "is_all_day": boolean,
      "venue": {
        "name": string,
        "address": string | null,
        "neighborhood": string | null
      },
      "category": string,
      "subcategory": string | null,
      "tags": string[],
      "price_min": number | null,
      "price_max": number | null,
      "price_note": string | null,
      "is_free": boolean,
      "ticket_url": string | null,
      "detail_url": string | null,
      "image_url": string | null,
      "is_recurring": boolean,
      "recurrence_rule": string | null,
      "confidence": number,
      "artists": string[] | null,
      "genres": string[] | null,
      "series_hint": {
        "series_type": "film" | "recurring_show" | "class_series" | "festival_program" | "tour" | null,
        "series_title": string | null,
        "director": string | null,
        "runtime_minutes": number | null,
        "year": number | null,
        "rating": string | null,
        "frequency": string | null,
        "genres": string[] | null,
        "festival_name": string | null
      } | null
    }
  ]
}"""


class VenueData(BaseModel):
    """Extracted venue information."""
    name: str
    address: Optional[str] = None
    neighborhood: Optional[str] = None


class SeriesHint(BaseModel):
    """Hints for identifying series membership."""
    series_type: Optional[str] = None  # film, recurring_show, class_series, festival_program, tour
    series_title: Optional[str] = None  # Canonical name (movie title, show name)
    director: Optional[str] = None  # For films
    runtime_minutes: Optional[int] = None  # For films
    year: Optional[int] = None  # For films
    rating: Optional[str] = None  # PG, R, etc.
    frequency: Optional[str] = None  # weekly, monthly, etc. for recurring
    genres: list[str] = []  # Genre tags for the series
    festival_name: Optional[str] = None  # Parent festival/conference name (if applicable)


class EventData(BaseModel):
    """Extracted event information."""
    title: str
    description: Optional[str] = None
    start_date: str
    start_time: Optional[str] = None
    end_date: Optional[str] = None
    end_time: Optional[str] = None
    is_all_day: bool = False
    venue: VenueData
    category: str
    subcategory: Optional[str] = None
    tags: list[str] = []
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    price_note: Optional[str] = None
    is_free: bool = False
    ticket_url: Optional[str] = None
    detail_url: Optional[str] = None
    image_url: Optional[str] = None
    is_recurring: bool = False
    recurrence_rule: Optional[str] = None
    confidence: float
    artists: list[str] = []
    genres: list[str] = []  # Genre tags for standalone events
    series_hint: Optional[SeriesHint] = None


class ExtractionResult(BaseModel):
    """Result of extraction."""
    events: list[EventData]


def _strip_html_boilerplate(html: str) -> str:
    """Strip scripts, styles, and other non-content elements from HTML.

    This dramatically reduces token count so the LLM sees actual event
    content rather than kilobytes of CSS/JS boilerplate.
    """
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "lxml")
        for tag in soup.find_all(["script", "style", "noscript", "link", "meta", "svg", "iframe"]):
            tag.decompose()
        # Remove head entirely — it's all metadata
        if soup.head:
            soup.head.decompose()
        # Remove nav/footer which rarely contain event data
        for tag in soup.find_all(["nav", "footer"]):
            tag.decompose()
        return str(soup)
    except Exception:
        # Fallback: return raw content if BeautifulSoup fails
        return html


def extract_events(
    raw_content: str,
    source_url: str,
    source_name: str
) -> list[EventData]:
    """
    Extract structured event data from raw HTML/text content.

    Args:
        raw_content: The raw HTML or text to extract from
        source_url: URL where the content came from
        source_name: Name of the source for context

    Returns:
        List of extracted EventData objects
    """
    cleaned = _strip_html_boilerplate(raw_content)

    user_message = f"""Source: {source_name}
URL: {source_url}

Content to extract:
{cleaned[:50000]}"""  # Truncate very long content

    try:
        response_text = generate_text(EXTRACTION_PROMPT, user_message)

        # Try to extract JSON from response
        json_str = response_text
        if "```json" in response_text:
            json_str = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            json_str = response_text.split("```")[1].split("```")[0]

        # Try to parse, with fallback for trailing commas
        try:
            data = json.loads(json_str)
        except json.JSONDecodeError:
            # Try fixing common issues: trailing commas, unquoted keys
            import re
            # Remove trailing commas before } or ]
            fixed = re.sub(r',\s*([}\]])', r'\1', json_str)
            data = json.loads(fixed)

        # Clean up event data - filter out events with missing required fields
        valid_events = []
        for event_data in data.get("events", []):
            # Skip events without a date
            if not event_data.get("start_date"):
                logger.debug(f"Skipping event without date: {event_data.get('title', 'Unknown')}")
                continue

            # Ensure venue has a name
            if event_data.get("venue") and not event_data["venue"].get("name"):
                # Use source name as venue name
                event_data["venue"]["name"] = "Unknown Venue"

            # Set defaults for missing boolean/list fields
            if event_data.get("is_free") is None:
                event_data["is_free"] = False
            if event_data.get("is_all_day") is None:
                event_data["is_all_day"] = False
            if event_data.get("is_recurring") is None:
                event_data["is_recurring"] = False
            if event_data.get("artists") is None:
                event_data["artists"] = []
            if event_data.get("genres") is None:
                event_data["genres"] = []
            if event_data.get("tags") is None:
                event_data["tags"] = []

            # Clean up series_hint
            if event_data.get("series_hint"):
                if event_data["series_hint"].get("genres") is None:
                    event_data["series_hint"]["genres"] = []

            # Normalize confidence to 0-1 range (LLM sometimes returns percentages like 85)
            conf = event_data.get("confidence")
            if conf is not None and conf > 1:
                event_data["confidence"] = conf / 100.0

            valid_events.append(event_data)

        data["events"] = valid_events
        result = ExtractionResult(**data)

        logger.info(f"Extracted {len(result.events)} events from {source_name}")
        return result.events

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {e}")
        return []
    except Exception as e:
        logger.error(f"Extraction failed for {source_url}: {e}")
        return []


def extract_events_batch(
    items: list[tuple[str, str]],
    source_name: str
) -> list[EventData]:
    """
    Extract events from multiple content items.

    Args:
        items: List of (raw_content, source_url) tuples
        source_name: Name of the source

    Returns:
        Combined list of all extracted events
    """
    all_events = []
    for raw_content, source_url in items:
        events = extract_events(raw_content, source_url, source_name)
        all_events.extend(events)
    return all_events
