#' Deduplicate GBIF occurrence records
#'
#' Collapses records that share taxonKey, datasetKey, basisOfRecord,
#' decimalLatitude and decimalLongitude down to a single representative row,
#' keeping the first "key" (gbifid) seen for each duplicate group.
#'
#' @param occurrences data.frame/tibble as returned by `rgbif::occ_search()$data`.
#'   Must contain columns key, taxonKey, datasetKey, basisOfRecord,
#'   decimalLatitude, decimalLongitude.
#'
#' @return occurrences filtered to one row per unique combination of
#'   taxonKey, datasetKey, basisOfRecord, decimalLatitude and decimalLongitude.
dedup_occurrences <- function(occurrences) {
  dedup_cols <- c("taxonKey", "datasetKey", "basisOfRecord",
                   "decimalLatitude", "decimalLongitude")
  required_cols <- c("key", dedup_cols)
  missing_cols <- setdiff(required_cols, names(occurrences))
  if (length(missing_cols) > 0) {
    stop("occurrences is missing required column(s): ", paste(missing_cols, collapse = ", "))
  }

  occurrences[!duplicated(occurrences[dedup_cols]), ]
}
