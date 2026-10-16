test_that("high occupancy polygons are returned without metadata requests", {
  raster <- terra::rast(nrows = 1, ncols = 4, xmin = 0, xmax = 4,
                        ymin = 0, ymax = 1, crs = "EPSG:4326")
  counts <- raster
  terra::values(raster) <- c(0, 0.1, 0.2, 0.8)
  terra::values(counts) <- c(0, 1, 2, 8)
  grid <- list(raster = raster, filledPixelCount = counts)
  requests <- list()
  local_mocked_bindings(
    build_raster_occupancy_grid = function(...) grid,
    occ_count = function(...) {
      request <- list(...)
      requests[[length(requests) + 1]] <<- request
      if (is.null(request$facet)) return(1)
      data.frame(datasetKey = "dataset", count = 1L)
    },
    .package = "gbifout"
  )

  result <- find_outlier_candidates("taxon")

  expect_identical(result$taxonKey, "taxon")
  expect_length(result$hdp, 1)
  expect_match(result$hdp, "^MULTIPOLYGON")
  expect_equal(result$candidates$filledPixelCount, c(1, 2))
  expect_length(requests, 4)
  high_geometry <- sf::st_as_sfc(result$hdp, crs = 4326)
  expect_equal(unname(sf::st_bbox(high_geometry)[c("xmin", "xmax")]), c(3, 4))
  expect_true(all(vapply(requests, function(request) {
    request$geometry %in% result$candidates$binWkt
  }, logical(1))))
})

test_that("hdp combines multiple high cells and returns an empty multipolygon when absent", {
  raster <- terra::rast(nrows = 1, ncols = 5, xmin = 0, xmax = 5,
                        ymin = 0, ymax = 1, crs = "EPSG:4326")
  counts <- raster
  terra::values(raster) <- c(0.1, 0.8, 0, 0.9, 0)
  terra::values(counts) <- c(1, 8, 0, 9, 0)
  grid <- list(raster = raster, filledPixelCount = counts)
  local_mocked_bindings(
    build_raster_occupancy_grid = function(...) grid,
    occ_count = function(...) {
      if (is.null(list(...)$facet)) return(1)
      data.frame(datasetKey = "dataset", count = 1L)
    },
    .package = "gbifout"
  )

  result <- find_outlier_candidates("taxon", flatCvThreshold = 0.5)
  expect_length(result$hdp, 1)
  expect_match(result$hdp, "^MULTIPOLYGON")
  geometry <- sf::st_as_sfc(result$hdp, crs = 4326)
  expect_length(geometry[[1]], 2)

  terra::values(raster) <- rep(0, 5)
  terra::values(counts) <- rep(0, 5)
  grid <- list(raster = raster, filledPixelCount = counts)
  expect_identical(find_outlier_candidates("taxon")$hdp, "MULTIPOLYGON EMPTY")
})

