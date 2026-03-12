from description_fetcher import extract_description_from_html


def test_extract_description_from_html_rejects_institution_boilerplate() -> None:
    html = """
    <html>
      <head>
        <meta
          property="og:description"
          content="Spelman College, founded in 1881, is a leading liberal arts college widely recognized as the global leader in the education of women of African descent."
        />
      </head>
      <body>
        <main>
          <p>Spelman College, founded in 1881, is a leading liberal arts college widely recognized as the global leader in the education of women of African descent.</p>
        </main>
      </body>
    </html>
    """

    assert extract_description_from_html(html) is None


def test_extract_description_from_html_keeps_real_event_copy() -> None:
    html = """
    <html>
      <body>
        <article class="event-content">
          <p>
            Repossessions brings together contemporary works that examine memory,
            ownership, and cultural inheritance through sculpture, video, and
            mixed-media installation.
          </p>
        </article>
      </body>
    </html>
    """

    result = extract_description_from_html(html)

    assert result is not None
    assert "memory, ownership, and cultural inheritance" in result
