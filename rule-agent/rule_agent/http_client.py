"""Small dependency-free JSON HTTP client for public research APIs."""

from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class ResearchApiError(RuntimeError):
    """Raised when a public research API cannot provide a usable response."""


def get_json(url: str, params: dict[str, str | int] | None = None) -> dict[str, Any]:
    """Fetch a JSON object with a bounded timeout and identifiable user agent."""
    query = urlencode(params or {})
    request_url = f"{url}?{query}" if query else url
    request = Request(request_url, headers={"User-Agent": "gbif-rule-agent/0.1"})
    try:
        with urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        raise ResearchApiError(f"Research API request failed for {request_url}: {error}") from error
    if not isinstance(payload, dict):
        raise ResearchApiError(f"Research API returned an unexpected response for {request_url}.")
    return payload