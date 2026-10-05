#' Count occurrences by a GBIF facet
#'
#' @param taxonKey GBIF taxon key.
#' @param basisOfRecord optional `;`-delimited basis-of-record filter.
#' @param facet GBIF facet name.
#' @param facetLimit maximum number of facet values to request.
#'
#' @return A data frame returned by `rgbif::occ_count()`.
facet_occurrence_counts <- function(taxonKey, basisOfRecord = NULL,
                                     facet, facetLimit = 300) {
  rgbif::occ_count(
    taxonKey = taxonKey,
    basisOfRecord = basisOfRecord,
    facet = facet,
    facetLimit = facetLimit
  )
}

#' Select low-count GBIF facet values as outlier candidates
#'
#' @param counts data frame returned by `facet_occurrence_counts()`.
#' @param lowQuantile lower fraction of facet values to retain (default 0.05).
#' @param maxCount optional absolute count cutoff.
#'
#' @return The selected facet rows with an added `outlier` column.
find_facet_outliers <- function(counts, lowQuantile = 0.05, maxCount = NULL) {
  count_names <- intersect(c("count", "count_", "n", "occurrenceCount"), names(counts))
  if (length(count_names) == 0) {
    stop("Facet results must contain a count column.")
  }
  count_column <- count_names[[1]]
  values <- as.numeric(counts[[count_column]])
  if (!is.null(maxCount)) {
    cutoff <- maxCount
  } else {
    if (!is.numeric(lowQuantile) || length(lowQuantile) != 1 ||
        lowQuantile <= 0 || lowQuantile > 1) {
      stop("lowQuantile must be greater than 0 and at most 1.")
    }
    cutoff <- unname(stats::quantile(values, lowQuantile, na.rm = TRUE))
  }
  selected <- counts[!is.na(values) & values <= cutoff, , drop = FALSE]
  selected$outlier <- TRUE
  attr(selected, "count_column") <- count_column
  attr(selected, "cutoff") <- cutoff
  selected
}

facet_search_parameter <- function(facet) {
  c(
    gadmLevel1Gid = "gadmGid",
    continent = "continent",
    country = "country",
    decimalLatitude = "decimalLatitude",
    decimalLongitude = "decimalLongitude",
    distanceFromCentroidInMeters = "distanceFromCentroidInMeters"
  )[[facet]] %||% facet
}

facet_value_column <- function(counts, facet) {
  candidates <- unique(c(facet, "name", "value", "key"))
  found <- candidates[candidates %in% names(counts)]
  if (length(found) == 0) {
    stop("Facet results do not contain a value column for facet ", facet, ".")
  }
  found[[1]]
}

buffered_point_wkt <- function(longitude, latitude, radiusKm = 25) {
  if (is.na(longitude) || is.na(latitude)) return(NA_character_)
  point <- sf::st_sfc(sf::st_point(c(longitude, latitude)), crs = 4326)
  local_point <- sf::st_transform(point, 3857)
  buffer <- sf::st_buffer(local_point, dist = radiusKm * 1000)
  sf::st_as_text(sf::st_transform(buffer, 4326))[[1]]
}

