"""
description_quality.py — Single source of truth for event description quality classification.

Three levels:
  JUNK       — Scraped nav/cookie/footer text. Should be rejected (set to NULL).
  BOILERPLATE — Template filler like "is a live event". Keep but penalize in scoring.
  GOOD       — Real descriptive content.

All consumers import from here:
  - utils.py:is_junk_description()
  - compute_data_quality.py (scoring)
  - db/events.py:smart_update_existing_event() (incoming description gate)
  - audit_content_quality.py (GENERIC_PATTERNS)
"""

from __future__ import annotations

import re
from typing import Literal, Optional

DescriptionQuality = Literal["junk", "boilerplate", "good"]

# ── JUNK markers: scraped page chrome, not content at all ──────────────────

JUNK_MARKERS = [
    # Cookie consent / GDPR
    "technical storage or access is strictly necessary",
    "cookie policy",
    "we use cookies",
    "cookie consent",
    "accept cookies",
    "manage cookies",
    "necessary cookies",
    # Footer / legal boilerplate
    "All Rights Reserved",
    "Privacy Policy",
    "Terms of Service",
    "Terms of Use",
    "Site Map",
    "Equal Opportunity, Nondiscrimination",
    "Human Trafficking Notice",
    "Hazing Public Disclosures",
    "Anti-Harassment Policy",
    # Scraped nav elements
    "Back to All Events Add",
    "Skip to content",
    "Toggle navigation",
    "JavaScript is required",
    "Skip Navigation",
    "Filter By\nSearch By",
    # Copyright footers
    "a carbonhouse experience",
    # Bot-block interstitials
    "something about your browser made us think you were a bot",
    "To regain access, please make sure that cookies and JavaScript",
    "please enable cookies and JavaScript",
    "enable JavaScript to run this app",
    "Please enable JS and disable any ad blocker",
    "Checking if the site connection is secure",
    # Venue navigation dumps
    "Other Location\nHeaven",
    "Heaven, Hell, Purgatory, and Altar at The Masquerade",
    "Not a band. Not DJ",
    # Ticketing UI chrome
    "FAQ BUY TICKETS DONATE",
    "sign up for our thrilling email",
    # Venue boilerplate (address/phone in description = scraped contact section)
    "Reservations are required, and you must be 21",
    "comedy destination since 1982",
    # Error / fallback pages
    "We couldn't find the page on this community event platform.",
    "Go back to the last page you were on.",
]

# Case-insensitive junk markers (only checked in short descriptions < 200 chars)
JUNK_MARKERS_CI = [
    "buy tickets",
    "add to cart",
    "upcoming shows",
    "upcoming events",
    "view all events",
]

# Nav-dump indicator phrases (3+ hits = junk)
NAV_PHRASES = [
    "buy tickets", "sold out", "doors", "all ages", "add to cart",
    "view more", "see all", "filter by", "sort by", "load more",
]

# ── BOILERPLATE markers: template filler, technically a "description" but useless ──

BOILERPLATE_MARKERS = [
    "is a community program",
    "is a live event",
    "is a live music event",
    "is a film screening",
    "is a local event",
    "use the ticket link for current availability",
    "location details are listed on the official event page",
    "location details are listed",
    "is a leading liberal arts college widely recognized as the global leader in the education of women of african descent",
]

# LLM-generated template descriptions (used in smart_update gate too)
BOILERPLATE_TEMPLATE_RE = re.compile(
    r"^(Event at |Live music at .+ featuring|Comedy show at |"
    r"Theater performance at |Film screening at |Sporting event at |"
    r"Arts event at |Food & drink event at |Fitness class at |"
    r"Creative workshop at |Performance at |Show at |Paint and sip class at )",
)

