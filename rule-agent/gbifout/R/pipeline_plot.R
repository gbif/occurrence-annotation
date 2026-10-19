#' Map pipeline decision polygons over GBIF occurrence coverage
#'
#' Shows OK (green), INTRODUCED (orange), SUSPICIOUS (red), and HDP
#' (blue dashed outlines). HDP includes count-excluded cells, not assessed
#' records. Mixed-decision polygons can overlap; outlines are drawn after fills
#' with distinct widths and line styles to keep shared boundaries visible.
#' NEEDS_REVIEW and FORMER records are not assigned separate polygon layers.
#'
#' @param x a `pipeline()` result, including older saved unclassed lists.
#' @param map optional single-layer EPSG:4326 terra SpatRaster, e.g. a finder's
#'   `diagnostics$map`. Positive values are displayed as grey GBIF coverage.
#'   NULL fetches coverage using `map_fetch()` for the result's taxon, across
#'   all basis-of-record channels. Supply a map to plot without network access.
#' @param main optional plot title.
#' @param ... arguments to `graphics::plot.window()`, e.g. `xlim` and `ylim`.
#' @return `x`, invisibly. No discovery, occurrence lookups, or AI calls are made.
#' @export
plot_pipeline <- function(x, map = NULL, main = NULL, ...) {
  groups <- c("hdp", "ok", "int", "sus")
  if (!is.list(x) || !is.data.frame(x$data) ||
      !all(c("decision") %in% names(x$data)) ||
      !all(groups %in% names(x))) {
    stop("x must be a pipeline result with data$decision and hdp/ok/int/sus polygons.")
  }
  layers <- lapply(groups, function(group) {
    wkt <- x[[group]]
    if (!is.character(wkt) || length(wkt) != 1 || is.na(wkt) || !nzchar(wkt)) {
      stop("Pipeline ", group, " must be a single polygon WKT string.")
    }
    geometry <- sf::st_as_sfc(wkt, crs = 4326)
    if (any(!as.character(sf::st_geometry_type(geometry)) %in% c("POLYGON", "MULTIPOLYGON")) ||
        any(!sf::st_is_valid(geometry))) {
      stop("Pipeline ", group, " must contain valid POLYGON or MULTIPOLYGON WKT.")
    }
    if (all(sf::st_is_empty(geometry))) NULL else terra::vect(geometry)
  })
  names(layers) <- groups
  taxon <- unique(as.character(c(x$taxonKey, x$data$taxonKey)))
  if (length(taxon) > 1 || anyNA(taxon) || any(!nzchar(trimws(taxon)))) {
    stop("Pipeline result must identify at most one non-empty taxonKey.")
  }
  if (is.null(map)) {
    if (!length(taxon)) stop("Supply map when the pipeline result has no taxonKey.")
    map <- fetch_occurrence_density_raster(
      taxonKey = taxon, zoom = 0, squareSize = 8, format = "@1x.png"
    )
  }
  if (!inherits(map, "SpatRaster") || terra::nlyr(map) != 1 ||
      !isTRUE(sf::st_crs(terra::crs(map)) == sf::st_crs(4326))) {
    stop("map must be a single-layer EPSG:4326 SpatRaster.")
  }
  has_coverage <- any(terra::values(map, mat = FALSE) > 0, na.rm = TRUE)
  occupied <- if (has_coverage) terra::ifel(map > 0, 1, NA) else NULL
  limits <- .map_limits(occupied, layers)
  window <- utils::modifyList(list(xlim = limits$x, ylim = limits$y, asp = 1), list(...))
  ocean <- read_ocean_polygon(ocean_polygon_path())
  colours <- c(hdp = "#2166AC", ok = "#238B45", int = "#E68A00", sus = "#D73027")
  fills <- stats::setNames(
    c(NA_character_, grDevices::adjustcolor(colours[-1], alpha.f = 0.22)), groups
  )
  widths <- c(hdp = 1, ok = 4, int = 2.5, sus = 1.3)
  styles <- c(hdp = 2, ok = 1, int = 3, sus = 1)
  graphics::plot.new()
  do.call(graphics::plot.window, window)
  terra::plot(ocean, col = "#DCEBF5", border = "grey70", lwd = 0.5, add = TRUE)
  for (group in groups[-1]) {
    if (!is.null(layers[[group]])) {
      terra::plot(layers[[group]], col = fills[[group]], border = NA, add = TRUE)
    }
  }
  if (has_coverage) terra::plot(occupied, col = "#BBBBBB", legend = FALSE, add = TRUE)
  for (group in groups) {
    if (!is.null(layers[[group]])) {
      terra::plot(layers[[group]], col = NA, border = colours[[group]],
                    lwd = widths[[group]], lty = styles[[group]], add = TRUE)
    }
  }
  graphics::axis(1)
  graphics::axis(2, las = 1)
  graphics::box()
  if (is.null(main)) {
    main <- paste0("Pipeline decisions", if (length(taxon)) paste0(": ", taxon))
  }
  counts <- vapply(c("OK", "INTRODUCED", "SUSPICIOUS", "NEEDS_REVIEW", "FORMER"),
                    function(decision) sum(x$data$decision == decision, na.rm = TRUE),
                    integer(1))
  graphics::title(
    main = main, xlab = "Longitude", ylab = "Latitude",
    sub = "Polygons may overlap; HDP is unassessed, not an OK decision"
  )
  graphics::mtext(
    paste0("Records: ", paste(paste(names(counts), counts), collapse = "; ")),
    side = 3, line = 0.3, cex = 0.75
  )
  graphics::legend(
    "bottomleft", bg = "white", cex = 0.75,
    legend = c("OK", "INTRODUCED", "SUSPICIOUS", "HDP (unassessed)",
               "GBIF occurrence coverage"),
    col = c(colours[c("ok", "int", "sus", "hdp")], "#BBBBBB"),
    lty = c(styles[c("ok", "int", "sus", "hdp")], NA),
    lwd = c(widths[c("ok", "int", "sus", "hdp")], NA),
    pch = c(rep(NA, 4), 15)
  )
  invisible(x)
}

#' @rdname plot_pipeline
#' @export
plot.gbifout_pipeline <- function(x, ...) {
  plot_pipeline(x, ...)
}