#' Search GBIF records for selected low-count facet values
#'
#' @param taxonKey GBIF taxon key.
#' @param basisOfRecord optional `;`-delimited basis-of-record filter.
#' @param facet GBIF facet and corresponding occurrence-search parameter.
#' @param lowQuantile lower fraction of facet values to search.
#' @param maxCount optional absolute facet count cutoff.
#' @param facetLimit maximum facet values to request.
#' @param limit maximum records returned per facet value.
#' @param pointBufferKm optional point-buffer radius added as `gadmWkt` to
#'   GADM record candidates (default 25 km).
#' @param maxDeduplicatedRecords optional maximum number of deduplicated
#'   records allowed for each facet value.
#'
#' @return A deduplicated data frame containing GBIF records, `key`, and the
#'   selected facet value and count.
find_facet_outlier_records <- function(taxonKey, basisOfRecord = NULL, facet,
                                       lowQuantile = 0.05, maxCount = NULL,
                                       facetLimit = 300, limit = 300,
                                       pointBufferKm = NULL,
                                       maxDeduplicatedRecords = NULL,
                                       includeCountAtMost = NULL) {
  counts <- facet_occurrence_counts(taxonKey, basisOfRecord, facet, facetLimit)
  selected <- find_facet_outliers(counts, lowQuantile, maxCount)
  if (!is.null(includeCountAtMost)) {
    count_column <- attr(selected, "count_column")
    count_values <- as.numeric(counts[[count_column]])
    admitted <- counts[!is.na(count_values) & count_values <= includeCountAtMost, , drop = FALSE]
    selected <- dplyr::bind_rows(selected, admitted)
    selected <- selected[!duplicated(as.character(selected[[facet_value_column(selected, facet)]])), , drop = FALSE]
    attr(selected, "count_column") <- count_column
  }
  if (nrow(selected) == 0) return(data.frame())

  value_column <- facet_value_column(selected, facet)
  search_parameter <- facet_search_parameter(facet)
  records <- lapply(seq_len(nrow(selected)), function(i) {
    query <- list(
      taxonKey = taxonKey,
      basisOfRecord = basisOfRecord,
      limit = limit
    )
    query[[search_parameter]] <- selected[[value_column]][i]
    data <- tryCatch(do.call(rgbif::occ_search, query)$data,
                     error = function(e) NULL)
    if (is.null(data) || nrow(data) == 0) return(NULL)
    data$facet <- facet
    data$facetValue <- as.character(selected[[value_column]][i])
    count_column <- attr(selected, "count_column")
    data$facetCount <- as.numeric(selected[[count_column]][[i]])
    if (!is.null(pointBufferKm)) {
      data$gadmWkt <- vapply(
        seq_len(nrow(data)),
        function(row) buffered_point_wkt(
          data$decimalLongitude[[row]], data$decimalLatitude[[row]], pointBufferKm
        ),
        character(1)
      )
    }
    deduped_region <- dedup_occurrences(data)
    if (!is.null(maxDeduplicatedRecords) && nrow(deduped_region) > maxDeduplicatedRecords) {
      return(NULL)
    }
    deduped_region$facetDeduplicatedCount <- nrow(deduped_region)
    deduped_region
  })
  records <- records[!vapply(records, is.null, logical(1))]
  if (length(records) == 0) return(data.frame())
  dedup_occurrences(dplyr::bind_rows(records))
}

#' Find distributional coordinate outlier values
#'
#' Combines low-count coordinate facets with values outside Tukey's IQR fence.
#' This catches geographically isolated latitude/longitude values even when
#' their facet counts are not the smallest.
#'
#' @param counts data frame returned by `facet_occurrence_counts()`.
#' @param facet either `decimalLatitude` or `decimalLongitude`.
#' @param lowQuantile lower-count fraction to retain (default 0.05).
#' @param iqrMultiplier IQR fence multiplier (default 1.5).
#'
#' @return Selected facet rows with `outlierReason` metadata.
find_coordinate_outlier_values <- function(counts, facet,
                                           lowQuantile = 0.05,
                                           iqrMultiplier = 1.5) {
  if (!facet %in% c("decimalLatitude", "decimalLongitude")) {
    stop("facet must be decimalLatitude or decimalLongitude.")
  }
  value_column <- facet_value_column(counts, facet)
  coordinates <- suppressWarnings(as.numeric(as.character(counts[[value_column]])))
  if (all(is.na(coordinates))) stop("Coordinate facet has no numeric values.")

  low_count <- find_facet_outliers(counts, lowQuantile = lowQuantile)
  q <- stats::quantile(coordinates, c(0.25, 0.75), na.rm = TRUE)
  iqr <- q[[2]] - q[[1]]
  fence <- coordinates < q[[1]] - iqrMultiplier * iqr |
    coordinates > q[[2]] + iqrMultiplier * iqr
  distributional <- counts[!is.na(coordinates) & fence, , drop = FALSE]
  distributional$outlier <- TRUE
  distributional$outlierReason <- "coordinate_iqr"

  low_count$outlierReason <- "low_facet_count"
  selected <- rbind(low_count, distributional)
  values_text <- as.character(selected[[value_column]])
  reasons <- tapply(selected$outlierReason, values_text,
                    function(x) paste(unique(x), collapse = ";"))
  selected <- selected[!duplicated(values_text), , drop = FALSE]
  selected$outlierReason <- unname(reasons[as.character(selected[[value_column]])])
  attr(selected, "count_column") <- attr(low_count, "count_column")
  selected
}

