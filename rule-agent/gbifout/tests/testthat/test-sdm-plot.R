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

test_that("prediction surfaces plot offline including after portable serialization", {
  x <- sdm_plot_fixture()
  x$data <- x$data[FALSE, ]
  x$prediction <- sdm_plot_map()
  terra::values(x$prediction) <- seq(0, 1, length.out = terra::ncell(x$prediction))
  class(x) <- c("gbifout_sdm", "list")
  local_mocked_bindings(
    fetch_occurrence_density_raster = function(...) stop("Unexpected network request"),
    .package = "gbifout"
  )
  plotted <- list()
  original_plot <- terra::plot
  plotting <- FALSE
  local_mocked_bindings(
    plot = function(x, ...) {
      if (plotting) return(original_plot(x, ...))
      plotting <<- TRUE
      on.exit(plotting <<- FALSE)
      if (inherits(x, "SpatRaster")) plotted[[length(plotted) + 1]] <<- x
      original_plot(x, ...)
    }, .package = "terra"
  )
  path <- withr::local_tempfile(fileext = ".pdf")
  grDevices::pdf(path)
  on.exit(grDevices::dev.off(), add = TRUE)
  expect_identical(plot(x), x)
  expect_length(plotted, 1)
  expect_equal(terra::values(plotted[[1]]), terra::values(x$prediction))
  packed <- x
  packed$prediction <- terra::wrap(x$prediction, proxy = FALSE)
  saved <- withr::local_tempfile(fileext = ".rds")
  saveRDS(packed, saved)
  restored <- readRDS(saved)
  expect_identical(plot(restored), restored)
  expect_equal(terra::values(plotted[[2]]), terra::values(x$prediction))
  expect_identical(plot(x, map = sdm_plot_map()), x)
  expect_length(plotted, 4)
  expect_equal(terra::values(plotted[[4]]), terra::values(x$prediction))
  terra::values(x$prediction) <- NA_real_
  expect_identical(plot(x), x)
})

test_that("default view fits informative raster cells and points rather than empty margins", {
  x <- sdm_plot_fixture()
  x$data <- x$data[FALSE, ]
  x$prediction <- terra::rast(nrows = 180, ncols = 360, xmin = -180, xmax = 180,
                              ymin = -90, ymax = 90, crs = "EPSG:4326")
  terra::values(x$prediction) <- NA_real_
  cells <- terra::cellFromXY(x$prediction, rbind(c(10.5, 20.5), c(12.5, 22.5)))
  x$prediction[cells] <- c(0, 0.8)
  class(x) <- c("gbifout_sdm", "list")
  original <- terra::values(x$prediction)
  window <- NULL
  original_window <- graphics::plot.window
  local_mocked_bindings(
    plot.window = function(...) {
      window <<- list(...)
      original_window(...)
    }, .package = "graphics"
  )
  path <- withr::local_tempfile(fileext = ".pdf")
  grDevices::pdf(path)
  on.exit(grDevices::dev.off(), add = TRUE)
  expect_identical(plot(x), x)
  expect_equal(window$xlim, c(8, 15))
  expect_equal(window$ylim, c(18, 25))
  expect_identical(terra::values(x$prediction), original)

  x$data <- sdm_plot_fixture()$data[1, , drop = FALSE]
  x$data$decimalLongitude <- 30
  x$data$decimalLatitude <- 40
  plot(x)
  expect_lt(window$xlim[1], 10)
  expect_gt(window$xlim[2], 30)
  expect_lt(window$ylim[1], 20)
  expect_gt(window$ylim[2], 40)
  terra::values(x$prediction) <- NA_real_
  plot(x)
  expect_equal(window$xlim, c(28, 32))
  expect_equal(window$ylim, c(38, 42))
  plot(x, xlim = c(-50, 50), ylim = c(-60, 60))
  expect_equal(window$xlim, c(-50, 50))
  expect_equal(window$ylim, c(-60, 60))
  x$data <- x$data[FALSE, ]
  expect_identical(plot(x), x)
  expect_equal(window$xlim, c(-180, 180))
  expect_equal(window$ylim, c(-90, 90))
})

test_that("invalid prediction rasters fail rather than falling back to coverage", {
  x <- sdm_plot_fixture()
  x$prediction <- sdm_plot_map()
  terra::values(x$prediction) <- 1.1
  expect_error(plot_sdm(x), "Raster suitability")
  terra::values(x$prediction) <- Inf
  expect_error(plot_sdm(x), "Raster suitability")
  x$prediction <- c(sdm_plot_map(), sdm_plot_map())
  expect_error(plot_sdm(x), "prediction must be a single-layer")
  x$prediction <- sdm_plot_map()
  terra::crs(x$prediction) <- "EPSG:3857"
  expect_error(plot_sdm(x), "prediction must be a single-layer")
})

