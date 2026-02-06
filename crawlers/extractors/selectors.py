"""
Selector-based extraction utilities.

Selector spec format:
- "css.selector" -> text content
- "css.selector@attr" -> attribute value
"""

from __future__ import annotations

from typing import Optional, Tuple

from bs4 import BeautifulSoup, Tag


def parse_selector_spec(spec: str) -> Tuple[str, Optional[str]]:
    """Split a selector spec into (css_selector, attribute)."""
    if not spec:
        return "", None
    if "@" in spec:
        selector, attr = spec.rsplit("@", 1)
        return selector.strip(), attr.strip()
    return spec.strip(), None


def _extract_from_tag(tag: Tag, attr: Optional[str]) -> Optional[str]:
    if not tag:
        return None
    if attr:
        val = tag.get(attr)
        if val:
            return str(val).strip()
        return None
    text = tag.get_text(" ", strip=True)
    return text or None


def extract_first(soup: BeautifulSoup, spec: str) -> Optional[str]:
    """Extract the first match for a selector spec from a soup."""
    if not spec:
        return None
    selector, attr = parse_selector_spec(spec)
    if not selector:
        return None
    tag = soup.select_one(selector)
    return _extract_from_tag(tag, attr)


def extract_all(soup: BeautifulSoup, spec: str) -> list[str]:
    """Extract all matches for a selector spec from a soup."""
    if not spec:
        return []
    selector, attr = parse_selector_spec(spec)
    if not selector:
        return []
    results: list[str] = []
    for tag in soup.select(selector):
        value = _extract_from_tag(tag, attr)
        if value:
            results.append(value)
    return results


def extract_from_element(elem: Tag, spec: str) -> Optional[str]:
    """Extract from an existing element using a selector spec."""
    if not spec:
        return None
    selector, attr = parse_selector_spec(spec)
    if not selector:
        return None
    tag = elem.select_one(selector)
    return _extract_from_tag(tag, attr)
