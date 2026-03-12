from sources.atlutd_pubs import build_matchup_participants, parse_watch_party_schedule


HTML_FIXTURE = """
<div class="tab-title">
  <div class="fo-title tabletitle">Watch Party Schedule</div>
</div>
<div class="fo-table tablebody">
  <div class="spacer">
    <table>
      <tbody>
        <tr>
          <td><div><strong>DATE</strong></div></td>
          <td><div><strong>LOCATION</strong></div></td>
          <td><div><strong>EVENT TIME</strong></div></td>
          <td><div><strong>KICKOFF</strong></div></td>
          <td><div><strong>OPPONENT</strong></div></td>
        </tr>
        <tr>
          <td><div>Saturday, April 11</div></td>
          <td><div>Fado Irish Pub - Buckhead</div></td>
          <td><div>7pm-11pm</div></td>
          <td><div>8:30pm</div></td>
          <td><div>Chicago</div></td>
        </tr>
        <tr>
          <td><div>Saturday, April 25</div></td>
          <td><div>Der Biergarten</div></td>
          <td><div>TBD</div></td>
          <td><div>1pm</div></td>
          <td><div>Toronto</div></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
"""


def test_parse_watch_party_schedule_extracts_rows():
    events = parse_watch_party_schedule(HTML_FIXTURE, year=2026)

    assert len(events) == 2
    assert events[0]["title"] == "Atlanta United Watch Party vs Chicago at Fado Irish Pub - Buckhead"
    assert events[0]["start_date"] == "2026-04-11"
    assert events[0]["start_time"] == "19:00"
    assert events[0]["venue_data"]["slug"] == "fado-irish-pub"


def test_parse_watch_party_schedule_uses_kickoff_when_window_missing():
    events = parse_watch_party_schedule(HTML_FIXTURE, year=2026)

    assert events[1]["title"] == "Atlanta United Watch Party vs Toronto at Der Biergarten"
    assert events[1]["start_time"] == "13:00"


def test_build_matchup_participants_uses_home_team_and_opponent():
    assert build_matchup_participants("Chicago Fire FC") == [
        {"name": "Atlanta United FC", "role": "team", "billing_order": 1},
        {"name": "Chicago Fire FC", "role": "team", "billing_order": 2},
    ]
