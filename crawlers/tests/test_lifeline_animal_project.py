from bs4 import BeautifulSoup

from sources.lifeline_animal_project import (
    _description_mentions_other_known_event,
    _extract_description,
)


def test_description_mentions_other_known_event_detects_stale_cross_event_copy():
    assert _description_mentions_other_known_event(
        "Grab your sneakers, leash up your pup, and get ready for a frightfully fun time at LifeLine's inaugural Spooky Pooch 5K & Fun Walk!",
        "LifeLine Super Adopt-a-thon",
    )


def test_extract_description_prefers_body_when_og_description_is_for_other_event():
    soup = BeautifulSoup(
        """
        <html>
          <head>
            <meta property="og:description" content="Grab your sneakers, leash up your pup, and get ready for a frightfully fun time at LifeLine's inaugural Spooky Pooch 5K &amp; Fun Walk!" />
          </head>
          <body>
            <main>
              <p>Our Adoptable Pets page will be undergoing maintenance.</p>
              <p>If you've been thinking about adding a dog to your family, this is your moment.</p>
              <p>Show up. Meet your match. Save a life.</p>
            </main>
          </body>
        </html>
        """,
        "html.parser",
    )

    assert _extract_description(soup, "LifeLine Super Adopt-a-thon") == (
        "If you've been thinking about adding a dog to your family, this is your moment."
    )
