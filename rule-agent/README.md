# GBIF Rule Agent

`rule-agent` researches a scientific name or Catalogue of Life (COL) taxon key and writes conservative, review-only geographic rule drafts for the GBIF occurrence annotation service. It does not authenticate to, call, or create rules through the annotation API.

## Setup

Use Python 3.11 or newer:

```powershell
cd rule-agent
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Copy-Item .env.template .env
```

Set `OPENAI_API_KEY` in `.env`, or set it in the environment. The agent uses the fixed `gpt-5.6-terra` model with high reasoning effort.

## Use

```powershell
rule-agent create "Calopteryx splendens"
rule-agent create CQ4M --output-dir output --max-tool-rounds 6
```

Name resolution uses the Catalogue of Life. If a name matches multiple accepted concepts, the command stops and prints candidates; rerun it with the chosen COL key.

The agent uses a-priori sources for initial geometry: OpenAI web search of authoritative range literature, taxonomic treatments, conservation assessments, biogeographic barriers, and country/island context. It can use GBIF taxon matching only; it does not offer GBIF occurrence searches, occurrence details, or occurrence fragments to the model. It does not use missing GBIF records as proof of absence, and it flags unexplained outliers for later record-level investigation rather than silently expanding a range.

## Output

Each valid candidate produces `output/rule-###.json`, a request body ready for later review and submission to `POST /occurrence/experimental/annotation/rule`. A paired `rule-###.md` records the concise rationale and evidence. The tool writes no database data.

Generated geometry is currently written without local WKT validation so it can be reviewed during development. Review every geometry before submitting it to the annotation service. Inverted rules use a world-shell polygon with plausible-range holes, matching the existing UI and R package convention.

The agent produces `SUSPICIOUS` rules by default. `INTRODUCED` and `VAGRANT` are reserved for directly supported evidence; captive organisms, zoos, and botanical-garden records remain `SUSPICIOUS`.

## Development

```powershell
cd rule-agent
py -3 -m pytest
py -3 -m ruff check .
```