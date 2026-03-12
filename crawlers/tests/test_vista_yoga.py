from datetime import date

from sources.vista_yoga import _normalize_title, parse_upcoming_html


def test_normalize_title_softens_all_caps_mindbody_titles():
    assert _normalize_title("FELDENKRAIS - NECK RELIEF") == "Feldenkrais - Neck Relief"
    assert (
        _normalize_title('BREATH AND SOUND - "You are the Medicine"')
        == 'Breath and Sound - "You are the Medicine"'
    )


def test_parse_upcoming_html_expands_recurring_rows_and_skips_livestream():
    html = """
    <html>
      <body>
        <table>
          <tbody>
            <tr>
              <td class="healcode-date-field">Mar 13 2026 - Mar 27 2026</td>
              <td class="healcode-time-field">11:30 AM - 1:00 PM</td>
              <td class="healcode-days-field">Fri</td>
              <td class="healcode-button-field">
                <a data-url="https://cart.mindbodyonline.com/enroll/feldenkrais">Sign Up</a>
              </td>
              <td class="mbo_class">
                <a data-url="https://widgets.mindbodyonline.com/class/feldenkrais">FELDENKRAIS - Healthy Joints</a>
              </td>
              <td class="trainer">Aruna Padmanabhan</td>
            </tr>
            <tr>
              <td class="healcode-date-field">Apr 12 2026 - Apr 26 2026</td>
              <td class="healcode-time-field">1:30 PM - 3:00 PM</td>
              <td class="healcode-days-field">Sun</td>
              <td class="healcode-button-field">
                <a data-url="https://cart.mindbodyonline.com/enroll/livestream">Sign Up</a>
              </td>
              <td class="mbo_class">
                <a data-url="https://widgets.mindbodyonline.com/class/livestream">FELDENKRAIS - NECK RELIEF - LIVESTREAM</a>
              </td>
              <td class="trainer">Ravi Prabhakar</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
    """

    parsed = parse_upcoming_html(
        html,
        "https://vistayoga.com/workshops-and-events/upcoming/",
        today=date(2026, 3, 1),
    )

    assert len(parsed) == 3
    assert [event["start_date"] for event in parsed] == [
        "2026-03-13",
        "2026-03-20",
        "2026-03-27",
    ]
    assert all(event["title"] == "Feldenkrais - Healthy Joints" for event in parsed)
    assert all(event["ticket_url"] == "https://cart.mindbodyonline.com/enroll/feldenkrais" for event in parsed)
    assert all(event["subcategory"] == "mobility_class" for event in parsed)


def test_parse_upcoming_html_inherits_summary_course_signup_links():
    html = """
    <html>
      <body>
        <table>
          <tbody>
            <tr class="healcode-summary-course">
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td class="healcode-button-field">
                <a data-url="https://cart.mindbodyonline.com/enroll/kids-yoga-and-art">Sign Up</a>
              </td>
              <td class="mbo_class">
                <a data-url="https://widgets.mindbodyonline.com/class/kids-yoga-and-art">Kids Yoga and Art</a>
              </td>
              <td>&nbsp;</td>
            </tr>
            <tr class="child">
              <td class="healcode-date-field">Mar 22 2026</td>
              <td class="healcode-time-field">3:00 PM - 4:30 PM</td>
              <td class="healcode-days-field">Sun</td>
              <td class="healcode-button-field"></td>
              <td class="mbo_class">
                <a data-url="https://widgets.mindbodyonline.com/class/kids-yoga-and-art">Kids Yoga and Art</a>
              </td>
              <td class="trainer">Ashley Cocchi</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
    """

    parsed = parse_upcoming_html(
        html,
        "https://vistayoga.com/workshops-and-events/upcoming/",
        today=date(2026, 3, 1),
    )

    assert len(parsed) == 1
    assert parsed[0]["title"] == "Kids Yoga and Art"
    assert parsed[0]["start_date"] == "2026-03-22"
    assert parsed[0]["start_time"] == "15:00"
    assert parsed[0]["end_time"] == "16:30"
    assert parsed[0]["ticket_url"] == "https://cart.mindbodyonline.com/enroll/kids-yoga-and-art"
    assert parsed[0]["source_url"] == "https://widgets.mindbodyonline.com/class/kids-yoga-and-art"
    assert "family-friendly" in parsed[0]["tags"]
