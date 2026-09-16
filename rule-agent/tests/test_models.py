from rule_agent.models import RuleDraft


def test_post_payload_excludes_agent_only_evidence() -> None:
    draft = RuleDraft(
        geometry="POLYGON((-10 40, -10 50, 0 50, 0 40, -10 40))",
        annotation="SUSPICIOUS",
        taxon_key="CQ4M",
        description="Outside the defensible wild range.",
        evidence=["https://example.org/source"],
    )

    assert draft.to_post_payload() == {
        "geometry": "POLYGON((-10 40, -10 50, 0 50, 0 40, -10 40))",
        "annotation": "SUSPICIOUS",
        "taxonKey": "CQ4M",
    }