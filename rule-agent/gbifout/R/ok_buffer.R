#' Combine, union, and buffer the OK and high-occupancy polygons
#'
#' Merges the `ok` and `hdp` multipolygons from a `pipeline()` result, dissolves
#' overlaps into one geometry, and buffers it by a geodesic distance.
#'
#' @param result the list returned by `pipeline()`.
#' @param bufferKm buffer distance in kilometres (default 500).
#' @param simplifyRounds rounds of removing every other vertex from the buffered
#'   polygon (default 4); each round roughly halves the vertex count. Use 0 to
#'   skip simplification.
#' @return A list with `combined`, the unioned MULTIPOLYGON WKT of `ok` and
#'   `hdp`, and `buffered`, that geometry buffered by `bufferKm` and simplified by
#'   removing every other vertex from each ring `simplifyRounds` times. `inverted`
#'   is the world rectangle (-180 to 180, +/-85.0511287798) with `buffered` cut out as
#'   holes, as a POLYGON or MULTIPOLYGON WKT with a counter-clockwise outer ring
#'   and clockwise holes; buffers crossing the antimeridian are split there and
#'   buffers beyond the map extent are clipped to it. All three are
#'   `"MULTIPOLYGON EMPTY"` when `ok` and `hdp` are both empty.
#' @export
ok_buffer <- function(result, bufferKm = 500, simplifyRounds = 4) {
  if (!is.list(result) || !all(c("ok", "hdp") %in% names(result)) ||
      !is.character(result$ok) || !is.character(result$hdp) ||
      length(result$ok) != 1 || length(result$hdp) != 1 ||
      is.na(result$ok) || is.na(result$hdp)) {
    stop("result must be a pipeline() result with single ok and hdp WKT strings.")
  }
  if (!is.numeric(bufferKm) || length(bufferKm) != 1 || is.na(bufferKm) ||
      !is.finite(bufferKm) || bufferKm <= 0) {
    stop("bufferKm must be a positive number of kilometres.")
  }
  if (!is.numeric(simplifyRounds) || length(simplifyRounds) != 1 ||
      is.na(simplifyRounds) || !is.finite(simplifyRounds) || simplifyRounds < 0 ||
      simplifyRounds != floor(simplifyRounds)) {
    stop("simplifyRounds must be a non-negative integer.")
  }

  empty <- "MULTIPOLYGON EMPTY"
  geometries <- c(
    sf::st_as_sfc(result$ok, crs = 4326),
    sf::st_as_sfc(result$hdp, crs = 4326)
  )
  geometries <- geometries[!sf::st_is_empty(geometries)]
  if (!length(geometries)) {
    return(list(combined = empty, buffered = empty, inverted = empty))
  }

  # Union planar so raster-cell edges stay straight lat/lon lines; buffer on s2
  # for geodesic distances. Restore the caller's setting afterwards.
  previous <- sf::sf_use_s2()
  on.exit(suppressMessages(sf::sf_use_s2(previous)), add = TRUE)

  as_multipolygon_wkt <- function(geometry) {
    sf::st_as_text(sf::st_cast(geometry, "MULTIPOLYGON"))[[1]]
  }
  suppressMessages(sf::sf_use_s2(FALSE))
  combined <- suppressMessages(sf::st_union(sf::st_make_valid(geometries)))
  suppressMessages(sf::sf_use_s2(TRUE))
  buffered <- sf::st_buffer(combined, dist = bufferKm * 1000)
  # Thin on s2 too: planar repair breaks buffers that cross the antimeridian.
  for (round in seq_len(simplifyRounds)) {
    buffered <- suppressMessages(.drop_alternate_vertices(buffered))
  }
  list(
    combined = as_multipolygon_wkt(combined),
    buffered = as_multipolygon_wkt(buffered),
    inverted = suppressMessages(.invert_to_world(buffered))
  )
}

# Web Mercator map extent, the rectangle the inverted polygon is cut from.
.world_extent <- c(xmin = -180, ymin = -85.0511287798, xmax = 180, ymax = 85.0511287798)

