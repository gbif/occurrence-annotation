sdm_test_polygon <- function(x = 0) {
  sprintf("POLYGON ((%s 0, %s 0, %s 10, %s 10, %s 0))",
          x, x + 10, x + 10, x, x)
}

sdm_test_result <- function() {
  list(
    data = data.frame(gbifid = c("1", "2"), taxonKey = "DJX8",
                      decision = c("OK", "SUSPICIOUS")),
    ok = sdm_test_polygon(), hdp = sdm_test_polygon(10),
    taxonKey = "DJX8",
    sdmPolygons = data.frame(group = c("ok", "hdp"),
                             binWkt = c(sdm_test_polygon(), sdm_test_polygon(10)))
  )
}

sdm_test_climate <- function() {
  climate <- terra::rast(nrows = 40, ncols = 40, xmin = -10, xmax = 30,
                          ymin = -10, ymax = 30, nlyrs = 4, crs = "EPSG:4326")
  xy <- terra::xyFromCell(climate, seq_len(terra::ncell(climate)))
  terra::values(climate) <- cbind(
    xy[, 1] + xy[, 2], xy[, 1]^2 + xy[, 2],
    sin(xy[, 1] / 10) + xy[, 2], cos(xy[, 2] / 10) + xy[, 1]
  )
  names(climate) <- c("bio1", "bio4", "bio12", "bio15")
  climate
}

test_that("sampling uses preserved cells, and legacy merged polygons warn", {
  result <- sdm_test_result()
  polygons <- gbifout:::.sdm_polygons(result)
  expect_identical(polygons$group, c("ok", "hdp"))
  expect_equal(polygons$polygonId, 1:2)
  result$sdmPolygons <- NULL
  expect_warning(legacy <- gbifout:::.sdm_polygons(result), "Legacy pipeline")
  expect_equal(nrow(legacy), 2)
  result$sdmPolygons <- data.frame(group = "sus", binWkt = sdm_test_polygon())
  expect_error(gbifout:::.sdm_polygons(result), "group")
  result$sdmPolygons <- data.frame(group = "ok", binWkt = "POINT (0 0)")
  expect_error(gbifout:::.sdm_polygons(result), "polygons")
})

test_that("one request per polygon keeps the first ten records including duplicates", {
  polygons <- gbifout:::.sdm_polygons(sdm_test_result())
  requests <- list()
  local_mocked_bindings(
    occ_search = function(taxonKey, geometry, basisOfRecord, occurrenceStatus,
                           hasCoordinate, hasGeospatialIssue, limit, start) {
      expect_identical(taxonKey, "DJX8")
      expect_identical(basisOfRecord, "HUMAN_OBSERVATION")
      expect_identical(occurrenceStatus, "PRESENT")
      expect_true(hasCoordinate)
      expect_false(hasGeospatialIssue)
      expect_equal(limit, 10)
      i <- match(geometry, polygons$binWkt)
      requests[[length(requests) + 1]] <<- c(i, start)
      expect_equal(start, 0)
      ids <- 1:10
      x <- if (i == 1) ids / 10 else 10 + ids / 10
      page <- data.frame(key = as.character(ids + (i - 1) * 30),
                          decimalLongitude = x, decimalLatitude = x)
      if (i == 1 && start == 0) {
        page$decimalLongitude[3] <- 5
        page$decimalLatitude[3] <- 5
        page$decimalLongitude[4] <- page$decimalLongitude[5]
        page$decimalLatitude[4] <- page$decimalLatitude[5]
      }
      list(meta = list(count = 543578, offset = start, endOfRecords = FALSE),
           data = page)
    },
    .package = "gbifout"
  )
  set.seed(3)
  result <- gbifout:::.sdm_sample_occurrences(
    "DJX8", polygons, 10, "HUMAN_OBSERVATION"
  )
  expect_equal(nrow(result$data), 20)
  expect_equal(as.integer(table(result$data$polygonId)), c(10L, 10L))
  expect_equal(result$polygons$sampledCount, c(10L, 10L))
  expect_identical(result$data$gbifid[1:10], as.character(1:10))
  expect_true(anyDuplicated(result$data[, c("decimalLongitude", "decimalLatitude")]) > 0)
  expect_equal(requests, list(c(1L, 0), c(2L, 0)))
})

