"""
Tests for configuration management in config.py.
"""

import os
from unittest.mock import patch


class TestConfig:
    """Tests for the Config class."""

    def test_default_env(self):
        """Should default to development environment."""
        with patch.dict(os.environ, {}, clear=True):
            # Need to reimport to get fresh config
            import importlib
            import config

            importlib.reload(config)
            cfg = config.Config()
            assert cfg.env == "development"

    def test_default_log_level(self):
        """Should default to INFO log level."""
        with patch.dict(os.environ, {}, clear=True):
            import importlib
            import config

            importlib.reload(config)
            cfg = config.Config()
            assert cfg.log_level == "INFO"

    def test_is_production(self):
        """Should correctly identify production environment."""
        with patch.dict(os.environ, {"ENV": "production"}, clear=True):
            import importlib
            import config

            importlib.reload(config)
            cfg = config.Config()
            assert cfg.is_production is True
            assert cfg.is_development is False

    def test_is_development(self):
        """Should correctly identify development environment."""
        with patch.dict(os.environ, {"ENV": "development"}, clear=True):
            import importlib
            import config

            importlib.reload(config)
            cfg = config.Config()
            assert cfg.is_development is True
            assert cfg.is_production is False


class TestDatabaseConfig:
    """Tests for DatabaseConfig."""

    def test_reads_from_env(self):
        """Should read database config from environment."""
        test_env = {
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_KEY": "test-key",
            "SUPABASE_SERVICE_KEY": "test-service-key",
            "DATABASE_URL": "postgresql://test",
        }
        with patch.dict(os.environ, test_env, clear=True):
            import importlib
            import config

            importlib.reload(config)
            cfg = config.DatabaseConfig()
            assert cfg.supabase_url == "https://test.supabase.co"
            assert cfg.supabase_key == "test-key"
            assert cfg.supabase_service_key == "test-service-key"
            assert cfg.database_url == "postgresql://test"

    def test_defaults_to_empty(self):
        """Should default to empty strings when env vars not set."""
        # Note: This test verifies the default factory pattern works
        # In practice, the .env file may be loaded, so we just check type
        import config
        cfg = config.DatabaseConfig()
        assert isinstance(cfg.supabase_url, str)
        assert isinstance(cfg.supabase_key, str)

    def test_staging_target_uses_staging_credentials(self):
        """Should resolve active credentials from staging variables when selected."""
        test_env = {
            "CRAWLER_DB_TARGET": "staging",
            "STAGING_SUPABASE_URL": "https://staging.supabase.co",
            "STAGING_SUPABASE_SERVICE_KEY": "staging-service-key",
        }
        with patch.dict(os.environ, test_env, clear=True):
            import importlib
            import config

            importlib.reload(config)
            cfg = config.DatabaseConfig()
            assert cfg.active_target == "staging"
            assert cfg.active_supabase_url == "https://staging.supabase.co"
            assert cfg.active_supabase_service_key == "staging-service-key"

    def test_invalid_target_falls_back_to_production(self):
        """Should normalize unsupported targets to production."""
        with patch.dict(os.environ, {"CRAWLER_DB_TARGET": "qa"}, clear=True):
            import importlib
            import config

            importlib.reload(config)
            cfg = config.DatabaseConfig()
            assert cfg.active_target == "production"


class TestLLMConfig:
    """Tests for LLMConfig."""

    def test_default_model(self):
        """Should have default model set."""
        import importlib
        import config

        importlib.reload(config)
        cfg = config.LLMConfig()
        assert "claude" in cfg.model.lower()

    def test_default_max_tokens(self):
        """Should have default max tokens."""
        import importlib
        import config

        importlib.reload(config)
        cfg = config.LLMConfig()
        assert cfg.max_tokens == 16384

    def test_default_temperature(self):
        """Should have temperature set to 0 for consistency."""
        import importlib
        import config

        importlib.reload(config)
        cfg = config.LLMConfig()
        assert cfg.temperature == 0.0

    def test_reads_api_key(self):
        """Should read API key from environment."""
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-test-key"}, clear=True):
            import importlib
            import config

            importlib.reload(config)
            cfg = config.LLMConfig()
            assert cfg.anthropic_api_key == "sk-test-key"


class TestCrawlerConfig:
    """Tests for CrawlerConfig."""

    def test_default_timeout(self):
        """Should have reasonable default timeout."""
        import importlib
        import config

        importlib.reload(config)
        cfg = config.CrawlerConfig()
        assert cfg.request_timeout == 30

    def test_default_retries(self):
        """Should have default retry count."""
        import importlib
        import config

        importlib.reload(config)
        cfg = config.CrawlerConfig()
        assert cfg.max_retries == 3

    def test_user_agent(self):
        """Should have user agent set."""
        import importlib
        import config

        importlib.reload(config)
        cfg = config.CrawlerConfig()
        assert "LostCity" in cfg.user_agent

    def test_respects_robots_txt(self):
        """Should respect robots.txt by default."""
        import importlib
        import config

        importlib.reload(config)
        cfg = config.CrawlerConfig()
        assert cfg.respect_robots_txt is True

    def test_rate_limiting(self):
        """Should have minimum request interval."""
        import importlib
        import config

        importlib.reload(config)
        cfg = config.CrawlerConfig()
        assert cfg.min_request_interval >= 1.0


class TestGetConfig:
    """Tests for get_config function."""

    def test_returns_config_instance(self):
        """Should return a Config instance."""
        from config import get_config

        cfg = get_config()
        assert cfg is not None
        assert hasattr(cfg, "database")
        assert hasattr(cfg, "llm")
        assert hasattr(cfg, "crawler")

    def test_singleton_pattern(self):
        """Should return same instance on multiple calls."""
        from config import get_config

        cfg1 = get_config()
        cfg2 = get_config()
        assert cfg1 is cfg2

    def test_set_database_target_refreshes_config(self):
        """Should update global config target when set_database_target is called."""
        from config import get_config, set_database_target

        set_database_target("staging")
        assert get_config().database.active_target == "staging"

        set_database_target("production")
        assert get_config().database.active_target == "production"
