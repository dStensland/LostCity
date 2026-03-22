"""
Shared utilities for building exhibition lane records.

Crawlers that discover exhibitions should use ``build_exhibition_record()``
to produce a dict suitable for ``TypedEntityEnvelope.add("exhibitions", ...)``.
The persistence layer (``entity_persistence.py``) handles dedup, slug generation,
and artist resolution automatically.
"""

from typing import Optional


def build_exhibition_record(
    title: str,
    venue_id: int,
    source_id: int,
    opening_date: Optional[str],
    closing_date: Optional[str],
    *,
    venue_name: Optional[str] = None,
    description: Optional[str] = None,
    image_url: Optional[str] = None,
    source_url: Optional[str] = None,
    portal_id: Optional[str] = None,
    admission_type: str = "free",
    tags: Optional[list[str]] = None,
    artists: Optional[list[dict]] = None,
    medium: Optional[str] = None,
    exhibition_type: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> tuple[dict, Optional[list[dict]]]:
    """Build an exhibition lane record for TypedEntityEnvelope.

    Returns ``(record, artists)`` tuple matching what
    ``entity_persistence.py`` expects when processing the exhibitions lane.

    Parameters
    ----------
    title : str
        Exhibition title (may include "Artist: Title" format).
    venue_id : int
        Database venue ID.
    source_id : int
        Database source ID.
    opening_date, closing_date : str | None
        ISO dates (YYYY-MM-DD).
    venue_name : str | None
        Used for slug generation by ``insert_exhibition()``.
    description, image_url, source_url : str | None
        Standard metadata fields.
    portal_id : str | None
        Portal attribution UUID.
    admission_type : str
        One of "free", "ticketed", "donation".
    tags : list[str] | None
        Discovery tags (e.g. ["museum", "exhibition"]).
    artists : list[dict] | None
        Artist associations: ``[{"artist_name": ..., "artist_url": ..., "role": ...}]``.
    medium : str | None
        Art medium (painting, sculpture, photography, etc.).
    exhibition_type : str | None
        solo, group, retrospective, pop-up, permanent.
    metadata : dict | None
        Extra metadata (e.g. display_start_date for ongoing shows).
    """
    record: dict = {
        "title": title,
        "venue_id": venue_id,
        "source_id": source_id,
        "opening_date": opening_date,
        "closing_date": closing_date,
        "admission_type": admission_type,
        "is_active": True,
    }

    if venue_name:
        record["_venue_name"] = venue_name
    if description:
        record["description"] = description
    if image_url:
        record["image_url"] = image_url
    if source_url:
        record["source_url"] = source_url
    if portal_id:
        record["portal_id"] = portal_id
    if tags:
        record["tags"] = tags
    if medium:
        record["medium"] = medium
    if exhibition_type:
        record["exhibition_type"] = exhibition_type
    if metadata:
        record["metadata"] = metadata

    return record, artists
