"""Models for draft rules compatible with the annotation service POST endpoint."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class RuleDraft:
    """A review-only rule body accepted by POST /rule after human approval."""

    geometry: str
    annotation: str
    taxon_key: str | None = None
    dataset_key: str | None = None
    checklist_key: str | None = None
    checklist_doi: str | None = None
    basis_of_record: list[str] | None = None
    basis_of_record_negated: bool | None = None
    year_range: str | None = None
    ruleset_id: int | None = None
    project_id: int | None = None
    description: str = ""
    evidence: list[str] = field(default_factory=list)

    def to_post_payload(self) -> dict[str, Any]:
        """Return only fields accepted by the annotation service rule endpoint."""
        payload: dict[str, Any] = {
            "geometry": self.geometry,
            "annotation": self.annotation,
        }
        optional_fields = {
            "taxonKey": self.taxon_key,
            "datasetKey": self.dataset_key,
            "checklistKey": self.checklist_key,
            "checklistDoi": self.checklist_doi,
            "basisOfRecord": self.basis_of_record,
            "basisOfRecordNegated": self.basis_of_record_negated,
            "yearRange": self.year_range,
            "rulesetId": self.ruleset_id,
            "projectId": self.project_id,
        }
        payload.update({key: value for key, value in optional_fields.items() if value is not None})
        return payload