#' Get top rule creators
#'
#' Returns top rule creators ordered by number of rules created.
#'
#' @param limit (integer) Maximum number of creators to return (default: 10, max: 100).
#'
#' @return A `tibble` with columns: username, ruleCount, totalSupports, totalContests, projectCount.
#' @export
#'
#' @examples
#' \\dontrun{
#' # Get top 10 rule creators
#' get_top_creators()
#' 
#' # Get top 25 creators
#' get_top_creators(limit = 25)
#' }
get_top_creators <- function(limit = 10) {
  
  url <- paste0(gbifrules_url("stats"), "/top-creators")
  
  # Build query parameters
  query <- list(limit = limit)
  
  r <- gbifrules_get(url, query)
  
  # Define expected columns
  expected_columns <- list(
    username = character(),
    ruleCount = integer(),
    totalSupports = integer(),
    totalContests = integer(),
    projectCount = integer()
  )
  
  if (length(r) == 0) {
    # Return empty tibble with all expected columns
    result <- tibble::tibble(!!!expected_columns)
    return(result[0, ])
  }
  
  # Convert to tibble
  result <- tibble::as_tibble(r)
  
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
