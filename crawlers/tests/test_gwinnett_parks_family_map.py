from sources.gwinnett_parks_family_map import (
    _build_envelope,
    _extract_detail_paths,
    _infer_venue_type,
    _is_supported_family_destination,
    _parse_park_page,
)


def test_extract_detail_paths_pulls_unique_explore_links():
    html = """
    <a href="/government/departments/parks-recreation/parks/explore/graves">Graves Park</a>
    <a href="/government/departments/parks-recreation/parks/explore/graves">Graves Park again</a>
    <a href="/government/departments/parks-recreation/parks/explore/bethesda/aquatic-center">Bethesda Park Aquatic Center</a>
    <a href="/government/departments/parks-recreation/parks/rules">Rules</a>
    """

    assert _extract_detail_paths(html) == [
        "/government/departments/parks-recreation/parks/explore/graves",
        "/government/departments/parks-recreation/parks/explore/bethesda/aquatic-center",
    ]


def test_parse_park_page_extracts_address_and_amenities():
    html = """
    <html>
      <head><title>Graves Park - Gwinnett County - Gwinnett</title></head>
      <body>
        <h2>Park Entrance</h2>
        <div><div><div>
          <p><strong>Park Entrance</strong><br>1540 Graves Road, Norcross<br></p>
          <p><strong>Park Hours</strong><br>Sunrise until sunset</p>
        </div></div></div>
        <h2>Amenities</h2>
        <div><div><div>
          <ul>
            <li>Splash pad</li>
            <li>Playground</li>
            <li>1.25-mile paved trail</li>
            <li>Restrooms</li>
          </ul>
        </div></div></div>
      </body>
    </html>
    """

    parsed = _parse_park_page(
        html,
        "https://www.gwinnettcounty.com/government/departments/parks-recreation/parks/explore/graves",
    )

    assert parsed["name"] == "Graves Park"
    assert parsed["address"] == "1540 Graves Road"
    assert parsed["city"] == "Norcross"
    assert "Splash pad" in parsed["amenities"]
    assert "Playground" in parsed["amenities"]
    assert parsed["place_type"] == "park"
    assert parsed["destination_type"] == "park"


def test_parse_aquatic_page_infers_aquatic_center():
    html = """
    <html>
      <head><title>Bethesda Park Aquatic Center - Gwinnett County - Gwinnett</title></head>
      <body>
        <h2>Park Entrance</h2>
        <div><div><div>
          <p><strong>Park Entrance</strong><br>225 Bethesda Church Road, Lawrenceville<br></p>
        </div></div></div>
        <h2>Amenities</h2>
        <div><div><div>
          <ul><li>Competition pool</li></ul>
        </div></div></div>
      </body>
    </html>
    """

    parsed = _parse_park_page(
        html,
        "https://www.gwinnettcounty.com/government/departments/parks-recreation/parks/explore/bethesda/aquatic-center",
    )

    assert parsed["place_type"] == "recreation"
    assert parsed["destination_type"] == "aquatic_center"


def test_parse_park_page_handles_modern_top_of_page_address_copy():
    html = """
    <html>
      <head><title>Dacula Park - Gwinnett County - Gwinnett</title></head>
      <body>
        <h1>Dacula Park</h1>
        <p>Park and Pool Entrance 205 Dacula Road, Dacula</p>
        <p>Activity Building Entrance 2735 Auburn Avenue, Dacula</p>
        <h2>Amenities</h2>
        <div><ul><li>Playground</li><li>Trails</li></ul></div>
      </body>
    </html>
    """

    parsed = _parse_park_page(
        html,
        "https://www.gwinnettcounty.com/government/departments/parks-recreation/parks/explore/dacula",
    )

    assert parsed["address"] == "205 Dacula Road"
    assert parsed["city"] == "Dacula"


