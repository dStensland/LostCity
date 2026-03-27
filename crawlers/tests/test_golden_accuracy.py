"""Benchmark rules engine accuracy against golden test set."""
import json
import os
from classify import classify_rules

GOLDEN_SET_PATH = os.path.join(os.path.dirname(__file__), "golden_classification_set.json")


def load_golden_set():
    with open(GOLDEN_SET_PATH) as f:
        return json.load(f)


def test_rules_accuracy_above_60_percent():
    """Rules engine should correctly classify at least 60% of golden events."""
    golden = load_golden_set()
    correct = 0
    errors = []
    for event in golden:
        result = classify_rules(
            title=event["title"],
            description=event.get("description", ""),
            venue_type=event.get("venue_type"),
        )
        if result.category == event["expected_category"]:
            correct += 1
        else:
            errors.append({
                "title": event["title"][:50],
                "expected": event["expected_category"],
                "got": result.category,
                "conf": result.confidence,
            })
    accuracy = correct / len(golden)
    print(f"\nRules accuracy: {correct}/{len(golden)} = {accuracy:.1%}")
    print(f"\nTop misclassifications ({len(errors)} total):")
    for e in errors[:20]:
        print(f"  '{e['title']}': expected={e['expected']}, got={e['got']} (conf={e['conf']:.2f})")
    assert accuracy >= 0.60, f"Rules accuracy too low: {accuracy:.1%}"


def test_no_esports_on_blazesports():
    """BlazeSports events must never get esports genre."""
    golden = load_golden_set()
    for event in golden:
        if "blazesport" in event["title"].lower():
            result = classify_rules(
                title=event["title"],
                description=event.get("description", ""),
                venue_type=event.get("venue_type"),
            )
            assert "esports" not in result.genres, f"BlazeSports false positive: {event['title']}"


def test_audience_inference_coverage():
    """Spot-check audience inference on golden set events with known audiences."""
    golden = load_golden_set()
    audience_events = [e for e in golden if e.get("expected_audience", "general") != "general"]
    if len(audience_events) < 3:
        print(f"\nOnly {len(audience_events)} non-general audience events in golden set — skipping")
        return
    correct = 0
    for event in audience_events:
        result = classify_rules(
            title=event["title"],
            description=event.get("description", ""),
            venue_type=event.get("venue_type"),
        )
        if result.audience == event["expected_audience"]:
            correct += 1
        else:
            print(f"  Audience mismatch: '{event['title'][:40]}' expected={event['expected_audience']} got={result.audience}")
    accuracy = correct / len(audience_events) if audience_events else 0
    print(f"\nAudience accuracy: {correct}/{len(audience_events)} = {accuracy:.1%}")
