#' Double-check pipeline records with a presence-background climate model
#'
#' Fetches the first ten occurrences per original OK/HDP cell, fits a regularized
#' linear/quadratic MaxEnt model, and scores pipeline records without changing
#' their decisions. Predicts suitability for complete climate raster cells within
#' 500 km of a retained OK/HDP training occurrence by default.
#' No OpenAI requests or annotation writes are made.
#'
#' @param result a `pipeline()` result, including one loaded with `readRDS()`.
#' @param climate optional EPSG:4326 terra SpatRaster with layers named bio1,
#'   bio4, bio12, bio15. Otherwise WorldClim 2.1 at 10 arc-minutes is cached.
#' @param cacheDir directory for the reusable WorldClim download.
#' @param sampleSize records requested once per cell (default 10, maximum 299).
#'   No occurrence deduplication or additional pages are used.
#' @param backgroundSize maximum background climate cells (default 10000).
#' @param bufferKm accessible background radius around training points (500 km).
#' @param basisOfRecord GBIF channels, defaulting to the pipeline's seven
#'   channels. Pass the same filter used in the original analysis; NULL uses all.
#' @param seed random seed for background sampling, preserving the caller's RNG state.
#' @param outputDir optional directory for sdm-check.rds, sdm-scores.csv,
#'   sdm-suitability.tif and sdm-suitability.wkt. The RDS packs the prediction raster for portability;
#'   use `terra::unwrap()` on its `prediction` to recover a SpatRaster.
#' @param predictionBufferKm maximum geodesic distance in kilometres from a
#'   raster cell centre to a retained training occurrence from an OK or HDP cell
#'   (default 500). Samples removed for missing climate do not anchor the mask.
#'   NULL disables the prediction mask. Does not change
#'   model fitting, background sampling, or individual record-review scores.
#' @param suitabilityThreshold score cutoff for the suitability polygon
#'   (default 0.70, inclusive; must be between 0 and 1). This is relative
#'   suitability, not a probability or percentage of total suitability.
#' @return A list with scored `data`, `model`, `training`, `background`,
#'   `polygons` (including sampling counts), `thresholds`, `settings`, and
#'   `prediction`, a single-layer suitability SpatRaster on the climate grid.
#'   `suitabilityPolygon` is EPSG:4326 MULTIPOLYGON WKT covering whole allowed
#'   cells at or above `suitabilityThreshold`, preserving holes and disconnected
#'   regions, or `MULTIPOLYGON EMPTY` when no cells qualify.
#'   Cells outside the distance mask or missing any fitted predictor remain NA.
#'   Predictions use cloglog
#'   scores with clamping, just like record scoring.
#'   Scores are relative suitability (cloglog), not occurrence probabilities.
#'   Review flags use the 10th/90th percentiles of training suitability; these
#'   are descriptive thresholds, not independently validated accuracy estimates.
#'   Missing coordinates/climate, training-cell overlap and climate extrapolation
#'   are reported explicitly. Missing coordinates or climate can reduce the final
#'   training set below ten per sampling cell. Duplicate records/cells are retained.
#' @export
sdm_check <- function(result, climate = NULL,
                      cacheDir = tools::R_user_dir("gbifout", "cache"),
                      sampleSize = 10, 
                      backgroundSize = 10000, 
                      bufferKm = 1500,
                      basisOfRecord = c(
                        "PRESERVED_SPECIMEN", "OBSERVATION", "HUMAN_OBSERVATION",
                        "MACHINE_OBSERVATION", "LITERATURE", "OCCURRENCE", "UNKNOWN"
                      ), seed = 42, outputDir = NULL, predictionBufferKm = 500,
                      suitabilityThreshold = 0.10) {
  started <- proc.time()[["elapsed"]]
  if (!is.list(result) || !is.data.frame(result$data) ||
      !all(c("gbifid", "decision") %in% names(result$data)) ||
      anyNA(result$data$gbifid) ||
      any(!grepl("^[0-9]+$", as.character(result$data$gbifid))) ||
      any(as.numeric(as.character(result$data$gbifid)) < 1) ||
      !is.character(result$data$decision) || anyNA(result$data$decision) ||
      any(!result$data$decision %in% .record_triage_decisions)) {
    stop("result must be a pipeline result with valid data$gbifid and data$decision.")
  }
  taxon_keys <- unique(as.character(c(result$taxonKey, result$data$taxonKey)))
  if (length(taxon_keys) != 1 || is.na(taxon_keys) || !nzchar(trimws(taxon_keys))) {
    stop("The pipeline result must identify exactly one taxonKey.")
  }
  for (name in c("sampleSize", "backgroundSize", "seed")) {
    value <- get(name)
    minimum <- switch(name, seed = 0, backgroundSize = 10, sampleSize = 1)
    if (!is.numeric(value) || length(value) != 1 || !is.finite(value) ||
        value < minimum || value != floor(value) || value > .Machine$integer.max) {
      stop(name, " must be a finite integer >= ", minimum, ".")
    }
  }
  if (sampleSize > 299) stop("sampleSize must be <= 299 to use a single GBIF page.")
  if (!is.numeric(bufferKm) || length(bufferKm) != 1 ||
      !is.finite(bufferKm) || bufferKm <= 0) {
    stop("bufferKm must be a positive finite number of kilometres.")
  }
  if (!is.null(predictionBufferKm) &&
      (!is.numeric(predictionBufferKm) || length(predictionBufferKm) != 1 ||
       !is.finite(predictionBufferKm) || predictionBufferKm <= 0)) {
    stop("predictionBufferKm must be NULL or a positive finite number of kilometres.")
  }
  if (!is.numeric(suitabilityThreshold) || length(suitabilityThreshold) != 1 ||
      !is.finite(suitabilityThreshold) || suitabilityThreshold < 0 ||
      suitabilityThreshold > 1) {
    stop("suitabilityThreshold must be a finite number between 0 and 1.")
  }
  if (!is.null(basisOfRecord)) {
    if (!is.character(basisOfRecord) || !length(basisOfRecord) ||
        anyNA(basisOfRecord) || any(!nzchar(trimws(basisOfRecord))) ||
        any(grepl(";", basisOfRecord, fixed = TRUE))) {
      stop("basisOfRecord must be NULL or non-empty individual channels.")
    }
    basisOfRecord <- unique(trimws(basisOfRecord))
  }
  for (name in c("cacheDir", "outputDir")) {
    value <- get(name)
    if (!(name == "outputDir" && is.null(value)) &&
        (!is.character(value) || length(value) != 1 || is.na(value) || !nzchar(value))) {
      stop(name, " must be a non-empty directory path.")
    }
  }
  polygons <- .sdm_polygons(result)
  if (!nrow(polygons)) stop("No OK or HDP sampling polygons are available.")
  if (!requireNamespace("maxnet", quietly = TRUE)) {
    stop("Install the optional SDM dependency: install.packages('maxnet').")
  }
  climate_source <- if (is.null(climate)) "WorldClim 2.1, 10 arc-minutes" else "user-supplied"
  message("SDM: loading climate predictors")
  if (is.null(climate)) climate <- .sdm_worldclim(cacheDir)
  variables <- c("bio1", "bio4", "bio12", "bio15")
  if (!inherits(climate, "SpatRaster") || !all(variables %in% names(climate)) ||
      anyDuplicated(names(climate)) ||
      !isTRUE(sf::st_crs(terra::crs(climate)) == sf::st_crs(4326))) {
    stop("climate must be an EPSG:4326 SpatRaster with bio1, bio4, bio12, bio15 layers.")
  }
  climate <- climate[[variables]]

  had_seed <- exists(".Random.seed", envir = .GlobalEnv, inherits = FALSE)
  if (had_seed) previous_seed <- get(".Random.seed", envir = .GlobalEnv)
  on.exit({
    if (had_seed) {
      assign(".Random.seed", previous_seed, envir = .GlobalEnv)
    } else if (exists(".Random.seed", envir = .GlobalEnv, inherits = FALSE)) {
      rm(".Random.seed", envir = .GlobalEnv)
    }
  }, add = TRUE)
  set.seed(seed)

  message("SDM: fetching coordinates for ", length(unique(result$data$gbifid)),
          " assessed records")
  assessed <- .sdm_record_coordinates(result$data)
  samples <- .sdm_sample_occurrences(
    taxon_keys, polygons, sampleSize, basisOfRecord
  )
  training <- samples$data
  message("SDM: extracting climate for ", nrow(training), " sampled training records")
  training$climateCell <- terra::cellFromXY(
    climate, as.matrix(training[, c("decimalLongitude", "decimalLatitude")])
  )
  training_values <- .sdm_extract(climate, training)
  complete <- rowSums(is.finite(as.matrix(training_values))) == length(variables)
  keep <- complete
  if (any(!keep)) {
    warning(sum(!keep), " sampled training records removed for missing climate.",
            call. = FALSE)
  }
  training <- cbind(training[keep, , drop = FALSE], training_values[keep, , drop = FALSE])
  distinct_cells <- length(unique(training$climateCell))
  if (distinct_cells < 20) {
    stop("SDM requires at least 20 distinct training climate cells; found ", distinct_cells,
         ". Increase sampleSize or use finer user-supplied climate layers.")
  }
  varying <- vapply(training[, variables, drop = FALSE], function(x) {
    length(unique(x)) > 1
  }, logical(1))
  if (!all(varying)) {
    warning("Dropping constant climate variables: ",
            paste(variables[!varying], collapse = ", "), call. = FALSE)
    variables <- variables[varying]
  }
  if (length(variables) < 2) stop("SDM needs at least two varying climate predictors.")
  climate <- climate[[variables]]
  message("SDM: generating accessible background from ", nrow(training), " training records")
  background <- .sdm_background(climate, training, backgroundSize, bufferKm)
  predictors <- rbind(training[, variables, drop = FALSE],
                      background[, variables, drop = FALSE])
  presence <- c(rep(1, nrow(training)), rep(0, nrow(background)))
  message("SDM: fitting MaxEnt with ", nrow(training), " presences and ",
          nrow(background), " background cells")
  model <- maxnet::maxnet(
    presence, predictors,
    f = maxnet::maxnet.formula(presence, predictors, classes = "lq"),
    regmult = 1, addsamplestobackground = TRUE
  )
  training$suitability <- as.numeric(stats::predict(
    model, training[, variables, drop = FALSE], type = "cloglog"
  ))
  if (any(!is.finite(training$suitability))) {
    stop("The SDM produced non-finite training suitability scores.")
  }
  thresholds <- stats::quantile(training$suitability, c(0.1, 0.9), names = FALSE)
  names(thresholds) <- c("low", "high")
  message("SDM: scoring assessed records")
  data <- .sdm_score(assessed, climate, model, training, thresholds)
  prediction_mask <- if (!is.null(predictionBufferKm)) {
    message("SDM: building ", predictionBufferKm, " km training-point prediction mask")
    .sdm_prediction_mask(climate[[1]], training, predictionBufferKm)
  } else NULL
  prediction_climate <- if (is.null(prediction_mask)) climate else {
    terra::mask(climate, prediction_mask)
  }
  message("SDM: predicting raster suitability")
  prediction <- .sdm_predict_raster(prediction_climate, model)
  message("SDM: polygonizing suitability >= ", suitabilityThreshold)
  suitability_polygon <- .sdm_suitability_polygon(prediction, suitabilityThreshold)
  polygons <- samples$polygons
  polygons$trainingCount <- tabulate(match(training$polygonId, polygons$polygonId),
                                     nbins = nrow(polygons))
  settings <- list(
    taxonKey = taxon_keys, variables = variables, climateSource = climate_source,
    climateFiles = terra::sources(climate), climateResolution = terra::res(climate),
    climateExtent = as.vector(terra::ext(climate)),
    sampleSize = sampleSize, backgroundSize = backgroundSize,
    occurrenceSampling = "first page, no occurrence deduplication",
    bufferKm = bufferKm, basisOfRecord = basisOfRecord, seed = seed,
    predictionBufferKm = predictionBufferKm,
    suitabilityThreshold = suitabilityThreshold,
    predictionAnchors = if (is.null(predictionBufferKm)) NULL else "retained OK/HDP training records",
    features = "linear/quadratic", regularizationMultiplier = 1,
    lowQuantile = 0.1, highQuantile = 0.9,
    originalCells = !is.null(result$sdmPolygons),
    maxnetVersion = as.character(utils::packageVersion("maxnet")),
    created = format(Sys.time(), tz = "UTC", usetz = TRUE)
  )
  output <- list(data = data, model = model, training = training,
                 background = background, polygons = polygons,
                 thresholds = thresholds, settings = settings,
                 prediction = prediction, suitabilityPolygon = suitability_polygon)
  class(output) <- c("gbifout_sdm", "list")
  if (!is.null(outputDir)) {
    message("SDM: saving outputs to ", outputDir)
    if (!dir.exists(outputDir) && !dir.create(outputDir, recursive = TRUE)) {
      stop("Could not create SDM output directory: ", outputDir)
    }
    terra::writeRaster(prediction, file.path(outputDir, "sdm-suitability.tif"),
                       overwrite = TRUE)
    saved <- output
    saved$prediction <- terra::wrap(prediction, proxy = FALSE)
    saveRDS(saved, file.path(outputDir, "sdm-check.rds"))
    utils::write.csv(data, file.path(outputDir, "sdm-scores.csv"), row.names = FALSE)
    writeLines(suitability_polygon, file.path(outputDir, "sdm-suitability.wkt"))
  }
  message("SDM: complete in ", round(proc.time()[["elapsed"]] - started, 1), " seconds")
  output
}

