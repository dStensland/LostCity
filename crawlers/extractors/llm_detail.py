"""
LLM fallback for extracting event detail fields from a single event page.
Use sparingly when structured/selector/heuristic extraction fails.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from anthropic import Anthropic

from config import get_config

logger = logging.getLogger(__name__)


DETAIL_PROMPT = """You are extracting event detail fields from a single event detail page.

RULES:
1. Extract ONLY information explicitly stated. Never invent details.
2. If a field is unclear or missing, use null.
3. Keep description under 500 characters and preserve original phrasing.
4. ticket_url should be a direct purchase or registration link when present.
5. image_url should be the primary event image (not logos or icons).

OUTPUT JSON:
{
  "description": string | null,
  "image_url": string | null,
  "ticket_url": string | null,
  "price_min": number | null,
  "price_max": number | null,
  "price_note": string | null,
  "is_free": boolean,
  "artists": string[] | null
}
"""


_client: Optional[Anthropic] = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        cfg = get_config()
        _client = Anthropic(api_key=cfg.llm.anthropic_api_key)
    return _client


def extract_detail_with_llm(html: str, url: str, source_name: str) -> dict:
    if not html:
        return {}

    cfg = get_config()
    client = _get_client()

    user_message = f"""Source: {source_name}
URL: {url}

Content:
{html[:50000]}
"""

    try:
        response = client.messages.create(
            model=cfg.llm.model,
            max_tokens=cfg.llm.max_tokens,
            temperature=cfg.llm.temperature,
            system=DETAIL_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        response_text = response.content[0].text
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

        return data if isinstance(data, dict) else {}

    except Exception as e:
        logger.debug(f"LLM detail extraction failed for {url}: {e}")
        return {}
