pipeline_plot_fixture <- function() {
  polygon <- "MULTIPOLYGON (((0 0, 2 0, 2 2, 0 2, 0 0)))"
  list(data = data.frame(taxonKey = "DJX8", decision = c("OK", "SUSPICIOUS")),
        ok = polygon, int = "MULTIPOLYGON EMPTY", sus = polygon,
        hdp = "MULTIPOLYGON (((4 4, 6 4, 6 6, 4 6, 4 4)))")
}

pipeline_plot_map <- function() {
  map <- terra::rast(nrows = 10, ncols = 10, xmin = -5, xmax = 10,
                      ymin = -5, ymax = 10, crs = "EPSG:4326")
  terra::values(map) <- 0
  map[50] <- 1
  map
}

test_that("legacy pipeline lists plot all decision groups including overlapping polygons", {
  x <- pipeline_plot_fixture()
  x$int <- x$ok
  path <- withr::local_tempfile(fileext = ".pdf")
  grDevices::pdf(path)
  on.exit(grDevices::dev.off(), add = TRUE)
  expect_identical(plot_pipeline(x, map = pipeline_plot_map()), x)
  expect_identical(plot_pipeline(x, map = pipeline_plot_map(),
                                  xlim = c(-10, 10), ylim = c(-10, 10)), x)
})

test_that("pipeline S3 plotting fetches only the map and survives RDS reload", {
  x <- pipeline_plot_fixture()
  class(x) <- c("gbifout_pipeline", "list")
  file <- withr::local_tempfile(fileext = ".rds")
  saveRDS(x, file)
  x <- readRDS(file)
  calls <- 0
  local_mocked_bindings(
    fetch_occurrence_density_raster = function(taxonKey, zoom, squareSize, format) {
      calls <<- calls + 1
      expect_identical(taxonKey, "DJX8")
      expect_equal(zoom, 0)
      expect_equal(squareSize, 8)
      expect_identical(format, "@1x.png")
      pipeline_plot_map()
    },
    out_cand = function(...) stop("must not discover"),
    occ_fetch_unique = function(...) stop("must not fetch records"),
    assess_occurrence_record = function(...) stop("must not assess"),
    .package = "gbifout"
  )
  path <- withr::local_tempfile(fileext = ".pdf")
  grDevices::pdf(path)
  on.exit(grDevices::dev.off(), add = TRUE)
  expect_identical(plot(x), x)
  expect_equal(calls, 1)
  expect_identical(plot(x, map = pipeline_plot_map()), x)
  expect_equal(calls, 1)
})

test_that("empty pipeline layers and missing taxon work with a supplied empty map", {
  x <- pipeline_plot_fixture()
  x$data <- data.frame(decision = character())
  x[c("ok", "int", "sus", "hdp")] <- rep(list("MULTIPOLYGON EMPTY"), 4)
  map <- pipeline_plot_map()
  terra::values(map) <- NA_real_
  path <- withr::local_tempfile(fileext = ".pdf")
  grDevices::pdf(path)
  on.exit(grDevices::dev.off(), add = TRUE)
  expect_identical(plot_pipeline(x, map = map), x)
  expect_error(plot_pipeline(x), "Supply map")
})

test_that("malformed pipeline geometries and maps are rejected explicitly", {
  x <- pipeline_plot_fixture()
  map <- pipeline_plot_map()
  expect_error(plot_pipeline(list(), map = map), "pipeline result")
  x$ok <- "POINT (0 0)"
  expect_error(plot_pipeline(x, map = map), "valid POLYGON")
  x$ok <- NA_character_
  expect_error(plot_pipeline(x, map = map), "single polygon WKT")
  x <- pipeline_plot_fixture()
  expect_error(plot_pipeline(x, map = c(map, map)), "single-layer")
  terra::crs(map) <- "EPSG:3857"
  expect_error(plot_pipeline(x, map = map), "EPSG:4326")
})
