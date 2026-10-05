
#' Find candidate outlier occurrence gbifids for a taxon
#'
#' Builds a pixel-occupancy grid and selects its lowest-occupancy cells. Returns
#' one row per candidate polygon with occurrence and dataset-count metadata;
#' individual occurrence records are not downloaded.
#'
#' @param taxonKey GBIF taxon key to investigate.
#' @param basisOfRecord one or more basis-of-record channels combined for the
#'   occupancy raster. By default, all current GBIF channels are included except
#'   `MATERIAL_CITATION`, `LIVING_SPECIMEN`, `MATERIAL_SAMPLE`, and
#'   `FOSSIL_SPECIMEN`.
#' @param zoom map tile zoom level passed to `build_raster_occupancy_grid()` (default 0).
#'   Higher zoom values provide finer geographic tiles.
#' @param squareSize logical raster pixels per occupancy cell passed to
#'   `build_raster_occupancy_grid()`
#'   (default 256); smaller values give a finer (noisier) grid. Valid values
#'   are 8, 16, 32, 64, 128, 256, 512, 1024, 2048, and 4096.
#' @param rasterLowQuantile fraction of occupied raster cells retained by the
#'   occupancy-based candidate selector (default 0.25).
#' @param maxFilledPixels also retain occupied cells with at most this many
#'   filled pixels, regardless of the occupancy quantile (default 3).
#' @param maxOccurrenceCount remove polygons with more occurrences than this
#'   value, based on `occ_count()` (default 100). Set to `NULL` to disable.
#' @param outputDir optional directory for run artifacts. When supplied, the
#'   pixel-occupancy grid is saved as `<taxonKey>-occupancy.tif`.
#' @param densityOutputResolution optional output resolution in decimal degrees
#'   for the saved density GeoTIFF. This affects only the visualization export,
#'   not outlier selection.
#' @param datasetFacetLimit maximum dataset facet values requested per polygon
#'   (default 300, GBIF's facet limit).
#'
#' The combined polygon is also written to
#'   `<taxonKey>-outliers-multipolygon.wkt` when `outputDir` is supplied.
#'
#' @return A list with `candidates`, one row per candidate polygon;
#'   `datasets`, dataset occurrence counts keyed by `polygonId`; `mp`, a
#'   MULTIPOLYGON WKT string (or `"MULTIPOLYGON EMPTY"`); and
#'   `hdp`, a single MULTIPOLYGON WKT (or `"MULTIPOLYGON EMPTY"`) for occupied cells outside the
#'   low-occupancy selection (including the filled-pixel override). No occurrence
#'   counts or dataset facets are requested for these high-occupancy cells.
find_outlier_candidates <- function(taxonKey,
                                     basisOfRecord = c(
                                       "PRESERVED_SPECIMEN",
                                       "OBSERVATION",
                                       "HUMAN_OBSERVATION",
                                       "MACHINE_OBSERVATION",
                                       "LITERATURE",
                                       "OCCURRENCE",
                                       "UNKNOWN"
                                     ),
                                     zoom = 0,
                                     squareSize = 8,
                                     rasterLowQuantile = 0.50,
                                     maxFilledPixels = 3,
                                     maxOccurrenceCount = 30,
                                     useOcean = FALSE,
                                     oceanPath = ocean_polygon_path(),
                                     outputDir = NULL,
                                     densityOutputResolution = NULL,
                                     datasetFacetLimit = 300) {
  if (!is.numeric(datasetFacetLimit) || length(datasetFacetLimit) != 1 ||
      is.na(datasetFacetLimit) || datasetFacetLimit < 1 ||
      datasetFacetLimit != as.integer(datasetFacetLimit)) {
    stop("datasetFacetLimit must be a positive integer.")
  }
  if (!is.null(maxOccurrenceCount) &&
      (!is.numeric(maxOccurrenceCount) || length(maxOccurrenceCount) != 1 ||
       is.na(maxOccurrenceCount) || !is.finite(maxOccurrenceCount) ||
       maxOccurrenceCount < 0 || maxOccurrenceCount != as.integer(maxOccurrenceCount))) {
    stop("maxOccurrenceCount must be NULL or a non-negative integer.")
  }

  grid <- build_raster_occupancy_grid(
    taxonKey, zoom, squareSize,
    keepBasisOfRecord = basisOfRecord,
    useOcean = useOcean,
    oceanPath = oceanPath
  )
  if (!is.null(outputDir)) {
    dir.create(outputDir, recursive = TRUE, showWarnings = FALSE)
    density_raster <- grid$raster
    if (!is.null(densityOutputResolution)) {
      if (!is.numeric(densityOutputResolution) || length(densityOutputResolution) != 1 ||
          densityOutputResolution <= 0) {
        stop("densityOutputResolution must be a positive number of decimal degrees.")
      }
      template <- terra::rast(terra::ext(grid$raster),
                              resolution = densityOutputResolution,
                              crs = terra::crs(grid$raster))
      density_raster <- terra::resample(grid$raster, template, method = "bilinear")
    }
    terra::writeRaster(
      density_raster,
      file.path(outputDir, paste0(tolower(taxonKey), "-occupancy.tif")),
      overwrite = TRUE
    )
  }
  candidate_cells <- find_low_occupancy_cells(
    grid, rasterLowQuantile,
    maxFilledPixels = maxFilledPixels,
    useOcean = useOcean,
    oceanPath = oceanPath
  )
  candidate_cells <- candidate_cells[!is.na(candidate_cells$wkt) & nzchar(candidate_cells$wkt), ]
  high_density_polygons <- .high_occupancy_polygons(
    grid, rasterLowQuantile, maxFilledPixels, useOcean, oceanPath
  )
  occurrence_counts <- vapply(seq_len(nrow(candidate_cells)), function(i) {
    tryCatch(
      as.numeric(occ_count(
        taxonKey = taxonKey,
        geometry = candidate_cells$wkt[i],
        occurrenceStatus = "PRESENT"
      )),
      error = function(e) NA_real_
    )
  }, numeric(1))
  if (!is.null(maxOccurrenceCount)) {
    keep <- !is.na(occurrence_counts) & occurrence_counts <= maxOccurrenceCount
    candidate_cells <- candidate_cells[keep, , drop = FALSE]
    occurrence_counts <- occurrence_counts[keep]
  }

  polygon_metadata <- lapply(seq_len(nrow(candidate_cells)), function(i) {
    dataset_counts <- tryCatch(
      occ_count(
        taxonKey = taxonKey,
        geometry = candidate_cells$wkt[i],
        occurrenceStatus = "PRESENT",
        facet = "datasetKey",
        facetLimit = datasetFacetLimit
      ),
      error = function(e) data.frame(datasetKey = character(0), count = integer(0))
    )
    if (nrow(dataset_counts) > 0) {
      dataset_counts$polygonId <- i
      dataset_counts <- dataset_counts[, c("polygonId", "datasetKey", "count"), drop = FALSE]
    } else {
      dataset_counts <- data.frame(
        polygonId = integer(0),
        datasetKey = character(0),
        count = integer(0)
      )
    }
    list(
      candidate = data.frame(
        polygonId = i,
        binPercentage = candidate_cells$fillFraction[i] * 100,
        filledPixelCount = candidate_cells$filledPixelCount[i],
        binWkt = candidate_cells$wkt[i],
        occurrenceCount = occurrence_counts[i],
        datasetCount = nrow(dataset_counts),
        stringsAsFactors = FALSE
      ),
      datasets = dataset_counts
    )
  })
  if (length(polygon_metadata) == 0) {
    result <- data.frame(
      polygonId = integer(0),
      binPercentage = numeric(0),
      filledPixelCount = numeric(0),
      binWkt = character(0),
      occurrenceCount = numeric(0),
      datasetCount = integer(0)
    )
    datasets <- data.frame(
      polygonId = integer(0),
      datasetKey = character(0),
      count = integer(0)
    )
  } else {
    result <- bind_rows(lapply(polygon_metadata, `[[`, "candidate"))
    datasets <- bind_rows(lapply(polygon_metadata, `[[`, "datasets"))
  }

  combined_wkt <- combine_outlier_polygons(result$binWkt)
  if (!is.null(outputDir)) {
    dir.create(outputDir, recursive = TRUE, showWarnings = FALSE)
    writeLines(combined_wkt, file.path(outputDir, paste0(tolower(taxonKey), "-outliers-multipolygon.wkt")))
  }

  list(
    candidates = result,
    datasets = datasets,
    mp = combined_wkt,
    hdp = sf::st_as_text(sf::st_cast(
      sf::st_as_sfc(combine_outlier_polygons(high_density_polygons), crs = 4326),
      "MULTIPOLYGON"
    ))
  )
}

.high_occupancy_polygons <- function(grid, lowQuantile, maxFilledPixels,
                                    useOcean, oceanPath) {
  occupancy <- terra::values(grid$raster)
  occupied_values <- occupancy[!is.na(occupancy) & occupancy > 0]
  if (!length(occupied_values)) return(character(0))

  cutoff <- unname(stats::quantile(occupied_values, lowQuantile))
  high_cells <- grid$raster > cutoff
  if (!is.null(maxFilledPixels)) {
    high_cells <- high_cells & grid$filledPixelCount > maxFilledPixels
  }
  selected <- terra::ifel(high_cells, grid$raster, NA)
  if (all(is.na(terra::values(selected)))) return(character(0))

  polygons <- terra::as.polygons(selected, dissolve = FALSE, na.rm = TRUE)
  wkts <- terra::geom(polygons, wkt = TRUE)
  if (useOcean) wkts <- clip_wkt_to_land(wkts, oceanPath)
  wkts[!is.na(wkts) & nzchar(wkts)]
}
