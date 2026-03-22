"""
Tests for crawlers/scripts/migration_status.py
"""

from scripts.migration_status import compute_migration_status


def test_counts_profile_only_sources():
    profiles = {"a", "b", "c"}
    modules = {"b", "c", "d"}
    status = compute_migration_status(profiles, modules)
    assert status["profile_only"] == 1  # "a"
    assert status["both"] == 2  # "b", "c"
    assert status["module_only"] == 1  # "d"


def test_migration_percentage():
    profiles = {"a", "b", "c", "d", "e"}
    modules = {"d", "e", "f", "g"}
    status = compute_migration_status(profiles, modules)
    assert status["total"] == 7
    assert status["profile_only"] == 3
    assert status["module_only"] == 2


def test_empty_sets():
    status = compute_migration_status(set(), set())
    assert status["total"] == 0
    assert status["pct_migrated"] == 0.0


def test_both_count():
    profiles = {"x", "y", "z"}
    modules = {"y", "z", "w"}
    status = compute_migration_status(profiles, modules)
    assert status["both"] == 2  # "y", "z"
    assert status["total"] == 4  # x, y, z, w


def test_all_migrated():
    profiles = {"a", "b", "c"}
    modules = {"a", "b", "c"}
    status = compute_migration_status(profiles, modules)
    assert status["both"] == 3
    assert status["profile_only"] == 0
    assert status["module_only"] == 0
    assert status["pct_migrated"] == 100.0


def test_no_overlap():
    profiles = {"a", "b"}
    modules = {"c", "d"}
    status = compute_migration_status(profiles, modules)
    assert status["both"] == 0
    assert status["profile_only"] == 2
    assert status["module_only"] == 2
    assert status["total"] == 4
    assert status["pct_migrated"] == 0.0


def test_pct_migrated_calculation():
    # 2 in both, 1 profile_only, 1 module_only -> total=4, both=2
    profiles = {"a", "b", "c"}
    modules = {"b", "c", "d"}
    status = compute_migration_status(profiles, modules)
    # pct_migrated = both / total * 100 = 2/4 * 100 = 50.0
    assert status["pct_migrated"] == 50.0


def test_pct_legacy():
    profiles = {"a", "b", "c"}
    modules = {"b", "c", "d"}
    status = compute_migration_status(profiles, modules)
    # pct_legacy = profile_only / total * 100 = 1/4 * 100 = 25.0
    assert status["pct_legacy"] == 25.0


def test_pct_transitional():
    profiles = {"a", "b", "c"}
    modules = {"b", "c", "d"}
    status = compute_migration_status(profiles, modules)
    # pct_transitional = module_only / total * 100 = 1/4 * 100 = 25.0
    assert status["pct_transitional"] == 25.0


def test_module_only_only():
    profiles = set()
    modules = {"a", "b", "c"}
    status = compute_migration_status(profiles, modules)
    assert status["module_only"] == 3
    assert status["profile_only"] == 0
    assert status["both"] == 0
    assert status["total"] == 3
    assert status["pct_migrated"] == 0.0


def test_profile_only_only():
    profiles = {"a", "b", "c"}
    modules = set()
    status = compute_migration_status(profiles, modules)
    assert status["profile_only"] == 3
    assert status["module_only"] == 0
    assert status["both"] == 0
    assert status["total"] == 3
