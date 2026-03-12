"""
Helpers for Dunwoody Nature Center camp PDFs.

These PDFs are public and stable, but the extracted text order is not strictly
linear because the layouts are multi-column. We only rely on the short title
and date lines, then pair unmatched titles and dates in reading order.
"""

from __future__ import annotations

from collections import deque
from io import BytesIO
import re

import requests

try:
    from pypdf import PdfReader

    HAS_PYPDF = True
except Exception:
    PdfReader = None
    HAS_PYPDF = False

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/pdf,text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

DATE_LINE_RE = re.compile(
    r"^(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})\s*-\s*"
    r"(?:(?P<end_month>[A-Za-z]+)\s+)?(?P<end_day>\d{1,2})$"
)

IGNORED_SHORT_LINES = {
    "4 Day Week",
    "Half Day Only",
    "2 Full Day/3 Half Day Classes",
    "Island Ford Campus",
}
LOWERCASE_TITLE_WORDS = {"and", "of", "a", "an", "the", "to", "in", "on", "for"}


def _normalize_short_token(token: str) -> str:
    token = token.replace("\xa0", " ").replace("–", "-").replace("—", "-").replace("ﬁ", "fi")
    token = token.replace("’", "'").replace("“", '"').replace("”", '"').strip()
    if not token:
        return ""
    suffix = ""
    while token and token[-1] in "!?,.":
        suffix = token[-1] + suffix
        token = token[:-1].rstrip()

    if re.fullmatch(r"(?:[A-Za-z]\s+){1,}[A-Za-z]", token):
        return "".join(token.split()) + suffix
    if re.fullmatch(r"(?:\d\s+){1,}\d", token):
        return "".join(token.split()) + suffix
    return " ".join(token.split()) + suffix


def normalize_short_line(raw_line: str) -> str:
    raw_line = (raw_line or "").strip()
    if not raw_line:
        return ""
    parts = re.split(r" {2,}|\u00a0+", raw_line)
    normalized = " ".join(
        token for token in (_normalize_short_token(part) for part in parts) if token
    )
    normalized = re.sub(r"(?<=\d)\s+(?=\d)", "", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def is_date_line(line: str) -> bool:
    return bool(DATE_LINE_RE.match((line or "").strip()))


def looks_like_title_line(line: str, ignored_titles: set[str] | None = None) -> bool:
    value = (line or "").strip()
    if not value or len(value) > 48 or is_date_line(value):
        return False
    if value in IGNORED_SHORT_LINES or (ignored_titles and value in ignored_titles):
        return False
    if any(ch in value for ch in [":", ";", "?", "."]):
        return False

    words = value.replace("/", " ").replace("-", " ").split()
    alpha_words = [word.strip("!,'\"()") for word in words if re.search(r"[A-Za-z]", word)]
    if not alpha_words:
        return False

    for word in alpha_words:
        if word in {"I", "II", "III", "IV", "V"}:
            continue
        if word.lower() in LOWERCASE_TITLE_WORDS:
            continue
        if not word[0].isupper():
            return False
    return True


def extract_title_date_pairs_from_lines(
    raw_lines: list[str],
    ignored_titles: set[str] | None = None,
) -> list[tuple[str, str]]:
    pending_titles: list[str] = []
    pending_dates: deque[str] = deque()
    pairs: list[tuple[str, str]] = []
    seen_pairs: set[tuple[str, str]] = set()

    for raw_line in raw_lines:
        line = normalize_short_line(raw_line)
        if not line:
            continue
        if is_date_line(line):
            if pending_titles:
                pair = (pending_titles.pop(), line)
                if pair not in seen_pairs:
                    seen_pairs.add(pair)
                    pairs.append(pair)
            else:
                pending_dates.append(line)
            continue

        if looks_like_title_line(line, ignored_titles=ignored_titles):
            if pending_dates:
                pair = (line, pending_dates.popleft())
                if pair not in seen_pairs:
                    seen_pairs.add(pair)
                    pairs.append(pair)
            else:
                pending_titles.append(line)

    return pairs


def extract_title_date_pairs_from_pdf(
    pdf_url: str,
    ignored_titles: set[str] | None = None,
    timeout: int = 45,
) -> list[tuple[str, str]]:
    if not HAS_PYPDF:
        raise RuntimeError("pypdf not installed")

    response = requests.get(pdf_url, headers=REQUEST_HEADERS, timeout=timeout)
    response.raise_for_status()
    reader = PdfReader(BytesIO(response.content))

    lines: list[str] = []
    for page in reader.pages:
        try:
            page_text = page.extract_text() or ""
        except Exception:
            page_text = ""
        lines.extend(page_text.splitlines())

    return extract_title_date_pairs_from_lines(lines, ignored_titles=ignored_titles)
