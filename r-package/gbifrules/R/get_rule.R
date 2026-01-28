#' Get rules
#'
#' @param id rule id.
#' @param limit page start.
#' @param offset number of records to return on page. 
#' @param ... Additional args passed to query. 
#'
#' @return a tibble of rules 
#' @export
#'
#' @examples 
#' \dontrun{
#' get_rule()
#' }
get_rule <- function(id=NULL,limit=NULL,offset=NULL,...) {
  
  if(is.null(id)) {
    url <- gbifrules_url("rule")
    # Combine all query parameters
    dots <- list(...)
    query <- c(dots, list(limit=limit, offset=offset))
    
    # Handle NULL values for filtering
    # Check if any parameter is explicitly set to NULL (vs not provided)
    for(param_name in names(dots)) {
      if(is.null(dots[[param_name]])) {
        # User explicitly passed NULL, convert to string "null" for API
        query[[param_name]] <- "null"
      }
    }
    
    # Remove unset parameters (limit/offset that are NULL and weren't in dots)
    if(is.null(limit)) query$limit <- NULL
    if(is.null(offset)) query$offset <- NULL
    
    r <- gbifrules_get(url,query)
  } else {
    url <- paste0(gbifrules_url("rule/"),id)
    r <- gbifrules_get_id(url) 
  }
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
  
  if(length(r) == 0) {
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
    if(is.list(.x)) {
      # Check if this is likely an array column (has multiple values in some entries)
      is_array_col <- any(purrr::map_int(.x, length) > 1, na.rm = TRUE)
      
      if(is_array_col) {
        # Array column - convert to comma-separated strings
        purrr::map_chr(.x, ~ if(is.null(.x) || length(.x) == 0) NA_character_ else paste(.x, collapse = ", "))
      } else {
        # Scalar column - extract single values
        purrr::map(.x, ~ if(is.null(.x) || length(.x) == 0) NA else .x[[1L]]) |> unlist()
      }
    } else {
      .x
    }
  })
  
  # Ensure all expected columns are present
  for(col_name in names(expected_columns)) {
    if(!col_name %in% names(result)) {
      # Add missing column with appropriate default value
      default_val <- expected_columns[[col_name]]
      if(nrow(result) > 0) {
        if(is.integer(default_val)) {
          result[[col_name]] <- rep(NA_integer_, nrow(result))
        } else if(is.logical(default_val)) {
          result[[col_name]] <- rep(NA, nrow(result))
        } else {
          result[[col_name]] <- rep(NA_character_, nrow(result))
        }
      } else {
        result[[col_name]] <- default_val
      }
    }
  }
  
  # Reorder columns to match expected schema
  result <- result[, names(expected_columns), drop = FALSE]
  
  result
  
}
