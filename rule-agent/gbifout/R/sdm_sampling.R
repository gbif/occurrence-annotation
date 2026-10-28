.sdm_polygons <- function(result) {
  polygons <- result$sdmPolygons
  if (is.null(polygons)) {
    warning("Legacy pipeline result: original HDP cells are unavailable; ",
            "sampling the merged HDP polygon instead. New pipeline runs retain cells.",
            call. = FALSE)
    geometry <- sf::st_as_sfc(result$hdp, crs = 4326)
    if (any(!as.character(sf::st_geometry_type(geometry)) %in%
            c("POLYGON", "MULTIPOLYGON"))) {
      stop("hdp must be polygon WKT.")
    }
    geometry <- sf::st_cast(geometry[!sf::st_is_empty(geometry)], "POLYGON")
    polygons <- data.frame(group = rep("hdp", length(geometry)),
                           binWkt = sf::st_as_text(geometry))
  }
  if (!is.data.frame(polygons) ||
      !all(c("group", "binWkt") %in% names(polygons)) ||
      !is.character(polygons$binWkt) || anyNA(polygons$binWkt) ||
      anyNA(polygons$group) || any(!polygons$group %in% c("ok", "hdp"))) {
    stop("sdmPolygons must contain group (ok/hdp) and binWkt columns.")
  }
  polygons <- unique(polygons[, c("group", "binWkt"), drop = FALSE])
  geometry <- sf::st_as_sfc(polygons$binWkt, crs = 4326)
  if (any(!as.character(sf::st_geometry_type(geometry)) %in%
          c("POLYGON", "MULTIPOLYGON")) || any(sf::st_is_empty(geometry)) ||
      any(!sf::st_is_valid(geometry))) {
    stop("SDM sampling cells must be valid, non-empty polygons.")
  }
  polygons <- polygons[polygons$group == "hdp", , drop = FALSE]
  rownames(polygons) <- NULL
  polygons$polygonId <- seq_len(nrow(polygons))
  polygons
}

.sdm_record_coordinates <- function(data) {
  keys <- unique(as.character(data$gbifid))
  details <- lapply(keys, function(key) {
    record <- tryCatch(
      .fetch_occurrence_record(as.numeric(key)),
      error = function(error) {
        stop("SDM lookup failed for GBIF ID ", key, ": ",
             conditionMessage(error), call. = FALSE)
      }
    )
    coordinate <- function(name) {
      value <- record[[name]]
      if (is.null(value) || !length(value)) return(NA_real_)
      suppressWarnings(as.numeric(value[[1]]))
    }
    data.frame(gbifid = key, decimalLongitude = coordinate("decimalLongitude"),
               decimalLatitude = coordinate("decimalLatitude"))
  })
  if (!length(details)) {
    data$decimalLongitude <- numeric()
    data$decimalLatitude <- numeric()
    return(data)
  }
  details <- bind_rows(details)
  index <- match(as.character(data$gbifid), details$gbifid)
  data$decimalLongitude <- details$decimalLongitude[index]
  data$decimalLatitude <- details$decimalLatitude[index]
  data
}

.sdm_valid_coordinates <- function(data) {
  is.finite(data$decimalLongitude) & is.finite(data$decimalLatitude) &
    abs(data$decimalLongitude) <= 180 & abs(data$decimalLatitude) <= 90
}

.sdm_sample_occurrences <- function(taxonKey, polygons, sampleSize, basisOfRecord) {
  basis_filter <- if (is.null(basisOfRecord)) NULL else paste(basisOfRecord, collapse = ";")
  samples <- list()
  counts <- integer(nrow(polygons))
  for (i in seq_len(nrow(polygons))) {
    message("SDM occurrence sampling: polygon ", i, "/", nrow(polygons))
    response <- tryCatch(
      occ_search(
        taxonKey = taxonKey, geometry = polygons$binWkt[i],
        basisOfRecord = basis_filter, occurrenceStatus = "PRESENT",
        hasCoordinate = TRUE, hasGeospatialIssue = FALSE,
        limit = sampleSize, start = 0
      ),
      error = function(error) {
        stop("SDM occurrence search failed for polygon ", i, ": ",
             conditionMessage(error), call. = FALSE)
      }
    )
    candidates <- response$data
    if (is.null(candidates) && is.list(response$meta) &&
        identical(as.numeric(response$meta$count), 0)) next
    required <- c("key", "decimalLongitude", "decimalLatitude")
    if (!is.data.frame(candidates) ||
        (nrow(candidates) && !all(required %in% names(candidates)))) {
      stop("Invalid SDM occurrence data for polygon ", i, ".")
    }
    if (!nrow(candidates)) next
    if (nrow(candidates) > sampleSize) {
      stop("SDM search returned more than sampleSize records for polygon ", i, ".")
    }
    candidates <- as.data.frame(candidates[, required, drop = FALSE])
    candidates$key <- as.character(candidates$key)
    if (anyNA(candidates$key) || any(!grepl("^[0-9]+$", candidates$key))) {
      stop("Invalid GBIF IDs in SDM polygon ", i, ".")
    }
    if (!is.numeric(candidates$decimalLongitude) || !is.numeric(candidates$decimalLatitude)) {
      stop("Invalid coordinate columns in SDM polygon ", i, ".")
    }
    candidates <- candidates[.sdm_valid_coordinates(candidates), , drop = FALSE]
    counts[i] <- nrow(candidates)
    candidates$polygonId <- rep(polygons$polygonId[i], nrow(candidates))
    candidates$group <- rep(polygons$group[i], nrow(candidates))
    samples[[length(samples) + 1]] <- candidates
  }
  if (any(counts < sampleSize)) {
    warning(sum(counts < sampleSize), " SDM polygons supplied fewer than ", sampleSize,
            " usable occurrences in their first response (including empty polygons).",
            call. = FALSE)
  }
  if (!length(samples) || !sum(counts)) stop("No eligible SDM training occurrences found.")
  data <- as.data.frame(bind_rows(samples))
  names(data)[names(data) == "key"] <- "gbifid"
  polygons$sampledCount <- counts
  list(data = data, polygons = polygons)
}