test_that("short first responses warn without fetching more pages", {
  polygons <- gbifout:::.sdm_polygons(sdm_test_result())[1, ]
  calls <- 0
  response <- list(
    meta = list(count = 1, offset = 0, endOfRecords = TRUE),
    data = data.frame(key = "3", decimalLongitude = 2, decimalLatitude = 2)
  )
  local_mocked_bindings(occ_search = function(...) {
    calls <<- calls + 1
    response
  }, .package = "gbifout")
  expect_warning(result <- gbifout:::.sdm_sample_occurrences(
    "DJX8", polygons, 10, NULL
  ), "fewer than 10")
  expect_equal(nrow(result$data), 1)
  expect_equal(calls, 1)
  response$meta$count <- 543578
  response$meta$endOfRecords <- FALSE
  response$data <- data.frame(key = as.character(3:12),
                              decimalLongitude = 1:10, decimalLatitude = 1:10)
  large <- gbifout:::.sdm_sample_occurrences("DJX8", polygons, 10, NULL)
  expect_equal(nrow(large$data), 10)
  expect_identical(large$data$gbifid, as.character(3:12))
  response$meta$count <- 5
  response$meta$endOfRecords <- TRUE
  response$data <- response$data[1, , drop = FALSE]
  expect_warning(short <- gbifout:::.sdm_sample_occurrences(
    "DJX8", polygons, 10, NULL
  ), "fewer than 10")
  expect_equal(nrow(short$data), 1)
  expect_equal(calls, 3)
})

test_that("empty responses and request failures are explicit without retries", {
  polygons <- gbifout:::.sdm_polygons(sdm_test_result())[1, ]
  local_mocked_bindings(
    occ_search = function(...) list(meta = list(count = 0), data = NULL),
    .package = "gbifout"
  )
  expect_warning(expect_error(
    gbifout:::.sdm_sample_occurrences("DJX8", polygons, 10, NULL),
    "No eligible"
  ), "fewer than 10")
  local_mocked_bindings(
    occ_search = function(...) stop("offline"), .package = "gbifout"
  )
  expect_error(gbifout:::.sdm_sample_occurrences("DJX8", polygons, 10, NULL),
               "polygon 1: offline")
})

test_that("record lookups retain missing coordinates and identify lookup failures", {
  local_mocked_bindings(
    .fetch_occurrence_record = function(key) {
      if (key == 2) return(list())
      list(decimalLongitude = 1, decimalLatitude = 2)
    }, .package = "gbifout"
  )
  data <- gbifout:::.sdm_record_coordinates(sdm_test_result()$data)
  expect_equal(data$decimalLongitude, c(1, NA_real_))
  expect_equal(data$decimalLatitude, c(2, NA_real_))
  local_mocked_bindings(
    .fetch_occurrence_record = function(...) stop("offline"), .package = "gbifout"
  )
  expect_error(gbifout:::.sdm_record_coordinates(sdm_test_result()$data), "GBIF ID 1: offline")
})

test_that("WorldClim loading selects the requested four cached variables", {
  skip_if_not_installed("geodata")
  cache <- withr::local_tempdir()
  all_variables <- terra::rast(nrows = 2, ncols = 2, nlyrs = 19, crs = "EPSG:4326")
  terra::values(all_variables) <- matrix(rep(1:19, each = 4), nrow = 4)
  local_mocked_bindings(
    worldclim_global = function(var, res, path) {
      expect_identical(var, "bio")
      expect_equal(res, 10)
      expect_identical(path, cache)
      all_variables
    }, .package = "geodata"
  )
  climate <- gbifout:::.sdm_worldclim(cache)
  expect_identical(names(climate), c("bio1", "bio4", "bio12", "bio15"))
  expect_equal(as.numeric(terra::values(climate)[1, ]), c(1, 4, 12, 15))
  all_variables <- NULL
  expect_error(gbifout:::.sdm_worldclim(cache), "WorldClim download failed")
})

test_that("background comes from accessible finite climate cells and excludes presences", {
  climate <- sdm_test_climate()
  training <- data.frame(decimalLongitude = 0.5, decimalLatitude = 0.5)
  training$climateCell <- terra::cellFromXY(climate, matrix(c(0.5, 0.5), nrow = 1))
  previous <- sf::sf_use_s2()
  set.seed(1)
  background <- gbifout:::.sdm_background(climate, training, 15, 500)
  expect_identical(sf::sf_use_s2(), previous)
  expect_equal(nrow(background), 15)
  expect_false(any(background$climateCell %in% training$climateCell))
  expect_false(anyDuplicated(background$climateCell) > 0)
  points <- sf::st_as_sf(background, coords = c("decimalLongitude", "decimalLatitude"), crs = 4326)
  centre <- sf::st_sfc(sf::st_point(c(0.5, 0.5)), crs = 4326)
  expect_true(all(as.numeric(sf::st_distance(points, centre)) < 510000))
})

