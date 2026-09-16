import httpx
from openai import RateLimitError

from rule_agent.agent import _retry_delay_seconds


def test_uses_provider_retry_delay_with_a_small_buffer() -> None:
    error = RateLimitError(
        "Rate limit reached. Please try again in 2.95s.",
        response=httpx.Response(429, request=httpx.Request("POST", "https://api.openai.com")),
        body=None,
    )

    assert _retry_delay_seconds(error) == 3.95