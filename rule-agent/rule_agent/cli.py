"""Command-line entry point for review-only GBIF rule drafting."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from openai import OpenAI

from .agent import research_taxon
from .col_client import AmbiguousTaxonError, resolve_taxon
from .output import write_drafts


def main() -> int:
    """Run the rule-drafting command without any annotation-service write path."""
    parser = _parser()
    arguments = parser.parse_args()
    _load_dotenv(Path(arguments.env_file))
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        parser.error("OPENAI_API_KEY is required. Set it in the environment or rule-agent/.env.")

    try:
        taxon = resolve_taxon(arguments.taxon)
    except AmbiguousTaxonError as error:
        print(error)
        return 2
    except ValueError as error:
        print(f"Unable to resolve taxon: {error}")
        return 2

    result = research_taxon(
        OpenAI(api_key=api_key),
        taxon,
        max_tool_rounds=arguments.max_tool_rounds,
        max_output_rules=arguments.max_output_rules,
    )
    output_paths = write_drafts(result, Path(arguments.output_dir))
    print(result.summary)
    for output_path in output_paths:
        print(f"Draft JSON: {output_path}")
    for rejection in result.rejected_drafts:
        print(f"Rejected: {rejection}")
    if not output_paths:
        print("No valid drafts were written. Insufficient evidence is a valid outcome.")
    return 0


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="rule-agent",
        description="Research a COL taxon and write review-only GBIF annotation rule drafts.",
    )
    subcommands = parser.add_subparsers(dest="command", required=True)
    create = subcommands.add_parser("create", help="Research a taxon and write draft rule JSON files.")
    create.add_argument("taxon", help="Scientific name or unambiguous Catalogue of Life taxon key.")
    create.add_argument("--max-tool-rounds", type=int, default=6)
    create.add_argument("--max-output-rules", type=int, default=5)
    create.add_argument("--output-dir", default="output")
    create.add_argument("--env-file", default=".env")
    return parser


def _load_dotenv(path: Path) -> None:
    """Load simple KEY=VALUE entries without overriding actual environment variables."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", maxsplit=1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


if __name__ == "__main__":
    raise SystemExit(main())