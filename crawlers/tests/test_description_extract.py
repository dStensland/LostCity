from pipeline.description_extract import extract_description_from_html, sanitize_description


def test_extract_description_prefers_specific_content_region() -> None:
    html = """
    <html>
      <head>
        <meta
          name="description"
          content="Join us for community events all season long."
        />
      </head>
      <body>
        <div data-testid="event-description">
          A guided tasting of small-batch spirits, cocktails, and pairings with the Bowler team.
        </div>
      </body>
    </html>
    """

    result = extract_description_from_html(
        html,
        preferred_selectors=['[data-testid="event-description"]'],
    )

    assert (
        result
        == "A guided tasting of small-batch spirits, cocktails, and pairings with the Bowler team."
    )


def test_extract_description_falls_back_to_jsonld() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {"description": "An immersive gallery installation exploring memory, archives, and cultural inheritance."}
        </script>
      </head>
      <body></body>
    </html>
    """

    result = extract_description_from_html(html)

    assert result == "An immersive gallery installation exploring memory, archives, and cultural inheritance."


def test_sanitize_description_removes_scaffold_and_policy_tail() -> None:
    raw = (
        "Tuesday, April 7th - 6:30pm-9:30pm Prices are listed per person. "
        "Knife Skills 101 Hands On with Melissa Pelkey-Hass Master the blade and transform your cooking. "
        "This is a hands-on cooking class where you'll put your new skills to immediate use. "
        "We do not allow groups larger than six to book in public classes. Classes are held at the Ansley Mall Store."
    )

    cleaned = sanitize_description(
        raw,
        leading_patterns=[
            r"^[A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?\s*-\s*\d{1,2}:\d{2}(?:am|pm)?(?:-\d{1,2}:\d{2}(?:am|pm)?)?\s*",
            r"^Prices are listed per person\.\s*",
            r"^Knife Skills 101 Hands On\s+with\s+",
        ],
        stop_markers=["We do not allow groups larger than six"],
    )

    assert cleaned == (
        "Melissa Pelkey-Hass Master the blade and transform your cooking. "
        "This is a hands-on cooking class where you'll put your new skills to immediate use."
    )
