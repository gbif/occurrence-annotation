from rule_agent.agent import TOOLS


def test_offers_no_gbif_occurrence_or_geometry_tools() -> None:
    tool_names = {tool.get("name") for tool in TOOLS}

    assert "get_gbif_occurrence_summary" not in tool_names
    assert "get_gbif_occurrence" not in tool_names
    assert "get_gbif_occurrence_fragment" not in tool_names
    assert "search_geographies" not in tool_names
    assert "get_geography_wkt" not in tool_names