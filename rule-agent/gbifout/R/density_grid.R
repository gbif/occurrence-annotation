#' Fetch a GBIF occurrence-density raster for a taxon
#'
#' Wraps `rgbif::map_fetch(source = "density", ...)` to pull GBIF's own
#' precalculated occurrence density tiles, aggregated into square bins, as a
#' world-covering SpatRaster of per-bin occurrence counts. The rendered raster
#' is downsampled so each cell corresponds to exactly one square bin, instead
#' of one bin being spread across many same-valued pixels.
#'
#' @param taxonKey GBIF (or COL-resolved GBIF) taxon key.
#' @param zoom map tile zoom level; higher values give a finer grid (default 0).
#' @param squareSize bin size in tile pixels, must divide 4096 evenly
#'   (default 256); smaller values give a finer (noisier) grid.
#' @param basisOfRecord optional single basis-of-record channel for the raster.
#' @param format tile image format/resolution passed to `map_fetch()` (default
#'   "@4x.png", the maximum 4096px/tile resolution) - higher resolution means
#'   each square bin maps onto more native pixels, avoiding the aggregation
#'   approximation and rendering artifacts a lower-resolution tile can cause.
#'
#' @return a SpatRaster of GBIF occurrence counts per square bin.
#' @keywords internal
fetch_occurrence_density_raster <- function(taxonKey, zoom = 0, squareSize = 256,
                                             format = "@4x.png", basisOfRecord = NULL) {
  validate_grid_resolution(zoom, squareSize)
  if (!is.null(basisOfRecord) &&
      (!is.character(basisOfRecord) || length(basisOfRecord) != 1 ||
       is.na(basisOfRecord) || !nzchar(trimws(basisOfRecord)) ||
       grepl(";", basisOfRecord, fixed = TRUE))) {
    stop("basisOfRecord must be a single non-empty value for map_fetch.")
  }
  if (!is.null(basisOfRecord)) basisOfRecord <- trimws(basisOfRecord)

  # EPSG:4326 covers a 2:1 world, so it needs twice as many column tiles as row tiles
  x_tiles <- 2^(zoom + 1)
  y_tiles <- 2^zoom
  tile_pixels <- c("@Hx.png" = 256, "@1x.png" = 512, "@2x.png" = 1024,
                    "@3x.png" = 2048, "@4x.png" = 4096)[[format]]
  request <- list(
    source = "density",
    x = 0:(x_tiles - 1),
    y = 0:(y_tiles - 1),
    z = zoom,
    format = format,
    srs = "EPSG:4326",
    squareSize = squareSize,
    taxonKey = taxonKey,
    return = "terra",
    plot_terra = FALSE
  )
  if (!is.null(basisOfRecord)) request$basisOfRecord <- basisOfRecord
  raster <- do.call(map_fetch, request)

  # each squareSize-px bin (in the 4096px native grid) spans this many
  # rendered pixels at the requested tile resolution
  fact <- squareSize * (tile_pixels / 4096)
  if (fact > 1) {
    raster <- aggregate(raster, fact = fact, fun = "mean", na.rm = TRUE)
  }
  raster
}

validate_grid_resolution <- function(zoom, squareSize) {
  valid_square_sizes <- c(8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096)
  if (!is.numeric(zoom) || length(zoom) != 1 || zoom < 0 || zoom != as.integer(zoom)) {
    stop("zoom must be a non-negative integer.")
  }
  if (!is.numeric(squareSize) || length(squareSize) != 1 ||
      !(squareSize %in% valid_square_sizes)) {
    stop("squareSize must be one of: ", paste(valid_square_sizes, collapse = ", "), ".")
  }
}

