"""
LLM fallback for extracting event detail fields from a single event page.
Use sparingly when structured/selector/heuristic extraction fails.
"""

from __future__ import annotations

import json
import logging

from llm_client import generate_text

logger = logging.getLogger(__name__)


DETAIL_PROMPT = """You are extracting event detail fields from a single event detail page.

RULES:
1. Extract ONLY information explicitly stated. Never invent details.
2. If a field is unclear or missing, use null.
3. Keep description under 500 characters and preserve original phrasing.
4. ticket_url should be a direct purchase or registration link when present.
5. image_url should be the primary event image (not logos or icons).
6. start_time/end_time must be "HH:MM" in 24-hour format. Look for "Doors", "Show", "Starts", or time ranges.

OUTPUT JSON:
{
  "description": string | null,
  "image_url": string | null,
  "ticket_url": string | null,
  "start_time": "HH:MM" | null,
  "end_time": "HH:MM" | null,
  "price_min": number | null,
  "price_max": number | null,
  "price_note": string | null,
  "is_free": boolean,
  "artists": string[] | null
}
"""


def extract_detail_with_llm(html: str, url: str, source_name: str) -> dict:
    if not html:
        return {}

    user_message = f"""Source: {source_name}
URL: {url}

Content:
{html[:50000]}
"""

    try:
        response_text = generate_text(DETAIL_PROMPT, user_message)
        json_str = response_text
        if "```json" in response_text:
            json_str = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            json_str = response_text.split("```")[1].split("```")[0]

        try:
            data = json.loads(json_str)
        except json.JSONDecodeError:
            import re
            fixed = re.sub(r",\s*([}\]])", r"\1", json_str)
            data = json.loads(fixed)

        if not isinstance(data, dict):
            return {}

        # Normalize confidence to 0-1 range (LLM sometimes returns 85 instead of 0.85)
        conf = data.get("confidence")
        if conf is not None and conf > 1:
            data["confidence"] = conf / 100.0

        return data

    except Exception as e:
        logger.debug(f"LLM detail extraction failed for {url}: {e}")
        return {}
