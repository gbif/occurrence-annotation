#' Get a project
#'
#' @param id the id of the project.
#' @param offset page start.
#' @param limit number of records to return on page. 
#'
#' @return a `tibble`. 
#' @export
#'
#' @examples
#' \dontrun{
#' get_project()
#' }
get_project <- function(id=NULL,offset=NULL,limit=NULL) {
  
  if(is.null(id)) { 
    url <- gbifrules_url("project")
    query <- list(id=id,
                  offset=offset,
                  limit=limit
    ) |> 
      purrr::compact()
    r <- gbifrules_get(url,query=query)
    
    # Check if result is empty or NULL
    if (is.null(r) || length(r) == 0) {
      # Return empty tibble with expected columns
      return(tibble::tibble(
        id = integer(),
        name = character(),
        description = character(),
        created = character(),
        createdBy = character(),
        modified = character(),
        modifiedBy = character(),
        deleted = character(),
        deletedBy = character()
      ))
    }
    
    # Convert to data frame using jsonlite to properly flatten
    result <- jsonlite::fromJSON(jsonlite::toJSON(r), flatten = TRUE)
    
    # Convert to tibble
    r <- tibble::as_tibble(result)
    
    # Handle list columns - flatten scalar values but keep array fields like members as lists
    # Define which columns should remain as list columns
    array_cols <- c("members", "customVocabulary", "supportedBy", "contestedBy")
    
    # Flatten only non-array list columns
    for (col_name in names(r)) {
      if (is.list(r[[col_name]]) && !col_name %in% array_cols) {
        # This is a scalar column that needs flattening - extract single values
        r[[col_name]] <- purrr::map(r[[col_name]], ~ if (is.null(.x) || length(.x) == 0) NA else .x[[1L]]) |> unlist()
      }
    }
  } else {
    if(!is.null(offset)) warning("offset ignored when id is not null")
    if(!is.null(limit)) warning("limit ignored when id is not null")
    url <- paste0(gbifrules_url("project/"),id)
    r <- gbifrules_get_id(url)
  }
  
  # Check if result is empty or NULL
  if (is.null(r) || length(r) == 0 || nrow(r) == 0) {
    # Return empty tibble with expected columns
    return(tibble::tibble(
      id = integer(),
      name = character(),
      description = character(),
      members = list(),
      created = character(),
      createdBy = character(),
      modified = character(),
      modifiedBy = character(),
      deleted = character(),
      deletedBy = character()
    ))
  }
  
  # Define expected columns (members and customVocabulary can remain as list columns)
  expected_cols <- c("id", "name", "description", "members", "created", "createdBy", 
                     "modified", "modifiedBy", "deleted", "deletedBy")
  
  # Add missing columns with NA values
  for (col in expected_cols) {
    if (!col %in% names(r)) {
      if (col == "id") {
        r[[col]] <- NA_integer_
      } else if (col == "members") {
        r[[col]] <- list(NULL)
      } else {
        r[[col]] <- NA_character_
      }
    }
  }
  
  # Flatten scalar fields but keep members as list column
  scalar_cols <- c("id", "name", "description", "created", "createdBy", 
                   "modified", "modifiedBy", "deleted", "deletedBy")
  
  for (col in scalar_cols) {
    if (col %in% names(r) && is.list(r[[col]])) {
      # Extract scalar values from list columns
      r[[col]] <- purrr::map(r[[col]], ~ if (is.null(.x) || length(.x) == 0) NA else .x[[1L]]) |> unlist()
    }
  }
  
  # Select only expected columns
  r |> dplyr::select(dplyr::all_of(expected_cols))
  
}