.sdm_suitability_polygon <- function(prediction, threshold) {
  scores <- terra::values(prediction, mat = FALSE)
  selected <- is.finite(scores) & scores >= threshold
  if (!any(selected)) {
    message("SDM: no allowed cells meet suitability threshold ", threshold)
    return("MULTIPOLYGON EMPTY")
  }
  binary <- terra::rast(prediction)
  terra::values(binary) <- ifelse(selected, 1, NA_real_)
  polygons <- terra::as.polygons(binary, dissolve = TRUE, na.rm = TRUE)
  geometry <- sf::st_geometry(sf::st_as_sf(polygons))
  sf::st_as_text(sf::st_cast(geometry, "MULTIPOLYGON"))[[1]]
}

.sdm_prediction_mask <- function(template, training, bufferKm) {
  valid <- .sdm_valid_coordinates(training)
  if (any(!valid)) {
    warning(sum(!valid), " training records excluded from the prediction mask: ",
            "missing/invalid coordinates.", call. = FALSE)
  }
  if (!any(valid)) {
    stop("The prediction mask requires at least one training record with valid coordinates. ",
         "Use predictionBufferKm = NULL only for an explicitly unmasked prediction.")
  }
  coordinates <- unique(training[valid, c("decimalLongitude", "decimalLatitude"), drop = FALSE])
  longitude <- terra::xFromCol(template, seq_len(terra::ncol(template)))
  latitude <- terra::yFromRow(template, seq_len(terra::nrow(template)))
  included <- rep(FALSE, terra::ncell(template))
  # 6300 km is below Earth's minimum curvature radius: these spherical bounds
  # conservatively enclose the ellipsoidal buffer, including poles/dateline.
  angle <- min(pi, bufferKm / 6300)
  for (i in seq_len(nrow(coordinates))) {
    lon <- coordinates$decimalLongitude[i]
    lat <- coordinates$decimalLatitude[i]
    rows <- which(abs(latitude - lat) <= angle * 180 / pi)
    reaches_pole <- abs(lat) * pi / 180 + angle >= pi / 2
    lon_limit <- if (reaches_pole) 180 else {
      asin(min(1, sin(angle) / cos(lat * pi / 180))) * 180 / pi
    }
    cols <- which(abs((longitude - lon + 180) %% 360 - 180) <= lon_limit)
    cells <- as.vector(outer((rows - 1) * terra::ncol(template), cols, "+"))
    cells <- cells[!included[cells]]
    if (length(cells)) {
      xy <- terra::xyFromCell(template, cells)
      distance <- as.vector(terra::distance(xy, matrix(c(lon, lat), nrow = 1),
                                            lonlat = TRUE))
      included[cells[distance <= bufferKm * 1000]] <- TRUE
    }
    if (i %% 50 == 0 || i == nrow(coordinates)) {
      message("SDM prediction mask: point ", i, "/", nrow(coordinates))
    }
  }
  mask <- terra::rast(template)
  terra::values(mask) <- ifelse(included, 1, NA_real_)
  mask
}

