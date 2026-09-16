"""Demand-driven access to the UI's country and ocean reference geometries."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from shapely import wkt


def search_geographies(query: str) -> list[dict[str, Any]]:
    """Find country or ocean entries by name, identifier, or ISO code."""
    needle = query.casefold()
    return [summary for item in _load_entries() if needle in _search_text(item) for summary in [_summary(item)]]


def get_geometry(identifier: str) -> dict[str, Any]:
    """Return WKT only for a requested geographic reference entry."""
    for entry in _load_entries():
        if entry.get("identifier", "").casefold() == identifier.casefold():
            return {**_summary(entry), "wkt": entry["wkt"]}
    raise ValueError(f"No geographic reference geometry found for '{identifier}'.")


@lru_cache(maxsize=1)
def _load_entries() -> list[dict[str, Any]]:
    base_path = Path(os.environ.get("RULE_AGENT_GEOGRAPHY_DIR", _default_geography_directory()))
    entries: list[dict[str, Any]] = []
    for file_name in ("country_polygons.json", "ocean_polygon.json"):
        with (base_path / file_name).open(encoding="utf-8") as source:
            data = json.load(source)
        entries.extend(data if isinstance(data, list) else [data])
    return entries


def _default_geography_directory() -> Path:
    return Path(__file__).resolve().parents[2] / "ui" / "public"


def _summary(entry: dict[str, Any]) -> dict[str, Any]:
    geometry = wkt.loads(entry["wkt"])
    west, south, east, north = geometry.bounds
    return {
        "identifier": entry.get("identifier"),
        "name": entry.get("name"),
        "iso2": entry.get("iso2"),
        "type": entry.get("type"),
        "vertexCount": entry.get("vertexCount"),
        "bounds": {"west": west, "south": south, "east": east, "north": north},
    }


def _search_text(entry: dict[str, Any]) -> str:
    return " ".join(str(entry.get(key, "")) for key in ("identifier", "name", "iso2")).casefold()