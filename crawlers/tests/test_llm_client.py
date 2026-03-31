from types import SimpleNamespace
from unittest.mock import patch

import llm_client


def _cfg(openai_key: str = "", anthropic_key: str = ""):
    return SimpleNamespace(
        llm=SimpleNamespace(
            openai_api_key=openai_key,
            anthropic_api_key=anthropic_key,
            provider="auto",
            model="claude-sonnet-4-20250514",
            openai_model="gpt-4o-mini",
            max_tokens=1024,
            temperature=0.0,
        ),
        crawler=SimpleNamespace(request_timeout=30, max_retries=2),
    )


def test_generate_text_falls_back_from_anthropic_to_openai_on_credit_error():
    with patch("llm_client.get_config", return_value=_cfg(openai_key="openai", anthropic_key="anthropic")):
        with patch("llm_client._generate_with_provider") as mock_generate:
            mock_generate.side_effect = [
                RuntimeError("Your credit balance is too low to access the Anthropic API."),
                "openai fallback response",
            ]

            result = llm_client.generate_text(
                system_prompt="system",
                user_message="user",
                provider_override="anthropic",
            )

    assert result == "openai fallback response"
    assert mock_generate.call_args_list[0].args[0] == "anthropic"
    assert mock_generate.call_args_list[1].args[0] == "openai"


def test_generate_text_does_not_fallback_on_non_provider_bug():
    with patch("llm_client.get_config", return_value=_cfg(openai_key="openai", anthropic_key="anthropic")):
        with patch("llm_client._generate_with_provider", side_effect=ValueError("prompt parse bug")):
            try:
                llm_client.generate_text(
                    system_prompt="system",
                    user_message="user",
                    provider_override="anthropic",
                )
            except ValueError as exc:
                assert str(exc) == "prompt parse bug"
            else:
                raise AssertionError("Expected ValueError to be re-raised")
