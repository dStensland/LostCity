from pipeline.recurring_descriptions import build_recurring_trivia_description


def test_build_recurring_trivia_description_with_brand_and_start_time() -> None:
    description = build_recurring_trivia_description(
        "Hotel Clermont",
        brand_name="Dirty South Trivia",
        start_time="19:00",
        accolade="Voted Atlanta's best trivia by Creative Loafing readers",
        extra_details="Grab a team and test your knowledge",
    )

    assert description == (
        "Weekly Dirty South Trivia at Hotel Clermont. "
        "Free to play. Quiz starts at 7PM. "
        "Voted Atlanta's best trivia by Creative Loafing readers. "
        "Grab a team and test your knowledge."
    )


def test_build_recurring_trivia_description_with_host_and_team_size() -> None:
    description = build_recurring_trivia_description(
        "Red's Beer Garden",
        cadence="Tuesday",
        neighborhood="Benteen Park",
        host_name="Outspoken Entertainment",
        prizes=True,
        team_size_max=6,
    )

    assert description == (
        "Tuesday trivia night at Red's Beer Garden in Benteen Park. "
        "Hosted by Outspoken Entertainment with prizes. "
        "Free to play — bring a team of up to 6."
    )