.sdm_predict_raster <- function(climate, model) {
  predict_cells <- function(model, data) {
    data <- as.data.frame(data)
    complete <- rowSums(is.finite(as.matrix(data))) == ncol(data)
    scores <- rep(NA_real_, nrow(data))
    if (any(complete)) {
      scores[complete] <- as.numeric(stats::predict(
        model, data[complete, , drop = FALSE], type = "cloglog", clamp = TRUE
      ))
      if (any(!is.finite(scores[complete]) | scores[complete] < 0 | scores[complete] > 1)) {
        stop("The SDM produced invalid raster suitability scores.")
      }
    }
    scores
  }
  prediction <- terra::predict(climate, model, fun = predict_cells)
  names(prediction) <- "suitability"
  prediction
}

.sdm_worldclim <- function(cacheDir) {
  if (!requireNamespace("geodata", quietly = TRUE)) {
    stop("Install the optional climate dependency: install.packages('geodata').")
  }
  if (!dir.exists(cacheDir) && !dir.create(cacheDir, recursive = TRUE)) {
    stop("Could not create climate cache directory: ", cacheDir)
  }
  climate <- geodata::worldclim_global(var = "bio", res = 10, path = cacheDir)
  if (!inherits(climate, "SpatRaster") || terra::nlyr(climate) != 19) {
    stop("WorldClim download failed or did not supply all 19 bioclim layers.")
  }
  climate <- climate[[c(1, 4, 12, 15)]]
  names(climate) <- c("bio1", "bio4", "bio12", "bio15")
  climate
}

