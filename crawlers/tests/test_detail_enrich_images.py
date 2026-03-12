from extractors.structured import (
    extract_jsonld_event_fields,
    extract_open_graph_fields,
)
from pipeline.detail_enrich import enrich_from_detail, _sanitize_link_fields
from pipeline.models import DetailConfig, SelectorSet
from description_quality import classify_description


def test_extract_jsonld_event_fields_skips_logo_and_promotes_real_event_image() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "Spring Festival",
            "image": [
              "https://example.com/assets/site-logo.png",
              "https://example.com/images/spring-festival-hero-1200x675.jpg"
            ]
          }
        </script>
      </head>
    </html>
    """

    result = extract_jsonld_event_fields(html)

    assert result["image_url"] == "https://example.com/images/spring-festival-hero-1200x675.jpg"
    assert result["images"] == [
        {"url": "https://example.com/images/spring-festival-hero-1200x675.jpg"}
    ]


def test_extract_open_graph_fields_ignores_logo_only_images() -> None:
    html = """
    <html>
      <head>
        <meta property="og:image" content="https://example.com/app/uploads/Logo-FB-OG.png" />
        <meta name="twitter:image" content="https://example.com/assets/badge-icon.jpg" />
      </head>
    </html>
    """

    result = extract_open_graph_fields(html)

    assert "image_url" not in result
    assert "images" not in result


def test_extract_open_graph_fields_ignores_boilerplate_description() -> None:
    html = """
    <html>
      <head>
        <meta property="og:description" content="See website" />
      </head>
    </html>
    """

    result = extract_open_graph_fields(html)

    assert "description" not in result


def test_extract_jsonld_event_fields_promotes_status_like_offer_price_to_ticket_status() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "Spring Festival",
            "offers": {
              "url": "https://tickets.example.com/spring-festival",
              "price": "Sales Ended"
            }
          }
        </script>
      </head>
    </html>
    """

    result = extract_jsonld_event_fields(html)

    assert result["ticket_url"] == "https://tickets.example.com/spring-festival"
    assert result["ticket_status"] == "sold-out"
    assert "price_note" not in result


def test_extract_jsonld_event_fields_maps_schema_offer_availability_to_ticket_status() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "Spring Festival",
            "offers": {
              "url": "https://tickets.example.com/spring-festival",
              "availability": "https://schema.org/LimitedAvailability"
            }
          }
        </script>
      </head>
    </html>
    """

    result = extract_jsonld_event_fields(html)

    assert result["ticket_url"] == "https://tickets.example.com/spring-festival"
    assert result["ticket_status"] == "low-tickets"
    assert "price_note" not in result


def test_extract_jsonld_event_fields_maps_event_status_to_cancelled() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "Spring Festival",
            "eventStatus": "https://schema.org/EventPostponed",
            "offers": {
              "url": "https://tickets.example.com/spring-festival",
              "availability": "https://schema.org/InStock"
            }
          }
        </script>
      </head>
    </html>
    """

    result = extract_jsonld_event_fields(html)

    assert result["ticket_url"] == "https://tickets.example.com/spring-festival"
    assert result["ticket_status"] == "cancelled"


def test_extract_jsonld_event_fields_reads_door_time_and_accessible_for_free() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "Spring Festival",
            "doorTime": "2026-03-14T18:00:00-04:00",
            "isAccessibleForFree": true
          }
        </script>
      </head>
    </html>
    """

    result = extract_jsonld_event_fields(html)

    assert result["doors_time"] == "18:00:00"
    assert result["is_free"] is True


def test_extract_jsonld_event_fields_marks_online_attendance_mode_as_virtual() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "Spring Festival Livestream",
            "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
            "location": {
              "@type": "VirtualLocation",
              "url": "https://zoom.us/j/123456789"
            }
          }
        </script>
      </head>
    </html>
    """

    result = extract_jsonld_event_fields(html)

    assert result["venue_name"] == "Online / Virtual Event"
    assert result["tags"] == ["virtual"]
    assert result["links"] == [
        {"type": "website", "url": "https://zoom.us/j/123456789"}
    ]


