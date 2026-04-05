from pipeline.program_descriptions import build_program_description


def test_build_program_description_with_summary_and_facts() -> None:
    description = build_program_description(
        "Clay Creations Camp",
        venue_name="Vinings School of Art",
        audience="ages 5 1/2 to 12",
        summary="Students work with clay and watercolor throughout the week",
        facts=[
            "Regular camp day runs 9:15am to 2:30pm with optional early drop-off and late pickup",
            "$425 regular full-day weekly rate",
        ],
    )

    assert (
        description
        == "Clay Creations Camp at Vinings School of Art. For ages 5 1/2 to 12. Students work with clay and watercolor throughout the week. Regular camp day runs 9:15am to 2:30pm with optional early drop-off and late pickup. $425 regular full-day weekly rate."
    )


def test_build_program_description_dedupes_duplicate_sentences() -> None:
    description = build_program_description(
        "Improv Camp",
        venue_name="Dad's Garage Theatre",
        audience="rising grades 7-12",
        summary="Friday showcase included for friends and family",
        facts=[
            "Friday showcase included for friends and family",
            None,
        ],
    )

    assert (
        description
        == "Improv Camp at Dad's Garage Theatre. For rising grades 7-12. Friday showcase included for friends and family."
    )
