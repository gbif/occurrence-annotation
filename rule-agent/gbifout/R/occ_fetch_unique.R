#' Fetch unique occurrence IDs from candidate polygons
#'
#' Searches only `result$candidates$binWkt`, never `mp` or `hdp`. All pages
#' are fetched before keeping the first occurrence per exact combination of
#' basisOfRecord, decimalLatitude, decimalLongitude, and datasetKey. Repeats
#' across polygons retain the first ID and its first source polygon in input
#' order. Missing grouping values follow R's `duplicated()` equality rules.
#' Sampling is applied after deduplication, not to API pages. Use `set.seed()`
#' before calling for reproducible random samples.
#'
#' @param result the list returned by `find_outlier_candidates()`, including
#'   `taxonKey` and `candidates$binWkt`.
#' @param basisOfRecord channels included in occurrence searches. Defaults to
#'   the same seven channels as `find_outlier_candidates()`. Set to `NULL` to
#'   search all channels.
#' @param sampleSize maximum unique records returned per source polygon
#'   (default 5). Polygons with fewer records return all of them. Set to `NULL`
#'   to return every unique record. All pages are still fetched before sampling.
#' @return A data.frame with character columns `gbifid` and `binWkt`.
#' @export
occ_fetch_unique <- function(result,
                             basisOfRecord = c(
                               "PRESERVED_SPECIMEN",
                               "OBSERVATION",
                               "HUMAN_OBSERVATION",
                               "MACHINE_OBSERVATION",
                               "LITERATURE",
                               "OCCURRENCE",
                               "UNKNOWN"
                             ), sampleSize = 5) {
  if (!is.null(sampleSize) &&
      (!is.numeric(sampleSize) || length(sampleSize) != 1 || is.na(sampleSize) ||
       !is.finite(sampleSize) || sampleSize < 1 || sampleSize != floor(sampleSize))) {
    stop("sampleSize must be NULL or a positive integer.")
  }
  if (!is.list(result) || !is.data.frame(result$candidates) ||
      !"binWkt" %in% names(result$candidates)) {
    stop("result must be a finder result with candidates$binWkt.")
  }
  taxonKey <- result$taxonKey
  if (!(is.character(taxonKey) || is.numeric(taxonKey)) ||
      length(taxonKey) != 1 || is.na(taxonKey) ||
      !nzchar(trimws(as.character(taxonKey)))) {
    stop("taxonKey must be a single non-empty taxon key.")
  }
  basis_filter <- NULL
  if (!is.null(basisOfRecord)) {
    if (!is.character(basisOfRecord) || !length(basisOfRecord) || anyNA(basisOfRecord)) {
      stop("basisOfRecord must be NULL or a non-empty character vector of channels.")
    }
    basisOfRecord <- unique(trimws(basisOfRecord))
    if (any(!nzchar(basisOfRecord)) || any(grepl(";", basisOfRecord, fixed = TRUE))) {
      stop("basisOfRecord values must be non-empty individual channels.")
    }
    basis_filter <- paste(basisOfRecord, collapse = ";")
  }
  wkts <- result$candidates$binWkt
  if (!is.character(wkts) || anyNA(wkts) || any(!nzchar(trimws(wkts)))) {
    stop("candidates$binWkt must contain non-empty polygon WKT strings.")
  }
  empty <- data.frame(gbifid = character(0), binWkt = character(0))
  if (!length(wkts)) return(empty)

  wkts <- unique(wkts)
  geometries <- sf::st_as_sfc(wkts, crs = 4326)
  if (any(!as.character(sf::st_geometry_type(geometries)) %in%
          c("POLYGON", "MULTIPOLYGON"))) {
    stop("Candidate geometries must be POLYGON or MULTIPOLYGON WKT.")
  }
  wkts <- wkts[!sf::st_is_empty(geometries)]
  if (!length(wkts)) return(empty)

  groups <- c("basisOfRecord", "decimalLatitude", "decimalLongitude", "datasetKey")
  pages <- list()
  for (polygon_index in seq_along(wkts)) {
    start <- 0
    repeat {
      response <- tryCatch(
        occ_search(
          taxonKey = taxonKey,
          geometry = wkts[polygon_index],
          basisOfRecord = basis_filter,
          occurrenceStatus = "PRESENT",
          limit = 300,
          start = start
        ),
        error = function(error) {
          stop("Occurrence search failed for candidate polygon ", polygon_index,
               " at start ", start, ": ", conditionMessage(error), call. = FALSE)
        }
      )
      meta <- response$meta
      if (!is.list(meta) || !is.logical(meta$endOfRecords) ||
          length(meta$endOfRecords) != 1 || is.na(meta$endOfRecords) ||
          !is.numeric(meta$count) || length(meta$count) != 1 ||
          !is.finite(meta$count) || meta$count < 0 ||
          !identical(as.numeric(meta$offset), as.numeric(start))) {
        stop("Invalid paging metadata for candidate polygon ", polygon_index,
             " at start ", start, ".")
      }
      data <- response$data
      page_size <- if (is.null(data) && meta$count == 0) 0 else {
        if (!is.data.frame(data)) {
          stop("Invalid occurrence data for candidate polygon ", polygon_index, ".")
        }
        nrow(data)
      }
      if (page_size > 0) {
        missing <- setdiff(c("key", groups), names(data))
        if (length(missing)) {
          stop("Occurrence data for candidate polygon ", polygon_index,
               " is missing: ", paste(missing, collapse = ", "), ".")
        }
        data$key <- as.character(data$key)
        if (anyNA(data$key) || any(!nzchar(data$key))) {
          stop("Occurrence data contains missing GBIF IDs.")
        }
        data$binWkt <- wkts[polygon_index]
        pages[[length(pages) + 1]] <- data[, c("key", groups, "binWkt"), drop = FALSE]
      }
      next_start <- start + page_size
      if (meta$endOfRecords) {
        if (next_start < meta$count) {
          stop("Occurrence search ended before all records were returned for candidate polygon ",
               polygon_index, ".")
        }
        break
      }
      if (page_size == 0) {
        stop("Occurrence search returned an empty page before completion for candidate polygon ",
             polygon_index, ".")
      }
      if (next_start >= 100000) {
        stop("Occurrence search window exceeded for candidate polygon ", polygon_index,
             "; use the GBIF download API instead.")
      }
      start <- next_start
    }
  }
  if (!length(pages)) return(empty)
  occurrences <- bind_rows(pages)
  occurrences <- occurrences[!duplicated(occurrences$key), , drop = FALSE]
  occurrences <- occurrences[!duplicated(occurrences[groups]), , drop = FALSE]
  if (!is.null(sampleSize)) {
    selected_rows <- unlist(lapply(wkts, function(wkt) {
      indices <- which(occurrences$binWkt == wkt)
      if (length(indices) > sampleSize) {
        indices <- sort(indices[sample.int(length(indices), size = sampleSize)])
      }
      indices
    }), use.names = FALSE)
    occurrences <- occurrences[selected_rows, , drop = FALSE]
  }
  result <- occurrences[, c("key", "binWkt"), drop = FALSE]
  names(result)[1] <- "gbifid"
  as.data.frame(result, row.names = NULL)
}