square <- function(xmin, xmax) {
  sprintf("MULTIPOLYGON (((%s 0, %s 0, %s 1, %s 1, %s 0)))", xmin, xmax, xmax, xmin, xmin)
}
point_inside <- function(wkt, lon, lat, planar = FALSE) {
  if (planar) {
    previous <- suppressMessages(sf::sf_use_s2(FALSE))
    on.exit(suppressMessages(sf::sf_use_s2(previous)))
  }
  suppressMessages(sf::st_intersects(
    sf::st_as_sfc(wkt, crs = 4326),
    sf::st_sfc(sf::st_point(c(lon, lat)), crs = 4326),
    sparse = FALSE
  ))[1, 1]
}

test_that("ok and hdp are combined, overlaps dissolved, and the union buffered", {
  result <- list(ok = square(0, 2), hdp = square(1, 3))
  out <- ok_buffer(result, bufferKm = 500)

  expect_identical(names(out), c("combined", "buffered", "inverted"))
  expect_match(out$combined, "^MULTIPOLYGON")
  expect_match(out$buffered, "^MULTIPOLYGON")
  combined <- sf::st_as_sfc(out$combined, crs = 4326)
  expect_length(combined[[1]], 1)
  expect_equal(as.numeric(sf::st_bbox(combined)), c(0, 0, 3, 1))
  # Planar union keeps cell edges on their original latitudes.
  expect_true(all(sf::st_coordinates(combined)[, "Y"] %in% c(0, 1)))
  # About 4 degrees (~440 km) from the union's edge is inside; ~6 degrees (~660 km) is not.
  expect_true(point_inside(out$buffered, 7, 0.5))
  expect_false(point_inside(out$buffered, 9.5, 0.5))
})

test_that("buffer distance follows bufferKm and disjoint inputs stay combined", {
  result <- list(ok = square(0, 1), hdp = square(40, 41))
  small <- ok_buffer(result, bufferKm = 100)
  expect_length(sf::st_as_sfc(small$combined, crs = 4326)[[1]], 2)
  expect_true(point_inside(small$buffered, 1.5, 0.5))
  expect_false(point_inside(small$buffered, 3, 0.5))
  expect_true(point_inside(ok_buffer(result, bufferKm = 500)$buffered, 4, 0.5))
})

test_that("either input can be empty and both empty returns empty output", {
  only_ok <- ok_buffer(list(ok = square(0, 1), hdp = "MULTIPOLYGON EMPTY"), 100)
  expect_equal(as.numeric(sf::st_bbox(sf::st_as_sfc(only_ok$combined, crs = 4326))),
               c(0, 0, 1, 1))
  only_hdp <- ok_buffer(list(ok = "MULTIPOLYGON EMPTY", hdp = square(0, 1)), 100)
  expect_match(only_hdp$buffered, "^MULTIPOLYGON")

  none <- ok_buffer(list(ok = "MULTIPOLYGON EMPTY", hdp = "MULTIPOLYGON EMPTY"))
  expect_identical(none, list(combined = "MULTIPOLYGON EMPTY", buffered = "MULTIPOLYGON EMPTY",
                              inverted = "MULTIPOLYGON EMPTY"))
})

test_that("s2 setting is restored and invalid inputs stop", {
  previous <- suppressMessages(sf::sf_use_s2(FALSE))
  on.exit(suppressMessages(sf::sf_use_s2(previous)), add = TRUE)
  ok_buffer(list(ok = square(0, 1), hdp = "MULTIPOLYGON EMPTY"), 10)
  expect_false(sf::sf_use_s2())

  valid <- list(ok = square(0, 1), hdp = "MULTIPOLYGON EMPTY")
  expect_error(ok_buffer(valid, bufferKm = 0), "bufferKm")
  expect_error(ok_buffer(valid, bufferKm = NA), "bufferKm")
  expect_error(ok_buffer(valid, simplifyRounds = -1), "simplifyRounds")
  expect_error(ok_buffer(valid, simplifyRounds = 1.5), "simplifyRounds")
  expect_error(ok_buffer(valid, simplifyRounds = NA), "simplifyRounds")
  expect_error(ok_buffer(list(ok = "MULTIPOLYGON EMPTY")), "pipeline")
  expect_error(ok_buffer(data.frame()), "pipeline")
})

test_that("alternate vertices are dropped and tiny rings are kept", {
  octagon <- rbind(c(1, 0), c(2, 0), c(3, 1), c(3, 2), c(2, 3), c(1, 3), c(0, 2), c(0, 1), c(1, 0))
  thinned <- gbifout:::.drop_alternate_vertices(
    sf::st_sfc(sf::st_multipolygon(list(list(octagon))), crs = 4326)
  )
  expect_equal(unname(sf::st_coordinates(thinned)[, c("X", "Y")]),
               rbind(c(1, 0), c(3, 1), c(2, 3), c(0, 2), c(1, 0)))

  # Only two vertices would remain, so the original square is kept.
  square_ring <- rbind(c(0, 0), c(1, 0), c(1, 1), c(0, 1), c(0, 0))
  kept <- gbifout:::.drop_alternate_vertices(
    sf::st_sfc(sf::st_multipolygon(list(list(square_ring))), crs = 4326)
  )
  expect_equal(unname(sf::st_coordinates(kept)[, c("X", "Y")]), square_ring)
})

