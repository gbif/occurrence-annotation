# GBIF Outlier Tools

The supported implementation in this directory is the `gbifout` R package. It builds pixel-occupancy grids, selects sparse candidate polygons, returns occurrence and dataset metadata, combines polygon WKT, and provides cheap-model occurrence triage with optional advanced review.

## Development Setup

Use R 4.1 or newer. From this directory, load the package during development:

```r
devtools::load_all("gbifout")
```

Set `OPENAI_API_KEY` in the R process environment before using model-assisted triage. The triage function uses `gpt-4.1-mini` first and escalates `NEEDS_REVIEW` results to the higher-reasoning model. It does not write annotations or modify GBIF records.

## Find Candidate Polygons

```r
result <- gbifout::find_outlier_candidates("3NFRS")
result$candidates
result$datasets
result$mp
```

Candidate cells are based on logical pixel occupancy, not raster color intensity. The default basis-of-record set excludes `MATERIAL_CITATION`, `LIVING_SPECIMEN`, `MATERIAL_SAMPLE`, and `FOSSIL_SPECIMEN`. Cells with at most three filled pixels are retained regardless of the occupancy quantile. Polygon metadata includes occurrence counts, dataset counts, and exact filled-pixel counts.

## Triage One Occurrence

```r
assessment <- gbifout::assess_occurrence_record(6497435304)
assessment$initialAssessment
assessment$advancedAssessment
assessment$finalAssessment
```

The result distinguishes `SUSPICIOUS`, `INTRODUCED`, `OK`, and `NEEDS_REVIEW`. Country-centroid distance is supporting context only; it is not used as standalone evidence.

Both models first recall the focal taxon's native range from pretrained knowledge and compare it with the record coordinates and locality, allowing for coordinate uncertainty. Clear, distant native-range mismatches are marked `SUSPICIOUS` with `unlikely_location_for_taxon`; supported free-ranging introduced populations remain `INTRODUCED`. Uncertain taxonomy or range knowledge is routed to `NEEDS_REVIEW`. Range claims are model-recalled, not checked against external sources, so assessments remain review-only.

## Tests

```r
devtools::test("gbifout")
```