# World rectangle minus the polygons; planar so cell and map edges stay straight.
.invert_to_world <- function(geometry) {
  previous <- sf::sf_use_s2()
  on.exit(suppressMessages(sf::sf_use_s2(previous)), add = TRUE)
  suppressMessages(sf::sf_use_s2(FALSE))

  strip <- function(xmin, xmax) {
    sf::st_as_sfc(sf::st_bbox(c(
      xmin = xmin, ymin = .world_extent[["ymin"]],
      xmax = xmax, ymax = .world_extent[["ymax"]]
    ), crs = sf::st_crs(4326)))
  }
  polygons_only <- function(x) {
    x <- x[!sf::st_is_empty(x)]
    collections <- sf::st_geometry_type(x) == "GEOMETRYCOLLECTION"
    parts <- lapply(seq_along(x), function(i) {
      if (collections[i]) sf::st_collection_extract(x[i], "POLYGON") else x[i]
    })
    parts <- do.call(c, c(list(sf::st_sfc(crs = sf::st_crs(4326))), parts))
    parts[sf::st_geometry_type(parts) %in% c("POLYGON", "MULTIPOLYGON")]
  }

  unwrapped <- sf::st_make_valid(.unwrap_dateline_polygons(geometry))
  west_half <- polygons_only(suppressWarnings(sf::st_intersection(unwrapped, strip(-180, 180))))
  east_half <- polygons_only(suppressWarnings(sf::st_intersection(unwrapped, strip(180, 540))))
  if (length(east_half)) {
    east_half <- sf::st_sfc(sf::st_geometry(east_half) + c(-360, 0), crs = sf::st_crs(4326))
  }
  clipped <- sf::st_union(c(west_half, east_half))

  inverted <- sf::st_difference(strip(-180, 180), clipped)
  .orient_rings(inverted)
}

# s2 rings crossing the antimeridian need unwrapping before planar splitting.
.unwrap_dateline_polygons <- function(geometry) {
  polygons <- lapply(sf::st_cast(geometry, "POLYGON"), function(polygon) {
    if (any(abs(diff(polygon[[1]][, 1])) > 180)) {
      polygon <- lapply(polygon, function(ring) {
        ring[ring[, 1] < 0, 1] <- ring[ring[, 1] < 0, 1] + 360
        ring
      })
    }
    sf::st_polygon(polygon)
  })
  sf::st_sfc(polygons, crs = sf::st_crs(geometry))
}

# Outer rings counter-clockwise starting at their south-west vertex, holes clockwise.
.orient_rings <- function(geometry) {
  orient <- function(polygon) {
    lapply(seq_along(polygon), function(i) {
      ring <- polygon[[i]]
      from <- ring[-nrow(ring), , drop = FALSE]
      to <- ring[-1, , drop = FALSE]
      counter_clockwise <- sum(from[, 1] * to[, 2] - to[, 1] * from[, 2]) > 0
      if (counter_clockwise != (i == 1)) ring <- ring[nrow(ring):1, , drop = FALSE]
      if (i == 1) {
        open <- ring[-nrow(ring), , drop = FALSE]
        start <- order(open[, 2], open[, 1])[1]
        open <- open[c(start:nrow(open), seq_len(start - 1)), , drop = FALSE]
        ring <- rbind(open, open[1, , drop = FALSE])
      }
      ring
    })
  }
  polygons <- lapply(sf::st_cast(geometry, "MULTIPOLYGON")[[1]], orient)
  shape <- if (length(polygons) == 1) sf::st_polygon(polygons[[1]]) else sf::st_multipolygon(polygons)
  # 13 digits keep the map extent exact instead of rounding it to 85.05113.
  sf::st_as_text(shape, digits = 13)
}

# Keeps every other vertex of each ring; rings that would collapse stay as-is.
.drop_alternate_vertices <- function(geometry) {
  thin_ring <- function(ring) {
    open <- ring[-nrow(ring), , drop = FALSE]
    kept <- open[seq(1, nrow(open), by = 2), , drop = FALSE]
    if (nrow(kept) < 3) return(ring)
    rbind(kept, kept[1, , drop = FALSE])
  }
  polygons <- lapply(sf::st_cast(geometry, "MULTIPOLYGON")[[1]], function(polygon) {
    lapply(polygon, thin_ring)
  })
  thinned <- sf::st_sfc(sf::st_multipolygon(polygons), crs = sf::st_crs(geometry))
  thinned <- sf::st_make_valid(thinned)
  if (any(sf::st_geometry_type(thinned) == "GEOMETRYCOLLECTION")) {
    thinned <- sf::st_collection_extract(thinned, "POLYGON")
  }
  thinned
}
