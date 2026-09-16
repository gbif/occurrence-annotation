"""OpenAI Responses API orchestration for research-only rule drafting."""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from typing import Any, Callable

from openai import OpenAI, RateLimitError

from . import gbif_client
from .col_client import ColTaxon
from .prompt import SYSTEM_PROMPT
from .models import RuleDraft

MODEL = "gpt-5.6-terra"
REASONING_EFFORT = "high"
MAX_OUTPUT_TOKENS = 12_000
MAX_RATE_LIMIT_RETRIES = 3
ALLOWED_ANNOTATIONS = {"SUSPICIOUS", "INTRODUCED", "VAGRANT"}
INVERTED_SHELL_REPLACEMENTS = {
    "-180 -90": "-180 -85.0511287798",
    "180 -90": "180 -85.0511287798",
    "180 90": "180 85.0511287798",
    "-180 90": "-180 85.0511287798",
}


@dataclass(frozen=True)
class ResearchResult:
    """A completed investigation with valid draft candidates and citations."""

    summary: str
    drafts: list[RuleDraft]
    citations: list[str]
    rejected_drafts: list[str]


TOOLS: list[dict[str, Any]] = [
    {"type": "web_search"},
    {
        "type": "function",
        "name": "match_gbif_taxon",
        "description": "Match a scientific name against the GBIF backbone taxonomy.",
        "parameters": {
            "type": "object",
            "properties": {"name": {"type": "string"}},
            "required": ["name"],
            "additionalProperties": False,
        },
    },
]


def research_taxon(
    client: OpenAI,
    taxon: ColTaxon,
    *,
    max_tool_rounds: int = 6,
    max_output_rules: int = 5,
) -> ResearchResult:
    """Research a resolved COL taxon and return valid, unsaved rule candidates."""
    initial_input = (
        "Research and draft conservative geographic occurrence annotation rules for this "
        f"resolved Catalogue of Life taxon:\n{json.dumps(taxon.__dict__, indent=2)}"
    )
    response = _create_response(
        client,
        model=MODEL,
        reasoning={"effort": REASONING_EFFORT},
        max_output_tokens=MAX_OUTPUT_TOKENS,
        instructions=SYSTEM_PROMPT,
        input=initial_input,
        tools=TOOLS,
    )
    citations = _extract_citations(response)

    for _ in range(max_tool_rounds):
        calls = [item for item in response.output if getattr(item, "type", None) == "function_call"]
        if not calls:
            return _parse_result(response.output_text, taxon.id, citations, max_output_rules)
        outputs = [_execute_call(call) for call in calls]
        response = _create_response(
            client,
            model=MODEL,
            reasoning={"effort": REASONING_EFFORT},
            max_output_tokens=MAX_OUTPUT_TOKENS,
            instructions=SYSTEM_PROMPT,
            previous_response_id=response.id,
            input=outputs,
            tools=TOOLS,
        )
        citations.extend(_extract_citations(response))

    raise RuntimeError(f"Research exceeded the {max_tool_rounds}-round tool-call limit.")


def _create_response(client: OpenAI, **request: Any) -> Any:
    """Create a response, waiting only for transient provider rate-limit windows."""
    for attempt in range(MAX_RATE_LIMIT_RETRIES + 1):
        try:
            return client.responses.create(**request)
        except RateLimitError as error:
            if attempt == MAX_RATE_LIMIT_RETRIES:
                raise
            time.sleep(_retry_delay_seconds(error))
    raise RuntimeError("OpenAI response retry loop ended unexpectedly.")


def _retry_delay_seconds(error: RateLimitError) -> float:
    match = re.search(r"try again in ([0-9.]+)s", str(error), re.IGNORECASE)
    return float(match.group(1)) + 1 if match else 5.0


def _execute_call(call: Any) -> dict[str, str]:
    try:
        arguments = json.loads(call.arguments)
        result = _tool_handlers()[call.name](arguments)
        output = json.dumps(result)
    except (KeyError, ValueError, TypeError, RuntimeError) as error:
        output = json.dumps({"error": str(error)})
    return {"type": "function_call_output", "call_id": call.call_id, "output": output}


def _tool_handlers() -> dict[str, Callable[[dict[str, Any]], Any]]:
    return {
        "match_gbif_taxon": lambda item: gbif_client.match_taxon(item["name"]),
    }


