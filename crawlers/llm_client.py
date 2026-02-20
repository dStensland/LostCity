"""
LLM client wrapper with provider selection (Anthropic or OpenAI).
"""

from __future__ import annotations

import logging
from typing import Optional

from config import get_config

logger = logging.getLogger(__name__)

_anthropic_client = None
_openai_client = None


def _llm_timeout_seconds() -> float:
    cfg = get_config()
    timeout = getattr(cfg.crawler, "request_timeout", 30)
    try:
        parsed = float(timeout)
    except (TypeError, ValueError):
        return 30.0
    return max(5.0, parsed)


def _llm_max_retries() -> int:
    cfg = get_config()
    retries = getattr(cfg.crawler, "max_retries", 2)
    try:
        parsed = int(retries)
    except (TypeError, ValueError):
        return 2
    return max(0, parsed)


def _normalize_provider(raw_provider: Optional[str]) -> str:
    provider = (raw_provider or "anthropic").strip().lower()
    if provider in ("", "auto"):
        cfg = get_config()
        if cfg.llm.openai_api_key:
            return "openai"
        if cfg.llm.anthropic_api_key:
            return "anthropic"
        return "anthropic"
    if provider in ("openai", "openai-api"):
        return "openai"
    if provider in ("anthropic", "claude"):
        return "anthropic"
    return provider


def _resolve_provider(provider_override: Optional[str] = None) -> str:
    if provider_override:
        return _normalize_provider(provider_override)
    cfg = get_config()
    return _normalize_provider(cfg.llm.provider)


def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        try:
            from anthropic import Anthropic
        except Exception as exc:
            raise RuntimeError("Anthropic client not available. Install anthropic.") from exc
        cfg = get_config()
        if not cfg.llm.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        _anthropic_client = Anthropic(
            api_key=cfg.llm.anthropic_api_key,
            timeout=_llm_timeout_seconds(),
            max_retries=_llm_max_retries(),
        )
    return _anthropic_client


def _get_openai_client():
    global _openai_client
    if _openai_client is None:
        try:
            from openai import OpenAI
        except Exception as exc:
            raise RuntimeError("OpenAI client not available. Install openai.") from exc
        cfg = get_config()
        if not cfg.llm.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        _openai_client = OpenAI(
            api_key=cfg.llm.openai_api_key,
            timeout=_llm_timeout_seconds(),
            max_retries=_llm_max_retries(),
        )
    return _openai_client


def generate_text(
    system_prompt: str,
    user_message: str,
    provider_override: Optional[str] = None,
    model_override: Optional[str] = None,
) -> str:
    """
    Generate text from the configured LLM provider.
    Returns raw text output.
    """
    cfg = get_config()
    provider = _resolve_provider(provider_override)

    if provider == "openai":
        client = _get_openai_client()
        model = model_override or cfg.llm.openai_model or "gpt-4o-mini"
        response = client.chat.completions.create(
            model=model,
            temperature=cfg.llm.temperature,
            max_tokens=cfg.llm.max_tokens,
            timeout=_llm_timeout_seconds(),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        content = response.choices[0].message.content if response.choices else ""
        return content or ""

    if provider == "anthropic":
        client = _get_anthropic_client()
        response = client.messages.create(
            model=model_override or cfg.llm.model,
            max_tokens=cfg.llm.max_tokens,
            temperature=cfg.llm.temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
            timeout=_llm_timeout_seconds(),
        )
        if response.content:
            return response.content[0].text
        return ""

    raise RuntimeError(f"Unknown LLM provider: {provider}")


def generate_text_with_images(
    system_prompt: str,
    user_message: str,
    image_urls: list,
    model: Optional[str] = None,
) -> str:
    """
    Generate text from images using OpenAI GPT-4o vision API.

    Args:
        system_prompt: System instruction for the model.
        user_message: Text prompt to accompany the images.
        image_urls: List of image URLs or base64 data URIs.
        model: OpenAI model to use (default: gpt-4o).

    Returns:
        Raw text output from the model.
    """
    cfg = get_config()
    client = _get_openai_client()
    model = model or "gpt-4o"

    # Build content array with text + images
    content: list[dict] = [{"type": "text", "text": user_message}]
    for url in image_urls:
        content.append({
            "type": "image_url",
            "image_url": {"url": url, "detail": "high"},
        })

    response = client.chat.completions.create(
        model=model,
        temperature=cfg.llm.temperature,
        max_tokens=cfg.llm.max_tokens,
        timeout=_llm_timeout_seconds(),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content},
        ],
    )
    result = response.choices[0].message.content if response.choices else ""
    return result or ""
