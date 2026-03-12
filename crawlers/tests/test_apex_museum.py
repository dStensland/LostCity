import json
from datetime import date

from sources.apex_museum import (
    _extract_eventbrite_context,
    _parse_eventbrite_context_event,
)


def _build_context(*, message_code=None, next_session=None):
    return {
        "basicInfo": {
            "name": "A Tribute to Greatness: Live from The Apex Museum",
            "summary": "A live tribute every other Thursday at The Apex Museum.",
            "isFree": False,
            "isSeries": True,
            "url": "https://www.eventbrite.com/e/example",
            "startDate": {"local": "2025-03-20T19:00:00"},
        },
        "goodToKnow": {
            "highlights": {
                "nextAvailableSession": next_session,
            }
        },
        "salesStatus": {
            "messageCode": message_code,
            "message": "Cancelled" if message_code == "event_cancelled" else None,
        },
        "gallery": {
            "images": [
                {"url": "https://img.evbuc.com/example.jpg"},
            ]
        },
        "structuredContent": {
            "modules": [
                {
                    "type": "text",
                    "text": "<p>Each week we spotlight music legends.</p>",
                }
            ]
        },
    }


class TestExtractEventbriteContext:
    def test_extracts_embedded_context_payload(self):
        payload = {
            "props": {
                "pageProps": {
                    "context": _build_context(next_session="2026-03-12T19:00:00-04:00")
                }
            }
        }
        html = f"<html><body><script>{json.dumps(payload)}</script></body></html>"

        context = _extract_eventbrite_context(html)

        assert context is not None
        assert context["basicInfo"]["name"] == "A Tribute to Greatness: Live from The Apex Museum"


class TestParseEventbriteContextEvent:
    def test_uses_next_available_session_for_recurring_series(self):
        event_record, series_hint, skip_reason = _parse_eventbrite_context_event(
            _build_context(next_session="2026-03-12T19:00:00-04:00"),
            detail_url="https://www.eventbrite.com/e/example",
            today=date(2026, 3, 9),
        )

        assert skip_reason is None
        assert event_record is not None
        assert event_record["start_date"] == "2026-03-12"
        assert event_record["start_time"] == "19:00"
        assert event_record["is_recurring"] is True
        assert event_record["recurrence_rule"] == "Every Other Thursday"
        assert series_hint is not None
        assert series_hint["series_type"] == "recurring_show"

    def test_skips_cancelled_series_even_with_future_session_marker(self):
        event_record, series_hint, skip_reason = _parse_eventbrite_context_event(
            _build_context(
                message_code="event_cancelled",
                next_session="2026-03-12T19:00:00-04:00",
            ),
            detail_url="https://www.eventbrite.com/e/example",
            today=date(2026, 3, 9),
        )

        assert event_record is None
        assert series_hint is None
        assert skip_reason == "cancelled_series_with_next_session"
