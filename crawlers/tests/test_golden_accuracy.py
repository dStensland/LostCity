"""Benchmark rules engine accuracy against golden test set."""
import json
import os
from classify import classify_rules

GOLDEN_SET_PATH = os.path.join(os.path.dirname(__file__), "golden_classification_set.json")


def load_golden_set():
    with open(GOLDEN_SET_PATH) as f:
        return json.load(f)


def test_rules_wrong_classification_rate_below_15_percent():
    """Rules engine should confidently misclassify fewer than 15% of golden events.

    The rules layer is designed to abstain (return None/low confidence) on ambiguous
    events — those go to LLM. The key metric is: when the rules layer IS confident,
    how often is it WRONG?

    Breakdown categories:
    - Correct: rules category matches expected
    - Abstain: rules returns None (correct behavior — goes to LLM)
    - Wrong: rules returns a confident but INCORRECT category (the real bug)
    """
    golden = load_golden_set()
    correct = 0
    abstain = 0
    wrong = 0
    wrong_events = []
    for event in golden:
        result = classify_rules(
            title=event["title"],
            description=event.get("description", ""),
            venue_type=event.get("venue_type"),
        )
        if result.category == event["expected_category"]:
            correct += 1
        elif result.category is None or result.confidence < 0.5:
            abstain += 1
        else:
            wrong += 1
            wrong_events.append({
                "title": event["title"][:50],
                "expected": event["expected_category"],
                "got": result.category,
                "conf": result.confidence,
            })
    total = len(golden)
    wrong_rate = wrong / total
    print(f"\nRules benchmark: {correct} correct, {abstain} abstain (→LLM), {wrong} wrong out of {total}")
    print(f"Wrong rate: {wrong_rate:.1%}")
    if wrong_events:
        print(f"\nWrong classifications ({len(wrong_events)}):")
        for e in wrong_events[:20]:
            print(f"  '{e['title']}': expected={e['expected']}, got={e['got']} (conf={e['conf']:.2f})")
    assert wrong_rate < 0.15, f"Rules wrong-classification rate too high: {wrong_rate:.1%}"


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
