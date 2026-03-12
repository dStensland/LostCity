from datetime import date

from sources.georgia_swarm import parse_schedule_html


SAMPLE_HTML = """
<div id="game_list" class="team_list">
  <div class="row">
    <div class="column small-12 date">
      <h2 class="h3 month">Saturday, March 14th 2026</h2>
    </div>
    <div class="card_column columns small-12 large-6">
      <div class="game_card bg_light">
        <div class="game_recap">
          <div class="game_info">
            <div class="game_status">
              <div class="status_wrapper">
                <p class="time"><span class="nll_time" data-time="19:30">19:30:00</span></p>
              </div>
              <div class="game_location">
                <div class="location_wrapper">Gas South Arena</div>
              </div>
            </div>
            <div class="cta_holder">
              <div class="button_wrapper">
                <a href="https://www.georgiaswarm.com/game/example/vancouver-warriors-vs-georgia-swarm/2026-03-14/">Game Preview</a>
              </div>
            </div>
          </div>
          <div class="game_teams">
            <div class="team_box team_1">
              <div class="team_status">Vancouver</div>
              <div class="team_status bold">Warriors</div>
            </div>
            <div class="team_box team_2">
              <div class="team_status">Georgia</div>
              <div class="team_status bold">Swarm</div>
            </div>
          </div>
        </div>
        <div class="buttons">
          <a href="https://www.ticketmaster.com/georgia-swarm">Buy Tickets</a>
        </div>
      </div>
    </div>
    <div class="column small-12 date">
      <h2 class="h3 month">Friday, March 6th 2026</h2>
    </div>
    <div class="card_column columns small-12 large-6">
      <div class="game_card bg_light">
        <div class="game_recap">
          <div class="game_info">
            <div class="game_status">
              <div class="game_location">
                <div class="location_wrapper">Gas South Arena</div>
              </div>
            </div>
          </div>
          <div class="game_teams">
            <div class="team_box team_1">
              <div class="team_status">Calgary</div>
              <div class="team_status bold">Roughnecks</div>
            </div>
            <div class="team_box team_2">
              <div class="team_status">Georgia</div>
              <div class="team_status bold">Swarm</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
"""


def test_parse_schedule_html_extracts_future_home_games():
    games = parse_schedule_html(SAMPLE_HTML, today=date(2026, 3, 10))

    assert games == [
        {
            "title": "Georgia Swarm vs Vancouver Warriors",
            "opponent": "Vancouver Warriors",
            "start_date": "2026-03-14",
            "start_time": "19:30",
            "source_url": "https://www.georgiaswarm.com/game/example/vancouver-warriors-vs-georgia-swarm/2026-03-14/",
            "ticket_url": "https://www.ticketmaster.com/georgia-swarm",
        }
    ]
