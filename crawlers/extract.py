"""
LLM-based event extraction using Claude.
Converts raw HTML/text into structured event data.
"""

import json
import logging
from typing import Optional
from anthropic import Anthropic
from pydantic import BaseModel
from config import get_config

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """You are an event data extraction system. Given raw text or HTML from an event listing, extract structured event data.

RULES:
1. Extract ONLY information explicitly stated. Never invent details.
2. If a field is unclear or missing, use null.
3. Dates should be ISO 8601 format (YYYY-MM-DD).
4. Times should be 24-hour format (HH:MM).
5. If the listing contains multiple events, return an array.
6. Set confidence score based on how complete/clear the source data was.
7. TIME VALIDATION: Be careful with AM/PM. Events between 1:00-5:00 AM are rare except for nightlife/music venues. If an event seems like daytime (workshops, volunteer events, family events) but parses to early AM, the source probably meant PM or there's an error - use null instead.
8. For all-day events (no specific time), set is_all_day to true and start_time to null.

CATEGORIES (pick one):
music, art, comedy, theater, film, sports, food_drink, nightlife, community, fitness, family, learning, dance, tours, meetup, words, religious, markets, wellness, gaming, outdoors, other

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
      "image_url": string | null,
      "is_recurring": boolean,
      "recurrence_rule": string | null,
      "confidence": number
    }
  ]
}"""


class VenueData(BaseModel):
    """Extracted venue information."""
    name: str
    address: Optional[str] = None
    neighborhood: Optional[str] = None


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
    image_url: Optional[str] = None
    is_recurring: bool = False
    recurrence_rule: Optional[str] = None
    confidence: float


class ExtractionResult(BaseModel):
    """Result of extraction."""
    events: list[EventData]


_client: Optional[Anthropic] = None


def get_anthropic_client() -> Anthropic:
    """Get or create Anthropic client."""
    global _client
    if _client is None:
        cfg = get_config()
        _client = Anthropic(api_key=cfg.llm.anthropic_api_key)
    return _client


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
    cfg = get_config()
    client = get_anthropic_client()

    user_message = f"""Source: {source_name}
URL: {source_url}

Content to extract:
{raw_content[:50000]}"""  # Truncate very long content

    try:
        response = client.messages.create(
            model=cfg.llm.model,
            max_tokens=cfg.llm.max_tokens,
            temperature=cfg.llm.temperature,
            system=EXTRACTION_PROMPT,
            messages=[{"role": "user", "content": user_message}]
        )

        # Parse the response
        response_text = response.content[0].text

        # Try to extract JSON from response
        json_str = response_text
        if "```json" in response_text:
            json_str = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            json_str = response_text.split("```")[1].split("```")[0]

        data = json.loads(json_str)
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
