#' Get most supported projects
#'
#' Returns top projects ordered by total support count (sum of supports across all project rules).
#'
#' @param limit (integer) Maximum number of projects to return (default: 10, max: 100).
#'
#' @return A `tibble` with columns: projectId, projectName, projectDescription, createdBy, 
#'   ruleCount, totalSupports, totalContests, memberCount.
#' @export
#'
#' @examples
#' \\dontrun{
#' # Get top 10 most supported projects
#' get_most_supported_projects()
#' 
#' # Get top 25 most supported projects
#' get_most_supported_projects(limit = 25)
#' }
get_most_supported_projects <- function(limit = 10) {
  
  url <- paste0(gbifrules_url("stats"), "/most-supported-projects")
  
  # Build query parameters
  query <- list(limit = limit)
  
  r <- gbifrules_get(url, query)
  
  # Define expected columns
  expected_columns <- list(
    projectId = integer(),
    projectName = character(),
    projectDescription = character(),
    createdBy = character(),
    ruleCount = integer(),
    totalSupports = integer(),
    totalContests = integer(),
    memberCount = integer()
  )
  
  if (length(r) == 0) {
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
        } else if (is.character(default_val)) {
          result[[col_name]] <- rep(NA_character_, nrow(result))
        }
      } else {
        result[[col_name]] <- default_val
      }
    }
  }
  
  result
}
