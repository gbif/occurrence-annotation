#' Build small bounding boxes around SUSPICIOUS pipeline records
#'
#' Looks up each SUSPICIOUS GBIF ID from a `pipeline()` result and adds its
#' coordinates, `datasetKey`, `basisOfRecord`, and a square box of
#' `halfWidth` degrees around the point. Boxes are clamped to valid longitude
#' and latitude ranges and are not split across the antimeridian. Lookups are
#' sequential; any failure stops with the GBIF ID in the error message.
#'
#' @param result the list returned by `pipeline()`.
#' @param halfWidth box half-width in decimal degrees (default 0.01).
#' @return A list with `data`, the SUSPICIOUS rows of `result$data` plus
#'   `decimalLatitude`, `decimalLongitude`, `datasetKey`, `basisOfRecord`, and
#'   `bboxWkt` (NA when coordinates are missing); and `mp`, the combined
#'   MULTIPOLYGON WKT of all boxes (or `"MULTIPOLYGON EMPTY"`).
#' @export
suspicious_boxes <- function(result, halfWidth = 0.01) {
  if (!is.list(result) || !is.data.frame(result$data) ||
      !all(c("gbifid", "decision") %in% names(result$data))) {
    stop("result must be a pipeline() result with data$gbifid and data$decision.")
  }
  if (!is.numeric(halfWidth) || length(halfWidth) != 1 || is.na(halfWidth) ||
      !is.finite(halfWidth) || halfWidth <= 0) {
    stop("halfWidth must be a positive number of decimal degrees.")
  }

  data <- result$data[!is.na(result$data$decision) &
                        result$data$decision == "SUSPICIOUS", , drop = FALSE]
  rownames(data) <- NULL
  if (!nrow(data)) {
    data$decimalLatitude <- numeric(0)
    data$decimalLongitude <- numeric(0)
    data$datasetKey <- character(0)
    data$basisOfRecord <- character(0)
    data$bboxWkt <- character(0)
    return(list(data = data, mp = "MULTIPOLYGON EMPTY"))
  }

  field <- function(record, name, convert) {
    value <- record[[name]]
    if (is.null(value) || !length(value)) return(convert(NA))
    suppressWarnings(convert(value[[1]]))
  }
  details <- lapply(as.character(data$gbifid), function(gbifid) {
    record <- tryCatch(
      .fetch_occurrence_record(as.numeric(gbifid)),
      error = function(error) {
        stop("Lookup failed for GBIF ID ", gbifid, ": ",
             conditionMessage(error), call. = FALSE)
      }
    )
    latitude <- field(record, "decimalLatitude", as.numeric)
    longitude <- field(record, "decimalLongitude", as.numeric)
    box <- NA_character_
    if (is.finite(latitude) && is.finite(longitude)) {
      bbox <- sf::st_bbox(c(
        xmin = max(longitude - halfWidth, -180), ymin = max(latitude - halfWidth, -90),
        xmax = min(longitude + halfWidth, 180), ymax = min(latitude + halfWidth, 90)
      ), crs = sf::st_crs(4326))
      box <- sf::st_as_text(sf::st_as_sfc(bbox))
    }
    list(
      decimalLatitude = latitude,
      decimalLongitude = longitude,
      datasetKey = field(record, "datasetKey", as.character),
      basisOfRecord = field(record, "basisOfRecord", as.character),
      bboxWkt = box
    )
  })
  for (name in names(details[[1]])) {
    data[[name]] <- unlist(lapply(details, `[[`, name), use.names = FALSE)
  }

  combined <- combine_outlier_polygons(data$bboxWkt)
  mp <- sf::st_as_text(sf::st_cast(sf::st_as_sfc(combined, crs = 4326), "MULTIPOLYGON"))
  list(data = data, mp = mp)
}
