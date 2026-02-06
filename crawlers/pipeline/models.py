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
    image_url: Optional[str] = None
    description: Optional[str] = None
    price: Optional[str] = None
    artists: Optional[str] = None


class FetchConfig(BaseModel):
    render_js: bool = False
    wait_ms: int = 1500
    timeout_ms: int = 15000
    user_agent: Optional[str] = None


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
    use_llm: bool = False
    jsonld_only: bool = False
    fetch: FetchConfig = Field(default_factory=FetchConfig)


class DefaultsConfig(BaseModel):
    category: Optional[str] = None
    subcategory: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    venue_name: Optional[str] = None


class SourceProfile(BaseModel):
    version: int = 1
    slug: str
    name: str
    integration_method: Optional[str] = None
    discovery: DiscoveryConfig = Field(default_factory=DiscoveryConfig)
    detail: DetailConfig = Field(default_factory=DetailConfig)
    defaults: DefaultsConfig = Field(default_factory=DefaultsConfig)
