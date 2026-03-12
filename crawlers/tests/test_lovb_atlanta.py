from datetime import date

from sources.lovb_atlanta import (
    build_event_title,
    build_matchup_participants,
    clean_ticket_url,
    parse_schedule_payload,
)


SAMPLE_PAYLOAD = """
2:[["$","section",null,{"children":["$","$Lb",null,{"currentCountry":"US","children":["$","$Lc",null,{"games":[
  {
    "id":"past-home",
    "season":{"end_year":2026},
    "host":{"name":"Atlanta","slug":"lovb-atlanta-volleyball"},
    "guest":{"name":"Salt Lake","slug":"lovb-salt-lake-volleyball"},
    "startDate":"2026-02-22T14:00:00",
    "start_date_timezone":{"name":"US/Eastern"},
    "special_event_description":"Past match",
    "tag":"Head-to-head",
    "venue":{"name":"Gateway Center Arena","slug":"gateway-center-arena"},
    "ticket_purchase_link":"https://www.ticketmaster.com/event/past"
  },
  null,
  {
    "id":"future-away",
    "season":{"end_year":2026},
    "host":{"name":"Houston","slug":"lovb-houston-volleyball"},
    "guest":{"name":"Atlanta","slug":"lovb-atlanta-volleyball"},
    "startDate":"2026-03-30T19:00:00",
    "start_date_timezone":{"name":"US/Central"},
    "special_event_description":null,
    "tag":"Head-to-head",
    "venue":{"name":"Berry Center","slug":"berry-center"},
    "ticket_purchase_link":"https://www.ticketmaster.com/event/away"
  },
  {
    "id":"future-home",
    "season":{"end_year":2026},
    "host":{"name":"Atlanta","slug":"lovb-atlanta-volleyball"},
    "guest":{"name":"Houston","slug":"lovb-houston-volleyball"},
    "startDate":"2026-04-04T17:00:00",
    "start_date_timezone":{"name":"US/Eastern"},
    "special_event_description":"Forever I LOVB Atlanta",
    "tag":"Head-to-head",
    "venue":{"name":"Georgia Tech McCamish Pavilion","slug":"mccamish-pavilion"},
    "ticket_purchase_link":"https://www.google.com/url?q=https://ramblinwreck.evenue.net/event/SE26/LOVB0404&sa=D&source=calendar"
  }
]}]}]}]
"""


def test_build_event_title_prefixes_guest_team() -> None:
    assert build_event_title("Houston") == "LOVB Atlanta vs LOVB Houston"


def test_clean_ticket_url_unwraps_google_redirects() -> None:
    assert (
        clean_ticket_url("https://www.google.com/url?q=https://ramblinwreck.evenue.net/event/SE26/LOVB0404&sa=D")
        == "https://ramblinwreck.evenue.net/event/SE26/LOVB0404"
    )


def test_parse_schedule_payload_filters_to_future_atlanta_home_matches() -> None:
    matches = parse_schedule_payload(SAMPLE_PAYLOAD, today=date(2026, 3, 10))

    assert matches == [
        {
            "title": "LOVB Atlanta vs LOVB Houston",
            "opponent": "Houston",
            "start_date": "2026-04-04",
            "start_time": "17:00",
            "venue_slug": "mccamish-pavilion",
            "ticket_url": "https://ramblinwreck.evenue.net/event/SE26/LOVB0404",
            "source_url": "https://www.lovb.com/2026/schedule",
            "special_event_description": "Forever I LOVB Atlanta",
            "tag": "Head-to-head",
            "raw_text": '{"id": "future-home", "host": "lovb-atlanta-volleyball", "guest": "lovb-houston-volleyball", "startDate": "2026-04-04T17:00:00", "timezone": "US/Eastern", "venue": "mccamish-pavilion", "special_event_description": "Forever I LOVB Atlanta", "ticket_purchase_link": "https://www.google.com/url?q=https://ramblinwreck.evenue.net/event/SE26/LOVB0404&sa=D&source=calendar"}',
        }
    ]


def test_build_matchup_participants_prefixes_guest_team() -> None:
    assert build_matchup_participants("Houston") == [
        {"name": "LOVB Atlanta", "role": "team", "billing_order": 1},
        {"name": "LOVB Houston", "role": "team", "billing_order": 2},
    ]
