#' Plot SDM record suitability over a GBIF occurrence map
#'
#' Colours assessed occurrence points by cloglog suitability (0 to 1), with
#' red rings around review flags and grey crosses for unscored records.
#' The grey backdrop is GBIF occurrence coverage, not predicted suitability.
#' No climate data, model fitting, or occurrence lookups are needed.
#'
#' @param x a result from `sdm_check()`, including older saved unclassed lists.
#' @param map optional single-layer EPSG:4326 terra SpatRaster from
#'   `map_fetch()`, or a finder's `diagnostics$map`. Positive values indicate
#'   occurrence coverage. NULL fetches a world map for `x$settings$taxonKey`
#'   using all basis-of-record channels; supply a map to avoid network access.
#' @param main optional plot title.
#' @param cex positive point size (default 1).
#' @param ... additional arguments to `graphics::plot.window()`, e.g. `xlim`
#'   and `ylim`. Defaults fit the backdrop and georeferenced assessment points.
#' @return `x`, invisibly.
#' @export
plot_sdm <- function(x, map = NULL, main = NULL, cex = 1, ...) {
  required <- c("decimalLongitude", "decimalLatitude", "suitability", "reviewFlag")
  if (!is.list(x) || !is.data.frame(x$data) ||
      !all(required %in% names(x$data))) {
    stop("x must be an SDM result with coordinates, suitability and reviewFlag.")
  }
  data <- x$data
  if (!is.numeric(data$decimalLongitude) || !is.numeric(data$decimalLatitude) ||
      !is.numeric(data$suitability) ||
      any(is.finite(data$suitability) & (data$suitability < 0 | data$suitability > 1))) {
    stop("SDM coordinates must be numeric and finite suitability must be between 0 and 1.")
  }
  if (!is.numeric(cex) || length(cex) != 1 || !is.finite(cex) || cex <= 0) {
    stop("cex must be a positive finite number.")
  }
  taxon <- x$settings$taxonKey
  if (is.null(map)) {
    if (length(taxon) != 1 || is.na(taxon) || !nzchar(as.character(taxon))) {
      stop("Supply map or an SDM result with settings$taxonKey.")
    }
    map <- fetch_occurrence_density_raster(
      taxonKey = taxon, zoom = 0, squareSize = 8, format = "@1x.png"
    )
  }
  if (!inherits(map, "SpatRaster") || terra::nlyr(map) != 1 ||
      !isTRUE(sf::st_crs(terra::crs(map)) == sf::st_crs(4326))) {
    stop("map must be a single-layer EPSG:4326 SpatRaster.")
  }
  valid <- .sdm_valid_coordinates(data)
  if (any(!valid)) {
    warning(sum(!valid), " records omitted from the SDM map: missing/invalid coordinates.",
            call. = FALSE)
  }
  occupied <- terra::ifel(map > 0, 1, NA)
  has_coverage <- any(terra::values(map, mat = FALSE) > 0, na.rm = TRUE)
  points <- if (any(valid)) {
    terra::vect(data[valid, ], geom = c("decimalLongitude", "decimalLatitude"),
                 crs = "EPSG:4326")
  } else NULL
  limits <- .map_limits(if (has_coverage) occupied else NULL, list(points))
  window <- utils::modifyList(list(xlim = limits$x, ylim = limits$y, asp = 1), list(...))
  ocean <- read_ocean_polygon(ocean_polygon_path())
  graphics::plot.new()
  do.call(graphics::plot.window, window)
  terra::plot(ocean, col = "#DCEBF5", border = "grey70", lwd = 0.5, add = TRUE)
  if (has_coverage) {
    terra::plot(occupied, col = "#BBBBBB", legend = FALSE, add = TRUE)
  }
  palette <- grDevices::colorRampPalette(c("#440154", "#31688E", "#35B779", "#FDE725"))(101)
  scored <- valid & is.finite(data$suitability)
  if (any(scored)) {
    graphics::points(
      data$decimalLongitude[scored], data$decimalLatitude[scored],
      pch = 21, bg = palette[1 + floor(data$suitability[scored] * 100)],
      col = "#333333", cex = cex, lwd = 0.5
    )
  }
  unscored <- valid & !scored
  if (any(unscored)) {
    graphics::points(data$decimalLongitude[unscored], data$decimalLatitude[unscored],
                      pch = 4, col = "grey40", cex = cex)
  }
  flagged <- scored & !is.na(data$reviewFlag) & nzchar(data$reviewFlag)
  if (any(flagged)) {
    graphics::points(data$decimalLongitude[flagged], data$decimalLatitude[flagged],
                      pch = 1, col = "#D73027", cex = cex * 1.7, lwd = 1.8)
  }
  graphics::axis(1)
  graphics::axis(2, las = 1)
  graphics::box()
  if (is.null(main)) {
    main <- paste0("SDM suitability", if (length(taxon) == 1) paste0(": ", taxon))
  }
  graphics::title(main = main, xlab = "Longitude", ylab = "Latitude",
                   sub = sprintf("%d scored; %d review flags; %d unscored; %d without coordinates",
                                 sum(scored), sum(flagged), sum(unscored), sum(!valid)))
  graphics::legend(
    "bottomleft", bg = "white", cex = 0.75,
    legend = c("Suitability 0", "0.25", "0.5", "0.75", "1",
               "Review flag", "Unscored", "GBIF coverage (not SDM prediction)"),
    pch = c(rep(21, 5), 1, 4, 15),
    pt.bg = c(palette[c(1, 26, 51, 76, 101)], NA, NA, NA),
    col = c(rep("#333333", 5), "#D73027", "grey40", "#BBBBBB"),
    pt.cex = c(rep(1, 5), 1.7, 1, 1)
  )
  invisible(x)
}

#' @rdname plot_sdm
#' @export
plot.gbifout_sdm <- function(x, ...) {
  plot_sdm(x, ...)
}