def test_extract_jsonld_event_fields_marks_mixed_attendance_mode_as_hybrid() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "Spring Festival Panel",
            "eventAttendanceMode": "https://schema.org/MixedEventAttendanceMode",
            "location": [
              {
                "@type": "Place",
                "name": "Main Hall"
              },
              {
                "@type": "VirtualLocation",
                "url": "https://example.com/livestream"
              }
            ]
          }
        </script>
      </head>
    </html>
    """

    result = extract_jsonld_event_fields(html)

    assert result["venue_name"] == "Main Hall"
    assert result["tags"] == ["virtual", "hybrid"]
    assert result["links"] == [
        {"type": "website", "url": "https://example.com/livestream"}
    ]


def test_extract_jsonld_event_fields_marks_moved_online_status_as_virtual() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "Spring Festival Talk",
            "eventStatus": "https://schema.org/EventMovedOnline",
            "location": {
              "@type": "Place",
              "name": "Main Hall"
            }
          }
        </script>
      </head>
    </html>
    """

    result = extract_jsonld_event_fields(html)

    assert result["venue_name"] == "Online / Virtual Event"
    assert result["tags"] == ["virtual"]
    assert "ticket_status" not in result


def test_extract_jsonld_event_fields_aggregates_offer_array_price_range() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "Spring Festival",
            "offers": [
              {
                "url": "https://tickets.example.com/spring-festival/free",
                "price": "0",
                "availability": "https://schema.org/InStock"
              },
              {
                "url": "https://tickets.example.com/spring-festival/vip",
                "price": "35",
                "availability": "https://schema.org/InStock"
              }
            ]
          }
        </script>
      </head>
    </html>
    """

    result = extract_jsonld_event_fields(html)

    assert result["ticket_url"] == "https://tickets.example.com/spring-festival/free"
    assert result["links"] == [
        {"type": "ticket", "url": "https://tickets.example.com/spring-festival/free"},
        {"type": "ticket", "url": "https://tickets.example.com/spring-festival/vip"},
    ]
    assert result["price_min"] == 0.0
    assert result["price_max"] == 35.0
    assert result["ticket_status"] == "tickets-available"
    assert "is_free" not in result


def test_extract_jsonld_event_fields_prefers_available_status_over_sold_out_tier() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "Spring Festival",
            "offers": [
              {
                "url": "https://tickets.example.com/spring-festival/ga",
                "availability": "https://schema.org/SoldOut"
              },
              {
                "url": "https://tickets.example.com/spring-festival/vip",
                "availability": "https://schema.org/InStock"
              }
            ]
          }
        </script>
      </head>
    </html>
    """

    result = extract_jsonld_event_fields(html)

    assert result["ticket_status"] == "tickets-available"


def test_extract_jsonld_event_fields_reads_event_inside_graph() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "name": "Example Venue"
              },
              {
                "@type": "MusicEvent",
                "name": "Spring Festival",
                "description": "Join us for live music and local food vendors.",
                "startDate": "2026-03-14T19:00:00-04:00",
                "offers": {
                  "url": "https://tickets.example.com/spring-festival",
                  "price": "29.50"
                }
              }
            ]
          }
        </script>
      </head>
    </html>
    """

    result = extract_jsonld_event_fields(html)

    assert result["title"] == "Spring Festival"
    assert result["description"] == "Join us for live music and local food vendors."
    assert result["start_date"] == "2026-03-14"
    assert result["start_time"] == "19:00"
    assert result["ticket_url"] == "https://tickets.example.com/spring-festival"
    assert result["price_note"] == "29.50"


def test_extract_jsonld_event_fields_accepts_event_series_objects() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "EventSeries",
            "name": "Atlanta Fair 2026",
            "description": "Annual fair with rides, games, and food.",
            "startDate": "2026-03-12",
            "endDate": "2026-04-12"
          }
        </script>
      </head>
    </html>
    """

    result = extract_jsonld_event_fields(html)

    assert result["title"] == "Atlanta Fair 2026"
    assert result["description"] == "Annual fair with rides, games, and food."
    assert result["start_date"] == "2026-03-12"
    assert result["end_date"] == "2026-04-12"


