#' Print saved pipeline details for one GBIF occurrence
#'
#' Prints every column of the matching rows in a pipeline result, including
#' the decision, reason category, full explanation, model, and source polygon.
#' Uses only saved data; no GBIF or OpenAI requests are made.
#'
#' @param result a `pipeline()` result, including one loaded with `readRDS()`.
#' @param gbifid a single numeric or character GBIF occurrence ID.
#' @return The matching rows of `result$data`, invisibly. All matches are
#'   printed when an ID occurs more than once. An absent ID raises an error.
#' @examples
#' \dontrun{
#' details(p, 1892087089)
#' record <- details(p, "1892087089")
#' }
#' @export
details <- function(result, gbifid) {
  if (!is.list(result) || !is.data.frame(result$data) ||
      !"gbifid" %in% names(result$data)) {
    stop("result must be a pipeline result with data$gbifid.")
  }
  if (!(is.character(gbifid) || is.numeric(gbifid)) ||
      length(gbifid) != 1 || is.na(gbifid) ||
      !grepl("^[0-9]+$", as.character(gbifid)) ||
      !is.finite(as.numeric(gbifid)) || as.numeric(gbifid) < 1) {
    stop("gbifid must be a single positive integer GBIF occurrence ID.")
  }
  gbifid <- as.character(gbifid)
  matches <- !is.na(result$data$gbifid) & as.character(result$data$gbifid) == gbifid
  rows <- result$data[matches, , drop = FALSE]
  if (!nrow(rows)) {
    stop("GBIF ID ", gbifid, " was not found in result$data.", call. = FALSE)
  }

  labels <- names(rows)
  width <- max(nchar(labels))
  for (i in seq_len(nrow(rows))) {
    if (i > 1) cat("\n")
    cat("GBIF occurrence ", gbifid, sep = "")
    if (nrow(rows) > 1) cat(" (match ", i, "/", nrow(rows), ")", sep = "")
    cat("\n")
    for (name in labels) {
      value <- paste(as.character(rows[[name]][i]), collapse = ", ")
      cat(sprintf("  %-*s: %s\n", width, name, value))
    }
  }
  invisible(rows)
}