.sdm_extract <- function(climate, data) {
  values <- as.data.frame(matrix(NA_real_, nrow(data), terra::nlyr(climate)))
  names(values) <- names(climate)
  valid <- .sdm_valid_coordinates(data)
  if (any(valid)) {
    values[valid, ] <- terra::extract(
      climate, as.matrix(data[valid, c("decimalLongitude", "decimalLatitude"), drop = FALSE])
    )
  }
  values
}

.sdm_background <- function(climate, training, size, bufferKm) {
  previous <- sf::sf_use_s2()
  on.exit(suppressMessages(sf::sf_use_s2(previous)), add = TRUE)
  suppressMessages(sf::sf_use_s2(TRUE))
  points <- sf::st_as_sf(training, coords = c("decimalLongitude", "decimalLatitude"), crs = 4326)
  area <- sf::st_union(sf::st_buffer(points, dist = bufferKm * 1000))
  # s2 unions can include zero-area line remnants alongside the buffer polygons.
  polygon_types <- c("POLYGON", "MULTIPOLYGON")
  if (any(!as.character(sf::st_geometry_type(area)) %in% polygon_types)) {
    if (!any(as.character(sf::st_geometry_type(area)) %in%
             c(polygon_types, "GEOMETRYCOLLECTION"))) {
      stop("SDM background buffers produced no polygon area.")
    }
    area <- sf::st_collection_extract(area, "POLYGON")
  }
  if (!length(area) || all(sf::st_is_empty(area))) {
    stop("SDM background buffers produced no polygon area.")
  }
  area <- sf::st_wrap_dateline(
    .unwrap_dateline_polygons(area), options = "WRAPDATELINE=YES"
  )
  mask <- terra::rasterize(terra::vect(area), climate[[1]], field = 1)
  values <- as.data.frame(terra::values(climate))
  complete <- rowSums(is.finite(as.matrix(values))) == terra::nlyr(climate)
  cells <- which(complete & !is.na(terra::values(mask, mat = FALSE)))
  cells <- setdiff(cells, training$climateCell)
  if (length(cells) < 10) stop("Fewer than ten background climate cells in accessible area.")
  if (length(cells) < size) {
    warning("Only ", length(cells), " eligible background cells; requested ", size, ".",
            call. = FALSE)
  }
  weights <- terra::values(terra::cellSize(climate[[1]], unit = "km"), mat = FALSE)[cells]
  cells <- cells[sample.int(length(cells), min(size, length(cells)), prob = weights)]
  coordinates <- terra::xyFromCell(climate, cells)
  data.frame(climateCell = cells, decimalLongitude = coordinates[, 1],
             decimalLatitude = coordinates[, 2], values[cells, , drop = FALSE])
}