def test_extract_jsonld_event_fields_infers_series_dates_from_subevents() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "EventSeries",
            "name": "Spring Festival Weekend",
            "subEvent": [
              {
                "@type": "Event",
                "name": "Opening Night",
                "startDate": "2026-03-12T19:00:00-04:00",
                "endDate": "2026-03-12T22:00:00-04:00"
              },
              {
                "@type": "Event",
                "name": "Closing Brunch",
                "startDate": "2026-03-15T11:00:00-04:00",
                "endDate": "2026-03-15T14:00:00-04:00"
              }
            ]
          }
        </script>
      </head>
    </html>
    """

    result = extract_jsonld_event_fields(html)

    assert result["title"] == "Spring Festival Weekend"
    assert result["start_date"] == "2026-03-12"
    assert result["end_date"] == "2026-03-15"


def test_extract_jsonld_event_fields_infers_series_dates_from_event_schedule() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "EventSeries",
            "name": "Gallery Talks",
            "eventSchedule": {
              "@type": "Schedule",
              "startDate": "2026-04-02",
              "endDate": "2026-05-28",
              "repeatFrequency": "P1W"
            }
          }
        </script>
      </head>
    </html>
    """

    result = extract_jsonld_event_fields(html)

    assert result["title"] == "Gallery Talks"
    assert result["start_date"] == "2026-04-02"
    assert result["end_date"] == "2026-05-28"


