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

New pipeline results also retain `taxonKey` and `sdmPolygons` (`group`, `binWkt`).
The latter preserves individual OK source cells and HDP cells before merging,
so the SDM can sample each original cell rather than each connected landmass.
Finder results expose these unmerged HDP cells as `hdpCells`.

### Plot Pipeline Decisions

```r
# New pipeline results support S3 plotting:
plot(analysis)

# Older saved lists (including the original DJX8 result) need no regeneration:
pkgload::load_all(".")  # from rule-agent/gbifout
analysis <- readRDS("../output/djx8/djx8-pipeline.rds")
gbifout::plot_pipeline(analysis)

# Reuse a finder's map without a network request:
gbifout::plot_pipeline(analysis, map = candidates$diagnostics$map)

# Optional regional view:
gbifout::plot_pipeline(analysis, xlim = c(-25, 65), ylim = c(-40, 65))
```

The map draws OK polygons in green, INTRODUCED in orange, SUSPICIOUS in red,
and HDP as dashed blue outlines. Translucent fills and distinct outline styles
keep mixed-decision polygons visible; shared cells can belong to multiple groups.
HDP contains unassessed high-occupancy and count-excluded cells, not confirmed OK
records. NEEDS_REVIEW and FORMER remain in the data and subtitle counts but have
no separate polygon layer.

The backdrop is GBIF occurrence coverage fetched via `map_fetch()` across all
basis-of-record channels, displayed in grey over the ocean basemap. It is not
an SDM prediction. Supply a single-layer EPSG:4326 `terra::SpatRaster` with `map`
to avoid network access. Plotting does not rerun discovery or assessments.
New results keep the plotting class when saved and reloaded with RDS.

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

## Climate SDM Double-Check

`sdm_check()` is an optional, separate step: it accepts saved pipeline results
without repeating discovery or paid AI assessments, and never changes decisions
or writes annotations. Install the optional dependencies once:

```r
install.packages(c("maxnet", "geodata"))
```

From the `rule-agent/gbifout` working directory:

```r
pkgload::load_all(".")
analysis <- readRDS("../output/djx8/djx8-pipeline.rds")
sdm <- gbifout::sdm_check(
  analysis,
  cacheDir = "../output/climate",
  outputDir = "../output/djx8/sdm"
)
sdm$data
sdm$data[!is.na(sdm$data$reviewFlag), ]

# Later: no downloads, occurrence searches, or model refitting.
sdm <- readRDS("../output/djx8/sdm/sdm-check.rds")
```

The default model is regularized MaxEnt (`maxnet`) with linear and quadratic
features. Predictors are WorldClim 2.1 BIO1 (annual mean temperature), BIO4
(temperature seasonality), BIO12 (annual precipitation), and BIO15
(precipitation seasonality), at 10 arc-minute resolution. WorldClim distributes
the bioclim variables together: the first call downloads/caches all 19 layers
via `geodata`, but only these four are used. Keep `cacheDir` to reuse downloads.
Alternatively supply `climate`, an EPSG:4326 `terra::SpatRaster` containing
layers named `bio1`, `bio4`, `bio12`, and `bio15`.

Training requests the **first 10 georeferenced, present occurrences per OK/HDP
cell** in a single GBIF search, with no additional pages or deduplication.
Duplicates, shared climate cells, and records already in the pipeline are retained.
Missing/invalid coordinates are removed without fetching replacements.
This is API-order selection, not a random or independent validation sample.
HDP membership and OK-cell membership are assumptions about training quality,
not individual validation; mixed-decision cells may supply non-OK records.
The default seven basis-of-record channels are used; pass `basisOfRecord`
explicitly if the pipeline used a different filter.

