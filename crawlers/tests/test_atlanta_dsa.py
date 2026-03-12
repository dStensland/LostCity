from sources.atlanta_dsa import (
    _clean_title,
    _extract_calendar_ids,
    _ical_url_for_calendar_id,
)


def test_extract_calendar_ids_from_embeds():
    html = """
    <html>
      <body>
        <iframe src="https://calendar.google.com/calendar/embed?src=c_f0m59gh4vu9qrumbo1bngnmrbs%40group.calendar.google.com&ctz=America%2FNew_York"></iframe>
        <iframe src="https://calendar.google.com/calendar/embed?src=c_977f7d02800489a96f6075256c7bdf00422d67869819c184c14bd0a1605a7573%40group.calendar.google.com&ctz=America%2FNew_York"></iframe>
        <a href="https://calendar.google.com/calendar/embed?src=c_f0m59gh4vu9qrumbo1bngnmrbs%40group.calendar.google.com&ctz=America%2FNew_York">Chapter-Wide</a>
      </body>
    </html>
    """

    assert _extract_calendar_ids(html) == [
        "c_f0m59gh4vu9qrumbo1bngnmrbs@group.calendar.google.com",
        "c_977f7d02800489a96f6075256c7bdf00422d67869819c184c14bd0a1605a7573@group.calendar.google.com",
    ]


def test_ical_url_for_calendar_id_encodes_public_feed_path():
    calendar_id = "c_f0m59gh4vu9qrumbo1bngnmrbs@group.calendar.google.com"

    assert _ical_url_for_calendar_id(calendar_id) == (
        "https://calendar.google.com/calendar/ical/"
        "c_f0m59gh4vu9qrumbo1bngnmrbs%40group.calendar.google.com/public/basic.ics"
    )


def test_clean_title_strips_decorative_edge_emoji():
    assert _clean_title("🌹🌇 Intown Branch DSA 101 🌹🌽") == "Intown Branch DSA 101"
