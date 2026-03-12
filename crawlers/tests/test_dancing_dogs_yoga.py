from sources.dancing_dogs_yoga import _extract_price_info, parse_event_detail_html


def test_extract_price_info_handles_member_and_non_member_prices():
    price_min, price_max, price_note = _extract_price_info(
        "$20 non-members | $15 members"
    )

    assert price_min == 15.0
    assert price_max == 20.0
    assert price_note == "$20 non-members | $15 members"


def test_parse_event_detail_html_uses_json_ld_and_dom_details():
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "http://schema.org",
            "@type": "Event",
            "name": "Peaches to Palm Trees | Jax + Zoe Send-off - Dancing Dogs Yoga",
            "startDate": "2026-03-27T18:30:00-0400",
            "endDate": "2026-03-27T20:00:00-0400",
            "image": ["https://example.com/event.png"]
          }
        </script>
      </head>
      <body>
        <h1 class="eventitem-title">Peaches to Palm Trees | Jax + Zoe Send-off</h1>
        <div class="eventitem-column-content">
          <p>One more community send-off flow.</p>
          <p>$20 non-members | $15 members</p>
          <a href="https://tinyurl.com/peaches-to-palm-trees">Grab Your Spot!</a>
        </div>
      </body>
    </html>
    """

    parsed = parse_event_detail_html(
        html,
        "https://dancingdogsyoga.com/events/peaches-to-palm-trees",
    )

    assert parsed is not None
    assert parsed["title"] == "Peaches to Palm Trees | Jax + Zoe Send-off"
    assert parsed["start_date"] == "2026-03-27"
    assert parsed["start_time"] == "18:30"
    assert parsed["end_time"] == "20:00"
    assert parsed["ticket_url"] == "https://tinyurl.com/peaches-to-palm-trees"
    assert parsed["image_url"] == "https://example.com/event.png"
    assert parsed["price_min"] == 15.0
    assert parsed["price_max"] == 20.0
    assert "Grab Your Spot!" not in parsed["description"]


def test_parse_event_detail_html_returns_none_without_structured_date():
    html = """
    <html>
      <body>
        <h1 class="eventitem-title">Mystery Workshop</h1>
      </body>
    </html>
    """

    assert (
        parse_event_detail_html(
            html,
            "https://dancingdogsyoga.com/events/mystery-workshop",
        )
        is None
    )