New pipeline runs retain original sampling cells. Older saved results (including
the original DJX8 run) remain usable but issue an explicit warning and sample
connected polygons from their merged OK/HDP geometries; original HDP cells cannot
be recovered from that file. For original-cell sampling, use a new pipeline
result or supply a `result$sdmPolygons` data.frame with `group` (`ok`/`hdp`) and
individual `binWkt` values. Large occurrence counts do not prevent fetching the
first page. Sparse/empty cells warn and contribute fewer records.
`sampleSize` defaults to 10 and is capped at 299 to avoid `rgbif`'s internal
auto-pagination. No paging metadata is used to fetch further records.

Training records lacking climate are removed, without deduplication or thinning;
at least **20 distinct climate cells** and two varying
predictors are required. Thus the final training count can be below 10 per source
cell. Constant predictors are dropped with a warning. The background is up to
10,000 distinct finite-climate land cells within 500 km of training points,
excluding presence cells, sampled with cell-area weights. Zero-area line remnants
from spatial buffer unions are excluded before converting the accessible area
to polygons. `bufferKm`,
`backgroundSize`, `sampleSize`, and `seed` are configurable; sampling preserves
the caller's random-number state (the seed controls background selection only).
This accessible-area approximation should be
reviewed for each species. Climate coverage supplies the land mask, so unsuitable
marine or missing-climate records cannot be evaluated with this terrestrial SDM.

The returned list includes the serializable `model`, sampled `training` and
`background` data with climate values, per-polygon `sampledCount`/`trainingCount`,
thresholds, settings, and the original assessment rows with:

- `suitability`: relative cloglog suitability, **not an occurrence probability**.
- `reviewFlag`: `low_suitability_OK` below the training-score 10th percentile,
  or `high_suitability_SUSPICIOUS` at/above the 90th percentile; otherwise `NA`.
- `sdmStatus`: `scored`, `missing_coordinates`, or `missing_climate`.
- `inTrainingCell`: whether the record shares a climate cell with training data.
- `extrapolated`: whether any predictor is outside its training range.
  Predictions are clamped to the model's training ranges.

These flags are **review prompts only**, not corrected labels or independent
model validation. Thresholds are in-sample descriptive heuristics; climate-cell
overlap, spatial sampling bias, missing biotic/habitat factors, and extrapolation
limit their interpretation. No AUC or accuracy claim is made. `INTRODUCED`,
`FORMER`, and `NEEDS_REVIEW` rows receive scores where climate is available but
do not automatically receive disagreement flags.

When `outputDir` is supplied, `sdm-check.rds` saves the complete model/result and
`sdm-scores.csv` saves the review table. These files are overwritten by an
explicit new run; use `readRDS()` to reuse an existing fit. No live raster
pointers or API credentials are stored in the RDS.

### Plot SDM Results

```r
plot(sdm)  # new results: GBIF map backdrop and assessed record scores

# Also works with older saved SDM lists, without refitting:
gbifout::plot_sdm(sdm)

# Reuse a map already fetched by out_cand(), avoiding map network requests:
gbifout::plot_sdm(sdm, map = candidates$diagnostics$map)

# Save a figure:
png("../output/djx8/sdm/sdm-map.png", width = 1400, height = 800, res = 120)
gbifout::plot_sdm(sdm)
dev.off()
```

Points are coloured from purple (suitability 0) to yellow (1). Red rings mark
records with a `reviewFlag`; grey crosses mark georeferenced but unscored records.
Missing/invalid coordinates are omitted with a warning. The legend and subtitle
report what was plotted. This is a map of **record scores**, not a continuous
predicted suitability surface.

The default backdrop is fetched via `rgbif::map_fetch()` using all basis-of-record
channels and shown as muted grey occurrence coverage over the ocean basemap.
It is not a prediction from the SDM and may differ from the training filters.
Pass a single-layer EPSG:4326 `terra::SpatRaster` through `map` to reuse an existing
GBIF map. Plotting never downloads climate layers, refits models, or looks up
occurrence records. Optional `xlim` and `ylim` arguments zoom to a region.

## Tests

```r
devtools::test("gbifout")
```