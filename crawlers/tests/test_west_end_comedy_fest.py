from sources.west_end_comedy_fest import _clean_title, _extract_festival_description


def test_clean_title_strips_empty_parentheses() -> None:
    assert _clean_title("Promedy ( )") == "Promedy"
    assert _clean_title("Debra DiGiovanni ()") == "Debra DiGiovanni"


def test_clean_title_strips_ticketing_noise() -> None:
    assert (
        _clean_title("Geoffrey Asmus () Ticketed only no passes.")
        == "Geoffrey Asmus"
    )


def test_extract_festival_description_from_homepage_copy() -> None:
    html = """
    <html>
      <body>
        <p>West End Comedy festival will return March 2027 in Atlanta's historic West End.</p>
        <p>Featuring comics from around the country at Wild Heaven Garden Club, Wild Heaven Lounge, and Plywood Place.</p>
      </body>
    </html>
    """

    assert _extract_festival_description(html) == (
        "West End Comedy Fest is an Atlanta comedy festival in the historic West End "
        "featuring comics from around the country at Wild Heaven Garden Club, "
        "Wild Heaven Lounge, and Plywood Place."
    )