def test_extract_jsonld_event_fields_extracts_venue_name_and_organizer_links() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "Spring Festival",
            "location": {
              "@type": "Place",
              "name": "The Meadow at Piedmont Park"
            },
            "organizer": {
              "@type": "Organization",
              "name": "Example Fest",
              "url": "https://examplefest.org",
              "email": "hello@examplefest.org",
              "telephone": "+1-404-555-0100",
              "sameAs": [
                "https://www.instagram.com/examplefest",
                "https://www.facebook.com/examplefest"
              ]
            }
          }
        </script>
      </head>
    </html>
    """

    result = extract_jsonld_event_fields(html)

    assert result["venue_name"] == "The Meadow at Piedmont Park"
    assert result["links"] == [
        {"type": "organizer", "url": "https://examplefest.org"},
        {"type": "email", "url": "mailto:hello@examplefest.org"},
        {"type": "phone", "url": "tel:+1-404-555-0100"},
        {"type": "social", "url": "https://www.instagram.com/examplefest"},
        {"type": "social", "url": "https://www.facebook.com/examplefest"},
    ]


def test_enrich_from_detail_filters_selector_logo_images_after_normalization() -> None:
    html = """
    <html>
      <body>
        <div class="gallery">
          <img src="/assets/logo-badge.png" />
          <img src="/media/spring-festival-hero-1200x675.jpg" />
        </div>
      </body>
    </html>
    """

    result = enrich_from_detail(
        html,
        "https://example.com/events/spring-festival",
        "test-source",
        DetailConfig(
            use_jsonld=False,
            use_open_graph=False,
            use_heuristic=False,
            use_llm=False,
            selectors=SelectorSet(image_url=".gallery img@src"),
        ),
    )

    assert result["image_url"] == "https://example.com/media/spring-festival-hero-1200x675.jpg"
    assert result["images"] == [
        {
            "url": "https://example.com/media/spring-festival-hero-1200x675.jpg",
            "width": None,
            "height": None,
            "type": None,
            "source": "selectors",
            "confidence": 0.8,
            "is_primary": True,
        }
    ]


def test_enrich_from_detail_parses_selector_price_range_into_shared_fields() -> None:
    html = """
    <html>
      <body>
        <div class="price">$29.50 ADV / $35 DOS</div>
      </body>
    </html>
    """

    result = enrich_from_detail(
        html,
        "https://example.com/events/spring-festival",
        "test-source",
        DetailConfig(
            use_jsonld=False,
            use_open_graph=False,
            use_heuristic=False,
            use_llm=False,
            selectors=SelectorSet(price=".price"),
        ),
    )

    assert result["price_min"] == 29.5
    assert result["price_max"] == 35.0
    assert result["price_note"] == "$29.50 ADV / $35 DOS"


def test_enrich_from_detail_promotes_selector_price_status_to_ticket_status() -> None:
    html = """
    <html>
      <body>
        <div class="price">Sales Ended</div>
      </body>
    </html>
    """

    result = enrich_from_detail(
        html,
        "https://example.com/events/spring-festival",
        "test-source",
        DetailConfig(
            use_jsonld=False,
            use_open_graph=False,
            use_heuristic=False,
            use_llm=False,
            selectors=SelectorSet(price=".price"),
        ),
    )

    assert result["ticket_status"] == "sold-out"
    assert "price_note" not in result


def test_enrich_from_detail_prefers_explicit_ticket_url_over_home_and_self_links() -> None:
    html = """
    <html>
      <body>
        <div class="cta">
          <a href="/">Venue Home</a>
          <a href="/events/spring-festival">Learn More</a>
          <a href="/tickets/spring-festival">Buy Tickets</a>
        </div>
      </body>
    </html>
    """

    result = enrich_from_detail(
        html,
        "https://example.com/events/spring-festival",
        "test-source",
        DetailConfig(
            use_jsonld=False,
            use_open_graph=False,
            use_heuristic=False,
            use_llm=False,
            selectors=SelectorSet(ticket_url=".cta a@href"),
        ),
    )

    assert result["ticket_url"] == "https://example.com/tickets/spring-festival"
    assert result["links"] == [
        {
            "type": "ticket",
            "url": "https://example.com/tickets/spring-festival",
            "source": "selectors",
            "confidence": 0.8,
        }
    ]


def test_enrich_from_detail_extracts_auxiliary_links_from_selector_links_field() -> None:
    html = """
    <html>
      <body>
        <div class="cta">
          <a href="https://www.instagram.com/springfestival">Instagram</a>
          <a href="https://maps.google.com/?q=Spring+Festival">Directions</a>
          <a href="/about/spring-festival">About the festival</a>
        </div>
      </body>
    </html>
    """

    result = enrich_from_detail(
        html,
        "https://example.com/events/spring-festival",
        "test-source",
        DetailConfig(
            use_jsonld=False,
            use_open_graph=False,
            use_heuristic=False,
            use_llm=False,
            selectors=SelectorSet(links=".cta a@href"),
        ),
    )

    assert "ticket_url" not in result
    assert result["links"] == [
        {
            "type": "social",
            "url": "https://www.instagram.com/springfestival",
            "source": "selectors",
            "confidence": 0.8,
        },
        {
            "type": "map",
            "url": "https://maps.google.com/?q=Spring+Festival",
            "source": "selectors",
            "confidence": 0.8,
        },
        {
            "type": "organizer",
            "url": "https://example.com/about/spring-festival",
            "source": "selectors",
            "confidence": 0.8,
        },
    ]


def test_enrich_from_detail_parses_selector_time_range_into_shared_fields() -> None:
    html = """
    <html>
      <body>
        <div class="time">6-7 PM</div>
      </body>
    </html>
    """

    result = enrich_from_detail(
        html,
        "https://example.com/events/spring-festival",
        "test-source",
        DetailConfig(
            use_jsonld=False,
            use_open_graph=False,
            use_heuristic=False,
            use_llm=False,
            selectors=SelectorSet(time=".time"),
        ),
    )

    assert result["start_time"] == "18:00"
    assert result["end_time"] == "19:00"


def test_enrich_from_detail_parses_selector_time_label_into_start_time() -> None:
    html = """
    <html>
      <body>
        <div class="time">Movie starts at 7pm</div>
      </body>
    </html>
    """

    result = enrich_from_detail(
        html,
        "https://example.com/events/spring-festival",
        "test-source",
        DetailConfig(
            use_jsonld=False,
            use_open_graph=False,
            use_heuristic=False,
            use_llm=False,
            selectors=SelectorSet(time=".time"),
        ),
    )

    assert result["start_time"] == "19:00"
    assert "end_time" not in result


def test_enrich_from_detail_parses_selector_date_range_into_shared_fields() -> None:
    html = """
    <html>
      <body>
        <div class="date">March 12 - April 12, 2026</div>
      </body>
    </html>
    """

    result = enrich_from_detail(
        html,
        "https://example.com/events/spring-festival",
        "test-source",
        DetailConfig(
            use_jsonld=False,
            use_open_graph=False,
            use_heuristic=False,
            use_llm=False,
            selectors=SelectorSet(date=".date"),
        ),
    )

    assert result["start_date"] == "2026-03-12"
    assert result["end_date"] == "2026-04-12"


def test_enrich_from_detail_parses_selector_single_date_into_start_date() -> None:
    html = """
    <html>
      <body>
        <div class="date">March 14, 2026</div>
      </body>
    </html>
    """

    result = enrich_from_detail(
        html,
        "https://example.com/events/spring-festival",
        "test-source",
        DetailConfig(
            use_jsonld=False,
            use_open_graph=False,
            use_heuristic=False,
            use_llm=False,
            selectors=SelectorSet(date=".date"),
        ),
    )

    assert result["start_date"] == "2026-03-14"
    assert "end_date" not in result


def test_enrich_from_detail_drops_title_as_description_from_selectors() -> None:
    html = """
    <html>
      <body>
        <h1>Spring Festival</h1>
        <div class="summary">Spring Festival</div>
      </body>
    </html>
    """

    result = enrich_from_detail(
        html,
        "https://example.com/events/spring-festival",
        "test-source",
        DetailConfig(
            use_jsonld=False,
            use_open_graph=False,
            use_heuristic=False,
            use_llm=False,
            selectors=SelectorSet(title="h1", description=".summary"),
        ),
    )

    assert result["title"] == "Spring Festival"
    assert "description" not in result


def test_enrich_from_detail_strips_repeated_title_prefix_from_selector_description() -> None:
    html = """
    <html>
      <body>
        <h1>Spring Festival</h1>
        <div class="summary">
          Spring Festival - Join us for live music, food trucks, and neighborhood artists.
        </div>
      </body>
    </html>
    """

    result = enrich_from_detail(
        html,
        "https://example.com/events/spring-festival",
        "test-source",
        DetailConfig(
            use_jsonld=False,
            use_open_graph=False,
            use_heuristic=False,
            use_llm=False,
            selectors=SelectorSet(title="h1", description=".summary"),
        ),
    )

    assert result["description"] == "Join us for live music, food trucks, and neighborhood artists."


def test_enrich_from_detail_drops_selector_description_when_only_repeated_titles() -> None:
    html = """
    <html>
      <body>
        <h1>Spring Festival</h1>
        <div class="summary">Spring Festival | Spring Festival</div>
      </body>
    </html>
    """

    result = enrich_from_detail(
        html,
        "https://example.com/events/spring-festival",
        "test-source",
        DetailConfig(
            use_jsonld=False,
            use_open_graph=False,
            use_heuristic=False,
            use_llm=False,
            selectors=SelectorSet(title="h1", description=".summary"),
        ),
    )

    assert "description" not in result


def test_enrich_from_detail_drops_same_page_jsonld_offer_url() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "Spring Festival",
            "offers": {
              "url": "https://example.com/events/spring-festival"
            }
          }
        </script>
      </head>
    </html>
    """

    result = enrich_from_detail(
        html,
        "https://example.com/events/spring-festival",
        "test-source",
        DetailConfig(
            use_jsonld=True,
            use_open_graph=False,
            use_heuristic=False,
            use_llm=False,
        ),
    )

    assert "ticket_url" not in result
    assert "links" not in result


