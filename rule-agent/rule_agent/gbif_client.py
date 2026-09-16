"""Read-only GBIF API access for taxon and occurrence investigation."""

from __future__ import annotations

from typing import Any

from .http_client import get_json

GBIF_API_BASE = "https://api.gbif.org/v1"


def match_taxon(name: str) -> dict[str, Any]:
    """Return GBIF backbone match information for a scientific name."""
    return get_json(f"{GBIF_API_BASE}/species/match", {"name": name})


def occurrence_summary(taxon_key: int, limit: int = 20) -> dict[str, Any]:
    """Return a capped modern-occurrence sample and facet-ready summary."""
    return get_json(
        f"{GBIF_API_BASE}/occurrence/search",
        {
            "taxon_key": taxon_key,
            "limit": min(limit, 100),
            "basis_of_record": "HUMAN_OBSERVATION",
        },
    )


def occurrence_detail(occurrence_key: int) -> dict[str, Any]:
    """Return one public GBIF occurrence record."""
    return get_json(f"{GBIF_API_BASE}/occurrence/{occurrence_key}")


def occurrence_fragment(occurrence_key: int) -> dict[str, Any]:
    """Return the GBIF occurrence fragment used to investigate a record."""
    return get_json(f"{GBIF_API_BASE}/occurrence/{occurrence_key}/fragment")