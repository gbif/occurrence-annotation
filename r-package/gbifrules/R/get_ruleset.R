#' Get a ruleset. 
#'
#' @param id the id of the ruleset. 
#' @param projectId id of project. 
#' @param limit page start.
#' @param offset number of records to return on page. 
#'
#' @return a `tibble`. 
#' @export
#'
#' @examples
#' \dontrun{
#' get_ruleset(1,1)
#' }
get_ruleset <- function(id=NULL,projectId=NULL,limit=NULL,offset=NULL) {
  if(is.null(id)) { 
    url <- gbifrules_url("ruleset")
    query <- list(id=id,
                  projectId=projectId,
                  offset=offset,
                  limit=limit
    ) |> 
      purrr::compact()
    r <- gbifrules_get(url,query=query)
    
    if(length(r) == 0) {
      # return empty tibble if nothing  
      return(tibble::tibble())
    }
    
    # Convert to data frame using jsonlite to properly flatten
    result <- jsonlite::fromJSON(jsonlite::toJSON(r), flatten = TRUE)
    
    # Convert to tibble
    r <- tibble::as_tibble(result)
    
    # Handle list columns - flatten scalar values and convert arrays to character strings
    r <- r |> dplyr::mutate_all(~ {
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
  } else {
    url <- paste0(gbifrules_url("ruleset/"),id)
    r <- gbifrules_get_id(url)
  }
  
  if(length(r) == 0 || nrow(r) == 0) {
    # return empty tibble if nothing  
    return(tibble::tibble())
  }
  
  # Define expected columns
  expected_cols <- c("id", "name", "description", "projectId", "created", 
                     "createdBy", "modified", "modifiedBy", "deleted", "deletedBy")
  
  # Add missing columns with NA values
  for (col in expected_cols) {
    if (!col %in% names(r)) {
      if (col %in% c("id", "projectId")) {
        r[[col]] <- NA_integer_
      } else {
        r[[col]] <- NA_character_
      }
    }
  }
  
  # Select only expected columns
  r |> dplyr::select(dplyr::all_of(expected_cols))
}
