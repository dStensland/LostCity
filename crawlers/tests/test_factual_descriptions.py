from pipeline.factual_descriptions import (
    build_public_meeting_description,
    build_recovery_meeting_description,
    build_support_group_description,
)


def test_build_public_meeting_description_with_type_and_location() -> None:
    description = build_public_meeting_description(
        "Atlanta City Council",
        "Regular Meeting",
        location="Marvin S. Arrington, Sr. Council Chamber",
    )

    assert (
        description
        == "Public Atlanta City Council regular meeting at Marvin S. Arrington, Sr. Council Chamber. Open to the public."
    )


def test_build_public_meeting_description_with_agenda_hint() -> None:
    description = build_public_meeting_description(
        "Finance/Executive Committee",
        location="Atlanta City Hall",
        agenda_available=True,
    )

    assert (
        description
        == "Finance/Executive Committee meeting at Atlanta City Hall. Open to the public. Agenda available at the link above."
    )


def test_build_support_group_description_with_location() -> None:
    description = build_support_group_description(
        "Alcoholics Anonymous meeting",
        "Ridgeview Institute",
        location="Professional North Building",
    )

    assert (
        description
        == "Alcoholics Anonymous meeting. Free community support at Ridgeview Institute Professional North Building. Open to all."
    )


def test_build_support_group_description_virtual() -> None:
    description = build_support_group_description(
        "Virtual support group for friends and family members",
        "Ridgeview Institute",
        virtual=True,
    )

    assert (
        description
        == "Virtual support group for friends and family members. Free community support at Ridgeview Institute. Open to all."
    )


def test_build_recovery_meeting_description_in_person() -> None:
    description = build_recovery_meeting_description(
        "Alcoholics Anonymous",
        formats=["Open", "Discussion"],
        location_name="Ridgeview Institute",
        notes="Use rear entrance",
        notes_label="Arrival notes",
    )

    assert (
        description
        == "Alcoholics Anonymous peer-support meeting (in-person). Format: Open, Discussion. Location: Ridgeview Institute. Arrival notes: Use rear entrance."
    )


def test_build_recovery_meeting_description_hybrid() -> None:
    description = build_recovery_meeting_description(
        "Narcotics Anonymous",
        attendance="hybrid",
        formats=["Open"],
        location_name="Galano Club",
        notes="Room 2",
        virtual_link_available=True,
        dial_in_available=True,
    )

    assert (
        description
        == "Narcotics Anonymous peer-support meeting (hybrid: in-person and online). Format: Open. Location: Galano Club. Notes: Room 2. Virtual meeting link available. Dial-in available."
    )
