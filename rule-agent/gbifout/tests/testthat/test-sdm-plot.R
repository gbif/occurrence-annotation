sdm_plot_fixture <- function() {
  list(
    data = data.frame(
      decimalLongitude = c(0, 1, 2, NA),
      decimalLatitude = c(0, 1, 2, NA),
      suitability = c(0, 1, NA, NA),
      reviewFlag = c(NA, "high_suitability_SUSPICIOUS", NA, NA)
    ),
    settings = list(taxonKey = "DJX8")
  )
}

sdm_plot_map <- function() {
  map <- terra::rast(nrows = 10, ncols = 10, xmin = -5, xmax = 5,
                      ymin = -5, ymax = 5, crs = "EPSG:4326")
  terra::values(map) <- 0
  map[50] <- 1
  map
}

test_that("SDM map colours score endpoints and highlights flags and unscored records", {
  x <- sdm_plot_fixture()
  calls <- list()
  local_mocked_bindings(
    points = function(...) calls[[length(calls) + 1]] <<- list(...),
    .package = "graphics"
  )
  path <- withr::local_tempfile(fileext = ".pdf")
  grDevices::pdf(path)
  on.exit(grDevices::dev.off(), add = TRUE)
  expect_warning(returned <- plot_sdm(x, map = sdm_plot_map()), "1 records omitted")
  expect_identical(returned, x)
  expect_gte(length(calls), 3)
  expect_identical(calls[[1]]$bg, c("#440154", "#FDE725"))
  expect_equal(calls[[1]][[1]], c(0, 1))
  expect_equal(calls[[2]]$pch, 4)
  expect_equal(calls[[2]][[1]], 2)
  expect_equal(calls[[3]]$pch, 1)
  expect_equal(calls[[3]][[1]], 1)
})

test_that("S3 dispatch works and the default backdrop fetch happens exactly once", {
  x <- sdm_plot_fixture()
  x$data <- x$data[1:2, ]
  class(x) <- c("gbifout_sdm", "list")
  calls <- 0
  local_mocked_bindings(
    fetch_occurrence_density_raster = function(taxonKey, zoom, squareSize, format) {
      calls <<- calls + 1
      expect_identical(taxonKey, "DJX8")
      expect_equal(zoom, 0)
      expect_equal(squareSize, 8)
      expect_identical(format, "@1x.png")
      sdm_plot_map()
    }, .package = "gbifout"
  )
  path <- withr::local_tempfile(fileext = ".pdf")
  grDevices::pdf(path)
  on.exit(grDevices::dev.off(), add = TRUE)
  expect_identical(plot(x), x)
  expect_equal(calls, 1)
  expect_identical(plot(x, map = sdm_plot_map(), xlim = c(-10, 10),
                         ylim = c(-10, 10)), x)
  expect_equal(calls, 1)
})

test_that("empty, unscored and missing-coordinate maps remain plottable", {
  x <- sdm_plot_fixture()
  map <- sdm_plot_map()
  terra::values(map) <- NA_real_
  path <- withr::local_tempfile(fileext = ".pdf")
  grDevices::pdf(path)
  on.exit(grDevices::dev.off(), add = TRUE)
  x$data <- x$data[FALSE, ]
  expect_identical(plot_sdm(x, map = map), x)
  x <- sdm_plot_fixture()
  x$data <- x$data[3, , drop = FALSE]
  expect_identical(plot_sdm(x, map = map), x)
  x$data <- sdm_plot_fixture()$data[4, , drop = FALSE]
  expect_warning(plot_sdm(x, map = map), "1 records omitted")
})

test_that("invalid SDM plotting inputs fail explicitly", {
  x <- sdm_plot_fixture()
  map <- sdm_plot_map()
  expect_error(plot_sdm(list(), map = map), "SDM result")
  expect_error(plot_sdm(x, map = map, cex = 0), "cex")
  x$data$suitability[1] <- 1.1
  expect_error(plot_sdm(x, map = map), "between 0 and 1")
  x <- sdm_plot_fixture()
  expect_error(plot_sdm(x, map = c(map, map)), "single-layer")
  terra::crs(map) <- "EPSG:3857"
  expect_error(plot_sdm(x, map = map), "EPSG:4326")
})