#' Build a raster-occupancy grid for a taxon
#'
#' Converts the rendered map raster to a binary filled/empty mask and computes
#' the fraction of filled pixels in each cell. Pixel intensity is ignored.
#'
#' @param taxonKey GBIF taxon key.
#' @param zoom map tile zoom level (default 0).
#' @param gridPixels logical raster pixels per output cell (default 256).
#' @param keepBasisOfRecord optional basisOfRecord values fetched one at a time
#'   and combined before calculating occupancy. `NULL` includes all channels.
#' @param format tile image format passed to `map_fetch()` (default "@4x.png").
#' @param filledThreshold pixel values above this value count as filled
#'   (default 0).
#' @param useOcean whether to mask ocean cells from the occupancy grid.
#' @param oceanPath path to the ocean polygon file when `useOcean` is `TRUE`.
#'
#' @return a list with `raster`, a SpatRaster of fill fractions from 0 to 1;
#'   `filledPixelCount`, a SpatRaster of logical filled-pixel counts;
#'   `pixelsPerCell`; and `total`, the sum of fill fractions.
build_raster_occupancy_grid <- function(taxonKey, zoom = 0, gridPixels = 256,
                                         keepBasisOfRecord = NULL,
                                         format = "@4x.png", filledThreshold = 0,
                                         useOcean = FALSE,
                                         oceanPath = ocean_polygon_path()) {
  if (!is.null(keepBasisOfRecord)) {
    if (!is.character(keepBasisOfRecord) || length(keepBasisOfRecord) == 0 ||
        anyNA(keepBasisOfRecord)) {
      stop("keepBasisOfRecord must be NULL or a character vector.")
    }
    keepBasisOfRecord <- unique(trimws(keepBasisOfRecord))
    if (any(!nzchar(keepBasisOfRecord)) ||
        any(grepl(";", keepBasisOfRecord, fixed = TRUE))) {
      stop("keepBasisOfRecord values must be non-empty individual channels.")
    }
  }

  render_scale <- c("@Hx.png" = 1, "@1x.png" = 2, "@2x.png" = 4,
                    "@3x.png" = 6, "@4x.png" = 8)[[format]]
  x_tiles <- 2^(zoom + 1)
  y_tiles <- 2^zoom
  channels <- if (is.null(keepBasisOfRecord)) list(NULL) else as.list(keepBasisOfRecord)
  fetch_channel <- function(basis_of_record) {
    request <- list(
      source = "density",
      x = 0:(x_tiles - 1),
      y = 0:(y_tiles - 1),
      z = zoom,
      format = format,
      srs = "EPSG:4326",
      squareSize = gridPixels,
      taxonKey = taxonKey,
      return = "terra",
      plot_terra = FALSE
    )
    if (!is.null(basis_of_record)) request$basisOfRecord <- basis_of_record
    raster <- tryCatch(
      do.call(map_fetch, request),
      error = function(e) NULL
    )
    if (!is.null(raster)) return(list(raster))

    tile_coordinates <- expand.grid(
      x = 0:(x_tiles - 1),
      y = 0:(y_tiles - 1)
    )
    tile_rasters <- lapply(seq_len(nrow(tile_coordinates)), function(i) {
      tile_request <- request
      tile_request$x <- tile_coordinates$x[i]
      tile_request$y <- tile_coordinates$y[i]
      tryCatch(
        do.call(map_fetch, tile_request),
        error = function(e) NULL
      )
    })
    tile_rasters[!vapply(tile_rasters, is.null, logical(1))]
  }
  rasters <- unlist(lapply(channels, fetch_channel), recursive = FALSE)
  if (length(rasters) == 0) {
    stop("map_fetch returned no raster for taxonKey ", taxonKey)
  }

  filled_rasters <- lapply(rasters, function(raster) {
    ifel(!is.na(raster) & raster > filledThreshold, 1, 0)
  })
  filled <- if (length(filled_rasters) == 1) {
    filled_rasters[[1]]
  } else {
    do.call(terra::mosaic, c(filled_rasters, fun = "max"))
  }
  if (useOcean) {
    ocean <- read_ocean_polygon(oceanPath)
    ocean_mask <- rasterize(ocean, filled, field = 1, background = 0)
    filled <- ifel(ocean_mask > 0, 0, filled)
  }
  logical_filled <- if (render_scale > 1) {
    aggregate(filled, fact = render_scale, fun = "max", na.rm = TRUE)
  } else {
    filled
  }
  filled_pixel_count <- aggregate(
    logical_filled, fact = gridPixels, fun = "sum", na.rm = TRUE
  )
  pixels_per_cell <- gridPixels^2
  fraction <- filled_pixel_count / pixels_per_cell
  list(
    raster = fraction,
    filledPixelCount = filled_pixel_count,
    pixelsPerCell = pixels_per_cell,
    total = sum(values(fraction), na.rm = TRUE)
  )
}

#' Build a global occurrence-density grid for a taxon
#'
#' Uses the all-record density raster by default, or a selected single
#' basis-of-record channel when supplied.
#'
#' @param taxonKey GBIF taxon key.
#' @param zoom map tile zoom level passed to `fetch_occurrence_density_raster()`.
#' @param squareSize bin size in tile pixels passed to `fetch_occurrence_density_raster()`.
#' @param basisOfRecord optional single basis-of-record channel passed to `map_fetch()`.
#' @return list with `raster` (percentage-of-total SpatRaster) and `total`
#'   (summed density across occupied bins).
build_occurrence_grid <- function(taxonKey, zoom = 0, squareSize = 256,
                                   useOcean = FALSE,
                                   oceanPath = ocean_polygon_path(),
                                   basisOfRecord = NULL) {
  counts <- fetch_occurrence_density_raster(
    taxonKey, zoom, squareSize, basisOfRecord = basisOfRecord
  )

  total <- sum(values(counts), na.rm = TRUE)
  if (total == 0) {
    stop("map_fetch returned no occurrence density for taxonKey ", taxonKey)
  }

  if (useOcean) {
    ocean <- read_ocean_polygon(oceanPath)
    ocean_fraction <- rasterize(ocean, counts, field = 1, cover = TRUE, background = 0)
    counts <- counts * (1 - ocean_fraction)
    total <- sum(values(counts), na.rm = TRUE)
  }

  list(raster = counts / total * 100, total = total)
}