def test_sanitize_link_fields_infers_non_ticket_link_types() -> None:
    result = _sanitize_link_fields(
        {
            "links": [
                {"url": "https://example.com/about/spring-festival"},
                {"url": "https://www.instagram.com/springfestival"},
                {"url": "https://maps.google.com/?q=Spring+Festival"},
                {"url": "https://vendor.example.org/festival-info"},
                {"url": "mailto:hello@example.com"},
                {"url": "tel:+14045550100"},
            ]
        },
        "https://example.com/events/spring-festival",
    )

    assert result["links"] == [
        {"type": "organizer", "url": "https://example.com/about/spring-festival"},
        {"type": "social", "url": "https://www.instagram.com/springfestival"},
        {"type": "map", "url": "https://maps.google.com/?q=Spring+Festival"},
        {"type": "website", "url": "https://vendor.example.org/festival-info"},
        {"type": "email", "url": "mailto:hello@example.com"},
        {"type": "phone", "url": "tel:+14045550100"},
    ]
    assert "ticket_url" not in result


def test_sanitize_link_fields_drops_same_page_and_listing_like_generic_links() -> None:
    result = _sanitize_link_fields(
        {
            "links": [
                {"url": "https://example.com/events/spring-festival"},
                {"url": "https://example.com/events"},
                {"url": "/calendar"},
            ]
        },
        "https://example.com/events/spring-festival",
    )

    assert "links" not in result
    assert "ticket_url" not in result


