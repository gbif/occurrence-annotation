"""Read-only Catalogue of Life taxon resolution."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .http_client import get_json

COL_DATASET_KEY = "3LR"
COL_API_BASE = "https://api.catalogueoflife.org"


@dataclass(frozen=True)
class ColTaxon:
    """A Catalogue of Life taxon concept the caller may research."""

    id: str
    name: str
    rank: str | None
    status: str | None
    classification: str | None


class AmbiguousTaxonError(ValueError):
    """Raised when a scientific name does not resolve to one accepted COL concept."""

    def __init__(self, candidates: list[ColTaxon]) -> None:
        self.candidates = candidates
        candidate_text = "; ".join(f"{item.id}: {item.name}" for item in candidates)
        super().__init__(f"Taxon name is ambiguous. Retry with one COL key: {candidate_text}")


def resolve_taxon(taxon_or_key: str) -> ColTaxon:
    """Resolve a COL key directly or require explicit choice for ambiguous names."""
    response = get_json(
        f"{COL_API_BASE}/dataset/{COL_DATASET_KEY}/nameusage/search",
        {"q": taxon_or_key, "limit": 20},
    )
    candidates = [
        _to_taxon(item) for item in response.get("result", []) if _is_accepted(_usage(item))
    ]
    exact_matches = [item for item in candidates if item.name.casefold() == taxon_or_key.casefold()]
    if len(exact_matches) == 1:
        return exact_matches[0]
    if len(candidates) == 1:
        return candidates[0]
    if candidates:
        raise AmbiguousTaxonError(candidates)
    if _looks_like_col_key(taxon_or_key):
        return _get_taxon(taxon_or_key)
    raise ValueError(f"No accepted Catalogue of Life taxon found for '{taxon_or_key}'.")


def _get_taxon(taxon_key: str) -> ColTaxon:
    response = get_json(f"{COL_API_BASE}/dataset/{COL_DATASET_KEY}/taxon/{taxon_key}")
    return _to_taxon(response)


def _looks_like_col_key(value: str) -> bool:
    return " " not in value and value.isalnum() and not value.isdigit()


def _is_accepted(item: dict[str, Any]) -> bool:
    return item.get("status") in {None, "accepted"}


def _usage(item: dict[str, Any]) -> dict[str, Any]:
    """Unwrap the usage object returned by COL's taxon name-search endpoint."""
    usage = item.get("usage")
    return usage if isinstance(usage, dict) else item


def _to_taxon(item: dict[str, Any]) -> ColTaxon:
    usage = _usage(item)
    name = usage.get("name")
    name_data = name if isinstance(name, dict) else usage
    classification = item.get("classification") or usage.get("classification")
    classification_text = None
    if isinstance(classification, list):
        classification_text = "; ".join(
            str(entry.get("name")) for entry in classification if isinstance(entry, dict)
        )
    return ColTaxon(
        id=str(usage["id"]),
        name=str(name_data.get("scientificName") or name_data.get("name") or usage["id"]),
        rank=name_data.get("rank") or usage.get("rank"),
        status=usage.get("status"),
        classification=classification_text,
    )