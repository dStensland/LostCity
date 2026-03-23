"""
Crawl context — city/portal configuration for the crawl pipeline.

Replaces hardcoded Atlanta/GA checks with a parameterized context
that can be set per-city when expanding to new markets.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CrawlContext:
    """City and portal configuration for a crawl run."""

    city: str = "Atlanta"
    state: str = "GA"
    portal_id: Optional[str] = None
    portal_slug: Optional[str] = None

    # Validation rules
    allowed_states: list[str] = field(default_factory=lambda: ["GA"])
    timezone: str = "America/New_York"

    # Metro geometry for geo-scope validation
    metro_center_lat: float = 33.749
    metro_center_lng: float = -84.388
    metro_radius_km: float = 80.0  # ~50 miles, covers Atlanta suburbs

    def is_valid_state(self, state: str) -> bool:
        """Check if a venue's state is allowed for this crawl context."""
        if not self.allowed_states:
            return True  # No restriction
        return (state or "").upper().strip() in self.allowed_states

    def is_in_metro(self, lat: float, lng: float) -> bool:
        """Haversine check against metro center."""
        from neighborhood_lookup import haversine
        distance_m = haversine(self.metro_center_lat, self.metro_center_lng, lat, lng)
        return distance_m <= self.metro_radius_km * 1000


# Default context — Atlanta
_active_context: CrawlContext = CrawlContext()


def get_crawl_context() -> CrawlContext:
    """Get the active crawl context."""
    return _active_context


def set_crawl_context(ctx: CrawlContext) -> None:
    """Set the active crawl context (e.g., for Nashville or other cities)."""
    global _active_context
    _active_context = ctx
