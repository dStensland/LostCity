from pipeline.entity_router import route_extracted_data


def test_routes_events_to_events_lane():
    extracted = [
        {"content_kind": "event", "title": "Jazz Night"},
        {"content_kind": "event", "title": "Open Mic"},
    ]
    routed = route_extracted_data(extracted, declared_lanes=["events"])
    assert len(routed["events"]) == 2


def test_routes_programs_when_declared():
    extracted = [
        {"content_kind": "program", "title": "Swim Lessons"},
        {"content_kind": "event", "title": "Pool Party"},
    ]
    routed = route_extracted_data(extracted, declared_lanes=["events", "programs"])
    assert len(routed["events"]) == 1
    assert len(routed["programs"]) == 1


def test_ignores_undeclared_lanes():
    extracted = [{"content_kind": "exhibition", "title": "Art Show"}]
    routed = route_extracted_data(extracted, declared_lanes=["events"])
    assert "exhibitions" not in routed


def test_defaults_to_event_when_content_kind_missing():
    extracted = [{"title": "Mystery Event"}]
    routed = route_extracted_data(extracted, declared_lanes=["events"])
    assert len(routed["events"]) == 1


def test_maps_exhibit_to_exhibitions():
    extracted = [{"content_kind": "exhibit", "title": "Gallery Show"}]
    routed = route_extracted_data(extracted, declared_lanes=["exhibitions"])
    assert len(routed["exhibitions"]) == 1