# Generic filler patterns — descriptions that are pure placeholder, not real content.
# Only patterns that unambiguously indicate "no real description available".
# NOTE: "join us for" and "come out to" are intentionally excluded — they often
# precede real content (e.g. "Join us for an evening of jazz featuring...").
# audit_content_quality.py imports AUDIT_GENERIC_PATTERNS for its broader checks.
GENERIC_PATTERNS = [
    r"^details? tba\b",
    r"^tba$",
    r"^more info (coming )?soon",
    r"^check back for",
    r"^stay tuned",
    r"^no description",
    r"^see website",
    r"^visit .+ for (more )?(details|info)",
    r"^more details at",
    r"^click here",
    r"^for more information",
]
GENERIC_RE = re.compile("|".join(GENERIC_PATTERNS), re.IGNORECASE)

# Broader patterns used by audit_content_quality.py for reporting (not classification).
AUDIT_GENERIC_PATTERNS = GENERIC_PATTERNS + [
    r"^event at\b",
    r"^join us (for|at)\b",
    r"^come out to\b",
]
AUDIT_GENERIC_RE = re.compile("|".join(AUDIT_GENERIC_PATTERNS), re.IGNORECASE)


def is_likely_truncated_description(desc: Optional[str]) -> bool:
    """Detect clamped/excerpted descriptions that end mid-thought."""
    if not desc or not isinstance(desc, str):
        return False

    normalized = " ".join(desc.split()).strip()
    if len(normalized) < 100:
        return False

    if "…" not in normalized and "..." not in normalized:
        return False

    if re.search(r"[\w,;:)](?:…|\.{3})\s*$", normalized):
        return True

    if re.search(r"[\w,;:)](?:…|\.{3})\s+[A-Z][\w(&\"']", normalized):
        return True

    return False


def classify_description(desc: Optional[str]) -> DescriptionQuality:
    """Classify a description as junk, boilerplate, or good.

    Single source of truth — all description quality checks should call this.
    """
    if not desc or not isinstance(desc, str):
        return "good"  # None/empty handled by callers; not a quality issue per se

    desc_stripped = desc.strip()
    if not desc_stripped:
        return "good"

    desc_lower = desc_stripped.lower()

    # ── JUNK checks ──────────────────────────────────────────────

    # Case-sensitive markers
    if any(marker in desc_stripped for marker in JUNK_MARKERS):
        return "junk"

    # Case-insensitive markers in short descriptions
    if len(desc_stripped) < 200:
        if any(marker in desc_lower for marker in JUNK_MARKERS_CI):
            return "junk"

    # Multiple "buy tickets" = scraped page with ticket buttons
    if desc_lower.count("buy tickets") >= 2:
        return "junk"

    # Nav-dump heuristic: 3+ ticketing/nav phrases
    nav_hits = sum(1 for phrase in NAV_PHRASES if phrase in desc_lower)
    if nav_hits >= 3:
        return "junk"

    # ── BOILERPLATE checks ───────────────────────────────────────

    # Clamped excerpts are not reliable consumer-facing descriptions.
    if is_likely_truncated_description(desc_stripped):
        return "boilerplate"

    # Known boilerplate phrases
    if any(marker in desc_lower for marker in BOILERPLATE_MARKERS):
        return "boilerplate"

    # LLM-generated template descriptions
    if BOILERPLATE_TEMPLATE_RE.match(desc_stripped):
        return "boilerplate"

    # Generic filler (TBA, "see website", etc.)
    if GENERIC_RE.search(desc_stripped):
        return "boilerplate"

    # Thin boilerplate: "Category: " near the top and the whole thing is short
    if "category: " in desc_stripped[:200].lower() and len(desc_stripped) < 250:
        return "boilerplate"

    return "good"


def is_boilerplate_or_junk(desc: Optional[str]) -> bool:
    """Convenience: returns True if description is junk or boilerplate."""
    return classify_description(desc) in ("junk", "boilerplate")


def is_junk(desc: Optional[str]) -> bool:
    """Convenience: returns True only for junk (scraped chrome, not content)."""
    return classify_description(desc) == "junk"