test_that("saved suitability polygons are outlined with their threshold and empty ones are omitted", {
  x <- sdm_plot_fixture()
  x$data <- x$data[FALSE, ]
  x$prediction <- sdm_plot_map()
  terra::values(x$prediction) <- seq(0, 1, length.out = terra::ncell(x$prediction))
  x$suitabilityPolygon <- gbifout:::.sdm_suitability_polygon(x$prediction, 0.7)
  x$settings$suitabilityThreshold <- 0.7
  class(x) <- c("gbifout_sdm", "list")
  calls <- list()
  legend <- NULL
  original_plot <- terra::plot
  plotting <- FALSE
  local_mocked_bindings(plot = function(x, ...) {
    if (plotting) return(original_plot(x, ...))
    plotting <<- TRUE
    on.exit(plotting <<- FALSE)
    calls[[length(calls) + 1]] <<- list(x = x, ...)
    original_plot(x, ...)
  }, .package = "terra")
  local_mocked_bindings(legend = function(...) legend <<- list(...),
                         .package = "graphics")
  path <- withr::local_tempfile(fileext = ".pdf")
  grDevices::pdf(path)
  on.exit(grDevices::dev.off(), add = TRUE)
  x$prediction <- terra::wrap(x$prediction, proxy = FALSE)
  saved <- withr::local_tempfile(fileext = ".rds")
  saveRDS(x, saved)
  x <- readRDS(saved)
  expect_identical(plot(x), x)
  expect_length(calls, 3)
  expect_s4_class(calls[[3]]$x, "SpatVector")
  expect_identical(calls[[3]]$border, "black")
  expect_true(is.na(calls[[3]]$col))
  expect_equal(calls[[3]]$lwd, 2)
  index <- match("Suitability >= 0.7", legend$legend)
  expect_false(is.na(index))
  expect_equal(legend$lty[index], 1)
  expect_equal(sf::st_as_text(sf::st_cast(
    sf::st_geometry(sf::st_as_sf(calls[[3]]$x)), "MULTIPOLYGON"
  )), x$suitabilityPolygon)
  calls <- list()
  x$suitabilityPolygon <- "MULTIPOLYGON EMPTY"
  expect_identical(plot(x), x)
  expect_length(calls, 2)
  expect_false(any(grepl("Suitability >=", legend$legend)))
  x$suitabilityPolygon <- "POINT (0 0)"
  expect_error(plot(x), "polygon geometry")
  x$suitabilityPolygon <- c("MULTIPOLYGON EMPTY", "MULTIPOLYGON EMPTY")
  expect_error(plot(x), "single polygon WKT")
})

test_that("training points are retained but do not add markers, legend entries or plot extent", {
  x <- sdm_plot_fixture()
  x$data <- x$data[1:2, ]
  x$prediction <- sdm_plot_map()
  x$training <- data.frame(
    decimalLongitude = c(-30, 40, -30), decimalLatitude = c(-20, 25, -20),
    group = c("ok", "hdp", "ok")
  )
  class(x) <- c("gbifout_sdm", "list")
  calls <- list()
  window <- NULL
  subtitle <- NULL
  legend <- NULL
  original_window <- graphics::plot.window
  local_mocked_bindings(
    points = function(...) calls[[length(calls) + 1]] <<- list(...),
    plot.window = function(...) {
      window <<- list(...)
      original_window(...)
    },
    title = function(...) subtitle <<- list(...)$sub,
    legend = function(...) legend <<- list(...),
    .package = "graphics"
  )
  local_mocked_bindings(
    fetch_occurrence_density_raster = function(...) stop("Unexpected network request"),
    .package = "gbifout"
  )
  path <- withr::local_tempfile(fileext = ".pdf")
  grDevices::pdf(path)
  on.exit(grDevices::dev.off(), add = TRUE)
  expect_identical(plot(x, cex = 2), x)
  expect_length(calls, 2)
  expect_equal(calls[[1]][[1]], c(0, 1))
  expect_equal(calls[[1]][[2]], c(0, 1))
  expect_equal(calls[[1]]$pch, 21)
  expect_equal(calls[[1]]$cex, 2)
  expect_equal(calls[[2]]$pch, 1)
  expect_gt(window$xlim[1], -30)
  expect_lt(window$xlim[2], 40)
  expect_gt(window$ylim[1], -20)
  expect_lt(window$ylim[2], 25)
  expect_false(grepl("training", subtitle, ignore.case = TRUE))
  expect_false(any(grepl("Training:", legend$legend)))
  saved <- withr::local_tempfile(fileext = ".rds")
  x$prediction <- terra::wrap(x$prediction, proxy = FALSE)
  saveRDS(x, saved)
  calls <- list()
  restored <- readRDS(saved)
  expect_identical(plot(restored), restored)
  expect_length(calls, 2)
  expect_equal(calls[[1]][[1]], c(0, 1))
  expect_identical(restored$training, x$training)
})

test_that("plotting does not require or validate unused training data", {
  x <- sdm_plot_fixture()
  x$data <- x$data[FALSE, ]
  x$prediction <- sdm_plot_map()
  x$training <- data.frame(
    decimalLongitude = c(0, NA, 181), decimalLatitude = c(0, 0, 0),
    group = c("ok", "hdp", "ok")
  )
  calls <- list()
  local_mocked_bindings(
    points = function(...) calls[[length(calls) + 1]] <<- list(...),
    legend = function(...) invisible(NULL),
    .package = "graphics"
  )
  path <- withr::local_tempfile(fileext = ".pdf")
  grDevices::pdf(path)
  on.exit(grDevices::dev.off(), add = TRUE)
  expect_identical(plot_sdm(x), x)
  expect_length(calls, 0)
  x$training <- x$training[FALSE, ]
  expect_identical(plot_sdm(x), x)
  x$training <- data.frame(decimalLongitude = 0, decimalLatitude = 0, group = "sus")
  expect_identical(plot_sdm(x), x)
  x$training$group <- NA_character_
  expect_identical(plot_sdm(x), x)
  x$training <- list()
  expect_identical(plot_sdm(x), x)
})
