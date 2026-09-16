import pytest

from rule_agent.geometry import GeometryValidationError, validate_wkt_geometry


def test_accepts_closed_wgs84_polygon() -> None:
    geometry = validate_wkt_geometry("POLYGON((-10 40, -10 50, 0 50, 0 40, -10 40))")

    assert geometry.geom_type == "Polygon"


def test_rejects_unsplit_antimeridian_crossing() -> None:
    with pytest.raises(GeometryValidationError, match="antimeridian"):
        validate_wkt_geometry("POLYGON((170 10, -170 10, -170 20, 170 20, 170 10))")


def test_accepts_inverted_world_shell_with_a_plausible_range_hole() -> None:
    geometry = validate_wkt_geometry(
        "POLYGON((-180 -85, 180 -85, 180 85, -180 85, -180 -85), "
        "(-10 40, -10 50, 0 50, 0 40, -10 40))"
    )

    assert len(geometry.interiors) == 1


def test_rejects_out_of_bounds_coordinates() -> None:
    with pytest.raises(GeometryValidationError, match="longitude-latitude"):
        validate_wkt_geometry("POLYGON((10 95, 10 80, 20 80, 20 95, 10 95))")