def test_parse_pool_page_handles_plain_address_line_before_amenities():
    html = """
    <html>
      <head><title>Best Friend Park Pool - Gwinnett County - Gwinnett</title></head>
      <body>
        <h1>Best Friend Park Pool</h1>
        <p>6224 Jimmy Carter Boulevard, Norcross</p>
        <p>Info, Pool Rentals, and Swim Lessons 678.277.0224</p>
        <h2>Amenities</h2>
        <div><ul><li>Seasonal pool</li></ul></div>
      </body>
    </html>
    """

    parsed = _parse_park_page(
        html,
        "https://www.gwinnettcounty.com/government/departments/parks-recreation/parks/explore/best-friend/best-friend-pool",
    )

    assert parsed["address"] == "6224 Jimmy Carter Boulevard"
    assert parsed["city"] == "Norcross"
    assert parsed["destination_type"] == "aquatic_center"


def test_activity_building_path_infers_recreation_center():
    venue_type, spot_type, destination_type = _infer_venue_type(
        "Singleton Park",
        "https://www.gwinnettcounty.com/government/departments/parks-recreation/parks/explore/singleton-activity-building",
    )

    assert venue_type == "recreation"
    assert spot_type == "community_center"
    assert destination_type == "community_recreation_center"


def test_build_envelope_adds_sports_and_generic_family_features():
    park = {
        "name": "Harmony Grove Soccer Complex",
        "url": "https://www.gwinnettcounty.com/government/departments/parks-recreation/parks/explore/harmony-grove-soccer-complex",
        "summary": None,
        "amenities": ["Three full-size soccer fields", "Restrooms"],
        "destination_type": "park",
    }

    sports = _build_envelope(
        park,
        venue_id=77,
        add_destination_details=False,
        add_playground_feature=False,
        add_water_play_feature=False,
        add_trail_feature=False,
        add_sports_feature=True,
        add_rec_center_feature=False,
        add_picnic_feature=False,
        add_nature_feature=False,
        add_generic_outdoor_feature=False,
    )
    assert [feature["slug"] for feature in sports.venue_features] == ["official-county-youth-sports-fields"]

    generic = _build_envelope(
        {**park, "name": "Singleton Park"},
        venue_id=78,
        add_destination_details=False,
        add_playground_feature=False,
        add_water_play_feature=False,
        add_trail_feature=False,
        add_sports_feature=False,
        add_rec_center_feature=False,
        add_picnic_feature=False,
        add_nature_feature=False,
        add_generic_outdoor_feature=True,
    )
    assert [feature["slug"] for feature in generic.venue_features] == ["free-outdoor-play-space"]

    picnic = _build_envelope(
        {**park, "name": "Jones Bridge Park", "amenities": ["Picnic pavilions", "River access"]},
        venue_id=79,
        add_destination_details=False,
        add_playground_feature=False,
        add_water_play_feature=False,
        add_trail_feature=False,
        add_sports_feature=False,
        add_rec_center_feature=False,
        add_picnic_feature=True,
        add_nature_feature=True,
        add_generic_outdoor_feature=False,
    )
    assert {feature["slug"] for feature in picnic.venue_features} == {
        "official-county-picnic-pavilions",
        "official-county-nature-and-open-space",
    }


def test_parse_legacy_block_address_stops_before_following_labels():
    html = """
    <html>
      <head><title>Freeman's Mill Park - Gwinnett County - Gwinnett</title></head>
      <body>
        <h2>Park Entrance</h2>
        <div>
          <p><strong>Park Entrance</strong><br>
          1401 Alcovy Road, Lawrenceville<br>
          <strong>Park &amp; Historic Information</strong><br>
          770.822.5178</p>
        </div>
        <h2>Amenities</h2>
        <div><ul><li>Historic mill</li></ul></div>
      </body>
    </html>
    """

    parsed = _parse_park_page(
        html,
        "https://www.gwinnettcounty.com/government/departments/parks-recreation/parks/explore/freemans-mill",
    )

    assert parsed["address"] == "1401 Alcovy Road"
    assert parsed["city"] == "Lawrenceville"


def test_supported_family_destination_filters_non_park_cultural_pages():
    assert _is_supported_family_destination(
        "Graves Park",
        "/government/departments/parks-recreation/parks/explore/graves",
        ["Splash pad", "Playground"],
    )
    assert not _is_supported_family_destination(
        "Gwinnett Historic Courthouse",
        "/government/departments/parks-recreation/parks/explore/historic-courthouse",
        ["Guided tours", "Exhibits"],
    )
