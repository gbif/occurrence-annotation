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
result <- gbifout::out_cand("3NFRS")
result$candidates
result$datasets
result$mp
```

Candidate cells are based on logical pixel occupancy, not raster color intensity. The default basis-of-record set excludes `MATERIAL_CITATION`, `LIVING_SPECIMEN`, `MATERIAL_SAMPLE`, and `FOSSIL_SPECIMEN`. Cells with at most three filled pixels are retained regardless of the occupancy quantile. Polygon metadata includes occurrence counts, dataset counts, and exact filled-pixel counts.

```r
result                      # summary: CV vs flatCvThreshold, effective quantile, cutoff
plot(result)                # map with mp/hdp overlay, plus occupancy and filled-pixel histograms
plot(result, which = "map") # just the fetched map with the outlier multipolygon
plot(result, which = "occupancy")
print(result, plot = TRUE)  # summary plus plots
```

The map panel draws the fetched GBIF map (from `map_fetch()`) over an ocean backdrop, with the outlier MULTIPOLYGON (`mp`) filled in red and high-occupancy polygons (`hdp`) outlined in blue. The histograms highlight cells selected as low occupancy (before the occurrence-count filter) and mark the quantile cutoff and `maxFilledPixels`; the occupancy subtitle compares the observed CV with `flatCvThreshold`. The raw values and the fetched map raster are in `result$diagnostics`. When `outputDir` is supplied, the plots are also saved as `<taxonKey>-diagnostics.png`.

## Fetch Unique Occurrence IDs

```r
occurrences <- result |> gbifout::occ_fetch_unique()
occurrences$gbifid
occurrences$binWkt
```

Or run both steps together: `gbifout::out_cand("3NFRS") |> gbifout::occ_fetch_unique()`. The fetcher takes only the finder result and an optional `basisOfRecord` filter; it always uses `result$taxonKey`.

Only `result$candidates$binWkt` is queried, never `mp` or `hdp`. Searches retrieve all pages of present occurrences using the same default seven basis-of-record channels as `out_cand()`. Supply `basisOfRecord` to override the channels, or `NULL` to search all channels; overrides made when finding polygons are not automatically inherited. Deduplication uses exactly `basisOfRecord`, `decimalLatitude`, `decimalLongitude`, and `datasetKey` across all polygons. The returned data frame contains one representative `gbifid` and its first source-search `binWkt`; coordinate values are not rounded. Search errors stop the function instead of returning partial results.

## Triage One Occurrence

```r
assessment <- gbifout::assess_occurrence_record(6497435304)
assessment$initialAssessment
assessment$advancedAssessment
assessment$finalAssessment
```

The result distinguishes `SUSPICIOUS`, `INTRODUCED`, `OK`, `FORMER`, and `NEEDS_REVIEW`. `FORMER` marks fossil or subfossil records, including those whose `basisOfRecord` says `PRESERVED_SPECIMEN`; they get reason `fossil_or_subfossil` and are never flagged `SUSPICIOUS` or `OK`. A `coordinateUncertaintyInMeters` of 500,000 (500 km) or more is `SUSPICIOUS` with reason `high_coordinate_uncertainty`, regardless of native range; this is checked after the fossil check, and `country_centroid_anomaly` is used instead when its own conditions are met. Country-centroid distance is supporting context only; it is not used as standalone evidence.

Both models first recall the focal taxon's native range from pretrained knowledge and compare it with the record coordinates and locality, allowing for coordinate uncertainty. Clear, distant native-range mismatches are marked `SUSPICIOUS` with `unlikely_location_for_taxon`; supported free-ranging introduced populations remain `INTRODUCED`. Uncertain taxonomy or range knowledge is routed to `NEEDS_REVIEW`. Range claims are model-recalled, not checked against external sources, so assessments remain review-only.

## End-To-End Analysis

```r
analysis <- gbifout::pipeline("3NFRS")
analysis <- gbifout::pipeline("3NFRS", sampleSize = 3, maxOccurrenceCount = 10)
```

`pipeline()` runs candidate discovery, unique occurrence fetching, and sequential record assessment. It uses the same basis-of-record selection for discovery and fetching, and samples up to five unique records per polygon by default, after deduplication. Set `sampleSize = NULL` to assess all unique records or use `set.seed()` for reproducible samples. Additional finder options are passed through `...`.

The returned list contains `data`, the assessment data.frame with `gbifid`, source polygon `binWkt`, `taxonKey`, and the final assessment's `decision`, `reasonCategory`, `explanation`, and `model`. It also contains combined MULTIPOLYGON WKT strings: `sus` for SUSPICIOUS, `int` for INTRODUCED, and `ok` for OK. Polygons with mixed record decisions can appear in multiple groups; NEEDS_REVIEW and FORMER records remain in `data` only. Missing groups return `MULTIPOLYGON EMPTY`, and no fetched records means an empty `data` table. The pipeline requires `OPENAI_API_KEY`, makes paid OpenAI requests, and stops on errors rather than silently returning partial assessments.

```r
analysis$data
analysis$sus
analysis$int
analysis$ok
analysis$hdp
```

`hdp` passes through the finder's MULTIPOLYGON WKT unchanged, retaining both high-occupancy cells and low-occupancy cells excluded by the occurrence-count filter (including failed counts). These polygons were not fetched or assessed, and remain available even when `data` is empty. The occurrence-count filter applies only to low-occupancy candidates.

```r
boxes <- gbifout::suspicious_boxes(analysis, halfWidth = 0.01)
boxes$data
boxes$mp
```

`suspicious_boxes()` looks up each SUSPICIOUS GBIF ID and adds `decimalLatitude`, `decimalLongitude`, `datasetKey`, `basisOfRecord`, and `bboxWkt`, a square box of `halfWidth` degrees around the point. `mp` combines all boxes into one MULTIPOLYGON WKT. Records without coordinates keep `bboxWkt = NA` and are left out of `mp`.

```r
ok <- gbifout::ok_buffer(analysis, bufferKm = 500)
ok$combined
ok$buffered
```

`ok_buffer()` merges `analysis$ok` and `analysis$hdp`, dissolves overlaps into `combined`, and returns `buffered`, that geometry buffered by `bufferKm` (default 500) using geodesic distance, then simplified by removing every other vertex from each ring `simplifyRounds` times (default 4, each round roughly halving the vertices; 0 skips it). `combined` is not simplified. `inverted` is the world rectangle (`-180 -85.0511287798` to `180 85.0511287798`) with `buffered` cut out as holes, as a POLYGON or MULTIPOLYGON WKT (counter-clockwise outer ring, clockwise holes); buffers crossing the antimeridian are split there and buffers past the map extent are clipped. `combined` and `buffered` are MULTIPOLYGON WKT; all three are `MULTIPOLYGON EMPTY` when both inputs are empty.

## Tests

```r
devtools::test("gbifout")
```