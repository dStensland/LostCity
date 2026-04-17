"""
Probe image dimensions from a URL without downloading the full file.

Strategy:
  1. HEAD request to confirm it's an image and check Content-Length.
  2. Partial GET (first 32 KB) — enough for Pillow to decode width/height
     from JPEG SOF markers, PNG IHDR, WebP/GIF headers, etc.
  3. On any failure (timeout, 404, non-image, decode error) return (None, None)
     silently. Never raise; never break a crawl.

Exported API:
    get_image_dimensions(url: str) -> tuple[int | None, int | None]
"""

from __future__ import annotations

import io
import logging
from typing import Optional

import httpx
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

# How many bytes to request in the partial GET.
# 32 KB covers PNG IHDR (first 24 bytes), JPEG SOF0 (first ~2 KB usually),
# WebP (first 30 bytes), GIF (first 10 bytes), AVIF, HEIC, BMP.
_PARTIAL_BYTES = 32_768

# Per-request wall-clock timeout (seconds).  Intentionally generous so we
# don't thrash hosts that are merely slow.
_TIMEOUT_SECONDS = 8.0

# Content-Type prefixes that indicate an image.
_IMAGE_CONTENT_TYPES = (
    "image/",
    "application/octet-stream",  # some CDNs send this for images
)


def _is_image_content_type(ct: str) -> bool:
    ct_lower = (ct or "").lower().split(";")[0].strip()
    return any(ct_lower.startswith(prefix) for prefix in _IMAGE_CONTENT_TYPES)


def get_image_dimensions(url: str) -> tuple[Optional[int], Optional[int]]:
    """Return (width, height) for the image at *url*, or (None, None) on any failure.

    Uses a HEAD + partial GET strategy so we never download more than ~32 KB
    per image.  Errors are swallowed and logged at DEBUG level.
    """
    if not url or not url.startswith("http"):
        return None, None

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0; image-probe)",
        "Accept": "image/*,*/*;q=0.8",
    }

    try:
        with httpx.Client(follow_redirects=True, timeout=_TIMEOUT_SECONDS) as client:
            # Step 1: HEAD to confirm it's an image.
            try:
                head = client.head(url, headers=headers)
                ct = head.headers.get("content-type", "")
                if head.status_code >= 400:
                    logger.debug(
                        "image_dims HEAD %s → HTTP %s, skipping",
                        url[:80],
                        head.status_code,
                    )
                    return None, None
                # Some servers return 405 Method Not Allowed for HEAD — fall through
                # to the GET in that case.
                if head.status_code < 400 and ct and not _is_image_content_type(ct):
                    logger.debug(
                        "image_dims HEAD %s → content-type '%s' not an image, skipping",
                        url[:80],
                        ct,
                    )
                    return None, None
            except Exception as head_exc:
                logger.debug("image_dims HEAD failed for %s: %s", url[:80], head_exc)
                # Fall through — try the partial GET anyway.

            # Step 2: Partial GET — first _PARTIAL_BYTES bytes.
            range_headers = {
                **headers,
                "Range": f"bytes=0-{_PARTIAL_BYTES - 1}",
            }
            resp = client.get(url, headers=range_headers)
            if resp.status_code not in (200, 206):
                logger.debug(
                    "image_dims GET %s → HTTP %s, skipping",
                    url[:80],
                    resp.status_code,
                )
                return None, None

            raw = resp.content

    except httpx.TimeoutException:
        logger.debug("image_dims timeout probing %s", url[:80])
        return None, None
    except Exception as exc:
        logger.debug("image_dims fetch error for %s: %s", url[:80], exc)
        return None, None

    # Step 3: Parse dims from the raw bytes via Pillow.
    try:
        with Image.open(io.BytesIO(raw)) as img:
            w, h = img.size
            return int(w), int(h)
    except (UnidentifiedImageError, Exception) as exc:
        logger.debug("image_dims Pillow parse failed for %s: %s", url[:80], exc)
        return None, None