def _parse_result(
    response_text: str,
    col_taxon_key: str,
    citations: list[str],
    max_output_rules: int,
) -> ResearchResult:
    try:
        parsed = json.loads(response_text)
    except json.JSONDecodeError as error:
        raise RuntimeError("OpenAI returned non-JSON final output.") from error
    if not isinstance(parsed, dict) or not isinstance(parsed.get("drafts", []), list):
        raise RuntimeError("OpenAI final output must contain a drafts array.")

    drafts: list[RuleDraft] = []
    rejected: list[str] = []
    for index, candidate in enumerate(parsed["drafts"][:max_output_rules], start=1):
        try:
            draft = _to_draft(candidate, col_taxon_key)
            drafts.append(draft)
        except (KeyError, TypeError, ValueError) as error:
            rejected.append(f"Draft {index}: {error}")
    return ResearchResult(
        summary=str(parsed.get("summary", "No summary provided.")),
        drafts=drafts,
        citations=list(dict.fromkeys(citations)),
        rejected_drafts=rejected,
    )


def _to_draft(candidate: Any, col_taxon_key: str) -> RuleDraft:
    if not isinstance(candidate, dict):
        raise ValueError("Draft must be a JSON object.")
    annotation = str(candidate["annotation"]).upper()
    if annotation not in ALLOWED_ANNOTATIONS:
        raise ValueError("Annotation must be SUSPICIOUS, INTRODUCED, or VAGRANT.")
    evidence = candidate.get("evidence", [])
    if not isinstance(evidence, list) or not all(isinstance(item, str) for item in evidence):
        raise ValueError("Evidence must be an array of strings.")
    basis_of_record = candidate.get("basisOfRecord")
    basis_of_record_reason = candidate.get("basisOfRecordReason")
    if basis_of_record is not None and (
        not isinstance(basis_of_record, list) or not all(isinstance(item, str) for item in basis_of_record)
    ):
        raise ValueError("basisOfRecord must be an array of strings.")
    if basis_of_record is not None and not isinstance(basis_of_record_reason, str):
        basis_of_record = None
    basis_of_record_negated = candidate.get("basisOfRecordNegated")
    if basis_of_record_negated is not None and not isinstance(basis_of_record_negated, bool):
        raise ValueError("basisOfRecordNegated must be a boolean.")
    ruleset_id = candidate.get("rulesetId")
    project_id = candidate.get("projectId")
    if ruleset_id is not None and not isinstance(ruleset_id, int):
        raise ValueError("rulesetId must be an integer.")
    if project_id is not None and not isinstance(project_id, int):
        raise ValueError("projectId must be an integer.")
    return RuleDraft(
        geometry=_normalize_inverted_world_shell(str(candidate["geometry"])),
        annotation=annotation,
        taxon_key=col_taxon_key,
        dataset_key=_optional_string(candidate, "datasetKey"),
        checklist_key=_optional_string(candidate, "checklistKey"),
        checklist_doi=_optional_string(candidate, "checklistDoi"),
        basis_of_record=basis_of_record,
        basis_of_record_negated=basis_of_record_negated,
        year_range=_optional_string(candidate, "yearRange"),
        ruleset_id=ruleset_id,
        project_id=project_id,
        description=str(candidate.get("description", "")),
        evidence=evidence,
    )


def _optional_string(candidate: dict[str, Any], key: str) -> str | None:
    value = candidate.get(key)
    return str(value) if value is not None else None


def _normalize_inverted_world_shell(geometry: str) -> str:
    """Use the UI's Web Mercator latitude limits for a canonical inverted WKT shell."""
    if not geometry.lstrip().upper().startswith("POLYGON"):
        return geometry
    if not all(coordinate in geometry for coordinate in INVERTED_SHELL_REPLACEMENTS):
        return geometry
    for source, replacement in INVERTED_SHELL_REPLACEMENTS.items():
        geometry = geometry.replace(source, replacement)
    return geometry


def _extract_citations(response: Any) -> list[str]:
    citations: list[str] = []
    for output in getattr(response, "output", []):
        for content in getattr(output, "content", []) or []:
            for annotation in getattr(content, "annotations", []) or []:
                url = getattr(annotation, "url", None)
                if isinstance(url, str):
                    citations.append(url)
    return citations