#' Combine outlier cell polygons into a single MULTIPOLYGON WKT
#'
#' @param wkts character vector of POLYGON WKT strings (e.g. the `binWkt`
#'   column from `out_cand()`); duplicates are dropped.
#'
#' @return a single MULTIPOLYGON WKT string covering all distinct polygons.
combine_outlier_polygons <- function(wkts) {
  wkts <- unique(wkts[!is.na(wkts) & nzchar(wkts)])
  if (length(wkts) == 0) {
    return("MULTIPOLYGON EMPTY")
  }
  polys <- vect(wkts, crs = "EPSG:4326")
  combined <- aggregate(polys)
  geom(combined, wkt = TRUE)
}

#' Read `out_cand()` CSV output and build a combined WKT
#'
#' @param csvPath path to a CSV written from `out_cand()`
#'   output (must contain a `binWkt` column).
#'
#' @return a single MULTIPOLYGON WKT string covering all distinct flagged cells.
outliers_csv_to_multipolygon <- function(csvPath) {
  df <- read.csv(csvPath, stringsAsFactors = FALSE)
  if (!"binWkt" %in% names(df)) {
    stop("CSV is missing a binWkt column: ", csvPath)
  }
  combine_outlier_polygons(df$binWkt)
}
