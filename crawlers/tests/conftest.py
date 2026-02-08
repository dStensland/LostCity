"""
Shared pytest fixtures for Lost City crawler tests.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch


@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client for database tests."""
    client = MagicMock()

    # Mock table operations
    table = MagicMock()
    client.table.return_value = table

    # Mock chained methods
    table.select.return_value = table
    table.insert.return_value = table
    table.update.return_value = table
    table.eq.return_value = table
    table.single.return_value = table
    table.range.return_value = table
    table.order.return_value = table

    # Default execute returns empty
    table.execute.return_value = MagicMock(data=[])

    return client


@pytest.fixture
def sample_event_data():
    """Sample event data dict for testing."""
    return {
        "title": "Test Concert",
        "description": "A great show with live music",
        "start_date": "2026-02-15",
        "start_time": "20:00",
        "end_time": "23:00",
        "venue_id": 1,
        "category": "music",
        "subcategory": "live-music",
        "tags": ["live-music"],
        "is_free": False,
        "price_min": 25.0,
        "price_max": 50.0,
        "source_url": "https://example.com/event",
        "source_id": 1,
    }


@pytest.fixture
def sample_venue_data():
    """Sample venue data dict for testing."""
    return {
        "name": "The Test Venue",
        "slug": "the-test-venue",
        "address": "123 Test St",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.78,
        "lng": -84.38,
        "venue_type": "venue",
        "spot_type": "venue",
        "website": "https://testvenue.com",
    }


@pytest.fixture
def sample_source():
    """Sample source record for testing."""
    return {
        "id": 1,
        "name": "Test Source",
        "slug": "test-source",
        "url": "https://testsource.com",
        "source_type": "venue",
        "is_active": True,
    }


@pytest.fixture
def today():
    """Get today's date for relative date testing."""
    return datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)


@pytest.fixture
def future_date():
    """Get a date 7 days in the future."""
    return (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")


@pytest.fixture
def sample_html_event_card():
    """Sample HTML for an event card."""
    return """
    <div class="event-card">
        <h3 class="event-title">Live Jazz Night</h3>
        <div class="event-date">February 20, 2026</div>
        <div class="event-time">8:00 PM</div>
        <div class="event-venue">The Jazz Club</div>
        <p class="event-description">Join us for an evening of smooth jazz.</p>
        <a href="/events/jazz-night" class="event-link">Get Tickets</a>
    </div>
    """


@pytest.fixture
def sample_html_events_page():
    """Sample HTML for a full events page."""
    return """
    <!DOCTYPE html>
    <html>
    <head><title>Events</title></head>
    <body>
        <div class="events-list">
            <div class="event-card">
                <h3 class="title">Rock Concert</h3>
                <span class="date">Jan 25, 2026</span>
                <span class="time">7:30 PM</span>
                <span class="price">$20 - $35</span>
                <a href="/events/rock-concert">Details</a>
            </div>
            <div class="event-card">
                <h3 class="title">Comedy Night</h3>
                <span class="date">Jan 26, 2026</span>
                <span class="time">9:00 PM</span>
                <span class="price">Free</span>
                <a href="/events/comedy-night">Details</a>
            </div>
            <div class="event-card">
                <h3 class="title">Art Opening</h3>
                <span class="date">January 27, 2026</span>
                <span class="time">6:00 PM - 10:00 PM</span>
                <span class="price">Free admission</span>
                <a href="/events/art-opening">Details</a>
            </div>
        </div>
    </body>
    </html>
    """


@pytest.fixture
def mock_requests_get():
    """Mock requests.get for HTTP tests."""
    with patch("requests.get") as mock_get:
        yield mock_get


@pytest.fixture
def mock_config():
    """Mock configuration for tests."""
    with patch("config.get_config") as mock_cfg:
        cfg = MagicMock()
        cfg.database.supabase_url = "https://test.supabase.co"
        cfg.database.supabase_service_key = "test-key"
        cfg.crawler.user_agent = "TestBot/1.0"
        cfg.crawler.request_timeout = 10
        cfg.log_level = "DEBUG"
        mock_cfg.return_value = cfg
        yield cfg
