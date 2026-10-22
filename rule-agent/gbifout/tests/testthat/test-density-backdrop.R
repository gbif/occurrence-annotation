test_that("empty GBIF tiles retain their extent without hiding populated tiles", {
  requests <- list()
  local_mocked_bindings(
    map_fetch = function(...) {
      request <- list(...)
      requests[[length(requests) + 1]] <<- request
      if (length(request$x) > 1 || request$x == 0) {
        stop("The args chosen returned no data. Try smaller x,y values.")
      }
      raster <- terra::rast(nrows = 256, ncols = 256, xmin = 0, xmax = 180,
                             ymin = -90, ymax = 90, crs = "EPSG:4326")
      terra::values(raster) <- 2
      raster
    }, .package = "gbifout"
  )
  map <- gbifout:::fetch_occurrence_density_raster(
    "45MN4", squareSize = 16, format = "@Hx.png", basisOfRecord = "HUMAN_OBSERVATION"
  )
  expect_length(requests, 3)
  expect_equal(as.vector(terra::ext(map)), c(xmin = -180, xmax = 180, ymin = -90, ymax = 90))
  expect_equal(c(terra::nrow(map), terra::ncol(map)), c(256, 512))
  values <- terra::values(map, mat = FALSE)
  xy <- terra::xyFromCell(map, seq_len(terra::ncell(map)))
  expect_true(all(is.na(values[xy[, 1] < 0])))
  expect_true(all(values[xy[, 1] > 0] == 2))
  expect_true(all(vapply(requests, function(request) {
    identical(request$taxonKey, "45MN4") &&
      identical(request$basisOfRecord, "HUMAN_OBSERVATION")
  }, logical(1))))
})

test_that("all-empty GBIF tiles produce a plottable world backdrop", {
  local_mocked_bindings(
    map_fetch = function(...) {
      stop("The args chosen returned no data. Try smaller x,y values.")
    }, .package = "gbifout"
  )
  map <- gbifout:::fetch_occurrence_density_raster("45MN4", format = "@Hx.png")
  expect_true(all(is.na(terra::values(map))))
  expect_equal(as.vector(terra::ext(map)), c(xmin = -180, xmax = 180, ymin = -90, ymax = 90))
  expect_equal(terra::res(map), c(11.25, 11.25))
})

test_that("other map failures are propagated including during tile fallback", {
  local_mocked_bindings(map_fetch = function(...) stop("HTTP 503"),
                         .package = "gbifout")
  expect_error(gbifout:::fetch_occurrence_density_raster("45MN4"), "HTTP 503")
  local_mocked_bindings(map_fetch = function(...) {
    request <- list(...)
    if (length(request$x) > 1) {
      stop("The args chosen returned no data. Try smaller x,y values.")
    }
    stop("connection timed out")
  }, .package = "gbifout")
  expect_error(gbifout:::fetch_occurrence_density_raster("45MN4"), "connection timed out")
})