test_that("count-filtered low cells are retained alongside high cells in hdp", {
  raster <- terra::rast(nrows = 1, ncols = 5, xmin = 0, xmax = 5,
                        ymin = 0, ymax = 1, crs = "EPSG:4326")
  counts <- raster
  terra::values(raster) <- c(0, 0.1, 0.2, 0.3, 0.8)
  terra::values(counts) <- c(0, 1, 2, 3, 8)
  grid <- list(raster = raster, filledPixelCount = counts)
  requests <- list()
  local_mocked_bindings(
    build_raster_occupancy_grid = function(...) grid,
    occ_count = function(...) {
      request <- list(...)
      requests[[length(requests) + 1]] <<- request
      xmin <- unname(sf::st_bbox(sf::st_as_sfc(request$geometry))["xmin"])
      if (!is.null(request$facet)) return(data.frame(datasetKey = "dataset", count = 1L))
      if (xmin == 1) return(30)
      if (xmin == 2) return(31)
      stop("count unavailable")
    },
    .package = "gbifout"
  )

  result <- find_outlier_candidates("taxon", maxOccurrenceCount = 30)
  expect_equal(result$candidates$occurrenceCount, 30)
  expect_equal(result$candidates$filledPixelCount, 1)
  expect_length(requests, 4)
  facet_requests <- Filter(function(request) !is.null(request$facet), requests)
  expect_length(facet_requests, 1)
  expect_identical(facet_requests[[1]]$geometry, result$candidates$binWkt[1])
  expected <- sf::st_as_sfc("POLYGON ((2 0, 5 0, 5 1, 2 1, 2 0))")
  expect_true(sf::st_equals(sf::st_as_sfc(result$hdp), expected, sparse = FALSE)[1, 1])
  expect_match(result$hdp, "^MULTIPOLYGON")

  requests <- list()
  unfiltered <- find_outlier_candidates("taxon", maxOccurrenceCount = NULL)
  expect_equal(nrow(unfiltered$candidates), 3)
  expect_equal(unfiltered$candidates$occurrenceCount, c(30, 31, NA_real_))
  expect_length(requests, 6)
  high <- sf::st_as_sfc("POLYGON ((4 0, 5 0, 5 1, 4 1, 4 0))")
  expect_true(sf::st_equals(sf::st_as_sfc(unfiltered$hdp), high, sparse = FALSE)[1, 1])

  requests <- list()
  excluded <- find_outlier_candidates("taxon", maxOccurrenceCount = 0)
  expect_equal(nrow(excluded$candidates), 0)
  expect_identical(excluded$mp, "MULTIPOLYGON EMPTY")
  expect_length(requests, 3)
  occupied <- sf::st_as_sfc("POLYGON ((1 0, 5 0, 5 1, 1 1, 1 0))")
  expect_true(sf::st_equals(sf::st_as_sfc(excluded$hdp), occupied, sparse = FALSE)[1, 1])
})

test_that("polygon counts and dataset facets use the raster's basis-of-record filter", {
  raster <- terra::rast(nrows = 1, ncols = 3, xmin = 0, xmax = 3,
                        ymin = 0, ymax = 1, crs = "EPSG:4326")
  counts <- raster
  terra::values(raster) <- c(0.1, 0.2, 0.9)
  terra::values(counts) <- c(1, 2, 9)
  grid <- list(raster = raster, filledPixelCount = counts)
  requests <- list()
  local_mocked_bindings(
    build_raster_occupancy_grid = function(...) grid,
    occ_count = function(...) {
      requests[[length(requests) + 1]] <<- list(...)
      if (is.null(list(...)$facet)) return(1)
      data.frame(datasetKey = "dataset", count = 1L)
    },
    .package = "gbifout"
  )
  default_filter <- paste(eval(formals(find_outlier_candidates)$basisOfRecord), collapse = ";")

  find_outlier_candidates("taxon")
  expect_true(length(requests) > 0)
  expect_true(all(vapply(requests, function(request) {
    identical(request$basisOfRecord, default_filter)
  }, logical(1))))
  expect_false(grepl("FOSSIL_SPECIMEN|MATERIAL_CITATION", default_filter))

  requests <- list()
  find_outlier_candidates("taxon",
                          basisOfRecord = c(" HUMAN_OBSERVATION ", "OBSERVATION", "OBSERVATION"))
  expect_true(all(vapply(requests, function(request) {
    identical(request$basisOfRecord, "HUMAN_OBSERVATION;OBSERVATION")
  }, logical(1))))

  requests <- list()
  find_outlier_candidates("taxon", basisOfRecord = NULL)
  expect_true(all(vapply(requests, function(request) is.null(request$basisOfRecord), logical(1))))
})

test_that("a fossil-heavy cell stays a candidate when only non-fossil records are counted", {
  raster <- terra::rast(nrows = 1, ncols = 2, xmin = 0, xmax = 2,
                        ymin = 0, ymax = 1, crs = "EPSG:4326")
  counts <- raster
  terra::values(raster) <- c(0.015625, 0.9)
  terra::values(counts) <- c(1, 9)
  grid <- list(raster = raster, filledPixelCount = counts)
  local_mocked_bindings(
    build_raster_occupancy_grid = function(...) grid,
    occ_count = function(...) {
      request <- list(...)
      if (!is.null(request$facet)) return(data.frame(datasetKey = "dataset", count = 1L))
      # Unfiltered totals include fossils; the filtered total is the one record.
      if (is.null(request$basisOfRecord)) 2440 else 1
    },
    .package = "gbifout"
  )
  result <- find_outlier_candidates("taxon")
  expect_equal(nrow(result$candidates), 1)
  expect_equal(result$candidates$occurrenceCount, 1)
  # Only the dense second cell is in hdp, not the fossil-heavy first one.
  expect_equal(as.numeric(sf::st_bbox(sf::st_as_sfc(result$hdp, crs = 4326)))[c(1, 3)], c(1, 2))
})

