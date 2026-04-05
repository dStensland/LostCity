from sources import shaky_knees


SAMPLE_LINEUP_HTML = """
<html>
  <head>
    <meta property="og:image" content="https://cdn.example.com/generic-share.jpg" />
  </head>
  <body>
    <img src="https://cdn.prod.website-files.com/foo/SK26_Admat_Socials_general-1080x1350.png" />
  </body>
</html>
"""

SAMPLE_OCR_TEXT = """
SEPT. 18-20
2026
FRIDAY
THE STROKES
TURNSTILE • FONTAINES D.C. • GEESE
ALICE PHOEBE LOU • GOLDFORD • CARTEL
SATURDAY
TWENTY ONE PILOTS
ERCE T* VEIL • THE PRODIGY • PAVEMENT
SUNDY • GORILLAZ
LCD SOUNDSYSTEM • WU-TANG GLAN
COHEED AND CAMBRIA • JET • OK GO
FOR TICKETS AND MORE INFO
SHAKYKNEESFESTIVAL.COM
"""


def test_extract_lineup_image_url_prefers_poster_asset():
    image_url = shaky_knees._extract_lineup_image_url(SAMPLE_LINEUP_HTML)
    assert image_url == (
        "https://cdn.prod.website-files.com/foo/"
        "SK26_Admat_Socials_general-1080x1350.png"
    )


def test_parse_lineup_days_extracts_day_buckets_and_artists():
    lineup_days = shaky_knees._parse_lineup_days(SAMPLE_OCR_TEXT)

    assert set(lineup_days) == {"FRIDAY", "SATURDAY", "SUNDAY"}
    assert lineup_days["FRIDAY"] == [
        "The Strokes",
        "Turnstile",
        "Fontaines D.C.",
        "Geese",
        "Alice Phoebe Lou",
        "GoldFord",
        "Cartel",
    ]
    assert lineup_days["SATURDAY"] == [
        "Twenty One Pilots",
        "Pierce The Veil",
        "The Prodigy",
        "Pavement",
    ]
    assert lineup_days["SUNDAY"] == [
        "Gorillaz",
        "LCD Soundsystem",
        "Wu-Tang Clan",
        "Coheed and Cambria",
        "Jet",
        "OK Go",
    ]


def test_crawl_emits_annual_event_and_day_lineup_events(monkeypatch):
    captured = []

    monkeypatch.setattr(shaky_knees, "_resolve_target_dates", lambda: (2026, __import__("datetime").datetime(2026, 9, 18), __import__("datetime").datetime(2026, 9, 20)))
    monkeypatch.setattr(shaky_knees, "get_or_create_place", lambda _place: 123)
    monkeypatch.setattr(shaky_knees, "_fetch_html", lambda _url: SAMPLE_LINEUP_HTML)
    monkeypatch.setattr(
        shaky_knees,
        "_extract_lineup_image_url",
        lambda _html: "https://cdn.prod.website-files.com/foo/SK26_Admat.png",
    )
    monkeypatch.setattr(shaky_knees, "_download_lineup_image", lambda _url: "/tmp/shaky.png")
    monkeypatch.setattr(shaky_knees, "_ocr_image_with_vision", lambda _path: SAMPLE_OCR_TEXT)
    monkeypatch.setattr(shaky_knees, "find_event_by_hash", lambda _hash: None)
    monkeypatch.setattr(shaky_knees.os, "unlink", lambda _path: None)

    def fake_insert_event(event_record, series_hint=None):
        captured.append((event_record, series_hint))

    monkeypatch.setattr(shaky_knees, "insert_event", fake_insert_event)

    found, new, updated = shaky_knees.crawl({"id": 130})

    assert (found, new, updated) == (4, 4, 0)
    assert captured[0][0]["title"] == "Shaky Knees Music Festival 2026"
    assert captured[1][0]["title"] == "Shaky Knees Friday Lineup"
    assert captured[2][0]["title"] == "Shaky Knees Saturday Lineup"
    assert captured[3][0]["title"] == "Shaky Knees Sunday Lineup"
    assert captured[1][1]["series_type"] == "festival_program"
    assert captured[1][1]["festival_name"] == "Shaky Knees Festival"
    assert "The Strokes" in captured[1][0]["description"]
    assert captured[1][0]["_suppress_title_participants"] is True
    assert captured[1][0]["_parsed_artists"][0]["name"] == "The Strokes"
