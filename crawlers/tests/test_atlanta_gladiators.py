from datetime import datetime, timezone

from sources.atlanta_gladiators import build_event_title, extract_game_links, parse_game_page


def test_extract_game_links_dedupes_schedule_urls():
    html = """
    <a href="/games/2026/03/12/florida-everblades">Game Details</a>
    <a href="/games/2026/03/12/florida-everblades">Details</a>
    <a href="/games/2026/03/20/jacksonville-icemen">Away Game</a>
    """

    assert extract_game_links(html) == [
        "https://atlantagladiators.com/games/2026/03/12/florida-everblades",
        "https://atlantagladiators.com/games/2026/03/20/jacksonville-icemen",
    ]


def test_build_event_title_uses_canonical_matchup_format():
    assert build_event_title("Florida Everblades") == "Atlanta Gladiators vs. Florida Everblades"


def test_parse_game_page_extracts_future_home_game_fields():
    html = """
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      "name": "Florida Everblades @ Atlanta Gladiators",
      "startDate": "2026-03-12T19:10:00-04:00",
      "url": "https://atlantagladiators.com/games/2026/03/12/florida-everblades",
      "image": "https://example.com/gladiators.png",
      "homeTeam": {"@type": "SportsTeam", "name": "Atlanta Gladiators"},
      "awayTeam": {"@type": "SportsTeam", "name": "Florida Everblades"},
      "offers": [{"@type": "Offer", "url": "https://www.ticketmaster.com/example"}]
    }
    </script>
    """

    parsed = parse_game_page(
        html,
        source_url="https://atlantagladiators.com/games/2026/03/12/florida-everblades",
        now=datetime(2026, 3, 10, tzinfo=timezone.utc),
    )

    assert parsed == {
        "title": "Atlanta Gladiators vs. Florida Everblades",
        "description": (
            "Official Atlanta Gladiators ECHL home game versus the Florida Everblades at Gas South Arena. "
            "The official game page lists puck drop for March 12, 2026 at 7:10 PM Eastern. "
            "Check the official game page and ticket link for the latest promotions, entry rules, and gameday details."
        ),
        "start_date": "2026-03-12",
        "start_time": "19:10",
        "source_url": "https://atlantagladiators.com/games/2026/03/12/florida-everblades",
        "ticket_url": "https://www.ticketmaster.com/example",
        "image_url": "https://example.com/gladiators.png",
        "raw_text": "Florida Everblades @ Atlanta Gladiators | 2026-03-12T19:10:00-04:00",
    }


def test_parse_game_page_skips_away_games():
    html = """
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      "name": "Atlanta Gladiators @ Jacksonville Icemen",
      "startDate": "2026-03-20T19:00:00-04:00",
      "url": "https://atlantagladiators.com/games/2026/03/20/jacksonville-icemen",
      "homeTeam": {"@type": "SportsTeam", "name": "Jacksonville Icemen"},
      "awayTeam": {"@type": "SportsTeam", "name": "Atlanta Gladiators"}
    }
    </script>
    """

    assert (
        parse_game_page(
            html,
            source_url="https://atlantagladiators.com/games/2026/03/20/jacksonville-icemen",
            now=datetime(2026, 3, 10, tzinfo=timezone.utc),
        )
        is None
    )