def test_sanitize_link_fields_drops_account_login_ticket_false_positive() -> None:
    result = _sanitize_link_fields(
        {"ticket_url": "https://example.com/account"},
        "https://example.com/events/spring-festival",
    )

    assert "ticket_url" not in result
    assert "links" not in result


def test_enrich_from_detail_drops_boilerplate_selector_description() -> None:
    html = """
    <html>
      <body>
        <div class="summary">See website</div>
      </body>
    </html>
    """

    result = enrich_from_detail(
        html,
        "https://example.com/events/spring-festival",
        "test-source",
        DetailConfig(
            use_jsonld=False,
            use_open_graph=False,
            use_heuristic=False,
            use_llm=False,
            selectors=SelectorSet(description=".summary"),
        ),
    )

    assert "description" not in result


def test_enrich_from_detail_drops_status_only_price_note_and_keeps_ticket_status() -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "Spring Festival",
            "offers": {
              "url": "https://tickets.example.com/spring-festival",
              "price": "Sold Out"
            }
          }
        </script>
      </head>
    </html>
    """

    result = enrich_from_detail(
        html,
        "https://example.com/events/spring-festival",
        "test-source",
        DetailConfig(
            use_jsonld=True,
            use_open_graph=False,
            use_heuristic=False,
            use_llm=False,
        ),
    )

    assert result["ticket_status"] == "sold-out"
    assert "price_note" not in result


def test_classify_description_flags_spelman_institution_boilerplate() -> None:
    description = (
        "Spelman College, founded in 1881, is a leading liberal arts college widely "
        "recognized as the global leader in the education of women of African descent."
    )

    assert classify_description(description) == "boilerplate"


def test_classify_description_flags_community_platform_error_page_copy() -> None:
    description = "We couldn't find the page on this community event platform. Go back to the last page you were on."

    assert classify_description(description) == "junk"


def test_classify_description_flags_clamped_excerpt_copy() -> None:
    description = (
        "Nobu Woods is a Dominican-American singer, songwriter, and producer from Jamaica, "
        "Queens, known for his self-produced, atmospheric approach to alternative R&B. "
        "Born to first-generation immigrants from the Dominican Republic, Woods was raised "
        "on the rhythm-first sounds of bachata and merengue, developing an early ear for "
        "melody and emotional storytelling. As a teenager, he gravitated toward… Raised in "
        "New Jersey, Isaiah Kaleo is stepping into the spotlight after years of shaping "
        "sound from behind the scenes."
    )

    assert classify_description(description) == "boilerplate"
