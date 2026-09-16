"""Validation for model-produced WGS84 WKT rule geometries."""

from __future__ import annotations

import re

from shapely import wkt
from shapely.geometry import LineString, Polygon
from shapely.geometry.base import BaseGeometry

MAX_WKT_LENGTH = 125_000
MAX_VERTICES = 2_500
COORDINATE_PATTERN = re.compile(r"-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?")
SUPPORTED_GEOMETRY_TYPES = {"Polygon", "MultiPolygon"}


class GeometryValidationError(ValueError):
    """Raised when generated geometry is unsafe or incompatible with a rule draft."""


def validate_wkt_geometry(wkt_text: str) -> BaseGeometry:
    """Parse and validate a conservative WGS84 polygon or multipolygon draft."""
    if len(wkt_text) > MAX_WKT_LENGTH:
        raise GeometryValidationError(f"WKT exceeds the {MAX_WKT_LENGTH}-character limit.")

    vertex_count = len(COORDINATE_PATTERN.findall(wkt_text))
    if vertex_count > MAX_VERTICES:
        raise GeometryValidationError(f"Geometry exceeds the {MAX_VERTICES}-vertex limit.")

    try:
        geometry = wkt.loads(wkt_text)
    except Exception as error:
        raise GeometryValidationError("Geometry is not valid WKT.") from error

    if geometry.geom_type not in SUPPORTED_GEOMETRY_TYPES:
        raise GeometryValidationError("Geometry must be a POLYGON or MULTIPOLYGON.")
    if geometry.is_empty or not geometry.is_valid:
        raise GeometryValidationError("Geometry must be non-empty and topologically valid.")

    for polygon in _polygons(geometry):
        _validate_polygon(polygon)

    return geometry


def _polygons(geometry: BaseGeometry) -> list[Polygon]:
    if geometry.geom_type == "Polygon":
        return [geometry]  # type: ignore[return-value]
    return list(geometry.geoms)  # type: ignore[union-attr]


def _validate_polygon(polygon: Polygon) -> None:
    for ring in [polygon.exterior, *polygon.interiors]:
        coordinates = list(ring.coords)
        if coordinates[0] != coordinates[-1]:
            raise GeometryValidationError("Every polygon ring must be closed.")
        for longitude, latitude in coordinates:
            if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
                raise GeometryValidationError("Coordinates must be WGS84 longitude-latitude values.")
        _reject_antimeridian_crossing(coordinates)


def _reject_antimeridian_crossing(coordinates: list[tuple[float, float]]) -> None:
    for start, end in zip(coordinates, coordinates[1:]):
        if _is_world_shell_edge(start, end, coordinates):
            continue
        if abs(end[0] - start[0]) > 180:
            raise GeometryValidationError(
                "Geometry crosses the antimeridian and must be split into valid parts."
            )
        if not LineString([start, end]).is_valid:
            raise GeometryValidationError("Geometry contains an invalid line segment.")


def _is_world_shell_edge(
    start: tuple[float, float], end: tuple[float, float], coordinates: list[tuple[float, float]]
) -> bool:
    """Allow the canonical global shell used by the UI for inverted polygons."""
    longitudes = [coordinate[0] for coordinate in coordinates]
    return (
        {start[0], end[0]} == {-180, 180}
        and max(longitudes) - min(longitudes) == 360
    )