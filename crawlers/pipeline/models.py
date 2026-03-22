"""
Pydantic models for source profiles used by the new pipeline.
"""

from __future__ import annotations

from typing import Optional, Literal

from pydantic import BaseModel, Field


class SelectorSet(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    detail_url: Optional[str] = None
    ticket_url: Optional[str] = None
    links: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    price: Optional[str] = None
    artists: Optional[str] = None


class FetchConfig(BaseModel):
    render_js: bool = False
    wait_ms: int = 1500
    timeout_ms: int = 30000
    user_agent: Optional[str] = None
    wait_until: Literal["networkidle", "load", "domcontentloaded", "commit"] = "networkidle"


class ApiConfig(BaseModel):
    adapter: str
    params: dict = Field(default_factory=dict)


class FeedConfig(BaseModel):
    format: Literal["auto", "rss", "atom", "ics"] = "auto"


class DiscoveryConfig(BaseModel):
    enabled: bool = True
    type: Literal["list", "html", "api", "feed"] = "list"
    urls: list[str] = Field(default_factory=list)
    event_card: Optional[str] = None
    fields: SelectorSet = Field(default_factory=SelectorSet)
    fetch: FetchConfig = Field(default_factory=FetchConfig)
    api: Optional[ApiConfig] = None
    feed: Optional[FeedConfig] = None


class DetailConfig(BaseModel):
    enabled: bool = True
    selectors: SelectorSet = Field(default_factory=SelectorSet)
    use_jsonld: bool = True
    use_open_graph: bool = True
    use_heuristic: bool = True
    use_llm: bool = True
    jsonld_only: bool = False
    fetch: FetchConfig = Field(default_factory=FetchConfig)


class DefaultsConfig(BaseModel):
    category: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    venue_name: Optional[str] = None


class SourceProfile(BaseModel):
    version: int = 1
    slug: str
    name: str
    integration_method: Optional[str] = None
    data_goals: list[
        Literal[
            "events",
            "exhibits",
            "specials",
            "classes",
            "showtimes",
            "lineup",
            "tickets",
            "images",
            "venue_hours",
            "planning",
            "accessibility",
            "dietary",
        ]
    ] = Field(default_factory=list)
    discovery: DiscoveryConfig = Field(default_factory=DiscoveryConfig)
    detail: DetailConfig = Field(default_factory=DetailConfig)
    defaults: DefaultsConfig = Field(default_factory=DefaultsConfig)


# --- v2 Profile Schema ---


class FetchConfigV2(BaseModel):
    method: Literal["static", "playwright", "api"] = "static"
    urls: list[str] = Field(default_factory=list)
    wait_for: Optional[str] = None
    scroll: bool = False


class ParseConfigV2(BaseModel):
    method: Literal["llm", "jsonld", "api_adapter", "custom"] = "llm"
    module: Optional[str] = None
    adapter: Optional[str] = None


class VenueConfig(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    venue_type: Optional[str] = None
    website: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class ScheduleConfig(BaseModel):
    frequency: Literal["daily", "weekly", "biweekly", "monthly"] = "daily"
    priority: Literal["high", "normal", "low"] = "normal"


class DefaultsConfigV2(BaseModel):
    category: Optional[str] = None
    tags: list[str] = Field(default_factory=list)


class SourceProfileV2(BaseModel):
    version: int = 2
    slug: str
    name: str
    city: str = "atlanta"
    portal_id: Optional[str] = None
    fetch: FetchConfigV2 = Field(default_factory=FetchConfigV2)
    parse: ParseConfigV2 = Field(default_factory=ParseConfigV2)
    entity_lanes: list[str] = Field(default_factory=lambda: ["events"])
    venue: VenueConfig = Field(default_factory=VenueConfig)
    defaults: DefaultsConfigV2 = Field(default_factory=DefaultsConfigV2)
    schedule: ScheduleConfig = Field(default_factory=ScheduleConfig)
    detail: DetailConfig = Field(default_factory=DetailConfig)