#' Identify the lowest-density raster cells as WKT polygons
#'
#' Selects the lower tail of the occupied-cell raster distribution. For
#' example, `rasterLowQuantile = 0.25` keeps roughly the lowest-density quarter
#' of occupied cells for candidate retrieval.
#'
#' @param grid list returned by `build_occurrence_grid()`.
#' @param rasterLowQuantile fraction of occupied cells to retain (default
#'   0.25). Smaller values reduce API calls but can miss sparse cells whose
#'   map tile renders as zero.
#'
#' @return data.frame with one row per selected cell: `wkt` (POLYGON string)
#'   and `percentage` (the raw map_fetch raster value).
find_low_percentage_cells <- function(grid, rasterLowQuantile = 0.25,
                                      useOcean = FALSE,
                                      oceanPath = ocean_polygon_path()) {
  if (!is.numeric(rasterLowQuantile) || length(rasterLowQuantile) != 1 ||
      rasterLowQuantile <= 0 || rasterLowQuantile > 1) {
    stop("rasterLowQuantile must be greater than 0 and at most 1.")
  }
  vals <- values(grid$raster)
  occupied_vals <- vals[!is.na(vals) & vals > 0]
  if (length(occupied_vals) == 0) {
    return(data.frame(wkt = character(0), percentage = numeric(0)))
  }
  raster_cutoff <- unname(quantile(occupied_vals, rasterLowQuantile))

  occupied <- ifel(grid$raster > 0 & grid$raster <= raster_cutoff, grid$raster, NA)
  if (all(is.na(values(occupied)))) {
    return(data.frame(wkt = character(0), percentage = numeric(0)))
  }
  polys <- as.polygons(occupied, dissolve = FALSE, na.rm = TRUE)
  cell_wkts <- geom(polys, wkt = TRUE)
  if (useOcean) cell_wkts <- clip_wkt_to_land(cell_wkts, oceanPath)
  result <- data.frame(
    wkt = cell_wkts,
    percentage = as.data.frame(polys)[[1]],
    stringsAsFactors = FALSE
  )
  result[!is.na(result$wkt) & nzchar(result$wkt), ]
}

#' Select the lowest-occupancy raster cells as WKT polygons
#'
#' @param occupancyGrid list returned by `build_raster_occupancy_grid()`.
#' @param lowQuantile fraction of nonzero cells to retain (default 0.05).
#' @param maxFilledPixels also retain occupied cells with at most this many
#'   filled pixels (default 3). Set to `NULL` to disable this override.
#' @param useOcean whether to clip selected cells to land.
#' @param oceanPath path to the ocean polygon file when `useOcean` is `TRUE`.
#'
find_low_occupancy_cells <- function(occupancyGrid, lowQuantile = 0.05,
                                     maxFilledPixels = 3,
                                     useOcean = FALSE,
                                     oceanPath = ocean_polygon_path()) {
  if (!is.numeric(lowQuantile) || length(lowQuantile) != 1 ||
      lowQuantile <= 0 || lowQuantile > 1) {
    stop("lowQuantile must be greater than 0 and at most 1.")
  }
  if (!is.null(maxFilledPixels) &&
      (!is.numeric(maxFilledPixels) || length(maxFilledPixels) != 1 ||
       is.na(maxFilledPixels) || maxFilledPixels < 1 ||
       maxFilledPixels != as.integer(maxFilledPixels))) {
    stop("maxFilledPixels must be NULL or a positive integer.")
  }
  values_occupancy <- values(occupancyGrid$raster)
  nonzero <- values_occupancy[!is.na(values_occupancy) & values_occupancy > 0]
  if (length(nonzero) == 0) {
    return(data.frame(
      wkt = character(0),
      fillFraction = numeric(0),
      filledPixelCount = numeric(0)
    ))
  }
  cutoff <- unname(quantile(nonzero, lowQuantile))
  selected_by_quantile <- occupancyGrid$raster > 0 & occupancyGrid$raster <= cutoff
  selected_by_pixel_count <- if (is.null(maxFilledPixels)) {
    FALSE
  } else {
    occupancyGrid$filledPixelCount > 0 &
      occupancyGrid$filledPixelCount <= maxFilledPixels
  }
  selected_cells <- selected_by_quantile | selected_by_pixel_count
  selected <- ifel(selected_cells, occupancyGrid$raster, NA)
  selected_counts <- ifel(selected_cells, occupancyGrid$filledPixelCount, NA)
  if (all(is.na(values(selected)))) {
    return(data.frame(
      wkt = character(0),
      fillFraction = numeric(0),
      filledPixelCount = numeric(0)
    ))
  }
  polygons <- as.polygons(selected, dissolve = FALSE, na.rm = TRUE)
  cell_wkts <- geom(polygons, wkt = TRUE)
  if (useOcean) cell_wkts <- clip_wkt_to_land(cell_wkts, oceanPath)
  result <- data.frame(
    wkt = cell_wkts,
    fillFraction = as.data.frame(polygons)[[1]],
    filledPixelCount = as.data.frame(selected_counts, na.rm = TRUE)[[1]],
    stringsAsFactors = FALSE
  )
  result[!is.na(result$wkt) & nzchar(result$wkt), ]
}
