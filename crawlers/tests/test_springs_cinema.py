from sources.springs_cinema import merge_graphql_auth_headers


def test_merge_graphql_auth_headers_accepts_any_graphql_request_headers() -> None:
    auth_headers: dict[str, str] = {}

    changed = merge_graphql_auth_headers(
        auth_headers,
        {
            "circuit-id": "45",
            "site-id": "46",
            "client-type": "consumer",
            "content-type": "application/json",
        },
    )

    assert changed is True
    assert auth_headers == {
        "circuit-id": "45",
        "site-id": "46",
        "client-type": "consumer",
    }


def test_merge_graphql_auth_headers_ignores_missing_values() -> None:
    auth_headers = {"circuit-id": "45"}

    changed = merge_graphql_auth_headers(
        auth_headers,
        {
            "content-type": "application/json",
            "site-id": "",
        },
    )

    assert changed is False
    assert auth_headers == {"circuit-id": "45"}
