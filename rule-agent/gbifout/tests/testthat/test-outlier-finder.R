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

  result <- find_outlier_candidates("taxon", rasterLowQuantile = 0.1)

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

  result <- find_outlier_candidates("taxon", rasterLowQuantile = 0.1)
  expect_length(result$hdp, 1)
  expect_match(result$hdp, "^MULTIPOLYGON")
  geometry <- sf::st_as_sfc(result$hdp, crs = 4326)
  expect_length(geometry[[1]], 2)

  terra::values(raster) <- rep(0, 5)
  terra::values(counts) <- rep(0, 5)
  grid <- list(raster = raster, filledPixelCount = counts)
  expect_identical(find_outlier_candidates("taxon")$hdp, "MULTIPOLYGON EMPTY")
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