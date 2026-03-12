from sources.big_peach_running import (
    build_event_title,
    build_schedule_templates,
    parse_group_runs_schedule,
)


HTML_FIXTURE = """
<table id="runs-group-orig">
  <tr class="date"><th colspan="2"><h3 class="text-center">Tuesday</h3></th></tr>
  <tr>
    <td><a href="/locations/brookhaven">Brookhaven</a></td>
    <td>6:30pm</td>
  </tr>
  <tr>
    <td><a href="/locations/midtown">Midtown</a></td>
    <td>6:30pm</td>
  </tr>
  <tr>
    <td><a href="/locations/decatur">Decatur</a></td>
    <td>6:30pm</td>
  </tr>
  <tr class="date"><th colspan="2"><h3 class="text-center">Wednesday</h3></th></tr>
  <tr>
    <td><a href="/locations/south-fulton">South Fulton</a></td>
    <td>8:00am</td>
  </tr>
  <tr>
    <td><a href="/locations/south-fulton">South Fulton</a></td>
    <td>6:00pm</td>
  </tr>
  <tr>
    <td><a href="/locations/vinings-smyrna">Vinings/Smyrna</a></td>
    <td>6:30pm</td>
  </tr>
  <tr class="date"><th colspan="2"><h3 class="text-center">Thursday</h3></th></tr>
  <tr>
    <td><a href="/locations/brookhaven">Brookhaven</a></td>
    <td>6:30pm</td>
  </tr>
  <tr class="date"><th colspan="2"><h3 class="text-center">Saturday</h3></th></tr>
  <tr>
    <td><a href="/locations/vinings-smyrna">Vinings/Smyrna</a></td>
    <td>7:30am</td>
  </tr>
  <tr>
    <td><a href="/locations/alpharetta">Alpharetta</a></td>
    <td>6:30pm</td>
  </tr>
</table>
"""


def test_parse_group_runs_schedule_filters_to_atlanta_locations():
    schedule = parse_group_runs_schedule(HTML_FIXTURE)

    assert len(schedule) == 8
    assert {row["location"] for row in schedule} == {
        "Brookhaven",
        "Decatur",
        "Midtown",
        "South Fulton",
        "Vinings/Smyrna",
    }


def test_build_schedule_templates_preserves_duplicate_locations():
    templates = build_schedule_templates(parse_group_runs_schedule(HTML_FIXTURE))
    titles = {template["title"] for template in templates}

    assert "Big Peach Social Group Run - Brookhaven (Tuesday)" in titles
    assert "Big Peach Social Group Run - Brookhaven (Thursday)" in titles
    assert "Big Peach Group Run/Walk - South Fulton (Wednesday Morning)" in titles
    assert "Big Peach Group Run/Walk - South Fulton (Wednesday Evening)" in titles
    assert "Big Peach Social Group Run - Vinings/Smyrna (Saturday Morning)" in titles


def test_build_event_title_for_midtown_stays_simple():
    assert build_event_title("Midtown", 1, "18:30") == "Big Peach Social Group Run - Midtown"