test_that("scoring flags disagreements, missing climate and training-cell overlap", {
  climate <- sdm_test_climate()
  data <- data.frame(
    gbifid = as.character(1:6),
    decision = c("OK", "SUSPICIOUS", "INTRODUCED", "NEEDS_REVIEW", "OK", "OK"),
    decimalLongitude = c(-9.5, 20.5, 0.5, 0.5, NA, 100),
    decimalLatitude = c(-9.5, 20.5, 0.5, 0.5, NA, 0)
  )
  training <- data.frame(bio1 = c(-10, 10), bio4 = c(0, 20),
                         bio12 = c(-10, 10), bio15 = c(-10, 10),
                         climateCell = terra::cellFromXY(
                           climate, matrix(c(0.5, 0.5), nrow = 1)
                         ))
  fake_model <- structure(list(), class = "sdm_test_model")
  local_mocked_bindings(
    predict = function(object, newdata, ...) ifelse(newdata$bio1 < 0, 0.01, 0.95),
    .package = "stats"
  )
  expect_warning(scored <- gbifout:::.sdm_score(
    data, climate, fake_model, training, c(low = 0.1, high = 0.9)
  ), "2 pipeline records")
  expect_identical(scored$decision, data$decision)
  expect_identical(scored$reviewFlag,
                   c("low_suitability_OK", "high_suitability_SUSPICIOUS", rep(NA_character_, 4)))
  expect_identical(scored$sdmStatus,
                   c(rep("scored", 4), "missing_coordinates", "missing_climate"))
  expect_true(scored$inTrainingCell[3])
  expect_true(scored$extrapolated[1])
  expect_true(is.na(scored$suitability[5]))
})

test_that("background rasterization ignores line remnants from s2 buffer unions", {
  climate <- sdm_test_climate()
  training <- data.frame(decimalLongitude = 0.5, decimalLatitude = 0.5)
  training$climateCell <- terra::cellFromXY(climate, matrix(c(0.5, 0.5), nrow = 1))
  polygon <- sf::st_as_sfc(
    "MULTIPOLYGON (((-4 -4, 4 -4, 4 4, -4 4, -4 -4)))", crs = 4326
  )[[1]]
  line <- sf::st_multilinestring(list(matrix(c(20, 20, 21, 21), ncol = 2, byrow = TRUE)))
  union_result <- sf::st_sfc(line, polygon, crs = 4326)
  local_mocked_bindings(st_union = function(...) union_result, .package = "sf")
  background <- gbifout:::.sdm_background(climate, training, 15, 500)
  expect_equal(nrow(background), 15)
  expect_true(all(abs(background$decimalLongitude) < 4))
  expect_true(all(abs(background$decimalLatitude) < 4))
  second <- sf::st_as_sfc(
    "POLYGON ((10 10, 14 10, 14 14, 10 14, 10 10))", crs = 4326
  )[[1]]
  union_result <- sf::st_sfc(line, polygon, second, crs = 4326)
  background <- gbifout:::.sdm_background(climate, training, 70, 500)
  expect_true(any(background$decimalLongitude > 10))
  expect_true(any(background$decimalLongitude < 4))
  union_result <- sf::st_sfc(line, crs = 4326)
  expect_error(gbifout:::.sdm_background(climate, training, 15, 500), "no polygon area")
})

test_that("accessible backgrounds remain local across the antimeridian", {
  climate <- terra::rast(nrows = 90, ncols = 180, nlyrs = 4,
                          xmin = -180, xmax = 180, ymin = -90, ymax = 90,
                          crs = "EPSG:4326")
  terra::values(climate) <- 1
  names(climate) <- c("bio1", "bio4", "bio12", "bio15")
  training <- data.frame(decimalLongitude = 179, decimalLatitude = 1)
  training$climateCell <- terra::cellFromXY(climate, matrix(c(179, 1), nrow = 1))
  set.seed(1)
  background <- gbifout:::.sdm_background(climate, training, 10, 500)
  points <- sf::st_as_sf(background, coords = c("decimalLongitude", "decimalLatitude"), crs = 4326)
  centre <- sf::st_sfc(sf::st_point(c(179, 1)), crs = 4326)
  expect_true(all(as.numeric(sf::st_distance(points, centre)) < 510000))
  expect_true(any(background$decimalLongitude < -170))
  expect_true(all(abs(background$decimalLongitude) > 170))
})