test_that("CV and its threshold alone set both selectors' quantile", {
  raster <- terra::rast(nrows = 1, ncols = 7, xmin = 0, xmax = 7,
                        ymin = 0, ymax = 1, crs = "EPSG:4326")
  counts <- raster
  filled <- c(30, 31, 32, 33, 34, 0, NA)
  terra::values(raster) <- filled / 64
  terra::values(counts) <- filled
  grid <- list(raster = raster, filledPixelCount = counts)
  local_mocked_bindings(
    build_raster_occupancy_grid = function(...) grid,
    occ_count = function(...) {
      request <- list(...)
      if (!is.null(request$facet)) return(data.frame(datasetKey = "dataset", count = 1L))
      xmin <- as.numeric(sf::st_bbox(sf::st_as_sfc(request$geometry)))[1]
      if (xmin == 0) 31 else 1
    },
    .package = "gbifout"
  )

  expected_cv <- stats::sd(filled[1:5]) / mean(filled[1:5])
  adapted <- find_outlier_candidates("taxon", maxFilledPixels = NULL,
                                     maxOccurrenceCount = NULL)
  lower_threshold <- find_outlier_candidates("taxon", maxFilledPixels = NULL,
                                             maxOccurrenceCount = NULL,
                                             flatCvThreshold = expected_cv / 2)
  expect_equal(adapted$occupancyCv, expected_cv)
  expect_equal(adapted$effectiveQuantile, 1)
  expect_equal(lower_threshold$effectiveQuantile, 0.5)
  expect_equal(nrow(lower_threshold$candidates), 3)
  expect_equal(nrow(adapted$candidates), 5)
  expect_identical(adapted$hdp, "MULTIPOLYGON EMPTY")

  at_threshold <- find_outlier_candidates("taxon", maxFilledPixels = NULL,
                                          maxOccurrenceCount = NULL,
                                          flatCvThreshold = expected_cv)
  expect_equal(at_threshold$effectiveQuantile, 1)
  expect_equal(nrow(at_threshold$candidates), 5)
  expect_identical(at_threshold$hdp, "MULTIPOLYGON EMPTY")
  just_above <- find_outlier_candidates("taxon", maxFilledPixels = NULL,
                                        maxOccurrenceCount = NULL,
                                        flatCvThreshold = expected_cv * 0.99)
  expect_equal(just_above$effectiveQuantile, 0.01)
  expect_equal(nrow(just_above$candidates), 1)
  expect_equal(as.numeric(sf::st_bbox(sf::st_as_sfc(just_above$hdp)))[c(1, 3)], c(1, 5))

  terra::values(raster) <- c(rep(0.5, 5), 0, NA)
  terra::values(counts) <- c(rep(32, 5), 0, NA)
  grid <- list(raster = raster, filledPixelCount = counts)
  constant <- find_outlier_candidates("taxon", maxFilledPixels = NULL,
                                      maxOccurrenceCount = NULL)
  expect_equal(constant$occupancyCv, 0)
  expect_equal(constant$effectiveQuantile, 1)
  expect_equal(nrow(constant$candidates), 5)
  expect_identical(constant$hdp, "MULTIPOLYGON EMPTY")
  filtered <- find_outlier_candidates("taxon", maxFilledPixels = NULL, maxOccurrenceCount = 30)
  expect_equal(nrow(filtered$candidates), 4)
  expect_equal(as.numeric(sf::st_bbox(sf::st_as_sfc(filtered$hdp)))[c(1, 3)], c(0, 1))

  terra::values(raster) <- c(0.01, 0.05, 0.2, 0.5, 1, 0, NA)
  grid <- list(raster = raster, filledPixelCount = counts)
  varied <- find_outlier_candidates("taxon", maxFilledPixels = NULL)
  expect_gt(varied$occupancyCv, 0.8)
  expect_equal(varied$effectiveQuantile, 1 - 0.8 / varied$occupancyCv)
  expect_equal(nrow(varied$candidates), 2)
  expect_equal(varied$candidates$binPercentage, c(1, 5))
  expect_equal(as.numeric(sf::st_bbox(sf::st_as_sfc(varied$hdp)))[c(1, 3)], c(2, 5))
})

