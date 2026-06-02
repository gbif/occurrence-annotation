#' Get aggregated rule metrics
#'
#' Returns aggregated metrics about rules including count of rules, datasets, projects,
#' taxa, supports, and contests. Can be filtered by various parameters.
#'
#' @param username (character) Optional username to filter metrics for a specific user.
#' @param taxonKey (integer) Optional taxon key to filter by.
#' @param datasetKey (character) Optional dataset key to filter by.
#' @param rulesetId (integer) Optional ruleset ID to filter by.
#' @param projectId (integer) Optional project ID to filter by.
#'
#' @return A `tibble` with columns: username, ruleCount, datasetCount, projectCount, taxonCount, supportCount, contestCount.
#' @export
#'
#' @examples
#' \dontrun{
#' # Get overall metrics
#' get_rule_metrics()
#' 
#' # Get metrics for a specific user
#' get_rule_metrics(username = "jwaller")
#' 
#' # Get metrics for a specific project
#' get_rule_metrics(projectId = 123)
#' }
get_rule_metrics <- function(username = NULL, 
                             taxonKey = NULL, 
                             datasetKey = NULL, 
                             rulesetId = NULL, 
                             projectId = NULL) {
  
  url <- paste0(gbifrules_url("rule"), "/metrics")
  
  # Build query parameters
  query <- list(
    username = username,
    taxonKey = taxonKey,
    datasetKey = datasetKey,
    rulesetId = rulesetId,
    projectId = projectId
  )
  
  # Remove NULL parameters
  query <- Filter(Negate(is.null), query)
  
  r <- gbifrules_get(url, query)
  
  # Define expected columns
  expected_columns <- list(
    username = character(),
    ruleCount = integer(),
    datasetCount = integer(),
    projectCount = integer(),
    taxonCount = integer(),
    supportCount = integer(),
    contestCount = integer()
  )
  
  if (length(r) == 0 || (is.list(r) && all(sapply(r, is.null)))) {
    # Return empty tibble with all expected columns
    result <- tibble::tibble(!!!expected_columns)
    return(result[0, ])
  }
  
  # Convert to data frame using jsonlite to properly flatten
  result <- jsonlite::fromJSON(jsonlite::toJSON(r), flatten = TRUE)
  
  # Convert to tibble
  result <- tibble::as_tibble(result)
  
  # Handle list columns - flatten scalar values and convert arrays to character strings
  result <- result |> dplyr::mutate_all(~ {
    if (is.list(.x)) {
      # Check if this is likely an array column (has multiple values in some entries)
      is_array_col <- any(purrr::map_int(.x, length) > 1, na.rm = TRUE)
      
      if (is_array_col) {
        # Array column - convert to comma-separated strings
        purrr::map_chr(.x, ~ if (is.null(.x) || length(.x) == 0) NA_character_ else paste(.x, collapse = ", "))
      } else {
        # Scalar column - extract single values
        purrr::map(.x, ~ if (is.null(.x) || length(.x) == 0) NA else .x[[1L]]) |> unlist()
      }
    } else {
      .x
    }
  })
  
  # Ensure all expected columns are present
  for (col_name in names(expected_columns)) {
    if (!col_name %in% names(result)) {
      # Add missing column with appropriate default value
      default_val <- expected_columns[[col_name]]
      if (nrow(result) > 0) {
        if (is.integer(default_val)) {
          result[[col_name]] <- rep(NA_integer_, nrow(result))
        } else {
          result[[col_name]] <- rep(NA_character_, nrow(result))
        }
      } else {
        result[[col_name]] <- default_val
      }
    }
  }
  
  result
}
