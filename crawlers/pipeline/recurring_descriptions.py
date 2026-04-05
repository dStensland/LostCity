"""Description builders for recurring generated events."""

from __future__ import annotations

from typing import Optional


def _normalize(value: Optional[str]) -> str:
    return " ".join((value or "").split()).strip(" ,")


def _format_time_label(start_time: Optional[str]) -> Optional[str]:
    time_clean = _normalize(start_time)
    if not time_clean:
        return None

    parts = time_clean.split(":")
    if len(parts) != 2 or not all(part.isdigit() for part in parts):
        return time_clean

    hour = int(parts[0])
    minute = int(parts[1])
    suffix = "AM" if hour < 12 else "PM"
    display_hour = hour % 12 or 12
    if minute == 0:
        return f"{display_hour}{suffix}"
    return f"{display_hour}:{minute:02d}{suffix}"


def build_recurring_trivia_description(
    venue_name: str,
    *,
    brand_name: Optional[str] = None,
    cadence: str = "Weekly",
    neighborhood: Optional[str] = None,
    host_name: Optional[str] = None,
    start_time: Optional[str] = None,
    team_size_max: Optional[int] = None,
    rounds: Optional[int] = None,
    prizes: bool = False,
    accolade: Optional[str] = None,
    extra_details: Optional[str] = None,
) -> Optional[str]:
    """Build compact recurring trivia copy for pub-quiz style events."""
    venue_clean = _normalize(venue_name)
    if not venue_clean:
        return None

    cadence_clean = _normalize(cadence) or "Weekly"
    brand_clean = _normalize(brand_name)
    neighborhood_clean = _normalize(neighborhood)
    host_clean = _normalize(host_name)
    accolade_clean = _normalize(accolade)
    extra_clean = _normalize(extra_details)

    if brand_clean:
        lead = f"{cadence_clean} {brand_clean} at {venue_clean}"
    else:
        lead = f"{cadence_clean} trivia night at {venue_clean}"

    if neighborhood_clean:
        lead = f"{lead} in {neighborhood_clean}"

    sentences = [f"{lead}."]

    if host_clean:
        host_sentence = f"Hosted by {host_clean}"
        if prizes:
            host_sentence = f"{host_sentence} with prizes"
        sentences.append(f"{host_sentence}.")
    elif prizes:
        sentences.append("Free to play with prizes.")

    free_sentence = "Free to play"
    if team_size_max:
        free_sentence = f"{free_sentence} — bring a team of up to {team_size_max}"
    if rounds:
        free_sentence = f"{free_sentence} and compete across {rounds} rounds"
    if start_time:
        formatted_time = _format_time_label(start_time)
        if formatted_time:
            free_sentence = f"{free_sentence}. Quiz starts at {formatted_time}"
    sentences.append(f"{free_sentence}.")

    if accolade_clean:
        sentences.append(f"{accolade_clean}.")

    if extra_clean:
        sentences.append(f"{extra_clean}.")

    return " ".join(sentence.strip() for sentence in sentences if sentence).strip()
