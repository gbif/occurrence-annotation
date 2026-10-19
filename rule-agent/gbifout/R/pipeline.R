#' Run candidate discovery, occurrence fetching, and record assessment
#'
#' Finds low-occupancy polygons, fetches unique sampled occurrence IDs, and
#' assesses each record sequentially. Sampling occurs after deduplication.
#' This function makes GBIF and paid OpenAI requests, but writes no annotations.
#' Errors stop the analysis rather than returning an incomplete assessment table.
#'
#' @param taxonKey GBIF taxon key to investigate.
#' @param basisOfRecord channels used for both raster discovery and occurrence
#'   fetching. Defaults to the same seven channels as `out_cand()`.
#' @param sampleSize maximum unique records assessed per source polygon
#'   (default 5). Set to `NULL` to assess every unique record. Use `set.seed()`
#'   before calling for reproducible sampling.
#' @param apiKey OpenAI key, defaulting to `OPENAI_API_KEY` in the environment.
#' @param ... additional arguments passed to `out_cand()`.
#' @return A list with `data`, a data.frame with character columns
#'   `gbifid`, `binWkt`, `taxonKey`,
#'   `decision`, `reasonCategory`, `explanation`, and `model`. Assessment fields
#'   come from each record's `finalAssessment`. `sus`, `int`, and `ok` contain
#'   combined MULTIPOLYGON WKT for SUSPICIOUS, INTRODUCED, and OK records,
#'   respectively, or `MULTIPOLYGON EMPTY` when absent. Mixed-decision source
#'   polygons can appear in multiple groups. NEEDS_REVIEW and FORMER are retained
#'   only in data.
#'   `hdp` is the finder's MULTIPOLYGON WKT for high-occupancy cells and
#'   count-filtered low-occupancy cells, passed through unchanged; these
#'   polygons were not fetched or assessed.
#'   `taxonKey` and `sdmPolygons` retain the taxon and individual OK/HDP cells
#'   for `sdm_check()`, including when no records were assessed.
#'   The result has class `gbifout_pipeline`; use `plot()` to map the polygons.
#' @export
pipeline <- function(taxonKey,
                     basisOfRecord = c(
                       "PRESERVED_SPECIMEN", "OBSERVATION", "HUMAN_OBSERVATION",
                       "MACHINE_OBSERVATION", "LITERATURE", "OCCURRENCE", "UNKNOWN"
                     ),
                     sampleSize = 5,
                     apiKey = Sys.getenv("OPENAI_API_KEY"), ...) {
  if (!(is.character(taxonKey) || is.numeric(taxonKey)) ||
      length(taxonKey) != 1 || is.na(taxonKey) ||
      !nzchar(trimws(as.character(taxonKey)))) {
    stop("taxonKey must be a single non-empty taxon key.")
  }
  if (!is.character(apiKey) || length(apiKey) != 1 || is.na(apiKey) || !nzchar(apiKey)) {
    stop("Set OPENAI_API_KEY or provide apiKey.")
  }
  if (!is.null(sampleSize) &&
      (!is.numeric(sampleSize) || length(sampleSize) != 1 || is.na(sampleSize) ||
       !is.finite(sampleSize) || sampleSize < 1 || sampleSize != floor(sampleSize))) {
    stop("sampleSize must be NULL or a positive integer.")
  }

  polygons <- out_cand(
    taxonKey = taxonKey, basisOfRecord = basisOfRecord, ...
  )
  occurrences <- occ_fetch_unique(
    polygons, basisOfRecord = basisOfRecord, sampleSize = sampleSize
  )
  if (!nrow(occurrences)) {
    return(structure(list(data = data.frame(
      gbifid = character(0), binWkt = character(0), taxonKey = character(0),
      decision = character(0), reasonCategory = character(0),
      explanation = character(0), model = character(0)
    ), sus = "MULTIPOLYGON EMPTY", int = "MULTIPOLYGON EMPTY", ok = "MULTIPOLYGON EMPTY",
    hdp = polygons$hdp, taxonKey = as.character(taxonKey),
    sdmPolygons = .pipeline_sdm_polygons(character(), polygons$hdpCells)),
    class = c("gbifout_pipeline", "list")))
  }

  rows <- lapply(seq_len(nrow(occurrences)), function(index) {
    gbifid <- occurrences$gbifid[index]
    assessment <- tryCatch(
      assess_occurrence_record(gbifid, apiKey = apiKey),
      error = function(error) {
        stop("Assessment failed for GBIF ID ", gbifid, ": ",
             conditionMessage(error), call. = FALSE)
      }
    )
    final <- assessment$finalAssessment
    data.frame(
      gbifid = as.character(gbifid),
      binWkt = occurrences$binWkt[index],
      taxonKey = as.character(taxonKey),
      decision = final$decision,
      reasonCategory = final$reasonCategory,
      explanation = final$explanation,
      model = final$model,
      stringsAsFactors = FALSE
    )
  })
  data <- as.data.frame(bind_rows(rows))
  decision_polygon <- function(decision) {
    combined <- combine_outlier_polygons(data$binWkt[data$decision == decision])
    sf::st_as_text(sf::st_cast(sf::st_as_sfc(combined, crs = 4326), "MULTIPOLYGON"))
  }
  structure(list(data = data, sus = decision_polygon("SUSPICIOUS"),
      int = decision_polygon("INTRODUCED"), ok = decision_polygon("OK"),
      hdp = polygons$hdp, taxonKey = as.character(taxonKey),
      sdmPolygons = .pipeline_sdm_polygons(
        data$binWkt[data$decision == "OK"], polygons$hdpCells
      )), class = c("gbifout_pipeline", "list"))
}

.pipeline_sdm_polygons <- function(ok, hdp) {
  ok <- unique(ok)
  hdp <- unique(hdp)
  data.frame(
    group = c(rep("ok", length(ok)), rep("hdp", length(hdp))),
    binWkt = c(ok, hdp), stringsAsFactors = FALSE
  )
}