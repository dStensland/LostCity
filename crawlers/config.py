"""
Configuration management for Lost City crawlers.
Loads settings from environment variables with sensible defaults.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel, Field

# Load .env file from project root
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)


class DatabaseConfig(BaseModel):
    """Database connection settings."""
    supabase_url: str = Field(default_factory=lambda: os.getenv("SUPABASE_URL", ""))
    supabase_key: str = Field(default_factory=lambda: os.getenv("SUPABASE_KEY", ""))
    supabase_service_key: str = Field(default_factory=lambda: os.getenv("SUPABASE_SERVICE_KEY", ""))
    database_url: str = Field(default_factory=lambda: os.getenv("DATABASE_URL", ""))


class LLMConfig(BaseModel):
    """LLM API settings."""
    anthropic_api_key: str = Field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", ""))
    openai_api_key: str = Field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    provider: str = Field(default_factory=lambda: os.getenv("LLM_PROVIDER", "anthropic"))
    model: str = "claude-sonnet-4-20250514"
    openai_model: str = Field(default_factory=lambda: os.getenv("OPENAI_MODEL", "gpt-4o-mini"))
    max_tokens: int = 16384  # Increased to handle pages with many events
    temperature: float = 0.0


class APIConfig(BaseModel):
    """External API settings."""
    eventbrite_api_key: str = Field(default_factory=lambda: os.getenv("EVENTBRITE_API_KEY", ""))
    meetup_api_key: str = Field(default_factory=lambda: os.getenv("MEETUP_API_KEY", ""))
    ticketmaster_api_key: str = Field(default_factory=lambda: os.getenv("TICKETMASTER_API_KEY", ""))
    omdb_api_key: str = Field(default_factory=lambda: os.getenv("OMDB_API_KEY", "trilogy"))
    spotify_client_id: str = Field(default_factory=lambda: os.getenv("SPOTIFY_CLIENT_ID", ""))
    spotify_client_secret: str = Field(default_factory=lambda: os.getenv("SPOTIFY_CLIENT_SECRET", ""))


class CrawlerConfig(BaseModel):
    """Crawler behavior settings."""
    request_timeout: int = 30
    max_retries: int = 3
    retry_delay: float = 1.0
    user_agent: str = "LostCity/1.0 (https://lostcity.ai; events@lostcity.ai)"
    respect_robots_txt: bool = True
    min_request_interval: float = 1.0  # seconds between requests to same domain


class Config(BaseModel):
    """Main configuration container."""
    env: str = Field(default_factory=lambda: os.getenv("ENV", "development"))
    log_level: str = Field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    llm: LLMConfig = Field(default_factory=LLMConfig)
    api: APIConfig = Field(default_factory=APIConfig)
    crawler: CrawlerConfig = Field(default_factory=CrawlerConfig)

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def is_development(self) -> bool:
        return self.env == "development"


# Global config instance
config = Config()


def get_config() -> Config:
    """Get the global configuration instance."""
    return config