test_that("a sparse four-pixel maximum becomes a candidate under the flatness threshold", {
  raster <- terra::rast(nrows = 1, ncols = 5, xmin = 0, xmax = 5,
                        ymin = 0, ymax = 1, crs = "EPSG:4326")
  counts <- raster
  terra::values(counts) <- c(1, 1, 2, 3, 4)
  terra::values(raster) <- c(1, 1, 2, 3, 4) / 64
  grid <- list(raster = raster, filledPixelCount = counts)
  local_mocked_bindings(
    build_raster_occupancy_grid = function(...) grid,
    occ_count = function(...) {
      if (is.null(list(...)$facet)) return(10)
      data.frame(datasetKey = "dataset", count = 10L)
    },
    .package = "gbifout"
  )
  result <- find_outlier_candidates("taxon")
  expect_lte(result$occupancyCv, 0.8)
  expect_equal(result$effectiveQuantile, 1)
  expect_equal(result$candidates$filledPixelCount, c(1, 1, 2, 3, 4))
  expect_equal(result$candidates$occurrenceCount, rep(10, 5))
  expect_identical(result$hdp, "MULTIPOLYGON EMPTY")
})

test_that("adaptive quantile handles empty and singleton grids and validates inputs early", {
  raster <- terra::rast(nrows = 1, ncols = 2, xmin = 0, xmax = 2,
                        ymin = 0, ymax = 1, crs = "EPSG:4326")
  counts <- raster
  terra::values(raster) <- c(0.5, 0)
  terra::values(counts) <- c(32, 0)
  grid <- list(raster = raster, filledPixelCount = counts)
  local_mocked_bindings(
    build_raster_occupancy_grid = function(...) grid,
    occ_count = function(...) {
      if (is.null(list(...)$facet)) return(1)
      data.frame(datasetKey = "dataset", count = 1L)
    },
    .package = "gbifout"
  )
  single <- find_outlier_candidates("taxon")
  expect_equal(single$occupancyCv, 0)
  expect_equal(single$effectiveQuantile, 1)
  expect_equal(nrow(single$candidates), 1)
  terra::values(raster) <- c(0, NA)
  terra::values(counts) <- c(0, NA)
  grid <- list(raster = raster, filledPixelCount = counts)
  empty <- find_outlier_candidates("taxon")
  expect_true(is.na(empty$occupancyCv))
  expect_equal(empty$effectiveQuantile, 1)
  expect_equal(nrow(empty$candidates), 0)
  expect_identical(empty$hdp, "MULTIPOLYGON EMPTY")

  local_mocked_bindings(build_raster_occupancy_grid = function(...) stop("must not fetch"),
                        .package = "gbifout")
  for (threshold in list(NULL, 0, -1, NA_real_, Inf, c(0.1, 0.2), "flat")) {
    expect_error(find_outlier_candidates("taxon", flatCvThreshold = threshold), "flatCvThreshold")
  }
  expect_false("rasterLowQuantile" %in% names(formals(find_outlier_candidates)))
})

test_that("high occupancy output excludes empty cells and ties at the cutoff", {
  raster <- terra::rast(nrows = 1, ncols = 2, xmin = 0, xmax = 2,
                        ymin = 0, ymax = 1, crs = "EPSG:4326")
  counts <- raster
  terra::values(raster) <- c(0, 0)
  terra::values(counts) <- c(0, 0)
  grid <- list(raster = raster, filledPixelCount = counts)
  expect_identical(gbifout:::.high_occupancy_polygons(
    grid, 0.5, 3, FALSE, "unused"
  ), character(0))

  terra::values(raster) <- c(0.5, 0.5)
  terra::values(counts) <- c(5, 5)
  expect_identical(gbifout:::.high_occupancy_polygons(
    grid, 0.5, NULL, FALSE, "unused"
  ), character(0))
})