#' Get rules contested by the authenticated user
#'
#' Returns all non-deleted rules that the currently authenticated user has contested.
#'
#' @param limit Maximum number of records to return (default: 100).
#' @param offset Number of records to skip for pagination (default: 0).
#' @param user (character) Optional username for authentication. Defaults to GBIF_USER environment variable.
#' @param pwd (character) Optional password for authentication. Defaults to GBIF_PWD environment variable.
#' @param ... Additional query parameters passed to the API.
#'
#' @return A `tibble` of rules contested by the authenticated user.
#' @export
#'
#' @examples
#' \dontrun{
#' # Get all rules contested by authenticated user
#' get_contested_rules()
#' 
#' # Get first 10 rules with pagination
#' get_contested_rules(limit = 10, offset = 0)
#' }
get_contested_rules <- function(limit = NULL, offset = NULL, user = NULL, pwd = NULL, ...) {
  
  url <- paste0(gbifrules_url("rule"), "/contested")
  
  # Combine all query parameters
  dots <- list(...)
  query <- c(dots, list(limit = limit, offset = offset))
  
  # Remove unset parameters
  if (is.null(limit)) query$limit <- NULL
  if (is.null(offset)) query$offset <- NULL
  
  r <- gbifrules_get(url, query, user, pwd)
  
  # Define expected columns with their default types
  expected_columns <- list(
    id = integer(),
    taxonKey = integer(), 
    datasetKey = character(),
    geometry = character(),
    annotation = character(),
    basisOfRecord = character(),
    basisOfRecordNegated = logical(),
    yearRange = character(),  
    rulesetId = integer(),
    projectId = integer(),
    supportedBy = character(),
    contestedBy = character(),
    created = character(),
    createdBy = character(),
    deleted = character(),
    deletedBy = character()
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
        } else if (is.logical(default_val)) {
          result[[col_name]] <- rep(NA, nrow(result))
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