.sdm_score <- function(data, climate, model, training, thresholds) {
  values <- .sdm_extract(climate, data)
  complete <- rowSums(is.finite(as.matrix(values))) == terra::nlyr(climate)
  data$sdmStatus <- rep("missing_coordinates", nrow(data))
  data$sdmStatus[.sdm_valid_coordinates(data)] <- "missing_climate"
  data$sdmStatus[complete] <- "scored"
  data$suitability <- rep(NA_real_, nrow(data))
  data$inTrainingCell <- rep(NA, nrow(data))
  data$extrapolated <- rep(NA, nrow(data))
  data$reviewFlag <- rep(NA_character_, nrow(data))
  if (any(complete)) {
    data$suitability[complete] <- as.numeric(stats::predict(
      model, values[complete, , drop = FALSE], type = "cloglog", clamp = TRUE
    ))
    if (any(!is.finite(data$suitability[complete]))) {
      stop("The SDM produced non-finite record suitability scores.")
    }
    cells <- terra::cellFromXY(
      climate, as.matrix(data[complete, c("decimalLongitude", "decimalLatitude"), drop = FALSE])
    )
    data$inTrainingCell[complete] <- cells %in% training$climateCell
    outside <- vapply(names(values), function(name) {
      values[[name]][complete] < min(training[[name]]) |
        values[[name]][complete] > max(training[[name]])
    }, logical(sum(complete)))
    data$extrapolated[complete] <- rowSums(matrix(outside, nrow = sum(complete))) > 0
  }
  low <- which(data$decision == "OK" & data$suitability < thresholds[["low"]])
  high <- which(data$decision == "SUSPICIOUS" & data$suitability >= thresholds[["high"]])
  data$reviewFlag[low] <- "low_suitability_OK"
  data$reviewFlag[high] <- "high_suitability_SUSPICIOUS"
  missing <- sum(!complete)
  if (missing) warning(missing, " pipeline records could not be scored; see sdmStatus.",
                       call. = FALSE)
  data
}
