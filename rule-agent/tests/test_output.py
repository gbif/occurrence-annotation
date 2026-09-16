from rule_agent.agent import ResearchResult
from rule_agent.models import RuleDraft
from rule_agent.output import write_drafts


def test_write_drafts_creates_post_ready_json_and_evidence_note(tmp_path) -> None:
    result = ResearchResult(
        summary="One conservative draft.",
        drafts=[
            RuleDraft(
                geometry="POLYGON((-10 40, -10 50, 0 50, 0 40, -10 40))",
                annotation="SUSPICIOUS",
                description="Outside the supported wild range.",
                evidence=["https://example.org/source"],
            )
        ],
        citations=["https://example.org/search"],
        rejected_drafts=[],
    )

    written = write_drafts(result, tmp_path)

    assert written == [tmp_path / "rule-001.json"]
    assert '"annotation": "SUSPICIOUS"' in written[0].read_text(encoding="utf-8")
    assert "https://example.org/search" in (tmp_path / "rule-001.md").read_text(encoding="utf-8")