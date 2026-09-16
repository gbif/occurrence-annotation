import json

from rule_agent.agent import _parse_result


def test_parse_result_keeps_supported_drafts_for_review() -> None:
    response = json.dumps(
        {
            "summary": "One defensible rule.",
            "drafts": [
                {
                    "geometry": "POLYGON((-10 40, -10 50, 0 50, 0 40, -10 40))",
                    "annotation": "SUSPICIOUS",
                    "taxonKey": "2431950",
                    "basisOfRecord": ["HUMAN_OBSERVATION"],
                    "description": "Outside a supported range.",
                    "evidence": ["https://example.org/evidence"],
                },
                {
                    "geometry": "POLYGON((170 10, -170 10, -170 20, 170 20, 170 10))",
                    "annotation": "SUSPICIOUS",
                    "evidence": [],
                },
            ],
        }
    )

    result = _parse_result(response, "CQ4M", ["https://example.org/search"], 5)

    assert len(result.drafts) == 2
    assert all(draft.taxon_key == "CQ4M" for draft in result.drafts)
    assert result.drafts[0].basis_of_record is None
    assert result.rejected_drafts == []


def test_parse_result_normalizes_inverted_world_shell_latitudes() -> None:
    response = json.dumps(
        {
            "summary": "One inverted draft.",
            "drafts": [
                {
                    "geometry": "POLYGON((-180 -90, 180 -90, 180 90, -180 90, -180 -90), "
                    "(-10 40, -10 50, 0 50, 0 40, -10 40))",
                    "annotation": "SUSPICIOUS",
                    "evidence": [],
                }
            ],
        }
    )

    result = _parse_result(response, "CQ4M", [], 5)

    assert "-180 -85.0511287798" in result.drafts[0].geometry
    assert "180 85.0511287798" in result.drafts[0].geometry