test_that("SDM validates arguments before making requests", {
  result <- sdm_test_result()
  expect_error(sdm_check(result, sampleSize = 0), "sampleSize")
  expect_error(sdm_check(result, sampleSize = 300), "single GBIF page")
  expect_error(sdm_check(result, backgroundSize = 1), "backgroundSize")
  expect_error(sdm_check(result, bufferKm = Inf), "bufferKm")
  expect_error(sdm_check(result, seed = NA_real_), "seed")
  expect_error(sdm_check(result, basisOfRecord = ""), "basisOfRecord")
  result$data$taxonKey[1] <- "other"
  expect_error(sdm_check(result), "exactly one taxonKey")
})

test_that("missing climate is removed and insufficient distinct training cells stop fitting", {
  skip_if_not_installed("maxnet")
  climate <- sdm_test_climate()
  local_mocked_bindings(
    .sdm_record_coordinates = function(data) {
      data$decimalLongitude <- 0
      data$decimalLatitude <- 0
      data
    },
    .sdm_sample_occurrences = function(taxonKey, polygons, ...) {
      list(data = data.frame(
        gbifid = c("100", "101", "102"),
        decimalLongitude = c(0.5, 0.5, 100),
        decimalLatitude = c(0.5, 0.5, 0), polygonId = 1, group = "ok"
      ), polygons = polygons)
    }, .package = "gbifout"
  )
  set.seed(11)
  previous <- .Random.seed
  expect_warning(expect_error(
    sdm_check(sdm_test_result(), climate = climate), "at least 20.*found 1"
  ), "1 sampled training records removed")
  expect_identical(.Random.seed, previous)
})

test_that("real MaxEnt fit is reproducible, saves reloadable outputs and preserves RNG", {
  skip_if_not_installed("maxnet")
  climate <- sdm_test_climate()
  result <- sdm_test_result()
  xy <- terra::xyFromCell(climate, seq(450, 1150, length.out = 50))
  samples <- data.frame(
    gbifid = as.character(101:150), decimalLongitude = xy[, 1], decimalLatitude = xy[, 2],
    polygonId = rep(1:2, each = 25), group = rep(c("ok", "hdp"), each = 25)
  )
  local_mocked_bindings(
    .sdm_record_coordinates = function(data) {
      data$decimalLongitude <- c(0.5, 10.5)
      data$decimalLatitude <- c(0.5, 10.5)
      data
    },
    .sdm_sample_occurrences = function(taxonKey, polygons, ...) {
      polygons$sampledCount <- c(25L, 25L)
      list(data = samples, polygons = polygons)
    },
    .package = "gbifout"
  )
  directory <- withr::local_tempdir()
  set.seed(99)
  previous <- .Random.seed
  fitted <- sdm_check(result, climate = climate, backgroundSize = 100,
                       outputDir = directory)
  expect_identical(.Random.seed, previous)
  expect_s3_class(fitted$model, "maxnet")
  expect_s3_class(fitted, "gbifout_sdm")
  expect_equal(nrow(fitted$training), 50)
  expect_equal(nrow(fitted$background), 100)
  expect_true(all(is.finite(fitted$data$suitability)))
  expect_true(all(fitted$data$suitability >= 0 & fitted$data$suitability <= 1))
  expect_identical(fitted$data$decision, result$data$decision)
  expect_equal(sum(fitted$polygons$trainingCount), 50)
  saved <- readRDS(file.path(directory, "sdm-check.rds"))
  expect_s3_class(saved, "gbifout_sdm")
  expect_identical(saved$data, fitted$data)
  expect_s3_class(saved$model, "maxnet")
  expect_equal(stats::predict(saved$model, saved$training[, saved$settings$variables],
                              type = "cloglog"), fitted$training$suitability,
               ignore_attr = TRUE)
  expect_true(file.exists(file.path(directory, "sdm-scores.csv")))
  second <- sdm_check(result, climate = climate, backgroundSize = 100)
  expect_equal(second$data$suitability, fitted$data$suitability)
  expect_identical(second$background, fitted$background)
})