#' Search GBIF records for latitude/longitude distributional outliers
#'
#' @param taxonKey GBIF taxon key.
#' @param basisOfRecord optional `;`-delimited basis-of-record filter.
#' @param facet either `decimalLatitude` or `decimalLongitude`.
#' @param lowQuantile lower-count fraction to retain (default 0.05).
#' @param iqrMultiplier IQR fence multiplier (default 1.5).
#' @param facetLimit maximum facet values to request.
#' @param limit maximum records returned per coordinate value.
#'
#' @return Deduplicated GBIF records with coordinate-outlier metadata.
find_coordinate_outlier_records <- function(taxonKey, basisOfRecord = NULL,
                                             facet, lowQuantile = 0.05,
                                             iqrMultiplier = 1.5,
                                             facetLimit = 300, limit = 300) {
  counts <- facet_occurrence_counts(taxonKey, basisOfRecord, facet, facetLimit)
  selected <- find_coordinate_outlier_values(counts, facet, lowQuantile, iqrMultiplier)
  value_column <- facet_value_column(selected, facet)
  search_parameter <- facet_search_parameter(facet)
  records <- lapply(seq_len(nrow(selected)), function(i) {
    query <- list(taxonKey = taxonKey, basisOfRecord = basisOfRecord, limit = limit)
    query[[search_parameter]] <- selected[[value_column]][i]
    data <- tryCatch(do.call(rgbif::occ_search, query)$data,
                     error = function(e) NULL)
    if (is.null(data) || nrow(data) == 0) return(NULL)
    data$facet <- facet
    data$facetValue <- as.character(selected[[value_column]][i])
    data$facetCount <- as.numeric(selected[[attr(selected, "count_column")]][i])
    data$outlierReason <- selected$outlierReason[i]
    data
  })
  records <- records[!vapply(records, is.null, logical(1))]
  if (length(records) == 0) return(data.frame())
  dedup_occurrences(dplyr::bind_rows(records))
}

#' Find low-count occurrence regions
find_region_outliers <- function(taxonKey, basisOfRecord = NULL,
                                 lowQuantile = 0.10, facetLimit = 300,
                                 limit = 300, pointBufferKm = 25,
                                 maxDeduplicatedRecords = 5,
                                 includeCountAtMost = 25) {
  find_facet_outlier_records(taxonKey, basisOfRecord, "gadmLevel1Gid",
               lowQuantile, facetLimit = facetLimit, limit = limit,
               pointBufferKm = pointBufferKm,
               maxDeduplicatedRecords = maxDeduplicatedRecords,
               includeCountAtMost = includeCountAtMost)
}

#' Find low-count occurrence continents
find_continent_outliers <- function(taxonKey, basisOfRecord = NULL,
                                     lowQuantile = 0.05, facetLimit = 300,
                                     limit = 300) {
  find_facet_outlier_records(taxonKey, basisOfRecord, "continent",
                             lowQuantile, facetLimit = facetLimit, limit = limit)
}

#' Find low-count occurrence countries
find_country_outliers <- function(taxonKey, basisOfRecord = NULL,
                                   lowQuantile = 0.05, facetLimit = 300,
                                   limit = 300) {
  find_facet_outlier_records(taxonKey, basisOfRecord, "country",
                             lowQuantile, facetLimit = facetLimit, limit = limit)
}

#' Find low-count latitude facet values
find_latitude_outliers <- function(taxonKey, basisOfRecord = NULL,
                                   lowQuantile = 0.05, facetLimit = 300,
                                   iqrMultiplier = 1.5, limit = 300) {
  find_coordinate_outlier_records(taxonKey, basisOfRecord, "decimalLatitude",
                                   lowQuantile, iqrMultiplier,
                                   facetLimit = facetLimit, limit = limit)
}

#' Find low-count longitude facet values
find_longitude_outliers <- function(taxonKey, basisOfRecord = NULL,
                                    lowQuantile = 0.05, facetLimit = 300,
                                    iqrMultiplier = 1.5, limit = 300) {
  find_coordinate_outlier_records(taxonKey, basisOfRecord, "decimalLongitude",
                                  lowQuantile, iqrMultiplier,
                                  facetLimit = facetLimit, limit = limit)
}

#' Find low-count centroid-distance facet values
find_centroid_distance_outliers <- function(taxonKey, basisOfRecord = NULL,
                                             lowQuantile = 0.05, facetLimit = 300,
                                             limit = 300) {
  find_facet_outlier_records(taxonKey, basisOfRecord,
                             "distanceFromCentroidInMeters", lowQuantile,
                             facetLimit = facetLimit, limit = limit)
}
