#' Plot predicted SDM suitability and assessed records
#'
#' Colours assessed occurrence points by cloglog suitability (0 to 1), with
#' red rings around review flags and grey crosses for unscored records.
#' Training occurrences define the prediction mask but are not drawn.
#' New results display full-raster suitability underneath the records.
#' The suitability-threshold polygon is outlined in black when present.
#' Older results without predictions retain the GBIF occurrence backdrop.
#' No climate data, model fitting, or occurrence lookups are needed.
#'
#' @param x a result from `sdm_check()`, including older saved unclassed lists.
#' @param map optional single-layer EPSG:4326 terra SpatRaster from
#'   `map_fetch()`, or a finder's `diagnostics$map`. Positive values indicate
#'   occurrence coverage. NULL uses `x$prediction`, or fetches a world GBIF map
#'   for legacy results without predictions. An explicit map adds grey coverage
#'   underneath the prediction surface; it does not limit the prediction extent.
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
  prediction <- x$prediction
  if (inherits(prediction, "PackedSpatRaster")) prediction <- terra::unwrap(prediction)
  if (!is.null(prediction)) {
    if (!inherits(prediction, "SpatRaster") || terra::nlyr(prediction) != 1 ||
        !isTRUE(sf::st_crs(terra::crs(prediction)) == sf::st_crs(4326))) {
      stop("prediction must be a single-layer EPSG:4326 SpatRaster.")
    }
    scores <- terra::values(prediction, mat = FALSE)
    if (any(!is.na(scores) & (!is.finite(scores) | scores < 0 | scores > 1))) {
      stop("Raster suitability must be NA or finite values between 0 and 1.")
    }
  }
  suitability_polygon <- NULL
  if (!is.null(x$suitabilityPolygon)) {
    wkt <- x$suitabilityPolygon
    if (!is.character(wkt) || length(wkt) != 1 || is.na(wkt) || !nzchar(wkt)) {
      stop("suitabilityPolygon must be a single polygon WKT string.")
    }
    geometry <- sf::st_as_sfc(wkt, crs = 4326)
    if (any(!as.character(sf::st_geometry_type(geometry)) %in% c("POLYGON", "MULTIPOLYGON"))) {
      stop("suitabilityPolygon must contain polygon geometry.")
    }
    if (!sf::st_is_empty(geometry)) suitability_polygon <- terra::vect(geometry)
  }
  polygon_label <- "Suitability boundary"
  if (!is.null(suitability_polygon)) {
    threshold <- x$settings$suitabilityThreshold
    if (!is.numeric(threshold) || length(threshold) != 1 || !is.finite(threshold) ||
        threshold < 0 || threshold > 1) {
      stop("A suitability polygon requires settings$suitabilityThreshold between 0 and 1.")
    }
    polygon_label <- paste0("Suitability >= ", format(threshold, trim = TRUE))
  }
  if (is.null(map) && is.null(prediction)) {
    if (length(taxon) != 1 || is.na(taxon) || !nzchar(as.character(taxon))) {
      stop("Supply map or an SDM result with settings$taxonKey.")
    }
    map <- fetch_occurrence_density_raster(
      taxonKey = taxon, zoom = 0, squareSize = 8, format = "@1x.png"
    )
  }
  if (!is.null(map) && (!inherits(map, "SpatRaster") || terra::nlyr(map) != 1 ||
      !isTRUE(sf::st_crs(terra::crs(map)) == sf::st_crs(4326)))) {
    stop("map must be a single-layer EPSG:4326 SpatRaster.")
  }
  valid <- .sdm_valid_coordinates(data)
  if (any(!valid)) {
    warning(sum(!valid), " records omitted from the SDM map: missing/invalid coordinates.",
            call. = FALSE)
  }
  occupied <- if (!is.null(map)) terra::ifel(map > 0, 1, NA) else NULL
  has_coverage <- !is.null(map) && any(terra::values(map, mat = FALSE) > 0, na.rm = TRUE)
  points <- if (any(valid)) {
    terra::vect(data[valid, ], geom = c("decimalLongitude", "decimalLatitude"),
                 crs = "EPSG:4326")
  } else NULL
  limits <- .map_limits(if (has_coverage) occupied else NULL,
                        list(prediction, points, suitability_polygon))
  window <- utils::modifyList(list(xlim = limits$x, ylim = limits$y, asp = 1), list(...))
  ocean <- read_ocean_polygon(ocean_polygon_path())
  graphics::plot.new()
  do.call(graphics::plot.window, window)
  terra::plot(ocean, col = "#DCEBF5", border = "grey70", lwd = 0.5, add = TRUE)
  if (has_coverage) {
    terra::plot(occupied, col = "#BBBBBB", legend = FALSE, add = TRUE)
  }
  palette <- grDevices::colorRampPalette(c("#440154", "#31688E", "#35B779", "#FDE725"))(101)
  if (!is.null(prediction) && any(is.finite(scores))) {
    terra::plot(prediction, col = palette, range = c(0, 1), legend = FALSE, add = TRUE)
  }
  if (!is.null(suitability_polygon)) {
    terra::plot(suitability_polygon, col = NA, border = "black", lwd = 2, add = TRUE)
  }
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
               "Review flag", "Unscored",
               if (!is.null(suitability_polygon)) polygon_label,
               if (has_coverage) "GBIF coverage (not SDM prediction)"),
    pch = c(rep(21, 5), 1, 4, if (!is.null(suitability_polygon)) NA,
            if (has_coverage) 15),
    pt.bg = c(palette[c(1, 26, 51, 76, 101)], NA, NA,
              if (!is.null(suitability_polygon)) NA,
              if (has_coverage) NA),
    col = c(rep("#333333", 5), "#D73027", "grey40",
            if (!is.null(suitability_polygon)) "black",
            if (has_coverage) "#BBBBBB"),
    pt.cex = c(rep(1, 5), 1.7, 1, if (!is.null(suitability_polygon)) 1,
               if (has_coverage) 1),
    lty = c(rep(NA, 7), if (!is.null(suitability_polygon)) 1, if (has_coverage) NA),
    lwd = c(rep(1, 7), if (!is.null(suitability_polygon)) 2, if (has_coverage) 1)
  )
  invisible(x)
}

#' @rdname plot_sdm
#' @export
plot.gbifout_sdm <- function(x, ...) {
  plot_sdm(x, ...)
}
