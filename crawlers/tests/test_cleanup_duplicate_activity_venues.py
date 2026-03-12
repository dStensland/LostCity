from scripts.cleanup_duplicate_activity_venues import DUPLICATE_VENUE_PLANS, VENUE_PATCHES


def test_duplicate_cleanup_plans_cover_audit_targets() -> None:
    planned_duplicates = {(item["canonical_slug"], item["duplicate_slug"]) for item in DUPLICATE_VENUE_PLANS}
    assert ("sparkles-family-fun-center-kennesaw", "sparkles-kennesaw") in planned_duplicates
    assert ("puttshack-atlanta", "puttshack") in planned_duplicates
    assert ("puttshack-atlanta", "puttshack-atlanta-midtown") in planned_duplicates


def test_duplicate_cleanup_keeps_dunwoody_but_normalizes_type() -> None:
    assert VENUE_PATCHES["puttshack-atlanta-dunwoody"]["venue_type"] == "entertainment"
