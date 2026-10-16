#' Diagnostic plots for outlier candidate selection
#'
#' Draws histograms explaining how `find_outlier_candidates()` selected cells.
#' The `"occupancy"` panel is a histogram of occupied-cell occupancy (percent of
#' filled pixels) with cells selected as low-occupancy candidates (by the
#' quantile cutoff or the `maxFilledPixels` override, before the
#' occurrence-count filter) highlighted, and the quantile cutoff marked. The
#' `"pixels"` panel is the same for filled-pixel counts with `maxFilledPixels`
#' marked. The occupancy panel subtitle compares the occupied-cell CV with
#' `flatCvThreshold`.
#'
#' @param x a `gbifout_outliers` result from `find_outlier_candidates()`.
#' @param which panels to draw: any of `"occupancy"`, `"pixels"`.
#' @param breaks histogram breaks passed to [graphics::hist()].
#' @param ... unused.
#' @return `x`, invisibly.
#' @export
plot.gbifout_outliers <- function(x, which = c("occupancy", "pixels"),
                                  breaks = "Sturges", ...) {
  which <- match.arg(which, several.ok = TRUE)
  d <- x$diagnostics
  if (is.null(d)) stop("x has no diagnostics; rerun find_outlier_candidates().")
  if (length(which) > 1) {
    op <- graphics::par(mfrow = c(1, length(which)))
    on.exit(graphics::par(op), add = TRUE)
  }
  selected <- .selected_cells(d)
  for (panel in which) {
    switch(panel,
      occupancy = {
        .plot_selection_histogram(
          d$occupancy * 100, selected, d$occupancyCutoff * 100, breaks,
          main = "Occupied-cell occupancy",
          xlab = "Filled pixels (%)",
          cutoffLabel = sprintf("quantile cutoff (q = %.2f)", x$effectiveQuantile)
        )
        graphics::mtext(sprintf("CV %.2f %s flatCvThreshold %.2f", x$occupancyCv,
                                if (isTRUE(x$occupancyCv > d$flatCvThreshold)) ">" else "<=",
                                d$flatCvThreshold),
                        side = 3, line = 0.3, cex = 0.8)
      },
      pixels = .plot_selection_histogram(
        d$filledPixelCount, selected,
        if (is.null(d$maxFilledPixels)) NA_real_ else d$maxFilledPixels,
        .integer_breaks(d$filledPixelCount, breaks),
        main = "Occupied-cell filled pixels",
        xlab = "Filled pixel count",
        cutoffLabel = "maxFilledPixels"
      )
    )
  }
  invisible(x)
}

#' @rdname plot.gbifout_outliers
#' @param plot logical; also draw the diagnostic plots.
#' @export
print.gbifout_outliers <- function(x, plot = FALSE, ...) {
  d <- x$diagnostics
  n_occupied <- length(d$occupancy)
  regime <- if (!is.finite(x$occupancyCv) || x$occupancyCv <= d$flatCvThreshold) {
    "flat: all occupied cells eligible"
  } else {
    "adaptive"
  }
  cat("<gbifout outlier candidates> taxonKey:", x$taxonKey, "\n")
  cat(sprintf("  Occupied cells:      %d (%d selected as low occupancy)\n",
              n_occupied, sum(.selected_cells(d))))
  cat(sprintf("  Occupancy CV:        %.3f (flatCvThreshold %.3f, %s)\n",
              x$occupancyCv, d$flatCvThreshold, regime))
  cat(sprintf("  Effective quantile:  %.3f (occupancy cutoff %.2f%%)\n",
              x$effectiveQuantile, d$occupancyCutoff * 100))
  cat(sprintf("  maxFilledPixels:     %s\n",
              if (is.null(d$maxFilledPixels)) "NULL" else d$maxFilledPixels))
  cat(sprintf("  Candidate polygons:  %d (%s occurrences, %d datasets)\n",
              nrow(x$candidates), format(sum(x$candidates$occurrenceCount, na.rm = TRUE)),
              length(unique(x$datasets$datasetKey))))
  if (isTRUE(plot)) plot(x, ...) else cat("  Use plot(x) for diagnostic histograms.\n")
  invisible(x)
}

write_outlier_diagnostics <- function(x, path, width = 1100, height = 500, res = 110) {
  tryCatch({
    grDevices::png(path, width = width, height = height, res = res)
    on.exit(grDevices::dev.off(), add = TRUE)
    plot(x)
  }, error = function(e) warning("Could not write diagnostics plot: ", conditionMessage(e)))
  invisible(path)
}

.selected_cells <- function(d) {
  if (!length(d$occupancy)) return(logical(0))
  by_quantile <- d$occupancy <= d$occupancyCutoff
  by_pixels <- if (is.null(d$maxFilledPixels)) FALSE else d$filledPixelCount <= d$maxFilledPixels
  by_quantile | by_pixels
}

# One bar per integer count for small default-binned pixel counts.
.integer_breaks <- function(values, breaks) {
  if (!identical(breaks, "Sturges") || !length(values) || max(values) > 64) return(breaks)
  seq(floor(min(values)) - 0.5, ceiling(max(values)) + 0.5, by = 1)
}

.plot_selection_histogram <- function(values, selected, cutoff, breaks, main, xlab,
                                      cutoffLabel) {
  if (!length(values)) {
    graphics::plot.new()
    graphics::title(main)
    graphics::text(0.5, 0.5, "No occupied cells")
    return(invisible())
  }
  h <- graphics::hist(values, breaks = breaks, plot = FALSE)
  selected_counts <- graphics::hist(values[selected], breaks = h$breaks, plot = FALSE)$counts
  xlim <- range(h$breaks, if (is.finite(cutoff)) cutoff)
  xlim <- xlim + c(0, 0.05) * diff(xlim)
  plot(h, col = "grey80", border = "white", main = main, xlab = xlab, ylab = "Cells",
       xlim = xlim, ylim = c(0, max(h$counts) * 1.35))
  graphics::rect(h$breaks[-length(h$breaks)], 0, h$breaks[-1], selected_counts,
                 col = "firebrick", border = "white")
  if (is.finite(cutoff)) graphics::abline(v = cutoff, col = "black", lty = 2, lwd = 2)
  graphics::legend("topright", bty = "n", cex = 0.8,
                   fill = c("firebrick", "grey80", NA), border = c("white", "white", NA),
                   lty = c(NA, NA, if (is.finite(cutoff)) 2 else NA), lwd = c(NA, NA, 2),
                   legend = c("selected", "retained (high occupancy)", cutoffLabel))
}
