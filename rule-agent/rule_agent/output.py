"""Review artifact output; this module never sends HTTP requests."""

from __future__ import annotations

import json
from pathlib import Path

from .agent import ResearchResult


def write_drafts(result: ResearchResult, output_directory: Path) -> list[Path]:
    """Write one POST-ready JSON and companion evidence note per valid draft."""
    output_directory.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for index, draft in enumerate(result.drafts, start=1):
        stem = f"rule-{index:03d}"
        json_path = output_directory / f"{stem}.json"
        note_path = output_directory / f"{stem}.md"
        json_path.write_text(json.dumps(draft.to_post_payload(), indent=2) + "\n", encoding="utf-8")
        evidence = "\n".join(f"- {item}" for item in [*draft.evidence, *result.citations]) or "- None"
        note_path.write_text(
            f"# {stem}\n\n{draft.description}\n\n## Investigation Summary\n\n{result.summary}\n"
            f"\n## Evidence\n\n{evidence}\n",
            encoding="utf-8",
        )
        written.append(json_path)
    return written