test_that("buffered output has fewer vertices than a plain buffer and stays valid", {
  out <- ok_buffer(list(ok = square(0, 2), hdp = square(1, 3)), bufferKm = 500)

  plain <- sf::st_buffer(sf::st_as_sfc(square(0, 3), crs = 4326), dist = 500000)
  buffered <- sf::st_as_sfc(out$buffered, crs = 4326)
  expect_lt(nrow(sf::st_coordinates(buffered)), 0.6 * nrow(sf::st_coordinates(plain)))
  expect_true(sf::st_is_valid(buffered))
  expect_match(out$buffered, "^MULTIPOLYGON")
  expect_true(point_inside(out$buffered, 7, 0.5))
  expect_false(point_inside(out$buffered, 9.5, 0.5))
})

test_that("simplifyRounds controls how many times vertices are halved", {
  result <- list(ok = square(0, 2), hdp = square(1, 3))
  vertices <- function(rounds) {
    out <- if (missing(rounds)) ok_buffer(result) else ok_buffer(result, simplifyRounds = rounds)
    nrow(sf::st_coordinates(sf::st_as_sfc(out$buffered, crs = 4326)))
  }
  plain <- nrow(sf::st_coordinates(
    sf::st_buffer(sf::st_as_sfc(square(0, 3), crs = 4326), dist = 500000)
  ))

  expect_equal(vertices(0), plain)
  expect_lt(vertices(1), vertices(0))
  expect_lt(vertices(2), vertices(1))
  expect_lt(vertices(3), vertices(2))
  expect_lt(vertices(4), vertices(3))
  expect_equal(vertices(), vertices(4))
  expect_lt(vertices(4), 0.1 * plain)
})

test_that("simplified buffers stay one valid polygon near the antimeridian and pole", {
  shapes <- c(
    "MULTIPOLYGON (((170 -10, 179.9 -10, 179.9 -5, 170 -5, 170 -10)))",
    "MULTIPOLYGON (((0 80, 10 80, 10 85, 0 85, 0 80)))"
  )
  for (shape in shapes) {
    for (rounds in c(1, 3, 5)) {
      out <- ok_buffer(list(ok = shape, hdp = "MULTIPOLYGON EMPTY"), 500, rounds)
      buffered <- sf::st_as_sfc(out$buffered, crs = 4326)
      expect_true(sf::st_is_valid(buffered))
      expect_length(buffered[[1]], 1)
    }
  }
})

planar <- function(code) {
  previous <- suppressMessages(sf::sf_use_s2(FALSE))
  on.exit(suppressMessages(sf::sf_use_s2(previous)))
  code
}

test_that("inverted is the world rectangle with the buffer cut out", {
  out <- ok_buffer(list(ok = square(10, 12), hdp = "MULTIPOLYGON EMPTY"), 200)
  inverted <- sf::st_as_sfc(out$inverted, crs = 4326)
  rings <- inverted[[1]]

  expect_match(out$inverted, "^POLYGON \\(\\(-180 -85\\.0511287798, 180 -85\\.0511287798, 180 85\\.0511287798, -180 85\\.0511287798, -180 -85\\.0511287798\\), \\(")
  expect_length(rings, 2)
  expect_equal(unname(rings[[1]][1, ]), c(-180, -85.0511287798))
  signed_area <- function(ring) {
    sum(head(ring[, 1], -1) * ring[-1, 2][seq_len(nrow(ring) - 1)] -
          ring[-1, 1][seq_len(nrow(ring) - 1)] * head(ring[, 2], -1)) / 2
  }
  expect_gt(signed_area(rings[[1]]), 0)
  expect_lt(signed_area(rings[[2]]), 0)
  expect_true(planar(sf::st_is_valid(inverted)))
  buffered <- sf::st_as_sfc(out$buffered, crs = 4326)
  expect_equal(as.numeric(sf::st_bbox(buffered)),
               as.numeric(sf::st_bbox(sf::st_polygon(list(rings[[2]])))), tolerance = 1e-6)
  expect_false(point_inside(out$inverted, 11, 0.5, planar = TRUE))
  expect_true(point_inside(out$inverted, 100, 40, planar = TRUE))
})

test_that("inverted splits buffers at the antimeridian and clips at the map edge", {
  across <- ok_buffer(list(ok = "MULTIPOLYGON (((170 -10, 179.9 -10, 179.9 -5, 170 -5, 170 -10)))",
                           hdp = "MULTIPOLYGON EMPTY"), 500)
  inverted <- sf::st_as_sfc(across$inverted, crs = 4326)
  expect_true(planar(sf::st_is_valid(inverted)))
  expect_equal(as.numeric(sf::st_bbox(inverted)), c(-180, -85.0511287798, 180, 85.0511287798))
  expect_false(point_inside(across$inverted, 179.95, -7, planar = TRUE))
  expect_false(point_inside(across$inverted, -179.95, -7, planar = TRUE))
  expect_true(point_inside(across$inverted, 0, -7, planar = TRUE))

  north <- ok_buffer(list(ok = "MULTIPOLYGON (((0 80, 10 80, 10 85, 0 85, 0 80)))",
                          hdp = "MULTIPOLYGON EMPTY"), 500)
  clipped <- sf::st_as_sfc(north$inverted, crs = 4326)
  expect_true(planar(sf::st_is_valid(clipped)))
  expect_lte(max(sf::st_coordinates(clipped)[, "Y"]), 85.0511287798)
  expect_false(point_inside(north$inverted, 5, 84, planar = TRUE))
})
