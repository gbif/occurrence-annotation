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
      created = character(),
      createdBy = character(),
      modified = character(),
      modifiedBy = character(),
      deleted = character(),
      deletedBy = character()
    ))
  }
  
  r |> 
    tidyr::unnest(cols = c("id", 
                           "name", 
                           "description",
                           "created", 
                           "createdBy",
                           "modified",
                           "modifiedBy",
                           "deleted", 
                           "deletedBy"))
  
}
